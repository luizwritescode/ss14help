/**
 * Server-rendered recipe content (§3.8 "No JS"): what crawlers, link previews and visitors
 * without JavaScript see, and what stays on screen while the workspace loads its data.
 */
import { formatAmount } from "@ss14help/calc";
import type { Reaction } from "@ss14help/schema";
import { displayName } from "@/lib/model";
import Link from "next/link";
import type { SnapshotFiles } from "@/lib/model";
import type { ServerInfo } from "@/lib/servers";
import type { Subject } from "@/lib/subjects";

function names(files: SnapshotFiles) {
  const reagents = new Map(files.reagents.reagents.map((r) => [r.id, r.name]));
  const entities = new Map(files.entities.entities.map((e) => [e.id, e.name]));
  return {
    reagent: (id: string) => displayName(reagents.get(id) ?? id),
    item: (id: string) => displayName(entities.get(id) ?? id),
  };
}

function reactionLine(r: Reaction, name: (id: string) => string): string {
  const inputs = Object.entries(r.reactants)
    .map(([id, x]) => `${formatAmount(x.amount)}u ${name(id)}${x.catalyst ? " (catalyst)" : ""}`)
    .join(" + ");
  const out = Object.entries(r.products)
    .map(([id, n]) => `${formatAmount(n)}u ${name(id)}`)
    .join(" + ");
  const conditions = [
    r.minTemp !== null && `heat to ≥ ${formatAmount(r.minTemp)} K`,
    r.maxTemp !== null && `keep ≤ ${formatAmount(r.maxTemp)} K`,
    r.mixers.length > 0 && `mixing: ${r.mixers.join(" + ")}`,
  ].filter(Boolean);
  return `${inputs} → ${out}${conditions.length ? ` (${conditions.join(", ")})` : ""}`;
}

export function describeSubject(
  files: SnapshotFiles,
  subject: Subject,
): { title: string; description: string } | null {
  const n = names(files);
  if (subject.kind === "reagent") {
    const r = files.reagents.reagents.find((x) => x.id === subject.id);
    if (!r) return null;
    const recipe = files.recipes.reactions.find(
      (x) => subject.id in x.products && !(subject.id in x.reactants),
    );
    return {
      title: displayName(r.name),
      description: recipe
        ? `${displayName(r.name)}: ${reactionLine(recipe, n.reagent)}`
        : (r.desc ?? `${displayName(r.name)} (${r.group ?? "reagent"})`),
    };
  }
  const recipe = files.recipes.cooking.find((c) => c.result === subject.id);
  if (!recipe) return null;
  const inputs = [
    ...Object.entries(recipe.solids).map(([id, k]) => `${k}× ${n.item(id)}`),
    ...Object.entries(recipe.reagents).map(([id, k]) => `${formatAmount(k)}u ${n.reagent(id)}`),
  ].join(" + ");
  return {
    title: n.item(subject.id),
    description: `${recipe.device}: ${inputs}, ${recipe.time ?? 0} s`,
  };
}

export function SubjectArticle({
  files,
  server,
  subject,
}: {
  files: SnapshotFiles;
  server: ServerInfo;
  subject: Subject;
}) {
  const n = names(files);
  const reactions =
    subject.kind === "reagent"
      ? files.recipes.reactions.filter(
          (r) => subject.id in r.products && !(subject.id in r.reactants),
        )
      : [];
  const cooking =
    subject.kind === "item" ? files.recipes.cooking.filter((c) => c.result === subject.id) : [];
  const reagent =
    subject.kind === "reagent"
      ? files.reagents.reagents.find((r) => r.id === subject.id)
      : undefined;
  const entity =
    subject.kind === "item" ? files.entities.entities.find((e) => e.id === subject.id) : undefined;
  const title = subject.kind === "reagent" ? n.reagent(subject.id) : n.item(subject.id);

  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <p className="text-sm text-fg-muted">
        <Link href={`/${server.id}`} className="underline underline-offset-4">
          {server.name}
        </Link>{" "}
        · ss14help
      </p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {(reagent?.desc ?? entity?.desc) && (
        <p className="text-fg-muted">{reagent?.desc ?? entity?.desc}</p>
      )}
      {reactions.length > 0 && (
        <section>
          <h2 className="mb-1 font-medium">Recipes</h2>
          <ul className="list-disc space-y-1 pl-5 font-mono text-sm">
            {reactions.map((r) => (
              <li key={r.id}>{reactionLine(r, n.reagent)}</li>
            ))}
          </ul>
        </section>
      )}
      {cooking.length > 0 && (
        <section>
          <h2 className="mb-1 font-medium">Cooking</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {cooking.map((c) => (
              <li key={c.id}>
                {c.device}, {c.time ?? 0} s:{" "}
                {[
                  ...Object.entries(c.solids).map(([id, k]) => `${k}× ${n.item(id)}`),
                  ...Object.entries(c.reagents).map(
                    ([id, k]) => `${formatAmount(k)}u ${n.reagent(id)}`,
                  ),
                ].join(" + ")}
              </li>
            ))}
          </ul>
        </section>
      )}
      {reactions.length === 0 && cooking.length === 0 && (
        <p className="text-sm text-fg-muted">Basic ingredient: not made by any recipe.</p>
      )}
      <noscript>
        <p className="text-sm text-fg-muted">
          Enable JavaScript for the calculator, ingredient trees and search.
        </p>
      </noscript>
    </article>
  );
}

/** Server landing content: what each server has, with links to every subject page. */
export function ServerArticle({ files, server }: { files: SnapshotFiles; server: ServerInfo }) {
  const items = [...new Set(files.recipes.cooking.map((c) => c.result))];
  const n = names(files);
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{server.name} recipes</h1>
      <p className="text-fg-muted">
        {files.recipes.reactions.length} chemical reactions, {files.recipes.cooking.length} cooking
        recipes and {files.reagents.reagents.length} reagents from{" "}
        {server.repo.replace("https://github.com/", "")}.
      </p>
      <details>
        <summary className="cursor-pointer text-sm">All reagents</summary>
        <ul className="mt-2 columns-2 text-sm sm:columns-3">
          {files.reagents.reagents.map((r) => (
            <li key={r.id}>
              <Link href={`/${server.id}/reagent/${encodeURIComponent(r.id)}`}>
                {displayName(r.name)}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="cursor-pointer text-sm">All dishes</summary>
        <ul className="mt-2 columns-2 text-sm sm:columns-3">
          {items.map((id) => (
            <li key={id}>
              <Link href={`/${server.id}/item/${encodeURIComponent(id)}`}>{n.item(id)}</Link>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
