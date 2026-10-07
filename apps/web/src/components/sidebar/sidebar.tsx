"use client";

import {
  ChevronDown,
  ChevronRight,
  FlaskConical,
  History,
  Star,
  Utensils,
  Droplets,
  Sprout,
  X,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { cn } from "@/components/ui/primitives";
import { SubjectIcon } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import type { CategoryNode } from "@/lib/model";
import { DEFAULT_UI, type UiPrefs, useStored, keys } from "@/lib/storage";
import { parseSubject, sameSubject, type Subject } from "@/lib/subjects";

const ROOT_ICONS: Record<string, typeof FlaskConical> = {
  chemistry: FlaskConical,
  cooking: Utensils,
  reagents: Droplets,
  sources: Sprout,
};

const RECENT_SHOWN = 8;

/** Pinned, Recent and the category tree (§3.4 Sidebar). */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pins, recent, removePin, removeRecent } = useWorkspace();
  return (
    <nav aria-label="Browse" className="flex h-full min-h-0 flex-col">
      <SubjectSection
        title="Pinned"
        icon={<Star aria-hidden className="size-3.5" />}
        keys={pins}
        empty={
          <>
            Pin recipes with <Star aria-label="the star button" className="inline size-3" /> or{" "}
            <kbd className="font-mono">p</kbd>.
          </>
        }
        onRemove={removePin}
        removeLabel="Unpin"
        onNavigate={onNavigate}
      />
      <SubjectSection
        title="Recent"
        icon={<History aria-hidden className="size-3.5" />}
        keys={recent.slice(0, RECENT_SHOWN)}
        empty="Recipes you open show up here."
        onRemove={removeRecent}
        removeLabel="Remove from recent"
        onNavigate={onNavigate}
      />
      <CategoryTree onNavigate={onNavigate} />
      <AttributionFooter />
    </nav>
  );
}

/** Always-visible credit line: unofficial project, data source, and the About dialog. */
function AttributionFooter() {
  const { server, openAbout } = useWorkspace();
  return (
    <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-snug text-fg-faint">
      Unofficial fan project. Data from{" "}
      <a
        href={server.repo}
        target="_blank"
        rel="noreferrer"
        className="hover:text-fg-muted hover:underline"
      >
        {server.name}
      </a>
      , under its own license.{" "}
      <button type="button" onClick={openAbout} className="text-accent hover:underline">
        About & licenses
      </button>
    </div>
  );
}

function SubjectSection({
  title,
  icon,
  keys: entries,
  empty,
  onRemove,
  removeLabel,
  onNavigate,
}: {
  title: string;
  icon: ReactNode;
  keys: string[];
  empty: ReactNode;
  onRemove: (key: string) => void;
  removeLabel: string;
  onNavigate?: () => void;
}) {
  const { model, actions, top } = useWorkspace();
  const [open, setOpen] = useState(true);
  const subjects = entries
    .map((k) => [k, parseSubject(k)] as const)
    .filter((e): e is readonly [string, Subject] => e[1] !== null);
  return (
    <section className="shrink-0 border-b border-line px-2 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted hover:text-fg"
      >
        {icon}
        {title}
        {open ? (
          <ChevronDown className="ml-auto size-3.5" />
        ) : (
          <ChevronRight className="ml-auto size-3.5" />
        )}
      </button>
      {open &&
        (subjects.length === 0 ? (
          <p className="px-1 py-1 text-xs text-fg-faint">{empty}</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto">
            {subjects.map(([key, s]) => {
              const exists = model.exists(s);
              return (
                <li key={key} className="group flex items-center">
                  <button
                    type="button"
                    disabled={!exists}
                    onClick={() => {
                      actions.open(s);
                      onNavigate?.();
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-hover",
                      sameSubject(s, top) && "bg-accent-soft",
                      !exists && "cursor-default opacity-50",
                    )}
                  >
                    {exists && <SubjectIcon subject={s} />}
                    <span className="truncate">{exists ? model.name(s) : s.id}</span>
                    {!exists && (
                      <span className="shrink-0 text-[10px] text-fg-faint">
                        Not in current data
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`${removeLabel}: ${exists ? model.name(s) : s.id}`}
                    onClick={() => onRemove(key)}
                    className="rounded p-1 text-fg-faint opacity-0 hover:text-fg focus:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

/** ARIA tree of categories with counts (§3.4 CategoryTree). */
function CategoryTree({ onNavigate }: { onNavigate?: () => void }) {
  const { model, params } = useWorkspace();
  const [ui, setUi] = useStored<UiPrefs>(keys.ui, DEFAULT_UI);
  const expanded = new Set(ui.expandedNodes);
  // Always show the selected node's ancestors.
  const parts = params.cat.split("/");
  for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join("/"));

  const toggle = (path: string) => {
    const next = new Set(ui.expandedNodes);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setUi({ ...ui, expandedNodes: [...next] });
  };

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <ul role="tree" aria-label="Categories">
        {model.categories.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  toggle,
  onNavigate,
}: {
  node: CategoryNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  onNavigate?: () => void;
}) {
  const { params, actions } = useWorkspace();
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && expanded.has(node.path);
  const selected = params.cat === node.path;
  const Icon = depth === 0 ? ROOT_ICONS[node.path] : null;

  const select = () => {
    actions.setCategory(node.path);
    onNavigate?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" && hasChildren && !isOpen) {
      e.preventDefault();
      toggle(node.path);
    } else if (e.key === "ArrowLeft" && isOpen) {
      e.preventDefault();
      toggle(node.path);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="tree"][aria-label="Categories"] [data-treeitem]',
        ),
      ];
      const i = all.indexOf(e.currentTarget);
      all[i + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select();
    }
  };

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={selected}
      aria-level={depth + 1}
    >
      <div
        data-treeitem
        tabIndex={selected ? 0 : -1}
        onKeyDown={onKeyDown}
        onClick={select}
        style={{ paddingLeft: 4 + depth * 14 }}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded py-1 pr-1.5 text-sm",
          selected ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
          depth === 0 && "font-medium text-fg",
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggle(node.path);
          }}
          className={cn(
            "flex size-4 items-center justify-center text-fg-faint",
            !hasChildren && "invisible",
          )}
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        {Icon && <Icon aria-hidden className="size-3.5 text-accent" />}
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        <span className="tabular text-xs text-fg-faint">{node.items.length}</span>
      </div>
      {isOpen && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
