from pathlib import Path

from ss14help_pipeline.localize import Localizer
from ss14help_pipeline.warnings import WarningLog

FTL = """\
-brand = Space Cola
ent-FoodDough = dough
    .desc = Raw dough, ready for { -brand }.
copy-of-desc = { ent-FoodDough.desc }
cycle-a = { cycle-b }
cycle-b = { cycle-a }
selector = { $count ->
    [one] one thing
   *[other] many things
}
broken = { -brand(arg: $x) }
"""


def load(tmp_path: Path) -> tuple[Localizer, WarningLog]:
    (tmp_path / "a.ftl").write_text(FTL, encoding="utf-8")
    log = WarningLog()
    return Localizer.load(tmp_path, log), log


def test_references_attributes_and_selectors(tmp_path: Path) -> None:
    loc, _ = load(tmp_path)
    assert loc.get("ent-FoodDough") == "dough"
    assert loc.get("ent-FoodDough.desc") == "Raw dough, ready for Space Cola."
    assert loc.get("copy-of-desc") == "Raw dough, ready for Space Cola."
    assert loc.get("selector") == "many things"
    assert loc.get("cycle-a") == ""  # reference cycles render empty instead of recursing
    assert loc.get("missing") is None


def test_text_falls_back_to_literal(tmp_path: Path) -> None:
    loc, _ = load(tmp_path)
    assert loc.text("ent-FoodDough") == "dough"
    assert loc.text("chicken sandwich recipe") == "chicken sandwich recipe"
    assert loc.text(None, "fallback") == "fallback"


def test_unparseable_entries_are_one_warning_per_file(tmp_path: Path) -> None:
    _, log = load(tmp_path)
    assert log.counts == {"ftl-error": 1}
