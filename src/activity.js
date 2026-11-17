"use strict";
const MINE_BASE_MS = 90 * 1000;
const MINE_STEP_MS = 6 * 1000;
const MINE_MIN_MS = 30 * 1000;
const DAILY_MS = 22 * 60 * 60 * 1000;
function miningCooldownMs(perks = []) {
  const level = Number(perks.find((p) => p.perk_id === "sprinter")?.level || 0);
  return Math.max(MINE_MIN_MS, MINE_BASE_MS - MINE_STEP_MS * Math.max(0, level));
}
function readiness(lastAt, durationMs, now = Date.now()) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("Invalid activity cooldown.");
  if (lastAt === null || lastAt === undefined) return { ready: true, seconds: 0, readyAt: null };
  const last = new Date(lastAt).getTime();
  if (!Number.isFinite(last)) return { ready: true, seconds: 0, readyAt: null };
  const readyAt = Math.ceil((last + durationMs) / 1000);
  const seconds = Math.max(0, Math.ceil((last + durationMs - now) / 1000));
  return { ready: seconds === 0, seconds, readyAt };
}
function playerReadiness(player, now = Date.now()) {
  return {
    mine: readiness(player.lastMine, miningCooldownMs(player.perks), now),
    daily: readiness(player.lastDaily, DAILY_MS, now)
  };
}
module.exports = { MINE_BASE_MS, MINE_STEP_MS, MINE_MIN_MS, DAILY_MS, miningCooldownMs, readiness, playerReadiness };
