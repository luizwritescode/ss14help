import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-semibold">Lost in space</h1>
      <p className="text-fg-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="text-accent underline underline-offset-4">
        Back to ss14help
      </Link>
    </main>
  );
}
