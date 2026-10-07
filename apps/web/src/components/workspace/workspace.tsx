"use client";

import { TriangleAlert, X } from "lucide-react";
import { Dialog, Tooltip } from "radix-ui";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RecipeList } from "@/components/list/recipe-list";
import { DetailPanel } from "@/components/panel/detail-panel";
import { CommandPalette } from "@/components/search/command-palette";
import { KeyboardHelp, Toaster, useToast } from "@/components/shell/dialogs";
import { TopBar } from "@/components/shell/top-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { IconButton } from "@/components/ui/primitives";
import { useModel } from "@/lib/client-data";
import { useHydrated, useMediaQuery } from "@/lib/hooks";
import { takeFlash } from "@/lib/flash";
import type { ServerModel } from "@/lib/model";
import { findServer, isStale, SERVERS, type ServerInfo } from "@/lib/servers";
import {
  DEFAULT_UI,
  keys,
  setJSON,
  storageAvailable,
  type UiPrefs,
  usePins,
  useRecent,
  useStored,
} from "@/lib/storage";
import { type Subject, subjectKey } from "@/lib/subjects";
import { WorkspaceContext, type WorkspaceContextValue } from "./context";
import { useWorkspaceState } from "./use-workspace";

/**
 * The app (§3.1). Until the server's data has loaded, the server-rendered `children` (the static
 * article for crawlers and no-JS) stay on screen.
 */
export function Workspace({
  serverId,
  initialSubject,
  children,
}: {
  serverId: string;
  initialSubject?: Subject;
  children?: ReactNode;
}) {
  const server = findServer(serverId)!;
  const state = useModel(server.id);
  if (state.status === "error") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-8 text-warning" />
        <p>Couldn&apos;t load the {server.name} data.</p>
        <p className="font-mono text-xs text-fg-muted">{state.error.message}</p>
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1.5 hover:bg-hover"
          onClick={() => location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div aria-busy className="relative">
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-accent" />
        {children}
      </div>
    );
  }
  return (
    <Tooltip.Provider>
      <Toaster>
        <Loaded server={server} model={state.model} initialSubject={initialSubject} />
      </Toaster>
    </Tooltip.Provider>
  );
}

function Loaded({
  server,
  model,
  initialSubject,
}: {
  server: ServerInfo;
  model: ServerModel;
  initialSubject?: Subject;
}) {
  const { params, actions } = useWorkspaceState(server.id, initialSubject);
  const { pins, toggle: togglePinKey, remove: removePin } = usePins(server.id);
  const { recent, add: addRecent, remove: removeRecent } = useRecent(server.id);
  const toast = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ui, setUi] = useStored<UiPrefs>(keys.ui, DEFAULT_UI);
  const top = params.open.at(-1) ?? null;
  const isXl = useMediaQuery("(min-width: 1280px)");

  // Remember the server; show a message left by the previous page; warn once without storage.
  useEffect(() => {
    setJSON(keys.lastServer, server.id);
    const flash = takeFlash();
    if (flash) toast(flash);
    if (!storageAvailable())
      toast("Storage is unavailable: pins and recents last for this session only");
  }, [server.id, toast]);

  // Recent records whatever reaches the top of the stack.
  useEffect(() => {
    if (top && model.exists(top)) addRecent(subjectKey(top));
  }, [top, model, addRecent]);

  // Return focus to the list row when the panel closes (§3.7).
  const lastTop = useRef<Subject | null>(null);
  useEffect(() => {
    if (!top && lastTop.current) {
      const key = subjectKey(lastTop.current);
      document.querySelector<HTMLElement>(`[data-subject="${CSS.escape(key)}"]`)?.focus();
    }
    lastTop.current = top;
  }, [top]);

  const togglePin = useCallback(
    (s: Subject) => {
      const key = subjectKey(s);
      toast(pins.includes(key) ? "Unpinned" : "Pinned");
      togglePinKey(key);
    },
    [pins, togglePinKey, toast],
  );

  const escape = useCallback(() => {
    if (params.open.length > 1) actions.pop();
    else if (params.open.length === 1) actions.close();
  }, [params.open.length, actions]);

  // Global shortcuts (§3.5). Ignored while typing, except Esc and the palette shortcut.
  const pendingG = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches?.(
        "input, textarea, select, [contenteditable=true]",
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (paletteOpen || helpOpen) return;
      if (e.key === "Escape") {
        if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
        if (isXl && params.open.length) {
          e.preventDefault();
          escape();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "g") {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 800);
      } else if (e.key === "s" && pendingG.current) {
        pendingG.current = false;
        if (!isXl) setDrawerOpen(true);
        requestAnimationFrame(() =>
          (
            document.querySelector<HTMLElement>('[data-treeitem][tabindex="0"]') ??
            document.querySelector<HTMLElement>("[data-treeitem]")
          )?.focus(),
        );
      } else if (e.key === "p" && top && (e.target as HTMLElement).closest?.("[data-panel]")) {
        e.preventDefault();
        togglePin(top);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, helpOpen, isXl, params.open.length, escape, top, togglePin]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      server,
      servers: SERVERS,
      model,
      params,
      actions,
      top,
      pins,
      togglePin,
      removePin,
      recent,
      removeRecent,
      toast,
      openPalette: () => setPaletteOpen(true),
      openHelp: () => setHelpOpen(true),
    }),
    [server, model, params, actions, top, pins, togglePin, removePin, recent, removeRecent, toast],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="flex h-dvh flex-col">
        <a
          href="#list"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-elevated focus:px-3 focus:py-1.5"
        >
          Skip to the list
        </a>
        <TopBar
          onMenu={() =>
            isXl ? setUi({ ...ui, sidebarCollapsed: !ui.sidebarCollapsed }) : setDrawerOpen(true)
          }
        />
        <StaleBanner server={server} />
        <div className="flex min-h-0 flex-1">
          {isXl && !ui.sidebarCollapsed && (
            <aside className="w-60 shrink-0 border-r border-line bg-elevated/40">
              <Sidebar />
            </aside>
          )}
          <main id="list" className="min-w-0 flex-1 bg-bg/40">
            <RecipeList />
          </main>
          {top &&
            (isXl ? (
              <DockedPanel width={ui.panelWidth} onResize={(w) => setUi({ ...ui, panelWidth: w })}>
                <DetailPanel subject={top} />
              </DockedPanel>
            ) : (
              <SheetPanel onClose={actions.close} onEscape={escape} title={model.name(top)}>
                <DetailPanel subject={top} />
              </SheetPanel>
            ))}
        </div>
      </div>
      {!isXl && (
        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col border-r border-line bg-elevated shadow-panel">
              <div className="flex h-12 items-center justify-between border-b border-line px-3">
                <Dialog.Title className="text-sm font-semibold">Browse</Dialog.Title>
                <Dialog.Close asChild>
                  <IconButton label="Close navigation">
                    <X className="size-4" />
                  </IconButton>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                Pinned, recent and categories
              </Dialog.Description>
              <div className="min-h-0 flex-1">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </WorkspaceContext.Provider>
  );
}

