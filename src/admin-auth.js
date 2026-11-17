"use strict";
// Private owner and server binding. Authorization is enforced on every request,
// including autocomplete, and is independent of Discord channel permissions.
const OWNER_ID = "801148038269763644";
const ADMIN_GUILD_ID = "1391028658835034243";
function isAdmin(actorId,guildId) {
  return String(actorId) === OWNER_ID && String(guildId) === ADMIN_GUILD_ID;
}
function requireAdmin(actorId,guildId) {
  if (!isAdmin(actorId,guildId)) throw new Error("This command is available only to the ARVEE Idle owner in the administration server.");
}
module.exports = { OWNER_ID, ADMIN_GUILD_ID, isAdmin, requireAdmin };
