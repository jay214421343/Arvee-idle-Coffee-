"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const pets = require("../src/companions");
const exploration = require("../src/exploration");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const { dec } = require("../src/economy");
const owner = "123456789012345678";
const empty = { starterClaimed:false,activeId:null,eggs:0,owned:[] };
test("companions have consistent levels, stage transitions and capped bonuses", () => {
  assert.equal(pets.PETS.length,22);
  assert.deepEqual(pets.STARTERS.map(p=>p.id),["ember_fox","moss_wisp","moon_owl"]);
  assert.equal(new Set(pets.PETS.map(p=>p.id)).size,22);
  assert.deepEqual(new Set(pets.PETS.map(p=>p.rarity)),
    new Set(["Common","Uncommon","Rare","Epic","Legendary","Mythic","Secret"]));
  assert.equal(pets.level(0),1);
  assert.equal(pets.level(99),1);
  assert.equal(pets.level(100),2);
  assert.equal(pets.level(4500),10);
  assert.equal(pets.stage(10),"Awakened");
  assert.equal(pets.stage(20),"Evolved");
  assert.equal(pets.level(pets.MAX_XP+100000),30);
  assert.equal(pets.boostPct(1),5);
  assert.equal(pets.boostPct(30),19.5);
  assert.throws(()=>pets.level(-1),/Invalid companion/);
  assert.throws(()=>pets.boostPct(31),/Invalid companion/);
});
test("companion XP comes from real gameplay only", () => {
  assert.equal(pets.eventXp("mine"),10);
  assert.equal(pets.eventXp("daily"),25);
  assert.equal(pets.eventXp("expedition_complete"),65);
  assert.equal(pets.eventXp("craft",{quantity:1000}),50);
  assert.equal(pets.eventXp("market_buy"),0);
  assert.equal(pets.eventXp("companion_hatch"),0);
});
test("egg drops are pre-rolled at expedition start and hatch favors unowned pets", () => {
  assert.equal(pets.eggDrop("forest",true,()=>0),true);
  assert.equal(pets.eggDrop("forest",true,()=>9999),false);
  assert.equal(pets.eggDrop("forest",false,()=>0),false);
  assert.equal(pets.eggDrop("ruins",true,()=>2499),true);
  assert.equal(pets.eggDrop("ruins",true,()=>2500),false);
  assert.equal(pets.eggDrop("ruins",true,()=>2500,{id:"hatchling_drake",level:30}),true);
  assert.throws(()=>pets.eggDrop("unknown",true,()=>0),/Unknown egg/);
  assert.equal(pets.hatch([],()=>0).id,"ember_fox");
  assert.equal(pets.hatch(["ember_fox"],()=>41).id,"ember_fox");
  assert.ok(pets.PETS.some(p=>p.id==="hatchling_drake"&&p.rarity==="Mythic"));
  assert.equal(pets.effectPct({id:"rune_gecko",level:1},"cache_luck"),5);
  assert.equal(pets.effectPct({id:"rune_gecko",level:30},"cache_luck"),19.5);
  assert.equal(pets.effectPct({id:"ember_fox",level:1},"cache_luck"),0);
  assert.throws(()=>pets.hatch([],()=>-1),/Invalid companion egg/);
});
test("Moss Wisp affects expedition duration and Moon Owl improves material loot", () => {
  const forest=exploration.REGIONS[0];
  assert.equal(exploration.duration(forest,{},null),120);
  assert.equal(exploration.duration(forest,{}, {id:"moss_wisp",level:1}),114);
  assert.equal(exploration.duration(forest,{}, {id:"moss_wisp",level:30}),97);
  const make=()=>{let rolls=[0,0,0.5];return()=>rolls.shift();};
  const ordinary=exploration.reward(forest,{},make());
  const owl=exploration.reward(forest,{},make(),{id:"moon_owl",level:1});
  assert.equal(owl.outcome,"success");
  assert.equal(owl.itemId,ordinary.itemId);
  assert.ok(owl.quantity>ordinary.quantity);
  assert.equal(exploration.reward(forest,{},()=>0.99,{id:"moon_owl",level:30}).quantity,1);
});
test("companion selection is a compact owner-locked V2 interface", () => {
  const adopted={...empty,starterClaimed:true,activeId:"ember_fox",eggs:2,owned:[{
    id:"ember_fox",xp:200,level:2,stage:"Young",
    startXp:100,nextXp:300,bonus:pets.bonus({id:"ember_fox",level:2})
  }]};
  const views=[ui.companionCollection(owner,empty),ui.companionCollection(owner,adopted)];
  for(const view of views){
    const json=view.toJSON();
    assert.equal(json.type,17);
    assert.ok(json.components.length<=10);
    assert.doesNotMatch(JSON.stringify(json),/\p{Emoji_Presentation}/u);
    const actions=json.components.filter(c=>c.type===1).flatMap(c=>c.components);
    const menus=actions.filter(c=>c.type===3);
    assert.equal(menus.length,1);
    assert.ok(menus[0].custom_id.startsWith("ai:2:"+owner+":companion_"));
    assert.ok(menus[0].options.every(o=>!o.emoji));
    assert.ok(actions.filter(c=>c.type===2).length<=3);
  }
  const active=views[1].toJSON();
  assert.match(JSON.stringify(active),/Ember Fox/);
  assert.match(JSON.stringify(active),/Hatch egg/);
  const starter=views[0].toJSON();
  assert.match(JSON.stringify(starter),/free starter/);
});
test("slash command and navigation expose companions without extra buttons", () => {
  assert.ok(idle.toJSON().options.some(c=>c.name==="companions"));
  const user={username:"Adventurer",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"};
  const home=ui.home(owner,user,{balance:dec(500),rate:dec(0),totalEarned:dec(500),
    generators:[],mineXp:0,prestige:0}).toJSON();
  const options=home.components.filter(c=>c.type===1).flatMap(c=>c.components)
    .filter(c=>c.type===3).flatMap(c=>c.options);
  assert.ok(options.some(o=>o.value==="adventure_menu"));
  assert.equal(options.length,6);
  const adventure=ui.sectionMenu(owner,"adventure").toJSON();
  const destinations=adventure.components.filter(c=>c.type===1).flatMap(c=>c.components)
    .filter(c=>c.type===3).flatMap(c=>c.options);
  assert.ok(destinations.some(o=>o.value==="companions"));
});
