/**
 * Calculator engine for ss14help: turns "N u of reagent X" (or "N of item Y") into basic
 * ingredients, catalysts, leftovers, an ingredient tree and ordered steps. Pure TypeScript, no UI.
 *
 *   const graph = new RecipeGraph({ recipes, reagents, entities, sources }); // once per server
 *   const result = plan(graph, { kind: "reagent", id: "Bicaridine" }, 30);
 */
export { formatAmount, kelvinToCelsius } from "./format";
export {
  type CalcData,
  catalystsOf,
  type Consumers,
  consumedInputs,
  isPrimaryProduct,
  type NodeKind,
  nodeKey,
  type NodeRef,
  type Producer,
  RecipeGraph,
  type SourceHint,
  yieldOf,
} from "./graph";
export {
  type Amount,
  type BasicIngredient,
  type CatalystNeed,
  type Credit,
  type LeafReason,
  type Leftover,
  plan,
  type Plan,
  type PlanNode,
  type PlanOptions,
  type Step,
} from "./plan";
export { Q } from "./rational";

export const CALC_ENGINE_VERSION = "1.0.0";
