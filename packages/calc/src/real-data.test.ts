// Runs the planner over every craftable reagent and item in the committed snapshots
// (data/<server>/), checking that each plan is executable. Skips servers without data.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CalcData } from "./graph";
import { RecipeGraph } from "./graph";
import { type Plan, plan } from "./plan";

const DATA_DIR = join(__dirname, "../../../data");
const servers = existsSync(DATA_DIR)
  ? readdirSync(DATA_DIR).filter((d) => existsSync(join(DATA_DIR, d, "manifest.json")))
  : [];

function load(server: string): CalcData {
  const read = (file: string) => JSON.parse(readFileSync(join(DATA_DIR, server, file), "utf8"));
  return {
    recipes: read("recipes.json"),
    reagents: read("reagents.json"),
    entities: read("entities.json"),
    sources: read("sources.json"),
  };
}

function executable(p: Plan): string | null {
  const inv = new Map<string, number>();
  const add = (id: string, n: number) => inv.set(id, (inv.get(id) ?? 0) + n);
  for (const b of p.basics) add(b.id, b.amount);
  for (const c of p.catalysts) add(c.id, c.amount);
  for (const step of p.steps) {
    for (const input of step.inputs) {
      const have = inv.get(input.id) ?? 0;
      if (have < input.amount - 1e-6) return `${step.producer.id} lacks ${input.id}`;
      inv.set(input.id, have - input.amount);
    }
    for (const output of step.outputs) add(output.id, output.amount);
  }
  return (inv.get(p.target.id) ?? 0) >= p.requested - 1e-6 ? null : "target not produced";
}

describe.skipIf(servers.length === 0)("real data", () => {
  it.each(servers)("%s: every craftable thing has an executable plan", (server) => {
    const graph = new RecipeGraph(load(server));
    const failures: string[] = [];
    let planned = 0;
    for (const id of graph.reagents.keys()) {
      const ref = { kind: "reagent" as const, id };
      if (graph.isBasic(ref)) continue;
      const problem = executable(plan(graph, ref, 30));
      planned++;
      if (problem) failures.push(`${id}: ${problem}`);
    }
    for (const recipe of graph.cookingRecipes.values()) {
      const ref = { kind: "item" as const, id: recipe.result };
      const problem = executable(plan(graph, ref, 2));
      planned++;
      if (problem) failures.push(`${recipe.result}: ${problem}`);
    }
    expect(failures).toEqual([]);
    expect(planned).toBeGreaterThan(100);
  });
});
