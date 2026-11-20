"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("browser and Discord share saved economy; receipts and cosmetics survive concurrent access",{skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Dedicated test database required.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store"),browser=require("../src/browser"),ecosystem=require("../src/ecosystem");
  const user={id:"988887"+crypto.randomInt(100000000000,999999999999),username:"Browser Integration"};
  try{
    const before=await store.profile(user.id);
    const requestId=Date.now().toString(36)+"."+crypto.randomUUID(),action={kind:"command",command:"mine"};
    // Bypass only the onboarding dispatcher, using the actual Discord command handler.
    const {respond,handleComponent}=require("../src/commands");
    const runner=(actor,input)=>browser.run(actor,input,{respond,handleComponent,routeTutorial:(interaction,dispatch)=>dispatch(interaction)});
    const result=await browser.execute(store.pool,user,action,requestId,runner);
    assert.deepEqual(await browser.execute(store.pool,user,action,requestId,runner),result);
    const mined=await store.profile(user.id); assert(mined.mineXp>before.mineXp);
    assert.equal((await store.pool.query("SELECT count(*)::int AS n FROM economy_events WHERE user_id=$1 AND event_type='mine'",[user.id])).rows[0].n,1);
    // The web client cannot bypass the cooldown by switching from Discord.
    assert((await store.mine(user.id)).cooldown>0);
    await store.transact([user.id],async db=>{
      await ecosystem.synchronize(db,user.id,{available:true,membership:null,rpg:{level:25,prestige:1}});
      await ecosystem.synchronize(db,user.id,{available:true,membership:null,rpg:{level:25,prestige:1}});
    });
    assert.equal((await store.pool.query("SELECT count(*)::int AS n FROM ecosystem_cosmetics WHERE user_id=$1",[user.id])).rows[0].n,2);
    assert.equal((await store.profile(user.id)).balance.toString(),mined.balance.toString());
  } finally {
    await store.pool.query("DELETE FROM browser_actions WHERE user_id=$1",[user.id]);
    // Player rows reference audit events; remove the fixture's events first.
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[user.id]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[user.id]);
    await store.pool.end();
  }
});
