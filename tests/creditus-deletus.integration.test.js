"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
test("Creditus Deletus never deletes IC and concurrent use consumes at most one scroll",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to run outside the test database.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const user="999994000000"+crypto.randomInt(100000,999999);
  const oldRandom=Math.random;
  try{
    await store.profile(user);
    await store.pool.query("UPDATE players SET balance=1000000,total_earned=1000000,prestige=1 WHERE user_id=$1",[user]);
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'creditus_deletus',1)",[user]);
    const before=await store.profile(user);
    const attempts=await Promise.allSettled([store.useItem(user,"creditus_deletus"),store.useItem(user,"creditus_deletus")]);
    assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(attempts.filter(r=>r.status==="rejected").length,1);
    assert.match(attempts.find(r=>r.status==="fulfilled").value.message,/0 IC lost/);
    const after=await store.profile(user);
    assert.equal(after.balance.toString(),before.balance.toString());
    assert.equal(after.totalEarned.toString(),before.totalEarned.toString());
    assert.equal(after.prestige,before.prestige);
    assert.equal(after.generators.length,before.generators.length);
    assert.ok(!after.inventory.find(x=>x.item_id==="creditus_deletus"));
    const receipt=await store.pool.query(
      "SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='use_item'",[user]);
    assert.equal(receipt.rows[0].n,1);
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'legendary_lootbox',1)",[user]);
    Math.random=()=>0.999;
    const loot=await store.openLootbox(user,1,"legendary_lootbox");
    assert.deepEqual(loot,{creditus_deletus:1});
    const obtained=await store.profile(user);
    assert.equal(obtained.inventory.find(x=>x.item_id==="creditus_deletus").quantity,1);
  }finally{
    Math.random=oldRandom;
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[user]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[user]);
    await store.pool.end();
  }
});
