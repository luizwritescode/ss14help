"use client";

import type { CookingRecipe, Reaction } from "@ss14help/schema";
import { AmountText } from "@/components/ui/primitives";
import { SubjectLink } from "@/components/ui/subject";
import { useWorkspace } from "@/components/workspace/context";
import { cookingIngredients, reactionIngredients } from "@/lib/recipe-text";
import type { Subject } from "@/lib/subjects";

export function usedInCount(
  model: ReturnType<typeof useWorkspace>["model"],
  subject: Subject,
): number {
  if (subject.kind === "reaction") return 0;
  const c = model.graph.consumersOf(subject);
  return c.ingredientIn.length + c.catalystFor.length + c.cooking.length;
}

/** Everything that consumes the subject (§3.4 UsedInTab). */
export function UsedInTab({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  if (subject.kind === "reaction") return null;
  const c = model.graph.consumersOf(subject);
  const byName = <T,>(items: T[], name: (t: T) => string) =>
    [...items].sort((a, b) => name(a).localeCompare(name(b)));
  const reactionName = (r: Reaction) => model.name(model.reactionTarget(r).subject);
  const cookingName = (r: CookingRecipe) => model.name({ kind: "item", id: r.result });

  if (c.ingredientIn.length + c.catalystFor.length + c.cooking.length === 0) {
    return (
      <p className="text-sm text-fg-muted">Nothing in this data uses {model.name(subject)}.</p>
    );
  }
  return (
    <div className="space-y-5">
      <Group title="Ingredient in">
        {byName(c.ingredientIn, reactionName).map((r) => (
          <ReactionRowLink key={r.id} reaction={r} amount={r.reactants[subject.id]?.amount} />
        ))}
      </Group>
      <Group title="Catalyst for">
        {byName(c.catalystFor, reactionName).map((r) => (
          <ReactionRowLink key={r.id} reaction={r} amount={r.reactants[subject.id]?.amount} />
        ))}
      </Group>
      <Group title="Used in cooking">
        {byName(c.cooking, cookingName).map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-1">
            <AmountText
              value={
                subject.kind === "item"
                  ? (r.solids[subject.id] ?? 0)
                  : (r.reagents[subject.id] ?? 0)
              }
              unit={subject.kind === "item" ? "×" : "u"}
              className="w-14 shrink-0 text-right text-xs text-fg-muted"
            />
            <SubjectLink subject={{ kind: "item", id: r.result }} />
            <span className="ml-auto truncate text-xs text-fg-faint">
              {cookingIngredients(model, r)}
            </span>
          </li>
        ))}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {title} <span className="text-fg-faint">{children.length}</span>
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

function ReactionRowLink({ reaction, amount }: { reaction: Reaction; amount: number | undefined }) {
  const { model, actions } = useWorkspace();
  const { subject, via } = model.reactionTarget(reaction);
  return (
    <li className="flex items-center gap-2 py-1">
      <AmountText value={amount ?? 0} className="w-14 shrink-0 text-right text-xs text-fg-muted" />
      <SubjectLink
        subject={subject}
        onSelect={() => {
          actions.push(subject);
          if (via) actions.setVia(via);
        }}
      />
      <span className="ml-auto truncate text-xs text-fg-faint">
        {reactionIngredients(model, reaction)}
      </span>
    </li>
  );
}

export function SourcesTab({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  const source = model.sources.get(subject.id);
  if (!source) return null;
  return (
    <div className="space-y-4">
      {(["grind", "juice"] as const).map((method) => {
        const yields = source[method];
        if (!yields) return null;
        return (
          <section key={method}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">
              {method === "grind" ? "Grind" : "Juice"}
            </h3>
            <ul>
              {Object.entries(yields).map(([id, n]) => (
                <li key={id} className="flex items-center gap-2 py-1">
                  <AmountText
                    value={n}
                    className="w-14 shrink-0 text-right text-xs text-fg-muted"
                  />
                  <SubjectLink subject={{ kind: "reagent", id }} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
