"""Load every prototype YAML file, index prototypes by type and id, and resolve inheritance.

Mirrors RobustToolbox's PrototypeManager closely enough for recipe data:
- Every ``*.yml`` under ``Resources/Prototypes`` is loaded, in sorted path order.
- Custom tags (``!type:Foo``, ``!PartialOnly``, ...) never fail the load; they're kept as ``_type``.
- A later prototype with the same (type, id) replaces the earlier one, with a warning.
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

from ss14help_pipeline.warnings import WarningLog

_BaseLoader: type[yaml.SafeLoader] = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


class PrototypeLoader(_BaseLoader):  # type: ignore[valid-type,misc]
    """SafeLoader that accepts any ``!tag``. Uses libyaml when available (much faster)."""


def _construct_tagged(loader: yaml.SafeLoader, suffix: str, node: yaml.Node) -> dict[str, Any]:
    tag = node.tag
    name = tag[len("!type:") :] if tag.startswith("!type:") else tag.lstrip("!")
    if isinstance(node, yaml.MappingNode):
        mapping = loader.construct_mapping(node, deep=True)
        return {"_type": name, **{str(k): v for k, v in mapping.items()}}
    if isinstance(node, yaml.SequenceNode):
        return {"_type": name, "items": loader.construct_sequence(node, deep=True)}
    value = loader.construct_scalar(node)  # type: ignore[arg-type]
    return {"_type": name, "value": value} if value != "" else {"_type": name}


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


def load_prototypes(prototypes_dir: Path, log: WarningLog) -> PrototypeIndex:
    """Parse and index every prototype; inheritance is not resolved yet."""
    index = PrototypeIndex()
    # Ordinal sort on the relative POSIX path: Path ordering is case-insensitive on Windows,
    # and load order decides which duplicate wins.
    paths = {p.relative_to(prototypes_dir).as_posix(): p for p in prototypes_dir.rglob("*.yml")}
    for rel, path in sorted(paths.items()):
        try:
            documents = yaml.load(path.read_text(encoding="utf-8-sig"), Loader=PrototypeLoader)
        except yaml.YAMLError as e:
            log.add("yaml-error", f"could not parse: {str(e).splitlines()[0]}", rel)
            continue
        if documents is None:
            continue
        if not isinstance(documents, list):
            log.add("yaml-not-a-list", "file is not a list of prototypes", rel)
            continue
        templated = 0
        for doc in documents:
            if not isinstance(doc, dict) or "type" not in doc or "id" not in doc:
                continue
            if not isinstance(doc["id"], str | int):
                # e.g. `id: !type:CreateVariants` templates (atmos pipes); not recipe data.
                templated += 1
                continue
            kind, proto_id = str(doc["type"]), str(doc["id"])
            of_kind = index.by_type.setdefault(kind, {})
            if proto_id in of_kind:
                log.add(
                    "duplicate-id",
                    f"{kind} {proto_id} also defined in {of_kind[proto_id].source_file}; "
                    "the later one wins",
                    rel,
                )
            of_kind[proto_id] = Prototype(kind, proto_id, doc, rel)
        if templated:
            log.add("templated-id", f"{templated} prototypes with generated ids skipped", rel)
    return index


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
    by_type = {c.get("type"): i for i, c in enumerate(child) if isinstance(c, dict)}
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
