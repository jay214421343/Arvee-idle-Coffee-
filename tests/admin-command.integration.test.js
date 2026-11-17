"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("owner admin edits are audited, atomic, idempotent and suspensions block gameplay",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store"),admin=require("../src/admin-store");
  const {OWNER_ID,ADMIN_GUILD_ID}=require("../src/admin-auth");
  const uid="999961000000"+crypto.randomInt(100000,999999);
  let count=0;
  const run=(type,kwargs={})=>admin.action({
    actorId:OWNER_ID,guildId:ADMIN_GUILD_ID,
    interactionId:"999960000000"+String(400000+count++),
    targetId:uid,type,...kwargs
  });
  try{
    await store.profile(uid);
    assert.match(await run("balance",{mode:"set",value:"23000"}),/23000/);
    assert.equal((await store.profile(uid)).balance.toFixed(0),"23000");
    await run("item",{mode:"add",itemId:"lootbox",value:2});
    await run("item",{mode:"take",itemId:"lootbox",value:1});
    assert.equal((await store.profile(uid)).inventory.find(x=>x.item_id==="lootbox").quantity,1);
    await run("operation",{mode:"set",operationId:"MSPS",value:3});
    assert.equal((await store.profile(uid)).generators.find(x=>x.generator_id==="MSPS").quantity,3);
    await run("perk",{field:"miner",value:5});
    await run("progress",{field:"orbs",value:2});
    assert.equal((await store.profile(uid)).orbs,2);
    await run("seasonxp",{mode:"add",value:25000});
    assert.equal((await store.seasonStatus(uid)).unlocked,100);
    await run("companion",{mode:"unlock",petId:"rune_gecko"});
    await run("companion",{mode:"xp_set",petId:"rune_gecko",value:4500});
    await run("companion",{mode:"equip",petId:"rune_gecko"});
    assert.equal((await store.getCompanions(uid)).activeId,"rune_gecko");
    await run("cooldown",{field:"both"});
    const sameId="999959000000"+crypto.randomInt(100000,999999);
    const params={actorId:OWNER_ID,guildId:ADMIN_GUILD_ID,interactionId:sameId,
      targetId:uid,type:"item",itemId:"coffee",mode:"add",value:1};
    const retries=await Promise.allSettled([admin.action(params),admin.action(params)]);
    assert.equal(retries.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(retries.filter(x=>x.status==="rejected").length,1);
    assert.equal((await store.profile(uid)).inventory.find(x=>x.item_id==="coffee").quantity,1);
    await run("suspend",{mode:"suspend",reason:"Regression test suspension"});
    await assert.rejects(()=>store.profile(uid),/suspended/);
    const inspected=await admin.inspect(OWNER_ID,ADMIN_GUILD_ID,uid);
    assert.match(inspected.suspension,/Regression/);
    await run("suspend",{mode:"unsuspend"});
    assert.equal((await store.profile(uid)).orbs,2);
    const logs=await admin.audit(OWNER_ID,ADMIN_GUILD_ID,uid,20);
    assert.ok(logs.length>=12);
    assert.ok(logs.some(r=>r.action==="suspend"));
  }finally{
    await store.pool.query("DELETE FROM admin_audit WHERE target_id=$1",[uid]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
