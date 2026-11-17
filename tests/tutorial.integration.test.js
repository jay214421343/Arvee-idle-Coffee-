"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("first-play onboarding is once per account, persistent, replayable, and never pays rewards",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe PostgreSQL test DB");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const game=require("../src/store"),guide=require("../src/tutorial-store");
  const id="999951000000"+crypto.randomInt(100000,999999);
  try{
    const p=await game.profile(id);
    assert.equal(p.balance.toFixed(0),"500");
    const first=await Promise.all([guide.startIfNew(id),guide.startIfNew(id)]);
    assert.deepEqual(first.sort(),[false,true],"only one server may show initial prompt");
    let state=(await game.pool.query("SELECT status,step FROM player_tutorial WHERE user_id=$1",[id])).rows[0];
    assert.equal(state.status,"active");assert.equal(state.step,0);
    await guide.transition(id,"tutorial_next",0);
    await assert.rejects(()=>guide.transition(id,"tutorial_next",0),/outdated/);
    state=(await game.pool.query("SELECT status,step FROM player_tutorial WHERE user_id=$1",[id])).rows[0];
    assert.equal(Number(state.step),1);
    await guide.transition(id,"tutorial_back",1);
    await assert.rejects(()=>guide.transition(id,"tutorial_finish",0),/Complete all/);
    const skipped=await guide.transition(id,"tutorial_skip",0);
    assert.equal(skipped.status,"skipped");
    await assert.rejects(()=>guide.transition(id,"tutorial_next",0),/closed/);
    assert.equal(await guide.startIfNew(id),false,"skipped users are never automatically interrupted again");
    const restarted=await guide.restart(id);
    assert.equal(restarted.status,"active");
    assert.equal(Number(restarted.step),0);
    for(let step=0;step<guide.LAST;step++)
      assert.equal(Number((await guide.transition(id,"tutorial_next",step)).step),step+1);
    const complete=await guide.transition(id,"tutorial_finish",guide.LAST);
    assert.equal(complete.status,"finished");
    assert.equal(await guide.startIfNew(id),false);
    await assert.rejects(()=>guide.transition(id,"tutorial_skip",guide.LAST),/closed/);
    const gameState=await game.profile(id);
    assert.equal(gameState.balance.toFixed(0),"500");
    assert.equal(gameState.prestige,0);
    assert.equal(gameState.inventory.length,0);
    const events=(await game.pool.query("SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1",[id])).rows[0].n;
    assert.equal(events,0,"tutorial browsing cannot award IC, items, or XP");
    assert.equal((await game.pool.query("SELECT status FROM player_tutorial WHERE user_id=$1",[id])).rows[0].status,"finished");
  }finally{
    await game.pool.query("DELETE FROM economy_events WHERE user_id=$1",[id]);
    await game.pool.query("DELETE FROM players WHERE user_id=$1",[id]);
    await game.pool.end();
  }
});
