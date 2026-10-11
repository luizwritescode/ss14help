"""Decide whether a freshly built snapshot is safe to publish.

Any problem found here halts publishing for that server: nothing is written, and the sync job
opens a ``Pipeline halted: <server>`` issue with the report. Non-fatal findings stay in
``manifest.warnings`` instead.

Layers:
1. **Contract:** every file validates against its contract model (``schema/`` is exported from
   the same models, and CI fails when it's stale), and ``schemaVersion`` is the pipeline's.
2. **References:** every reactant, product, mixer, solid, cooking reagent, result and source id
   resolves, unless it's on ``pipeline/allowlist.yaml``.
3. **Sanity:** amounts > 0, ``0 < minTemp < maxTemp``, cooking time ≥ 0, and no reaction whose
   products equal its reactants.
4. **Regression:** no guarded count drops by more than 10% against the published snapshot, which
   catches a parser silently missing a folder.
"""

import json
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic import ValidationError

from ss14help_pipeline.build import BuildResult
from ss14help_pipeline.config import REPO_ROOT
from ss14help_pipeline.models import DATA_FILES, SCHEMA_VERSION, Manifest
from ss14help_pipeline.normalize import Normalized

DEFAULT_ALLOWLIST = REPO_ROOT / "pipeline" / "allowlist.yaml"
REGRESSION_LIMIT = 0.10
GUARDED_COUNTS = ("reactions", "reagents", "cooking", "sources")
MAX_REPORT_ROWS = 100


@dataclass(frozen=True)
class Problem:
    layer: str
    message: str
    source_file: str | None = None


def load_allowlist(path: Path = DEFAULT_ALLOWLIST) -> frozenset[str]:
    """Ids that may be referenced without resolving to anything."""
    if not path.exists():
        return frozenset()
    doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return frozenset(str(i) for i in doc.get("unresolved") or ())


def read_manifest(out_dir: Path) -> Manifest | None:
    """The published snapshot's manifest, if there is one."""
    path = out_dir / "manifest.json"
    if not path.exists():
        return None
    return Manifest.model_validate(json.loads(path.read_text(encoding="utf-8")))


def validate(
    result: BuildResult,
    previous: Manifest | None,
    allowlist: frozenset[str] = frozenset(),
    allow_regression: bool = False,
) -> list[Problem]:
    problems = [
        *contract(result),
        *references(result.data, allowlist),
        *sanity(result.data),
    ]
    if not allow_regression:
        problems += regression(result.manifest, previous)
    return problems


def contract(result: BuildResult) -> Iterator[Problem]:
    for name, model in result.files.items():
        try:
            DATA_FILES[name].model_validate(model.model_dump(mode="json"))
        except ValidationError as e:
            yield Problem("contract", f"{name}: {str(e).splitlines()[0]}")
    if result.manifest.schema_version != SCHEMA_VERSION:
        yield Problem(
            "contract",
            f"schemaVersion {result.manifest.schema_version} is not the pipeline's "
            f"{SCHEMA_VERSION}",
        )


def references(data: Normalized, allowlist: frozenset[str]) -> Iterator[Problem]:
    reagents = {r.id for r in data.reagents}
    entities = {e.id for e in data.entities}
    mixers = {m.id for m in data.mixers}

    def missing(
        ids: Iterable[str], known: set[str], what: str, owner: str, source_file: str | None
    ) -> Iterator[Problem]:
        for i in sorted(set(ids) - known - allowlist):
            yield Problem("reference", f"{owner}: {what} `{i}` doesn't resolve", source_file)

    for r in data.reactions:
        owner = f"reaction `{r.id}`"
        yield from missing(r.reactants, reagents, "reactant", owner, r.source_file)
        yield from missing(r.products, reagents, "product", owner, r.source_file)
        yield from missing(r.mixers, mixers, "mixer", owner, r.source_file)
    for c in data.cooking:
        owner = f"cooking recipe `{c.id}`"
        yield from missing(c.solids, entities, "solid", owner, c.source_file)
        yield from missing(c.reagents, reagents, "reagent", owner, c.source_file)
        yield from missing([c.result], entities | reagents, "result", owner, c.source_file)
    for s in data.sources:
        owner = f"source `{s.entity}`"
        yield from missing([s.entity], entities, "entity", owner, None)
        yield from missing([*(s.grind or {}), *(s.juice or {})], reagents, "reagent", owner, None)


def sanity(data: Normalized) -> Iterator[Problem]:
    for r in data.reactions:
        owner = f"reaction `{r.id}`"
        amounts = [*(x.amount for x in r.reactants.values()), *r.products.values()]
        if any(a <= 0 for a in amounts):
            yield Problem("sanity", f"{owner}: non-positive amount", r.source_file)
        if r.min_temp is not None and r.min_temp <= 0:
            yield Problem("sanity", f"{owner}: minTemp {r.min_temp} K", r.source_file)
        if r.max_temp is not None and r.max_temp <= (r.min_temp or 0):
            yield Problem(
                "sanity",
                f"{owner}: maxTemp {r.max_temp} K is not above minTemp {r.min_temp or 0} K",
                r.source_file,
            )
        consumed = {i: x.amount for i, x in r.reactants.items() if not x.catalyst}
        if r.products and r.products == consumed:
            yield Problem("sanity", f"{owner}: products equal its reactants", r.source_file)
    for c in data.cooking:
        owner = f"cooking recipe `{c.id}`"
        if c.time is not None and c.time < 0:
            yield Problem("sanity", f"{owner}: negative time {c.time}", c.source_file)
        if any(n <= 0 for n in c.solids.values()) or any(a <= 0 for a in c.reagents.values()):
            yield Problem("sanity", f"{owner}: non-positive amount", c.source_file)
    for s in data.sources:
        if any(a <= 0 for a in [*(s.grind or {}).values(), *(s.juice or {}).values()]):
            yield Problem("sanity", f"source `{s.entity}`: non-positive amount")


def regression(manifest: Manifest, previous: Manifest | None) -> Iterator[Problem]:
    if previous is None:
        return
    for key in GUARDED_COUNTS:
        old, new = previous.counts.get(key, 0), manifest.counts.get(key, 0)
        if old and new < old * (1 - REGRESSION_LIMIT):
            yield Problem(
                "regression",
                f"{key} dropped from {old} to {new} ({(new - old) / old:.0%}), more than "
                f"{REGRESSION_LIMIT:.0%} against the published snapshot ({previous.sha[:7]})",
            )


def render_report(manifest: Manifest, problems: list[Problem]) -> str:
    """Markdown for the halt issue: what failed, at which commit, with links to the files."""
    sha = manifest.sha
    lines = [
        f"Validation failed for **{manifest.server_name}** (`{manifest.server}`) at "
        f"[`{sha[:7]}`]({manifest.repo}/commit/{sha}). Nothing was published.",
        "",
        f"{len(problems)} problem(s):",
        "",
        "| Layer | Problem | File |",
        "|---|---|---|",
    ]
    for p in problems[:MAX_REPORT_ROWS]:
        file = ""
        if p.source_file:
            url = f"{manifest.repo}/blob/{sha}/Resources/Prototypes/{p.source_file}"
            file = f"[{p.source_file}]({url})"
        lines.append(f"| {p.layer} | {p.message.replace('|', '\\|')} | {file} |")
    if len(problems) > MAX_REPORT_ROWS:
        lines.append(f"| … | {len(problems) - MAX_REPORT_ROWS} more not listed | |")
    return "\n".join(lines) + "\n"
