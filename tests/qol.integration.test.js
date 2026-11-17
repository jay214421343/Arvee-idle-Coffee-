"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("Buy Max locks the wallet and one transaction settles passive IC once", {
  skip: !process.env.ARVEE_IDLE_TEST_DATABASE_URL
}, async () => {
  if (!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to run outside the test database.");
  process.env.DATABASE_URL = process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store = require("../src/store");
  const { purchaseCost, maxAffordable } = require("../src/economy");
  const suffix = crypto.randomInt(100000,999999).toString();
  const buyer = "999996000000" + suffix;
  const idle = "999995000000" + suffix;
  try {
    await store.profile(buyer);
    await store.pool.query("UPDATE players SET balance=25000,total_earned=25000 WHERE user_id=$1",[buyer]);
    const expected=maxAffordable(100,0,25000);
    const attempts=await Promise.allSettled([
      store.buyGenerator(buyer,"MSPS","max"),store.buyGenerator(buyer,"MSPS","max")
    ]);
    assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
    const bought=attempts.find(x=>x.status==="fulfilled").value;
    assert.equal(bought.quantity,expected);
    assert.equal(bought.cost.toString(),purchaseCost(100,0,expected).toString());
    const saved=await store.profile(buyer);
    assert.equal(saved.generators.find(x=>x.generator_id==="MSPS").quantity,expected);
    assert.ok(saved.balance.gte(0));
    const receipt=await store.pool.query(
      "SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='generator_purchase'",[buyer]);
    assert.equal(receipt.rows[0].n,1);
    await store.profile(idle);
    await store.pool.query("UPDATE players SET balance=10000,total_earned=10000 WHERE user_id=$1",[idle]);
    await store.buyGenerator(idle,"MSPS",1);
    await store.pool.query("UPDATE players SET last_settled_at=clock_timestamp()-interval '12 minutes' WHERE user_id=$1",[idle]);
    const gained=await store.profile(idle);
    assert.ok(gained.passiveEarned.gt(0));
    assert.ok(gained.passiveSeconds>=719);
    const again=await store.profile(idle);
    assert.ok(again.passiveEarned.gte(0));
    assert.ok(again.passiveSeconds<5);
    assert.ok(again.balance.gte(gained.balance));
    assert.ok(again.balance.minus(gained.balance).lte(again.passiveEarned.plus(10)));
  } finally {
    await store.pool.end();
  }
});
