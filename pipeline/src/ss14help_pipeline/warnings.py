"""Non-fatal problems found while building a snapshot. They end up in ``manifest.warnings``."""

from collections import Counter

from ss14help_pipeline.models import PipelineWarning

MAX_PER_CODE = 50
"""Keep the manifest readable: after this many warnings of one code, only count the rest."""


class WarningLog:
    def __init__(self) -> None:
        self._items: list[PipelineWarning] = []
        self._counts: Counter[str] = Counter()

    def add(self, code: str, message: str, source_file: str | None = None) -> None:
        self._counts[code] += 1
        if self._counts[code] <= MAX_PER_CODE:
            self._items.append(PipelineWarning(code=code, message=message, source_file=source_file))

    @property
    def counts(self) -> dict[str, int]:
        return dict(sorted(self._counts.items()))

    def items(self) -> list[PipelineWarning]:
        """Sorted, plus one summary line per code that hit the cap."""
        out = sorted(self._items, key=lambda w: (w.code, w.source_file or "", w.message))
        for code, n in sorted(self._counts.items()):
            if n > MAX_PER_CODE:
                out.append(
                    PipelineWarning(
                        code=code,
                        message=f"{n - MAX_PER_CODE} more '{code}' warnings not listed",
                        source_file=None,
                    )
                )
        return out
