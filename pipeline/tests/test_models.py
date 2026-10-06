import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from ss14help_pipeline.config import REPO_ROOT
from ss14help_pipeline.models import DATA_FILES, SCHEMA_VERSION, Manifest, Reaction
from ss14help_pipeline.schema import DEFAULT_SCHEMA_FILE, build_schema

EXAMPLES = REPO_ROOT / "schema" / "examples"


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("file_name", list(DATA_FILES))
def test_example_round_trips(file_name: str) -> None:
    """Examples validate, and are canonical: every field written, nothing extra."""
    raw = load(EXAMPLES / file_name)
    model = DATA_FILES[file_name].model_validate(raw)
    assert model.model_dump(mode="json") == raw


def test_examples_are_internally_consistent() -> None:
    reagents = {r["id"] for r in load(EXAMPLES / "reagents.json")["reagents"]}
    entities = {e["id"] for e in load(EXAMPLES / "entities.json")["entities"]}
    recipes = load(EXAMPLES / "recipes.json")
    mixers = {m["id"] for m in recipes["mixers"]}
    for reaction in recipes["reactions"]:
        assert set(reaction["reactants"]) | set(reaction["products"]) <= reagents
        assert set(reaction["mixers"]) <= mixers
    for recipe in recipes["cooking"]:
        assert set(recipe["solids"]) | {recipe["result"]} <= entities
        assert set(recipe["reagents"]) <= reagents
    for source in load(EXAMPLES / "sources.json")["sources"]:
        assert source["entity"] in entities
        assert set(source["grind"] or {}) | set(source["juice"] or {}) <= reagents


def test_manifest_example_uses_current_schema_version() -> None:
    assert (
        Manifest.model_validate(load(EXAMPLES / "manifest.json")).schema_version == SCHEMA_VERSION
    )


def test_unknown_fields_are_rejected() -> None:
    raw = load(EXAMPLES / "recipes.json")["reactions"][0] | {"typo": 1}
    with pytest.raises(ValidationError, match="typo"):
        Reaction.model_validate(raw)


@pytest.mark.parametrize(
    ("field", "value"),
    [("reactants", {}), ("products", {"Bicaridine": 0}), ("id", "has space")],
)
def test_structural_constraints(field: str, value: Any) -> None:
    raw = load(EXAMPLES / "recipes.json")["reactions"][0] | {field: value}
    with pytest.raises(ValidationError):
        Reaction.model_validate(raw)


def test_snake_case_names_are_accepted_too() -> None:
    reaction = load(EXAMPLES / "recipes.json")["reactions"][1]
    reaction["min_temp"] = reaction.pop("minTemp")
    assert Reaction.model_validate(reaction).min_temp == 370


def test_committed_schema_is_up_to_date() -> None:
    assert load(DEFAULT_SCHEMA_FILE) == build_schema(), (
        "schema/ss14help.schema.json is stale: run `uv run ss14help-pipeline schema` "
        "and `pnpm --filter @ss14help/schema generate`, then bump SCHEMA_VERSION if needed"
    )
