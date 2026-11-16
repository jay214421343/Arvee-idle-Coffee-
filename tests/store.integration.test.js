"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("PostgreSQL economy transactions are atomic", { skip: !process.env.COFFEE_TEST_DATABASE_URL }, async () => {
  if (!/coffee_test/.test(process.env.COFFEE_TEST_DATABASE_URL)) throw new Error("Refusing to run outside a coffee_test database.");
  process.env.DATABASE_URL = process.env.COFFEE_TEST_DATABASE_URL;
  const store = require("../src/store");
  const suffix = crypto.randomInt(100000, 999999).toString();
  const a = "999999000000" + suffix;
  const b = "999998000000" + suffix;
  try {
    const original = await store.profile(a);
    assert.equal(original.balance.toString(), "10");
    await assert.rejects(() => store.buyGenerator(a, "MSPS", 1), /Not enough BP/);
    await store.pool.query("UPDATE players SET balance=1000000,total_earned=1000000 WHERE user_id=$1", [a]);
    const both = await Promise.all([store.buyGenerator(a, "MSPS", 1), store.buyGenerator(a, "MSPS", 1)]);
    assert.equal(both.length, 2);
    const after = await store.profile(a);
    assert.equal(after.generators.find((g) => g.generator_id === "MSPS").quantity, 2);
    assert.ok(after.balance.gte(0));
    const firstMine = await store.mine(a);
    const secondMine = await store.mine(a);
    assert.ok(firstMine.reward.gt(0));
    assert.ok(secondMine.cooldown > 0);
    assert.ok((await store.daily(a)).received.length);
    assert.ok((await store.daily(a)).cooldown > 0);
    await store.giveItem(a, b, "coffee", 1);
    const listing = await store.sellItem(b, "coffee", 1, "250");
    const purchase = await store.buyListing(a, listing.id);
    assert.equal(purchase.price.toString(), "250");
    assert.equal((await store.profile(a)).inventory.find((x) => x.item_id === "coffee").quantity, 1);
    await assert.rejects(() => store.buyListing(a, listing.id), /no longer available/);
  } finally {
    await store.pool.query("DELETE FROM market_listings WHERE seller_id=ANY($1::text[]) OR buyer_id=ANY($1::text[])", [[a,b]]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=ANY($1::text[])", [[a,b]]);
    await store.pool.query("DELETE FROM players WHERE user_id=ANY($1::text[])", [[a,b]]);
    await store.pool.end();
  }
});
