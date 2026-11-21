'use strict';const test=require('node:test'),assert=require('node:assert/strict');
test('committed mining and daily credits use shared perks exactly once without changing crew income or cooldowns',{skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL},async()=>{
 if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error('Test database required');process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
 const store=require('../src/store'),ecosystem=require('../src/ecosystem'),id='999955'+Date.now();
 const account={available:true,membership:{name:'Prime',expiresAt:Date.now()+60000,idle:{miningPercent:10}},rpg:{level:25,prestige:0},sharedBoost:{name:'Community',percent:25,expiresAt:Date.now()+60000}};
 try{const original=await store.profile(id);const daily=await ecosystem.withAccount(id,account,()=>store.daily(id));assert.equal(daily.credits.toString(),'1050');assert.equal((await store.pool.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=\'lootbox\'',[id])).rows[0].quantity,3);
 const duplicate=await ecosystem.withAccount(id,account,()=>store.daily(id));assert(duplicate.cooldown>0);const result=await ecosystem.withAccount(id,account,()=>store.mine(id));assert.equal(result.multiplier.toString(),'1.4');assert.equal(result.reward.toString(),result.baseReward.times('1.4').floor().toString());const repeated=await ecosystem.withAccount(id,account,()=>store.mine(id));assert(repeated.cooldown>0);
 const after=await store.profile(id);assert.equal(after.rate.toString(),original.rate.toString());assert.equal((await store.pool.query('SELECT count(*)::int AS n FROM ecosystem_cosmetics WHERE user_id=$1 AND cosmetic_id=\'realm_traveler\'',[id])).rows[0].n,1);
 await store.pool.query("UPDATE players SET last_daily_at=NULL WHERE user_id=$1",[id]);const free=await ecosystem.withAccount(id,{available:false},()=>store.daily(id));assert.equal(free.credits.toString(),'765');
 }finally{await store.pool.query('DELETE FROM economy_events WHERE user_id=$1',[id]);await store.pool.query('DELETE FROM players WHERE user_id=$1',[id]);await store.pool.end();}
});
