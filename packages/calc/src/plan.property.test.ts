import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Reaction } from "@ss14help/schema";
import { cat, data, rx } from "./fixtures";
import { RecipeGraph } from "./graph";
import { plan, type Plan } from "./plan";

const BASICS = ["B0", "B1", "B2", "B3"];
const CATALYSTS = ["K0", "K1"];

interface GenOptions {
  /** Allow quantized reactions and byproducts (breaks linearity, still must be executable). */
  messy: boolean;
}

/**
 * A random recipe DAG: R0..Rn, where Ri is made from basics and lower-numbered Rs, so there are
 * no cycles. In messy mode reactions may be quantized and may also yield a lower-numbered R as a
 * byproduct, which exercises crediting.
 */
const recipeGraph = ({ messy }: GenOptions) =>
  fc.integer({ min: 1, max: 7 }).chain((n) =>
    fc
      .tuple(
        ...Array.from({ length: n }, (_, i) =>
          fc.record({
            inputs: fc.uniqueArray(
              fc.constantFrom(...BASICS, ...Array.from({ length: i }, (_, j) => `R${j}`)),
              { minLength: 1, maxLength: 3 },
            ),
            amounts: fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 3, maxLength: 3 }),
            halfUnits: fc.boolean(),
            yield: fc.integer({ min: 1, max: 6 }),
            catalyst: fc.option(fc.constantFrom(...CATALYSTS), { nil: undefined }),
            quantized: messy ? fc.boolean() : fc.constant(false),
            byproduct:
              messy && i > 0
                ? fc.option(fc.integer({ min: 0, max: i - 1 }), { nil: undefined })
                : fc.constant(undefined),
            byproductAmount: fc.integer({ min: 1, max: 4 }),
          }),
        ),
      )
      .map((specs) => {
        const reactions: Reaction[] = specs.map((s, i) => {
          const reactants: Parameters<typeof rx>[1] = {};
          s.inputs.forEach((id, k) => {
            const amount = s.amounts[k] as number;
            reactants[id] = s.halfUnits ? amount / 2 : amount;
          });
          if (s.catalyst) reactants[s.catalyst] = cat(1 + (i % 3));
          const products: Record<string, number> = { [`R${i}`]: s.yield };
          if (s.byproduct !== undefined) products[`R${s.byproduct}`] = s.byproductAmount;
          return rx(`R${i}`, reactants, products, { quantized: s.quantized });
        });
        return { graph: new RecipeGraph(data(reactions, { dispensable: BASICS })), n };
      }),
  );

const amountU = fc.integer({ min: 1, max: 400 }).map((x) => x / 4);

/** Runs the steps against an inventory holding only the plan's basics and catalysts. */
function simulate(p: Plan): Map<string, number> {
  const inv = new Map<string, number>();
  const add = (id: string, amount: number) => inv.set(id, (inv.get(id) ?? 0) + amount);
  for (const b of p.basics) add(b.id, b.amount);
  for (const c of p.catalysts) add(c.id, c.amount);
  for (const step of p.steps) {
    for (const c of step.catalysts) {
      expect(inv.get(c.id) ?? 0, `${step.producer.id} needs catalyst ${c.id}`).toBeGreaterThan(0);
    }
    for (const input of step.inputs) {
      const have = inv.get(input.id) ?? 0;
      expect(have, `${step.producer.id} needs ${input.amount} ${input.id}`).toBeGreaterThanOrEqual(
        input.amount - 1e-9,
      );
      inv.set(input.id, have - input.amount);
    }
    for (const output of step.outputs) add(output.id, output.amount);
  }
  return inv;
}

const byId = (list: { id: string; amount: number }[]) =>
  Object.fromEntries(list.map((x) => [x.id, x.amount]));

describe("plan: properties", () => {
  it("every plan is executable and makes at least what was asked", () => {
    fc.assert(
      fc.property(recipeGraph({ messy: true }), amountU, ({ graph, n }, amount) => {
        const target = { kind: "reagent" as const, id: `R${n - 1}` };
        const p = plan(graph, target, amount);
        const inv = simulate(p);
        expect(inv.get(target.id) ?? 0).toBeGreaterThanOrEqual(amount - 1e-9);
        expect(p.produced).toBeGreaterThanOrEqual(amount);
        // Leftovers are exactly what the simulation has spare (besides the target and catalysts).
        for (const l of p.leftovers)
          expect(inv.get(l.id) ?? 0).toBeGreaterThanOrEqual(l.amount - 1e-9);
      }),
      { numRuns: 300 },
    );
  });

  it("scaling is linear without quantized reactions or byproducts", () => {
    fc.assert(
      fc.property(
        recipeGraph({ messy: false }),
        amountU,
        fc.integer({ min: 2, max: 9 }),
        ({ graph, n }, amount, k) => {
          const target = { kind: "reagent" as const, id: `R${n - 1}` };
          const one = byId(plan(graph, target, amount).basics);
          const many = byId(plan(graph, target, amount * k).basics);
          expect(Object.keys(many).sort()).toEqual(Object.keys(one).sort());
          for (const [id, value] of Object.entries(one)) {
            expect(many[id]).toBeCloseTo(value * k, 6);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("catalysts never scale with the amount", () => {
    fc.assert(
      fc.property(recipeGraph({ messy: true }), amountU, amountU, ({ graph, n }, a, b) => {
        const target = { kind: "reagent" as const, id: `R${n - 1}` };
        expect(byId(plan(graph, target, a).catalysts)).toEqual(
          byId(plan(graph, target, b).catalysts),
        );
      }),
      { numRuns: 200 },
    );
  });
});
