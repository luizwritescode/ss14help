/**
 * The workspace's URL state (ROADMAP §3.3). Pure parse/serialize functions; the hook that wires
 * them to the router lives in components/workspace/use-workspace.ts.
 */
import { formatStack, parseStack, type Subject } from "./subjects";

export const TABS = ["recipe", "tree", "calc", "used", "sources"] as const;
export type Tab = (typeof TABS)[number];

export const MAX_STACK = 12;

export interface WorkspaceParams {
  /** Panel stack, bottom → top. Empty = panel closed. */
  open: Subject[];
  /** Selected variant (recipe id) for the top subject. */
  via: string | null;
  /** Variant choices for intermediates: reagent/item id → recipe id (`v.<id>`). */
  variants: Record<string, string>;
  tab: Tab;
  /** Calculator target amount. */
  amt: number | null;
  /** Ids treated as owned by the calculator. */
  owned: string[];
  /** Sidebar node / list contents, e.g. `chemistry/medicine`. */
  cat: string;
  /** List filter text. */
  q: string;
  /** Active list filter chips, e.g. `heat`, `mixer:Centrifuge`. */
  filters: string[];
}

export const DEFAULT_CATEGORY = "chemistry";

export function parseParams(sp: URLSearchParams): WorkspaceParams {
  const tab = sp.get("tab");
  const amt = Number(sp.get("amt"));
  const variants: Record<string, string> = {};
  for (const [key, value] of sp) {
    if (key.startsWith("v.") && value) variants[key.slice(2)] = value;
  }
  return {
    open: parseStack(sp.get("open")).slice(-MAX_STACK),
    via: sp.get("via") || null,
    variants,
    tab: TABS.includes(tab as Tab) ? (tab as Tab) : "recipe",
    amt: sp.has("amt") && Number.isFinite(amt) && amt > 0 ? amt : null,
    owned: list(sp.get("own")),
    cat: sp.get("cat") || DEFAULT_CATEGORY,
    q: sp.get("q") ?? "",
    filters: list(sp.get("f")),
  };
}

export function serializeParams(p: WorkspaceParams): string {
  const sp = new URLSearchParams();
  if (p.open.length) sp.set("open", formatStack(p.open));
  if (p.open.length && p.via) sp.set("via", p.via);
  if (p.open.length && p.tab !== "recipe") sp.set("tab", p.tab);
  if (p.open.length && p.amt !== null) sp.set("amt", String(p.amt));
  if (p.open.length && p.owned.length) sp.set("own", p.owned.join(","));
  for (const [id, recipe] of Object.entries(p.variants).sort()) sp.set(`v.${id}`, recipe);
  if (p.cat !== DEFAULT_CATEGORY) sp.set("cat", p.cat);
  if (p.q) sp.set("q", p.q);
  if (p.filters.length) sp.set("f", p.filters.join(","));
  // Keep `:` and `,` readable in the address bar.
  return sp.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
}

function list(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}
