"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("PostgreSQL economy transactions are atomic", { skip: !process.env.ARVEE_IDLE_TEST_DATABASE_URL }, async () => {
  if (!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL)) throw new Error("Refusing to run outside a arvee_idle_test database.");
  process.env.DATABASE_URL = process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store = require("../src/store");
  const season = require("../src/season");
  const suffix = crypto.randomInt(100000, 999999).toString();
  const a = "999999000000" + suffix;
  const b = "999998000000" + suffix;
  const c = "999997000000" + suffix;
  try {
    const original = await store.profile(a);
    assert.equal(original.balance.toString(), "500");
    if (season.phase() === "active") {
      const starting = await store.seasonStatus(a);
      assert.equal(starting.xp, 0);
      assert.deepEqual(starting.claimed, []);
    }
    assert.equal((await store.buyGenerator(a, "MSPS", 1)).cost.toString(), "100");
    await store.pool.query("UPDATE players SET balance=1000000,total_earned=1000000 WHERE user_id=$1", [a]);
    const both = await Promise.all([store.buyGenerator(a, "MSPS", 1), store.buyGenerator(a, "MSPS", 1)]);
    assert.equal(both.length, 2);
    const after = await store.profile(a);
    assert.equal(after.generators.find((g) => g.generator_id === "MSPS").quantity, 3);
    assert.ok(after.balance.gte(0));
    const firstMine = await store.mine(a);
    const secondMine = await store.mine(a);
    assert.ok(firstMine.reward.gt(0));
    assert.ok(secondMine.cooldown > 0);
    const beforeDaily = (await store.profile(a)).balance;
    assert.ok((await store.daily(a)).received.includes("750 IC"));
    assert.ok((await store.profile(a)).balance.gte(beforeDaily.plus(750)));
    assert.ok((await store.daily(a)).cooldown > 0);
    await store.giveItem(a, b, "coffee", 1);
    const listing = await store.sellItem(b, "coffee", 1, "250");
    const purchase = await store.buyListing(a, listing.id);
    assert.equal(purchase.price.toString(), "250");
    assert.equal((await store.profile(a)).inventory.find((x) => x.item_id === "coffee").quantity, 1);
    await assert.rejects(() => store.buyListing(a, listing.id), /no longer available/);
    // Expanding gameplay: pickaxe upgrades, persistent perks, consumable boosts and alchemy.
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'ore',100),($1,'silver',100),($1,'gold',20),($1,'pickperk',5),($1,'starfruit',2),($1,'orb_of_almanac',1),($1,'rare_lootbox',1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity",
      [a]
    );
    assert.equal((await store.upgradePickaxe(a)).tier, 1);
    const perk = await store.upgradePerk(a, "miner");
    assert.equal(perk.level, 1);
    assert.equal((await store.profile(a)).perks.find((p) => p.perk_id === "miner").level, 1);
    const boost = await store.useItem(a, "starfruit");
    assert.match(boost.message, /Next mining multiplier/);
    await store.pool.query("UPDATE players SET last_mine_at=now()-interval '10 minutes' WHERE user_id=$1", [a]);
    assert.ok((await store.mine(a)).reward.gt(0));
    assert.equal((await store.profile(a)).mineBonus.toString(), "1");
    await store.useItem(a, "orb_of_almanac");
    assert.equal((await store.profile(a)).orbs, 1);
    assert.ok(Object.keys(await store.openLootbox(a, 1, "rare_lootbox")).length > 0);
    assert.equal((await store.craft(a, "coffee", 1)).quantity, 1);
    if (season.phase() === "active") {
      const progress = await store.seasonStatus(a);
      assert.ok(progress.xp >= 250, "normal gameplay should unlock the first tier");
      assert.ok(progress.dailyXp <= season.SEASON.dailyXpCap);
      assert.ok(progress.activities.mine >= 2);
      const beforeReward = (await store.profile(a)).balance;
      const parallel = await Promise.all([
        store.claimSeasonRewards(a, 1), store.claimSeasonRewards(a, 1)
      ]);
      assert.equal(parallel.reduce((sum, r) => sum + r.grants.length, 0), 1);
      assert.ok((await store.profile(a)).balance.gte(beforeReward.plus(200)));
      assert.equal((await store.claimSeasonRewards(a, 1)).grants.length, 0);
      await assert.rejects(() => store.claimSeasonRewards(a, 21), /Invalid season tier/);
      await assert.rejects(() => store.claimSeasonRewards(a, 20), /Earn .*Season XP/);
      await store.pool.query("UPDATE players SET balance=100000000000,total_earned=100000000000 WHERE user_id=$1", [a]);
      for (let i = 0; i < 8; i++) await store.buyGenerator(a, "MSPS", 5);
      const capped = await store.seasonStatus(a);
      assert.equal(capped.dailyXp, season.SEASON.dailyXpCap);
      const both = await Promise.all([
        store.claimSeasonRewards(a, "all"), store.claimSeasonRewards(a, "all")
      ]);
      assert.equal(both.reduce((sum, r) => sum + r.grants.length, 0), 1);
      assert.deepEqual((await store.seasonStatus(a)).claimed, [1, 2]);
    }
    await assert.rejects(() => store.useItem(a, "ore"), /cannot be consumed/);
    // Double-purchase race: at most one buyer gets the same listing.
    await store.profile(c);
    await store.pool.query("UPDATE players SET balance=100000,total_earned=100000 WHERE user_id=$1", [c]);
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'ore',5) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity",
      [b]
    );
    const contested = await store.sellItem(b, "ore", 1, "100");
    const concurrent = await Promise.allSettled([store.buyListing(a, contested.id), store.buyListing(c, contested.id)]);
    assert.equal(concurrent.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((x) => x.status === "rejected").length, 1);
    const cancellable = await store.sellItem(b, "ore", 1, "50");
    await store.cancelListing(b, cancellable.id);
    await assert.rejects(() => store.buyListing(a, cancellable.id), /no longer available/);
    // Prestige resets only IC and generators, keeping perks, ore and pickaxe tiers.
    await store.pool.query("UPDATE players SET balance=2000000000,total_earned=2000000000 WHERE user_id=$1", [a]);
    assert.equal((await store.prestige(a)).prestige, 1);
    const reset = await store.profile(a);
    assert.equal(reset.prestige, 1);
    assert.equal(reset.pickaxeTier, 1);
    assert.equal(reset.generators.length, 0);
    assert.equal(reset.perks.find((p) => p.perk_id === "miner").level, 1);
    const stats = await store.getStats(a);
    assert.ok(stats.achievements.find((x) => x.name === "First Expedition").achieved);
    assert.ok(stats.achievements.find((x) => x.name === "Rising Star").achieved);
    await store.pool.query(
      "INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'strange_matter',5) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity",
      [a]
    );
    assert.equal((await store.upgradePerk(a, "investor")).level, 1);
    assert.equal((await store.respecPerks(a)).removed, 2);
    assert.equal((await store.profile(a)).perks.length, 0);
    await assert.rejects(() => store.respecPerks(a), /No perks/);
  } finally {
    await store.pool.query("DELETE FROM market_listings WHERE seller_id=ANY($1::text[]) OR buyer_id=ANY($1::text[])", [[a,b,c]]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=ANY($1::text[])", [[a,b,c]]);
    await store.pool.query("DELETE FROM players WHERE user_id=ANY($1::text[])", [[a,b,c]]);
    await store.pool.end();
  }
});
