"use strict";
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { coffee } = require("./commands");
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) throw new Error("Set DISCORD_TOKEN and DISCORD_CLIENT_ID before registering commands.");
  const guildId = process.env.DISCORD_GUILD_ID;
  const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(route, { body: [coffee.toJSON()] });
  console.log("[Coffee] Registered slash commands " + (guildId ? "in guild " + guildId : "globally"));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
