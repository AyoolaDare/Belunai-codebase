import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-md flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">This page isn&apos;t available</h1>
      <p className="mt-3 text-muted">
        The link may be wrong, or the page may have been removed or made private.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Go to the home page
      </Link>
    </main>
  );
}