function StaleBanner({ server }: { server: ServerInfo }) {
  const [dismissed, setDismissed] = useState(false);
  const hydrated = useHydrated();
  if (!hydrated || !isStale(server) || dismissed) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning"
    >
      <TriangleAlert aria-hidden className="size-3.5" />
      This data is more than two weeks old; recipes may have changed on {server.name}.
      <button
        type="button"
        aria-label="Dismiss"
        className="ml-auto"
        onClick={() => setDismissed(true)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

const MIN_PANEL = 360;
const MAX_PANEL = 720;

/** ≥ 1280px: docked, resizable from its left edge; width persisted. */
function DockedPanel({
  width,
  onResize,
  children,
}: {
  width: number;
  onResize: (w: number) => void;
  children: ReactNode;
}) {
  const [live, setLive] = useState<number | null>(null);
  const shown = Math.min(MAX_PANEL, Math.max(MIN_PANEL, live ?? width));
  const start = (e: ReactPointerEvent) => {
    const x0 = e.clientX;
    const w0 = shown;
    let latest = w0;
    const move = (ev: PointerEvent) => {
      latest = Math.min(MAX_PANEL, Math.max(MIN_PANEL, w0 + (x0 - ev.clientX)));
      setLive(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      onResize(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <aside
      data-panel
      aria-label="Details"
      style={{ width: shown }}
      className="relative shrink-0 border-l border-line bg-elevated"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuemin={MIN_PANEL}
        aria-valuemax={MAX_PANEL}
        aria-valuenow={shown}
        tabIndex={0}
        onPointerDown={start}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onResize(Math.min(MAX_PANEL, shown + 24));
          if (e.key === "ArrowRight") onResize(Math.max(MIN_PANEL, shown - 24));
        }}
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-accent/30"
      />
      {children}
    </aside>
  );
}

/** < 1280px: a sheet over the list — from the right on tablets, from the bottom on phones. */
function SheetPanel({
  onClose,
  onEscape,
  title,
  children,
}: {
  onClose: () => void;
  onEscape: () => void;
  title: string;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Content
          data-panel
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onEscape();
          }}
          style={drag ? { transform: `translateY(${drag}px)` } : undefined}
          className="fixed inset-x-0 bottom-0 z-40 flex h-[88dvh] flex-col rounded-t-2xl border-t border-line bg-elevated shadow-panel md:inset-x-auto md:inset-y-0 md:right-0 md:h-auto md:w-[480px] md:rounded-none md:border-l md:border-t-0"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {/* Drag handle: swipe down to close (phones). */}
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center py-2 md:hidden"
            onPointerDown={(e) => {
              startY.current = e.clientY;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) =>
              startY.current !== null && setDrag(Math.max(0, e.clientY - startY.current))
            }
            onPointerUp={() => {
              if (drag > 100) onClose();
              setDrag(0);
              startY.current = null;
            }}
          >
            <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
