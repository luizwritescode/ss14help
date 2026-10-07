import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ServerArticle } from "@/components/static/subject-article";
import { Workspace } from "@/components/workspace/workspace";
import { readSnapshot } from "@/lib/server-data";
import { findServer, SERVERS } from "@/lib/servers";

export function generateStaticParams() {
  return SERVERS.map((s) => ({ server: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/[server]">): Promise<Metadata> {
  const { server: id } = await params;
  const server = findServer(id);
  return server
    ? {
        title: `${server.name} recipes`,
        description: `Chemistry and cooking recipes for ${server.name}, with an ingredient calculator.`,
      }
    : {};
}

// `params` is read inside Suspense so navigations stay instant; with
// generateStaticParams the prerendered HTML still contains the full page.
export default function ServerPage({ params }: PageProps<"/[server]">) {
  return (
    <Suspense>
      <ServerContent params={params} />
    </Suspense>
  );
}

async function ServerContent({ params }: { params: PageProps<"/[server]">["params"] }) {
  const { server: id } = await params;
  const server = findServer(id);
  if (!server) notFound();
  const article = <ServerArticle files={await readSnapshot(server.id)} server={server} />;
  return (
    <Suspense fallback={article}>
      <Workspace serverId={server.id}>{article}</Workspace>
    </Suspense>
  );
}
