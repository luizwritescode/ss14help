/** Plain-text renderings of recipes: list-row summaries, hover cards, "copy as text". */
import { formatAmount } from "@ss14help/calc";
import type { CookingRecipe, Reaction } from "@ss14help/schema";
import type { ServerModel } from "./model";

const reagentName = (model: ServerModel, id: string) => model.name({ kind: "reagent", id });
const itemName = (model: ServerModel, id: string) => model.name({ kind: "item", id });

/** "inaprovaline + carbon" (+N), catalysts excluded — for list rows. */
export function ingredientSummary(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(" + ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

export function reactionIngredients(model: ServerModel, r: Reaction): string {
  const names = Object.entries(r.reactants)
    .filter(([, x]) => !x.catalyst)
    .map(([id]) => reagentName(model, id));
  return ingredientSummary(names);
}

export function cookingIngredients(model: ServerModel, c: CookingRecipe): string {
  const names = [
    ...Object.keys(c.solids).map((id) => itemName(model, id)),
    ...Object.keys(c.reagents).map((id) => reagentName(model, id)),
  ];
  return ingredientSummary(names);
}

/** `Bicaridine: 1u inaprovaline + 1u carbon (catalyst: 1u plasma), ≥370 K, centrifuge → 2u bicaridine` */
export function reactionText(model: ServerModel, r: Reaction): string {
  const inputs = Object.entries(r.reactants)
    .filter(([, x]) => !x.catalyst)
    .map(([id, x]) => `${formatAmount(x.amount)}u ${reagentName(model, id)}`)
    .join(" + ");
  const catalysts = Object.entries(r.reactants)
    .filter(([, x]) => x.catalyst)
    .map(([id, x]) => `${formatAmount(x.amount)}u ${reagentName(model, id)}`);
  const products = Object.entries(r.products)
    .map(([id, n]) => `${formatAmount(n)}u ${reagentName(model, id)}`)
    .join(" + ");
  const parts = [inputs + (catalysts.length ? ` (catalyst: ${catalysts.join(", ")})` : "")];
  if (r.minTemp !== null) parts.push(`≥${formatAmount(r.minTemp)} K`);
  if (r.maxTemp !== null) parts.push(`≤${formatAmount(r.maxTemp)} K`);
  if (r.mixers.length) parts.push(r.mixers.map((m) => model.mixerName(m)).join(" + "));
  if (r.quantized) parts.push("whole batches");
  return `${parts.join(", ")} → ${products || "(effects only)"}`;
}

export function cookingText(model: ServerModel, c: CookingRecipe): string {
  const inputs = [
    ...Object.entries(c.solids).map(([id, n]) => `${n}× ${itemName(model, id)}`),
    ...Object.entries(c.reagents).map(([id, n]) => `${formatAmount(n)}u ${reagentName(model, id)}`),
  ].join(" + ");
  const time = c.time ? ` for ${formatAmount(c.time)} s` : "";
  return `${c.device}: ${inputs}${time} → 1× ${itemName(model, c.result)}`;
}
