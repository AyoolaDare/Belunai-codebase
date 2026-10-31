import Link from "next/link";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-primary">
            BELUNAI
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-full px-4 font-medium text-primary hover:bg-primary/10"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted">
        BELUNAI · Nigeria
      </footer>
    </div>
  );
}
