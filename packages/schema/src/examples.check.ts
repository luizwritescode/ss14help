// Compile-time check that the hand-written examples in schema/examples match the generated types.
// `pnpm typecheck` fails if the contract and the examples drift apart.
import entities from "../../../schema/examples/entities.json";
import manifest from "../../../schema/examples/manifest.json";
import reagents from "../../../schema/examples/reagents.json";
import recipes from "../../../schema/examples/recipes.json";
import sources from "../../../schema/examples/sources.json";
import type { DataFiles } from "./index";

export const examples: DataFiles = {
  "manifest.json": manifest,
  "reagents.json": reagents,
  "entities.json": entities,
  "recipes.json": recipes,
  "sources.json": sources,
};
