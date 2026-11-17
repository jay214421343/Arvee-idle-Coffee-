"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const challenges = require("../src/challenges");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const owner = "123456789012345678";
test("daily contracts reset at UTC midnight and weekly at Monday 00:00 UTC", () => {
  const before = challenges.cycle("daily", "2026-11-17T23:59:59Z");
  const after = challenges.cycle("daily", "2026-11-18T00:00:00Z");
  assert.equal(before.key, "20261117");
  assert.equal(after.key, "20261118");
  assert.equal(challenges.cycle("weekly", "2026-11-22T23:59:59Z").key, "20261116");
  assert.equal(challenges.cycle("weekly", "2026-11-23T00:00:00Z").key, "20261123");
  assert.deepEqual(challenges.cycle("daily", "2026-11-17T12:00:00Z").tasks, before.tasks);
  assert.throws(() => challenges.cycle("monthly"), /Invalid challenge/);
});
test("three daily and weekly challenges are distinct with valid rewards", () => {
  for (const scope of ["daily", "weekly"]) {
    const cycle = challenges.cycle(scope, "2026-11-17T12:00:00Z");
    assert.equal(cycle.tasks.length,3);
    assert.equal(new Set(cycle.tasks.map(t=>t.id)).size,3);
    for(const task of cycle.tasks) {
      assert.ok(task.goal>0);
      assert.ok(["count","quantity"].includes(task.metric));
      assert.ok(challenges.rewardLabel(task.reward).length>0);
    }
  }
});
test("challenge progress is clamped and respects the activity metric", () => {
  const c = challenges.cycle("daily","2026-11-17T12:00:00Z");
  const board = challenges.board(c, [
    {event_type:"mine", occurrences:100, quantity:100},
    {event_type:"generator_purchase",occurrences:1,quantity:2}
  ],["mining_route"]);
  assert.equal(board.tasks[0].progress,3);
  assert.equal(board.tasks[0].claimed,true);
  assert.equal(board.tasks[1].progress,2);
  assert.equal(board.tasks[1].claimed,false);
  assert.equal(challenges.progressOf(c.tasks[0],{event_type:"daily",occurrences:3}),0);
});
test("Discord contract view uses V2 claim controls and a scope dropdown", () => {
  const c = challenges.cycle("daily","2026-11-17T12:00:00Z");
  const progress = challenges.board(c,[
    {event_type:"mine",occurrences:3,quantity:3},
    {event_type:"generator_purchase",occurrences:1,quantity:1}
  ]);
  const v=ui.challengeBoard(owner,{daily:progress}, "daily").toJSON();
  assert.equal(v.type,17);
  assert.ok(v.components.length<=10);
  const sections=v.components.filter(x=>x.type===9);
  assert.equal(sections.length,3);
  assert.equal(sections[0].accessory.disabled,false);
  assert.equal(sections[1].accessory.disabled,true);
  assert.match(sections[0].accessory.custom_id,/^ai:2:123456789012345678:challenge_claim:daily_20261117_mining_route$/);
  assert.ok(v.components.some(x=>x.type===1&&x.components.some(y=>y.type===3)));
});
test("saved preferences are visible and can be reset with an owner-bound button", () => {
  const prefs={shopFilter:"owned",shopSort:"income",inventoryFilter:"caches",inventorySort:"quantity",forgeFilter:"ready"};
  const j=ui.preferences(owner,prefs).toJSON();
  assert.equal(j.type,17);
  assert.match(JSON.stringify(j),/Supply caches/);
  assert.match(JSON.stringify(j),/Craftable only/);
  assert.match(JSON.stringify(j),/preferences_reset/);
  assert.ok(j.components.length<=10);
});
test("new commands and navigation appear in slash registration and command center", () => {
  const names=idle.toJSON().options.map(o=>o.name);
  assert.ok(names.includes("challenges"));
  assert.ok(names.includes("settings"));
  const home=ui.home(owner,{username:"Player",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},
    {balance:require("../src/economy").dec(500),rate:require("../src/economy").dec(0),
     totalEarned:require("../src/economy").dec(500),prestige:0,mineXp:0,generators:[]});
  const opts=home.toJSON().components.filter(x=>x.type===1).flatMap(x=>x.components)
    .filter(x=>x.type===3).flatMap(x=>x.options);
  assert.ok(opts.some(x=>x.value==="progress_menu"));
  assert.ok(opts.some(x=>x.value==="more_menu"));
  const progress=JSON.stringify(ui.sectionMenu(owner,"progress").toJSON());
  const more=JSON.stringify(ui.sectionMenu(owner,"more").toJSON());
  assert.match(progress,/"value":"challenges"/);
  assert.match(more,/"value":"settings"/);
});
