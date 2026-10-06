"""Resolve Fluent (``.ftl``) localization ids to English text."""

from pathlib import Path

from fluent.syntax import FluentParser, ast

from ss14help_pipeline.warnings import WarningLog


class Localizer:
    """``get("reagent-name-dylovene") -> "dylovene"``. Unknown ids return ``None``.

    Only what recipe names need is supported: text, string/number literals and references to
    other messages or terms. Anything else (selectors, function calls) renders as its default
    variant or is dropped.
    """

    def __init__(self) -> None:
        self._patterns: dict[str, ast.Pattern] = {}
        self._cache: dict[str, str | None] = {}

    @classmethod
    def load(cls, locale_dir: Path, log: WarningLog) -> "Localizer":
        loc = cls()
        parser = FluentParser(with_spans=False)
        paths = {p.relative_to(locale_dir).as_posix(): p for p in locale_dir.rglob("*.ftl")}
        for rel, path in sorted(paths.items()):
            resource = parser.parse(path.read_text(encoding="utf-8-sig"))
            junk = sum(isinstance(e, ast.Junk) for e in resource.body)
            if junk:
                # Usually RobustToolbox's Fluent extensions (term arguments with variables).
                log.add("ftl-error", f"{junk} unparseable Fluent entries skipped", f"Locale/{rel}")
            for entry in resource.body:
                if isinstance(entry, ast.Message | ast.Term):
                    prefix = "-" if isinstance(entry, ast.Term) else ""
                    key = prefix + entry.id.name
                    if entry.value is not None:
                        loc._patterns[key] = entry.value
                    for attr in entry.attributes:
                        loc._patterns[f"{key}.{attr.id.name}"] = attr.value
        return loc

    def __contains__(self, key: str) -> bool:
        return key in self._patterns

    def get(self, key: str) -> str | None:
        if key not in self._cache:
            self._cache[key] = None  # guards against reference cycles
            pattern = self._patterns.get(key)
            self._cache[key] = None if pattern is None else self._render(pattern).strip()
        return self._cache[key]

    def text(self, value: object, fallback: str | None = None) -> str | None:
        """Localize ``value`` if it is a known id; otherwise return it as literal text."""
        if not isinstance(value, str) or not value:
            return fallback
        localized = self.get(value)
        return localized if localized is not None else value

    def _render(self, pattern: ast.Pattern) -> str:
        return "".join(self._render_element(e) for e in pattern.elements)

    def _render_element(self, element: ast.PatternElement) -> str:
        if isinstance(element, ast.TextElement):
            return element.value
        if isinstance(element, ast.Placeable):
            return self._render_expression(element.expression)
        return ""

    def _render_expression(self, expr: object) -> str:
        if isinstance(expr, ast.StringLiteral):
            return expr.parse()["value"]
        if isinstance(expr, ast.NumberLiteral):
            return expr.value
        if isinstance(expr, ast.MessageReference):
            key = expr.id.name + (f".{expr.attribute.name}" if expr.attribute else "")
            return self.get(key) or ""
        if isinstance(expr, ast.TermReference):
            key = "-" + expr.id.name + (f".{expr.attribute.name}" if expr.attribute else "")
            return self.get(key) or ""
        if isinstance(expr, ast.SelectExpression):
            default = next((v for v in expr.variants if v.default), None)
            return self._render(default.value) if default else ""
        if isinstance(expr, ast.Placeable):
            return self._render_expression(expr.expression)
        return ""
