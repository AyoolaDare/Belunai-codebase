"use client";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-md flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p role="alert" className="mt-3 text-muted">
        We couldn&apos;t load this page. Please try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 min-h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
