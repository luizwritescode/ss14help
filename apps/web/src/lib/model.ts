/**
 * Everything the workspace derives from one server's snapshot: lookups, the recipe graph
 * (@ss14help/calc), the category tree, list items and search. Built once per server.
 */
import { RecipeGraph, type Producer } from "@ss14help/calc";
import type {
  CookingRecipe,
  EntitiesFile,
  Entity,
  Manifest,
  Mixer,
  Reaction,
  Reagent,
  ReagentsFile,
  RecipesFile,
  Source,
  SourcesFile,
} from "@ss14help/schema";
import MiniSearch from "minisearch";
import { categoryLabel } from "./categories";
import type { Subject } from "./subjects";

/** Game names are mostly lower case ("bicaridine"); capitalize the first letter for display. */
export function displayName(name: string): string {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

/** Effect-only reactions have no product name; "AluminiumMetalFoam" → "Aluminium metal foam". */
export function humanizeId(id: string): string {
  const words = id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return displayName(words);
}

export interface SearchDoc {
  kind: "reagent" | "item" | "reaction";
  id: string;
  name: string;
  category: string;
}

export interface SnapshotFiles {
  manifest: Manifest;
  reagents: ReagentsFile;
  entities: EntitiesFile;
  recipes: RecipesFile;
  sources: SourcesFile;
  searchIndex: SearchDoc[];
}

export const SNAPSHOT_FILES = {
  manifest: "manifest.json",
  reagents: "reagents.json",
  entities: "entities.json",
  recipes: "recipes.json",
  sources: "sources.json",
  searchIndex: "search-index.json",
} as const satisfies Record<keyof SnapshotFiles, string>;

export type ListItem =
  | { kind: "reaction"; key: string; name: string; subject: Subject; reaction: Reaction }
  | { kind: "cooking"; key: string; name: string; subject: Subject; recipe: CookingRecipe }
  | { kind: "reagent"; key: string; name: string; subject: Subject; reagent: Reagent }
  | { kind: "source"; key: string; name: string; subject: Subject; source: Source };

export interface CategoryNode {
  path: string;
  label: string;
  items: ListItem[];
  children: CategoryNode[];
}

export interface SearchHit extends SearchDoc {
  score: number;
}

export class ServerModel {
  readonly manifest: Manifest;
  readonly graph: RecipeGraph;
  readonly reagents = new Map<string, Reagent>();
  readonly entities = new Map<string, Entity>();
  readonly reactions = new Map<string, Reaction>();
  readonly cooking = new Map<string, CookingRecipe>();
  readonly mixers = new Map<string, Mixer>();
  readonly sources = new Map<string, Source>();
  readonly categories: CategoryNode[];
  private readonly nodes = new Map<string, CategoryNode>();
  readonly searchIndex: MiniSearch<SearchDoc & { key: string }>;

  constructor(files: SnapshotFiles) {
    this.manifest = files.manifest;
    for (const r of files.reagents.reagents) this.reagents.set(r.id, r);
    for (const e of files.entities.entities) this.entities.set(e.id, e);
    for (const r of files.recipes.reactions) this.reactions.set(r.id, r);
    for (const c of files.recipes.cooking) this.cooking.set(c.id, c);
    for (const m of files.recipes.mixers) this.mixers.set(m.id, m);
    for (const s of files.sources.sources) this.sources.set(s.entity, s);
    this.graph = new RecipeGraph({
      recipes: files.recipes,
      reagents: files.reagents,
      entities: files.entities,
      sources: files.sources,
    });
    this.categories = this.buildCategories();
    const index = (node: CategoryNode) => {
      this.nodes.set(node.path, node);
      node.children.forEach(index);
    };
    this.categories.forEach(index);

    this.searchIndex = new MiniSearch({
      idField: "key",
      fields: ["name", "id"],
      storeFields: ["kind", "id", "name", "category"],
      searchOptions: { boost: { name: 3, id: 2 }, prefix: true, fuzzy: 0.2 },
    });
    this.searchIndex.addAll(
      files.searchIndex.map((d) => ({
        ...d,
        name: d.kind === "reaction" ? humanizeId(d.id) : displayName(d.name),
        key: `${d.kind}:${d.id}`,
      })),
    );
  }

  // --- lookups -----------------------------------------------------------------------------

  exists(s: Subject): boolean {
    if (s.kind === "reagent") return this.reagents.has(s.id);
    if (s.kind === "item") return this.entities.has(s.id);
    return this.reactions.has(s.id);
  }

  name(s: Subject): string {
    if (s.kind === "reagent") return displayName(this.reagents.get(s.id)?.name ?? s.id);
    if (s.kind === "item") return displayName(this.entities.get(s.id)?.name ?? s.id);
    return humanizeId(s.id);
  }

  color(s: Subject): string | null {
    return s.kind === "reagent" ? (this.reagents.get(s.id)?.color ?? null) : null;
  }

  serverOnly(s: Subject): boolean {
    if (s.kind === "reagent") return this.reagents.get(s.id)?.serverOnly ?? false;
    if (s.kind === "item") return this.entities.get(s.id)?.serverOnly ?? false;
    return this.reactions.get(s.id)?.serverOnly ?? false;
  }

  mixerName(id: string): string {
    return this.mixers.get(id)?.name ?? id;
  }

  /** Recipes that make the subject (reactions for reagents, cooking for items). */
  producers(s: Subject): Producer[] {
    return s.kind === "reaction" ? [] : this.graph.producers(s);
  }

  /** The product a reaction row opens: same id as the reaction, else the largest amount. */
  primaryProduct(r: Reaction): string | null {
    const products = Object.entries(r.products);
    if (products.length === 0) return null;
    if (r.id in r.products) return r.id;
    products.sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    return products[0]![0];
  }

  /** Where a reaction row leads, and which variant to preselect. */
  reactionTarget(r: Reaction): { subject: Subject; via: string | null } {
    const product = this.primaryProduct(r);
    return product
      ? { subject: { kind: "reagent", id: product }, via: r.id }
      : { subject: { kind: "reaction", id: r.id }, via: null };
  }

  // --- categories & lists ------------------------------------------------------------------

  node(path: string): CategoryNode | undefined {
    return this.nodes.get(path);
  }

  private buildCategories(): CategoryNode[] {
    const reactionItems = [...this.reactions.values()].map((r): ListItem => {
      const { subject } = this.reactionTarget(r);
      return {
        kind: "reaction",
        key: `reaction:${r.id}`,
        name: this.name(subject),
        subject,
        reaction: r,
      };
    });
    const cookingItems = [...this.cooking.values()].map((c): ListItem => ({
      kind: "cooking",
      key: `cooking:${c.id}`,
      name: this.name({ kind: "item", id: c.result }),
      subject: { kind: "item", id: c.result },
      recipe: c,
    }));
    const reagentItems = [...this.reagents.values()].map((r): ListItem => ({
      kind: "reagent",
      key: `reagent:${r.id}`,
      name: displayName(r.name),
      subject: { kind: "reagent", id: r.id },
      reagent: r,
    }));
    const sourceItems = [...this.sources.values()].map((s): ListItem => ({
      kind: "source",
      key: `source:${s.entity}`,
      name: this.name({ kind: "item", id: s.entity }),
      subject: { kind: "item", id: s.entity },
      source: s,
    }));

    const chemistry = group("chemistry", "Chemistry", reactionItems, (i) =>
      i.kind === "reaction" ? [i.reaction.category] : [],
    );
    chemistry.children.sort(
      (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
    );

    const cooking = group("cooking", "Cooking", cookingItems, (i) =>
      i.kind === "cooking" ? [i.recipe.device] : [],
    );
    for (const device of cooking.children) {
      const nested = group(device.path, device.label, device.items, (i) =>
        i.kind === "cooking" ? [i.recipe.group ?? "Other"] : [],
      );
      device.children = nested.children;
    }

    const reagents = group("reagents", "Reagents", reagentItems, (i) =>
      i.kind === "reagent" ? [i.reagent.group ?? "Other"] : [],
    );
    const sources = group("sources", "Sources", sourceItems, (i) =>
      i.kind === "source"
        ? [...(i.source.grind ? ["grind"] : []), ...(i.source.juice ? ["juice"] : [])]
        : [],
    );
    return [chemistry, cooking, reagents, sources];
  }
}

function group(
  path: string,
  label: string,
  items: ListItem[],
  keys: (item: ListItem) => string[],
): CategoryNode {
  const byKey = new Map<string, ListItem[]>();
  for (const item of items) {
    for (const key of keys(item)) {
      const list = byKey.get(key) ?? [];
      list.push(item);
      byKey.set(key, list);
    }
  }
  const children = [...byKey.entries()]
    .map(([key, list]) => ({
      path: `${path}/${slug(key)}`,
      label: categoryLabel(key),
      items: sortItems(list),
      children: [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { path, label, items: sortItems(items), children };
}

export function slug(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

// --- filters & search ----------------------------------------------------------------------

export type FilterId = "heat" | "cold" | "catalyst" | "serverOnly" | `mixer:${string}`;

export function matchesFilter(model: ServerModel, item: ListItem, filter: string): boolean {
  if (filter === "serverOnly") {
    if (item.kind === "reaction") return item.reaction.serverOnly;
    if (item.kind === "cooking") return item.recipe.serverOnly;
    return model.serverOnly(item.subject);
  }
  if (item.kind !== "reaction") return false;
  const r = item.reaction;
  if (filter === "heat") return r.minTemp !== null;
  if (filter === "cold") return r.maxTemp !== null;
  if (filter === "catalyst") return Object.values(r.reactants).some((x) => x.catalyst);
  if (filter === "mixer") return r.mixers.length > 0;
  if (filter.startsWith("mixer:")) return r.mixers.includes(filter.slice(6));
  return true;
}

export function filterItems(
  model: ServerModel,
  items: ListItem[],
  query: string,
  filters: string[],
): ListItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (item) =>
      (!q || item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q)) &&
      filters.every((f) => matchesFilter(model, item, f)),
  );
}

export function search(model: ServerModel, query: string, limit = 50): SearchHit[] {
  if (!query.trim()) return [];
  return model.searchIndex
    .search(query)
    .slice(0, limit)
    .map((r) => ({
      kind: r.kind as SearchDoc["kind"],
      id: r.id as string,
      name: r.name as string,
      category: r.category as string,
      score: r.score,
    }));
}

/** `30u bica`, `30 bicaridine` → amount and the rest of the query (v1's calculator shortcut). */
export function parseCalcQuery(query: string): { amount: number; rest: string } | null {
  const m = /^(\d+(?:\.\d+)?)\s*u?\s+(.+)$/i.exec(query.trim());
  if (!m) return null;
  const amount = Number(m[1]);
  return amount > 0 ? { amount, rest: m[2]!.trim() } : null;
}
