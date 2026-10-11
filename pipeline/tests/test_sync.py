"""Phase 4: validation layers, the halt path of ``build``, and the diff/changelog it publishes."""

import dataclasses
import json
from pathlib import Path

import pytest
from test_build import CHECKOUT, FIXTURES, GENERATED_AT, SERVER

from ss14help_pipeline.build import BuildResult, assemble_snapshot
from ss14help_pipeline.cli import EXIT_HALT, main
from ss14help_pipeline.models import DATA_FILES, Manifest, Reactant
from ss14help_pipeline.validate import (
    Problem,
    references,
    regression,
    render_report,
    sanity,
    validate,
)

SOURCE = FIXTURES / "repo"


@pytest.fixture(scope="module")
def result(tmp_path_factory: pytest.TempPathFactory) -> BuildResult:
    return assemble_snapshot(SERVER, CHECKOUT, tmp_path_factory.mktemp("data"), GENERATED_AT)


def build(out: Path, *extra: str) -> int:
    return main(["build", "upstream", "--source", str(SOURCE), "--out", str(out), *extra])


def test_fixture_passes(result: BuildResult) -> None:
    assert validate(result, result.manifest) == []


def test_unresolved_references(result: BuildResult) -> None:
    reactions = [
        r.model_copy(update={"products": {"Nonexistent": 1.0}}) if r.id == "Bicaridine" else r
        for r in result.data.reactions
    ]
    data = dataclasses.replace(result.data, reactions=reactions)
    problems = list(references(data, frozenset()))
    assert [p.message for p in problems] == [
        "reaction `Bicaridine`: product `Nonexistent` doesn't resolve"
    ]
    assert problems[0].source_file == "Recipes/Reactions/medicine.yml"
    assert list(references(data, frozenset({"Nonexistent"}))) == []


def test_sanity(result: BuildResult) -> None:
    reactions = []
    for r in result.data.reactions:
        if r.id == "Dexalin":
            r = r.model_copy(update={"min_temp": 400.0, "max_temp": 300.0})
        if r.id == "Bicaridine":
            reactants = {"Water": Reactant(amount=2), "Plasma": Reactant(amount=1, catalyst=True)}
            r = r.model_copy(update={"reactants": reactants, "products": {"Water": 2.0}})
        reactions.append(r)
    data = dataclasses.replace(result.data, reactions=reactions)
    assert sorted(p.message for p in sanity(data)) == [
        "reaction `Bicaridine`: products equal its reactants",
        "reaction `Dexalin`: maxTemp 300.0 K is not above minTemp 400.0 K",
    ]


def test_regression_guard(result: BuildResult) -> None:
    reactions = result.manifest.counts["reactions"]
    previous = result.manifest.model_copy(
        update={"counts": {**result.manifest.counts, "reactions": reactions * 2}}
    )
    [problem] = regression(result.manifest, previous)
    assert problem.layer == "regression"
    assert "reactions dropped" in problem.message
    assert validate(result, previous, allow_regression=True) == []
    assert list(regression(result.manifest, None)) == []


@pytest.mark.parametrize(("new", "halts"), [(91, False), (89, True)])
def test_regression_limit_is_ten_percent(result: BuildResult, new: int, halts: bool) -> None:
    def with_reactions(n: int) -> Manifest:
        return result.manifest.model_copy(update={"counts": {"reactions": n}})

    assert bool(list(regression(with_reactions(new), with_reactions(100)))) is halts


def test_report_links_and_escapes(result: BuildResult) -> None:
    report = render_report(
        result.manifest, [Problem("sanity", "a | b", "Recipes/Reactions/medicine.yml")]
    )
    assert "a \\| b" in report
    m = result.manifest
    assert f"{m.repo}/blob/{m.sha}/Resources/Prototypes/Recipes/Reactions/medicine.yml" in report


def test_halt_leaves_published_data_untouched(tmp_path: Path) -> None:
    assert build(tmp_path) == 0
    published = tmp_path / "upstream"
    # Pretend the published snapshot had far more reactions, so this build looks broken.
    manifest = json.loads((published / "manifest.json").read_text(encoding="utf-8"))
    manifest["counts"]["reactions"] *= 2
    (published / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    before = {p.name: p.read_bytes() for p in published.iterdir()}

    report = tmp_path / "report.md"
    assert build(tmp_path, "--report", str(report)) == EXIT_HALT
    assert {p.name: p.read_bytes() for p in published.iterdir()} == before
    assert "reactions dropped" in report.read_text(encoding="utf-8")

    assert build(tmp_path, "--allow-regression") == 0


def test_changelog_and_commit_message(tmp_path: Path) -> None:
    message = tmp_path / "message.txt"
    published = tmp_path / "data" / "upstream"
    changelog = published / "CHANGELOG.md"

    assert build(tmp_path / "data", "--commit-message", str(message)) == 0
    assert "(initial snapshot)" in message.read_text(encoding="utf-8")
    assert "- Initial snapshot: " in changelog.read_text(encoding="utf-8")

    # Same input again: nothing to log.
    first = changelog.read_text(encoding="utf-8")
    assert build(tmp_path / "data", "--commit-message", str(message)) == 0
    assert message.read_text(encoding="utf-8").endswith("(no data changes)\n")
    assert changelog.read_text(encoding="utf-8") == first

    # Drop one reaction and change another in the published copy: the rebuild restores them.
    recipes = json.loads((published / "recipes.json").read_text(encoding="utf-8"))
    recipes["reactions"] = [r for r in recipes["reactions"] if r["id"] != "Dexalin"]
    for r in recipes["reactions"]:
        if r["id"] == "Bicaridine":
            r["priority"] = 99
    (published / "recipes.json").write_text(json.dumps(recipes), encoding="utf-8")
    assert build(tmp_path / "data", "--commit-message", str(message)) == 0
    assert message.read_text(encoding="utf-8").endswith("(+1 reactions, ~1 changed)\n")
    text = changelog.read_text(encoding="utf-8")
    assert text.count("\n## ") == 2
    newest = text.split("\n## ")[1]
    assert "- Reactions added: `Dexalin`" in newest
    assert "- Reactions changed: `Bicaridine`" in newest


def test_servers_json(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["servers", "--json"]) == 0
    servers = json.loads(capsys.readouterr().out)
    assert [s["id"] for s in servers][:1] == ["upstream"]
    assert {"id", "name", "repo", "branch", "features"} <= servers[0].keys()


def test_build_still_writes_every_contract_file(tmp_path: Path) -> None:
    assert build(tmp_path) == 0
    assert {p.name for p in (tmp_path / "upstream").iterdir()} >= set(DATA_FILES)
