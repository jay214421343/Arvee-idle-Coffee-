"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
test("rebirth bonus is atomic, optional and lunchboxes yield exactly two usable consumables",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store"),original=Math.random;
  const uid="999985000000"+crypto.randomInt(100000,999999);
  try {
    await store.profile(uid);
    await store.pool.query("UPDATE players SET balance=1000000000,total_earned=1000000000 WHERE user_id=$1",[uid]);
    Math.random=()=>0.01;
    const results=await Promise.allSettled([store.prestige(uid),store.prestige(uid)]);
    assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(results.filter(x=>x.status==="rejected").length,1);
    assert.equal(results.find(x=>x.status==="fulfilled").value.bonusItemId,"lunchbox");
    let p=await store.profile(uid);
    assert.equal(p.inventory.find(x=>x.item_id==="lunchbox")?.quantity,1);
    assert.equal(p.inventory.find(x=>x.item_id==="rebirth_cocktail")?.quantity,1);
    const before=p.inventory.reduce((n,x)=>n+x.quantity,0);
    Math.random=()=>0;
    const drops=await store.openLootbox(uid,1,"lunchbox");
    assert.deepEqual(drops,{apple:1,coffee:1});
    p=await store.profile(uid);
    assert.equal(p.inventory.some(x=>x.item_id==="lunchbox"),false);
    assert.equal(p.inventory.find(x=>x.item_id==="apple")?.quantity,1);
    assert.equal(p.inventory.find(x=>x.item_id==="coffee")?.quantity,1);
    assert.equal(p.inventory.reduce((n,x)=>n+x.quantity,0),before+1);
  } finally {
    Math.random=original;
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
