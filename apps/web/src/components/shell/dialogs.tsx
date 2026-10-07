"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { IconButton, Kbd } from "@/components/ui/primitives";

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
