"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("weekly boss HP, attacks, and payout claims are global and transactional",{
  skip: !process.env.ARVEE_IDLE_TEST_DATABASE_URL
}, async (context) => {
  if (!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to run world boss integration tests outside arvee_idle_test.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const bosses=require("../src/world-bosses");
  const rand=crypto.randomInt(100000,999999).toString();
  const a="999981000000"+rand,b="999982000000"+rand,c="999983000000"+rand;
  const currentKey=bosses.cycle().key, oldKey="20261005";
  const existing=await store.pool.query(
    "SELECT period_key FROM world_boss_instances WHERE period_key=ANY($1::text[])",
    [[currentKey,oldKey]]
  );
  if (existing.rowCount) {
    await store.pool.end();
    context.skip("World boss fixtures require an isolated empty test database.");
    return;
  }
  try {
    const a0=await store.getWorldBoss(a);
    const b0=await store.getWorldBoss(b);
    assert.equal(a0.periodKey,b0.periodKey);
    assert.equal(a0.maxHp,b0.maxHp);
    assert.equal(a0.hp,b0.hp);
    assert.equal(a0.myAttacks,0);
    assert.equal(a0.canAttack,true);
    await store.adoptCompanion(a,"ember_fox");
    await store.adoptCompanion(b,"moss_wisp");
    await store.adoptCompanion(c,"moon_owl");
    const attacks=await Promise.all([
      store.attackWorldBoss(a),store.attackWorldBoss(b),store.attackWorldBoss(c)
    ]);
    assert.equal(attacks.length,3);
    assert.equal(attacks[0].damage,47);
    assert.equal(attacks[1].damage,45);
    assert.equal(attacks[2].damage,45);
    const global=await store.getWorldBoss(a);
    assert.equal(global.hp,a0.hp-attacks.reduce((n,x)=>n+x.damage,0));
    assert.equal(global.participants,3);
    assert.equal(global.myDamage,47);
    assert.equal(global.myAttacks,1);
    const owl=await store.pool.query(
      "SELECT owl_bonus_points FROM world_boss_contributions WHERE period_key=$1 AND user_id=$2",
      [currentKey,c]
    );
    assert.equal(Number(owl.rows[0].owl_bonus_points),45*500);
    await assert.rejects(()=>store.attackWorldBoss(a),/next strike/);
    await assert.rejects(()=>store.claimWorldBossReward(a,currentKey),/still active/);
    await store.pool.query(
      "UPDATE world_boss_contributions SET next_attack_at=now()-interval '1 second' " +
      "WHERE period_key=$1 AND user_id=$2",[currentKey,a]
    );
    const nextAttacks=await Promise.allSettled([
      store.attackWorldBoss(a),store.attackWorldBoss(a)
    ]);
    assert.equal(nextAttacks.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(nextAttacks.filter(x=>x.status==="rejected").length,1);
    const aStats=await store.getWorldBoss(a);
    assert.equal(aStats.myAttacks,2);
    assert.ok(aStats.myDamage>=80);
    assert.equal(aStats.qualified,true);
    assert.equal(aStats.participants,3);
    // Force defeat inside the TEST database; only then do qualifying claims appear.
    await store.pool.query("UPDATE world_boss_instances SET hp=0,defeated_at=now() WHERE period_key=$1",[currentKey]);
    assert.equal((await store.getWorldBoss(a)).pending.periodKey,currentKey);
    assert.equal((await store.getWorldBoss(b)).pending,null);
    await assert.rejects(()=>store.claimWorldBossReward(b,currentKey),/minimum damage|two strikes/);
    const before=await store.profile(a);
    const concurrent=await Promise.allSettled([
      store.claimWorldBossReward(a,currentKey),store.claimWorldBossReward(a,currentKey)
    ]);
    assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(concurrent.filter(x=>x.status==="rejected").length,1);
    const got=concurrent.find(x=>x.status==="fulfilled").value;
    assert.ok(got.eligible);
    assert.equal(got.ic,Math.floor(bosses.BOSSES[0].pool*aStats.myDamage/bosses.BOSSES[0].hp));
    assert.equal(got.itemId,"ore");
    const after=await store.profile(a);
    assert.equal(after.balance.minus(before.balance).toNumber(),got.ic);
    assert.equal((await store.getWorldBoss(a)).pending,null);
    // A lost/expired boss still pays proportional shares, weeks afterward.
    await store.pool.query(
      "INSERT INTO world_boss_instances(period_key,boss_id,max_hp,hp,starts_at,ends_at,reward_pool,reward_item_id) " +
      "VALUES($1,'hollow_guardian',3000,1500,'2026-10-05T00:00:00Z','2026-10-12T00:00:00Z',9000,'silver')",
      [oldKey]
    );
    await store.pool.query(
      "INSERT INTO world_boss_contributions(period_key,user_id,total_damage,attack_count,owl_bonus_points) " +
      "VALUES($1,$2,1000,4,0)",[oldKey,a]
    );
    const pendingOld=await store.getWorldBoss(a);
    assert.equal(pendingOld.pending.periodKey,oldKey);
    const previous=await store.claimWorldBossReward(a,oldKey);
    assert.equal(previous.ic,3000);
    assert.equal(previous.itemId,"silver");
    assert.equal((await store.getWorldBoss(a)).pending,null);
    await assert.rejects(()=>store.claimWorldBossReward(a,oldKey),/already claimed/);
    const events=await store.pool.query(
      "SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='world_boss_reward'",[a]
    );
    assert.equal(events.rows[0].n,2);
    const milestones=await store.getStats(a);
    assert.ok(milestones.achievements.find(x=>x.name==="Boss Challenger").achieved);
    assert.ok(milestones.achievements.find(x=>x.name==="Worldbreaker").achieved);
  } finally {
    await store.pool.query("DELETE FROM world_boss_instances WHERE period_key=ANY($1::text[])",
      [[currentKey,oldKey]]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=ANY($1::text[])",[[a,b,c]]);
    await store.pool.query("DELETE FROM players WHERE user_id=ANY($1::text[])",[[a,b,c]]);
    await store.pool.end();
  }
});
