"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { items } = require("../src/catalog");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const owner = "123456789012345678";
test("Adventurer's Lunchbox is an openable cache and rebirth preview is explicit", () => {
  assert.equal(items.lunchbox.rarity,"Rare");
  assert.match(JSON.stringify(ui.item(owner,"lunchbox",1).toJSON()),/Open cache/);
  assert.match(JSON.stringify(ui.prestigeResult(owner,{
    prestige:1,multiplier:1.25,itemId:"rebirth_cocktail",bonusItemId:"lunchbox"
  }).toJSON()),/Adventurer's Lunchbox/);
  const data=idle.toJSON().options.find(x=>x.name==="open").options.find(x=>x.name==="type");
  assert.ok(data.choices.some(x=>x.value==="lunchbox"));
});
