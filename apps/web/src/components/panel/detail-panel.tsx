"use client";

import { ArrowLeft, MoreHorizontal, SearchX, X } from "lucide-react";
import { DropdownMenu, Tabs } from "radix-ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn, IconButton, ServerOnlyBadge } from "@/components/ui/primitives";
import { CopyButton, PinButton, SubjectIcon, useSubjectSummary } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import { loadModel } from "@/lib/client-data";
import { categoryLabel } from "@/lib/categories";
import { search } from "@/lib/model";
import { SERVERS } from "@/lib/servers";
import { type Subject, subjectKey } from "@/lib/subjects";
import type { Tab } from "@/lib/url-state";
import { CalcTab } from "./calc-tab";
import { RecipeTab } from "./recipe-tab";
import { TreeTab } from "./tree-tab";
import { SourcesTab, UsedInTab, usedInCount } from "./used-in-tab";

/** Which tabs a subject has; empty tabs are hidden, not shown empty (§3.4 Tabs). */
export function availableTabs(model: ReturnType<typeof useWorkspace>["model"], s: Subject): Tab[] {
  if (s.kind === "reaction") return ["recipe"];
  const tabs: Tab[] = ["recipe", "tree", "calc", "used"];
  if (s.kind === "item" && model.sources.has(s.id)) tabs.push("sources");
  return tabs;
}

const TAB_LABEL: Record<Tab, string> = {
  recipe: "Recipe",
  tree: "Tree",
  calc: "Calculator",
  used: "Used in",
  sources: "Sources",
};

