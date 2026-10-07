import { SubjectPage, subjectMetadata, subjectParams } from "../../subject-page";

export function generateStaticParams() {
  return subjectParams("item");
}

export async function generateMetadata({ params }: PageProps<"/[server]/item/[id]">) {
  const { server, id } = await params;
  return subjectMetadata("item", server, id);
}

export default async function Page({ params }: PageProps<"/[server]/item/[id]">) {
  const { server, id } = await params;
  return <SubjectPage kind="item" serverId={server} rawId={id} />;
}
