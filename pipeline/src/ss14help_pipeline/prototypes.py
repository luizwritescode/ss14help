"""Load every prototype YAML file, index prototypes by type and id, and resolve inheritance.

Mirrors RobustToolbox's PrototypeManager closely enough for recipe data:
- Every ``*.yml`` under ``Resources/Prototypes`` is loaded, in sorted path order.
- Custom tags never fail the load: ``!type:Foo`` nodes are kept with ``_type: Foo``; partial
  directives (``!Remove``, ``!Clear``, ``!Index:n``, ``!PartialOnly``, ...) become ``Directive``s.
- A later prototype with the same (type, id) replaces the earlier one, with a warning.
- Files in partial directories (``Resources/PartialPrototypes``) are applied afterwards as patches
  to existing prototypes; see ``partials.py``. Elsewhere, directives are stripped to plain values,
  because the engine ignores them there.
- Inheritance (``SerializationManager.PushComposition``): a field the child sets replaces the
  parent's value entirely; fields it doesn't set come from the parent. With several parents, the
  first one listed wins. ``abstract`` is never inherited. Entity ``components`` are merged by
  component ``type``, field by field.
"""

import copy
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from ss14help_pipeline.partials import (
    Directive,
    apply_partial,
    is_directive_tag,
    partial_index,
    strip,
)
from ss14help_pipeline.warnings import WarningLog

_BaseLoader: type[yaml.SafeLoader] = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


class PrototypeLoader(_BaseLoader):  # type: ignore[valid-type,misc]
    """SafeLoader that accepts any ``!tag``. Uses libyaml when available (much faster)."""


def _construct_tagged(loader: yaml.SafeLoader, suffix: str, node: yaml.Node) -> Any:
    tag = node.tag
    name = tag[len("!type:") :] if tag.startswith("!type:") else tag.lstrip("!")
    if isinstance(node, yaml.MappingNode):
        value: Any = loader.construct_mapping(node, deep=True)
    elif isinstance(node, yaml.SequenceNode):
        value = loader.construct_sequence(node, deep=True)
    else:
        scalar = loader.construct_scalar(node)  # type: ignore[arg-type]
        value = scalar if scalar != "" else None

    if is_directive_tag(name):
        return Directive(name, value)
    if isinstance(value, dict):
        return {"_type": name, **{str(k): v for k, v in value.items()}}
    if isinstance(value, list):
        return {"_type": name, "items": value}
    return {"_type": name, "value": value} if value is not None else {"_type": name}


PrototypeLoader.add_multi_constructor("!", _construct_tagged)


@dataclass
class Prototype:
    type: str
    id: str
    data: dict[str, Any]
    source_file: str
    """Path relative to ``Resources/Prototypes``, with forward slashes."""

    @property
    def abstract(self) -> bool:
        return bool(self.data.get("abstract", False))

    def component(self, name: str) -> dict[str, Any] | None:
        """An entity's component by type, e.g. ``component("Solution")``."""
        for comp in self.data.get("components") or []:
            if isinstance(comp, dict) and comp.get("type") == name:
                return comp
        return None


@dataclass
class PrototypeIndex:
    by_type: dict[str, dict[str, Prototype]] = field(default_factory=dict)

    def of(self, kind: str) -> dict[str, Prototype]:
        return self.by_type.get(kind, {})

    def get(self, kind: str, proto_id: str) -> Prototype | None:
        return self.of(kind).get(proto_id)

    def concrete(self, kind: str) -> Iterator[Prototype]:
        """Non-abstract prototypes of a type, sorted by id."""
        for proto_id in sorted(self.of(kind)):
            proto = self.by_type[kind][proto_id]
            if not proto.abstract:
                yield proto


def load_prototypes(
    prototypes_dir: Path, log: WarningLog, partial_paths: list[str] | None = None
) -> PrototypeIndex:
    """Parse and index every prototype and apply partials; inheritance is not resolved yet.

    ``partial_paths`` (relative to ``prototypes_dir``, in application order) come from
    ``partials.read_partial_paths``.
    """
    partial_paths = partial_paths or []
    index = PrototypeIndex()
    queued: list[tuple[int, int, str, dict[Any, Any]]] = []
    # Ordinal sort on the relative POSIX path: Path ordering is case-insensitive on Windows,
    # and load order decides which duplicate wins.
    paths = {p.relative_to(prototypes_dir).as_posix(): p for p in prototypes_dir.rglob("*.yml")}
    for order, (rel, path) in enumerate(sorted(paths.items())):
        documents = _read(path, rel, log)
        partial = partial_index(rel, partial_paths)
        templated = 0
        for doc in documents:
            if partial is not None:
                queued.append((partial, order, rel, doc))
                continue
            proto_id = doc["id"]
            if not isinstance(proto_id, str | int):
                # e.g. `id: !type:CreateVariants` templates (atmos pipes); not recipe data.
                templated += 1
                continue
            kind, data = str(strip(doc["type"])), strip(doc)
            of_kind = index.by_type.setdefault(kind, {})
            if str(proto_id) in of_kind:
                log.add(
                    "duplicate-id",
                    f"{kind} {proto_id} also defined in {of_kind[str(proto_id)].source_file}; "
                    "the later one wins",
                    rel,
                )
            of_kind[str(proto_id)] = Prototype(kind, str(proto_id), data, rel)
        if templated:
            log.add("templated-id", f"{templated} prototypes with generated ids skipped", rel)

    for _, _, rel, doc in sorted(queued, key=lambda q: (q[0], q[1])):
        _apply_partial_doc(index, rel, doc)
    return index


