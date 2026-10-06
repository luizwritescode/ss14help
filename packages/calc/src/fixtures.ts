/**
 * Test fixtures. `realData` holds reactions copied from the SS14 prototypes (upstream
 * Resources/Prototypes/Recipes/Reactions, via the Starlight fork), so the expected numbers in the
 * tests can be checked against the game files by hand.
 */
import type {
  CookingRecipe,
  Entity,
  Reaction,
  Reagent,
  RecipesFile,
  Source,
} from "@ss14help/schema";
import type { CalcData } from "./graph";

type Reactants = Record<string, number | { amount: number; catalyst: true }>;

export function rx(
  id: string,
  reactants: Reactants,
  products: Record<string, number>,
  extra: Partial<Reaction> = {},
): Reaction {
  return {
    sourceFile: "Recipes/Reactions/test.yml",
    serverOnly: false,
    id,
    category: "test",
    reactants: Object.fromEntries(
      Object.entries(reactants).map(([k, v]) => [
        k,
        typeof v === "number" ? { amount: v, catalyst: false } : v,
      ]),
    ),
    products,
    minTemp: null,
    maxTemp: null,
    mixers: [],
    quantized: false,
    priority: 0,
    effects: [],
    ...extra,
  };
}

export const cat = (amount: number) => ({ amount, catalyst: true as const });

export function reagent(id: string, dispensable = false): Reagent {
  return {
    sourceFile: "Reagents/test.yml",
    serverOnly: false,
    id,
    name: id.toLowerCase(),
    desc: null,
    physicalDesc: null,
    group: null,
    color: null,
    dispensable,
  };
}

export function entity(id: string, name: string): Entity {
  return { sourceFile: "Entities/test.yml", serverOnly: false, id, name, desc: null };
}

export function cooking(
  id: string,
  result: string,
  solids: Record<string, number>,
  reagents: Record<string, number>,
  time: number | null = 10,
): CookingRecipe {
  return {
    sourceFile: "Recipes/Cooking/test.yml",
    serverOnly: false,
    id,
    name: id,
    device: "Microwave",
    time,
    solids,
    reagents,
    result,
    group: null,
    secret: false,
  };
}

export function data(
  reactions: Reaction[],
  opts: {
    dispensable?: string[];
    reagents?: string[];
    cooking?: CookingRecipe[];
    entities?: Entity[];
    sources?: Source[];
    mixers?: RecipesFile["mixers"];
  } = {},
): CalcData {
  const dispensable = new Set(opts.dispensable ?? []);
  const ids = new Set([...(opts.reagents ?? []), ...dispensable]);
  for (const r of reactions) {
    for (const id of [...Object.keys(r.reactants), ...Object.keys(r.products)]) ids.add(id);
  }
  for (const c of opts.cooking ?? []) for (const id of Object.keys(c.reagents)) ids.add(id);
  return {
    recipes: { reactions, cooking: opts.cooking ?? [], mixers: opts.mixers ?? [] },
    reagents: { reagents: [...ids].sort().map((id) => reagent(id, dispensable.has(id))) },
    entities: { entities: opts.entities ?? [] },
    sources: { sources: opts.sources ?? [] },
  };
}

/** The standard chem dispenser, plus water (sinks, soda dispenser). */
export const DISPENSABLE = [
  "Aluminium",
  "Carbon",
  "Chlorine",
  "Copper",
  "Ethanol",
  "Fluorine",
  "Hydrogen",
  "Iodine",
  "Iron",
  "Lithium",
  "Mercury",
  "Nitrogen",
  "Oxygen",
  "Phosphorus",
  "Potassium",
  "Radium",
  "Silicon",
  "Sodium",
  "Sugar",
  "Sulfur",
  "Water",
];

export const realReactions: Reaction[] = [
  // medicine.yml
  rx("Bicaridine", { Inaprovaline: 1, Carbon: 1 }, { Bicaridine: 2 }),
  rx("Inaprovaline", { Oxygen: 1, Carbon: 1, Sugar: 1 }, { Inaprovaline: 3 }),
  rx("Dylovene", { Silicon: 1, Nitrogen: 1, Potassium: 1 }, { Dylovene: 3 }),
  rx("Kelotane", { Silicon: 1, Carbon: 1 }, { Kelotane: 2 }),
  rx("Tricordrazine", { Inaprovaline: 1, Dylovene: 1 }, { Tricordrazine: 2 }),
  rx("Dexalin", { Oxygen: 2, Plasma: cat(1) }, { Dexalin: 3 }),
  rx("DexalinPlus", { Dexalin: 1, Carbon: 1, Iron: 1 }, { DexalinPlus: 3 }),
  rx("Leporazine", { Copper: 1, Fersilicite: 1, Plasma: cat(1) }, { Leporazine: 2 }),
  rx("Arithrazine", { Hyronalin: 1, Hydrogen: 1 }, { Arithrazine: 2 }),
  rx("Hyronalin", { Radium: 1, Dylovene: 1 }, { Hyronalin: 2 }),
  rx("Cryoxadone", { Dexalin: 1, Water: 1, Oxygen: 1 }, { Cryoxadone: 3 }),
  // chemicals.yml
  rx("Fersilicite", { Iron: 1, Silicon: 1 }, { Fersilicite: 2 }),
  rx("Ammonia", { Hydrogen: 3, Nitrogen: 1 }, { Ammonia: 4 }, { minTemp: 370 }),
  rx("SulfuricAcid", { Hydrogen: 1, Sulfur: 1, Oxygen: 2 }, { SulfuricAcid: 3 }),
  rx("Diethylamine", { Ammonia: 1, Ethanol: 1 }, { Diethylamine: 2 }),
  rx("Ephedrine", { Oil: 1, Hydrogen: 1, Sugar: 1, Diethylamine: 1 }, { Ephedrine: 4 }),
  rx(
    "Desoxyephedrine",
    { Ephedrine: 1, Carbon: 1, Iodine: 1, Phosphorus: 1 },
    { Desoxyephedrine: 4 },
    { minTemp: 370 },
  ),
  // botany.yml
  rx("RobustHarvest", { EZNutrient: 1, SulfuricAcid: cat(1) }, { RobustHarvest: 1 }),
  rx("Sedin", { Cryoxadone: 1, RobustHarvest: 3, Diethylamine: 3 }, { Sedin: 1 }),
  // biological.yml
  rx(
    "BloodBreakdown",
    { Blood: 20 },
    { Water: 11, Iron: 0.5, Sugar: 2, CarbonDioxide: 3, Protein: 4 },
    { mixers: ["Centrifuge"] },
  ),
  // fun.yml
  rx(
    "Fresium",
    {
      Frezon: 3,
      Plasma: cat(1),
      Nitrogen: 2,
      Cryoxadone: 0.22,
      TableSalt: 0.08,
      Water: 1.5,
    },
    { Fresium: 5 },
    { maxTemp: 300, priority: 20 },
  ),
  rx("FlashFreezeIce", { Fresium: 1, Water: 1 }, { Ice: 5 }, { quantized: true }),
];

export const realData = (): CalcData =>
  data(realReactions, {
    dispensable: DISPENSABLE,
    mixers: [{ id: "Centrifuge", name: "centrifuge" }],
  });
