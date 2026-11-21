"use strict";
// ARVEE owns membership records. Idle stores only permanent, non-tradeable cosmetics.
const EMPTY = Object.freeze({ available: false, membership: null, rpg: null });
const snapshots = new (require("node:async_hooks").AsyncLocalStorage)();
function withAccount(userId, data, operation) { return snapshots.run({userId,data},operation); }
function connection(environment = process.env) {
  const url = environment.ARVEE_ECOSYSTEM_URL;
  const key = environment.ARVEE_ECOSYSTEM_KEY;
  if (!url && !key) return null;
  if (!url || !key || key.length < 32) throw new Error("Configure ARVEE_ECOSYSTEM_URL and a 32+ character ARVEE_ECOSYSTEM_KEY together.");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)))
    throw new Error("Ecosystem transport requires HTTPS or loopback HTTP.");
  return { url: parsed.origin, key };
}
async function account(userId, { fetch: fetcher = globalThis.fetch, environment = process.env } = {}) {
  const snapshot = snapshots.getStore();
  if (snapshot?.userId === userId) return snapshot.data;
  const config = connection(environment);
  if (!config) return EMPTY;
  try {
    const response = await fetcher(`${config.url}/internal/idle/accounts/${userId}`, {
      headers: { "x-arvee-ecosystem-key": config.key }, signal: AbortSignal.timeout(4000), redirect: "error"
    });
    if (!response.ok) return EMPTY;
    const data = await response.json();
    if (data.userId !== userId || data.version !== 1) return EMPTY;
    return { available: true, membership: data.membership || null, rpg: data.rpg || null, sharedBoost:data.sharedBoost||null };
  } catch { return EMPTY; } // An outage never blocks free gameplay or grants paid access.
}
function earnedCosmetics(data) {
  const rpg = data?.rpg;
  if (!rpg) return [];
  return [rpg.level >= 25 ? "realm_traveler" : null, rpg.prestige >= 1 ? "cycle_companion" : null].filter(Boolean);
}
const COSMETICS = Object.freeze({ realm_traveler: "Realm Traveler", cycle_companion: "Cycle Companion" });
async function synchronize(db, userId, data) {
  for (const id of earnedCosmetics(data)) await db.query(
    "INSERT INTO ecosystem_cosmetics(user_id,cosmetic_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [userId,id]);
  const rows = (await db.query("SELECT cosmetic_id FROM ecosystem_cosmetics WHERE user_id=$1 ORDER BY cosmetic_id", [userId])).rows;
  return { ...data, cosmetics: rows.map(row => ({ id: row.cosmetic_id, name: COSMETICS[row.cosmetic_id] })) };
}
async function milestones(pool, userId) {
  // Read only: checking an absent account must not create a player or settle income.
  const row = (await pool.query("SELECT prestige,mine_xp FROM players WHERE user_id=$1 AND NOT EXISTS (SELECT 1 FROM admin_suspensions WHERE user_id=$1)", [userId])).rows[0];
  return { userId, version: 1, idle: row ? { prestige: Number(row.prestige), mineXp: Number(row.mine_xp) } : null };
}
module.exports = { connection, account, withAccount, earnedCosmetics, synchronize, milestones, COSMETICS };
