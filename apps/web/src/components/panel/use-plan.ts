"use client";

import { plan, type Plan, yieldOf } from "@ss14help/calc";
import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace/context";
import type { Subject } from "@/lib/subjects";
import { useSelectedProducer } from "./recipe-tab";

/**
 * The calc-engine plan behind the Tree and Calculator tabs. Variant choices (`v.<id>` plus the
 * top subject's `via`) and owned ids come from the URL, so both tabs always agree.
 * Without an amount, the plan is for one batch of the selected recipe.
 */
export function usePlan(subject: Subject): { plan: Plan | null; amount: number; unit: "u" | "×" } {
  const { model, params } = useWorkspace();
  const { selected } = useSelectedProducer(subject);
  const unit = subject.kind === "item" ? "×" : "u";
  const amount = params.amt ?? (selected ? yieldOf(selected, subject.id) || 1 : 1);

  const result = useMemo(() => {
    if (subject.kind === "reaction") return null;
    const variants = { ...params.variants };
    if (selected) variants[subject.id] = selected.recipe.id;
    try {
      return plan(model.graph, subject, amount, { variants, owned: params.owned });
    } catch {
      return null;
    }
  }, [model, subject, amount, params.variants, params.owned, selected]);

  return { plan: result, amount, unit };
}
