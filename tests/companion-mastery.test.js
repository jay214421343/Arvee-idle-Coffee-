"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const pets=require("../src/companions"),ui=require("../src/ui");
const {idle,handleAutocomplete}=require("../src/commands");
const {items,recipes}=require("../src/catalog");
const owner="123456789012345678";
test("mastery respects level 10 and 20 thresholds, effect caps and role-specific builds",()=>{
  const base={id:"ember_fox",level:10,talentId:null,charmId:null};
  const focus={...base,talentId:"focus"},tracker={...base,talentId:"tracker"};
  assert.equal(Object.keys(pets.TALENTS).length,3);
  assert.equal(Object.keys(pets.CHARMS).length,3);
  assert.ok(pets.effectPct(focus,"mine_income")>pets.effectPct(base,"mine_income"));
  assert.equal(pets.effectPct(tracker,"mine_income"),pets.effectPct(base,"mine_income"));
  assert.ok(pets.effectPct(tracker,"cache_luck")>0);
  assert.ok(pets.effectPct({...tracker,level:20},"cache_luck")>pets.effectPct(tracker,"cache_luck"));
  assert.ok(pets.effectPct({...base,talentId:"vanguard"},"boss_power")>0);
  assert.ok(pets.effectPct({...base,charmId:"prospector_charm"},"mine_income")>pets.effectPct(base,"mine_income"));
  assert.equal(pets.effectPct({...base,charmId:"prospector_charm"},"boss_haste"),0);
  assert.equal(pets.effectPct({...focus,level:30,charmId:"prospector_charm"},"mine_income"),25);
  assert.equal(pets.effectPct({...base,level:9,talentId:"focus"},"mine_income"),pets.effectPct({...base,level:9},"mine_income"));
  assert.match(pets.bonus({...focus,charmId:"prospector_charm"}).description,/Focus.*Charm/);
});
test("rarity eggs exclude lower-tier pets but never promise a specific legendary",()=>{
  const standard=pets.hatch([],()=>0);
  const rare=pets.hatch([],()=>0,"rare_companion_egg");
  const mythic=pets.hatch([],()=>0,"mythic_companion_egg");
  assert.equal(standard.id,"ember_fox");
  assert.ok(!["Common"].includes(rare.rarity));
  assert.ok(["Rare","Epic","Legendary","Mythic"].includes(mythic.rarity));
  assert.throws(()=>pets.hatch([],undefined,"invalid"),/Unknown companion egg/);
  for(const item of Object.keys(pets.EGG_TIERS))assert.ok(items[item]);
  for(const charm of Object.keys(pets.CHARMS)){
    assert.ok(items[charm]);
    assert.ok(recipes[charm]);
  }
  assert.ok(recipes.rare_companion_egg);
  assert.ok(recipes.mythic_companion_egg);
});
test("Companion Mastery and Hatchery fit compact owner-bound Discord components",()=>{
  const pet={id:"ember_fox",xp:4500,level:10,stage:"Awakened",startXp:4500,nextXp:5500,
    talentId:null,bonus:pets.bonus({id:"ember_fox",level:10})};
  const state={starterClaimed:true,activeId:"ember_fox",eggs:2,eggCounts:{
    companion_egg:2,rare_companion_egg:1,mythic_companion_egg:0},
    charms:{prospector_charm:1,pathfinder_charm:0,warcaller_charm:1},
    equippedCharmId:null,owned:[pet]};
  const view=ui.companionMastery(owner,state).toJSON();
  assert.equal(view.type,17);
  assert.ok(view.components.length<=10);
  const menus=view.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===3);
  assert.equal(menus.length,2);
  assert.equal(menus[0].options.length,3);
  assert.equal(menus[1].options.length,3);
  const eggs=ui.companionEggs(owner,state).toJSON();
  const select=eggs.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
  assert.equal(select.options.length,2);
  assert.match(JSON.stringify(eggs),/Enchanted Egg/);
  const low=ui.companionMastery(owner,{...state,owned:[{...pet,level:9}] }).toJSON();
  assert.equal(low.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===3).length,1);
  assert.match(JSON.stringify(ui.item(owner,"prospector_charm",1).toJSON()),/Equip charm/);
  assert.match(JSON.stringify(ui.item(owner,"rare_companion_egg",1).toJSON()),/Hatch egg/);
});
test("Forge autocomplete handles more than 25 recipes and still bounds its suggestions",async()=>{
  assert.ok(Object.keys(recipes).length>25);
  const craft=idle.toJSON().options.find(o=>o.name==="craft").options.find(o=>o.name==="item");
  assert.equal(craft.autocomplete,true);
  let choices=null;
  await handleAutocomplete({isAutocomplete:()=>true,commandName:"idle",
    options:{getFocused:()=>({name:"item",value:"Charm"}),getSubcommand:()=>"craft"},
    respond:async data=>{choices=data;}});
  assert.ok(choices.some(x=>x.value==="prospector_charm"));
  assert.ok(choices.every(x=>Object.hasOwn(recipes,x.value)));
  assert.ok(choices.length<=25);
});
