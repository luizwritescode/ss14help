import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { describeSubject, SubjectArticle } from "@/components/static/subject-article";
import { Workspace } from "@/components/workspace/workspace";
import { readSnapshot, subjectIds } from "@/lib/server-data";
import { findServer, SERVERS } from "@/lib/servers";
import type { SubjectKind } from "@/lib/subjects";

/** Shared by /[server]/reagent/[id] and /[server]/item/[id] (statically generated). */
export async function subjectParams(kind: "reagent" | "item") {
  const out: { server: string; id: string }[] = [];
  for (const s of SERVERS) {
    const ids = await subjectIds(s.id);
    for (const id of kind === "reagent" ? ids.reagents : ids.items) out.push({ server: s.id, id });
  }
  return out;
}

export async function subjectMetadata(
  kind: SubjectKind,
  serverId: string,
  rawId: string,
): Promise<Metadata> {
  const server = findServer(serverId);
  if (!server) return {};
  const id = decodeURIComponent(rawId);
  const info = describeSubject(await readSnapshot(server.id), { kind, id });
  if (!info) return {};
  return {
    title: `${info.title} — ${server.name}`,
    description: info.description,
    alternates: { canonical: `/${server.id}/${kind}/${encodeURIComponent(id)}` },
  };
}

export async function SubjectPage({
  kind,
  serverId,
  rawId,
}: {
  kind: "reagent" | "item";
  serverId: string;
  rawId: string;
}) {
  const server = findServer(serverId);
  if (!server) notFound();
  const id = decodeURIComponent(rawId);
  const files = await readSnapshot(server.id);
  if (!describeSubject(files, { kind, id })) notFound();
  const subject = { kind, id };
  const article = <SubjectArticle files={files} server={server} subject={subject} />;
  return (
    <Suspense fallback={article}>
      <Workspace serverId={server.id} initialSubject={subject}>
        {article}
      </Workspace>
    </Suspense>
  );
}
