"use strict";
const bosses = require("./world-bosses");
const WEEK_MS = 7 * 86400000;
const SEASON_WEEKS = 4;
const ORIGIN = Date.UTC(2026, 10, 16);
const MISSIONS = Object.freeze([
  Object.freeze({ id:"mining_run", name:"Mining Run", event:"mine", goal:10, perDay:5,
    ic:300, itemId:"ore", quantity:3, renown:50, points:100 }),
  Object.freeze({ id:"frontier_survey", name:"Frontier Survey", event:"expedition_complete", goal:6, perDay:2,
    ic:550, itemId:"silver", quantity:2, renown:75, points:100 }),
  Object.freeze({ id:"siege_support", name:"Siege Support", event:"world_boss_attack", goal:8, perDay:3,
    ic:700, itemId:"gold", quantity:1, renown:90, points:100 }),
  Object.freeze({ id:"supply_line", name:"Supply Line", event:"daily", goal:5, perDay:1,
    ic:450, itemId:"lootbox", quantity:1, renown:65, points:100 })
]);
const BY_ID = new Map(MISSIONS.map(m=>[m.id,m]));
const BY_EVENT = new Map(MISSIONS.map(m=>[m.event,m]));
const SEASON_PRIZES = Object.freeze([
  Object.freeze({ min:1600, tier:"Diamond", ic:2800, itemId:"legendary_lootbox", quantity:1 }),
  Object.freeze({ min:1200, tier:"Gold", ic:2000, itemId:"rare_lootbox", quantity:2 }),
  Object.freeze({ min:800, tier:"Silver", ic:1250, itemId:"rare_lootbox", quantity:1 }),
  Object.freeze({ min:400, tier:"Bronze", ic:750, itemId:"lootbox", quantity:2 })
]);
function week(now = new Date()) {
  return bosses.cycle(now);
}
function season(now = new Date()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid guild league date.");
  const weekInfo = week(date);
  const index = Math.floor((weekInfo.start.getTime()-ORIGIN)/WEEK_MS);
  const seasonIndex = Math.floor(index/SEASON_WEEKS);
  const start = new Date(ORIGIN + seasonIndex*SEASON_WEEKS*WEEK_MS);
  const end = new Date(start.getTime() + SEASON_WEEKS*WEEK_MS);
  return { key: start.toISOString().slice(0,10).replace(/-/g,""),
    start, end, endKey:end.toISOString().slice(0,10).replace(/-/g,"") };
}
function parsedSeasonKey(value) {
  if (!/^[0-9]{8}$/.test(String(value))) throw new Error("Invalid league season.");
  const raw=String(value),y=Number(raw.slice(0,4)),m=Number(raw.slice(4,6)),d=Number(raw.slice(6,8));
  const date=new Date(Date.UTC(y,m-1,d));
  if (date.toISOString().slice(0,10).replace(/-/g,"")!==raw || season(date).key!==raw)
    throw new Error("Invalid league season.");
  return season(date);
}
function tier(score) {
  if (!Number.isSafeInteger(Number(score)) || Number(score)<0) throw new Error("Invalid league score.");
  return score>=1600 ? "Diamond" : score>=1200 ? "Gold" :
    score>=800 ? "Silver" : score>=400 ? "Bronze" : score>0 ? "Explorer" : "Unranked";
}
function seasonReward(score) { return SEASON_PRIZES.find(r=>score>=r.min) || null; }
function eligibleContribution(units) { return Number.isInteger(Number(units)) && Number(units)>=2; }
module.exports = { MISSIONS, BY_ID, BY_EVENT, SEASON_PRIZES, WEEK_MS, SEASON_WEEKS,
  week, season, parsedSeasonKey, tier, seasonReward, eligibleContribution };
