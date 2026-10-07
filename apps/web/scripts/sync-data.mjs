// Copies data/<server>/ snapshots into public/data/ (fetched by the browser) and writes
// src/generated/servers.json (server list + manifest summaries) for the app to import.
// Runs before dev, build, typecheck and tests; both outputs are gitignored.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse } from "yaml";

const repo = new URL("../../../", import.meta.url);
const dataDir = new URL("data/", repo);
const publicDir = new URL("../public/data/", import.meta.url);
const generatedDir = new URL("../src/generated/", import.meta.url);

const { servers } = parse(await readFile(new URL("servers.yaml", repo), "utf8"));
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await mkdir(generatedDir, { recursive: true });

const out = [];
for (const server of servers) {
  const src = new URL(`${server.id}/`, dataDir);
  if (!existsSync(new URL("manifest.json", src))) {
    console.warn(`sync-data: no snapshot for ${server.id}, skipping`);
    continue;
  }
  const manifest = JSON.parse(await readFile(new URL("manifest.json", src), "utf8"));
  const dest = new URL(`${server.id}/`, publicDir);
  await mkdir(dest, { recursive: true });
  for (const file of await readdir(src)) {
    if (file.endsWith(".json")) await cp(new URL(file, src), new URL(file, dest));
  }
  out.push({
    id: server.id,
    name: server.name,
    repo: server.repo,
    branch: server.branch,
    sha: manifest.sha,
    commitDate: manifest.commitDate,
    generatedAt: manifest.generatedAt,
    schemaVersion: manifest.schemaVersion,
    counts: manifest.counts,
    warningCount: manifest.warnings.length,
  });
}
await writeFile(new URL("servers.json", generatedDir), JSON.stringify(out, null, 2) + "\n");
console.log(`sync-data: ${out.map((s) => s.id).join(", ")}`);
