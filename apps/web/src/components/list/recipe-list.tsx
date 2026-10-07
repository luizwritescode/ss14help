"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownAZ, ChefHat, Search, SignalLow, Sprout, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { cn, ConditionIcon, IconButton, ServerOnlyBadge } from "@/components/ui/primitives";
import { SubjectIcon } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import { filterItems, type ListItem, matchesFilter } from "@/lib/model";
import { cookingIngredients, ingredientSummary, reactionIngredients } from "@/lib/recipe-text";
import { formatAmount } from "@ss14help/calc";
import { sameSubject, subjectKey, toNode } from "@/lib/subjects";
import { UPSTREAM } from "@/lib/servers";
import { useMediaQuery } from "@/lib/hooks";

type Sort = "name" | "simplest";

const BASE_FILTERS = [
  { id: "heat", label: "Heat" },
  { id: "cold", label: "Cold" },
  { id: "catalyst", label: "Catalyst" },
] as const;

/** The center pane (§3.4 RecipeList). */
export function RecipeList() {
  const { model, params, actions, server, top, togglePin } = useWorkspace();
  const node = model.node(params.cat) ?? model.categories[0]!;
  const [query, setQuery] = useState(params.q);
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<Sort>("name");

  // URL ← input, debounced (replace).
  useEffect(() => {
    if (query === params.q) return;
    const t = setTimeout(() => actions.setQuery(query), 250);
    return () => clearTimeout(t);
  }, [query, params.q, actions]);
  // Input ← URL when navigating (e.g. category change clears q).
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setQuery(params.q);
  }

  const items = useMemo(() => {
    const filtered = filterItems(model, node.items, deferredQuery, params.filters);
    if (sort === "simplest") {
      const steps = (i: ListItem) => {
        const node = toNode(i.subject);
        return node && (i.kind === "reaction" || i.kind === "cooking")
          ? model.graph.stepCount(node)
          : 0;
      };
      return [...filtered].sort((a, b) => steps(a) - steps(b) || a.name.localeCompare(b.name));
    }
    return filtered;
  }, [model, node, deferredQuery, params.filters, sort]);

  const mixerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of node.items)
      if (i.kind === "reaction") i.reaction.mixers.forEach((m) => ids.add(m));
    return [...ids].sort();
  }, [node]);

  const filterAvailable = (f: string) => node.items.some((i) => matchesFilter(model, i, f));
  const filterChips = [
    ...BASE_FILTERS.filter((f) => filterAvailable(f.id)),
    ...(server.id !== UPSTREAM && filterAvailable("serverOnly")
      ? [{ id: "serverOnly", label: `${server.name} only` }]
      : []),
  ];

  // --- virtual list + roving focus ------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowHeight = useRowHeight();
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const [focusIndex, setFocusIndex] = useState(0);
  const activeIndex = items.findIndex((i) => sameSubject(i.subject, top));

  // Scroll the open subject into view when it was opened from elsewhere.
  useEffect(() => {
    if (activeIndex >= 0) virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [activeIndex, virtualizer]);

  // Category change → back to top (not on first render, where the open subject is shown).
  const [shownCat, setShownCat] = useState(params.cat);
  if (shownCat !== params.cat) {
    setShownCat(params.cat);
    setFocusIndex(0);
  }
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
  }, [params.cat]);

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    setFocusIndex(clamped);
    virtualizer.scrollToIndex(clamped, { align: "auto" });
    requestAnimationFrame(() =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.focus(),
    );
  };

  const openItem = (item: ListItem) => {
    if (item.kind === "reaction") {
      const { subject, via } = model.reactionTarget(item.reaction);
      actions.open(subject, { via });
    } else if (item.kind === "cooking") {
      actions.open(item.subject, { via: item.recipe.id });
    } else {
      actions.open(item.subject);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const item = items[focusIndex];
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      focusRow(focusIndex + 1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      focusRow(focusIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusRow(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusRow(items.length - 1);
    } else if (e.key === "Enter" && item) {
      e.preventDefault();
      openItem(item);
    } else if (e.key === "p" && item) {
      e.preventDefault();
      togglePin(item.subject);
    }
  };

  const filtered = deferredQuery.trim() !== "" || params.filters.length > 0;

  return (
    <section aria-label={`${node.label} list`} className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 truncate text-sm font-semibold">
            {breadcrumb(model, params.cat)}
          </h1>
          <span className="shrink-0 text-xs text-fg-muted tabular">
            {filtered ? `${items.length} / ${node.items.length}` : node.items.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <IconButton label={`Sort: ${sort === "name" ? "name A–Z" : "simplest first"}`}>
                  {sort === "name" ? (
                    <ArrowDownAZ className="size-4" />
                  ) : (
                    <SignalLow className="size-4" />
                  )}
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 rounded-md border border-line bg-elevated p-1 text-sm shadow-panel"
                >
                  <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
                    {(
                      [
                        ["name", "Name A–Z"],
                        ["simplest", "Simplest first"],
                      ] as const
                    ).map(([value, label]) => (
                      <DropdownMenu.RadioItem
                        key={value}
                        value={value}
                        className="cursor-pointer rounded px-2 py-1 outline-none data-[highlighted]:bg-hover data-[state=checked]:text-accent"
                      >
                        {label}
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-line bg-elevated px-2 focus-within:border-accent">
          <Search aria-hidden className="size-3.5 text-fg-faint" />
          <span className="sr-only">Filter this list</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${node.label.toLowerCase()}…`}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-faint"
          />
          {query && (
            <button type="button" aria-label="Clear filter text" onClick={() => setQuery("")}>
              <X className="size-3.5 text-fg-faint" />
            </button>
          )}
        </label>
        {(filterChips.length > 0 || mixerIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
            {filterChips.map((f) => (
              <FilterChip
                key={f.id}
                label={f.label}
                active={params.filters.includes(f.id)}
                onClick={() => actions.toggleFilter(f.id)}
              />
            ))}
            {mixerIds.map((m) => (
              <FilterChip
                key={m}
                label={model.mixerName(m)}
                active={params.filters.includes(`mixer:${m}`)}
                onClick={() => actions.toggleFilter(`mixer:${m}`)}
              />
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-fg-muted">
          <p>Nothing matches these filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              actions.clearFilters();
            }}
            className="rounded-md border border-line px-3 py-1.5 text-fg hover:bg-hover"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          aria-label={node.label}
          onKeyDown={onKeyDown}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const item = items[v.index]!;
              return (
                <Row
                  key={item.key}
                  item={item}
                  index={v.index}
                  setSize={items.length}
                  start={v.start}
                  height={v.size}
                  active={v.index === activeIndex}
                  tabbable={v.index === focusIndex}
                  onFocus={() => setFocusIndex(v.index)}
                  onOpen={() => openItem(item)}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function breadcrumb(model: ReturnType<typeof useWorkspace>["model"], path: string): string {
  const parts = path.split("/");
  return parts
    .map((_, i) => model.node(parts.slice(0, i + 1).join("/"))?.label)
    .filter(Boolean)
    .join(" › ");
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-accent bg-accent-soft text-fg"
          : "border-line text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function useRowHeight(): number {
  return useMediaQuery("(pointer: coarse)") ? 52 : 40;
}

function Row({
  item,
  index,
  setSize,
  start,
  height,
  active,
  tabbable,
  onFocus,
  onOpen,
}: {
  item: ListItem;
  index: number;
  setSize: number;
  start: number;
  height: number;
  active: boolean;
  tabbable: boolean;
  onFocus: () => void;
  onOpen: () => void;
}) {
  const { model, server } = useWorkspace();
  let summary = "";
  const icons: { variant: Parameters<typeof ConditionIcon>[0]["variant"]; label: string }[] = [];
  let serverOnly = false;
  let lead = <SubjectIcon subject={item.subject} />;

  if (item.kind === "reaction") {
    const r = item.reaction;
    summary = reactionIngredients(model, r);
    if (r.minTemp !== null)
      icons.push({ variant: "heat", label: `needs ≥ ${formatAmount(r.minTemp)} K` });
    if (r.maxTemp !== null)
      icons.push({ variant: "cold", label: `needs ≤ ${formatAmount(r.maxTemp)} K` });
    if (r.mixers.length)
      icons.push({
        variant: "mixer",
        label: `mixer: ${r.mixers.map((m) => model.mixerName(m)).join(" + ")}`,
      });
    if (Object.values(r.reactants).some((x) => x.catalyst))
      icons.push({ variant: "catalyst", label: "has a catalyst" });
    serverOnly = r.serverOnly;
  } else if (item.kind === "cooking") {
    const c = item.recipe;
    summary = cookingIngredients(model, c);
    lead = <ChefHat aria-hidden className="size-3.5 shrink-0 text-fg-muted" />;
    icons.push({ variant: "time", label: c.time ? `${c.time} s` : "instant" });
    serverOnly = c.serverOnly;
  } else if (item.kind === "reagent") {
    summary = [
      item.reagent.group,
      model.graph.isBasic({ kind: "reagent", id: item.reagent.id }) ? "basic" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    serverOnly = item.reagent.serverOnly;
  } else {
    const s = item.source;
    lead = <Sprout aria-hidden className="size-3.5 shrink-0 text-fg-muted" />;
    const yields = { ...(s.juice ?? {}), ...(s.grind ?? {}) };
    summary =
      "→ " +
      ingredientSummary(
        Object.entries(yields).map(
          ([id, n]) => `${formatAmount(n)}u ${model.name({ kind: "reagent", id })}`,
        ),
      );
    serverOnly = model.serverOnly(item.subject);
  }

  return (
    <div
      role="option"
      aria-selected={active}
      aria-setsize={setSize}
      aria-posinset={index + 1}
      data-index={index}
      data-subject={subjectKey(item.subject)}
      tabIndex={tabbable ? 0 : -1}
      onFocus={onFocus}
      onClick={onOpen}
      style={{ transform: `translateY(${start}px)`, height }}
      className={cn(
        "absolute inset-x-0 top-0 flex cursor-pointer items-center gap-2.5 border-l-2 px-3 text-sm outline-none sm:px-4",
        active ? "border-accent bg-accent-soft" : "border-transparent hover:bg-hover/70",
        "focus-visible:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent",
      )}
    >
      {lead}
      <span className="min-w-0 shrink-0 basis-2/5 truncate font-medium">{item.name}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{summary}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {icons.map((i) => (
          <ConditionIcon key={i.variant} variant={i.variant} label={i.label} />
        ))}
        {serverOnly && <ServerOnlyBadge server={server.name} />}
      </span>
    </div>
  );
}
