/**
 * Honest placeholder for a screen whose feature has not been built.
 * It offers no controls, so nothing can look like it works when it does not.
 */
export function NotYetAvailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section aria-labelledby="page-title" className="mx-auto w-full max-w-2xl">
      <h1 id="page-title" className="text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <div
        role="status"
        className="mt-6 rounded-xl border border-border bg-surface p-6"
      >
        <p className="font-medium">This part of BELUNAI isn&apos;t available yet.</p>
        <p className="mt-2 text-muted">{description}</p>
      </div>
    </section>
  );
}
