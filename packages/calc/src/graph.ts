import type {
  CookingRecipe,
  EntitiesFile,
  Entity,
  Mixer,
  Reaction,
  Reagent,
  ReagentsFile,
  RecipesFile,
  SourcesFile,
} from "@ss14help/schema";

/** The parts of a data snapshot the calculator reads. Only `recipes` is required. */
export interface CalcData {
  recipes: RecipesFile;
  reagents?: ReagentsFile;
  entities?: EntitiesFile;
  sources?: SourcesFile;
}

export type NodeKind = "reagent" | "item";

/** A reagent (amounts in u) or an item/entity (amounts are counts). */
export interface NodeRef {
  kind: NodeKind;
  id: string;
}

export type Producer =
  { kind: "reaction"; recipe: Reaction } | { kind: "cooking"; recipe: CookingRecipe };

export interface SourceHint {
  /** Entity to process. */
  entity: string;
  entityName: string;
  method: "grind" | "juice";
  /** Reagent amount one entity yields. */
  amount: number;
}

export interface Consumers {
  /** Reactions that consume this reagent. */
  ingredientIn: Reaction[];
  /** Reactions that need it present without consuming it. */
  catalystFor: Reaction[];
  /** Cooking recipes that use it as a reagent or a solid. */
  cooking: CookingRecipe[];
}

export const nodeKey = (ref: NodeRef): string => `${ref.kind}:${ref.id}`;

/**
 * Indexes over one server's data: who produces and consumes what, display names and sources.
 * Build it once per server (it's immutable) and share it between plans.
 */
export class RecipeGraph {
  readonly reagents = new Map<string, Reagent>();
  readonly entities = new Map<string, Entity>();
  readonly mixers = new Map<string, Mixer>();
  readonly reactions = new Map<string, Reaction>();
  readonly cookingRecipes = new Map<string, CookingRecipe>();

  private readonly reactionsProducing = new Map<string, Reaction[]>();
  private readonly cookingProducing = new Map<string, CookingRecipe[]>();
  private readonly consumers = new Map<string, Consumers>();
  private readonly sourceHints = new Map<string, SourceHint[]>();
  private readonly stepCounts = new Map<string, number>();

  constructor(data: CalcData) {
    for (const r of data.reagents?.reagents ?? []) this.reagents.set(r.id, r);
    for (const e of data.entities?.entities ?? []) this.entities.set(e.id, e);
    for (const m of data.recipes.mixers) this.mixers.set(m.id, m);

    for (const reaction of sortById(data.recipes.reactions)) {
      this.reactions.set(reaction.id, reaction);
      for (const product of Object.keys(reaction.products)) {
        // A reaction that also consumes its product isn't a way to make it.
        if (product in reaction.reactants) continue;
        push(this.reactionsProducing, product, reaction);
      }
      for (const [id, reactant] of Object.entries(reaction.reactants)) {
        const c = this.consumersEntry(nodeKey({ kind: "reagent", id }));
        (reactant.catalyst ? c.catalystFor : c.ingredientIn).push(reaction);
      }
    }

    for (const recipe of sortById(data.recipes.cooking)) {
      this.cookingRecipes.set(recipe.id, recipe);
      push(this.cookingProducing, recipe.result, recipe);
      for (const id of Object.keys(recipe.solids)) {
        this.consumersEntry(nodeKey({ kind: "item", id })).cooking.push(recipe);
      }
      for (const id of Object.keys(recipe.reagents)) {
        this.consumersEntry(nodeKey({ kind: "reagent", id })).cooking.push(recipe);
      }
    }

    for (const source of data.sources?.sources ?? []) {
      const entityName = this.name({ kind: "item", id: source.entity });
      for (const method of ["grind", "juice"] as const) {
        for (const [reagent, amount] of Object.entries(source[method] ?? {})) {
          push(this.sourceHints, reagent, { entity: source.entity, entityName, method, amount });
        }
      }
    }
    for (const hints of this.sourceHints.values()) {
      hints.sort((a, b) => b.amount - a.amount || a.entity.localeCompare(b.entity));
    }
  }

  name(ref: NodeRef): string {
    const found = ref.kind === "reagent" ? this.reagents.get(ref.id) : this.entities.get(ref.id);
    return found?.name ?? ref.id;
  }

  mixerName(id: string): string {
    return this.mixers.get(id)?.name ?? id;
  }

  isDispensable(reagentId: string): boolean {
    return this.reagents.get(reagentId)?.dispensable ?? false;
  }

  /** Every way to make `ref`, in a stable order (by recipe id). */
  producers(ref: NodeRef): Producer[] {
    if (ref.kind === "reagent") {
      return (this.reactionsProducing.get(ref.id) ?? []).map((recipe) => ({
        kind: "reaction",
        recipe,
      }));
    }
    return (this.cookingProducing.get(ref.id) ?? []).map((recipe) => ({ kind: "cooking", recipe }));
  }

  producerById(ref: NodeRef, recipeId: string): Producer | undefined {
    return this.producers(ref).find((p) => p.recipe.id === recipeId);
  }

