"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { dec } = require("../src/economy");
const ui = require("../src/ui");
const owner = "123456789012345678";
const profile = { balance: dec(2150), mineXp: 17, pickaxeTier: 2 };
function verify(view, maxButtons = 2) {
  const json = view.toJSON();
  assert.equal(json.type, 17);
  assert.ok(json.components.length <= 10, "Discord V2 component limit");
  const buttons = json.components.filter((c) => c.type === 1).flatMap((c) => c.components).filter((c) => c.type === 2);
  assert.ok(buttons.length <= maxButtons, "keep activity results uncluttered");
  for (const action of buttons) assert.match(action.custom_id, /^ai:2:123456789012345678:/);
  const serialized = JSON.stringify(json);
  assert.ok(serialized.length < 10000);
  assert.doesNotMatch(serialized, /\p{Emoji_Presentation}/u, "activity receipts should have no decorative emoji");
  assert.equal(ui.payload(view).flags, MessageFlags.IsComponentsV2);
  return { json, serialized, buttons };
}
test("mining result uses a Coffee-like narrative and clean reward summary", () => {
  const result = { reward: dec("3.29e222"), drop: "silver", dropQuantity: 2, mineXp: 17, box: true };
  const { serialized, buttons } = verify(ui.miningResult(owner, result, profile));
  assert.match(serialized, /THE PROSPECTOR/);
  assert.match(serialized, /MR[.] M[.] INER/);
  assert.match(serialized, /BASE MINING REWARD/);
  assert.match(serialized, /TOTAL EARNED/);
  assert.match(serialized, /MINING  \/  SUCCESS/);
  assert.match(serialized, /3\.29cl IC/);
  assert.match(serialized, /2× .*Moonsteel/);
  assert.match(serialized, /Supply Cache \(bonus\)/);
  assert.match(serialized, /MINING XP.*17/);
  assert.match(serialized, /Tier 2/);
  assert.equal(buttons[0].label, "View pickaxe");
  assert.equal(buttons[1].label, "Command Center");
});
test("Coffee-style bonus breakdown shows exact bonus, source, charges and skin artwork", () => {
  const result = { reward: dec(300), baseReward: dec(150), bonusReward: dec(150),
    multiplier: "2", boostSources: ["Rebirth Cocktail"], boostChargesLeft: 2,
    drop: "silver", dropQuantity: 2, mineXp: 19, box: false };
  const { serialized, buttons } = verify(ui.miningResult(owner, result, {
    ...profile, pickaxeName: "Moonshard", pickaxeStyle: "Demon Skin"
  }));
  assert.match(serialized, /MR[.] M[.] INER/);
  assert.match(serialized, /BASE MINING REWARD/);
  assert.match(serialized, /BOOST BONUS/);
  assert.match(serialized, /150 IC/);
  assert.match(serialized, /300 IC/);
  assert.match(serialized, /Rebirth Cocktail/);
  assert.match(serialized, /REMAINING CHARGES/);
  assert.match(serialized, /Moonshard/);
  assert.match(serialized, /<:demon_skin:1572286340928774184>/);
  assert.match(serialized, /<:silver:1572284313511141477>/);
  assert.equal(buttons.length, 2);
});
test("mining cooldown stays descriptive and never shows invented loot", () => {
  const { serialized } = verify(ui.miningResult(owner, { cooldown: 75 }, profile));
  assert.match(serialized, /MINING  \/  RESTING/);
  assert.match(serialized, /1m 15s/);
  assert.match(serialized, /<t:\d+:R>/);
  assert.doesNotMatch(serialized, /EARNED|FOUND|Supply Cache \(bonus\)/);
});
test("daily delivery shows all actual rewards in a tidy receipt", () => {
  const view = ui.dailyResult(owner, { received: [
    "750 IC", "3 Supply Caches", "1 Campfire Brew", "4 Rune Ore", "2 Moonsteel"
  ] }, profile);
  const { serialized, buttons } = verify(view);
  assert.match(serialized, /THE QUARTERMASTER/);
  assert.match(serialized, /DAILY SUPPLIES  \/  DELIVERED/);
  assert.match(serialized, /750 IC/);
  assert.match(serialized, /3 Supply Caches/);
  assert.match(serialized, /2\.15K IC/);
  assert.equal(buttons[0].label, "Go mining");
  assert.equal(buttons[1].label, "Command Center");
});
test("daily cooldown displays real 22-hour cooldown as readable time", () => {
  const { serialized } = verify(ui.dailyResult(owner, { cooldown: 79200 }, profile));
  assert.match(serialized, /DAILY SUPPLIES  \/  RESTOCKING/);
  assert.match(serialized, /22h/);
  assert.match(serialized, /<t:\d+:R>/);
  assert.doesNotMatch(serialized, /DELIVERY RECEIVED/);
});
test("crafting and cache results share the compact Coffee-inspired receipt style", () => {
  const forge = verify(ui.craftingResult(owner, "coffee", 5));
  assert.match(forge.serialized, /THE ARTIFICER/);
  assert.match(forge.serialized, /5× Campfire Brew/);
  assert.equal(forge.buttons[0].label, "Back to forge");
  const cache = verify(ui.cacheResult(owner, { ore: 3, silver: 2 }));
  assert.match(cache.serialized, /3× Rune Ore/);
  assert.match(cache.serialized, /2× Moonsteel/);
  assert.equal(cache.buttons[0].label, "View satchel");
  assert.throws(() => ui.craftingResult(owner, "not-an-item", 1), /Unknown item/);
});
test("generic operation receipt stays accessible without a four-button toolbar", () => {
  const { buttons, serialized } = verify(ui.message("Purchase completed", "One more crew member recruited.", owner), 1);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].label, "Command Center");
  assert.match(serialized, /Purchase completed/);
});
