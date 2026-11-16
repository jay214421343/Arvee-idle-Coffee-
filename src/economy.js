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
function pretty(value) {
  const n = dec(value);
  const abs = n.abs();
  if (abs.lt(1000)) return n.floor().toFixed(0);
  const suffixes = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
  const exponent = abs.e;
  const group = Math.floor(exponent / 3);
  if (group <= suffixes.length) return n.div(new Decimal(1000).pow(group)).toDecimalPlaces(2).toString() + suffixes[group - 1];
  return n.toExponential(3);
}
module.exports = { Decimal, dec, asInteger, prestigeMultiplier, generatorRate, purchaseCost, settle, pretty, PRESTIGE_REQUIREMENT };
