// Local runs start from a freshly migrated disposable database. Hosted runs
// (BELUNAI_DB_TARGET=hosted) never reset; they first check that the hosted
// migration history matches supabase/migrations.
import { HOSTED, verifyHostedMigrations } from "../../scripts/db-hosted.mjs";
import { resetDatabase } from "../../scripts/db-reset.mjs";

export default async function setup() {
  try {
    if (HOSTED) await verifyHostedMigrations();
    else await resetDatabase();
  } catch (error) {
    // Vitest 5 can fail while formatting global-setup errors; print the reason first.
    console.error(`Database setup failed: ${(error as Error).message}`);
    throw error;
  }
}
