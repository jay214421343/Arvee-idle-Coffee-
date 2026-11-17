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
  assert.ok(sections.length <= 5);
  for (const section of sections) {
    assert.equal(section.accessory.type, 2);
    assert.match(section.accessory.custom_id, /^ai:2:123456789012345678:/);
    assert.ok(section.components.some((part) => part.type === 10));
  }
}
test("satchel uses a filter button, sorting dropdown and compact 8-item list", () => {
  const view = ui.inventory(owner, sample, 1, "all", "rarity");
  verifyCompact(view);
  assert.equal(findSections(view).length, 1);
  assert.equal(findSelects(view).length, 2);
  assert.equal(findSections(view)[0].accessory.label, "Filters");
  const json = JSON.stringify(view.toJSON());
  assert.match(json, /SATCHEL/);
  assert.match(json, /Inspect an item/);
  assert.match(json, /Rarest first/);
});
test("satchel filters use contextual filter panel, sorting and paging", () => {
  const view = ui.inventory(owner, sample, 1, "materials", "quantity");
  verifyCompact(view);
  const menus = findSelects(view);
  assert.ok(menus[0].options.find((v) => v.value === "quantity" && v.default === true));
  assert.match(JSON.stringify(view.toJSON()), /1_materials_quantity/);
  const filterPanel = ui.inventoryFilters(owner, 1, "materials", "quantity");
  assert.match(JSON.stringify(filterPanel.toJSON()), /Crafting materials/);
  assert.match(JSON.stringify(filterPanel.toJSON()), /inventory_filter_set/);
  assert.deepEqual(ui.parseListState("2_materials_quantity"), { page: 2, filter: "materials", sort: "quantity" });
  assert.deepEqual(ui.parseListState("99999_bad_invalid"), { page: 999, filter: "all", sort: "rarity" });
});
test("Expeditions use contextual filter button, sort menu and inspect cards", () => {
  const view = ui.shop(owner, 1, sample, "affordable", "price");
  verifyCompact(view);
  assert.equal(findSelects(view).length, 1);
  assert.ok(findSections(view).length <= 5);
  assert.equal(findSections(view)[0].accessory.label, "Filters");
  assert.match(JSON.stringify(view.toJSON()), /Inspect/);
  assert.match(JSON.stringify(ui.shopFilters(owner, 1, "owned", "income").toJSON()), /shop_filter_set/);
  assert.deepEqual(ui.parseListState("3_owned_income", "shop"), { page: 3, filter: "owned", sort: "income" });
});
test("Forge offers a craftable filter and ingredient-aware confirmation", () => {
  const list = ui.crafting(owner, sample, 1);
  verifyCompact(list);
  assert.equal(findSections(list).length, 4);
  assert.equal(findSelects(list).length, 1);
  assert.match(JSON.stringify(list.toJSON()), /craft_filter/);
  assert.deepEqual(ui.parseCraftState("2_ready"), {page:2, filter:"ready"});
  const ready = ui.crafting(owner, {...sample,inventory:[]}, 1, "ready");
  assert.equal(findSections(ready).length, 0);
  const recipe = ui.recipe(owner, "coffee", sample);
  assert.match(JSON.stringify(recipe.toJSON()), /REQUIRED MATERIALS/);
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

test("command center groups primary actions and a clean text navigation menu", () => {
  const home = ui.home(owner, {
    username:"ArveeAdventurer", displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"
  },sample);
  const json=home.toJSON();
  const actions=json.components.filter((c)=>c.type===1 && c.components[0]?.type===2);
  const selects=findSelects(home);
  assert.equal(actions.length,1);
  assert.equal(actions[0].components.length,4);
  assert.equal(selects.length,1);
  assert.equal(selects[0].options.length,18);
  assert.equal(selects[0].custom_id,ui.custom(owner,"navigate"));
  assert.ok(selects[0].options.some((o)=>o.value==="market"));
});
test("filter and navigation menus use safe owner-locked custom IDs", () => {
  for (const v of [ui.inventoryFilters(owner),ui.shopFilters(owner)]) {
    for(const part of v.toJSON().components) if(part.type===1)
      for(const comp of part.components) if(comp.custom_id)
        assert.match(comp.custom_id,/^ai:2:123456789012345678:/);
  }
});

test("rune talent picker is unavailable until player has fragments", () => {
  const { perks } = require("../src/catalog");
  const empty = ui.perks(owner, {...sample,inventory:[],perks:[]},perks).toJSON();
  const menu = empty.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
  assert.equal(menu.disabled,true);
  assert.match(JSON.stringify(empty),/Rune Fragments:.*0/);
  const unlocked = ui.perks(owner, {...sample,inventory:[{item_id:"pickperk",quantity:1}],perks:[]},perks).toJSON();
  const active = unlocked.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
  assert.equal(active.disabled,false);
  assert.ok(unlocked.components.length <=10);
});

test("high-traffic screens use restrained text labels instead of decorative emoji", () => {
  const user={username:"Adventurer",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"};
  const world={
    crew:1,xp:0,gear:{kit:0,compass:0,ward:0},inventory:[],balance:dec(1000),active:null
  };
  const screens=[
    ui.home(owner,user,sample), ui.shop(owner,1,sample), ui.inventory(owner,sample),
    ui.crafting(owner,sample), ui.expeditionMap(owner,world), ui.expeditionGear(owner,world),
    ui.inventoryFilters(owner),ui.shopFilters(owner),ui.market(owner,[])
  ];
  for(const screen of screens) {
    const json=screen.toJSON();
    assert.equal(json.type,17);
    assert.ok(json.components.length<=10);
    assert.doesNotMatch(JSON.stringify(json),/\p{Emoji_Presentation}/u,
      "decorative emoji should not crowd compact screens");
    const dropdowns=json.components.filter(c=>c.type===1)
      .flatMap(c=>c.components).filter(c=>c.type===3);
    for(const menu of dropdowns) {
      assert.ok(menu.options.every(o=>!o.emoji), "dropdown choices use clean text labels");
    }
  }
  const home=ui.home(owner,user,sample).toJSON();
  const nav=home.components.filter(c=>c.type===1).flatMap(c=>c.components)
    .find(c=>c.type===3);
  assert.equal(nav.options.length,18);
  assert.ok(nav.options.some(c=>c.value==="explore"));
});
test("item artwork is retained in inspect details, not repeated across lists", () => {
  const listing=ui.inventory(owner,sample).toJSON();
  assert.doesNotMatch(JSON.stringify(listing),/\p{Emoji_Presentation}/u);
  const inspected=ui.item(owner,"coffee",2).toJSON();
  assert.match(JSON.stringify(inspected),/Campfire Brew/i);
  assert.match(JSON.stringify(inspected),/☕/u);
});
