"""Build one server's snapshot: checkout → prototypes → models → ``data/<server>/``."""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel

from ss14help_pipeline.config import REPO_ROOT, ServerConfig
from ss14help_pipeline.emit import write_snapshot
from ss14help_pipeline.fetch import Checkout
from ss14help_pipeline.localize import Localizer
from ss14help_pipeline.models import (
    SCHEMA_VERSION,
    EntitiesFile,
    Manifest,
    ReagentsFile,
    RecipesFile,
    SourcesFile,
)
from ss14help_pipeline.normalize import Normalized, Normalizer, UpstreamIds
from ss14help_pipeline.partials import read_partial_paths
from ss14help_pipeline.prototypes import load_prototypes, resolve_inheritance
from ss14help_pipeline.warnings import WarningLog

DEFAULT_DATA_DIR = REPO_ROOT / "data"
UPSTREAM_SERVER_ID = "upstream"


@dataclass
class BuildResult:
    out_dir: Path
    manifest: Manifest
    data: Normalized
    files: dict[str, BaseModel]
    """Every contract file, ``manifest.json`` included, keyed by file name."""
    search_index: list[dict[str, str]]

    def write(self) -> list[Path]:
        return write_snapshot(self.out_dir, self.files, self.search_index)


def build_snapshot(
    server: ServerConfig,
    checkout: Checkout,
    data_dir: Path = DEFAULT_DATA_DIR,
    generated_at: datetime | None = None,
) -> BuildResult:
    """Assemble the snapshot and write it to ``data_dir / server.id``."""
    result = assemble_snapshot(server, checkout, data_dir, generated_at)
    result.write()
    return result


def assemble_snapshot(
    server: ServerConfig,
    checkout: Checkout,
    data_dir: Path = DEFAULT_DATA_DIR,
    generated_at: datetime | None = None,
) -> BuildResult:
    """Build the snapshot in memory, so it can be validated before anything is written."""
    log = WarningLog()
    partial_paths = read_partial_paths(checkout.resources)
    raw = load_prototypes(checkout.prototypes, log, partial_paths)
    index = resolve_inheritance(raw, log)
    loc = Localizer.load(checkout.locale, log)
    upstream = None if server.id == UPSTREAM_SERVER_ID else load_upstream_ids(data_dir)
    data = Normalizer(index, loc, log, upstream).run()

    files: dict[str, BaseModel] = {
        "reagents.json": ReagentsFile(reagents=data.reagents),
        "entities.json": EntitiesFile(entities=data.entities),
        "recipes.json": RecipesFile(
            reactions=data.reactions, cooking=data.cooking, mixers=data.mixers
        ),
        "sources.json": SourcesFile(sources=data.sources),
    }
    manifest = Manifest(
        schema_version=SCHEMA_VERSION,
        server=server.id,
        server_name=server.name,
        repo=str(server.repo),
        branch=server.branch,
        sha=checkout.sha,
        commit_date=checkout.commit_date,
        generated_at=generated_at or datetime.now(UTC).replace(microsecond=0),
        counts={
            "reagents": len(data.reagents),
            "entities": len(data.entities),
            "reactions": len(data.reactions),
            "cooking": len(data.cooking),
            "mixers": len(data.mixers),
            "sources": len(data.sources),
        },
        warnings=log.items(),
    )
    return BuildResult(
        out_dir=data_dir / server.id,
        manifest=manifest,
        data=data,
        files={"manifest.json": manifest, **files},
        search_index=search_index(data),
    )


def search_index(data: Normalized) -> list[dict[str, str]]:
    """Documents for the frontend's search (MiniSearch builds its index from these)."""
    docs = [
        {"kind": "reagent", "id": r.id, "name": r.name, "category": r.group or ""}
        for r in data.reagents
    ]
    names = {e.id: e.name for e in data.entities}
    docs += [
        {
            "kind": "item",
            "id": c.result,
            "name": names.get(c.result, c.result),
            "category": c.device,
        }
        for c in {c.result: c for c in data.cooking}.values()
    ]
    docs += [
        {"kind": "reaction", "id": r.id, "name": r.id, "category": r.category}
        for r in data.reactions
        if not r.products
    ]
    return sorted(docs, key=lambda d: (d["kind"], d["id"]))


def load_upstream_ids(data_dir: Path) -> UpstreamIds | None:
    """Ids in the committed upstream snapshot, used to flag server-only content."""
    base = data_dir / UPSTREAM_SERVER_ID
    if not (base / "manifest.json").exists():
        return None

    def ids(file: str, key: str, field: str = "id") -> set[str]:
        doc = json.loads((base / file).read_text(encoding="utf-8"))
        return {item[field] for item in doc[key]}

    return UpstreamIds(
        reagents=ids("reagents.json", "reagents"),
        entities=ids("entities.json", "entities"),
        reactions=ids("recipes.json", "reactions"),
        cooking=ids("recipes.json", "cooking"),
    )
