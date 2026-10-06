import { CALC_ENGINE_VERSION } from "@ss14help/calc";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">ss14help v2</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Multi-server crafting and chemistry guide for Space Station 14. Under construction. See
        ROADMAP.md on the <code className="font-mono">v2</code> branch.
      </p>
      <p className="font-mono text-sm text-zinc-500">calc engine v{CALC_ENGINE_VERSION}</p>
    </main>
  );
}
