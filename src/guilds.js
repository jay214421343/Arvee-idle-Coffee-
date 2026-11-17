"use strict";
const MAX_LEVEL = 20;
const MAX_HALL = 5;
const DAILY_XP_CAP = 250;
const XP_BY_EVENT = Object.freeze({
  mine: 2, daily: 12, craft: 5, expedition_complete: 20,
  world_boss_attack: 25, world_boss_reward: 35, companion_hatch: 5
});
function validName(name) {
  const raw = String(name || "");
  if (/[\r\n\t\p{Cc}]/u.test(raw)) throw new Error("Guild name contains invalid whitespace or control characters.");
  const value = raw.trim().replace(/ +/g, " ");
  if (value.length < 3 || value.length > 26 || !/^[\p{L}\p{N}][\p{L}\p{N} '.-]*$/u.test(value))
    throw new Error("Guild name must be 3–26 characters, using letters, numbers, spaces, apostrophes, periods or hyphens.");
  return value;
}
function validTag(tag) {
  const value = String(tag || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(value)) throw new Error("Guild tag must be 2–5 letters or numbers.");
  return value;
}
function validGuildId(id) {
  const value = String(id || "");
  if (!/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
    throw new Error("Invalid guild ID.");
  return value;
}
function xpForLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL)
    throw new Error("Invalid guild level.");
  return (level - 1) ** 2 * 100;
}
function level(xp) {
  const value = Number(xp);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid guild XP.");
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(value / 100)) + 1);
}
function xpForEvent(type, metadata = {}) {
  const base = XP_BY_EVENT[type] || 0;
  if (type === "craft") return Math.min(25, base * Math.max(1, Math.min(5,
    Number.isSafeInteger(metadata.quantity) ? metadata.quantity : 1)));
  return base;
}
function hallCost(current) {
  if (!Number.isInteger(current) || current < 0 || current >= MAX_HALL)
    throw new Error("Guild Hall is already at the maximum tier.");
  return (current + 1) * 100;
}
function capacity(hall = 0) { return 12 + hall * 4; }
function mineMultiplier(hall = 0) { return 1 + Math.max(0, Math.min(MAX_HALL, hall)) * 0.01; }
function attackMultiplier(hall = 0) { return 1 + Math.max(0, Math.min(MAX_HALL, hall)) * 0.02; }
function roleCanManage(role, action) {
  if (action === "invite" || action === "kick") return role === "leader" || role === "officer";
  return role === "leader";
}
module.exports = { MAX_LEVEL, MAX_HALL, DAILY_XP_CAP, validName, validTag, validGuildId,
  xpForLevel, level, xpForEvent, hallCost, capacity, mineMultiplier, attackMultiplier, roleCanManage };
