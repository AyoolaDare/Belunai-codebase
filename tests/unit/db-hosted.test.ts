// The hosted target must only accept the configured belunai-test project.
import { afterEach, describe, expect, it, vi } from "vitest";
import { hostedClientConfig, hostedDatabaseUrl, projectRefFromDbUrl } from "../../scripts/db-hosted.mjs";

const REF = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";
const CA = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

afterEach(() => vi.unstubAllEnvs());

function env(db: string, ca = CA) {
  vi.stubEnv("SUPABASE_DB_URL", db);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${REF}.supabase.co`);
  vi.stubEnv("SUPABASE_DB_CA_CERT", ca);
}

describe("hosted database target", () => {
  it("reads the project ref from direct and pooler URLs", () => {
    expect(projectRefFromDbUrl(new URL(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`))).toBe(REF);
    expect(
      projectRefFromDbUrl(new URL(`postgresql://postgres.${REF}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`)),
    ).toBe(REF);
    expect(projectRefFromDbUrl(new URL("postgresql://postgres:pw@localhost:5432/postgres"))).toBeNull();
    expect(projectRefFromDbUrl(new URL(`postgresql://postgres.${REF}:pw@evil.example.com:5432/postgres`))).toBeNull();
  });

  it("accepts a database URL for the same project as the API URL", () => {
    env(`postgresql://postgres.${REF}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`);
    expect(hostedDatabaseUrl().hostname).toBe("aws-0-eu-west-2.pooler.supabase.com");
  });

  it("refuses a database URL for a different project", () => {
    env(`postgresql://postgres:pw@db.${OTHER}.supabase.co:5432/postgres`);
    expect(() => hostedDatabaseUrl()).toThrow(/different projects/);
  });

  it("refuses non-Supabase hosts and missing variables", () => {
    env("postgresql://postgres:pw@localhost:5432/belunai_test");
    expect(() => hostedDatabaseUrl()).toThrow(/not a Supabase project URL/);
    vi.stubEnv("SUPABASE_DB_URL", "");
    expect(() => hostedDatabaseUrl()).toThrow(/must both be set/);
  });

  it("always verifies TLS against the Supabase CA", () => {
    env(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres?sslmode=require`);
    const config = hostedClientConfig();
    expect(config.ssl).toEqual({ ca: CA, rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
    env(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`, "");
    expect(() => hostedClientConfig()).toThrow(/SUPABASE_DB_CA_CERT/);
  });
});
