"use client";

import { Check, Copy, Package, Star } from "lucide-react";
import { HoverCard } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useWorkspace } from "@/components/workspace/context";
import { cookingText, reactionText } from "@/lib/recipe-text";
import { type Subject, subjectKey } from "@/lib/subjects";
import { cn, IconButton, Swatch } from "./primitives";

/** Swatch for reagents, a box icon for items. */
export function SubjectIcon({ subject, size = "sm" }: { subject: Subject; size?: "sm" | "md" }) {
  const { model } = useWorkspace();
  if (subject.kind === "reagent") return <Swatch color={model.color(subject)} size={size} />;
  return (
    <Package
      aria-hidden
      className={cn("shrink-0 text-fg-muted", size === "sm" ? "size-3.5" : "size-4")}
    />
  );
}

/** One-line recipe for hover cards and copy buttons. */
export function useSubjectSummary(subject: Subject): string | null {
  const { model } = useWorkspace();
  if (subject.kind === "reaction") {
    const r = model.reactions.get(subject.id);
    return r ? reactionText(model, r) : null;
  }
  const producer = model.graph.defaultProducer(subject) ?? model.producers(subject)[0];
  if (!producer) return null;
  return producer.kind === "reaction"
    ? reactionText(model, producer.recipe)
    : cookingText(model, producer.recipe);
}

/**
 * A link-styled button to a reagent or item (§3.4 ReagentLink/EntityLink). Clicking pushes the
 * subject onto the panel stack (or calls `onSelect`). Desktop shows a hover preview. Ids missing
 * from the data render as plain monospace text.
 */
export function SubjectLink({
  subject,
  onSelect,
  className,
  children,
}: {
  subject: Subject;
  onSelect?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const { model, actions } = useWorkspace();
  if (!model.exists(subject)) {
    return (
      <span title="Not in data" className="font-mono text-fg-muted">
        {subject.id}
      </span>
    );
  }
  const name = model.name(subject);
  return (
    <HoverCard.Root openDelay={400} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={onSelect ?? (() => actions.push(subject))}
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 rounded text-left text-fg underline decoration-line decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent",
            className,
          )}
        >
          <SubjectIcon subject={subject} />
          <span className="truncate">{children ?? name}</span>
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={6}
          className="z-50 hidden w-72 rounded-lg border border-line bg-elevated p-3 text-xs shadow-panel [@media(hover:hover)]:block"
        >
          <SubjectPreview subject={subject} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function SubjectPreview({ subject }: { subject: Subject }) {
  const { model } = useWorkspace();
  const summary = useSubjectSummary(subject);
  const desc =
    subject.kind === "reagent"
      ? model.reagents.get(subject.id)?.desc
      : subject.kind === "item"
        ? model.entities.get(subject.id)?.desc
        : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <SubjectIcon subject={subject} />
        {model.name(subject)}
      </div>
      {desc && <p className="text-fg-muted">{desc}</p>}
      <p className="font-mono text-[11px] text-fg-muted">
        {summary ?? "Basic — not made by any recipe"}
      </p>
    </div>
  );
}

export function PinButton({ subject }: { subject: Subject }) {
  const { pins, togglePin } = useWorkspace();
  const pinned = pins.includes(subjectKey(subject));
  return (
    <IconButton
      label={pinned ? "Unpin (p)" : "Pin (p)"}
      aria-pressed={pinned}
      onClick={() => togglePin(subject)}
    >
      <Star aria-hidden className={cn("size-4", pinned && "fill-accent text-accent")} />
    </IconButton>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useWorkspace();
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast("Copied");
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast("Couldn't copy to the clipboard");
        }
      }}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-accent" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </IconButton>
  );
}