  /**
   * The producer used unless the user picks another one. Basic ingredients have none:
   * dispensable reagents, and things no recipe is *for* (a reagent only made as a side product of
   * a split/breakdown reaction, like Water from centrifuged blood, is gathered by default; the
   * split stays available as an explicit variant).
   *
   * Ranking among primary-product recipes: fewest steps, then highest priority, then id.
   */
  defaultProducer(ref: NodeRef): Producer | undefined {
    if (ref.kind === "reagent" && this.isDispensable(ref.id)) return undefined;
    const ranked = this.producers(ref)
      .filter((p) => isPrimaryProduct(p, ref.id))
      .map((p) => ({ p, steps: this.recipeSteps(p) }))
      .sort(
        (a, b) =>
          a.steps - b.steps ||
          priority(b.p) - priority(a.p) ||
          a.p.recipe.id.localeCompare(b.p.recipe.id),
      );
    return ranked[0]?.p;
  }

  /** True when `ref` has no default producer, i.e. it is gathered rather than made. */
  isBasic(ref: NodeRef): boolean {
    return this.defaultProducer(ref) === undefined;
  }

  /**
   * How many recipe steps it takes to make `ref` from basic ingredients with default producers.
   * 0 for basics. Used for the default-variant rule and the list's "Simplest first" sort.
   */
  stepCount(ref: NodeRef): number {
    return this.countSteps(ref, new Set()).steps;
  }

  consumersOf(ref: NodeRef): Consumers {
    return this.consumers.get(nodeKey(ref)) ?? { ingredientIn: [], catalystFor: [], cooking: [] };
  }

  /** Entities that yield this reagent when ground or juiced, best yield first. */
  sourcesOf(reagentId: string): SourceHint[] {
    return this.sourceHints.get(reagentId) ?? [];
  }

  private recipeSteps(p: Producer): number {
    return this.countRecipe(p, new Set()).steps;
  }

  // Step counts are memoized only when the computation didn't hit a cycle, because a cut cycle's
  // result depends on where the walk started.
  private countSteps(ref: NodeRef, visiting: Set<string>): { steps: number; cyclic: boolean } {
    const key = nodeKey(ref);
    const cached = this.stepCounts.get(key);
    if (cached !== undefined) return { steps: cached, cyclic: false };
    if (visiting.has(key)) return { steps: Number.POSITIVE_INFINITY, cyclic: true };
    if (ref.kind === "reagent" && this.isDispensable(ref.id)) return { steps: 0, cyclic: false };

    visiting.add(key);
    const options = this.producers(ref)
      .filter((p) => isPrimaryProduct(p, ref.id))
      .map((p) => this.countRecipe(p, visiting))
      .sort((a, b) => a.steps - b.steps);
    visiting.delete(key);

    const best = options[0] ?? { steps: 0, cyclic: false };
    if (!best.cyclic) this.stepCounts.set(key, best.steps);
    return { steps: best.steps, cyclic: best.cyclic };
  }

  private countRecipe(p: Producer, visiting: Set<string>): { steps: number; cyclic: boolean } {
    let steps = 1;
    let cyclic = false;
    for (const input of consumedInputs(p)) {
      const r = this.countSteps(input.ref, visiting);
      steps += r.steps;
      cyclic ||= r.cyclic;
    }
    return { steps, cyclic };
  }

  private consumersEntry(key: string): Consumers {
    let entry = this.consumers.get(key);
    if (!entry) {
      entry = { ingredientIn: [], catalystFor: [], cooking: [] };
      this.consumers.set(key, entry);
    }
    return entry;
  }
}

/** Amount of `id` one batch of the producer yields. */
export function yieldOf(p: Producer, id: string): number {
  return p.kind === "reaction" ? (p.recipe.products[id] ?? 0) : 1;
}

/** Inputs a producer consumes per batch (catalysts excluded), in recipe order. */
export function consumedInputs(p: Producer): { ref: NodeRef; amount: number }[] {
  if (p.kind === "reaction") {
    return Object.entries(p.recipe.reactants)
      .filter(([, r]) => !r.catalyst)
      .map(([id, r]) => ({ ref: { kind: "reagent", id }, amount: r.amount }));
  }
  return [
    ...Object.entries(p.recipe.solids).map(([id, amount]) => ({
      ref: { kind: "item" as const, id },
      amount,
    })),
    ...Object.entries(p.recipe.reagents).map(([id, amount]) => ({
      ref: { kind: "reagent" as const, id },
      amount,
    })),
  ];
}

/** Catalysts a reaction needs present, with their coefficients. */
export function catalystsOf(p: Producer): { id: string; amount: number }[] {
  if (p.kind !== "reaction") return [];
  return Object.entries(p.recipe.reactants)
    .filter(([, r]) => r.catalyst)
    .map(([id, r]) => ({ id, amount: r.amount }));
}

/**
 * Whether `id` is what the recipe is "for": cooking always; reactions when the product id equals
 * the reaction id or it is the only product. Split reactions (e.g. centrifuging blood) aren't the
 * primary way to get any of their products.
 */
export function isPrimaryProduct(p: Producer, id: string): boolean {
  if (p.kind === "cooking") return true;
  const products = Object.keys(p.recipe.products);
  return p.recipe.id === id || (products.length === 1 && products[0] === id);
}

function priority(p: Producer): number {
  return p.kind === "reaction" ? p.recipe.priority : 0;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}