/** The panel's content: header, breadcrumbs and tabs for the top of the stack. */
export function DetailPanel({ subject }: { subject: Subject }) {
  const { model, params, actions, server } = useWorkspace();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const key = subjectKey(subject);

  // Move focus to the title whenever the shown subject changes (§3.7).
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [key]);

  if (!model.exists(subject)) return <NotFound subject={subject} />;

  const tabs = availableTabs(model, subject);
  const tab = tabs.includes(params.tab) ? params.tab : "recipe";
  const name = model.name(subject);
  const color = model.color(subject);
  const reagent = subject.kind === "reagent" ? model.reagents.get(subject.id) : undefined;
  const meta =
    subject.kind === "reagent"
      ? [reagent?.group, reagent?.physicalDesc].filter(Boolean).join(" · ")
      : subject.kind === "reaction"
        ? categoryLabel(model.reactions.get(subject.id)?.category ?? "")
        : "item";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.matches("input, select, textarea")) return;
    const n = Number(e.key);
    if (n >= 1 && n <= tabs.length && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      actions.setTab(tabs[n - 1]!);
    } else if (
      (e.key === "Backspace" || (e.altKey && e.key === "ArrowLeft")) &&
      params.open.length > 1
    ) {
      e.preventDefault();
      actions.pop();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <div
        aria-hidden
        className="h-[3px] shrink-0"
        style={{ background: color ?? "var(--accent)" }}
      />
      <header className="shrink-0 space-y-2 border-b border-line px-4 pb-3 pt-2">
        <Breadcrumbs />
        <div className="flex items-start gap-2">
          <span className="mt-1.5">
            <SubjectIcon subject={subject} size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              ref={titleRef}
              tabIndex={-1}
              className="truncate text-lg font-semibold leading-7 outline-none"
            >
              {name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
              {name.toLowerCase() !== subject.id.toLowerCase() && (
                <span className="font-mono">{subject.id}</span>
              )}
              {meta && <span>{meta}</span>}
              {model.serverOnly(subject) && <ServerOnlyBadge server={server.name} />}
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <PinButton subject={subject} />
            <CopyRecipe subject={subject} />
            <IconButton label="Close panel (Esc)" onClick={actions.close}>
              <X aria-hidden className="size-4" />
            </IconButton>
          </div>
        </div>
      </header>

      <Tabs.Root
        value={tab}
        onValueChange={(v) => actions.setTab(v as Tab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label="Details"
          className="flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-3"
        >
          {tabs.map((t, i) => {
            const count = t === "used" ? usedInCount(model, subject) : null;
            return (
              <Tabs.Trigger
                key={t}
                value={t}
                title={`${TAB_LABEL[t]} (${i + 1})`}
                className="relative whitespace-nowrap px-2 py-2.5 text-sm text-fg-muted transition-colors hover:text-fg data-[state=active]:text-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-1 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-accent"
              >
                {TAB_LABEL[t]}
                {count ? <span className="ml-1 text-xs text-fg-faint">{count}</span> : null}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <Tabs.Content value="recipe">
            <RecipeTab key={key} subject={subject} />
          </Tabs.Content>
          {tabs.includes("tree") && (
            <Tabs.Content value="tree">
              <TreeTab key={key} subject={subject} />
            </Tabs.Content>
          )}
          {tabs.includes("calc") && (
            <Tabs.Content value="calc">
              <CalcTab key={key} subject={subject} />
            </Tabs.Content>
          )}
          {tabs.includes("used") && (
            <Tabs.Content value="used">
              <UsedInTab subject={subject} />
            </Tabs.Content>
          )}
          {tabs.includes("sources") && (
            <Tabs.Content value="sources">
              <SourcesTab subject={subject} />
            </Tabs.Content>
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}

function CopyRecipe({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  const summary = useSubjectSummary(subject);
  if (!summary) return null;
  return <CopyButton text={`${model.name(subject)}: ${summary}`} label="Copy recipe as text" />;
}

/** One crumb per stack entry; the last 3 shown, earlier ones in an overflow menu. */
function Breadcrumbs() {
  const { params, model, actions } = useWorkspace();
  const stack = params.open;
  if (stack.length < 2) return <div className="h-6" />;
  const hidden = stack.slice(0, -3);
  const shown = stack.slice(-3);
  const offset = stack.length - shown.length;
  return (
    <nav
      aria-label="Panel history"
      className="flex h-6 min-w-0 items-center gap-1 text-xs text-fg-muted"
    >
      <IconButton label="Back (Backspace)" className="size-6" onClick={actions.pop}>
        <ArrowLeft aria-hidden className="size-3.5" />
      </IconButton>
      {hidden.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label="Earlier entries" className="size-6">
              <MoreHorizontal aria-hidden className="size-3.5" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="z-50 rounded-md border border-line bg-elevated p-1 text-sm shadow-panel">
              {hidden.map((s, i) => (
                <DropdownMenu.Item
                  key={`${subjectKey(s)}-${i}`}
                  onSelect={() => actions.truncate(i)}
                  className="cursor-pointer rounded px-2 py-1 outline-none data-[highlighted]:bg-hover"
                >
                  {model.name(s)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      <ol className="flex min-w-0 items-center gap-1">
        {shown.map((s, i) => {
          const index = offset + i;
          const last = index === stack.length - 1;
          return (
            <li key={`${subjectKey(s)}-${index}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <span aria-hidden>›</span>}
              {last ? (
                <span aria-current="page" className="truncate text-fg">
                  {model.name(s)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => actions.truncate(index)}
                  className="truncate hover:text-fg"
                >
                  {model.name(s)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** §3.8: unknown subject (removed, or from another server). */
function NotFound({ subject }: { subject: Subject }) {
  const { model, server, actions } = useWorkspace();
  const suggestions = search(model, subject.id, 5);
  const [elsewhere, setElsewhere] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all(
      SERVERS.filter((s) => s.id !== server.id).map(async (s) =>
        (await loadModel(s.id)).exists(subject) ? s : null,
      ),
    ).then(
      (found) => alive && setElsewhere(found.filter(Boolean).map((s) => s!.id)),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [subject, server.id]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <SearchX aria-hidden className="size-8 text-fg-faint" />
        <IconButton label="Close panel" onClick={actions.close}>
          <X aria-hidden className="size-4" />
        </IconButton>
      </div>
      <h2 className="text-lg font-semibold">
        <span className="font-mono">{subject.id}</span> isn&apos;t on {server.name}
      </h2>
      {elsewhere.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {elsewhere.map((id) => (
            <a
              key={id}
              href={`/${id}?open=${subjectKey(subject)}`}
              className="rounded-md border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent-soft"
            >
              Open on {SERVERS.find((s) => s.id === id)?.name}
            </a>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-fg-muted">Did you mean</p>
          <ul className="space-y-1">
            {suggestions.map((h) => (
              <li key={`${h.kind}:${h.id}`}>
                <button
                  type="button"
                  onClick={() => actions.open({ kind: h.kind, id: h.id })}
                  className={cn("text-sm underline underline-offset-4 hover:text-accent")}
                >
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
