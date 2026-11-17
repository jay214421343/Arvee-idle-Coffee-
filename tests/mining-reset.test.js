"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const { dec }=require("../src/economy");
const { isUsableReset, eligibleMiningReset, RESET_ORDER }=require("../src/mining-reset");
const { handleComponent }=require("../src/commands");
const store=require("../src/store");
const ui=require("../src/ui");
const owner="123456789012345678";
function state(extra={}) {
  return { mineBonus:dec(1), mineBoostMultiplier:dec(1), mineBoostCharges:0,
    inventory:[],...extra };
}
test("only owned, compatible reset consumables qualify during mining cooldown",()=>{
  assert.deepEqual(RESET_ORDER,["coffee","cola","pumpkin_spice_latte","gnome","rebirth_cocktail"]);
  assert.equal(isUsableReset(state(),"coffee",30),true);
  assert.equal(isUsableReset(state(),"coffee",0),false);
  assert.equal(isUsableReset(state(),"starfruit",30),false);
  assert.equal(isUsableReset(state(),"ore",30),false);
  assert.equal(isUsableReset(state(),"rebirth_cocktail",30),true);
  assert.equal(isUsableReset(state({mineBoostCharges:2}),"rebirth_cocktail",30),false);
  assert.equal(isUsableReset(state({mineBonus:dec(20)}),"cola",30),false);
  assert.equal(isUsableReset(state({mineBonus:dec(6),mineBoostCharges:1,mineBoostMultiplier:dec(4)}),"gnome",30),false);
  assert.equal(isUsableReset(state({mineBonus:dec(20)}),"coffee",30),true);
  assert.equal(eligibleMiningReset(state({inventory:[{item_id:"cola",quantity:1},{item_id:"coffee",quantity:1}]}),30),"coffee");
  assert.equal(eligibleMiningReset(state({inventory:[{item_id:"cola",quantity:1}]}),30),"cola");
  assert.equal(eligibleMiningReset(state({inventory:[{item_id:"cola",quantity:0}]}),30),null);
  assert.equal(eligibleMiningReset(state({inventory:[{item_id:"rebirth_cocktail",quantity:1}],mineBoostCharges:2}),30),null);
  assert.equal(eligibleMiningReset(state({inventory:[{item_id:"coffee",quantity:1}]}),0),null);
});
test("mine_reset button routes an owner-bound item use and offers Mine now",async()=>{
  const previous=store.useItem;let called=0,response=null;
  store.useItem=async (uid,id,name,opts)=>{
    called++;assert.equal(uid,owner);assert.equal(id,"coffee");
    assert.equal(name,"");assert.deepEqual(opts,{requireMiningCooldown:true});
    return { itemId:"coffee",message:"Gained 50 IC. Mining cooldown reset. Ready now." };
  };
  try{
    const interaction={user:{id:owner},customId:ui.custom(owner,"mine_reset","coffee"),
      isButton:()=>true,isStringSelectMenu:()=>false,
      deferUpdate:async()=>{},editReply:async payload=>{response=payload;},
      followUp:async()=>{throw new Error("Should not fail");}};
    assert.equal(await handleComponent(interaction),true);
    assert.equal(called,1);
    const json=response.components[0].toJSON();
    assert.match(JSON.stringify(json),/MINING  \/  READY/);
    assert.match(JSON.stringify(json),/Campfire Brew/);
    const buttons=json.components.filter(x=>x.type===1).flatMap(x=>x.components);
    assert.equal(buttons[0].label,"Mine now");
    assert.equal(buttons[0].custom_id,ui.custom(owner,"mine"));
    assert.equal(buttons[1].label,"Command Center");
  } finally {store.useItem=previous;}
});
test("players cannot use another owner's mining reset button",async()=>{
  let invoked=false;
  const old=store.useItem;store.useItem=async()=>{invoked=true;};
  try{
    let reply;
    const interaction={user:{id:"999999999999999999"},customId:ui.custom(owner,"mine_reset","coffee"),
      isButton:()=>true,isStringSelectMenu:()=>false,
      reply:async p=>{reply=p;}};
    assert.equal(await handleComponent(interaction),true);
    assert.equal(invoked,false);
    assert.match(reply.content,/another player/);
  }finally{store.useItem=old;}
});
