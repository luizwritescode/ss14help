"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { cn, GitHubMark, IconButton, Kbd } from "@/components/ui/primitives";
import {
  ATTRIBUTION_URL,
  CODE_LICENSE,
  COPYRIGHT,
  DATA_LICENSES,
  ISSUES_URL,
  LICENSE_URL,
  REPO_URL,
} from "@/lib/about";
import { commitUrl, SERVERS } from "@/lib/servers";

/** §3.5 keyboard map. */
export const KEYMAP: { keys: string[][]; scope: string; action: string }[] = [
  { keys: [["mod", "K"], ["/"]], scope: "Global", action: "Open the command palette" },
  { keys: [["j"], ["k"], ["↓"], ["↑"]], scope: "List", action: "Move focus" },
  { keys: [["Enter"]], scope: "List / palette", action: "Open" },
  { keys: [["p"]], scope: "List row, panel", action: "Pin or unpin" },
  { keys: [["1"], ["–"], ["5"]], scope: "Panel", action: "Switch tabs" },
  { keys: [["Backspace"], ["Alt", "←"]], scope: "Panel", action: "Back (pop the stack)" },
  { keys: [["Esc"]], scope: "Any", action: "Close palette, then go back, then close the panel" },
  { keys: [["g"], ["s"]], scope: "Global", action: "Focus the category tree" },
  { keys: [["?"]], scope: "Global", action: "This help" },
];

export function KeyboardHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-elevated p-5 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-3 text-xs text-fg-muted">
            Shortcuts are ignored while typing, except Esc and the palette shortcut.
          </Dialog.Description>
          <table className="w-full text-sm">
            <tbody>
              {KEYMAP.map((k) => (
                <tr key={k.action} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="flex flex-wrap gap-1">
                      {k.keys.map((combo, i) => (
                        <Kbd key={i} keys={combo} />
                      ))}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-fg-faint">{k.scope}</td>
                  <td className="py-1.5">{k.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const linkClass = "text-accent underline-offset-2 hover:underline";

/** About the project: what it is, the code license, and where each server's data comes from. */
export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-elevated p-5 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">About & licenses</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-fg-muted">
            ss14help is an unofficial, open-source fan project. It is not affiliated with or
            endorsed by the Space Wizards Federation or any server listed below.
          </Dialog.Description>

          <section className="mb-4 space-y-1.5 text-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              Source code
            </h3>
            <p>
              {CODE_LICENSE} licensed, {COPYRIGHT}.{" "}
              <a href={LICENSE_URL} target="_blank" rel="noreferrer" className={linkClass}>
                License
              </a>
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 hover:bg-hover"
            >
              <GitHubMark className="size-4" />
              View on GitHub
            </a>
            <p className="text-fg-muted">
              Found a wrong recipe or a bug?{" "}
              <a href={ISSUES_URL} target="_blank" rel="noreferrer" className={linkClass}>
                Open an issue
              </a>
              .
            </p>
          </section>

          <section className="space-y-2 text-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              Game data
            </h3>
            <p className="text-fg-muted">
              Recipes, reagents and their text are generated from each server&apos;s game files and
              stay under that repository&apos;s license.
            </p>
            <ul className="space-y-2">
              {SERVERS.map((s) => (
                <li key={s.id} className="rounded-md border border-line/60 p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-medium">{s.name}</span>
                    <a
                      href={s.repo}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(linkClass, "text-xs")}
                    >
                      {s.repo.replace("https://github.com/", "")}
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {DATA_LICENSES[s.id] ?? "See the repository for its license."}
                  </p>
                  <p className="mt-1 text-xs text-fg-faint">
                    Snapshot of{" "}
                    <a
                      href={commitUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono hover:underline"
                    >
                      {s.sha.slice(0, 7)}
                    </a>{" "}
                    on {s.branch}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted">
              Full details in{" "}
              <a href={ATTRIBUTION_URL} target="_blank" rel="noreferrer" className={linkClass}>
                ATTRIBUTION.md
              </a>
              .
            </p>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// --- toasts ----------------------------------------------------------------------------------

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-full border border-line bg-elevated px-4 py-1.5 text-sm shadow-panel"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
