"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const pets=require("../src/companions"),ui=require("../src/ui");
const owner="123456789012345678";
test("every non-omni companion has 2–3 distinct functional stat bonuses",()=>{
  const specialist=pets.PETS.filter(p=>p.effect!=="all_stats");
  assert.equal(specialist.length,18);
  const signatures=new Set();
  for(const pet of specialist){
    const traits=pets.SPECIALIST_TRAITS[pet.id];
    assert.ok(traits,pet.id);
    const entries=Object.entries(traits);
    assert.ok(entries.length>=2 && entries.length<=3,pet.id);
    assert.equal(entries[0][0],pet.effect,"signature ability is first");
    assert.equal(entries[0][1],1,"signature is always full strength");
    const signature=entries.map(([k,v])=>k+":"+v).join(",");
    assert.ok(!signatures.has(signature),"each pet has a distinct build");
    signatures.add(signature);
    for(const [effect,multiplier] of entries){
      assert.ok(multiplier>0 && multiplier<=1);
      assert.ok(pets.ALL_EFFECTS.includes(effect));
      assert.ok(pets.effectPct({id:pet.id,level:30},effect)>0);
    }
    const untouched=pets.ALL_EFFECTS.filter(e=>!Object.hasOwn(traits,e));
    for(const effect of untouched)assert.equal(pets.effectPct({id:pet.id,level:30},effect),0);
    const info=pets.bonus({id:pet.id,level:30}).description;
    assert.ok(info.split(" · ").length>=2);
  }
});
test("a specialist can outperform generalist Mythics in its chosen area",()=>{
  const primary=pets.effectPct({id:"phoenix_drake",level:30},"mine_income");
  const mythic=pets.effectPct({id:"eclipse_leviathan",level:30},"mine_income");
  assert.ok(primary>mythic);
  assert.equal(pets.effectPct({id:"phoenix_drake",level:30},"expedition_speed"),0);
  assert.ok(pets.effectPct({id:"eclipse_leviathan",level:30},"expedition_speed")>0);
  assert.ok(pets.effectPct({id:"moss_wisp",level:30},"expedition_speed")>
    pets.effectPct({id:"moss_wisp",level:30},"expedition_success"));
  assert.equal(pets.effectPct({id:"rune_gecko",level:1},"cache_luck"),5);
  assert.match(pets.bonus({id:"rune_gecko",level:10}).description,/Supply Cache chance/);
});
test("companion menu previews real starter abilities without exceeding Discord limits",()=>{
  const t=ui.companionCollection(owner,{starterClaimed:false,activeId:null,eggs:0,owned:[]}).toJSON();
  const picker=t.components.filter(x=>x.type===1).flatMap(x=>x.components).find(x=>x.type===3);
  assert.equal(picker.options.length,3);
  assert.match(picker.options[0].description,/Mining IC/);
  assert.match(picker.options[0].description,/Boss power/);
  assert.match(picker.options[1].description,/Expedition speed/);
  assert.ok(JSON.stringify(t).length<11000);
});
