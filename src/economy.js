"use strict";
const Decimal = require("decimal.js");
const { byId } = require("./catalog");
Decimal.set({ precision: 1024, rounding: Decimal.ROUND_DOWN, toExpNeg: -100000, toExpPos: 100000 });
const GROWTH = new Decimal("1.03");
const ZERO = new Decimal(0);
const PRESTIGE_REQUIREMENT = new Decimal("1000000000");

function dec(value) {
  return new Decimal(String(value));
}
function asInteger(value) {
  return dec(value).floor().toFixed(0);
}
function prestigeMultiplier(prestige, orbs = 0, investor = 0) {
  return new Decimal(1).plus(new Decimal(prestige).times("0.25"))
    .plus(new Decimal(orbs).times("0.10")).plus(new Decimal(investor).times("0.03"));
}
function generatorRate(rows, prestige = 0, orbs = 0, investor = 0) {
  let rate = ZERO;
  for (const row of rows) {
    const entry = byId.get(String(row.generator_id).toUpperCase());
    if (entry) rate = rate.plus(dec(entry.income).times(row.quantity));
  }
  return rate.times(prestigeMultiplier(prestige, orbs, investor)).floor();
}
function purchaseCost(baseCost, owned, amount) {
  if (!Number.isSafeInteger(owned) || owned < 0 || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000) {
    throw new Error("Invalid generator quantity");
  }
  return dec(baseCost).times(GROWTH.pow(owned)).times(GROWTH.pow(amount).minus(1)).div(GROWTH.minus(1)).ceil();
}
// The cost curve is monotonic. Binary search avoids linear loops and never approximates IC.
function maxAffordable(baseCost, owned, balance, maxBatch = 1000) {
  if (!Number.isSafeInteger(owned) || owned < 0 || owned > 10000 ||
      !Number.isSafeInteger(maxBatch) || maxBatch < 1 || maxBatch > 1000)
    throw new Error("Invalid generator quantity");
  let low = 0, high = Math.min(maxBatch, 10000 - owned);
  const wallet = dec(balance);
  if (!wallet.isFinite() || wallet.lt(0)) return 0;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (purchaseCost(baseCost, owned, mid).lte(wallet)) low = mid;
    else high = mid - 1;
  }
  return low;
}
function settle(balance, totalEarned, rate, lastSettledAt, now) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(lastSettledAt).getTime());
  const seconds = Math.floor(elapsedMs / 1000);
  const earned = dec(rate).times(seconds);
  return {
    balance: dec(balance).plus(earned),
    totalEarned: dec(totalEarned).plus(earned),
    earned,
    // Preserve sub-second remainder so polling cannot erase earned time.
    settledAt: new Date(new Date(lastSettledAt).getTime() + seconds * 1000)
  };
}
// From 1e33 onward, use the alphabetic notation common in idle games:
// 1e33 = 1aa, 1e36 = 1ab, ... 1e222 = 1cl. Extends to aaa, aab, etc.
const SHORT_SUFFIXES = Object.freeze(["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"]);
function magnitudeSuffix(group) {
  if (!Number.isSafeInteger(group) || group < 1) throw new Error("Invalid magnitude");
  if (group <= SHORT_SUFFIXES.length) return SHORT_SUFFIXES[group - 1];
  let column = group + 16; // Excel-style: column 27 = aa, column 90 = cl.
  let letters = "";
  while (column > 0) {
    column -= 1;
    letters = String.fromCharCode(97 + column % 26) + letters;
    column = Math.floor(column / 26);
  }
  return letters;
}
function pretty(value) {
  const n = dec(value);
  const abs = n.abs();
  if (abs.lt(1000)) return n.floor().toFixed(0);
  const group = Math.floor(abs.e / 3);
  const scaled = n.div(new Decimal(1000).pow(group)).toDecimalPlaces(2);
  return scaled.toString() + magnitudeSuffix(group);
}
module.exports = { Decimal, dec, asInteger, prestigeMultiplier, generatorRate, purchaseCost, maxAffordable, settle, pretty, magnitudeSuffix, PRESTIGE_REQUIREMENT };
