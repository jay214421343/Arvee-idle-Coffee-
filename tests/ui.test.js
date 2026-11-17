"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { idle, handleComponent } = require("../src/commands");
const { dec } = require("../src/economy");
const { perks } = require("../src/catalog");
const ui = require("../src/ui");
const owner = "123456789012345678";
const sample = {
  balance: dec("1500000000"), totalEarned: dec("2500000000"), rate: dec("3400"),
  prestige: 2, mineXp: 17, pickaxeTier: 1, orbs: 0,
  generators: [{ generator_id: "MSPS", quantity: 4 }],
  inventory: [{ item_id: "coffee", quantity: 2 }, { item_id: "lootbox", quantity: 1 }],
  perks: [{ perk_id: "miner", level: 2 }]
};
test("slash command has modern subcommands, valid Discord options and no privileged eval", () => {
  const commands = idle.toJSON();
  assert.equal(commands.name, "idle");
  const names = commands.options.map((x) => x.name);
  assert.ok(names.includes("pickaxe"));
  assert.ok(names.includes("perks"));
  assert.ok(names.includes("market"));
  assert.equal(names.includes("eval"), false);
});
test("Components V2 identifiers are owner-bound and compact", () => {
  const id = ui.custom(owner, "shop", "8");
  assert.equal(id, "ai:2:" + owner + ":shop:8");
  assert.ok(id.length < 100);
  assert.throws(() => ui.custom("bad", "shop", "1"));
  assert.throws(() => ui.custom(owner, "weird action", ""));
});
test("all game dashboard views serialize as native Components V2", () => {
  const user = { username: "ARVEEFan", displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" };
  const views = [
    ui.home(owner, user, sample),
    ui.shop(owner, 1),
    ui.generator(owner, "MSPS", 1, sample),
    ui.inventory(owner, sample),
    ui.item(owner, "coffee", 2),
    ui.crafting(owner),
    ui.recipe(owner, "coffee"),
    ui.market(owner, [{ id: "1", seller_id: "999999999999999999", item_id: "coffee", price: "100", quantity: 2 }]),
    ui.listing(owner, { id: "1", seller_id: "999999999999999999", item_id: "coffee", price: "100", quantity: 2 }),
    ui.prestige(owner, sample),
    ui.pickaxe(owner, sample),
    ui.perks(owner, sample, perks),
    ui.leaderboard(owner, [{ user_id: owner, total_earned: "10", prestige: 0 }]),
    ui.stats(owner, { ...sample, counts: { mine: 4, daily: 1 }, achievements: [{ name: "First Expedition", achieved: true, goal: "Claim a reward" }] }),
    ui.perkRespec(owner),
    ui.help(owner),
    ui.message("Test", "Hello", owner)
  ];
  for (const view of views) {
    const obj = view.toJSON();
    assert.equal(obj.type, 17);
    assert.ok(obj.components.length > 0);
    const payload = ui.payload(view);
    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.ok(JSON.stringify(obj).length < 30000);
  }
});

test("unauthorized component clicks are rejected before updating any shared message", async () => {
  let denial = null;
  let updated = false;
  const interaction = {
    customId: ui.custom(owner, "shop", "2"),
    user: { id: "999999999999999999" },
    isButton: () => true, isStringSelectMenu: () => false,
    reply: async (payload) => { denial = payload; },
    deferUpdate: async () => { updated = true; }
  };
  assert.equal(await handleComponent(interaction), true);
  assert.equal(updated, false);
  assert.equal(denial.flags, MessageFlags.Ephemeral);
});
test("authorized paging updates a Components V2 message without using a database", async () => {
  let deferred = false, payload = null;
  const interaction = {
    customId: ui.custom(owner, "shop", "2"),
    user: { id: owner },
    isButton: () => true, isStringSelectMenu: () => false,
    deferUpdate: async () => { deferred = true; },
    editReply: async (result) => { payload = result; }
  };
  assert.equal(await handleComponent(interaction), true);
  assert.equal(deferred, true);
  assert.equal(payload.components[0].toJSON().type, 17);
});

test("navigation dropdown opens field guide without requiring database access", async () => {
  let edited=null, deferred=false;
  const interaction={
    customId:ui.custom(owner,"navigate"),
    user:{id:owner}, isButton:()=>false,isStringSelectMenu:()=>true,
    values:["help"],
    deferUpdate:async()=>{deferred=true;},
    editReply:async(v)=>{edited=v;}
  };
  assert.equal(await handleComponent(interaction),true);
  assert.equal(deferred,true);
  assert.match(JSON.stringify(edited.components[0].toJSON()),/WELCOME TO ARVEE IDLE/);
});
test("filter accessory opens a category picker without database calls", async () => {
  let edited=null;
  const interaction={
    customId:ui.custom(owner,"inventory_filters","2_materials_quantity"),
    user:{id:owner}, isButton:()=>true,isStringSelectMenu:()=>false,
    deferUpdate:async()=>{},editReply:async(v)=>{edited=v;}
  };
  assert.equal(await handleComponent(interaction),true);
  assert.match(JSON.stringify(edited.components[0].toJSON()),/inventory_filter_set/);
});
