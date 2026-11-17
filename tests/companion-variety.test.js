"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const pets=require("../src/companions");
const exp=require("../src/exploration");
const bosses=require("../src/world-bosses");
const ui=require("../src/ui");
const {items}=require("../src/catalog");
const owner="123456789012345678";
test("all 18 companions are unique, bound to six rarity tiers and have useful specialized effects",()=>{
  assert.equal(pets.PETS.length,18);
  assert.equal(new Set(pets.PETS.map(p=>p.id)).size,18);
  for(const p of pets.PETS){
    const b=pets.bonus({id:p.id,level:10});
    assert.ok(b?.description && b.description.length>8,p.id+" lacks a meaningful combat/utility bonus");
    assert.ok(b.percent>=0 && b.percent<=25,p.id+" bonus exceeds bound");
    assert.ok(pets.RARITY_WEIGHTS[p.rarity] > 0);
  }
  assert.equal(pets.STARTERS.length,3);
  assert.ok(!pets.STARTERS.some(p=>p.rarity==="Mythic"));
  assert.match(pets.bonus({id:"rune_gecko",level:10}).description,/Supply Cache chance/);
  assert.doesNotMatch(pets.bonus({id:"rune_gecko",level:10}).description,/guaranteed|Rune Fragment/i);
});
test("new pets modify only their designated gameplay system",()=>{
  const region=exp.REGIONS[0];
  const baseline=exp.duration(region,{},null);
  assert.equal(exp.duration(region,{}, {id:"ember_fox",level:30}),baseline);
  assert.ok(exp.duration(region,{}, {id:"zephyr_finch",level:10})<baseline);
  assert.ok(exp.duration(region,{}, {id:"tempest_roc",level:10})<baseline);
  assert.ok(exp.chance(region,{}, {id:"trail_sprite",level:10})>exp.chance(region,{}));
  assert.equal(exp.chance(region,{}, {id:"runebound_golem",level:10}),exp.chance(region,{}));
  const make=()=>{let rolls=[0,0,0.5];return()=>rolls.shift();};
  const orig=exp.reward(region,{},make());
  const gem=exp.reward(region,{},make(),{id:"gem_serpent",level:10});
  assert.ok(gem.quantity>=orig.quantity);
  assert.ok(bosses.attackPower({mineXp:0,pickaxeTier:0,prestige:0}, {id:"ash_wolf",level:10})>45);
  assert.ok(bosses.attackCooldownMs({id:"void_moth",level:10})<bosses.attackCooldownMs());
  assert.equal(bosses.attackCooldownMs({id:"ember_fox",level:10}),bosses.attackCooldownMs());
});
test("egg rolls favor undiscovered pets and Mythic species are possible but rare",()=>{
  const weights=pets.PETS.map(p=>Math.round(pets.RARITY_WEIGHTS[p.rarity]*10)*2);
  let cumulative=0, target=-1;
  for(let i=0;i<pets.PETS.length;i++){
    if(pets.PETS[i].id==="hatchling_drake"){target=cumulative;break;}
    cumulative+=weights[i];
  }
  assert.ok(target>0);
  assert.equal(pets.hatch([],()=>target).id,"hatchling_drake");
  assert.equal(pets.hatch(["hatchling_drake"],()=>target).id,"hatchling_drake");
  assert.ok(pets.eggDrop("forest",true,()=>1300,{id:"hatchling_drake",level:30}));
  assert.ok(!pets.eggDrop("forest",false,()=>0,{id:"hatchling_drake",level:30}));
});
test("18-pet collection fits Discord Components V2 while exposing only three free starters",()=>{
  const start=ui.companionCollection(owner,{starterClaimed:false,activeId:null,eggs:0,owned:[]}).toJSON();
  const menu=start.components.filter(x=>x.type===1).flatMap(x=>x.components).find(x=>x.type===3);
  assert.equal(menu.options.length,3);
  const owned=pets.PETS.map(p=>({id:p.id,xp:0,level:1,stage:"Young",startXp:0,nextXp:100,bonus:pets.bonus({id:p.id,level:1})}));
  const full=ui.companionCollection(owner,{starterClaimed:true,activeId:"ember_fox",eggs:4,owned}).toJSON();
  assert.ok(full.components.length<=10);
  assert.ok(JSON.stringify(full).length<12000);
  assert.match(JSON.stringify(full),/Mythic/);
  assert.match(JSON.stringify(full),/Hatch egg/);
  const select=full.components.filter(x=>x.type===1).flatMap(x=>x.components).find(x=>x.type===3);
  assert.equal(select.options.length,18);
});
test("Runic Talents still require probabilistic Supply Cache finds",()=>{
  assert.ok(items.pickperk);
  const view=JSON.stringify(ui.perks(owner,{
    inventory:[{item_id:"pickperk",quantity:0}],perks:[]
  },require("../src/catalog").perks).toJSON());
  assert.match(view,/regular 1%/);
  assert.match(view,/rare 14%/);
  assert.match(view,/mythic 20%/);
  assert.doesNotMatch(view,/guaranteed/i);
});
