"use client";

import { assertCompatibleSchemaVersion } from "@ss14help/schema";
import { useEffect, useState } from "react";
import { ServerModel, SNAPSHOT_FILES, type SnapshotFiles } from "./model";

const models = new Map<string, Promise<ServerModel>>();

/** Fetches a server's snapshot from /data/<server>/ (copied by scripts/sync-data.mjs) once. */
export function loadModel(server: string): Promise<ServerModel> {
  let pending = models.get(server);
  if (!pending) {
    pending = (async () => {
      const entries = await Promise.all(
        Object.entries(SNAPSHOT_FILES).map(async ([key, file]) => {
          const res = await fetch(`/data/${server}/${file}`);
          if (!res.ok) throw new Error(`could not load ${file} for ${server} (${res.status})`);
          return [key, await res.json()] as const;
        }),
      );
      const files = Object.fromEntries(entries) as unknown as SnapshotFiles;
      assertCompatibleSchemaVersion(files.manifest.schemaVersion, server);
      return new ServerModel(files);
    })();
    pending.catch(() => models.delete(server));
    models.set(server, pending);
  }
  return pending;
}

export type ModelState =
  | { status: "loading"; model: null; error: null }
  | { status: "ready"; model: ServerModel; error: null }
  | { status: "error"; model: null; error: Error };

export function useModel(server: string): ModelState {
  const [state, setState] = useState<{ server: string; result: ModelState }>({
    server,
    result: { status: "loading", model: null, error: null },
  });
  useEffect(() => {
    let alive = true;
    loadModel(server).then(
      (model) => alive && setState({ server, result: { status: "ready", model, error: null } }),
      (error: Error) =>
        alive && setState({ server, result: { status: "error", model: null, error } }),
    );
    return () => {
      alive = false;
    };
  }, [server]);
  return state.server === server ? state.result : { status: "loading", model: null, error: null };
}
