"""Partial prototypes: forks patching existing prototypes from their own files.

Ported from RobustToolbox's ``PrototypeManager.YamlLoad.cs`` (``CombineMapNode`` /
``CombineSeqNode``) as used by Starlight. Directories or files listed in
``Resources/PartialPrototypes/*.yml`` are *partial*: after every other file is loaded, each
prototype in them is combined into the existing prototype with the same kind and id, before
inheritance is resolved:

- mappings combine key by key, recursively; a scalar replaces the old value;
- sequences are appended to; entity ``components`` combine by component ``type``;
- ``!Remove`` deletes a key (``"a": !Remove``, or ``!Remove 1`` only if the value is 1), a
  sequence item (``- !Remove X``) or, as ``- !Remove type: Foo``, a component;
- ``!Clear`` empties a mapping or sequence, then adds what follows;
- ``!Index:n`` / ``!CombineIndex:n`` insert at / combine into position n (negative counts from
  the end);
- ``type: !PartialOnly kind`` skips the patch when there is no original.

Outside partial files the engine ignores these tags, so they are stripped to their plain values.
"""

import copy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DIRECTIVES = ("Remove", "Clear", "PartialOnly", "PartialModified")
INDEX_PREFIXES = ("Index:", "CombineIndex:")


@dataclass(frozen=True)
class Directive:
    """A partial-prototype tag on a YAML node or mapping key, e.g. ``!Remove`` or ``!Index:0``."""

    tag: str
    value: Any = None

    def __hash__(self) -> int:
        return hash((self.tag, repr(self.value)))


def is_directive_tag(name: str) -> bool:
    return name in DIRECTIVES or name.startswith(INDEX_PREFIXES)


def tag_of(node: Any, name: str) -> bool:
    return isinstance(node, Directive) and node.tag == name


def strip(value: Any) -> Any:
    """Replace every directive with its plain value, the way non-partial loading reads it."""
    if isinstance(value, Directive):
        return strip(value.value)
    if isinstance(value, dict):
        return {strip(k): strip(v) for k, v in value.items()}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def read_partial_paths(resources_dir: Path) -> list[str]:
    """Partial paths relative to ``Resources/Prototypes``, in application order.

    Each ``Resources/PartialPrototypes/*.yml`` (by file name) lists entries like
    ``/Prototypes/_Fork/Partials`` (a directory) or ``/Prototypes/foo.yml`` (a file).
    """
    config_dir = resources_dir / "PartialPrototypes"
    out: list[str] = []
    if not config_dir.is_dir():
        return out
    for path in sorted(config_dir.glob("*.yml"), key=lambda p: p.name):
        for entry in yaml.safe_load(path.read_text(encoding="utf-8-sig")) or []:
            rel = str(entry).strip().lstrip("/")
            if rel.startswith("Prototypes/"):
                out.append(rel[len("Prototypes/") :].rstrip("/"))
    return out


def partial_index(rel_path: str, partial_paths: list[str]) -> int | None:
    """Which partial entry a prototype file belongs to (smaller = applied first), if any."""
    for i, entry in enumerate(partial_paths):
        if rel_path == entry or rel_path.startswith(entry + "/"):
            return i
    return None


def combine_mapping(
    existing: dict[Any, Any], data: dict[Any, Any], *, components: bool = False
) -> bool:
    """Combine ``data`` into ``existing`` in place. Returns True if a removal emptied it.

    ``components`` makes the top-level ``components`` sequence combine by ``type`` (entities).
    """
    full_deleted = False
    for raw_key, node in data.items():
        key_tag = raw_key.tag if isinstance(raw_key, Directive) else None
        key = strip(raw_key)

        if key_tag == "Clear" or tag_of(node, "Clear"):
            current = existing.get(key)
            if isinstance(current, dict | list):
                current.clear()
            node = node.value if tag_of(node, "Clear") else node

        if key_tag == "Remove" or tag_of(node, "Remove"):
            target = node.value if isinstance(node, Directive) else node
            if _is_empty(target) or (key in existing and _same(existing[key], target)):
                existing.pop(key, None)
                if not existing:
                    full_deleted = True
            continue

        if key in existing:
            as_mapping_key = "type" if components and key == "components" else None
            if _combine(existing[key], node, as_mapping_key):
                continue

        if not _is_empty(node):
            existing[key] = strip(node)
    return full_deleted


