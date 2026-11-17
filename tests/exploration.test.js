"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const exploration = require("../src/exploration");
const ui = require("../src/ui");
const season = require("../src/season");
const { DAILY, WEEKLY } = require("../src/challenges");
const { idle } = require("../src/commands");
const { dec } = require("../src/economy");
const owner = "123456789012345678";
function status(extra = {}) {
  return { crew: 1, xp: 0, gear: {kit:0,compass:0,ward:0}, inventory: [], balance: dec(500),
    active: null, ...extra };
}
test("region unlocks use crew plus real exploration XP", () => {
  const [forest, mines, ruins] = exploration.REGIONS;
  assert.deepEqual(exploration.REGIONS.map((r) => r.id), ["forest","mines","ruins"]);
  assert.equal(exploration.unlocked(forest, 1, 0), true);
  assert.equal(exploration.unlocked(mines, 3, 69), false);
  assert.equal(exploration.unlocked(mines, 3, 70), true);
  assert.equal(exploration.unlocked(ruins, 7, 999), false);
  assert.equal(exploration.unlocked(ruins, 8, 210), true);
});
test("equipment yields stable duration, success and cost rules", () => {
  const forest = exploration.REGIONS[0];
  assert.equal(exploration.duration(forest, {kit:0}), 120);
  assert.equal(exploration.duration(forest, {kit:5}), 78);
  assert.ok(exploration.chance(forest, {ward:5}) <= 0.98);
  assert.equal(exploration.upgradeCost("kit",0).credits, 100);
  assert.deepEqual(exploration.upgradeCost("kit",0).materials,{ore:4,silver:1});
  assert.ok(exploration.upgradeCost("ward",3).materials.gold>0);
  assert.throws(()=>exploration.upgradeCost("kit",5), /maximum level/);
  assert.throws(()=>exploration.upgradeCost("unknown",0), /Unknown equipment/);
  assert.deepEqual(exploration.levels([{gear_id:"kit",level:2}]),{kit:2,compass:0,ward:0});
});
test("expedition outcomes are calculated server-side and bounded", () => {
  const forest=exploration.REGIONS[0];
  const success=exploration.reward(forest,{compass:2,ward:0},(()=>{let a=[0.1,0,0.8];return()=>a.shift();})());
  assert.equal(success.outcome,"success");
  assert.equal(success.credits,450);
  assert.equal(success.itemId,"ore");
  assert.ok(success.quantity>=3 && success.quantity<=8);
  const setback=exploration.reward(forest,{},()=>0.99);
  assert.equal(setback.outcome,"setback");
  assert.ok(setback.credits>0 && setback.credits<450);
  assert.equal(setback.quantity,1);
  assert.throws(()=>exploration.reward({id:"unknown"}),/Unknown expedition region/);
});
test("world map, region briefing and gear views stay within Discord V2 limits", () => {
  const views=[
    ui.expeditionMap(owner,status()),
    ui.expeditionRegion(owner,status(),"forest"),
    ui.expeditionGear(owner,status())
  ];
  for(const view of views) {
    const j=view.toJSON();
    assert.equal(j.type,17);
    assert.ok(j.components.length<=10);
    assert.ok(JSON.stringify(j).length<10000);
    for (const section of j.components.filter(x=>x.type===9)) {
      assert.match(section.accessory.custom_id,/^ai:2:123456789012345678:/);
    }
  }
  const map=views[0].toJSON();
  assert.equal(map.components.filter(x=>x.type===9).length,3);
  assert.match(JSON.stringify(map),/Whispering Forest/);
  const region=views[1].toJSON();
  assert.ok(region.components.filter(x=>x.type===1).flatMap(x=>x.components)
    .some(x=>x.custom_id===ui.custom(owner,"expedition_start","forest")&&!x.disabled));
});
test("equipment upgrade uses one contextual dropdown and shows affordability", () => {
  const menus = (j) => j.components.filter(x=>x.type===1).flatMap(x=>x.components).filter(x=>x.type===3);
  const empty=ui.expeditionGear(owner,status()).toJSON();
  assert.equal(empty.components.filter(x=>x.type===9).length,0);
  assert.equal(menus(empty).length,1);
  assert.equal(menus(empty)[0].disabled,true);
  const enough=status({inventory:[{item_id:"ore",quantity:100},{item_id:"silver",quantity:100}],balance:dec(10000)});
  const full=ui.expeditionGear(owner,enough).toJSON();
  assert.equal(menus(full)[0].disabled,false);
  assert.equal(menus(full)[0].options.length,3);
  assert.equal(menus(full)[0].custom_id,ui.custom(owner,"equipment_select"));
  assert.ok(full.components.filter(x=>x.type===1).flatMap(x=>x.components).filter(x=>x.type===2).length<=2);
  const capped=ui.expeditionGear(owner,status({...enough,gear:{kit:5,compass:5,ward:5}})).toJSON();
  assert.equal(menus(capped)[0].disabled,true);
});
test("active missions prevent new starts until collection and show server timer", () => {
  const active={id:"1",regionId:"forest",finishesAt:"2027-01-01T00:00:00.000Z",ready:false};
  const waiting=ui.expeditionMap(owner,status({active})).toJSON();
  const buttons=waiting.components.filter(x=>x.type===1).flatMap(x=>x.components);
  assert.ok(!buttons.some(x=>x.custom_id===ui.custom(owner,"expedition_collect")));
  assert.match(JSON.stringify(waiting),/Returns/);
  const ready=ui.expeditionMap(owner,status({active:{...active,ready:true}})).toJSON();
  assert.ok(ready.components.filter(x=>x.type===1).flatMap(x=>x.components)
    .some(x=>x.custom_id===ui.custom(owner,"expedition_collect")&&!x.disabled));
  assert.ok(ui.expeditionRegion(owner,status({active}),"forest").toJSON().components
    .filter(x=>x.type===1).flatMap(x=>x.components)
    .some(x=>x.custom_id===ui.custom(owner,"expedition_start","forest")&&x.disabled));
});
test("slash commands and navigation expose World Map and Equipment", () => {
  const names=idle.toJSON().options.map(x=>x.name);
  assert.ok(names.includes("explore")&&names.includes("equipment"));
  const p={username:"Explorer",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"};
  const home=ui.home(owner,p,{balance:dec(500),rate:dec(0),totalEarned:dec(500),
    prestige:0,mineXp:0,generators:[]}).toJSON();
  const options=home.components.filter(x=>x.type===1).flatMap(x=>x.components)
    .filter(x=>x.type===3).flatMap(x=>x.options);
  assert.ok(options.some(x=>x.value==="adventure_menu"));
  assert.equal(options.length,6);
  const adventure=ui.sectionMenu(owner,"adventure").toJSON();
  const options2=adventure.components.filter(x=>x.type===1).flatMap(x=>x.components)
    .filter(x=>x.type===3).flatMap(x=>x.options);
  assert.ok(options2.some(x=>x.value==="explore"));
  assert.ok(options2.some(x=>x.value==="equipment"));
});
test("expedition completion advances the season and rotating contracts", () => {
  assert.equal(season.eventXp("expedition_complete"),60);
  assert.equal(season.eventXp("expedition_gear_upgrade"),35);
  assert.equal(season.eventXp("expedition_start"),0);
  assert.ok(DAILY.some(x=>x.event==="expedition_complete"));
  assert.ok(WEEKLY.some(x=>x.event==="expedition_complete"));
});
