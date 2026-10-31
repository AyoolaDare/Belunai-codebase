#!/usr/bin/env node
// Access to the hosted `belunai-test` Supabase project (REV-03) for verification.
// Database tests run there inside transactions that are always rolled back;
// nothing here drops, resets or writes outside a rolled-back transaction.
// Usage: npm run test:db:hosted  (needs SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_DB_CA_CERT; see docs/development.md)
import { readdirSync } from "node:fs";
import pg from "pg";

export const HOSTED = process.env.BELUNAI_DB_TARGET === "hosted";

/** Supabase project ref from a direct (db.<ref>.supabase.co) or pooler (postgres.<ref>) URL. */
export function projectRefFromDbUrl(url) {
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
  if (direct) return direct[1];
  const pooler = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(url.username));
  if (pooler && url.hostname.endsWith(".pooler.supabase.com")) return pooler[1];
  return null;
}

/**
 * SUPABASE_DB_URL, accepted only when it names the same project as
 * NEXT_PUBLIC_SUPABASE_URL, so a mistyped secret cannot point tests elsewhere.
 */
export function hostedDatabaseUrl() {
  const raw = process.env.SUPABASE_DB_URL;
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || !api) throw new Error("SUPABASE_DB_URL and NEXT_PUBLIC_SUPABASE_URL must both be set.");
  const url = new URL(raw);
  const ref = projectRefFromDbUrl(url);
  const apiRef = /^([a-z0-9]{20})\.supabase\.co$/.exec(new URL(api).hostname)?.[1];
  if (!ref || !apiRef) throw new Error("SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL.");
  if (ref !== apiRef) throw new Error("SUPABASE_DB_URL and NEXT_PUBLIC_SUPABASE_URL name different projects.");
  return url;
}

/**
 * Client options for the hosted database. TLS is always verified against the
 * Supabase CA certificate (public, not a secret) in SUPABASE_DB_CA_CERT.
 */
export function hostedClientConfig() {
  const url = hostedDatabaseUrl();
  const ca = process.env.SUPABASE_DB_CA_CERT;
  if (!ca || !ca.includes("BEGIN CERTIFICATE")) {
    throw new Error(
      "SUPABASE_DB_CA_CERT must hold the Supabase CA certificate (PEM) from Project Settings → Database → SSL configuration.",
    );
  }
  url.searchParams.delete("sslmode"); // pg would otherwise override `ssl` below
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}

/** Fails unless the hosted migration history equals the local migration files. */
export async function verifyHostedMigrations() {
  const local = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => f.split("_")[0]);
  const client = new pg.Client(hostedClientConfig());
  await client.connect();
  try {
    const { rows } = await client.query(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    const remote = rows.map((r) => r.version);
    if (JSON.stringify(remote) !== JSON.stringify(local)) {
      throw new Error(
        `Hosted migration history differs from supabase/migrations.\n  local:  ${local.join(", ")}\n  hosted: ${remote.join(", ") || "(none)"}\nRun \`npm run db:push\` first.`,
      );
    }
    return remote;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyHostedMigrations()
    .then((v) => console.log(`Hosted project has all ${v.length} migrations applied.`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
