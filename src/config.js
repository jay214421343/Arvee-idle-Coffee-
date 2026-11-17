"use strict";
const path = require("node:path");
const dotenv = require("dotenv");
const projectRoot = path.resolve(__dirname, "..");
const envFile = path.join(projectRoot, ".env");
dotenv.config({ path: envFile });

const SNOWFLAKE = /^[0-9]{15,22}$/;
function assertNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error("ARVEE Idle requires Node.js >=22.12.0. Select the ARVEE Node 22.23.5 runtime.");
  }
}
function validateDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL in ARVEE Idle's own .env file.");
  let address;
  try { address = new URL(raw); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL."); }
  if (!["postgresql:", "postgres:"].includes(address.protocol)) throw new Error("DATABASE_URL must use postgresql://.");
  const name = decodeURIComponent(address.pathname.replace(/^\/+/, ""));
  if (!name || !/(idle|coffee)/i.test(name) || /^(postgres|template0|template1|arvee_hub|arvee_game)$/i.test(name)) {
    throw new Error("Refusing to use a database that is not dedicated to ARVEE Idle. Use 'arvee_idle'.");
  }
  if (process.env.HUB_DATABASE_URL && raw === process.env.HUB_DATABASE_URL) {
    throw new Error("ARVEE Idle cannot use ARVEE HUB_DATABASE_URL.");
  }
  return { database: name, host: address.hostname || "local", port: address.port || "5432" };
}
function validateDiscord() {
  if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.trim().length < 20) {
    throw new Error("Set DISCORD_TOKEN for ARVEE Idle's separate Discord application.");
  }
  if (!SNOWFLAKE.test(process.env.DISCORD_CLIENT_ID || "")) {
    throw new Error("Set a valid DISCORD_CLIENT_ID for the ARVEE Idle application.");
  }
  if (process.env.DISCORD_GUILD_ID && !SNOWFLAKE.test(process.env.DISCORD_GUILD_ID)) {
    throw new Error("DISCORD_GUILD_ID must be a valid test-server ID.");
  }
  return { guildId: process.env.DISCORD_GUILD_ID || null };
}
module.exports = { projectRoot, envFile, assertNodeVersion, validateDatabaseUrl, validateDiscord };
