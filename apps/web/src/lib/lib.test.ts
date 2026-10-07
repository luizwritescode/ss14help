import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  displayName,
  filterItems,
  humanizeId,
  parseCalcQuery,
  search,
  ServerModel,
  SNAPSHOT_FILES,
  type SnapshotFiles,
} from "./model";
import { formatStack, parseStack, parseSubject, subjectPath } from "./subjects";
import { parseParams, serializeParams } from "./url-state";

function upstream(): ServerModel {
  const dir = join(__dirname, "../../public/data/upstream");
  const files = Object.fromEntries(
    Object.entries(SNAPSHOT_FILES).map(([k, f]) => [
      k,
      JSON.parse(readFileSync(join(dir, f), "utf8")),
    ]),
  ) as SnapshotFiles;
  return new ServerModel(files);
}

describe("subjects", () => {
  it("parses and formats stacks", () => {
    expect(parseSubject("reagent:Bicaridine")).toEqual({ kind: "reagent", id: "Bicaridine" });
    expect(parseSubject("nope:X")).toBeNull();
    expect(parseSubject("reagent:")).toBeNull();
    const stack = parseStack("reagent:A,item:B,bogus,reaction:C");
    expect(stack).toEqual([
      { kind: "reagent", id: "A" },
      { kind: "item", id: "B" },
      { kind: "reaction", id: "C" },
    ]);
    expect(formatStack(stack)).toBe("reagent:A,item:B,reaction:C");
    expect(subjectPath("upstream", { kind: "item", id: "FoodBreadBun" })).toBe(
      "/upstream/item/FoodBreadBun",
    );
    expect(subjectPath("upstream", { kind: "reaction", id: "X" })).toBeNull();
  });
});

describe("url state", () => {
  it("round-trips and drops defaults", () => {
    const qs =
      "open=reagent:Bicaridine,reagent:Inaprovaline&tab=calc&amt=30&own=Carbon&v.Ammonia=Ammonia&cat=chemistry/medicine&q=bi&f=heat,mixer:Centrifuge";
    const p = parseParams(new URLSearchParams(qs));
    expect(p.open).toHaveLength(2);
    expect(p.tab).toBe("calc");
    expect(p.amt).toBe(30);
    expect(p.owned).toEqual(["Carbon"]);
    expect(p.variants).toEqual({ Ammonia: "Ammonia" });
    expect(p.filters).toEqual(["heat", "mixer:Centrifuge"]);
    expect(parseParams(new URLSearchParams(serializeParams(p)))).toEqual(p);
    expect(serializeParams(parseParams(new URLSearchParams("")))).toBe("");
  });

  it("ignores invalid values", () => {
    const p = parseParams(new URLSearchParams("tab=nope&amt=-3&open=garbage"));
    expect(p.tab).toBe("recipe");
    expect(p.amt).toBeNull();
    expect(p.open).toEqual([]);
  });

  it("drops panel params when the panel is closed", () => {
    const p = parseParams(new URLSearchParams("tab=calc&amt=30"));
    expect(serializeParams(p)).toBe("");
  });
});

describe("display helpers", () => {
  it("capitalizes and humanizes", () => {
    expect(displayName("bicaridine")).toBe("Bicaridine");
    expect(humanizeId("AluminiumMetalFoam")).toBe("Aluminium metal foam");
  });

  it("parses the calculator shortcut", () => {
    expect(parseCalcQuery("30u bica")).toEqual({ amount: 30, rest: "bica" });
    expect(parseCalcQuery("12.5 bicaridine")).toEqual({ amount: 12.5, rest: "bicaridine" });
    expect(parseCalcQuery("bica")).toBeNull();
    expect(parseCalcQuery("0u bica")).toBeNull();
  });
});

describe("server model (upstream snapshot)", () => {
  const model = upstream();

  it("builds the category tree from data", () => {
    expect(model.categories.map((c) => c.path)).toEqual([
      "chemistry",
      "cooking",
      "reagents",
      "sources",
    ]);
    const medicine = model.node("chemistry/medicine");
    expect(medicine?.label).toBe("Medicine");
    expect(
      medicine?.items.every((i) => i.kind === "reaction" && i.reaction.category === "medicine"),
    ).toBe(true);
    // Chemistry children are ordered by size.
    const sizes = model.categories[0]!.children.map((c) => c.items.length);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(model.node("cooking/microwave/breads")).toBeDefined();
  });

  it("maps reaction rows to their primary product", () => {
    const r = model.reactions.get("BloodBreakdown")!;
    expect(model.reactionTarget(r)).toEqual({
      subject: { kind: "reagent", id: "Water" },
      via: "BloodBreakdown",
    });
    const effectOnly = [...model.reactions.values()].find(
      (x) => Object.keys(x.products).length === 0,
    )!;
    expect(model.reactionTarget(effectOnly).subject.kind).toBe("reaction");
  });

  it("searches names first, then ids", () => {
    expect(search(model, "bica")[0]).toMatchObject({ kind: "reagent", id: "Bicaridine" });
    expect(search(model, "Bicaridine")[0]?.id).toBe("Bicaridine");
    expect(search(model, "")).toEqual([]);
  });

  it("filters list items", () => {
    const items = model.node("chemistry/medicine")!.items;
    const heat = filterItems(model, items, "", ["heat"]);
    expect(heat.length).toBeGreaterThan(0);
    expect(heat.every((i) => i.kind === "reaction" && i.reaction.minTemp !== null)).toBe(true);
    expect(filterItems(model, items, "bicar", []).map((i) => i.name)).toContain("Bicaridine");
  });
});
