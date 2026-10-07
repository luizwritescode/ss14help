"use client";

/**
 * Per-viewer conveniences in localStorage (ROADMAP §3.3): pins, recents, last server, theme, UI
 * layout. Every access is wrapped: when storage is unavailable, values live in memory for the
 * session and `storageAvailable()` reports false.
 */
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "ss14help:";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available === null) {
    try {
      const probe = `${PREFIX}probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      available = true;
    } catch {
      available = false;
    }
  }
  return available;
}

function read(key: string): string | null {
  try {
    if (storageAvailable()) return window.localStorage.getItem(PREFIX + key);
  } catch {
    // fall through to memory
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (storageAvailable()) {
      if (value === null) window.localStorage.removeItem(PREFIX + key);
      else window.localStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // memory already updated
  }
  cache.delete(key);
  listeners.forEach((l) => l());
}

// useSyncExternalStore needs stable snapshots: parse once per stored string.
const cache = new Map<string, { raw: string | null; value: unknown }>();

export function getJSON<T>(key: string, fallback: T): T {
  const raw = read(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function setJSON(key: string, value: unknown): void {
  write(key, JSON.stringify(value));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) {
      cache.delete(e.key.slice(PREFIX.length));
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** A stored JSON value; renders `fallback` on the server and before hydration. */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => getJSON(key, fallback),
    () => fallback,
  );
  const set = useCallback((next: T) => setJSON(key, next), [key]);
  return [value, set];
}

// --- typed keys ------------------------------------------------------------------------------

export const keys = {
  lastServer: "lastServer",
  pins: (server: string) => `pins:${server}`,
  recent: (server: string) => `recent:${server}`,
  theme: "theme",
  ui: "ui",
} as const;

export const MAX_RECENT = 20;

export type ThemePreference = "system" | "dark" | "light";

export interface UiPrefs {
  sidebarCollapsed: boolean;
  panelWidth: number;
  expandedNodes: string[];
}

export const DEFAULT_UI: UiPrefs = {
  sidebarCollapsed: false,
  panelWidth: 440,
  expandedNodes: ["chemistry"],
};

const EMPTY: string[] = [];

export function usePins(server: string) {
  const [pins, setPins] = useStored<string[]>(keys.pins(server), EMPTY);
  const toggle = useCallback(
    (key: string) => setPins(pins.includes(key) ? pins.filter((p) => p !== key) : [...pins, key]),
    [pins, setPins],
  );
  const remove = useCallback(
    (key: string) => setPins(pins.filter((p) => p !== key)),
    [pins, setPins],
  );
  return { pins, toggle, remove };
}

export function useRecent(server: string) {
  const [recent, setRecent] = useStored<string[]>(keys.recent(server), EMPTY);
  const add = useCallback(
    (key: string) => {
      const current = getJSON<string[]>(keys.recent(server), EMPTY);
      if (current[0] === key) return;
      setJSON(keys.recent(server), [key, ...current.filter((r) => r !== key)].slice(0, MAX_RECENT));
    },
    [server],
  );
  const remove = useCallback(
    (key: string) => setRecent(recent.filter((r) => r !== key)),
    [recent, setRecent],
  );
  return { recent, add, remove };
}
