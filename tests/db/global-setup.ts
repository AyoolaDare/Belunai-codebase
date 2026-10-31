// Every db test run starts from a freshly migrated disposable database.
import { resetDatabase } from "../../scripts/db-reset.mjs";

export default async function setup() {
  await resetDatabase();
}
