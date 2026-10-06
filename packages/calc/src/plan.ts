import { formatAmount } from "./format";
import {
  catalystsOf,
  consumedInputs,
  nodeKey,
  type NodeKind,
  type NodeRef,
  type Producer,
  type RecipeGraph,
  type SourceHint,
  yieldOf,
} from "./graph";
import { Q } from "./rational";

export interface PlanOptions {
  /** Producer to use per reagent/item id (→ reaction or cooking recipe id), overriding the default. */
  variants?: Readonly<Record<string, string>>;
  /** Ids the user already has: used as-is, never expanded. Ignored for the target itself. */
  owned?: Iterable<string>;
}

/**
 * Why a node isn't expanded further.
 * - `dispensable`: comes from a reagent dispenser.
 * - `basic`: nothing in the data produces it.
 * - `owned`: the user marked it as already available.
 * - `cycle`: expanding it would loop back to something already being made.
 */
export type LeafReason = "dispensable" | "basic" | "owned" | "cycle";

export interface Amount {
  kind: NodeKind;
  id: string;
  name: string;
  /** u for reagents, a count for items. */
  amount: number;
}

export interface BasicIngredient extends Amount {
  reason: LeafReason;
  /** For reagents: entities that yield it when ground or juiced. */
  sources: SourceHint[];
}

export interface CatalystNeed {
  id: string;
  name: string;
  /** Keep at least this much present. Catalysts are never consumed, so this doesn't scale. */
  amount: number;
  /** True when a quantized reaction needs it: then `amount` is a hard minimum, not a guideline. */
  strict: boolean;
  usedBy: string[];
}

export interface Leftover extends Amount {
  /** Recipe ids that produced the surplus. */
  from: string[];
}

/** A byproduct of one step that covers (part of) a later need, so less has to be made. */
export interface Credit {
  id: string;
  name: string;
  amount: number;
  fromRecipe: string;
}

export interface Step {
  producer: { kind: "reaction" | "cooking"; id: string };
  /** Times the recipe runs: fractional for normal reactions, whole for quantized and cooking. */
  batches: number;
  /** Totals for all batches. */
  inputs: Amount[];
  catalysts: { id: string; name: string; amount: number }[];
  outputs: Amount[];
  minTemp: number | null;
  maxTemp: number | null;
  mixers: { id: string; name: string }[];
  device: string | null;
  time: number | null;
  quantized: boolean;
  /** Human-readable instruction, e.g. "Mix 5u Oxygen + 5u Carbon + 5u Sugar → 15u Inaprovaline". */
  text: string;
}

export interface PlanNode {
  kind: NodeKind;
  id: string;
  name: string;
  /** What this path needs (not aggregated, not credited). */
  amount: number;
  catalyst: boolean;
  producer: { kind: "reaction" | "cooking"; id: string } | null;
  batches: number | null;
  /** Ids of all recipes that could make this node, for variant pickers. */
  alternatives: string[];
  leaf: LeafReason | "catalyst" | null;
  children: PlanNode[];
}

export interface Plan {
  target: NodeRef;
  name: string;
  requested: number;
  /** What the steps actually make; more than requested when batches round up. */
  produced: number;
  overshoot: number;
  /** Aggregated shopping list: what to gather, after crediting byproducts. */
  basics: BasicIngredient[];
  catalysts: CatalystNeed[];
  /** Surplus products nothing in the plan uses. */
  leftovers: Leftover[];
  credits: Credit[];
  /** In an order that works: every step's inputs exist before it runs. */
  steps: Step[];
  /** Per-path ingredient tree for display. Use `basics` and `steps` for totals. */
  tree: PlanNode;
  warnings: string[];
}

const MAX_TREE_DEPTH = 48;

/**
 * Plans how to make `amount` of `target` (u for reagents, a count for items).
 *
 * Amounts follow the game: a reaction runs `need / yield` times (rounded up for quantized
 * reactions and cooking), consumes `times × amount` of each non-catalyst reactant and makes
 * `times × amount` of every product. Catalysts only need to be present.
 */
