"use strict";
const { assertNodeVersion, validateDatabaseUrl } = require("./config");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./store");
async function main() {
  assertNodeVersion();
  const target = validateDatabaseUrl();
  const sql = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    // Prevent simultaneous migrations of this dedicated database.
    await db.query("SELECT pg_advisory_xact_lock(208786123, 16277)");
    await db.query(sql);
    await db.query("COMMIT");
    console.log("[ARVEE Idle] PostgreSQL schema ready in " + target.database);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}
main().catch(async (error) => {
  console.error("[ARVEE Idle] Migration failed:", error.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
