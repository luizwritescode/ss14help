"""End-to-end tests: build the miniature game repo in tests/fixtures/repo and compare the result
with the committed golden snapshot. After an intended change, regenerate the golden files with
``UPDATE_GOLDEN=1 uv run pytest tests/test_build.py`` and review the diff."""

import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from ss14help_pipeline.build import build_snapshot
from ss14help_pipeline.config import ServerConfig
from ss14help_pipeline.emit import SEARCH_INDEX_FILE
from ss14help_pipeline.fetch import Checkout
from ss14help_pipeline.models import DATA_FILES

FIXTURES = Path(__file__).parent / "fixtures"
GOLDEN = FIXTURES / "golden" / "upstream"
SERVER = ServerConfig.model_validate(
    {
        "id": "upstream",
        "name": "Test Upstream",
        "repo": "https://example.com/space-station-14",
        "branch": "master",
    }
)
CHECKOUT = Checkout(
    root=FIXTURES / "repo",
    sha="a" * 40,
    commit_date=datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC),
)
GENERATED_AT = datetime(2026, 1, 2, 6, 0, 0, tzinfo=UTC)
FILES = [*DATA_FILES, SEARCH_INDEX_FILE]


@pytest.fixture(scope="module")
def snapshot(tmp_path_factory: pytest.TempPathFactory) -> Path:
    data_dir = tmp_path_factory.mktemp("data")
    result = build_snapshot(SERVER, CHECKOUT, data_dir, generated_at=GENERATED_AT)
    if os.environ.get("UPDATE_GOLDEN"):
        shutil.rmtree(GOLDEN, ignore_errors=True)
        shutil.copytree(result.out_dir, GOLDEN)
    return result.out_dir


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("name", FILES)
def test_matches_golden(snapshot: Path, name: str) -> None:
    assert (snapshot / name).read_text(encoding="utf-8") == (GOLDEN / name).read_text(
        encoding="utf-8"
    ), f"{name} differs from the golden file; rerun with UPDATE_GOLDEN=1 if intended"


def by_id(items: list[dict[str, Any]], key: str = "id") -> dict[str, dict[str, Any]]:
    return {item[key]: item for item in items}


def test_reactions(snapshot: Path) -> None:
    reactions = by_id(load(snapshot / "recipes.json")["reactions"])
    assert reactions["Dexalin"]["reactants"]["Plasma"] == {"amount": 1, "catalyst": True}
    assert reactions["Dexalin"]["minTemp"] is None  # minTemp 0 is the default
    assert reactions["FrezonBurst"]["maxTemp"] == 300
    assert reactions["FrezonBurst"]["priority"] == 20
    assert reactions["FrezonBurst"]["products"] == {}
    assert [e["_type"] for e in reactions["FrezonBurst"]["effects"]] == [
        "CreateGas",
        "ExplosionReactionEffect",
    ]
    assert reactions["BloodBreakdown"]["products"] == {"Iron": 0.5, "Sugar": 2, "Water": 11}
    assert reactions["BloodBreakdown"]["mixers"] == ["Centrifuge"]
    assert reactions["CreateDough"]["quantized"] is True
    assert reactions["Bicaridine"]["category"] == "medicine"
    # Generic file stem → the product reagent's group (the fork's later Frezon definition wins).
    assert reactions["FrezonFromPlasma"]["category"] == "toxins"
    assert "Broken" not in reactions


def test_reagents_inheritance_and_localization(snapshot: Path) -> None:
    reagents = by_id(load(snapshot / "reagents.json")["reagents"])
    assert "BaseMedicine" not in reagents  # abstract
    assert reagents["Inaprovaline"]["group"] == "Medicine"  # inherited
    assert reagents["Inaprovaline"]["physicalDesc"] == "opaque"  # inherited, then localized
    assert reagents["Bicaridine"]["physicalDesc"] == "translucent"  # child overrides
    assert reagents["Dexalin"]["group"] == "Medicine"  # parent given as a list
    assert reagents["Dexalin"]["color"] is None  # invalid colour dropped
    assert reagents["Inaprovaline"]["desc"] == "A medicine that stabilizes breathing."  # term ref
    assert reagents["Carbon"]["name"] == "carbon"
    assert reagents["Frezon"]["group"] == "Toxins"
    assert reagents["Frezon"]["sourceFile"] == "_Fork/Recipes/reactions.yml"


