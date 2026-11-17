"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("Coffee mining charges, cooldown resets, cosmetics and prestige rewards are atomic", {
  skip: !process.env.ARVEE_IDLE_TEST_DATABASE_URL
}, async () => {
  if (!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to run against a non-test database");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const seed=crypto.randomInt(100000,999999).toString();
  const miner="999992000000"+seed, reborn="999991000000"+seed;
  try {
    await store.profile(miner);
    await store.profile(reborn);
    for (const id of ["apple","coffee","starfruit","cola","rebirth_cocktail","mine_alert"]) {
      await store.pool.query(
        "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,$2,1)",[miner,id]);
    }
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'pick_skin',3)",[miner]);
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'apple',1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1",[miner]);
    const ration=await store.useItem(miner,"apple");
    assert.match(ration.message,/3 successful digs/);
    let p=await store.profile(miner);
    assert.equal(p.mineBoostCharges,3);
    assert.equal(p.mineBoostMultiplier.toString(),"1.6");
    await assert.rejects(()=>store.useItem(miner,"apple"),/food boost/);
    assert.equal((await store.profile(miner)).inventory.find(x=>x.item_id==="apple").quantity,1);
    const first=await store.mine(miner);
    assert.equal(first.baseReward.toString(),"150");
    assert.equal(first.reward.toString(),"240");
    assert.equal(first.bonusReward.toString(),"90");
    assert.equal(first.boostChargesLeft,2);
    const denied=await Promise.all([store.mine(miner),store.mine(miner)]);
    assert.ok(denied.every(x=>x.cooldown>0));
    assert.equal((await store.profile(miner)).mineBoostCharges,2);
    await store.useItem(miner,"coffee");
    const second=await store.mine(miner);
    assert.equal(second.boostChargesLeft,1);
    await store.useItem(miner,"starfruit");
    const waiting=await store.mine(miner);
    assert.ok(waiting.cooldown>0 && waiting.cooldown<90);
    assert.equal((await store.profile(miner)).mineBoostCharges,1);
    await store.useItem(miner,"cola");
    const third=await store.mine(miner);
    assert.equal(third.multiplier,"3");
    assert.equal(third.reward.toString(),"450");
    assert.equal(third.bonusReward.toString(),"300");
    assert.equal(third.boostChargesLeft,0);
    p=await store.profile(miner);
    assert.equal(p.mineBoostCharges,0);
    assert.equal(p.mineBonus.toString(),"1");
    const clock=await store.useItem(miner,"mine_alert");
    assert.match(clock.message,/Mining recharges/);
    assert.ok((await store.profile(miner)).inventory.some(x=>x.item_id==="mine_alert"&&x.quantity===1));
    await store.useItem(miner,"rebirth_cocktail");
    p=await store.profile(miner);
    assert.equal(p.lastMine,null);
    assert.equal(p.mineBoostCharges,3);
    assert.equal(p.mineBoostMultiplier.toString(),"2");
    const boosted=await store.mine(miner);
    assert.equal(boosted.reward.toString(),"300");
    assert.equal(boosted.boostChargesLeft,2);
    for(const [step,finish] of [["first","I Skin"],["second","I Skin II"],["third","Demon Skin"]]){
      await store.useItem(miner,"pick_skin");
      assert.equal((await store.profile(miner)).pickaxeStyle,finish,step+" custom skin not persisted");
    }
    await store.pool.query(
      "UPDATE players SET balance=1000000000,total_earned=1000000000 WHERE user_id=$1",[reborn]);
    const attempts=await Promise.allSettled([store.prestige(reborn),store.prestige(reborn)]);
    assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
    const winner=attempts.find(x=>x.status==="fulfilled").value;
    assert.equal(winner.prestige,1);
    assert.equal(winner.itemId,"rebirth_cocktail");
    const saved=await store.profile(reborn);
    assert.equal(saved.prestige,1);
    assert.equal(saved.balance.toString(),"500");
    assert.equal(saved.inventory.find(x=>x.item_id==="rebirth_cocktail").quantity,1);
    const audit=await store.pool.query(
      "SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='prestige'",[reborn]);
    assert.equal(audit.rows[0].n,1);
  } finally {
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1 OR user_id=$2",[miner,reborn]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1 OR user_id=$2",[miner,reborn]);
    await store.pool.end();
  }
});
