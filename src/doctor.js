"use strict";
const { assertNodeVersion, validateDatabaseUrl, validateDiscord, projectRoot } = require("./config");
async function main() {
  assertNodeVersion();
  const target = validateDatabaseUrl();
  validateDiscord();
  const { pool } = require("./store");
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS role, " +
      "to_regclass('public.players') AS players, to_regclass('public.inventory') AS inventory, " +
      "to_regclass('public.player_perks') AS perks"
    );
    const state = result.rows[0];
    if (state.database !== target.database) throw new Error("Connected to a different PostgreSQL database than configured.");
    if (!state.players || !state.inventory || !state.perks) {
      throw new Error("The database is reachable, but the ARVEE Idle schema is missing. Run npm run db:migrate.");
    }
    console.log("[ARVEE Idle] Runtime: Node " + process.versions.node);
    console.log("[ARVEE Idle] Project: " + projectRoot);
    console.log("[ARVEE Idle] PostgreSQL: " + state.database + " (" + target.host + ":" + target.port + ", role " + state.role + ")");
    console.log("[ARVEE Idle] Discord configuration: present (token redacted)");
    console.log("[ARVEE Idle] Health check: PASS");
  } finally { await pool.end(); }
}
main().catch((error) => {
  console.error("[ARVEE Idle] Doctor: " + error.message);
  process.exitCode = 1;
});
