"use client";

import {
  Check,
  ChevronDown,
  CircleHelp,
  GitCommitHorizontal,
  Info,
  Menu,
  Monitor,
  Moon,
  Orbit,
  Search,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn, GitHubMark, IconButton, Kbd, Tip } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { REPO_URL } from "@/lib/about";
import { commitUrl, isStale, type ServerInfo } from "@/lib/servers";
import { keys, type ThemePreference, useStored } from "@/lib/storage";
import { subjectKey } from "@/lib/subjects";
import { loadModel } from "@/lib/client-data";
import { setFlash } from "@/lib/flash";
import { useRouter } from "next/navigation";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { openPalette, openHelp, openAbout } = useWorkspace();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-elevated/70 px-2 backdrop-blur sm:px-3">
      <IconButton label="Open navigation" className="xl:hidden" onClick={onMenu}>
        <Menu aria-hidden className="size-4" />
      </IconButton>
      <Logo />
      <ServerSwitcher />
      <button
        type="button"
        onClick={openPalette}
        className="mx-auto hidden h-8 w-full max-w-[560px] items-center gap-2 rounded-md border border-line bg-bg/60 px-2.5 text-sm text-fg-faint hover:border-fg-faint sm:flex"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-left">Search recipes, reagents…</span>
        <Kbd keys={["mod", "K"]} />
      </button>
      <div className="ml-auto flex items-center gap-1 sm:ml-0">
        <IconButton label="Search" className="sm:hidden" onClick={openPalette}>
          <Search aria-hidden className="size-4" />
        </IconButton>
        <DataBadge />
        <ThemeToggle />
        <IconButton label="Keyboard shortcuts (?)" onClick={openHelp}>
          <CircleHelp aria-hidden className="size-4" />
        </IconButton>
        <IconButton label="About & licenses" className="max-sm:hidden" onClick={openAbout}>
          <Info aria-hidden className="size-4" />
        </IconButton>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Source code on GitHub"
          title="Source code on GitHub"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg max-lg:w-8 max-lg:justify-center lg:border lg:border-line lg:px-2.5"
        >
          <GitHubMark className="size-4" />
          <span className="hidden lg:inline">GitHub</span>
        </a>
      </div>
    </header>
  );
}

function Logo() {
  const { server } = useWorkspace();
  return (
    <Link
      href={`/${server.id}`}
      className="flex shrink-0 items-center gap-1.5 rounded px-1 font-semibold tracking-tight"
    >
      <Orbit aria-hidden className="size-5 text-accent" />
      <span className="hidden sm:inline">
        ss14<span className="text-accent">help</span>
      </span>
    </Link>
  );
}

function relativeAge(iso: string, now: number): string {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const subscribeNow = () => () => {};
function useNow(): number {
  // Stable per render pass on the client; 0 during SSR (age labels then render client-side).
  return useSyncExternalStore(
    subscribeNow,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  );
}

/** §3.4 ServerSwitcher: keeps the open subject when it exists on the target server. */
function ServerSwitcher() {
  const { server, servers, params } = useWorkspace();
  const router = useRouter();
  const now = useNow();

  const switchTo = async (target: ServerInfo) => {
    if (target.id === server.id) return;
    const top = params.open.at(-1);
    let query = "";
    if (top) {
      const other = await loadModel(target.id).catch(() => null);
      if (other?.exists(top)) {
        const sp = new URLSearchParams({ open: subjectKey(top) });
        if (params.tab !== "recipe") sp.set("tab", params.tab);
        if (params.amt !== null) sp.set("amt", String(params.amt));
        query = `?${sp.toString().replace(/%3A/g, ":")}`;
      } else {
        setFlash(`${top.id} isn't on ${target.name}`);
      }
    }
    router.push(`/${target.id}${query}`);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Server: ${server.name}`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-line px-2 text-sm hover:bg-hover"
        >
          <span className="max-w-32 truncate">{server.name}</span>
          <ChevronDown aria-hidden className="size-3.5 text-fg-muted" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-56 rounded-lg border border-line bg-elevated p-1 shadow-panel"
        >
          <DropdownMenu.Label className="px-2 py-1 text-[11px] uppercase tracking-wider text-fg-faint">
            Server
          </DropdownMenu.Label>
          {servers.map((s) => (
            <DropdownMenu.Item
              key={s.id}
              onSelect={() => void switchTo(s)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-hover"
            >
              <Check
                aria-hidden
                className={cn("size-3.5", s.id === server.id ? "text-accent" : "invisible")}
              />
              <span className="flex-1">{s.name}</span>
              <span className="text-xs text-fg-faint">
                {now ? relativeAge(s.commitDate, now) : ""}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** §3.4 DataVersionBadge: short sha and age; amber when the snapshot is stale. */
function DataBadge() {
  const { server } = useWorkspace();
  const now = useNow();
  const stale = now > 0 && isStale(server, now);
  return (
    <Tip
      content={
        <div className="space-y-0.5">
          <div className="font-mono">{server.sha}</div>
          <div>Committed {new Date(server.commitDate).toUTCString()}</div>
          <div>Built {new Date(server.generatedAt).toUTCString()}</div>
          <div>
            {server.repo.replace("https://github.com/", "")} @ {server.branch}
          </div>
          <div>{server.warningCount} pipeline warnings</div>
          {stale && <div className="text-warning">Data may be outdated</div>}
        </div>
      }
    >
      <a
        href={commitUrl(server)}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "hidden h-8 items-center gap-1 rounded-md px-2 font-mono text-xs hover:bg-hover md:flex",
          stale ? "text-warning" : "text-fg-muted",
        )}
      >
        <GitCommitHorizontal aria-hidden className="size-3.5" />@{server.sha.slice(0, 7)}
        {now > 0 && <span className="font-sans">· {relativeAge(server.commitDate, now)}</span>}
      </a>
    </Tip>
  );
}

const THEME_ORDER: ThemePreference[] = ["system", "dark", "light"];

export function applyTheme(pref: ThemePreference) {
  if (pref === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}

function ThemeToggle() {
  const [pref, setPref] = useStored<ThemePreference>(keys.theme, "dark");
  const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length]!;
  const Icon = pref === "system" ? Monitor : pref === "dark" ? Moon : Sun;
  return (
    <IconButton
      label={`Theme: ${pref} (switch to ${next})`}
      onClick={() => {
        setPref(next);
        applyTheme(next);
      }}
    >
      <Icon aria-hidden className="size-4" />
    </IconButton>
  );
}
