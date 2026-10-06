"""Export the data contract (``models.py``) as one JSON Schema document."""

import json
from pathlib import Path
from typing import Any

from pydantic.json_schema import models_json_schema

from ss14help_pipeline.config import REPO_ROOT
from ss14help_pipeline.models import DATA_FILES, SCHEMA_VERSION

DEFAULT_SCHEMA_FILE = REPO_ROOT / "schema" / "ss14help.schema.json"


def build_schema() -> dict[str, Any]:
    """Return a schema whose root object maps each data file name to its model.

    The root isn't a real document. It exists so every model lands in ``$defs`` under a stable
    name, which is what the TypeScript generator needs.
    """
    models = list(DATA_FILES.values())
    refs, top = models_json_schema(
        [(model, "serialization") for model in models], ref_template="#/$defs/{model}"
    )
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://ss14help/schema/{SCHEMA_VERSION}",
        "title": "DataFiles",
        "description": f"ss14help data snapshot contract, schema version {SCHEMA_VERSION}.",
        "type": "object",
        "properties": {name: refs[(model, "serialization")] for name, model in DATA_FILES.items()},
        "required": list(DATA_FILES),
        "additionalProperties": False,
        "x-schemaVersion": SCHEMA_VERSION,
        "$defs": {name: _strip_field_titles(d) for name, d in top["$defs"].items()},
    }


def _strip_field_titles(definition: dict[str, Any]) -> dict[str, Any]:
    """Drop Pydantic's per-field titles ("Mintemp"); generators turn them into junk type names."""
    properties = {
        name: {k: v for k, v in prop.items() if k != "title"}
        for name, prop in definition.get("properties", {}).items()
    }
    return {**definition, "properties": properties} if properties else definition


def write_schema(path: Path = DEFAULT_SCHEMA_FILE) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(build_schema(), indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return path