def test_dispensable(snapshot: Path) -> None:
    reagents = load(snapshot / "reagents.json")["reagents"]
    # Jugs in the filled dispenser (nested selectors), plus generatable reagents. JugSugar is
    # commented out, so Sugar isn't dispensable.
    assert sorted(r["id"] for r in reagents if r["dispensable"]) == ["Carbon", "Iron", "Oxygen"]


def test_cooking_and_entities(snapshot: Path) -> None:
    recipes = load(snapshot / "recipes.json")
    cooking = by_id(recipes["cooking"])
    sandwich = cooking["RecipeChickenSandwich"]
    assert sandwich["solids"] == {"FoodBreadBun": 1, "FoodMeatChicken": 1}
    assert sandwich["reagents"] == {"Mayo": 5}  # v1 lost these
    assert cooking["RecipeBun"]["name"] == "bun recipe"
    assert cooking["RecipeBun"]["time"] == 5  # default
    assert cooking["RecipeBun"]["device"] == "Microwave"
    assert cooking["RecipeOvenBread"]["device"] == "Oven"
    assert cooking["RecipeOvenBread"]["secret"] is True
    assert recipes["mixers"] == [{"id": "Centrifuge", "name": "centrifugation"}]

    entities = by_id(load(snapshot / "entities.json")["entities"])
    assert entities["FoodBreadBun"]["name"] == "bun"
    assert entities["FoodBurgerChicken"]["desc"] == "Some food."  # inherited description
    # Only entities that recipes or sources reference are emitted.
    assert "JugCarbon" not in entities


def test_sources(snapshot: Path) -> None:
    sources = by_id(load(snapshot / "sources.json")["sources"], "entity")
    assert sources["WheatBushel"] == {
        "entity": "WheatBushel",
        "grind": {"Flour": 15},
        "juice": None,
    }
    assert sources["FoodLemon"]["juice"] == {"JuiceLemon": 10}
    assert sources["FoodLemon"]["grind"] is None  # no grindableSolutionName


def test_manifest_and_warnings(snapshot: Path) -> None:
    manifest = load(snapshot / "manifest.json")
    assert manifest["sha"] == "a" * 40
    assert manifest["counts"]["reactions"] == 7
    codes = sorted({w["code"] for w in manifest["warnings"]})
    assert codes == ["duplicate-id", "yaml-error"]


def test_output_is_deterministic(snapshot: Path, tmp_path: Path) -> None:
    again = build_snapshot(SERVER, CHECKOUT, tmp_path, generated_at=GENERATED_AT)
    for name in FILES:
        assert (again.out_dir / name).read_bytes() == (snapshot / name).read_bytes()


def test_server_only_flags(snapshot: Path, tmp_path: Path) -> None:
    # A fork build compares ids with data/upstream: everything exists upstream except what we
    # remove from the copy here.
    shutil.copytree(snapshot, tmp_path / "upstream")
    reagents_file = tmp_path / "upstream" / "reagents.json"
    doc = load(reagents_file)
    doc["reagents"] = [r for r in doc["reagents"] if r["id"] != "Frezon"]
    reagents_file.write_text(json.dumps(doc), encoding="utf-8")

    fork = SERVER.model_copy(update={"id": "fork", "name": "Fork"})
    result = build_snapshot(fork, CHECKOUT, tmp_path, generated_at=GENERATED_AT)
    flags = {r.id: r.server_only for r in result.data.reagents}
    assert flags["Frezon"] is True
    assert flags["Carbon"] is False
