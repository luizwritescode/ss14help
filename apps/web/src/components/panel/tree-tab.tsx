"use client";

import type { PlanNode } from "@ss14help/calc";
import { ChevronDown, ChevronRight, Repeat } from "lucide-react";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { AmountText, cn } from "@/components/ui/primitives";
import { SubjectLink } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import type { Subject } from "@/lib/subjects";
import { usePlan } from "./use-plan";

const LEAF_NOTE: Record<string, string> = {
  dispensable: "dispenser",
  basic: "basic",
  owned: "owned",
  cycle: "↻ cycle",
  catalyst: "catalyst",
};

/** Expandable ingredient tree (§3.4 TreeTab), an ARIA tree. */
export function TreeTab({ subject }: { subject: Subject }) {
  const { params } = useWorkspace();
  const { plan, amount, unit } = usePlan(subject);
  const paths = useMemo(() => (plan ? collectPaths(plan.tree) : []), [plan]);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  // Default: two levels open, catalysts closed.
  const open = useMemo(
    () => expanded ?? new Set(paths.filter((p) => p.split("/").length <= 2)),
    [expanded, paths],
  );

  const toggle = useCallback(
    (path: string) => {
      const next = new Set(open);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      setExpanded(next);
    },
    [open],
  );

  if (!plan) return <p className="text-sm text-fg-muted">Nothing to expand.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
        <span>
          for <AmountText value={amount} unit={unit} className="text-fg" />
          {params.amt === null && " (one batch)"}
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            className="hover:text-fg"
            onClick={() => setExpanded(new Set(paths))}
          >
            Expand all
          </button>
          <button type="button" className="hover:text-fg" onClick={() => setExpanded(new Set())}>
            Collapse all
          </button>
        </span>
      </div>
      <ul role="tree" aria-label="Ingredient tree" className="text-sm">
        <TreeItem node={plan.tree} path="0" depth={0} open={open} toggle={toggle} />
      </ul>
    </div>
  );
}

function collectPaths(node: PlanNode, path = "0", out: string[] = []): string[] {
  if (node.children.length) out.push(path);
  node.children.forEach((c, i) => collectPaths(c, `${path}/${i}`, out));
  return out;
}

function TreeItem({
  node,
  path,
  depth,
  open,
  toggle,
}: {
  node: PlanNode;
  path: string;
  depth: number;
  open: Set<string>;
  toggle: (path: string) => void;
}) {
  const { actions, params } = useWorkspace();
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && open.has(path);
  const subject: Subject = { kind: node.kind, id: node.id };

  const onKey = (e: KeyboardEvent) => {
    if (!hasChildren) return;
    if ((e.key === "ArrowRight" && !expanded) || (e.key === "ArrowLeft" && expanded)) {
      e.preventDefault();
      toggle(path);
    }
  };

  return (
    <li
      role="treeitem"
      aria-selected={false}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-level={depth + 1}
      tabIndex={-1}
      onKeyDown={onKey}
    >
      <div className="flex min-h-8 items-center gap-1.5 rounded-md pr-1 hover:bg-hover/60">
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          disabled={!hasChildren}
          onClick={() => toggle(path)}
          className="flex size-5 shrink-0 items-center justify-center text-fg-faint disabled:invisible"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <AmountText
          value={node.amount}
          unit={node.kind === "item" ? "×" : "u"}
          className="w-16 shrink-0 text-right text-xs text-fg-muted"
        />
        <SubjectLink subject={subject} className={cn(node.catalyst && "italic")} />
        {node.leaf && (
          <span
            className={cn(
              "shrink-0 rounded px-1 text-[10px] uppercase tracking-wide",
              node.leaf === "catalyst"
                ? "text-catalyst"
                : node.leaf === "cycle"
                  ? "text-warning"
                  : "text-fg-faint",
            )}
          >
            {LEAF_NOTE[node.leaf]}
          </span>
        )}
        {node.alternatives.length > 1 && node.producer && depth > 0 && (
          <label className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-fg-faint">
            <Repeat aria-hidden className="size-3" />
            <span className="sr-only">Recipe for {node.name}</span>
            <select
              value={params.variants[node.id] ?? node.producer.id}
              onChange={(e) => actions.setVariant(node.id, e.target.value)}
              className="max-w-28 rounded border border-line bg-elevated px-1 py-0.5 font-mono text-[11px] text-fg"
            >
              {node.alternatives.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {expanded && (
        <ul role="group" className="ml-[9px] border-l border-line pl-2">
          {node.children.map((child, i) => (
            <TreeItem
              key={`${child.id}-${i}`}
              node={child}
              path={`${path}/${i}`}
              depth={depth + 1}
              open={open}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
