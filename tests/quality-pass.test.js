"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dec } = require("../src/economy");
const { MessageFlags } = require("discord.js");
const activity = require("../src/activity");
const ui = require("../src/ui");
const owner = "123456789012345678";
const visitor = { id: owner, username: "Explorer", displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" };
const other = { id: "999999999999999999", username: "OtherPlayer", displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/1.png" };
function state(extra = {}) {
  return { balance: dec(1200), rate: dec(10), totalEarned: dec(5000),
    prestige: 1, mineXp: 17, lastMine: null, lastDaily: null,
    generators: [{generator_id:"MSPS",quantity:2}], inventory: [],
    perks: [], ...extra };
}
function buttons(j) {
  return j.components.filter(c => c.type === 1).flatMap(c => c.components).filter(c => c.type === 2);
}
function menus(j) {
  return j.components.filter(c => c.type === 1).flatMap(c => c.components).filter(c => c.type === 3);
}
test("shared activity cooldowns preserve 90s mine, Quick Hands and 22h daily limits", () => {
  assert.equal(activity.miningCooldownMs([]), 90000);
  assert.equal(activity.miningCooldownMs([{perk_id:"sprinter",level:4}]), 66000);
  assert.equal(activity.miningCooldownMs([{perk_id:"sprinter",level:10}]), 30000);
  assert.equal(activity.miningCooldownMs([{perk_id:"sprinter",level:50}]), 30000);
  assert.equal(activity.DAILY_MS, 22*3600000);
});
test("readiness is calculated using timestamps without changing player data", () => {
  const now = Date.UTC(2026, 10, 17, 12, 0, 0);
  assert.deepEqual(activity.readiness(null,90000,now), {ready:true,seconds:0,readyAt:null});
  const time = new Date(now-20000);
  assert.deepEqual(activity.readiness(time,90000,now), {
    ready:false,seconds:70,readyAt:Math.ceil((now+70000)/1000)
  });
  assert.equal(activity.readiness(time,90000,now+70000).ready,true);
  assert.equal(activity.readiness(time,90000,now+70001).seconds,0);
  const p = activity.playerReadiness(state({
    lastMine:new Date(now-1000),lastDaily:new Date(now-3600000),
    perks:[{perk_id:"sprinter",level:4}]
  }),now);
  assert.equal(p.mine.seconds,65);
  assert.equal(p.daily.seconds,21*3600);
  assert.throws(()=>activity.readiness(now,-1),/Invalid activity cooldown/);
});
test("command center shows mining and daily readiness without adding buttons", () => {
  const now = Date.now();
  const j = ui.home(owner,visitor,state({
    lastMine:new Date(now-15000),lastDaily:new Date(now-3600000)
  })).toJSON();
  assert.equal(j.type,17);
  assert.ok(j.components.length<=10);
  const serialized=JSON.stringify(j);
  assert.match(serialized,/ACTIVITIES/);
  assert.match(serialized,/Mine <t:\d+:R>/);
  assert.match(serialized,/Daily <t:\d+:R>/);
  assert.equal(buttons(j).length,4);
  assert.equal(menus(j).length,1);
  const ready=JSON.stringify(ui.home(owner,visitor,state()).toJSON());
  assert.match(ready,/Mine Ready/);
  assert.match(ready,/Daily Ready/);
  assert.match(ready,/IC earned this run/);
});
test("prestige shortcut appears next to 100% only for the owning player", () => {
  const eligible = state({ balance: dec("1000000000") });
  const json = ui.home(owner, visitor, eligible).toJSON();
  const sections = json.components.filter((c) => c.type === 9);
  const shortcut = sections.find((c) => c.accessory?.custom_id === ui.custom(owner, "prestige"));
  assert.ok(shortcut, "eligible owner receives prestige shortcut beside progress");
  assert.equal(shortcut.accessory.label, "Prestige");
  assert.equal(shortcut.accessory.style, 1);
  assert.match(JSON.stringify(shortcut.components), /PRESTIGE PROGRESS/);
  assert.match(JSON.stringify(shortcut.components), /100%/);
  assert.equal(buttons(json).filter((c) => c.custom_id === ui.custom(owner, "prestige")).length, 1);
  assert.equal(buttons(json).length, 5, "existing four quick actions are unchanged");
  const near = ui.home(owner, visitor, state({ balance: dec("999999999") })).toJSON();
  assert.ok(!near.components.some((c) => c.type === 9 && c.accessory?.custom_id === ui.custom(owner, "prestige")));
  assert.match(JSON.stringify(near), /99%/);
  const readonly = ui.home(owner, other, eligible, true).toJSON();
  assert.equal(buttons(readonly).length, 1);
  assert.ok(!readonly.components.some((c) => c.type === 9 && c.accessory?.custom_id === ui.custom(owner, "prestige")));
  assert.ok(!menus(readonly).length);
});
test("navigation is immediately below player header and above prestige status and actions", () => {
  const view = ui.home(owner, visitor, state()).toJSON();
  const components = view.components;
  const nav = components.findIndex((c) => c.type === 1 && c.components.some((x) => x.type === 3 && x.custom_id === ui.custom(owner, "navigate")));
  const profile = components.findIndex((c) => c.type === 9);
  const progress = components.findIndex((c) => c.type === 10 && c.content.includes("PRESTIGE PROGRESS"));
  const actions = components.findIndex((c) => c.type === 1 && c.components.some((x) => x.type === 2 && x.custom_id === ui.custom(owner, "mine")));
  assert.equal(nav, profile + 1);
  assert.ok(nav < progress && progress < actions);
  assert.ok(components.length <= 10);
  const readyView = ui.home(owner, visitor, state({balance:dec("1e222")})).toJSON();
  assert.ok(readyView.components.length <= 10, "eligible state must fit Discord Components V2");
});
test("other-player profile is visibly read-only and never offers gameplay buttons", () => {
  const view=ui.home(owner,other,state(),true);
  const j=view.toJSON();
  const content=JSON.stringify(j);
  assert.match(content,/READ ONLY/);
  assert.match(content,/Only your own character/);
  assert.match(content,/OtherPlayer/);
  assert.equal(menus(j).length,0);
  assert.deepEqual(buttons(j).map(b=>b.label),["My Command Center"]);
  assert.match(buttons(j)[0].custom_id,new RegExp(owner));
  assert.equal(ui.payload(view).flags,MessageFlags.IsComponentsV2);
});
test("other-player inventory uses a compact read-only collection without consume/hatch actions", () => {
  const inventory=[
    {item_id:"silver",quantity:10},{item_id:"ore",quantity:22},
    {item_id:"companion_egg",quantity:2},{item_id:"coffee",quantity:1}
  ];
  const j=ui.inventoryPreview(owner,other,state({inventory})).toJSON();
  assert.equal(j.type,17);
  assert.ok(j.components.length<=10);
  assert.match(JSON.stringify(j),/PLAYER SATCHEL/);
  assert.match(JSON.stringify(j),/OtherPlayer/);
  assert.match(JSON.stringify(j),/Companion Egg/);
  assert.match(JSON.stringify(j),/Moonsteel/);
  assert.equal(menus(j).length,0);
  assert.deepEqual(buttons(j).map(b=>b.label),["My Command Center"]);
  assert.ok(!JSON.stringify(j).includes(":item_select:"));
  assert.ok(!JSON.stringify(j).includes(":use_item:"));
  const blank=ui.inventoryPreview(owner,other,state()).toJSON();
  assert.match(JSON.stringify(blank),/no items yet/);
});
test("readonly preview scales to the current catalogue without exceeding Discord's limits", () => {
  const {items}=require("../src/catalog");
  const inventory=Object.keys(items).map(id=>({item_id:id,quantity:1}));
  const j=ui.inventoryPreview(owner,other,state({inventory})).toJSON();
  assert.ok(j.components.length<=10);
  assert.ok(JSON.stringify(j).length<10000);
  assert.equal(buttons(j).length,1);
});
