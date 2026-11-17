"use strict";
const crypto = require("node:crypto");
const companions = require("./companions");
const BOSSES = Object.freeze([
  Object.freeze({ id: "hollow_guardian", name: "Hollow Guardian", description: "An ancient protector rises beneath the ruins.",
    hp: 2500, pool: 5000, itemId: "ore" }),
  Object.freeze({ id: "ashbound_titan", name: "Ashbound Titan", description: "A wandering giant scorches the wild frontier.",
    hp: 5000, pool: 10000, itemId: "silver" }),
  Object.freeze({ id: "starved_colossus", name: "Starved Colossus", description: "The void stirs within an abandoned citadel.",
    hp: 8500, pool: 16000, itemId: "gold" })
]);
const byId = new Map(BOSSES.map((b) => [b.id, b]));
const MONDAY_EPOCH = Date.UTC(2026, 10, 16);
const WEEK_MS = 7 * 86400000;
const COOLDOWN_MS = 10 * 60000;
function cycle(now = new Date()) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid boss date.");
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start.getTime() + WEEK_MS);
  const index = Math.floor((start.getTime() - MONDAY_EPOCH) / WEEK_MS);
  const boss = BOSSES[((index % BOSSES.length) + BOSSES.length) % BOSSES.length];
  return { key: start.toISOString().slice(0, 10).replace(/-/g, ""), start, end, boss };
}
function attackPower(state, pet = null) {
  const mining = Math.min(90, Math.floor(Math.max(0, Number(state.mineXp) || 0) / 5));
  const tier = Math.min(10, Math.max(0, Number(state.pickaxeTier) || 0));
  const prestige = Math.min(15, Math.max(0, Number(state.prestige) || 0));
  const base = Math.min(320, 45 + mining + tier * 14 + prestige * 10);
  return pet?.id === "ember_fox" ? Math.floor(base * (1 + companions.boostPct(pet.level) / 100)) : base;
}
function attackCooldownMs(pet = null) {
  return Math.round(COOLDOWN_MS * (pet?.id === "moss_wisp"
    ? 1 - companions.boostPct(pet.level) / 100 : 1));
}
function eligibility(boss, damage, attacks) {
  const minDamage = Math.max(80, Math.ceil(boss.hp * 0.015));
  return { eligible: attacks >= 2 && damage >= minDamage, minDamage, minAttacks: 2 };
}
function reward(boss, damage, attacks, owlPoints = 0, randomInt = (limit) => crypto.randomInt(limit)) {
  if (!byId.has(boss.id)) throw new Error("Unknown world boss.");
  const qualified = eligibility(boss, damage, attacks);
  if (!qualified.eligible || damage <= 0) return { eligible: false, ic: 0, itemId: boss.itemId, quantity: 0, rare: false };
  const dealt = Math.min(boss.hp, Math.floor(damage));
  const ic = Math.floor(boss.pool * dealt / boss.hp);
  const quantity = Math.max(1, Math.min(8, Math.ceil(dealt / boss.hp * 8)));
  // Owl modifiers are accumulated on actual attacks, never read from the pet equipped at claim time.
  const rareChanceBps = 500 + Math.max(0, Math.min(1950, Math.floor(owlPoints / dealt)));
  const rare = randomInt(10000) < rareChanceBps;
  return { eligible: true, ic, itemId: boss.itemId, quantity, rare, rareChanceBps };
}
module.exports = { BOSSES, byId, cycle, attackPower, attackCooldownMs, eligibility, reward,
  COOLDOWN_MS, WEEK_MS };
