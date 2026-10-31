import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
        BELUNAI
      </Link>
      <main
        id="main"
        tabIndex={-1}
        className="mt-8 w-full max-w-md rounded-xl border border-border bg-surface p-6"
      >
        {children}
      </main>
    </div>
  );
}
