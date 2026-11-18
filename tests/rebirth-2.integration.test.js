"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("rebirth specialization, retroactive milestones and advanced op gates work across servers",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test DB");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store"),rebirth=require("../src/rebirth");
  const uid="999949000000"+crypto.randomInt(100000,999999);
  const random=Math.random;
  try{
    await store.profile(uid);
    await assert.rejects(()=>store.buyGenerator(uid,"RNFG",1),/Unlock/);
    await store.setRebirthPath(uid,"tycoon");
    let p=await store.profile(uid);
    assert.equal(p.rebirthPath,"none");
    assert.equal(p.nextRebirthPath,"tycoon");
    await store.pool.query("UPDATE players SET prestige=20,balance=1000000000,last_mine_at=NULL WHERE user_id=$1",[uid]);
    Math.random=()=>0;
    const dig=await store.mine(uid);
    assert.equal(dig.milestones.length,4);
    assert.ok(dig.milestones.some(x=>x.id==="rare_lootbox"));
    const won=await store.prestige(uid);
    assert.equal(won.prestige,21);
    assert.equal(won.path,"tycoon");
    p=await store.profile(uid);
    assert.equal(p.rebirthPath,"tycoon");
    assert.equal(p.nextRebirthPath,"tycoon");
    assert.equal(p.inventory.find(x=>x.item_id==="strange_matter").quantity,1);
    await assert.rejects(()=>store.buyGenerator(uid,"RNFG",1),/Unlock/);
    await store.pool.query("UPDATE players SET prestige=35,balance=1000000000000 WHERE user_id=$1",[uid]);
    const purchase=await store.buyGenerator(uid,"RNFG",1);
    assert.equal(purchase.generator.id,"RNFG");
    assert.ok(purchase.rate.gt(0));
    await store.setRebirthPath(uid,"miner");
    const next=await store.prestige(uid);
    assert.equal(next.prestige,36);
    assert.equal(next.path,"miner");
    assert.equal((await store.profile(uid)).rebirthPath,"miner");
    assert.equal((await store.profile(uid)).inventory.find(x=>x.item_id==="strange_matter").quantity,1);
    await assert.rejects(()=>store.setRebirthPath(uid,"godmode"),/Invalid/);
  }finally{
    Math.random=random;
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
