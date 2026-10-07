"use client";

import { formatAmount, kelvinToCelsius } from "@ss14help/calc";
import { clsx } from "clsx";
import {
  ChefHat,
  Clock,
  Diamond,
  EyeOff,
  Flame,
  Layers,
  Snowflake,
  Sparkles,
  Tornado,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "radix-ui";
import { type ComponentProps, type ReactNode, useSyncExternalStore } from "react";

export const cn = clsx;

// --- swatch --------------------------------------------------------------------------------

/** Reagent colour dot (§3.4 ReagentSwatch). Hatched when the reagent has no colour. */
export function Swatch({ color, size = "sm" }: { color: string | null; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full ring-1 ring-fg/30",
        size === "sm" ? "size-3" : "size-4",
        !color && "hatch",
      )}
      style={color ? { background: color } : undefined}
    />
  );
}

// --- amounts -------------------------------------------------------------------------------

export type Unit = "u" | "×" | "s" | "K";

/** A number with ≤ 2 decimals and its unit after a thin space, in tabular figures. */
export function AmountText({
  value,
  unit = "u",
  className,
}: {
  value: number;
  unit?: Unit;
  className?: string;
}) {
  return (
    <span className={cn("tabular font-mono", className)}>
      {formatAmount(value)}
      {" "}
      {unit}
    </span>
  );
}

// --- tooltip -------------------------------------------------------------------------------

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-line bg-elevated px-2 py-1 text-xs text-fg shadow-panel"
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// --- condition chips -----------------------------------------------------------------------

export type ChipVariant =
  "heat" | "cold" | "mixer" | "catalyst" | "device" | "time" | "quantized" | "secret" | "priority";

const CHIP: Record<ChipVariant, { icon: LucideIcon; tone: string }> = {
  heat: { icon: Flame, tone: "text-heat" },
  cold: { icon: Snowflake, tone: "text-cold" },
  mixer: { icon: Tornado, tone: "text-accent" },
  catalyst: { icon: Diamond, tone: "text-catalyst" },
  device: { icon: ChefHat, tone: "text-accent" },
  time: { icon: Clock, tone: "text-fg-muted" },
  quantized: { icon: Layers, tone: "text-fg-muted" },
  secret: { icon: EyeOff, tone: "text-server-only" },
  priority: { icon: Sparkles, tone: "text-fg-muted" },
};

/** An icon + text + tooltip; colour is never the only signal (§3.4 ConditionChip). */
export function Chip({
  variant,
  label,
  tip,
}: {
  variant: ChipVariant;
  label: string;
  tip: string;
}) {
  const { icon: Icon, tone } = CHIP[variant];
  return (
    <Tip content={tip}>
      <span
        tabIndex={0}
        className="inline-flex items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-xs text-fg"
      >
        <Icon aria-hidden className={cn("size-3.5", tone)} />
        {label}
      </span>
    </Tip>
  );
}

export function heatChip(minTemp: number) {
  return (
    <Chip
      variant="heat"
      label={`≥ ${formatAmount(minTemp)} K`}
      tip={`Heat to at least ${formatAmount(minTemp)} K (${kelvinToCelsius(minTemp)} °C)`}
    />
  );
}

export function coldChip(maxTemp: number) {
  return (
    <Chip
      variant="cold"
      label={`≤ ${formatAmount(maxTemp)} K`}
      tip={`Keep at or below ${formatAmount(maxTemp)} K (${kelvinToCelsius(maxTemp)} °C)`}
    />
  );
}

/** Row icon for a condition, with screen-reader text (used in dense list rows). */
export function ConditionIcon({ variant, label }: { variant: ChipVariant; label: string }) {
  const { icon: Icon, tone } = CHIP[variant];
  return (
    <span title={label} className="inline-flex">
      <Icon aria-hidden className={cn("size-3.5", tone)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// --- badges & buttons ----------------------------------------------------------------------

export function ServerOnlyBadge({ server }: { server: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-server-only/40 px-1.5 text-[10px] font-medium uppercase tracking-wide text-server-only">
      {server} only
    </span>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** The GitHub mark (lucide has no brand icons). */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// --- keyboard hints ------------------------------------------------------------------------

const subscribeNothing = () => () => {};

export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/** Renders a shortcut; `mod` becomes ⌘ on Apple platforms and Ctrl elsewhere. */
export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  const mac = useIsMac();
  return (
    <span className={cn("inline-flex gap-0.5", className)}>
      {keys.map((k) => (
        <kbd
          key={k}
          className="min-w-5 rounded border border-line bg-muted px-1 text-center font-mono text-[11px] leading-5 text-fg-muted"
        >
          {k === "mod" ? (mac ? "⌘" : "Ctrl") : k}
        </kbd>
      ))}
    </span>
  );
}