export function plan(
  graph: RecipeGraph,
  target: NodeRef,
  amount: number,
  options: PlanOptions = {},
): Plan {
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new RangeError(`amount must be a positive number, got ${amount}`);
  }
  return new Planner(graph, target, options).run(Q.fromAmount(amount));
}

type Choice = Producer | LeafReason;

interface Lot {
  from: string;
  amount: Q;
}

class Planner {
  private readonly targetKey: string;
  private readonly owned: Set<string>;
  private readonly warnings = new Set<string>();

  // Resolution: which producer each reachable node uses, in dependency order.
  private readonly refs = new Map<string, NodeRef>();
  private readonly choices = new Map<string, Choice>();
  private readonly cut = new Set<string>();
  private readonly consumersOf = new Map<string, string[]>();
  private readonly postorder: string[] = [];
  /** `before.get(a)` holds nodes whose step must run after `a`'s. */
  private readonly before = new Map<string, Set<string>>();

  // Demand propagation results.
  private readonly batches = new Map<string, Q>();
  private readonly basics = new Map<string, { ref: NodeRef; amount: Q; reason: LeafReason }>();
  private readonly catalysts = new Map<
    string,
    { amount: Q; strict: boolean; usedBy: Set<string> }
  >();
  private readonly pool = new Map<string, Lot[]>();
  private readonly credits: Credit[] = [];

  constructor(
    private readonly graph: RecipeGraph,
    private readonly target: NodeRef,
    private readonly options: PlanOptions,
  ) {
    this.targetKey = nodeKey(target);
    this.owned = new Set(options.owned ?? []);
  }

  run(requested: Q): Plan {
    this.resolve(this.target);
    const produced = this.propagate(requested);
    const overshoot = produced.sub(requested);

    return {
      target: this.target,
      name: this.graph.name(this.target),
      requested: requested.toNumber(),
      produced: produced.toNumber(),
      overshoot: overshoot.toNumber(),
      basics: this.basicList(),
      catalysts: this.catalystList(),
      leftovers: this.leftoverList(),
      credits: this.credits,
      steps: this.stepList(),
      tree: this.buildTree(this.target, requested, new Set(), 0),
      warnings: [...this.warnings],
    };
  }

  // --- resolution ------------------------------------------------------------------------

  private choose(ref: NodeRef): Choice {
    const isTarget = nodeKey(ref) === this.targetKey;
    if (!isTarget && this.owned.has(ref.id)) return "owned";
    const override = this.options.variants?.[ref.id];
    if (override !== undefined) {
      const p = this.graph.producerById(ref, override);
      if (p) return p;
      this.warnings.add(`"${override}" doesn't make ${ref.id}; using the default recipe.`);
    }
    const p = this.graph.defaultProducer(ref);
    if (p) return p;
    return ref.kind === "reagent" && this.graph.isDispensable(ref.id) ? "dispensable" : "basic";
  }

  /** DFS from the target. Edges that would close a cycle are cut, so what remains is a DAG. */
  private resolve(ref: NodeRef, visiting = new Set<string>()): void {
    const key = nodeKey(ref);
    visiting.add(key);
    this.refs.set(key, ref);
    const choice = this.choose(ref);
    this.choices.set(key, choice);

    if (typeof choice !== "string") {
      for (const input of consumedInputs(choice)) {
        const dep = nodeKey(input.ref);
        if (visiting.has(dep)) {
          this.cut.add(edge(key, dep));
          this.warnings.add(`${input.ref.id} is part of a cycle; it is listed as an ingredient.`);
          continue;
        }
        if (!this.choices.has(dep)) this.resolve(input.ref, visiting);
        pushUnique(this.consumersOf, dep, key);
        if (typeof this.choices.get(dep) !== "string") addTo(this.before, dep, key);
      }
    }
    visiting.delete(key);
    this.postorder.push(key);
  }

  // --- demand propagation ----------------------------------------------------------------

