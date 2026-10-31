"use client";

import "./globals.css";

// Replaces the root layout when it fails, so it must render html and body.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p role="alert" className="mt-3 text-muted">
            BELUNAI couldn&apos;t load. Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 min-h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