def _combine(existing: Any, data: Any, as_mapping_key: str | None) -> bool:
    if isinstance(existing, dict) and isinstance(data, dict):
        combine_mapping(existing, data)
        return True
    if isinstance(existing, list) and isinstance(data, list):
        _combine_sequence(existing, data, as_mapping_key)
        return True
    return False


def _combine_sequence(existing: list[Any], data: list[Any], as_mapping_key: str | None) -> None:
    # The engine walks the patch from the end; appends therefore land in reverse order.
    for node in map(_hoist_key_tag, reversed(data)):
        if isinstance(node, Directive) and node.tag.startswith("CombineIndex:"):
            i = _clamp_index(existing, node.tag[len("CombineIndex:") :])
            if i < len(existing):
                _combine(existing[i], node.value, None)
            continue
        if tag_of(node, "Remove"):
            match = next((item for item in existing if _same(item, node.value)), None)
            if match is not None:
                existing.remove(match)
            continue
        if isinstance(node, Directive) and node.tag.startswith("Index:"):
            existing.insert(_clamp_index(existing, node.tag[len("Index:") :]), strip(node.value))
            continue

        if as_mapping_key is not None and isinstance(node, dict) and node:
            removal = _removal_key(node, as_mapping_key)
            key_value = removal if removal is not None else strip(node.get(as_mapping_key))
            match = next(
                (
                    item
                    for item in existing
                    if isinstance(item, dict) and item.get(as_mapping_key) == key_value
                ),
                None,
            )
            if removal is not None:
                # `- !Remove type: Foo`: drop the whole component.
                if match is not None:
                    existing.remove(match)
                continue
            if match is not None:
                if combine_mapping(match, node) and not match:
                    existing.remove(match)
                continue

        existing.append(strip(node))


def _hoist_key_tag(node: Any) -> Any:
    """``- !Index:0 id: X`` tags the mapping's first key; treat it as tagging the whole item
    (the engine's ``StartsWithTagOrMappingKeyTag``)."""
    if isinstance(node, dict) and node:
        first = next(iter(node))
        if isinstance(first, Directive) and first.tag.startswith(INDEX_PREFIXES):
            return Directive(first.tag, {strip(k): v for k, v in node.items()})
    return node


def _removal_key(node: dict[Any, Any], key: str) -> Any:
    """The removed value for a ``{!Remove key: value}`` mapping, else None."""
    for raw_key, value in node.items():
        if isinstance(raw_key, Directive) and raw_key.tag == "Remove" and raw_key.value == key:
            return strip(value)
    return None


def _same(a: Any, b: Any) -> bool:
    """Node equality the way the engine sees it: YAML text, so ``1`` equals ``"1"``."""
    return bool(_text(strip(a)) == _text(strip(b)))


def _text(value: Any) -> Any:
    if isinstance(value, dict):
        return {_text(k): _text(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_text(v) for v in value]
    if isinstance(value, bool):
        return "true" if value else "false"
    return "" if value is None else str(value)


def _clamp_index(existing: list[Any], text: str) -> int:
    index = int(text)
    if index < 0:
        index = len(existing) + index
    return max(0, min(index, len(existing)))


def _is_empty(node: Any) -> bool:
    if isinstance(node, Directive):
        return _is_empty(node.value)
    return node is None or node == "" or (isinstance(node, dict | list) and len(node) == 0)


def apply_partial(original: dict[str, Any], patch: dict[str, Any], *, entity: bool) -> None:
    """Combine a partial prototype's fields (not its ``type``/``id``) into the original."""
    body = {k: v for k, v in patch.items() if strip(k) not in ("type", "id")}
    combine_mapping(original, copy.deepcopy(body), components=entity)
