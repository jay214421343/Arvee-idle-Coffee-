"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { items } = require("../src/catalog");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const owner = "123456789012345678";
const { rollRebirthBonus } = require("../src/rebirth-loot");
test("Adventurer's Lunchbox is an openable cache and rebirth preview is explicit", () => {
  assert.equal(items.lunchbox.rarity,"Rare");
  assert.match(JSON.stringify(ui.item(owner,"lunchbox",1).toJSON()),/Open cache/);
  assert.match(JSON.stringify(ui.prestigeResult(owner,{
    prestige:1,multiplier:1.25,itemId:"rebirth_cocktail",bonusItemId:"lunchbox"
  }).toJSON()),/Adventurer's Lunchbox/);
  const data=idle.toJSON().options.find(x=>x.name==="open").options.find(x=>x.name==="type");
  assert.ok(data.choices.some(x=>x.value==="lunchbox"));
});

test("lucky rebirth rolls include an extra cocktail without affecting the existing cache odds", () => {
  assert.equal(rollRebirthBonus(0),"rebirth_cocktail");
  assert.equal(rollRebirthBonus(0.049999),"rebirth_cocktail");
  assert.equal(rollRebirthBonus(0.05),"lunchbox");
  assert.equal(rollRebirthBonus(0.099999),"lunchbox");
  assert.equal(rollRebirthBonus(0.1),"rare_lootbox");
  assert.equal(rollRebirthBonus(0.199999),"rare_lootbox");
  assert.equal(rollRebirthBonus(0.2),"lootbox");
  assert.equal(rollRebirthBonus(0.499999),"lootbox");
  assert.equal(rollRebirthBonus(0.5),null);
  assert.equal(rollRebirthBonus(0.999999),null);
  assert.throws(()=>rollRebirthBonus(1),/Invalid rebirth bonus roll/);
  assert.throws(()=>rollRebirthBonus(-0.01),/Invalid rebirth bonus roll/);
  assert.throws(()=>rollRebirthBonus(NaN),/Invalid rebirth bonus roll/);
  const preview = JSON.stringify(ui.prestige(owner, {
    balance:require("../src/economy").dec("1000000000"),prestige:0
  }).toJSON());
  assert.match(preview,/5% extra Rebirth Cocktail/);
  const result = JSON.stringify(ui.prestigeResult(owner, {
    prestige:1,multiplier:1.25,itemId:"rebirth_cocktail",bonusItemId:"rebirth_cocktail"
  }).toJSON());
  assert.match(result,/LUCKY BONUS/);
  assert.match(result,/extra/);
  assert.match(result,/1× Rebirth Cocktail added/);
});