  /** Walks consumers before producers, so each node's total demand is known when it's reached. */
  private propagate(requested: Q): Q {
    const demand = new Map<string, Q>([[this.targetKey, requested]]);
    let produced = Q.ZERO;

    for (const key of [...this.postorder].reverse()) {
      let need = demand.get(key) ?? Q.ZERO;
      if (key !== this.targetKey) need = this.takeCredits(key, need);
      if (!need.isPositive()) continue;

      const ref = this.refs.get(key) as NodeRef;
      const choice = this.choices.get(key) as Choice;
      if (typeof choice === "string") {
        this.addBasic(ref, need, choice);
        continue;
      }

      const per = Q.fromAmount(yieldOf(choice, ref.id));
      let times = need.div(per);
      if (wholeBatches(choice)) times = times.ceil();
      this.batches.set(key, times);

      const made = times.mul(per);
      if (key === this.targetKey) produced = made;
      else this.addLot(ref, key, made.sub(need));

      if (choice.kind === "reaction") {
        for (const [id, amount] of Object.entries(choice.recipe.products)) {
          if (id !== ref.id)
            this.addLot({ kind: "reagent", id }, key, times.mul(Q.fromAmount(amount)));
        }
        for (const c of catalystsOf(choice)) {
          const entry = this.catalysts.get(c.id) ?? {
            amount: Q.ZERO,
            strict: false,
            usedBy: new Set(),
          };
          entry.amount = entry.amount.max(Q.fromAmount(c.amount));
          entry.strict ||= choice.recipe.quantized;
          entry.usedBy.add(choice.recipe.id);
          this.catalysts.set(c.id, entry);
        }
      }

      for (const input of consumedInputs(choice)) {
        const dep = nodeKey(input.ref);
        const amount = times.mul(Q.fromAmount(input.amount));
        if (this.cut.has(edge(key, dep))) this.addBasic(input.ref, amount, "cycle");
        else demand.set(dep, (demand.get(dep) ?? Q.ZERO).add(amount));
      }
    }
    return produced;
  }

  /**
   * Covers `need` from surplus made by earlier-processed steps. A surplus lot can only be used if
   * its step can run before every step that consumes this node; using it adds those orderings.
   */
  private takeCredits(key: string, need: Q): Q {
    const lots = this.pool.get(key);
    if (!lots || !need.isPositive()) return need;
    const consumers = this.consumersOf.get(key) ?? [];
    const ref = this.refs.get(key) as NodeRef;

    for (const lot of lots) {
      if (!need.isPositive()) break;
      if (!lot.amount.isPositive()) continue;
      const ordered = consumers.every((c) => c !== lot.from && !this.reaches(c, lot.from));
      if (!ordered) continue;

      const used = lot.amount.min(need);
      lot.amount = lot.amount.sub(used);
      need = need.sub(used);
      for (const c of consumers) addTo(this.before, lot.from, c);
      this.credits.push({
        id: ref.id,
        name: this.graph.name(ref),
        amount: used.toNumber(),
        fromRecipe: this.recipeId(lot.from),
      });
    }
    return need;
  }

