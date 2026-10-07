"use client";

import { formatAmount, type PlanNode } from "@ss14help/calc";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AmountText, cn, coldChip, heatChip, Chip } from "@/components/ui/primitives";
import { CopyButton, SubjectLink } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import type { Subject } from "@/lib/subjects";
import { usePlan } from "./use-plan";

const PRESETS = [10, 30, 50, 100];

/** "Make N u of X" (§3.4 CalculatorTab). All arithmetic is in @ss14help/calc. */
export function CalcTab({ subject }: { subject: Subject }) {
  const { params, actions } = useWorkspace();
  const { plan, amount, unit } = usePlan(subject);
  const [draft, setDraft] = useState(params.amt === null ? "" : String(params.amt));
  const value = Number(draft);
  const valid = draft !== "" && Number.isFinite(value) && value >= 0.01;
  const error = draft !== "" && !valid ? "Enter an amount of at least 0.01" : null;

  // Debounced write of a valid amount to the URL (replace, not push). Invalid input keeps the
  // last valid result on screen.
  useEffect(() => {
    if (!valid || value === params.amt) return;
    const t = setTimeout(() => actions.setAmount(value), 250);
    return () => clearTimeout(t);
  }, [valid, value, params.amt, actions]);

  const intermediates = useMemo(() => (plan ? collectIntermediates(plan.tree) : []), [plan]);

  if (!plan) return null;
  const shopping = plan.basics;
  const copyText = [
    `${formatAmount(plan.requested)}${unit === "u" ? "u" : "×"} ${plan.name}`,
    ...shopping.map(
      (b) => `- ${formatAmount(b.amount)}${b.kind === "reagent" ? "u" : "×"} ${b.name}`,
    ),
    ...plan.catalysts.map((c) => `- keep ${formatAmount(c.amount)}u ${c.name} (catalyst)`),
    "",
    ...plan.steps.map((s, i) => `${i + 1}. ${s.text}`),
  ].join("\n");

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="calc-amount" className="mb-1.5 block text-xs text-fg-muted">
          Make
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-line bg-elevated focus-within:border-accent">
            <input
              id="calc-amount"
              inputMode="decimal"
              value={draft}
              placeholder={formatAmount(amount)}
              onChange={(e) => setDraft(e.target.value.replace(",", "."))}
              aria-invalid={error !== null}
              aria-describedby={error ? "calc-error" : undefined}
              className="w-24 bg-transparent px-2 py-1.5 font-mono text-sm outline-none"
            />
            <span className="pr-2 text-fg-muted">{unit}</span>
          </div>
          <span className="truncate text-sm">of {plan.name}</span>
          <div className="flex gap-1">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDraft(String(n))}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs",
                  params.amt === n
                    ? "border-accent text-fg"
                    : "border-line text-fg-muted hover:bg-hover",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p id="calc-error" role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
        {plan.overshoot > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle aria-hidden className="size-3.5" />
            Whole batches make <AmountText value={plan.produced} unit={unit} />,{" "}
            {formatAmount(plan.overshoot)}
            {unit} extra.
          </p>
        )}
      </div>

      <section aria-labelledby="shopping-title">
        <div className="mb-1.5 flex items-center justify-between">
          <h3
            id="shopping-title"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Shopping list
          </h3>
          <CopyButton text={copyText} label="Copy plan as text" />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {shopping.map((b) => (
              <tr key={`${b.kind}:${b.id}`} className="border-b border-line/60 last:border-0">
                <td className="w-20 py-1.5 pr-3 text-right align-top">
                  <AmountText value={b.amount} unit={b.kind === "item" ? "×" : "u"} />
                </td>
                <td className="py-1.5 align-top">
                  <SubjectLink subject={{ kind: b.kind, id: b.id }} />
                  <div className="text-[11px] text-fg-faint">
                    {b.reason === "dispensable"
                      ? "dispenser"
                      : b.reason === "owned"
                        ? "you have it"
                        : b.reason === "cycle"
                          ? "part of a cycle"
                          : b.sources[0]
                            ? `${b.sources[0].method}: ${b.sources[0].entityName}`
                            : "gather"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {plan.catalysts.length > 0 && (
        <section aria-labelledby="catalyst-title">
          <h3
            id="catalyst-title"
            className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Catalysts
          </h3>
          <ul className="space-y-1 text-sm">
            {plan.catalysts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-1.5">
                Keep {c.strict ? "at least" : "some"} <AmountText value={c.amount} />
                <SubjectLink subject={{ kind: "reagent", id: c.id }} /> in the beaker
                <span className="text-xs text-fg-faint">(not consumed)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.leftovers.length > 0 && (
        <section aria-labelledby="leftover-title">
          <h3
            id="leftover-title"
            className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Byproducts & leftovers
          </h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {plan.leftovers.map((l) => (
              <li key={l.id} className="flex items-center gap-1.5">
                <AmountText value={l.amount} unit={l.kind === "item" ? "×" : "u"} />
                <SubjectLink subject={{ kind: l.kind, id: l.id }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="steps-title">
        <h3
          id="steps-title"
          className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Steps
        </h3>
        {plan.steps.length === 0 ? (
          <p className="text-sm text-fg-muted">Nothing to make: it&apos;s a basic ingredient.</p>
        ) : (
          <ol className="space-y-2">
            {plan.steps.map((s, i) => (
              <li key={`${s.producer.id}-${i}`} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Step ${i + 1} done`}
                  className="mt-1 accent-[var(--accent)]"
                />
                <div className="min-w-0 space-y-1">
                  <p>
                    <span className="mr-1 font-mono text-xs text-fg-faint">{i + 1}.</span>
                    {s.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {s.minTemp !== null && heatChip(s.minTemp)}
                    {s.maxTemp !== null && coldChip(s.maxTemp)}
                    {s.mixers.length > 0 && (
                      <Chip
                        variant="mixer"
                        label={s.mixers.map((m) => m.name).join(" + ")}
                        tip="Mixer needed"
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {intermediates.length > 0 && (
        <section aria-labelledby="owned-title">
          <h3
            id="owned-title"
            className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Treat as owned
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {intermediates.map((n) => {
              const on = params.owned.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => actions.toggleOwned(n.id)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    on
                      ? "border-accent bg-accent-soft text-fg"
                      : "border-line text-fg-muted hover:bg-hover",
                  )}
                >
                  {n.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {plan.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-warning">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Made intermediates in the tree (excluding the target), plus ones already marked owned. */
function collectIntermediates(root: PlanNode): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  const walk = (node: PlanNode, depth: number) => {
    if (depth > 0 && (node.producer || node.leaf === "owned")) seen.set(node.id, node.name);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
