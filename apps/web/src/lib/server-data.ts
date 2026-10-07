/**
 * Build-time access to snapshots (server components, generateStaticParams, metadata). Reads the
 * copies in public/data written by scripts/sync-data.mjs, and refuses data whose schema major
 * version this build doesn't understand.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertCompatibleSchemaVersion } from "@ss14help/schema";
import { cacheLife } from "next/cache";
import { SNAPSHOT_FILES, type SnapshotFiles } from "./model";

export async function readSnapshot(server: string): Promise<SnapshotFiles> {
  "use cache";
  cacheLife("max");
  const dir = join(process.cwd(), "public", "data", server);
  const entries = await Promise.all(
    Object.entries(SNAPSHOT_FILES).map(async ([key, file]) => [
      key,
      JSON.parse(await readFile(join(dir, file), "utf8")),
    ]),
  );
  const files = Object.fromEntries(entries) as SnapshotFiles;
  assertCompatibleSchemaVersion(files.manifest.schemaVersion, server);
  return files;
}

/** Ids that get a statically generated page: every reagent and every cooked item. */
export async function subjectIds(server: string): Promise<{ reagents: string[]; items: string[] }> {
  "use cache";
  cacheLife("max");
  const files = await readSnapshot(server);
  return {
    reagents: files.reagents.reagents.map((r) => r.id),
    items: [...new Set(files.recipes.cooking.map((c) => c.result))],
  };
}
