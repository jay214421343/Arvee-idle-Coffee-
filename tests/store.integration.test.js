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
    const defaults = await store.getPreferences(a);
    assert.deepEqual(defaults, {
      shopFilter: "all", shopSort: "price",
      inventoryFilter: "all", inventorySort: "rarity", forgeFilter: "all"
    });
    await store.setPreferences(a, {shopFilter:"owned",shopSort:"income",inventoryFilter:"caches",
      inventorySort:"quantity",forgeFilter:"ready"});
    const persisted = await store.getPreferences(a);
    assert.equal(persisted.shopFilter, "owned");
    assert.equal(persisted.shopSort, "income");
    assert.equal(persisted.inventoryFilter, "caches");
    assert.equal(persisted.forgeFilter, "ready");
    await store.setPreferences(a,{inventorySort:"name"});
    assert.equal((await store.getPreferences(a)).shopSort,"income");
    await assert.rejects(()=>store.setPreferences(a,{shopFilter:"owned;DROP TABLE players"}),/Invalid filter/);
    assert.equal((await store.getPreferences(a)).shopFilter,"owned");
    assert.equal((await store.getPreferences(b)).inventoryFilter,"all");
    assert.equal((await store.resetPreferences(a)).shopFilter,"all");
    assert.deepEqual(await store.getPreferences(a),defaults);

    const initialBoard = await store.getChallenges(a);
    const today = initialBoard.daily;
    assert.equal(today.tasks.length,3);
    assert.equal(initialBoard.weekly.tasks.length,3);
    await store.pool.query(
      "INSERT INTO economy_events(user_id,event_type,amount) " +
      "SELECT $1,'mine',0 FROM generate_series(1,3)",[a]);
    const updated = await store.getChallenges(a);
    const mining = updated.daily.tasks.find(t=>t.id==="mining_route");
    assert.equal(mining.progress,3);
    const beforeClaim = (await store.profile(a)).balance;
    const bothClaims = await Promise.all([
      store.claimChallenge(a,"daily",today.key,"mining_route"),
      store.claimChallenge(a,"daily",today.key,"mining_route")
    ]);
    assert.equal(bothClaims.filter(r=>r.claimed).length,1);
    assert.ok((await store.profile(a)).balance.gte(beforeClaim.plus(400)));
    assert.equal((await store.claimChallenge(a,"daily",today.key,"mining_route")).claimed,false);
    assert.equal((await store.getChallenges(a)).daily.tasks[0].claimed,true);
    await assert.rejects(()=>store.claimChallenge(a,"daily","20000101","mining_route"),/rotated/);
    await assert.rejects(()=>store.claimChallenge(a,"daily",today.key,"invalid_task"),/no longer active/);
    assert.equal(original.balance.toString(), "500");
    if (season.phase() === "active") {
      const starting = await store.seasonStatus(a);
      assert.equal(starting.xp, 0);
      assert.deepEqual(starting.claimed, []);
    }
    // Choosing a starter and equipping pets are persisted and serialized.
    const initialPets = await store.getCompanions(a);
    assert.equal(initialPets.starterClaimed, false);
    assert.equal(initialPets.owned.length, 0);
    const competingAdoptions = await Promise.allSettled([
      store.adoptCompanion(a,"ember_fox"),store.adoptCompanion(a,"ember_fox")
    ]);
    assert.equal(competingAdoptions.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(competingAdoptions.filter(x=>x.status==="rejected").length,1);
    assert.equal((await store.getCompanions(a)).activeId,"ember_fox");
    await assert.rejects(()=>store.adoptCompanion(a,"moon_owl"),/already chose/);
    await assert.rejects(()=>store.equipCompanion(a,"moon_owl"),/haven't discovered/);
    await assert.rejects(()=>store.equipCompanion(a,"invalid"),/Unknown companion/);
    assert.equal((await store.getCompanions(b)).starterClaimed,false);

    assert.equal((await store.getExploration(a)).crew,0);
    await assert.rejects(()=>store.startExpedition(a,"forest"),/Region locked/);
    await assert.rejects(()=>store.startExpedition(a,"unknown"),/Unknown region/);
    assert.equal((await store.buyGenerator(a, "MSPS", 1)).cost.toString(), "100");
    assert.equal((await store.getExploration(a)).crew,1);
    const firstExpedition = await store.startExpedition(a,"forest");
    assert.equal(firstExpedition.region,"Whispering Forest");
    await assert.rejects(()=>store.startExpedition(a,"forest"),/current expedition/);
    await assert.rejects(()=>store.collectExpedition(a),/expedition returns/);
    await store.pool.query(
      "UPDATE expedition_missions SET started_at=now()-interval '10 minutes', " +
      "finishes_at=now()-interval '1 second',companion_egg=TRUE WHERE id=$1",[firstExpedition.id]);
    const beforeExpedition = (await store.profile(a)).balance;
    const concurrentClaims = await Promise.allSettled([
      store.collectExpedition(a),store.collectExpedition(a)
    ]);
    assert.equal(concurrentClaims.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(concurrentClaims.filter(r=>r.status==="rejected").length,1);
    assert.ok((await store.profile(a)).balance.gt(beforeExpedition));
    assert.equal((await store.getCompanions(a)).eggs,1,"pre-rolled companion eggs should be awarded once");
    const hatchAttempts = await Promise.allSettled([
      store.hatchCompanion(a),store.hatchCompanion(a)
    ]);
    assert.equal(hatchAttempts.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(hatchAttempts.filter(x=>x.status==="rejected").length,1);
    const hatched = hatchAttempts.find(x=>x.status==="fulfilled").value;
    const ownedAfterHatching = await store.getCompanions(a);
    assert.equal(ownedAfterHatching.eggs,0);
    assert.ok(ownedAfterHatching.owned.some(p=>p.id===hatched.petId));
    await store.equipCompanion(a,hatched.petId);
    assert.equal((await store.getCompanions(a)).activeId,hatched.petId);
    await store.equipCompanion(a,"ember_fox");
    assert.equal((await store.getCompanions(a)).activeId,"ember_fox");
    assert.ok((await store.getExploration(a)).xp>=17 && (await store.getExploration(a)).xp<=35);
    assert.equal((await store.getExploration(a)).active,null);
    assert.equal((await store.getExploration(a)).regions.find(x=>x.id==="mines").unlocked,false);
    await store.pool.query("UPDATE players SET balance=1000000,total_earned=1000000 WHERE user_id=$1", [a]);
    const both = await Promise.all([store.buyGenerator(a, "MSPS", 1), store.buyGenerator(a, "MSPS", 1)]);
    assert.equal(both.length, 2);
    const after = await store.profile(a);
    assert.equal(after.generators.find((g) => g.generator_id === "MSPS").quantity, 3);
    const secondExpedition = await store.startExpedition(a,"forest");
    await store.pool.query(
      "UPDATE expedition_missions SET started_at=now()-interval '10 minutes', " +
      "finishes_at=now()-interval '1 second' WHERE id=$1",[secondExpedition.id]);
    assert.ok((await store.collectExpedition(a)).experience>0);
    const world = await store.getExploration(a);
    assert.ok(world.xp>=34 && world.xp<=70);
    // The second mission can have a setback, so bring the character to the
    // threshold deterministically to test later region gates.
    await store.pool.query(
      "INSERT INTO exploration_progress(user_id,xp) VALUES($1,70) " +
      "ON CONFLICT(user_id) DO UPDATE SET xp=GREATEST(exploration_progress.xp,70)",[a]);
    assert.equal((await store.getExploration(a)).regions.find(x=>x.id==="mines").unlocked,true);
    assert.ok(after.balance.gte(0));
    const firstMine = await store.mine(a);
    const secondMine = await store.mine(a);
    assert.ok(firstMine.reward.gte(157),"active Ember Fox should boost mine payouts");
    assert.ok((await store.getCompanions(a)).owned.find(p=>p.id==="ember_fox").xp>=65,
      "expeditions and mining should level the active pet");
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
    const upgrade = await store.upgradeExpeditionGear(a,"kit");
    assert.equal(upgrade.level,1);
    assert.equal((await store.getExploration(a)).gear.kit,1);
    await assert.rejects(()=>store.upgradeExpeditionGear(a,"invalid"),/Unknown expedition equipment/);
    const minesMission=await store.startExpedition(a,"mines");
    const timing=(await store.pool.query(
      "SELECT EXTRACT(EPOCH FROM finishes_at-started_at)::integer AS seconds " +
      "FROM expedition_missions WHERE id=$1",[minesMission.id]
    )).rows[0];
    assert.equal(Number(timing.seconds),447);
    await store.pool.query(
      "UPDATE expedition_missions SET started_at=now()-interval '20 minutes', " +
      "finishes_at=now()-interval '1 second' WHERE id=$1",[minesMission.id]);
    const collectedMines=await store.collectExpedition(a);
    assert.equal(collectedMines.regionId,"mines");
    assert.ok((await store.getExploration(a)).xp>=100);
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
      assert.equal(Object.hasOwn(progress,"dailyXp"),false,"no daily XP limit is exposed");
      assert.ok(progress.activities.mine >= 2);
      const beforeReward = (await store.profile(a)).balance;
      const parallel = await Promise.all([
        store.claimSeasonRewards(a, 1), store.claimSeasonRewards(a, 1)
      ]);
      assert.equal(parallel.reduce((sum, r) => sum + r.grants.length, 0), 1);
      assert.ok((await store.profile(a)).balance.gte(beforeReward.plus(200)));
      assert.equal((await store.claimSeasonRewards(a, 1)).grants.length, 0);
      await assert.rejects(() => store.claimSeasonRewards(a, 101), /Invalid season tier/);
      await assert.rejects(() => store.claimSeasonRewards(a, 21), /Earn .*Season XP/);
      await store.pool.query("UPDATE players SET balance=100000000000,total_earned=100000000000 WHERE user_id=$1", [a]);
      for (let i = 0; i < 8; i++) await store.buyGenerator(a, "MSPS", 5);
      const advanced = await store.seasonStatus(a);
      assert.ok(advanced.xp > progress.xp,"progress continues past the old daily limit");
      assert.equal(Object.hasOwn(advanced,"dailyXp"),false);
      const both = await Promise.all([
        store.claimSeasonRewards(a, "all"), store.claimSeasonRewards(a, "all")
      ]);
      const unlocked = season.unlocked(advanced.xp);
      assert.equal(both.reduce((sum, r) => sum + r.grants.length, 0), unlocked-1);
      assert.deepEqual((await store.seasonStatus(a)).claimed,
        Array.from({length:unlocked},(_,i)=>i+1));
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
    const afterPrestige = await store.getExploration(a);
    assert.equal(afterPrestige.gear.kit,1);
    assert.ok(afterPrestige.xp>=100);
    assert.equal(afterPrestige.regions.find(x=>x.id==="forest").unlocked,false);
    assert.equal(afterPrestige.active,null);
    const petsAfterPrestige = await store.getCompanions(a);
    assert.equal(petsAfterPrestige.activeId,"ember_fox");
    assert.equal(petsAfterPrestige.starterClaimed,true);
    assert.ok(petsAfterPrestige.owned.find(p=>p.id==="ember_fox").xp>=100,
      "companion levels must survive prestige");
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
