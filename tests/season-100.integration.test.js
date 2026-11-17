"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("100 season tiers preserve claim uniqueness, grant the final reward exactly once",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const {SEASON}=require("../src/season");
  const uid="999958000000"+crypto.randomInt(100000,999999);
  try{
    await store.profile(uid);
    await store.pool.query("INSERT INTO season_progress(user_id,season_id,xp) VALUES($1,$2,25000)",[uid,SEASON.id]);
    const attempts=await Promise.all([store.claimSeasonRewards(uid,100),store.claimSeasonRewards(uid,100)]);
    assert.equal(attempts.reduce((n,x)=>n+x.grants.length,0),1);
    const claimed=await store.seasonStatus(uid);
    assert.equal(claimed.unlocked,100);
    assert.deepEqual(claimed.claimed,[100]);
    assert.equal((await store.profile(uid)).inventory.find(i=>i.item_id==="orb_of_almanac")?.quantity,1);
    const all=await store.claimSeasonRewards(uid,"all");
    assert.equal(all.grants.length,99);
    assert.equal((await store.claimSeasonRewards(uid,"all")).grants.length,0);
    assert.equal((await store.seasonStatus(uid)).claimed.length,100);
    const audit=await store.pool.query("SELECT count(*)::integer AS n FROM season_claims WHERE user_id=$1",[uid]);
    assert.equal(audit.rows[0].n,100);
  } finally{
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
