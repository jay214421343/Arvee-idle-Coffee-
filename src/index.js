"use strict";
const { assertNodeVersion, validateDatabaseUrl, validateDiscord } = require("./config");
assertNodeVersion();
validateDatabaseUrl();
validateDiscord();
const { Client, GatewayIntentBits, Events, MessageFlags } = require("discord.js");
const { pool } = require("./store");
const { respond, handleAutocomplete, handleComponent } = require("./commands");
const { respondAdmin, handleAdminAutocomplete } = require("./admin-command");
const brand = require("./brand");

async function main() {
  await pool.query("SELECT 1 FROM players LIMIT 1"); // Refuse to log in before migrations are complete.
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let closing = false;
  let heartbeatErrors = 0;
  let heartbeat;
  async function shutdown(exitCode = 0) {
    if (closing) return;
    closing = true;
    if (heartbeat) clearInterval(heartbeat);
    client.destroy();
    try { await pool.end(); } catch (error) { console.error("[ARVEE Idle] Shutdown:", error.message); }
    process.exitCode = exitCode;
  }
  client.once(Events.ClientReady, (ready) => {
    console.info("[ARVEE Idle] Connected as " + ready.user.tag + " (" + ready.user.id + ")");
    if (typeof process.send === "function") process.send("ready"); // PM2 wait_ready.
    heartbeat = setInterval(async () => {
      if (closing) return;
      try {
        await pool.query("SELECT 1");
        heartbeatErrors = 0;
      } catch (error) {
        heartbeatErrors++;
        console.error("[ARVEE Idle] Database heartbeat " + heartbeatErrors + "/3:", error.message);
        if (heartbeatErrors >= 3) await shutdown(1);
      }
    }, 60000);
    heartbeat.unref();
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (closing) return;
    const runner = interaction.isAutocomplete() ?
      (interaction.commandName === "admin" ? handleAdminAutocomplete(interaction) : handleAutocomplete(interaction)) :
      interaction.isButton() || interaction.isStringSelectMenu() ? handleComponent(interaction) :
      interaction.commandName === "admin" ? respondAdmin(interaction) : respond(interaction);
    void runner.catch(async (error) => {
      console.error("[ARVEE Idle] Interaction failed:", error.message);
      const payload = {
        content: "ARVEE Idle could not complete that action. Please retry.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] }
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    });
  });
  client.on(Events.Error, (error) => console.error("[ARVEE Idle] Discord:", error.message));
  process.once("SIGTERM", () => { void shutdown(0); });
  process.once("SIGINT", () => { void shutdown(0); });
  await client.login(process.env.DISCORD_TOKEN);
}
main().catch(async (error) => {
  console.error("[ARVEE Idle] Startup failed:", error.message);
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
