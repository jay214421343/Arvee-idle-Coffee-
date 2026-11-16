"use strict";
require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { pool } = require("./store");
const { respond, handleComponent } = require("./commands");
async function main() {
  if (!process.env.DISCORD_TOKEN || !process.env.DATABASE_URL) throw new Error("Set DISCORD_TOKEN and DATABASE_URL in .env first.");
  await pool.query("SELECT 1 FROM players LIMIT 1"); // Fail fast if schema wasn't migrated.
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, (ready) => console.log("[Coffee] Online as " + ready.user.tag));
  client.on(Events.InteractionCreate, (interaction) => {
    const runner = interaction.isButton() || interaction.isStringSelectMenu() ? handleComponent(interaction) : respond(interaction);
    void runner.catch((error) => console.error("[Discord interaction]", error));
  });
  client.on(Events.Error, (error) => console.error("[Discord]", error));
  await client.login(process.env.DISCORD_TOKEN);
  const shutdown = async () => {
    client.destroy();
    await pool.end();
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}
main().catch(async (error) => {
  console.error("[Coffee] Fatal startup error", error);
  await pool.end().catch(console.error);
  process.exitCode = 1;
});
