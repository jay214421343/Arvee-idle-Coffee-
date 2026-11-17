"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { UNKNOWN, itemArt, pickaxeArt, SKIN_ART, ITEM_ART } = require("../src/item-art");
const { items } = require("../src/catalog");
const { dec } = require("../src/economy");
const ui = require("../src/ui");
const owner = "123456789012345678";
test("application artwork uses exact uploaded emoji IDs with unknown as fallback", () => {
  assert.equal(itemArt("silver"), "<:silver:1572284313511141477>");
  assert.equal(itemArt("lootbox"), "<:lootbox:1572285929358368799>");
  assert.equal(UNKNOWN, "<:unknown:1572286729048821953>");
  assert.equal(pickaxeArt("I Skin"), "<:i_skin:1572286343055151254>");
  assert.equal(pickaxeArt("I Skin II"), "<:i_skin2:1572286345165021285>");
  assert.equal(pickaxeArt("Demon Skin"), "<:demon_skin:1572286340928774184>");
  assert.equal(itemArt("rebirth_cocktail"), UNKNOWN);
  assert.equal(itemArt("coffee"), UNKNOWN);
  assert.equal(itemArt("missing_item"), UNKNOWN);
  assert.equal(pickaxeArt("Copper"), UNKNOWN);
  assert.equal(pickaxeArt("Obsidian"), UNKNOWN);
  assert.equal(pickaxeArt("Astral"), UNKNOWN);
  assert.equal(Object.keys(ITEM_ART).length, 2);
  assert.equal(Object.keys(SKIN_ART).length, 3);
  assert.equal(items.silver.emoji, ITEM_ART.silver);
});
test("unknown art is shown in item details but the satchel stays compact", () => {
  const profile = {
    balance:dec(500),rate:dec(0),mineXp:0,pickaxeTier:0,prestige:0,
    totalEarned:dec(500),orbs:0,generators:[],perks:[],
    inventory:[{item_id:"coffee",quantity:2},{item_id:"silver",quantity:3},{item_id:"lootbox",quantity:1}]
  };
  const card = JSON.stringify(ui.item(owner,"coffee",2).toJSON());
  assert.match(card, /<:unknown:1572286729048821953>/);
  assert.match(JSON.stringify(ui.item(owner,"silver",3).toJSON()), /<:silver:1572284313511141477>/);
  const inventory = JSON.stringify(ui.inventory(owner,profile).toJSON());
  assert.doesNotMatch(inventory,/<:unknown:/);
  assert.doesNotMatch(inventory,/<:silver:/);
  const pick = JSON.stringify(ui.pickaxe(owner,{...profile,pickaxeName:"Moonshard",pickaxeStyle:"Demon Skin"}).toJSON());
  assert.match(pick, /<:demon_skin:1572286340928774184>/);
  assert.match(pick, /Moonshard/);
});
