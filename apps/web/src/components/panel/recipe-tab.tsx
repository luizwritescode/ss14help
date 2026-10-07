"use client";

import type { Producer } from "@ss14help/calc";
import type { CookingRecipe, Reaction } from "@ss14help/schema";
import { ChevronRight, Info } from "lucide-react";
import { useWorkspace } from "@/components/workspace/context";
import { AmountText, Chip, coldChip, cn, heatChip } from "@/components/ui/primitives";
import { SubjectLink } from "@/components/ui/subject";
import { categoryLabel } from "@/lib/categories";
import { type Subject, toNode } from "@/lib/subjects";

/** The recipe currently shown for a subject: `via` if valid, else the default producer. */
export function useSelectedProducer(subject: Subject): {
  producers: Producer[];
  selected: Producer | null;
} {
  const { model, params } = useWorkspace();
  const producers = model.producers(subject);
  const chosen = params.via ? producers.find((p) => p.recipe.id === params.via) : undefined;
  const node = toNode(subject);
  return { producers, selected: chosen ?? (node && model.graph.defaultProducer(node)) ?? null };
}

export function RecipeTab({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  const { producers, selected } = useSelectedProducer(subject);

  if (subject.kind === "reaction") {
    const r = model.reactions.get(subject.id);
    return r ? <ReactionCard reaction={r} /> : null;
  }

  return (
    <div className="space-y-4">
      {producers.length > 1 && <VariantSwitcher producers={producers} selected={selected} />}
      {selected ? (
        selected.kind === "reaction" ? (
          <ReactionCard reaction={selected.recipe} focus={subject.id} />
        ) : (
          <CookingCard recipe={selected.recipe} />
        )
      ) : (
        <BasicCallout subject={subject} producers={producers} />
      )}
      <Description subject={subject} />
    </div>
  );
}

function VariantSwitcher({
  producers,
  selected,
}: {
  producers: Producer[];
  selected: Producer | null;
}) {
  const { actions } = useWorkspace();
  const index = selected ? producers.indexOf(selected) : -1;
  return (
    <div>
      <p className="mb-1.5 text-xs text-fg-muted">
        {index >= 0
          ? `Recipe ${index + 1} of ${producers.length}`
          : `${producers.length} ways to make it`}
      </p>
      <div role="radiogroup" aria-label="Recipe variant" className="flex flex-wrap gap-1">
        {producers.map((p) => {
          const active = p === selected;
          const label =
            p.kind === "cooking"
              ? `${categoryLabel(p.recipe.device)} · ${p.recipe.id}`
              : p.recipe.id;
          return (
            <button
              key={p.recipe.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => actions.setVia(p.recipe.id)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                active
                  ? "border-accent bg-accent-soft text-fg"
                  : "border-line text-fg-muted hover:bg-hover hover:text-fg",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Line({
  amount,
  unit = "u",
  children,
  dashed,
}: {
  amount: number;
  unit?: "u" | "×";
  children: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5",
        dashed ? "border border-dashed border-catalyst/60" : "bg-muted/60",
      )}
    >
      <AmountText value={amount} unit={unit} className="w-14 shrink-0 text-right text-fg-muted" />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </li>
  );
}

export function ReactionCard({ reaction, focus }: { reaction: Reaction; focus?: string }) {
  const reactants = Object.entries(reaction.reactants).sort(
    ([, a], [, b]) => Number(a.catalyst) - Number(b.catalyst),
  );
  const products = Object.entries(reaction.products).sort(
    ([a], [b]) => Number(b === focus) - Number(a === focus),
  );
  const [main, ...also] = products;
  return (
    <section aria-label={`Reaction ${reaction.id}`} className="space-y-3">
      <ul className="space-y-1">
        {reactants.map(([id, r]) => (
          <Line key={id} amount={r.amount} dashed={r.catalyst}>
            <SubjectLink subject={{ kind: "reagent", id }} />
            {r.catalyst && (
              <span className="ml-auto text-[11px] text-catalyst">catalyst · not consumed</span>
            )}
          </Line>
        ))}
      </ul>
      <div aria-hidden className="flex items-center gap-2 text-fg-faint">
        <span className="h-px flex-1 bg-line" />▼<span className="h-px flex-1 bg-line" />
      </div>
      {main ? (
        <ul className="space-y-1">
          <Line amount={main[1]}>
            <span className="font-semibold">
              <SubjectLink subject={{ kind: "reagent", id: main[0] }} />
            </span>
          </Line>
          {also.length > 0 && <li className="px-2 pt-1 text-xs text-fg-muted">also makes</li>}
          {also.map(([id, n]) => (
            <Line key={id} amount={n}>
              <SubjectLink subject={{ kind: "reagent", id }} />
            </Line>
          ))}
        </ul>
      ) : (
        <p className="px-2 text-sm text-fg-muted">No products — this reaction only has effects.</p>
      )}
      <Conditions reaction={reaction} />
      {reaction.effects.length > 0 && <Effects effects={reaction.effects} />}
      <p className="text-[11px] text-fg-faint">
        {categoryLabel(reaction.category)} · <span className="font-mono">{reaction.id}</span>
      </p>
    </section>
  );
}

export function Conditions({ reaction }: { reaction: Reaction }) {
  const { model } = useWorkspace();
  const mixers = reaction.mixers.map((m) => model.mixerName(m));
  const catalysts = Object.entries(reaction.reactants).filter(([, r]) => r.catalyst);
  const chips = [
    reaction.minTemp !== null && <span key="heat">{heatChip(reaction.minTemp)}</span>,
    reaction.maxTemp !== null && <span key="cold">{coldChip(reaction.maxTemp)}</span>,
    mixers.length > 0 && (
      <Chip
        key="mixer"
        variant="mixer"
        label={mixers.join(" + ")}
        tip={
          mixers.length > 1
            ? "The mixer must support all of these"
            : `Needs a mixer that can ${mixers[0]}`
        }
      />
    ),
    ...catalysts.map(([id, r]) => (
      <Chip
        key={`cat-${id}`}
        variant="catalyst"
        label={model.name({ kind: "reagent", id })}
        tip={
          reaction.quantized
            ? `Keep at least ${r.amount}u present; it isn't consumed`
            : "Must be present; it isn't consumed"
        }
      />
    )),
    reaction.quantized && (
      <Chip
        key="q"
        variant="quantized"
        label="whole batches"
        tip="This reaction only runs in whole multiples of its recipe"
      />
    ),
    reaction.priority > 0 && (
      <Chip
        key="p"
        variant="priority"
        label={`priority ${reaction.priority}`}
        tip="When several reactions could run, higher priority goes first"
      />
    ),
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function Effects({ effects }: { effects: Record<string, unknown>[] }) {
  return (
    <details className="rounded-md border border-line px-3 py-2 text-xs">
      <summary className="cursor-pointer text-fg-muted">Effects ({effects.length})</summary>
      <ul className="mt-2 space-y-1.5">
        {effects.map((e, i) => {
          const { _type, ...rest } = e;
          return (
            <li key={i}>
              <span className="font-medium">{humanize(String(_type ?? "Effect"))}</span>
              {Object.keys(rest).length > 0 && (
                <span className="ml-1 font-mono text-fg-muted">
                  {Object.entries(rest)
                    .map(
                      ([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
                    )
                    .join(", ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function humanize(type: string): string {
  const words = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function CookingCard({ recipe }: { recipe: CookingRecipe }) {
  const solids = Object.entries(recipe.solids);
  const reagents = Object.entries(recipe.reagents);
  return (
    <section aria-label={`Cooking recipe ${recipe.id}`} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip
          variant="device"
          label={categoryLabel(recipe.device)}
          tip={`Cooked in a ${categoryLabel(recipe.device).toLowerCase()}`}
        />
        <Chip
          variant="time"
          label={recipe.time ? `${recipe.time} s` : "instant"}
          tip={recipe.time ? `Cooks for ${recipe.time} seconds` : "Done instantly"}
        />
        {recipe.secret && (
          <Chip
            variant="secret"
            label="secret recipe"
            tip="Not available in normal circumstances"
          />
        )}
      </div>
      {solids.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-fg-muted">Solids</h4>
          <ul className="space-y-1">
            {solids.map(([id, n]) => (
              <Line key={id} amount={n} unit="×">
                <SubjectLink subject={{ kind: "item", id }} />
              </Line>
            ))}
          </ul>
        </div>
      )}
      {reagents.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-fg-muted">Reagents</h4>
          <ul className="space-y-1">
            {reagents.map(([id, n]) => (
              <Line key={id} amount={n}>
                <SubjectLink subject={{ kind: "reagent", id }} />
              </Line>
            ))}
          </ul>
        </div>
      )}
      <div aria-hidden className="flex items-center gap-2 text-fg-faint">
        <span className="h-px flex-1 bg-line" />▼<span className="h-px flex-1 bg-line" />
      </div>
      <ul>
        <Line amount={1} unit="×">
          <span className="font-semibold">
            <SubjectLink subject={{ kind: "item", id: recipe.result }} />
          </span>
        </Line>
      </ul>
      <p className="text-[11px] text-fg-faint">
        {recipe.name} · {recipe.group ?? "Other"} · <span className="font-mono">{recipe.id}</span>
      </p>
    </section>
  );
}

function BasicCallout({ subject, producers }: { subject: Subject; producers: Producer[] }) {
  const { model, actions } = useWorkspace();
  const dispensable = subject.kind === "reagent" && model.graph.isDispensable(subject.id);
  const sources = subject.kind === "reagent" ? model.graph.sourcesOf(subject.id) : [];
  return (
    <section className="space-y-3">
      <div className="flex gap-2 rounded-lg border border-line bg-muted/60 p-3">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <div className="text-sm">
          <p className="font-medium">
            {subject.kind === "item"
              ? "Not cooked — obtained some other way"
              : dispensable
                ? "Basic reagent — from a dispenser"
                : "Basic reagent — not made by any recipe"}
          </p>
          {producers.length > 0 && (
            <p className="mt-1 text-fg-muted">
              It also comes out of{" "}
              {producers.map((p, i) => (
                <span key={p.recipe.id}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => actions.setVia(p.recipe.id)}
                    className="font-mono text-xs underline underline-offset-4 hover:text-accent"
                  >
                    {p.recipe.id}
                  </button>
                </span>
              ))}{" "}
              as a side product.
            </p>
          )}
        </div>
      </div>
      {subject.kind === "reagent" && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-fg-muted">Where to get it</h4>
          {sources.length === 0 ? (
            <p className="text-sm text-fg-muted">
              {dispensable
                ? "Any chem, soda or booze dispenser that stocks it."
                : "No known source in this data."}
            </p>
          ) : (
            <ul className="space-y-1">
              {sources.slice(0, 12).map((s) => (
                <li key={`${s.entity}-${s.method}`} className="flex items-center gap-2 text-sm">
                  <ChevronRight aria-hidden className="size-3.5 text-fg-faint" />
                  <span className="capitalize text-fg-muted">{s.method}</span>
                  <SubjectLink subject={{ kind: "item", id: s.entity }} />
                  <span className="text-fg-muted">→</span>
                  <AmountText value={s.amount} />
                </li>
              ))}
              {sources.length > 12 && (
                <li className="text-xs text-fg-muted">and {sources.length - 12} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Description({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  const desc =
    subject.kind === "reagent"
      ? model.reagents.get(subject.id)?.desc
      : subject.kind === "item"
        ? model.entities.get(subject.id)?.desc
        : null;
  return desc ? <p className="text-sm text-fg-muted">{desc}</p> : null;
}
