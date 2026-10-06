import { describe, expect, it } from "vitest";
import { cat, cooking, data, DISPENSABLE, entity, realData, rx } from "./fixtures";
import { RecipeGraph } from "./graph";
import { plan, type Plan } from "./plan";

const real = new RecipeGraph(realData());
const reagent = (id: string) => ({ kind: "reagent" as const, id });

/** Asserts a list has exactly these ids, with amounts equal to 6 decimals. */
function expectAmounts(
  list: { id: string; amount: number }[],
  expected: Record<string, number>,
): void {
  expect(list.map((x) => x.id).sort()).toEqual(Object.keys(expected).sort());
  for (const item of list) expect(item.amount).toBeCloseTo(expected[item.id] as number, 6);
}

const stepIds = (p: Plan) => p.steps.map((s) => s.producer.id);

// Every expected number below was worked out by hand from the reactions in fixtures.ts.
describe("plan: hand-verified real recipes", () => {
  it("1. Kelotane 10u — one level", () => {
    // Si 1 + C 1 → 2. 10u = 5 batches.
    const p = plan(real, reagent("Kelotane"), 10);
    expectAmounts(p.basics, { Silicon: 5, Carbon: 5 });
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0]?.batches).toBe(5);
    expect(p.produced).toBe(10);
  });

  it("2. Bicaridine 30u — two levels, carbon aggregated", () => {
    // 15 batches: 15 Inaprovaline + 15 C. Inaprovaline 15u = 5 batches: 5 O, 5 C, 5 Sugar.
    const p = plan(real, reagent("Bicaridine"), 30);
    expectAmounts(p.basics, { Oxygen: 5, Sugar: 5, Carbon: 20 });
    expect(stepIds(p)).toEqual(["Inaprovaline", "Bicaridine"]);
    expect(p.steps[0]?.text).toBe("Mix 5u oxygen + 5u carbon + 5u sugar → 15u inaprovaline");
    expect(p.catalysts).toEqual([]);
  });

  it("3. Tricordrazine 30u — two intermediates", () => {
    // 15 batches: 15 Inaprovaline (5 O, 5 C, 5 Sugar) + 15 Dylovene (5 batches: 5 Si, 5 N, 5 K).
    const p = plan(real, reagent("Tricordrazine"), 30);
    expectAmounts(p.basics, {
      Oxygen: 5,
      Carbon: 5,
      Sugar: 5,
      Silicon: 5,
      Nitrogen: 5,
      Potassium: 5,
    });
    expect(stepIds(p).at(-1)).toBe("Tricordrazine");
  });

  it("4. Dexalin 30u — catalyst listed once, not consumed", () => {
    // O 2 + Plasma(cat) 1 → 3. 10 batches: 20 O. Plasma: keep 1u present.
    const p = plan(real, reagent("Dexalin"), 30);
    expectAmounts(p.basics, { Oxygen: 20 });
    expectAmounts(p.catalysts, { Plasma: 1 });
    expect(p.catalysts[0]?.usedBy).toEqual(["Dexalin"]);
    expect(p.catalysts[0]?.strict).toBe(false);
    expect(p.steps[0]?.text).toContain("with 1u plasma present (catalyst, not consumed)");
  });

  it("5. Dexalin 300u — catalyst does not scale (v1 bug)", () => {
    const p = plan(real, reagent("Dexalin"), 300);
    expectAmounts(p.basics, { Oxygen: 200 });
    expectAmounts(p.catalysts, { Plasma: 1 });
  });

  it("6. DexalinPlus 30u — fractional batches stay exact", () => {
    // 10 batches: 10 Dexalin + 10 C + 10 Fe. Dexalin 10u = 10/3 batches: 20/3 O.
    const p = plan(real, reagent("DexalinPlus"), 30);
    expectAmounts(p.basics, { Oxygen: 20 / 3, Carbon: 10, Iron: 10 });
    expect(p.steps[0]?.batches).toBeCloseTo(10 / 3, 9);
    expect(p.steps[0]?.text).toContain("6.67u oxygen");
  });

  it("7. Cryoxadone 30u — oxygen from two levels summed", () => {
    // 10 batches: 10 Dexalin, 10 Water, 10 O. Dexalin: 20/3 O. Total O = 50/3.
    const p = plan(real, reagent("Cryoxadone"), 30);
    expectAmounts(p.basics, { Oxygen: 50 / 3, Water: 10 });
    expectAmounts(p.catalysts, { Plasma: 1 });
  });

  it("8. Sedin 10u — four levels, two catalysts, heat step", () => {
    // Sedin: 10 batches → 10 Cryoxadone, 30 RobustHarvest, 30 Diethylamine.
    //   Cryoxadone 10u = 10/3 batches → 10/3 Dexalin, 10/3 Water, 10/3 O.
    //     Dexalin 10/3u = 10/9 batches → 20/9 O.
    //   RobustHarvest 30u = 30 batches → 30 EZNutrient (basic, not dispensable). SulfuricAcid cat.
    //   Diethylamine 30u = 15 batches → 15 Ammonia, 15 Ethanol.
    //     Ammonia 15u = 15/4 batches → 45/4 H, 15/4 N (≥ 370 K).
    const p = plan(real, reagent("Sedin"), 10);
    expectAmounts(p.basics, {
      Oxygen: 10 / 3 + 20 / 9,
      Water: 10 / 3,
      EZNutrient: 30,
      Ethanol: 15,
      Hydrogen: 45 / 4,
      Nitrogen: 15 / 4,
    });
    expect(p.basics.find((b) => b.id === "EZNutrient")?.reason).toBe("basic");
    expect(p.basics.find((b) => b.id === "Oxygen")?.reason).toBe("dispensable");
    expectAmounts(p.catalysts, { Plasma: 1, SulfuricAcid: 1 });
    const ammonia = p.steps.find((s) => s.producer.id === "Ammonia");
    expect(ammonia?.text).toBe(
      "Mix 11.25u hydrogen + 3.75u nitrogen, heat to ≥ 370 K → 15u ammonia",
    );
    // Producers come before consumers.
    const order = stepIds(p);
    for (const [before, after] of [
      ["Dexalin", "Cryoxadone"],
      ["Ammonia", "Diethylamine"],
      ["Cryoxadone", "Sedin"],
      ["RobustHarvest", "Sedin"],
      ["Diethylamine", "Sedin"],
    ] as const) {
      expect(order.indexOf(before)).toBeLessThan(order.indexOf(after));
    }
    expect(order.at(-1)).toBe("Sedin");
  });

  it("9. Desoxyephedrine 20u — four levels down to ammonia", () => {
    // 5 batches: 5 Ephedrine, 5 C, 5 I, 5 P.
    //   Ephedrine 5u = 5/4 batches: 5/4 Oil, 5/4 H, 5/4 Sugar, 5/4 Diethylamine.
    //     Diethylamine 5/4u = 5/8 batches: 5/8 Ammonia, 5/8 Ethanol.
    //       Ammonia 5/8u = 5/32 batches: 15/32 H, 5/32 N.
    const p = plan(real, reagent("Desoxyephedrine"), 20);
    expectAmounts(p.basics, {
      Carbon: 5,
      Iodine: 5,
      Phosphorus: 5,
      Oil: 5 / 4,
      Sugar: 5 / 4,
      Hydrogen: 5 / 4 + 15 / 32,
      Ethanol: 5 / 8,
      Nitrogen: 5 / 32,
    });
    expect(real.stepCount(reagent("Desoxyephedrine"))).toBe(4);
  });

  it("10. Arithrazine 10u — repeating thirds", () => {
    // 5 batches: 5 Hyronalin, 5 H. Hyronalin 5u = 2.5 batches: 2.5 Ra, 2.5 Dylovene.
    //   Dylovene 2.5u = 5/6 batches: 5/6 each of Si, N, K.
    const p = plan(real, reagent("Arithrazine"), 10);
    expectAmounts(p.basics, {
      Hydrogen: 5,
      Radium: 2.5,
      Silicon: 5 / 6,
      Nitrogen: 5 / 6,
      Potassium: 5 / 6,
    });
  });

  it("11. Leporazine 10u — intermediate plus catalyst", () => {
    // 5 batches: 5 Cu, 5 Fersilicite, Plasma cat. Fersilicite 5u = 2.5 batches: 2.5 Fe, 2.5 Si.
    const p = plan(real, reagent("Leporazine"), 10);
    expectAmounts(p.basics, { Copper: 5, Iron: 2.5, Silicon: 2.5 });
    expectAmounts(p.catalysts, { Plasma: 1 });
  });

  it("12. Ice 12u — quantized reaction rounds batches up and reports the overshoot", () => {
    // FlashFreezeIce: Fresium 1 + Water 1 → 5 Ice, quantized. 12/5 = 2.4 → 3 batches → 15u.
    //   Fresium 3u = 3/5 batches: 1.8 Frezon, 1.2 N, 0.132 Cryoxadone, 0.048 TableSalt, 0.9 Water.
    const p = plan(real, reagent("Ice"), 12);
    expect(p.produced).toBe(15);
    expect(p.overshoot).toBe(3);
    const ice = p.steps.find((s) => s.producer.id === "FlashFreezeIce");
    expect(ice?.batches).toBe(3);
    expect(ice?.text).toContain("in whole batches (3×)");
    const fresium = p.steps.find((s) => s.producer.id === "Fresium");
    expect(fresium?.batches).toBeCloseTo(0.6, 9);
    expect(fresium?.text).toContain("keep at ≤ 300 K");
    const basics = Object.fromEntries(p.basics.map((b) => [b.id, b.amount]));
    expect(basics.Frezon).toBeCloseTo(1.8, 9);
    expect(basics.TableSalt).toBeCloseTo(0.048, 9);
    // Water: 3 (Ice) + 0.9 (Fresium) + 0.044 (Cryoxadone, 0.132/3 batches).
    expect(basics.Water).toBeCloseTo(3.944, 9);
  });

  it("13. Protein 8u — split reactions are opt-in, and scale by the right product (v1 bug)", () => {
    // Protein is only a side product of BloodBreakdown, so by default it's gathered.
    expect(real.isBasic(reagent("Protein"))).toBe(true);
    expectAmounts(plan(real, reagent("Protein"), 8).basics, { Protein: 8 });
    // Chosen explicitly: 4 Protein per 20 Blood → 2 batches = 40 Blood (v1 used Water's 11).
    const p = plan(real, reagent("Protein"), 8, { variants: { Protein: "BloodBreakdown" } });
    expectAmounts(p.basics, { Blood: 40 });
    expectAmounts(p.leftovers, { Water: 22, Iron: 1, Sugar: 4, CarbonDioxide: 6 });
    expect(p.steps[0]?.text).toBe(
      "Mix 40u blood, mixing: centrifuge → 8u protein (also makes 22u water + 1u iron + 4u sugar + 6u carbondioxide)",
    );
  });

  it("14. dispensable reagents are basic even when a reaction makes them", () => {
    // BloodBreakdown produces Water, but Water comes from a dispenser.
    expect(real.isBasic(reagent("Water"))).toBe(true);
    expect(real.producers(reagent("Water")).map((p) => p.recipe.id)).toEqual(["BloodBreakdown"]);
    const p = plan(real, reagent("Water"), 10);
    expectAmounts(p.basics, { Water: 10 });
    expect(p.steps).toEqual([]);
  });

  it("15. owned intermediates stop the expansion", () => {
    // Bicaridine 30u with Inaprovaline on hand: 15 Inaprovaline + 15 C, nothing else.
    const p = plan(real, reagent("Bicaridine"), 30, { owned: ["Inaprovaline"] });
    expectAmounts(p.basics, { Inaprovaline: 15, Carbon: 15 });
    expect(p.basics.find((b) => b.id === "Inaprovaline")?.reason).toBe("owned");
    expect(stepIds(p)).toEqual(["Bicaridine"]);
  });

  it("16. the target itself is never treated as owned", () => {
    const p = plan(real, reagent("Kelotane"), 10, { owned: ["Kelotane"] });
    expectAmounts(p.basics, { Silicon: 5, Carbon: 5 });
  });
});

