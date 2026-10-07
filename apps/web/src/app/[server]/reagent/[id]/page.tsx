import { SubjectPage, subjectMetadata, subjectParams } from "../../subject-page";

export function generateStaticParams() {
  return subjectParams("reagent");
}

export async function generateMetadata({ params }: PageProps<"/[server]/reagent/[id]">) {
  const { server, id } = await params;
  return subjectMetadata("reagent", server, id);
}

export default function Page({ params }: PageProps<"/[server]/reagent/[id]">) {
  return <SubjectPage kind="reagent" params={params} />;
}
