"use strict";
const { items } = require("./catalog");
// Activity counts are derived from committed economy events, not client-side counters.
const DAILY = Object.freeze([
  { id: "mining_route", label: "Morning Prospecting", event: "mine", metric: "count", goal: 3, reward: { kind: "ic", amount: 400 } },
  { id: "guild_growth", label: "Recruit New Allies", event: "generator_purchase", metric: "quantity", goal: 2, reward: { kind: "item", item: "lootbox", quantity: 1 } },
  { id: "camp_supplies", label: "Prepare the Camp", event: "daily", metric: "count", goal: 1, reward: { kind: "ic", amount: 300 } },
  { id: "cache_hunt", label: "Open Supply Caches", event: "open_lootbox", metric: "quantity", goal: 2, reward: { kind: "item", item: "ore", quantity: 5 } },
  { id: "forge_order", label: "Forge an Artifact", event: "craft", metric: "quantity", goal: 1, reward: { kind: "ic", amount: 450 } },
  { id: "deep_mining", label: "Deep Mining", event: "mine", metric: "count", goal: 6, reward: { kind: "item", item: "silver", quantity: 2 } }
].map((x) => Object.freeze(x)));
const WEEKLY = Object.freeze([
  { id: "weekly_prospector", label: "Expedition Prospector", event: "mine", metric: "count", goal: 20, reward: { kind: "ic", amount: 2000 } },
  { id: "weekly_recruitment", label: "Expand the Guild", event: "generator_purchase", metric: "quantity", goal: 10, reward: { kind: "item", item: "rare_lootbox", quantity: 1 } },
  { id: "weekly_provisions", label: "Keep the Camp Supplied", event: "daily", metric: "count", goal: 4, reward: { kind: "ic", amount: 2500 } },
  { id: "weekly_caches", label: "Uncover Relics", event: "open_lootbox", metric: "quantity", goal: 6, reward: { kind: "item", item: "gold", quantity: 2 } },
  { id: "weekly_forge", label: "Supply the Vanguard", event: "craft", metric: "quantity", goal: 4, reward: { kind: "ic", amount: 1800 } }
].map((x) => Object.freeze(x)));
function cycle(scope, now = new Date()) {
  if (scope !== "daily" && scope !== "weekly") throw new Error("Invalid challenge period.");
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid challenge date.");
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (scope === "weekly") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (scope === "daily" ? 1 : 7));
  const key = start.toISOString().slice(0, 10).replace(/-/g, "");
  // Two stable starter-friendly tasks; the final slot rotates each period.
  const index = Math.floor(start.getTime() / 86400000);
  const tasks = scope === "daily"
    ? [DAILY[0], DAILY[1], DAILY[2 + (index % (DAILY.length - 2))]]
    : [WEEKLY[0], WEEKLY[1 + (Math.floor(index / 7) % (WEEKLY.length - 1))],
      WEEKLY[1 + ((Math.floor(index / 7) + 2) % (WEEKLY.length - 1))]];
  return { scope, key, start, end, tasks };
}
function rewardLabel(reward) {
  if (reward?.kind === "ic") return reward.amount.toLocaleString("en-US") + " IC";
  if (reward?.kind === "item" && items[reward.item]) return reward.quantity + "× " + items[reward.item].name;
  throw new Error("Invalid challenge reward.");
}
function progressOf(task, activity) {
  if (activity?.event_type !== task.event) return 0;
  return Math.min(task.goal, Math.max(0, Number(task.metric === "quantity" ? activity.quantity : activity.occurrences) || 0));
}
function board(c, activities, claimed = []) {
  const claims = new Set(claimed);
  const data = new Map(activities.map((r) => [r.event_type, r]));
  return { scope: c.scope, key: c.key, endsAt: c.end.toISOString(),
    tasks: c.tasks.map((task) => ({
      ...task, progress: progressOf(task, data.get(task.event)),
      claimed: claims.has(task.id)
    }))
  };
}
module.exports = { DAILY, WEEKLY, cycle, rewardLabel, progressOf, board };
