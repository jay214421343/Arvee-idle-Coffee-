"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
test("new companion ownership is cross-server safe and Supply Cache chance improves without guaranteed fragments",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test DB");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const user="999986000000"+crypto.randomInt(100000,999999);
  const random=Math.random;
  try{
    await store.profile(user);
    const adopted=await store.adoptCompanion(user,"ember_fox");
    assert.equal(adopted.petId,"ember_fox");
    await store.pool.query("INSERT INTO player_companions(user_id,pet_id,xp) VALUES($1,'rune_gecko',0)",[user]);
    const owned=await store.getCompanions(user);
    assert.ok(owned.owned.some(p=>p.id==="rune_gecko"));
    await store.equipCompanion(user,"rune_gecko");
    assert.equal((await store.getCompanions(user)).activeId,"rune_gecko");
    Math.random=()=>0.08;
    const first=await store.mine(user);
    assert.equal(first.box,true,"Rune Gecko improves the 7% random Supply Cache chance");
    assert.ok(!first.fragments && !first.runeFragments,"No guaranteed rune reward");
    assert.equal((await store.profile(user)).inventory.filter(p=>p.item_id==="pickperk").length,0);
    await store.equipCompanion(user,"ember_fox");
    await store.pool.query("UPDATE players SET last_mine_at=NULL WHERE user_id=$1",[user]);
    const second=await store.mine(user);
    assert.equal(second.box,false,"Without Rune Gecko an 8% roll misses the 7% base");
    assert.equal((await store.profile(user)).inventory.filter(p=>p.item_id==="pickperk").length,0);
    assert.equal((await store.getCompanions(user)).activeId,"ember_fox");
  }finally{
    Math.random=random;
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[user]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[user]);
    await store.pool.end();
  }
});
