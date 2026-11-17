"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const pets=require("../src/companions"),exp=require("../src/exploration"),boss=require("../src/world-bosses");
const ui=require("../src/ui");
const owner="123456789012345678";
const mythics=["twilight_lynx","aurora_gryphon","eclipse_leviathan"];
const secret="eternal_sovereign";
test("non-starter Mythics and Secret cannot be claimed through free starter adoption",async()=>{
  const store=require("../src/store");
  for(const id of [...mythics,secret])
    await assert.rejects(()=>store.adoptCompanion(owner,id),/three free starter companions/);
});

test("three escalating omni Mythics plus a super-rare Secret have nine real abilities",()=>{
  assert.equal(pets.PETS.length,22);
  assert.deepEqual(pets.PETS.filter(p=>p.effect==="all_stats").map(p=>p.id),[...mythics,secret]);
  assert.equal(pets.ALL_EFFECTS.length,9);
  assert.equal(new Set(pets.ALL_EFFECTS).size,9);
  assert.deepEqual(mythics.map(id=>pets.byId.get(id).rarity),["Mythic","Mythic","Mythic"]);
  assert.equal(pets.byId.get(secret).rarity,"Secret");
  assert.equal(pets.byId.get(secret).starter,false);
  assert.equal(pets.RARITY_WEIGHTS.Secret,0,"never obtained from normal rarity weights");
  assert.deepEqual(pets.STARTERS.map(p=>p.id),["ember_fox","moss_wisp","moon_owl"]);
  for(const level of [1,10,20,30]){
    for(const ability of pets.ALL_EFFECTS){
      const values=[...mythics,secret].map(id=>pets.effectPct({id,level},ability));
      assert.ok(values[0]>0,ability+" must activate");
      for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1],
        ability+" must scale between tiers at level "+level);
      assert.ok(values.at(-1)<= (ability==="boss_haste"?20:25));
    }
  }
  assert.equal(pets.effectPct({id:"moon_owl",level:30},"idle_income"),0,
    "specialist companions are unchanged");
  assert.match(pets.bonus({id:secret,level:30}).description,/All 9 buffs/);
  assert.match(pets.bonus({id:secret,level:30,talentId:"focus",charmId:"prospector_charm"}).description,/Focus.*Charm/);
});
test("Secret hatch probabilities have exact boundaries for each egg and never guarantee a Secret",()=>{
  const thresholds={
    companion_egg:10,rare_companion_egg:40,mythic_companion_egg:200
  };
  for(const [egg,chance] of Object.entries(thresholds)){
    assert.equal(pets.EGG_TIERS[egg].secretChance,chance);
    const win=limit=>limit===pets.SECRET_POOL?pets.SECRET_POOL-chance:0;
    const miss=limit=>limit===pets.SECRET_POOL?pets.SECRET_POOL-chance-1:0;
    assert.equal(pets.hatch([],win,egg).id,secret,egg+" should allow Secret");
    assert.equal(pets.hatch([secret],win,egg).id,secret,"Secret chance is ownership independent");
    assert.notEqual(pets.hatch([],miss,egg).id,secret,egg+" should miss just below boundary");
    assert.notEqual(pets.hatch([],()=>0,egg).id,secret,"an ordinary roll does not automatically grant Secret");
  }
  assert.throws(()=>pets.hatch([],()=>pets.SECRET_POOL,"companion_egg"),/Invalid companion egg roll/);
  assert.throws(()=>pets.hatch([],limit=>limit===pets.SECRET_POOL?-1:0),/Invalid secret egg roll/);
  assert.throws(()=>pets.hatch([],limit=>limit===pets.SECRET_POOL?pets.SECRET_POOL:0),/Invalid secret egg roll/);
});
test("all-round pets affect combat, expedition duration, success, loot, and egg/cache discovery",()=>{
  const reg=exp.REGIONS[0],pet={id:secret,level:30};
  assert.ok(exp.duration(reg,{},pet)<exp.duration(reg,{}));
  assert.ok(exp.chance(reg,{},pet)>exp.chance(reg,{}));
  const fake=()=>{const seq=[0,0,0.5];return()=>seq.shift();};
  assert.ok(exp.reward(reg,{},fake(),pet).quantity>exp.reward(reg,{},fake()).quantity);
  const stats={mineXp:0,pickaxeTier:0,prestige:0};
  assert.ok(boss.attackPower(stats,pet)>boss.attackPower(stats));
  assert.ok(boss.attackCooldownMs(pet)<boss.attackCooldownMs());
  assert.equal(pets.eggDrop("forest",true,()=>2000),false);
  assert.equal(pets.eggDrop("forest",true,()=>2000,pet),true);
  assert.ok(pets.effectPct(pet,"cache_luck")>pets.effectPct({id:"rune_gecko",level:1},"cache_luck"));
});
test("collection stays small, secret name stays hidden until discovered, and 22 choices fit Discord",()=>{
  const empty=ui.companionCollection(owner,{starterClaimed:true,activeId:null,eggs:0,owned:[]}).toJSON();
  assert.match(JSON.stringify(empty),/Secret \?/);
  assert.doesNotMatch(JSON.stringify(empty),/Eternal Sovereign/);
  const owned=pets.PETS.map(p=>({id:p.id,xp:0,level:1,stage:"Young",
    startXp:0,nextXp:100,bonus:pets.bonus({id:p.id,level:1})}));
  const full=ui.companionCollection(owner,{starterClaimed:true,activeId:secret,eggs:0,owned}).toJSON();
  assert.ok(full.components.length<=10);
  const menu=full.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
  assert.equal(menu.options.length,22);
  assert.ok(menu.options.length<=25);
  assert.match(JSON.stringify(full),/Eternal Sovereign/);
  const mastery=ui.companionMastery(owner,{activeId:secret,owned:owned.map(p=>({...p,level:20})),charms:{}}).toJSON();
  assert.ok(mastery.components.length<=10);
});
