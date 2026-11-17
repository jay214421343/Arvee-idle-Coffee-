"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("season XP is fully credited beyond the old 500-per-day ceiling",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test DB");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const id="999983000000"+crypto.randomInt(100000,999999);
  try {
    await store.profile(id);
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'ore',1500),($1,'silver',500)",[id]);
    for(let i=0;i<5;i++)await store.craft(id,"coffee",100);
    const progress=await store.seasonStatus(id);
    assert.equal(progress.xp,625);
    assert.equal(progress.unlocked,2);
    assert.equal(Object.hasOwn(progress,"dailyXp"),false);
    const day=await store.pool.query("SELECT count(*)::integer AS n FROM season_xp_daily WHERE user_id=$1",[id]);
    assert.equal(day.rows[0].n,0);
  }finally{
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[id]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[id]);
    await store.pool.end();
  }
});