describe("plan: tree", () => {
  it("shows per-path amounts, catalysts as leaves, and alternatives", () => {
    const p = plan(real, reagent("Leporazine"), 10);
    const t = p.tree;
    expect(t).toMatchObject({ id: "Leporazine", amount: 10, batches: 5, leaf: null });
    expect(t.producer).toEqual({ kind: "reaction", id: "Leporazine" });
    const children = Object.fromEntries(t.children.map((c) => [c.id, c]));
    expect(children.Copper).toMatchObject({ amount: 5, leaf: "dispensable" });
    expect(children.Plasma).toMatchObject({ amount: 1, catalyst: true, leaf: "catalyst" });
    expect(children.Fersilicite?.children.map((c) => [c.id, c.amount])).toEqual([
      ["Iron", 2.5],
      ["Silicon", 2.5],
    ]);
    expect(children.Fersilicite?.alternatives).toEqual(["Fersilicite"]);
  });
});

describe("plan: variants, credits, cycles, cooking", () => {
  it("picks the primary-product recipe by default and honours overrides", () => {
    const g = new RecipeGraph(
      data(
        [
          rx("Slow", { A: 1, B: 1 }, { X: 1 }),
          rx("X", { C: 2 }, { X: 1 }),
          rx("Split", { D: 1 }, { X: 1, Y: 1 }),
        ],
        { dispensable: ["A", "B", "C", "D"] },
      ),
    );
    // "Split" isn't for X (two products, other id), so it's only used when chosen. "Slow" has a
    // single product, so it is primary like "X"; both take 1 step, same priority: "Slow" < "X".
    expect(g.defaultProducer(reagent("X"))?.recipe.id).toBe("Slow");
    const p = plan(g, reagent("X"), 2, { variants: { X: "Split" } });
    expectAmounts(p.basics, { D: 2 });
    expectAmounts(p.leftovers, { Y: 2 });
    const bad = plan(g, reagent("X"), 2, { variants: { X: "Nope" } });
    expect(bad.warnings).toEqual([`"Nope" doesn't make X; using the default recipe.`]);
  });

  it("prefers fewer steps, then higher priority", () => {
    const g = new RecipeGraph(
      data(
        [
          rx("Deep", { M: 1 }, { X: 1 }),
          rx("M", { A: 1 }, { M: 1 }),
          rx("Shallow", { A: 1 }, { X: 1 }),
          rx("ShallowHigh", { B: 1 }, { X: 1 }, { priority: 5 }),
        ],
        { dispensable: ["A", "B"] },
      ),
    );
    expect(g.defaultProducer(reagent("X"))?.recipe.id).toBe("ShallowHigh");
  });

  it("credits a byproduct to a later need instead of making more", () => {
    // T ← A + B. A split yields A and S; B needs S. T 1u needs 1 A and (through B) 1 S, and one
    // split run makes both: the second need is covered by the first run's byproduct.
    const g = new RecipeGraph(
      data(
        [
          rx("T", { A: 1, B: 1 }, { T: 1 }),
          rx("Split", { Ore: 1 }, { A: 1, S: 1 }),
          rx("B", { S: 1, C: 1 }, { B: 1 }),
        ],
        { dispensable: ["Ore", "C"] },
      ),
    );
    // Split products are only used when chosen.
    const p = plan(g, reagent("T"), 1, { variants: { A: "Split", S: "Split" } });
    expectAmounts(p.basics, { Ore: 1, C: 1 });
    expect(p.credits).toHaveLength(1);
    expect(p.credits[0]).toMatchObject({ amount: 1, fromRecipe: "Split" });
    expect(p.leftovers).toEqual([]);
    const order = stepIds(p);
    expect(order.filter((id) => id === "Split")).toHaveLength(1);
    expect(order.indexOf("Split")).toBeLessThan(order.indexOf("B"));
    expect(order.at(-1)).toBe("T");
  });

  it("does not credit a byproduct that would only exist after it's needed", () => {
    // T ← A + S. A ← 2 S + C and also yields 1 S. A needs its S before it runs, so A's surplus S
    // can't pay for it. (Surplus is pooled per reagent, so it isn't offered to T either.)
    // T 1u: 1 A (2 S, 1 C) + 1 S → 3 S, 1 C, and 1 S left over.
    const g = new RecipeGraph(
      data([rx("T", { A: 1, S: 1 }, { T: 1 }), rx("A", { S: 2, C: 1 }, { A: 1, S: 1 })], {
        dispensable: ["S", "C"],
      }),
    );
    const p = plan(g, reagent("T"), 1);
    expectAmounts(p.basics, { S: 3, C: 1 });
    expect(p.credits).toEqual([]);
    expectAmounts(p.leftovers, { S: 1 });
  });

  it("cuts cycles and reports them", () => {
    const g = new RecipeGraph(data([rx("A", { B: 1 }, { A: 1 }), rx("B", { A: 2 }, { B: 1 })]));
    const p = plan(g, reagent("A"), 1);
    expectAmounts(p.basics, { A: 2 });
    expect(p.basics[0]?.reason).toBe("cycle");
    expect(p.warnings).toEqual(["A is part of a cycle; it is listed as an ingredient."]);
    expect(p.tree.children[0]?.children[0]).toMatchObject({ id: "A", leaf: "cycle" });
  });

  it("strict catalyst minimum for quantized reactions", () => {
    const g = new RecipeGraph(
      data([rx("X", { A: 1, K: cat(5) }, { X: 1 }, { quantized: true })], { dispensable: ["A"] }),
    );
    const p = plan(g, reagent("X"), 3);
    expectAmounts(p.catalysts, { K: 5 });
    expect(p.catalysts[0]?.strict).toBe(true);
  });

  it("cooking: whole batches, solids as items, reagents expanded", () => {
    // Chicken sandwich ×3: 3 buns, 3 chicken, 6u Mayo. Mayo ← Oil 1 + Egg 1 → 2 Mayo: 3 batches.
    const g = new RecipeGraph(
      data([rx("Mayo", { Oil: 1, Egg: 1 }, { Mayo: 2 })], {
        dispensable: DISPENSABLE,
        cooking: [
          cooking(
            "RecipeChickenSandwich",
            "FoodBurgerChicken",
            {
              FoodBreadBun: 1,
              FoodMeatChicken: 1,
            },
            { Mayo: 2 },
          ),
        ],
        entities: [
          entity("FoodBreadBun", "bun"),
          entity("FoodMeatChicken", "raw chicken meat"),
          entity("FoodBurgerChicken", "chicken sandwich"),
        ],
      }),
    );
    const p = plan(g, { kind: "item", id: "FoodBurgerChicken" }, 3);
    expectAmounts(p.basics, { FoodBreadBun: 3, FoodMeatChicken: 3, Oil: 3, Egg: 3 });
    expect(p.basics.find((b) => b.id === "FoodBreadBun")?.kind).toBe("item");
    const cook = p.steps.at(-1);
    expect(cook?.batches).toBe(3);
    expect(cook?.text).toBe(
      "Microwave 1× bun + 1× raw chicken meat + 2u mayo for 10 s, 3 times → 3× chicken sandwich",
    );
    // 2.5 sandwiches still needs 3 runs.
    expect(plan(g, { kind: "item", id: "FoodBurgerChicken" }, 2.5).produced).toBe(3);
  });

  it("attaches grind/juice sources to basic reagents", () => {
    const g = new RecipeGraph(
      data([rx("Dough", { Flour: 3, Water: 1 }, { Dough: 1 })], {
        dispensable: ["Water"],
        entities: [entity("WheatBushel", "wheat bushel")],
        sources: [{ entity: "WheatBushel", grind: { Flour: 10 }, juice: null }],
      }),
    );
    const flour = plan(g, reagent("Dough"), 1).basics.find((b) => b.id === "Flour");
    expect(flour?.sources).toEqual([
      { entity: "WheatBushel", entityName: "wheat bushel", method: "grind", amount: 10 },
    ]);
  });

  it("rejects non-positive amounts", () => {
    expect(() => plan(real, reagent("Kelotane"), 0)).toThrow(RangeError);
    expect(() => plan(real, reagent("Kelotane"), Number.NaN)).toThrow(RangeError);
  });
});

describe("graph", () => {
  it("indexes consumers and step counts", () => {
    const used = real.consumersOf(reagent("Plasma"));
    expect(used.catalystFor.map((r) => r.id)).toEqual(["Dexalin", "Fresium", "Leporazine"]);
    expect(real.consumersOf(reagent("Inaprovaline")).ingredientIn.map((r) => r.id)).toEqual([
      "Bicaridine",
      "Tricordrazine",
    ]);
    expect(real.stepCount(reagent("Kelotane"))).toBe(1);
    expect(real.stepCount(reagent("Bicaridine"))).toBe(2);
    expect(real.stepCount(reagent("Oxygen"))).toBe(0);
  });
});
