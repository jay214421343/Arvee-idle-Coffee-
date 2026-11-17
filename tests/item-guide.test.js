"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const loot=require("../src/loot-tables"),guide=require("../src/item-guide");
const {items}=require("../src/catalog");
const ui=require("../src/ui");
const user="123456789012345678";
test("every item has a grounded acquisition guide without invented guaranteed drops",()=>{
  for(const id of Object.keys(items)){
    const list=guide.sources(id);
    assert.ok(list.length>=1,id);
    assert.equal(list.at(-1),"Trade with other players through /idle market");
    assert.ok(JSON.stringify(ui.itemInfo(user,id)).length<17500,id+" too long");
  }
  assert.match(guide.sources("ore").join(" "),/Mining/);
  assert.match(guide.sources("prospector_charm").join(" "),/charm bonus/);
  assert.match(guide.sources("rebirth_cocktail").join(" "),/not guaranteed/);
  assert.match(guide.sources("mythic_companion_egg").join(" "),/tier/);
});
test("primary loot table odds sum to 100% and boundaries match cache rolls",()=>{
  for(const type of Object.keys(loot.BASE)){
    const amounts=loot.baseChances(type),sum=amounts.reduce((x,y)=>x+y.chance,0);
    assert.equal(sum,100);
    let before=0;
    for(const {id,chance} of amounts){
      assert.equal(loot.mainDrop(type,(before+chance/2)/100),id);
      before+=chance;
    }
    assert.equal(loot.mainDrop(type,.9999999),amounts.at(-1).id);
  }
  assert.equal(loot.mainDrop("legendary_lootbox",.994),"strange_matter");
  assert.equal(loot.mainDrop("legendary_lootbox",.995),"creditus_deletus");
  assert.throws(()=>loot.mainDrop("lootbox",1),/Invalid/);
});
test("lootbox /idle info lists actual possible items, percentages, bonus and charm pools",()=>{
  for(const type of ["lootbox","rare_lootbox","legendary_lootbox","lunchbox"]){
    const text=guide.cacheContents(type);
    assert.ok(text);
    if(type==="lunchbox"){
      assert.match(text,/one ration and one tonic/);
      assert.match(text,/25%/);
    }else{
      assert.match(text,/guaranteed main drop/);
      for(const [id] of loot.BASE[type])assert.ok(text.includes(items[id].name));
      for(const id of loot.BONUS[type].items)assert.ok(text.includes(items[id].name));
      assert.match(text,/Independent bonus/);
    }
    const card=JSON.stringify(ui.itemInfo(user,type).toJSON());
    assert.match(card,/POSSIBLE CONTENTS/);
    assert.match(card,/HOW TO OBTAIN/);
  }
  assert.match(guide.cacheContents("legendary_lootbox"),/0.5%/);
  assert.match(guide.cacheContents("legendary_lootbox"),/20% total/);
});
