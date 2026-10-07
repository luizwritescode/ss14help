import servers from "@/generated/servers.json";

/** A server with a data snapshot, from servers.yaml plus its manifest (scripts/sync-data.mjs). */
export interface ServerInfo {
  id: string;
  name: string;
  repo: string;
  branch: string;
  sha: string;
  commitDate: string;
  generatedAt: string;
  schemaVersion: string;
  counts: Record<string, number>;
  warningCount: number;
}

export const SERVERS: ServerInfo[] = servers;
export const DEFAULT_SERVER = "upstream";
export const UPSTREAM = "upstream";

export function findServer(id: string): ServerInfo | undefined {
  return SERVERS.find((s) => s.id === id);
}

export const STALE_AFTER_DAYS = 14;

export function isStale(server: ServerInfo, now = Date.now()): boolean {
  return now - Date.parse(server.generatedAt) > STALE_AFTER_DAYS * 86_400_000;
}

export function commitUrl(server: ServerInfo): string {
  return `${server.repo.replace(/\/$/, "")}/commit/${server.sha}`;
}
