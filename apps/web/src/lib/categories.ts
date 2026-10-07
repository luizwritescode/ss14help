/** Labels for category ids that title-casing gets wrong. Unknown ids are title-cased. */
const LABELS: Record<string, string> = {
  single_reagent: "Single reagent",
  pyrotechnic: "Pyrotechnics",
  fun: "Fun",
  gas: "Gases",
  biological: "Biological",
  botany: "Botany",
  IceCreamMaker: "Ice cream maker",
  grind: "Grindable",
  juice: "Juiceable",
  misc: "Misc",
};

export function categoryLabel(id: string): string {
  if (LABELS[id]) return LABELS[id];
  const words = id
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
