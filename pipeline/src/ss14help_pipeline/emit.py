"""Write a snapshot as deterministic JSON so that git diffs between runs only show real changes."""

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from ss14help_pipeline.models import DATA_FILES

SEARCH_INDEX_FILE = "search-index.json"


def canonical(value: Any) -> Any:
    """Sort mapping keys and write whole floats as ints (``2.0`` → ``2``)."""
    if isinstance(value, dict):
        return {k: canonical(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def dumps(value: Any) -> str:
    return json.dumps(canonical(value), indent=1, ensure_ascii=False) + "\n"


def write_snapshot(
    out_dir: Path, files: dict[str, BaseModel], search_index: list[dict[str, str]]
) -> list[Path]:
    """Validate every file against its contract model, then write them all."""
    for name, model in files.items():
        DATA_FILES[name].model_validate(model.model_dump(mode="json"))
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, model in files.items():
        path = out_dir / name
        path.write_text(dumps(model.model_dump(mode="json")), encoding="utf-8", newline="\n")
        written.append(path)
    path = out_dir / SEARCH_INDEX_FILE
    path.write_text(dumps(search_index), encoding="utf-8", newline="\n")
    written.append(path)
    return written
