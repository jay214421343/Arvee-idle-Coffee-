"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const season = require("../src/season");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const { dec } = require("../src/economy");
const owner = "123456789012345678";
test("founders season dates and post-season claiming grace use UTC", () => {
  assert.equal(season.phase("2026-11-16T23:59:59Z"), "upcoming");
  assert.equal(season.phase("2026-11-17T00:00:00Z"), "active");
  assert.equal(season.phase("2027-01-16T00:00:00Z"), "claim_only");
  assert.equal(season.phase("2027-01-23T00:00:00Z"), "finished");
});
test("season retains 20 original rewards and extends to 100 free tiers", () => {
  assert.equal(season.rewards.length, 100);
  assert.equal(Object.hasOwn(season.SEASON, "dailyXpCap"), false);
  assert.equal(season.unlocked(0), 0);
  assert.equal(season.unlocked(249), 0);
  assert.equal(season.unlocked(250), 1);
  assert.equal(season.unlocked(500), 2);
  assert.equal(season.unlocked(5000000), 100);
  assert.equal(season.unlocked(24999), 99);
  assert.equal(season.unlocked(25000), 100);
  assert.equal(season.tierNeeded(20), 5000);
  assert.equal(season.tierNeeded(100), 25000);
  assert.throws(() => season.unlocked(-10));
  assert.equal(season.tierNeeded(21), 5250);
  assert.throws(() => season.tierNeeded(101));
  assert.ok(season.rewards.every((reward) => season.label(reward).length > 0));
  assert.ok(season.rewards.every((reward) => reward.kind === "ic" ?
    Number.isSafeInteger(reward.amount) && reward.amount > 0 :
    Number.isSafeInteger(reward.quantity) && reward.quantity > 0));
  assert.deepEqual(season.rewards.slice(0,20).map(r=>r.kind==="ic" ? "IC:"+r.amount : r.item+":"+r.quantity),[
    "IC:200","lootbox:2","ore:8","IC:400","rare_lootbox:1","silver:4",
    "IC:750","coffee:3","gold:2","pickperk:1","IC:1250","rare_lootbox:2",
    "silver:10","IC:1750","gem:1","gold:5","IC:2500","legendary_lootbox:1",
    "pickperk:2","orb_of_almanac:1"
  ],"existing tier rewards must never change");
});
test("XP comes from gameplay, not trades, gifts or reward claiming", () => {
  assert.equal(season.eventXp("mine"), 20);
  assert.equal(season.eventXp("daily"), 100);
  assert.equal(season.eventXp("generator_purchase", {quantity:1000}), 75);
  assert.equal(season.eventXp("craft", {quantity:2}), 50);
  assert.equal(season.eventXp("open_lootbox", {quantity:5}), 50);
  assert.equal(season.eventXp("market_buy"), 0);
  assert.equal(season.eventXp("give_item"), 0);
  assert.equal(season.eventXp("season_reward_claim"), 0);
});
test("season pass fits Discord Components V2 and has safe claim controls", () => {
  const progress={ xp:650, dailyXp:150, claimed:[1], phase:"active",
    activities:{mine:2,generator_purchase:1,craft:0} };
  const view=ui.season(owner,progress,1);
  const j=view.toJSON();
  assert.equal(j.type,17);
  assert.ok(j.components.length <= 10);
  const sections=j.components.filter(c=>c.type===9);
  assert.equal(sections.length,4);
  assert.equal(sections[0].accessory.disabled,true);
  assert.equal(sections[1].accessory.disabled,false);
  assert.equal(sections[2].accessory.disabled,true);
  assert.match(JSON.stringify(j),/DAILY CONTRACTS/);
  assert.match(JSON.stringify(j),/Founders/);
  assert.doesNotMatch(JSON.stringify(j), /Today's XP|500 \/ 500/);
  assert.match(JSON.stringify(j),/Claim all/);
  assert.ok(j.components.filter(c=>c.type===1).some(c=>c.components.some(b=>b.custom_id===ui.custom(owner,"season_claim_all","1"))));
});
test("100 tiers fit Discord Components V2 with a 25-page range selector", () => {
  const p={xp:25000,claimed:[1,20,21,80,100],phase:"active",activities:{}};
  const first=ui.season(owner,p,1).toJSON();
  const jump=first.components.filter(c=>c.type===1).flatMap(c=>c.components)
    .find(c=>c.type===3 && c.custom_id===ui.custom(owner,"season_jump"));
  assert.ok(jump);
  assert.equal(jump.options.length,25);
  assert.equal(jump.options[0].value,"1");
  assert.equal(jump.options[24].value,"25");
  assert.match(JSON.stringify(first),/100 tiers/);
  assert.match(JSON.stringify(first),/25,000/);
  const last=ui.season(owner,p,25).toJSON();
  assert.ok(last.components.length<=10);
  assert.match(JSON.stringify(last),/TIER 100/);
  const final=last.components.filter(c=>c.type===9).find(c=>JSON.stringify(c).includes("TIER 100"));
  assert.ok(final.accessory.disabled);
  assert.equal(last.components.filter(c=>c.type===9).length,4);
});
test("season navigation is in the slash command and command center menu", () => {
  const cmd=idle.toJSON();
  assert.ok(cmd.options.some(o=>o.name==="season"));
  const home=ui.home(owner,{username:"Adventurer",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},
    {balance:dec(500),rate:dec(0),totalEarned:dec(500),prestige:0,mineXp:0,generators:[]});
  const opts=home.toJSON().components.flatMap(c=>c.type===1 ? c.components : [])
    .filter(c=>c.type===3).flatMap(c=>c.options);
  assert.ok(opts.some(o=>o.value==="progress_menu"));
  const progress=ui.sectionMenu(owner,"progress").toJSON();
  const paths=progress.components.filter(c=>c.type===1).flatMap(c=>c.components)
    .filter(c=>c.type===3).flatMap(c=>c.options);
  assert.ok(paths.some(o=>o.value==="season"));
});
test("no claim buttons remain enabled after a season ends", () => {
  const p={xp:5000,dailyXp:0,claimed:[],phase:"finished",activities:{}};
  const j=ui.season(owner,p,5).toJSON();
  assert.ok(j.components.filter(c=>c.type===9).every(c=>c.accessory.disabled));
  const claimAll=j.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===2)
    .find(c=>c.label.includes("claim")||c.label.includes("Nothing"));
  assert.equal(claimAll.disabled,true);
});
