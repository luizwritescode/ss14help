import { RedirectToLastServer } from "./redirect";
import Link from "next/link";
import { SERVERS } from "@/lib/servers";

/** `/` → the last-used server (client side), else the default. Links for no-JS visitors. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <RedirectToLastServer />
      <h1 className="text-2xl font-semibold">ss14help</h1>
      <p className="text-fg-muted">Choose a server:</p>
      <ul className="space-y-2">
        {SERVERS.map((s) => (
          <li key={s.id}>
            <Link href={`/${s.id}`} className="text-accent underline underline-offset-4">
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
