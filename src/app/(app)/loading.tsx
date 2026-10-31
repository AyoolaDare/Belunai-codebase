export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-2xl">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded-md bg-border" />
      <div aria-hidden="true" className="mt-6 h-24 animate-pulse rounded-xl bg-border" />
    </div>
  );
}
