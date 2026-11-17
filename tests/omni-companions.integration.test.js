"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("new Mythic and Secret companions survive PostgreSQL migration, equip and boost passive IC across servers",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store"),pets=require("../src/companions");
  const uid="999953000000"+crypto.randomInt(100000,999999);
  try{
    await store.profile(uid);
    await store.adoptCompanion(uid,"ember_fox");
    await store.pool.query("INSERT INTO player_generators(user_id,generator_id,quantity) VALUES($1,'MSPS',6)",[uid]);
    const original=await store.profile(uid);
    assert.ok(original.rate.gt(0));
    for(const id of ["twilight_lynx","aurora_gryphon","eclipse_leviathan","eternal_sovereign"])
      await store.pool.query("INSERT INTO player_companions(user_id,pet_id,xp) VALUES($1,$2,$3)",
        [uid,id,pets.MAX_XP]);
    let last=original.rate;
    for(const id of ["twilight_lynx","aurora_gryphon","eclipse_leviathan","eternal_sovereign"]){
      await store.equipCompanion(uid,id);
      const status=await store.profile(uid);
      assert.ok(status.rate.gt(last),"higher-tier pet should increase rate");
      const expected=original.rate.times(1+pets.effectPct({id,level:30},"idle_income")/100);
      assert.equal(status.rate.toFixed(9),expected.toFixed(9));
      assert.equal((await store.getCompanions(uid)).activeId,id);
      last=status.rate;
    }
    await store.equipCompanion(uid,"ember_fox");
    assert.equal((await store.profile(uid)).rate.toFixed(9),original.rate.toFixed(9));
    const eggs=await store.getCompanions(uid);
    assert.ok(eggs.owned.some(p=>p.id==="eternal_sovereign"&&p.level===30));
    assert.equal(eggs.owned.length,5);
  }finally{
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
