"""Partial prototypes, following the examples in RobustToolbox's IPrototypeManager.PartialDirectory
docs (Starlight fork)."""

from pathlib import Path
from typing import Any

import yaml

from ss14help_pipeline.partials import (
    apply_partial,
    partial_index,
    read_partial_paths,
    strip,
)
from ss14help_pipeline.prototypes import PrototypeLoader, load_prototypes
from ss14help_pipeline.warnings import WarningLog


def y(text: str) -> Any:
    return yaml.load(text, Loader=PrototypeLoader)


def patched(original: str, patch: str, *, entity: bool = True) -> dict[str, Any]:
    data: dict[str, Any] = strip(y(original))
    apply_partial(data, y(patch), entity=entity)
    return data


ENTITY = """
type: entity
id: MyEntityOne
components:
- type: MyComponent
  list: [1, 3]
  dictionary: {a: 1, c: 3}
- type: Other
  x: 1
"""


def comp(data: dict[str, Any], name: str) -> dict[str, Any] | None:
    return next((c for c in data["components"] if c.get("type") == name), None)


def test_sequences_append_and_remove() -> None:
    data = patched(ENTITY, "components:\n- type: MyComponent\n  list:\n  - !Remove 1\n  - 2\n")
    assert comp(data, "MyComponent") == {
        "type": "MyComponent",
        "list": [3, 2],
        "dictionary": {"a": 1, "c": 3},
    }


def test_clear_then_add() -> None:
    data = patched(ENTITY, "components:\n- type: MyComponent\n  list: !Clear\n  - 7\n")
    assert comp(data, "MyComponent")["list"] == [7]  # type: ignore[index]


def test_mapping_remove_and_conditional_remove() -> None:
    patch = (
        "components:\n- type: MyComponent\n"
        "  dictionary:\n    a: !Remove\n    c: !Remove 4\n    b: 2\n"
    )
    data = patched(ENTITY, patch)
    # `c: !Remove 4` only removes c if its value is 4; it's 3, so it stays.
    assert comp(data, "MyComponent")["dictionary"] == {"c": 3, "b": 2}  # type: ignore[index]


def test_remove_component_both_ways() -> None:
    data = patched(ENTITY, "components:\n- !Remove type: Other\n")
    assert comp(data, "Other") is None
    assert comp(data, "MyComponent") is not None


def test_new_component_is_added_and_scalars_replace() -> None:
    data = patched(ENTITY, "name: patched\ncomponents:\n- type: Third\n- type: Other\n  x: 2\n")
    assert data["name"] == "patched"
    assert comp(data, "Third") == {"type": "Third"}
    assert comp(data, "Other") == {"type": "Other", "x": 2}


def test_index_insert() -> None:
    data = patched(
        "type: borgType\nid: B\ndefaultModules: [A, Existing, C]\n",
        "defaultModules:\n- !Index:0 New\n- !Remove Existing\n- !Index:-1 Existing\n",
        entity=False,
    )
    assert data["defaultModules"] == ["New", "A", "Existing", "C"]


def test_index_tag_on_first_key() -> None:
    data = patched(
        "type: entity\nid: S\ncomponents:\n- type: Spawner\n  children:\n  - id: A\n",
        "components:\n- type: Spawner\n  children:\n  - !Index:0 id: B\n",
    )
    assert comp(data, "Spawner")["children"] == [{"id": "B"}, {"id": "A"}]  # type: ignore[index]


def test_directives_outside_partials_are_plain_values() -> None:
    assert strip(y("- type: !Remove AccessReader\n")) == [{"type": "AccessReader"}]


def write(root: Path, rel: str, text: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_loader_applies_partials_in_order(tmp_path: Path) -> None:
    resources = tmp_path / "Resources"
    write(
        resources,
        "PartialPrototypes/a.yml",
        "- /Prototypes/_Fork/Partials\n- /Prototypes/_Other/patch.yml\n",
    )
    protos = resources / "Prototypes"
    # `_Fork` sorts before `Reagents`, but partials still apply after every normal file.
    write(protos, "_Fork/Partials/r.yml", "- type: reagent\n  id: Water\n  color: '#000001'\n")
    write(protos, "_Other/patch.yml", "- type: reagent\n  id: Water\n  color: '#000002'\n")
    write(
        protos,
        "_Fork/Partials/only.yml",
        "- type: !PartialOnly reagent\n  id: Missing\n  group: X\n"
        "- type: reagent\n  id: Added\n  group: Y\n"
        "- type: !PartialOnly reagent\n  id: !type:CreateVariants\n  values: [Water, Juice]\n"
        "  group: Drinks\n",
    )
    write(protos, "Reagents/misc.yml", "- type: reagent\n  id: Water\n  color: '#ffffff'\n")
    paths = read_partial_paths(resources)
    assert paths == ["_Fork/Partials", "_Other/patch.yml"]
    assert partial_index("_Fork/Partials/x/y.yml", paths) == 0
    assert partial_index("_Fork/PartialsNot/y.yml", paths) is None

    log = WarningLog()
    index = load_prototypes(protos, log, paths)
    water = index.get("reagent", "Water")
    assert water is not None
    # The later partial entry wins; the variant patch applies to Water (Juice doesn't exist).
    assert water.data["color"] == "#000002"
    assert water.data["group"] == "Drinks"
    assert water.source_file == "Reagents/misc.yml"
    assert index.get("reagent", "Missing") is None  # PartialOnly without an original
    assert index.get("reagent", "Juice") is None
    added = index.get("reagent", "Added")
    assert added is not None and added.data["group"] == "Y"
    assert log.counts == {}  # partials aren't duplicates
