"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { type Subject, subjectPath } from "@/lib/subjects";
import {
  MAX_STACK,
  parseParams,
  serializeParams,
  type Tab,
  type WorkspaceParams,
} from "@/lib/url-state";

export interface WorkspaceActions {
  /** Open from the list, palette or sidebar: resets the stack. */
  open(subject: Subject, options?: { via?: string | null; tab?: Tab; amt?: number | null }): void;
  /** Drill into a link inside the panel: pushes onto the stack. */
  push(subject: Subject): void;
  pop(): void;
  /** Breadcrumb click: keep the stack up to and including index `i`. */
  truncate(i: number): void;
  close(): void;
  setTab(tab: Tab): void;
  setVia(recipeId: string | null): void;
  setVariant(id: string, recipeId: string | null): void;
  setAmount(amount: number | null): void;
  toggleOwned(id: string): void;
  setCategory(path: string): void;
  setQuery(q: string): void;
  toggleFilter(filter: string): void;
  clearFilters(): void;
}

/**
 * URL-backed workspace state. Updates go through history.pushState/replaceState, which Next.js
 * syncs into useSearchParams without a server round trip. Panel navigation pushes (so Back works);
 * typing, tabs and amounts replace.
 */
export function useWorkspaceState(server: string, initial?: Subject) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const params = useMemo(() => {
    const parsed = parseParams(new URLSearchParams(searchParams.toString()));
    // On a statically generated subject page, the path is the open subject.
    const initialPath = initial ? subjectPath(server, initial) : null;
    if (
      !parsed.open.length &&
      initial &&
      initialPath &&
      decodeURI(pathname) === decodeURI(initialPath)
    ) {
      parsed.open = [initial];
    }
    return parsed;
  }, [searchParams, pathname, server, initial]);

  // Actions read the latest params through a ref so their identities stay stable.
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  }, [params]);

  const commit = useCallback(
    (change: (p: WorkspaceParams) => WorkspaceParams, mode: "push" | "replace") => {
      const next = change(latest.current);
      latest.current = next;
      const qs = serializeParams(next);
      const url = `/${server}${qs ? `?${qs}` : ""}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [server],
  );

  const actions = useMemo<WorkspaceActions>(
    () => ({
      open: (subject, options = {}) =>
        commit(
          (p) => ({
            ...p,
            open: [subject],
            via: options.via ?? null,
            tab: options.tab ?? (p.tab === "sources" ? "recipe" : p.tab),
            amt: options.amt ?? null,
            owned: [],
            variants: {},
          }),
          "push",
        ),
      push: (subject) =>
        commit(
          (p) => ({
            ...p,
            open: [...p.open, subject].slice(-MAX_STACK),
            via: null,
            tab: p.tab === "sources" ? "recipe" : p.tab,
            amt: null,
            owned: [],
          }),
          "push",
        ),
      pop: () => commit((p) => ({ ...p, open: p.open.slice(0, -1), via: null, amt: null }), "push"),
      truncate: (i) =>
        commit((p) => ({ ...p, open: p.open.slice(0, i + 1), via: null, amt: null }), "push"),
      close: () => commit((p) => ({ ...p, open: [], via: null, amt: null, owned: [] }), "push"),
      setTab: (tab) => commit((p) => ({ ...p, tab }), "replace"),
      setVia: (via) => commit((p) => ({ ...p, via }), "replace"),
      setVariant: (id, recipeId) =>
        commit((p) => {
          const variants = { ...p.variants };
          if (recipeId) variants[id] = recipeId;
          else delete variants[id];
          return { ...p, variants };
        }, "replace"),
      setAmount: (amt) => commit((p) => ({ ...p, amt }), "replace"),
      toggleOwned: (id) =>
        commit(
          (p) => ({
            ...p,
            owned: p.owned.includes(id) ? p.owned.filter((o) => o !== id) : [...p.owned, id],
          }),
          "replace",
        ),
      setCategory: (cat) => commit((p) => ({ ...p, cat, q: "" }), "push"),
      setQuery: (q) => commit((p) => ({ ...p, q }), "replace"),
      toggleFilter: (f) =>
        commit(
          (p) => ({
            ...p,
            filters: p.filters.includes(f) ? p.filters.filter((x) => x !== f) : [...p.filters, f],
          }),
          "replace",
        ),
      clearFilters: () => commit((p) => ({ ...p, filters: [], q: "" }), "replace"),
    }),
    [commit],
  );

  return { params, actions };
}
