"use client";

import { Command } from "cmdk";
import {
  Calculator,
  CircleHelp,
  FlaskConical,
  History,
  Info,
  Monitor,
  Package,
  Server,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { applyTheme } from "@/components/shell/top-bar";
import { getJSON, keys, setJSON, type ThemePreference } from "@/lib/storage";
import { ServerOnlyBadge, Swatch } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { categoryLabel } from "@/lib/categories";
import { parseCalcQuery, search, type SearchHit } from "@/lib/model";
import { parseSubject, type Subject, subjectKey } from "@/lib/subjects";

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm aria-selected:bg-hover data-[selected=true]:bg-hover";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-faint";

/** §3.4 CommandPalette: the main way to find anything. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { model, actions, pins, recent, togglePin, server, servers, openHelp, openAbout } =
    useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [shift, setShift] = useState(false);

  const calc = parseCalcQuery(query);
  const hits = useMemo(() => search(model, calc ? calc.rest : query), [model, query, calc]);
  const calcTarget = calc ? hits.find((h) => h.kind !== "reaction") : undefined;

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };
  const choose = (subject: Subject, options?: { tab?: "calc"; amt?: number }) => {
    if (shift) {
      togglePin(subject);
      close();
      return;
    }
    actions.open(subject, options);
    close();
  };

  const groups: [string, SearchHit[]][] = [
    ["Reagents", hits.filter((h) => h.kind === "reagent")],
    ["Items", hits.filter((h) => h.kind === "item")],
    ["Reactions", hits.filter((h) => h.kind === "reaction")],
  ];

  const quickActions = [
    ...servers
      .filter((s) => s.id !== server.id)
      .map((s) => ({
        id: `server-${s.id}`,
        label: `Switch to ${s.name}`,
        icon: Server,
        run: () => router.push(`/${s.id}`),
      })),
    { id: "help", label: "Keyboard shortcuts", icon: CircleHelp, run: openHelp },
    { id: "about", label: "About & licenses", icon: Info, run: openAbout },
    {
      id: "theme",
      label: "Toggle theme",
      icon: Monitor,
      run: () => {
        const next = getJSON<ThemePreference>(keys.theme, "dark") === "light" ? "dark" : "light";
        setJSON(keys.theme, next);
        applyTheme(next);
      },
    },
  ];
  const shownActions = query
    ? quickActions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : quickActions;

  const saved = (list: string[], title: string, Icon: typeof Star) => {
    const subjects = list.map(parseSubject).filter((s): s is Subject => !!s && model.exists(s));
    if (!subjects.length) return null;
    return (
      <Command.Group heading={title} className={groupClass}>
        {subjects.slice(0, 6).map((s) => (
          <Command.Item
            key={`${title}-${subjectKey(s)}`}
            value={`${title}-${subjectKey(s)}`}
            onSelect={() => choose(s)}
            className={itemClass}
          >
            <Icon aria-hidden className="size-3.5 text-fg-faint" />
            <span className="truncate">{model.name(s)}</span>
          </Command.Item>
        ))}
      </Command.Group>
    );
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      label="Search"
      shouldFilter={false}
      loop
      onKeyDown={(e) => setShift(e.shiftKey)}
      onKeyUp={(e) => setShift(e.shiftKey)}
      overlayClassName="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-elevated shadow-panel"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search recipes, reagents… (try “30u bica”)"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-base outline-none placeholder:text-fg-faint"
      />
      <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">
          No results.
        </Command.Empty>
        {calc && calcTarget && (
          <Command.Group heading="Calculate" className={groupClass}>
            <Command.Item
              value={`calc-${calcTarget.kind}:${calcTarget.id}`}
              onSelect={() =>
                choose(
                  { kind: calcTarget.kind as "reagent" | "item", id: calcTarget.id },
                  { tab: "calc", amt: calc.amount },
                )
              }
              className={itemClass}
            >
              <Calculator aria-hidden className="size-4 text-accent" />
              Calculate {calc.amount}
              {calcTarget.kind === "item" ? "×" : "u"} of{" "}
              <span className="font-medium">{calcTarget.name}</span>
            </Command.Item>
          </Command.Group>
        )}
        {!query && saved(pins, "Pinned", Star)}
        {!query && saved(recent, "Recent", History)}
        {groups.map(
          ([title, list]) =>
            list.length > 0 && (
              <Command.Group key={title} heading={title} className={groupClass}>
                {list.map((h) => (
                  <Hit
                    key={`${h.kind}:${h.id}`}
                    hit={h}
                    onSelect={() => choose({ kind: h.kind, id: h.id })}
                  />
                ))}
              </Command.Group>
            ),
        )}
        {shownActions.length > 0 && (
          <Command.Group heading="Actions" className={groupClass}>
            {shownActions.map((a) => (
              <Command.Item
                key={a.id}
                value={`action-${a.id}`}
                onSelect={() => {
                  close();
                  a.run();
                }}
                className={itemClass}
              >
                <a.icon aria-hidden className="size-3.5 text-fg-faint" />
                {a.label}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-fg-faint">
        <span>↵ open</span>
        <span>⇧↵ pin</span>
        <span>esc close</span>
      </div>
    </Command.Dialog>
  );
}

function Hit({ hit, onSelect }: { hit: SearchHit; onSelect: () => void }) {
  const { model, server } = useWorkspace();
  const subject: Subject = { kind: hit.kind, id: hit.id };
  return (
    <Command.Item value={`${hit.kind}:${hit.id}`} onSelect={onSelect} className={itemClass}>
      {hit.kind === "reagent" ? (
        <Swatch color={model.color(subject)} />
      ) : hit.kind === "item" ? (
        <Package aria-hidden className="size-3.5 text-fg-muted" />
      ) : (
        <FlaskConical aria-hidden className="size-3.5 text-fg-muted" />
      )}
      <span className="truncate">{hit.name}</span>
      {hit.name.toLowerCase() !== hit.id.toLowerCase() && (
        <span className="truncate font-mono text-xs text-fg-faint">{hit.id}</span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {model.serverOnly(subject) && <ServerOnlyBadge server={server.name} />}
        {hit.category && (
          <span className="text-xs text-fg-faint">{categoryLabel(hit.category)}</span>
        )}
      </span>
    </Command.Item>
  );
}
