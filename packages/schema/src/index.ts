/**
 * The ss14help data contract for TypeScript. Types are generated from the pipeline's Pydantic
 * models (pipeline/src/ss14help_pipeline/models.py); regenerate with `pnpm --filter
 * @ss14help/schema generate` after `uv run ss14help-pipeline schema`.
 */
export type * from "./generated/types";
export { SCHEMA_VERSION } from "./generated/version";

import { SCHEMA_VERSION } from "./generated/version";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function major(version: string): number {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`not a semver version: "${version}"`);
  return Number(match[1]);
}

/** Data is readable when its schema major version equals the one this code was built against. */
export function isCompatibleSchemaVersion(dataVersion: string): boolean {
  return major(dataVersion) === major(SCHEMA_VERSION);
}

/** Throws with a clear message when a snapshot can't be read by this build. Use at build time. */
export function assertCompatibleSchemaVersion(dataVersion: string, server = "unknown"): void {
  if (!isCompatibleSchemaVersion(dataVersion)) {
    throw new Error(
      `data/${server} uses schema ${dataVersion}, but this build expects ${SCHEMA_VERSION}. ` +
        "Update the frontend for the new major version before deploying this data.",
    );
  }
}
