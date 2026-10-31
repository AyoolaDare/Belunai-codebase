#!/usr/bin/env node
// Fails when a credential-shaped value appears in tracked files or the built
// client bundle, or when a server-only variable name reaches the client bundle.
// Usage: node scripts/check-secrets.mjs [--client-only]
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const secretPatterns = [
  { name: "Supabase secret key", re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
];
// Names of server-only variables; their presence in client JS means a leak path.
const serverOnlyNames = [/SUPABASE_SECRET_KEY/, /SUPABASE_SERVICE_ROLE_KEY/];

const findings = [];

function scan(file, text, patterns) {
  for (const { name, re } of patterns) {
    if (re.test(text)) findings.push(`${file}: ${name}`);
  }
}

if (!process.argv.includes("--client-only")) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => existsSync(f) && f !== "scripts/check-secrets.mjs");
  for (const file of tracked) {
    if (statSync(file).size > 2_000_000) continue;
    scan(file, readFileSync(file, "utf8"), secretPatterns);
  }
}

const clientDir = ".next/static";
if (existsSync(clientDir)) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const namePatterns = serverOnlyNames.map((re) => ({ name: `server-only name ${re.source}`, re }));
  for (const file of walk(clientDir).filter((f) => f.endsWith(".js"))) {
    scan(file, readFileSync(file, "utf8"), [...secretPatterns, ...namePatterns]);
  }
} else {
  console.warn("No .next/static directory: run `npm run build` to scan the client bundle.");
}

if (findings.length > 0) {
  console.error("Possible secrets found:\n" + findings.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}
console.log("No secrets found in tracked files or client bundle.");