def _read(path: Path, rel: str, log: WarningLog) -> list[dict[Any, Any]]:
    """The prototype mappings in one file (each with ``type`` and ``id``)."""
    try:
        documents = yaml.load(path.read_text(encoding="utf-8-sig"), Loader=PrototypeLoader)
    except yaml.YAMLError as e:
        log.add("yaml-error", f"could not parse: {str(e).splitlines()[0]}", rel)
        return []
    if documents is None:
        return []
    if not isinstance(documents, list):
        log.add("yaml-not-a-list", "file is not a list of prototypes", rel)
        return []
    return [d for d in documents if isinstance(d, dict) and "type" in d and "id" in d]


def _apply_partial_doc(index: PrototypeIndex, rel: str, doc: dict[Any, Any]) -> None:
    type_node = doc["type"]
    partial_only = isinstance(type_node, Directive) and type_node.tag == "PartialOnly"
    kind = str(strip(type_node))
    proto_id = doc["id"]
    if isinstance(proto_id, dict) and proto_id.get("_type") == "CreateVariants":
        # `values` may sit inside the tagged id node or next to it.
        values = proto_id.get("values") or doc.get("values") or []
        ids = [str(v) for v in values]
        doc = {k: v for k, v in doc.items() if k != "values"}
    else:
        ids = [str(strip(proto_id))]

    of_kind = index.by_type.setdefault(kind, {})
    for pid in ids:
        original = of_kind.get(pid)
        if original is not None:
            apply_partial(original.data, doc, entity=kind == "entity")
        elif not partial_only:
            data = strip({k: v for k, v in doc.items() if strip(k) != "id"})
            of_kind[pid] = Prototype(kind, pid, {**data, "type": kind, "id": pid}, rel)


def resolve_inheritance(index: PrototypeIndex, log: WarningLog) -> PrototypeIndex:
    """Return a new index where every prototype's data includes what it inherits."""
    resolved = PrototypeIndex()
    for kind, protos in index.by_type.items():
        done: dict[str, dict[str, Any]] = {}
        resolved.by_type[kind] = {
            pid: Prototype(kind, pid, _resolve(p, protos, done, (), log), p.source_file)
            for pid, p in protos.items()
        }
    return resolved


def _resolve(
    proto: Prototype,
    protos: dict[str, Prototype],
    done: dict[str, dict[str, Any]],
    stack: tuple[str, ...],
    log: WarningLog,
) -> dict[str, Any]:
    """``proto``'s data with its parents pushed in (memoized in ``done``)."""
    if proto.id in done:
        return done[proto.id]
    if proto.id in stack:
        log.add(
            "inheritance-cycle", f"{proto.type} {proto.id} inherits from itself", proto.source_file
        )
        return proto.data
    data = proto.data
    for parent_id in _parents(proto.data):
        parent = protos.get(parent_id)
        if parent is None:
            log.add(
                "unknown-parent",
                f"{proto.type} {proto.id}: parent {parent_id} not found",
                proto.source_file,
            )
            continue
        inherited = _resolve(parent, protos, done, (*stack, proto.id), log)
        data = _merge(data, inherited, entity=proto.type == "entity")
    done[proto.id] = data
    return data


def _parents(data: dict[str, Any]) -> list[str]:
    parent = data.get("parent")
    if parent is None:
        return []
    if isinstance(parent, list):
        return [str(p) for p in parent]
    return [str(parent)]


_NEVER_INHERITED = {"abstract", "parent", "id"}


def _merge(child: dict[str, Any], parent: dict[str, Any], *, entity: bool) -> dict[str, Any]:
    result = dict(child)
    for key, value in parent.items():
        if key in _NEVER_INHERITED:
            continue
        if key not in result:
            result[key] = copy.deepcopy(value)
        elif entity and key == "components":
            result[key] = _merge_components(result[key] or [], value or [])
    return result


def _merge_components(child: list[Any], parent: list[Any]) -> list[Any]:
    """Merge component lists by ``type`` (``ComponentRegistrySerializer.PushInheritance``)."""
    by_type = {
        c["type"]: i
        for i, c in enumerate(child)
        if isinstance(c, dict) and isinstance(c.get("type"), str)
    }
    merged = list(child)
    for comp in parent:
        if not isinstance(comp, dict):
            continue
        i = by_type.get(comp.get("type"))
        if i is None:
            merged.append(copy.deepcopy(comp))
        else:
            merged[i] = {**copy.deepcopy(comp), **merged[i]}
    return merged
