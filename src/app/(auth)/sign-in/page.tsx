import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p role="status" className="mt-4 text-muted">
        Sign-in isn&apos;t available yet. Email, Google and phone sign-in will open with the
        pilot.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Back to the home page
      </Link>
    </>
  );
}
