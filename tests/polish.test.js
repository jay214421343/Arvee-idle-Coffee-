"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dec } = require("../src/economy");
const progression = require("../src/progression");
const ui = require("../src/ui");
const owner = "123456789012345678";
const viewer = { username: "ArveePlayer", displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" };
function player(data = {}) {
  return {
    balance: dec("999000000"), rate: dec(12), totalEarned: dec(0),
    prestige: 0, mineXp: 0, pickaxeTier: 0, orbs: 0,
    generators: [{ generator_id: "MSPS", quantity: 1 }],
    inventory: [], perks: [], ...data
  };
}
function buttons(view) {
  return view.toJSON().components.filter((c) => c.type === 1)
    .flatMap((c) => c.components).filter((c) => c.type === 2);
}
const ready = { daily: {ready:true}, mine: {ready:true} };
const cooling = { daily: {ready:false}, mine: {ready:false} };
test("prestige progress shows true percent and clamps negative and huge balances", () => {
  const at99 = progression.prestigeProgress(player());
  assert.equal(at99.percent, 99);
  assert.equal(at99.filled, 9);
  assert.equal(at99.remaining.toString(), "1000000");
  assert.equal(progression.prestigeProgress(player({balance: dec(0)})).percent, 0);
  assert.equal(progression.prestigeProgress(player({balance: dec("-42")})).percent, 0);
  const huge = progression.prestigeProgress(player({balance: dec("1e222")}));
  assert.equal(huge.percent, 100);
  assert.equal(huge.filled, 10);
  assert.equal(huge.remaining.toString(), "0");
  assert.equal(huge.ready, true);
});
test("next step prioritizes actual eligibility and activity readiness", () => {
  assert.match(progression.nextStep(player({balance: dec("1e9")}), ready), /Prestige is ready/);
  assert.match(progression.nextStep(player(), ready), /daily supplies/);
  assert.match(progression.nextStep(player(), {daily:cooling.daily,mine:ready.mine}), /Mine for materials/);
  assert.match(progression.nextStep(player({generators:[]}), cooling), /first Operation/);
  assert.match(progression.nextStep(player({rate:dec(0)}), cooling), /Expand your Operations/);
  assert.match(progression.nextStep(player(), cooling), /World Map/);
});
test("home shows accurate prestige progress and distinct operation naming", () => {
  const rendered = ui.home(owner, viewer, player()).toJSON();
  const serialized = JSON.stringify(rendered);
  assert.match(serialized, /PRESTIGE PROGRESS/);
  assert.match(serialized, /99%/);
  assert.match(serialized, /1M IC/);
  assert.match(serialized, /NEXT STEP/);
  const select = rendered.components.filter((c)=>c.type===1).flatMap((c)=>c.components)
    .find((c)=>c.type===3);
  assert.equal(select.options.find((o)=>o.value==="shop").label, "Operations");
  assert.equal(select.options.find((o)=>o.value==="prestige").label, "Prestige");
  assert.ok(buttons(ui.home(owner,viewer,player())).some((b)=>b.label==="Operations"));
  assert.doesNotMatch(JSON.stringify(ui.home(owner,viewer,player(),true).toJSON()), /NEXT STEP/);
});
test("purchase and prestige receipts stay compact, owner-bound and suffix-safe", () => {
  const purchase = ui.purchaseResult(owner,{
    generator:{id:"MSPS",name:"Stonewatch Crew"},
    quantity:10,cost:dec("1e222"),balance:dec("3e222"),rate:dec("2e222")
  });
  const data = purchase.toJSON(), actions=buttons(purchase), body=JSON.stringify(data);
  assert.equal(data.type,17);
  assert.ok(data.components.length <= 10);
  assert.ok(body.length < 10000);
  assert.equal(actions.length,2);
  assert.match(body,/1cl/);
  assert.match(body,/OPERATIONS/);
  assert.match(body,/RECRUITED/);
  assert.equal(actions[0].label,"Recruit more");
  for (const b of actions) assert.match(b.custom_id,/^ai:2:123456789012345678:/);
  const prestige = ui.prestigeResult(owner,{prestige:4,multiplier:dec("2.25")});
  assert.match(JSON.stringify(prestige.toJSON()),/2.25×/);
  assert.deepEqual(buttons(prestige).map((b)=>b.label),["Recruit operations","Command Center"]);
});
