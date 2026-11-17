"use strict";
const { assertNodeVersion, validateDiscord } = require("./config");
const { REST, Routes } = require("discord.js");
const { idle } = require("./commands");
const { adminCommand } = require("./admin-command");
const { ADMIN_GUILD_ID } = require("./admin-auth");
async function main() {
  assertNodeVersion();
  const { guildId } = validateDiscord();
  const clientId = process.env.DISCORD_CLIENT_ID;
  const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  // POST upserts just /idle. Bulk PUT would remove every other command in this scope.
  await rest.post(route, { body: idle.toJSON() });
  console.log("[ARVEE Idle] /idle registered " + (guildId ? "in test guild " + guildId : "globally"));
  // /admin is *never* globally registered or registered in the /idle test scope.
  await rest.post(Routes.applicationGuildCommands(clientId, ADMIN_GUILD_ID),
    { body: adminCommand.toJSON() });
  console.log("[ARVEE Idle] /admin registered only in guild " + ADMIN_GUILD_ID);
  if (process.argv.includes("--remove-legacy-coffee")) {
    const commands = await rest.get(route);
    const legacy = commands.find((entry) => entry.name === "coffee" && entry.type === 1);
    if (legacy) {
      await rest.delete(route + "/" + legacy.id);
      console.log("[ARVEE Idle] Removed legacy /coffee command from this application/scope");
    }
  }
}
main().catch((error) => {
  console.error("[ARVEE Idle] Command registration failed:", error.message);
  process.exitCode = 1;
});
