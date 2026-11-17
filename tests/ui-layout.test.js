"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("../src/ui");
const { dec } = require("../src/economy");
const { items, generators } = require("../src/catalog");
const owner = "123456789012345678";
const sample = {
  balance: dec("750"), rate: dec("3"), totalEarned: dec("1500"),
  prestige: 0, mineXp: 0, pickaxeTier: 0, orbs: 0, perks: [],
  generators: [{ generator_id: generators[0].id, quantity: 2 }],
  inventory: Object.keys(items).slice(0, 17).map((id, i) => ({ item_id: id, quantity: i + 1 }))
};
function findSections(view) { return view.toJSON().components.filter((part) => part.type === 9); }
function findSelects(view) {
  return view.toJSON().components.filter((part) => part.type === 1 && part.components[0]?.type === 3)
    .map((part) => part.components[0]);
}
function verifyCompact(view) {
  const json = view.toJSON();
  assert.equal(json.type, 17);
  assert.ok(json.components.length <= 10, "container must stay within Discord component limit");
  assert.ok(JSON.stringify(json).length < 10000);
  const sections = findSections(view);
  assert.ok(sections.length <= 4);
  for (const section of sections) {
    assert.equal(section.accessory.type, 2);
    assert.match(section.accessory.custom_id, /^ai:2:123456789012345678:/);
    assert.ok(section.components.some((part) => part.type === 10));
  }
}
test("inventory renders four individual rarity cards with Inspect accessories", () => {
  const view = ui.inventory(owner, sample, 1, "all", "rarity");
  verifyCompact(view);
  assert.equal(findSections(view).length, 4);
  assert.equal(findSelects(view).length, 2);
  assert.match(JSON.stringify(view.toJSON()), /Inspect/);
  assert.match(JSON.stringify(view.toJSON()), /rarity/);
});
test("filtering inventory categories, sorting, and paging preserve user choices", () => {
  const view = ui.inventory(owner, sample, 2, "materials", "quantity");
  verifyCompact(view);
  const menu = findSelects(view);
  assert.ok(menu[0].options.find((v) => v.value === "materials" && v.default === true));
  assert.ok(menu[1].options.find((v) => v.value === "quantity" && v.default === true));
  const json = JSON.stringify(view.toJSON());
  assert.match(json, /2_materials_quantity/);
  assert.deepEqual(ui.parseListState("2_materials_quantity"), { page: 2, filter: "materials", sort: "quantity" });
  assert.deepEqual(ui.parseListState("99999_bad_invalid"), { page: 999, filter: "all", sort: "rarity" });
});
test("operation cards show correct actual price and affordability", () => {
  const view = ui.shop(owner, 1, sample, "affordable", "price");
  verifyCompact(view);
  assert.equal(findSelects(view).length, 2);
  assert.ok(findSections(view).length <= 4);
  assert.match(JSON.stringify(view.toJSON()), /Details/);
  assert.deepEqual(ui.parseListState("3_owned_income", "shop"), { page: 3, filter: "owned", sort: "income" });
});
test("Forge uses recipe cards and ingredient-aware confirmations", () => {
  const list = ui.crafting(owner, sample, 1);
  verifyCompact(list);
  assert.equal(findSections(list).length, 4);
  const recipe = ui.recipe(owner, "coffee", sample);
  assert.match(JSON.stringify(recipe.toJSON()), /FORGING MATERIALS/);
  assert.match(JSON.stringify(recipe.toJSON()), /Rune Ore/);
  const buttons = recipe.toJSON().components.find((part) => part.type === 1).components;
  assert.equal(buttons[0].disabled, true);
});
test("all cards are owner bound and refuse invalid custom IDs", () => {
  assert.equal(ui.category("lootbox"), "caches");
  assert.equal(ui.category("coffee"), "usable");
  assert.equal(ui.category("ore"), "materials");
  assert.throws(() => ui.custom("not-a-snowflake", "inventory", "1"));
});

test("pickaxe displays owned materials and disables unavailable upgrades", () => {
  const initial = ui.pickaxe(owner, sample).toJSON();
  const message = JSON.stringify(initial);
  assert.match(message, /Rune Ore/);
  assert.match(message, /Moonsteel/);
  const buttons = initial.components.find((part) => part.type === 1).components;
  assert.equal(buttons[0].disabled, true);
  const ready = ui.pickaxe(owner, { ...sample, inventory: [
    { item_id: "ore", quantity: 8 }, { item_id: "silver", quantity: 2 }
  ]}).toJSON();
  assert.equal(ready.components.find((part) => part.type === 1).components[0].disabled, false);
  const max = ui.pickaxe(owner, { ...sample, pickaxeTier: 10 }).toJSON();
  assert.equal(max.components.find((part) => part.type === 1).components[0].disabled, true);
});