  private reaches(from: string, to: string): boolean {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length > 0) {
      const next = queue.pop() as string;
      for (const n of this.before.get(next) ?? []) {
        if (n === to) return true;
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return false;
  }

  private addLot(ref: NodeRef, from: string, amount: Q): void {
    if (!amount.isPositive()) return;
    const key = nodeKey(ref);
    if (!this.refs.has(key)) this.refs.set(key, ref);
    const lots = this.pool.get(key) ?? [];
    lots.push({ from, amount });
    this.pool.set(key, lots);
  }

  private addBasic(ref: NodeRef, amount: Q, reason: LeafReason): void {
    const key = nodeKey(ref);
    const entry = this.basics.get(key);
    if (entry) entry.amount = entry.amount.add(amount);
    else this.basics.set(key, { ref, amount, reason });
  }

  // --- outputs ---------------------------------------------------------------------------

  private basicList(): BasicIngredient[] {
    return [...this.basics.values()]
      .map(({ ref, amount, reason }) => ({
        ...this.amount(ref, amount),
        reason,
        sources: ref.kind === "reagent" ? this.graph.sourcesOf(ref.id) : [],
      }))
      .sort(byAmountThenId);
  }

  private catalystList(): CatalystNeed[] {
    return [...this.catalysts.entries()]
      .map(([id, c]) => ({
        id,
        name: this.graph.name({ kind: "reagent", id }),
        amount: c.amount.toNumber(),
        strict: c.strict,
        usedBy: [...c.usedBy].sort(),
      }))
      .sort(byAmountThenId);
  }

  private leftoverList(): Leftover[] {
    const out: Leftover[] = [];
    for (const [key, lots] of this.pool) {
      const rest = lots.filter((l) => l.amount.isPositive());
      if (rest.length === 0) continue;
      const total = rest.reduce((sum, l) => sum.add(l.amount), Q.ZERO);
      const from = [...new Set(rest.map((l) => this.recipeId(l.from)))].sort();
      out.push({ ...this.amount(this.refs.get(key) as NodeRef, total), from });
    }
    return out.sort(byAmountThenId);
  }

  /** Topological order over running steps; ties go to the deepest step first (DFS postorder). */
  private stepList(): Step[] {
    const running = this.postorder.filter((k) => this.batches.get(k)?.isPositive());
    const rank = new Map(running.map((k, i) => [k, i]));
    const indegree = new Map(running.map((k) => [k, 0]));
    for (const k of running) {
      for (const n of this.before.get(k) ?? []) {
        if (indegree.has(n)) indegree.set(n, (indegree.get(n) as number) + 1);
      }
    }

    const ordered: string[] = [];
    const ready = running.filter((k) => indegree.get(k) === 0);
    while (ready.length > 0) {
      ready.sort((a, b) => (rank.get(a) as number) - (rank.get(b) as number));
      const k = ready.shift() as string;
      ordered.push(k);
      for (const n of this.before.get(k) ?? []) {
        if (!indegree.has(n)) continue;
        const d = (indegree.get(n) as number) - 1;
        indegree.set(n, d);
        if (d === 0) ready.push(n);
      }
    }
    if (ordered.length !== running.length) {
      // Credits only add edges that keep the graph acyclic, so this is a bug if it ever happens.
      throw new Error("step ordering failed: cyclic step dependencies");
    }
    return ordered.map((k) => this.step(k));
  }

  private step(key: string): Step {
    const ref = this.refs.get(key) as NodeRef;
    const p = this.choices.get(key) as Producer;
    const times = this.batches.get(key) as Q;
    const inputs = consumedInputs(p).map((i) =>
      this.amount(i.ref, times.mul(Q.fromAmount(i.amount))),
    );
    const outputs =
      p.kind === "reaction"
        ? Object.entries(p.recipe.products)
            .map(([id, amount]) =>
              this.amount({ kind: "reagent", id }, times.mul(Q.fromAmount(amount))),
            )
            .sort((a, b) => Number(b.id === ref.id) - Number(a.id === ref.id))
        : [this.amount(ref, times)];
    const catalysts = catalystsOf(p).map((c) => ({
      id: c.id,
      name: this.graph.name({ kind: "reagent", id: c.id }),
      amount: c.amount,
    }));
    const reaction = p.kind === "reaction" ? p.recipe : null;
    const cooking = p.kind === "cooking" ? p.recipe : null;

    const step: Omit<Step, "text"> = {
      producer: { kind: p.kind, id: p.recipe.id },
      batches: times.toNumber(),
      inputs,
      catalysts,
      outputs,
      minTemp: reaction?.minTemp ?? null,
      maxTemp: reaction?.maxTemp ?? null,
      mixers: (reaction?.mixers ?? []).map((id) => ({ id, name: this.graph.mixerName(id) })),
      device: cooking?.device ?? null,
      time: cooking?.time ?? null,
      quantized: reaction?.quantized ?? false,
    };
    return { ...step, text: stepText(step, p, times) };
  }

  private buildTree(ref: NodeRef, amount: Q, ancestors: Set<string>, depth: number): PlanNode {
    const key = nodeKey(ref);
    const node: PlanNode = {
      kind: ref.kind,
      id: ref.id,
      name: this.graph.name(ref),
      amount: amount.toNumber(),
      catalyst: false,
      producer: null,
      batches: null,
      alternatives: this.graph.producers(ref).map((p) => p.recipe.id),
      leaf: null,
      children: [],
    };
    const choice = this.choices.get(key) ?? this.choose(ref);
    if (ancestors.has(key) || depth > MAX_TREE_DEPTH) {
      node.leaf = "cycle";
      return node;
    }
    if (typeof choice === "string") {
      node.leaf = choice;
      return node;
    }

    let times = amount.div(Q.fromAmount(yieldOf(choice, ref.id)));
    if (wholeBatches(choice)) times = times.ceil();
    node.producer = { kind: choice.kind, id: choice.recipe.id };
    node.batches = times.toNumber();

    const path = new Set(ancestors).add(key);
    for (const input of consumedInputs(choice)) {
      node.children.push(
        this.buildTree(input.ref, times.mul(Q.fromAmount(input.amount)), path, depth + 1),
      );
    }
    for (const c of catalystsOf(choice)) {
      const cref: NodeRef = { kind: "reagent", id: c.id };
      node.children.push({
        kind: "reagent",
        id: c.id,
        name: this.graph.name(cref),
        amount: c.amount,
        catalyst: true,
        producer: null,
        batches: null,
        alternatives: this.graph.producers(cref).map((p) => p.recipe.id),
        leaf: "catalyst",
        children: [],
      });
    }
    return node;
  }

  private amount(ref: NodeRef, amount: Q): Amount {
    return { kind: ref.kind, id: ref.id, name: this.graph.name(ref), amount: amount.toNumber() };
  }

  private recipeId(key: string): string {
    return (this.choices.get(key) as Producer).recipe.id;
  }
}

function wholeBatches(p: Producer): boolean {
  return p.kind === "cooking" || p.recipe.quantized;
}

function stepText(step: Omit<Step, "text">, p: Producer, times: Q): string {
  const list = (items: Amount[]) => items.map(amountText).join(" + ");
  const products = list(step.outputs.slice(0, 1));
  const extra = step.outputs.length > 1 ? ` (also makes ${list(step.outputs.slice(1))})` : "";

  if (p.kind === "cooking") {
    const n = times.toNumber();
    const perBatch = consumedInputs(p).map((i) => ({ ...i, name: nameOf(step.inputs, i.ref.id) }));
    const ingredients = perBatch
      .map((i) => amountText({ kind: i.ref.kind, id: i.ref.id, name: i.name, amount: i.amount }))
      .join(" + ");
    const duration = step.time ? ` for ${formatAmount(step.time)} s` : "";
    const repeat = n > 1 ? `, ${n} times` : "";
    return `${step.device ?? "Cook"} ${ingredients}${duration}${repeat} → ${products}`;
  }

  const parts = [`Mix ${list(step.inputs)}`];
  if (step.catalysts.length > 0) {
    const cats = step.catalysts.map((c) => `${formatAmount(c.amount)}u ${c.name}`).join(" + ");
    parts[0] += ` with ${cats} present (catalyst, not consumed)`;
  }
  if (step.mixers.length > 0) parts.push(`in a ${step.mixers.map((m) => m.name).join(" + ")}`);
  if (step.minTemp !== null) parts.push(`heat to ≥ ${formatAmount(step.minTemp)} K`);
  if (step.maxTemp !== null) parts.push(`keep at ≤ ${formatAmount(step.maxTemp)} K`);
  if (step.quantized) parts.push(`in whole batches (${times.toNumber()}×)`);
  return `${parts.join(", ")} → ${products}${extra}`;
}

function amountText(a: Amount): string {
  return a.kind === "reagent"
    ? `${formatAmount(a.amount)}u ${a.name}`
    : `${formatAmount(a.amount)}× ${a.name}`;
}

function nameOf(items: Amount[], id: string): string {
  return items.find((i) => i.id === id)?.name ?? id;
}

function byAmountThenId(a: { amount: number; id: string }, b: { amount: number; id: string }) {
  return b.amount - a.amount || a.id.localeCompare(b.id);
}

function edge(from: string, to: string): string {
  return `${from}>${to}`;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}
