/**
 * What the detail panel shows (ROADMAP §3.2). Written `kind:id` in URLs and storage.
 * - reagent: reagents.json
 * - item: entities.json (cooked dishes, solids, grind/juice sources)
 * - reaction: effect-only reactions (no products)
 */
export type SubjectKind = "reagent" | "item" | "reaction";

export type Subject =
  { kind: "reagent"; id: string } | { kind: "item"; id: string } | { kind: "reaction"; id: string };

/** Reagents and items are calc-engine nodes; effect-only reactions aren't. */
export function toNode(s: Subject): { kind: "reagent" | "item"; id: string } | null {
  return s.kind === "reaction" ? null : s;
}

const KINDS: readonly SubjectKind[] = ["reagent", "item", "reaction"];

export function subjectKey(s: Subject): string {
  return `${s.kind}:${s.id}`;
}

export function parseSubject(text: string): Subject | null {
  const i = text.indexOf(":");
  if (i <= 0) return null;
  const kind = text.slice(0, i) as SubjectKind;
  const id = text.slice(i + 1);
  return KINDS.includes(kind) && id ? { kind, id } : null;
}

export function parseStack(param: string | null): Subject[] {
  if (!param) return [];
  return param
    .split(",")
    .map(parseSubject)
    .filter((s): s is Subject => s !== null);
}

export function formatStack(stack: Subject[]): string {
  return stack.map(subjectKey).join(",");
}

export function sameSubject(a: Subject | null | undefined, b: Subject | null | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

/** Path of the statically generated page for a subject, if it has one. */
export function subjectPath(server: string, s: Subject): string | null {
  return s.kind === "reaction" ? null : `/${server}/${s.kind}/${encodeURIComponent(s.id)}`;
}
