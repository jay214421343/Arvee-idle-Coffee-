"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("quick mining reset is transaction-safe, never consumes expired/blocked items and works cross-server", {
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const user="999970000000"+crypto.randomInt(100000,999999),opts={requireMiningCooldown:true};
  try{
    await store.profile(user);
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'coffee',2),($1,'cola',1),($1,'rebirth_cocktail',1)",[user]);
    await store.pool.query("UPDATE players SET last_mine_at=clock_timestamp() WHERE user_id=$1",[user]);
    const first=await store.useItem(user,"coffee","",opts);
    assert.match(first.message,/Mining cooldown reset/);
    let p=await store.profile(user);
    assert.equal(p.lastMine,null);
    assert.equal(p.inventory.find(x=>x.item_id==="coffee").quantity,1);
    await assert.rejects(()=>store.useItem(user,"coffee","",opts),/no longer eligible/);
    p=await store.profile(user);
    assert.equal(p.inventory.find(x=>x.item_id==="coffee").quantity,1);
    await store.pool.query("UPDATE players SET last_mine_at=clock_timestamp(),mine_boost_charges=2,mine_boost_multiplier=2 WHERE user_id=$1",[user]);
    await assert.rejects(()=>store.useItem(user,"rebirth_cocktail","",opts),/no longer eligible/);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="rebirth_cocktail").quantity,1);
    await store.pool.query("UPDATE players SET next_mine_multiplier=20 WHERE user_id=$1",[user]);
    await assert.rejects(()=>store.useItem(user,"cola","",opts),/no longer eligible/);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="cola").quantity,1);
    const second=await store.useItem(user,"coffee","",opts);
    assert.match(second.message,/Mining cooldown reset/);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="coffee"),undefined);
    await store.pool.query("UPDATE players SET last_mine_at=clock_timestamp() WHERE user_id=$1",[user]);
    await assert.rejects(()=>store.useItem(user,"coffee","",opts),/Not enough Campfire Brew/);
    const remaining=await store.profile(user);
    assert.equal(remaining.lastMine!==null,true,"failed quick-use does not reset mining cooldown");
    assert.equal(remaining.inventory.some(x=>x.item_id==="cola"),true);
    const audit=await store.pool.query("SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='use_item'",[user]);
    assert.equal(audit.rows[0].n,2);
  } finally{
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[user]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[user]);
    await store.pool.end();
  }
});
