"use strict";
const { Pool } = require("pg");
const { items, recipes, byId, perks } = require("./catalog");
const { Decimal, dec, generatorRate, purchaseCost, settle, PRESTIGE_REQUIREMENT, prestigeMultiplier, pretty } = require("./economy");
const season = require("./season");
const challenges = require("./challenges");
const exploration = require("./exploration");
const companions = require("./companions");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
pool.on("error", (error) => console.error("[Postgres] Idle connection error", error));
function assertQuantity(qty, maximum = 1000) {
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > maximum) throw new Error("Amount must be between 1 and " + maximum + ".");
}
function assertItem(id) {
  if (!Object.hasOwn(items, id)) throw new Error("Unknown item.");
}
function assertId(id) {
  if (!/^[0-9]{15,22}$/.test(String(id))) throw new Error("Invalid Discord user ID.");
}
async function transact(ids, action) {
  const userIds = [...new Set(ids.map(String))].sort();
  userIds.forEach(assertId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const states = new Map();
    const time = (await client.query("SELECT clock_timestamp() AS current_time")).rows[0].current_time;
    for (const id of userIds) {
      await client.query("INSERT INTO players(user_id) VALUES($1) ON CONFLICT DO NOTHING", [id]);
      const player = (await client.query("SELECT * FROM players WHERE user_id = $1 FOR UPDATE", [id])).rows[0];
      const generators = (await client.query("SELECT generator_id, quantity FROM player_generators WHERE user_id = $1", [id])).rows;
      const playerPerks = (await client.query("SELECT perk_id, level FROM player_perks WHERE user_id=$1", [id])).rows;
      const investor = playerPerks.find((p) => p.perk_id === "investor")?.level || 0;
      const rate = generatorRate(generators, player.prestige, player.orb_count, investor);
      const passive = settle(player.balance, player.total_earned, rate, player.last_settled_at, time);
      states.set(id, {
        id, balance: passive.balance, totalEarned: passive.totalEarned,
        prestige: player.prestige, rate, generators,
        mineXp: player.mine_xp, lastMine: player.last_mine_at,
        lastDaily: player.last_daily_at, lastSettledAt: passive.settledAt,
        pickaxeTier: player.pickaxe_tier, mineBonus: dec(player.next_mine_multiplier), orbs: player.orb_count, perks: playerPerks
      });
    }
    const result = await action(client, states);
    for (const state of states.values()) {
      await client.query(
        "UPDATE players SET balance=$2, total_earned=$3, prestige=$4, mine_xp=$5, last_mine_at=$6, last_daily_at=$7, last_settled_at=$8, pickaxe_tier=$9, next_mine_multiplier=$10, orb_count=$11, updated_at=now() WHERE user_id=$1",
        [state.id, state.balance.toFixed(0), state.totalEarned.toFixed(0), state.prestige,
          state.mineXp, state.lastMine, state.lastDaily, state.lastSettledAt,
          state.pickaxeTier, state.mineBonus.toString(), state.orbs]
      );
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) { console.error("[Postgres] Rollback failed", rollbackError); }
    throw error;
  } finally {
    client.release();
  }
}
async function activeCompanion(db, userId) {
  const row = (await db.query(
    "SELECT p.pet_id,p.xp FROM companion_settings s JOIN player_companions p " +
    "ON p.user_id=s.user_id AND p.pet_id=s.active_pet_id WHERE s.user_id=$1",
    [userId]
  )).rows[0];
  return row ? { id: row.pet_id, xp: Number(row.xp), level: companions.level(Number(row.xp)) } : null;
}
async function grantCompanionXp(db, userId, type, metadata = {}) {
  const amount = companions.eventXp(type, metadata);
  if (!amount) return;
  await db.query(
    "UPDATE player_companions p SET xp=LEAST(p.xp+$2, $3) FROM companion_settings s " +
    "WHERE p.user_id=$1 AND s.user_id=p.user_id AND s.active_pet_id=p.pet_id",
    [userId, amount, companions.MAX_XP]
  );
}
async function getCompanions(userId) {
  return transact([userId], async (db) => {
    const settings = await db.query("SELECT starter_claimed,active_pet_id FROM companion_settings WHERE user_id=$1", [userId]);
    const owned = await db.query("SELECT pet_id,xp,discovered_at FROM player_companions WHERE user_id=$1 ORDER BY discovered_at,pet_id", [userId]);
    const eggs = await db.query("SELECT quantity FROM inventory WHERE user_id=$1 AND item_id='companion_egg'", [userId]);
    const status = settings.rows[0];
    return {
      starterClaimed: status?.starter_claimed || false,
      activeId: status?.active_pet_id || null,
      eggs: Number(eggs.rows[0]?.quantity || 0),
      owned: owned.rows.map((row) => {
        const xp = Number(row.xp);
        const level = companions.level(xp);
        return { id: row.pet_id, xp, level, stage: companions.stage(level),
          bonus: companions.bonus({ id: row.pet_id, level }),
          nextXp: level === companions.MAX_LEVEL ? companions.MAX_XP : companions.xpFor(level + 1),
          startXp: companions.xpFor(level), discoveredAt: row.discovered_at.toISOString() };
      })
    };
  });
}
async function adoptCompanion(userId, petId) {
  const pet = companions.byId.get(String(petId));
  if (!pet) throw new Error("Unknown companion.");
  return transact([userId], async (db) => {
    await db.query("INSERT INTO companion_settings(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING", [userId]);
    const settings = (await db.query(
      "SELECT starter_claimed FROM companion_settings WHERE user_id=$1 FOR UPDATE", [userId]
    )).rows[0];
    if (settings.starter_claimed) throw new Error("You already chose your starter companion.");
    await db.query("INSERT INTO player_companions(user_id,pet_id) VALUES($1,$2) ON CONFLICT(user_id,pet_id) DO NOTHING",
      [userId,pet.id]);
    await db.query(
      "UPDATE companion_settings SET starter_claimed=TRUE,active_pet_id=$2 WHERE user_id=$1",
      [userId,pet.id]
    );
    await event(db,userId,"companion_adopt",0,{petId:pet.id});
    return { petId:pet.id,name:pet.name };
  });
}
async function equipCompanion(userId, petId) {
  const pet = companions.byId.get(String(petId));
  if (!pet) throw new Error("Unknown companion.");
  return transact([userId], async (db) => {
    const owned = (await db.query(
      "SELECT 1 FROM player_companions WHERE user_id=$1 AND pet_id=$2",[userId,pet.id]
    )).rowCount > 0;
    if (!owned) throw new Error("You haven't discovered that companion.");
    await db.query(
      "INSERT INTO companion_settings(user_id,active_pet_id) VALUES($1,$2) " +
      "ON CONFLICT(user_id) DO UPDATE SET active_pet_id=$2",[userId,pet.id]
    );
    return { petId:pet.id,name:pet.name };
  });
}
async function hatchCompanion(userId) {
  return transact([userId], async (db) => {
    await removeItem(db,userId,"companion_egg",1);
    const rows = (await db.query("SELECT pet_id FROM player_companions WHERE user_id=$1",[userId])).rows;
    const pet = companions.hatch(rows.map((row)=>row.pet_id));
    const discovered = !rows.some((row) => row.pet_id === pet.id);
    await db.query(
      "INSERT INTO player_companions(user_id,pet_id,xp) VALUES($1,$2,0) " +
      "ON CONFLICT(user_id,pet_id) DO UPDATE SET xp=LEAST(player_companions.xp+150,$3)",
      [userId,pet.id,companions.MAX_XP]
    );
    await db.query(
      "INSERT INTO companion_settings(user_id,active_pet_id) VALUES($1,$2) " +
      "ON CONFLICT(user_id) DO UPDATE SET active_pet_id=COALESCE(companion_settings.active_pet_id,$2)",
      [userId,pet.id]
    );
    await event(db,userId,"companion_hatch",0,{petId:pet.id,discovered});
    return { petId:pet.id,name:pet.name,discovered,bonusXp:discovered?0:150 };
  });
}

async function grantSeasonXp(db, userId, type, metadata = {}) {
  if (season.phase() !== "active") return 0;
  const amount = season.eventXp(type, metadata);
  if (!amount) return 0;
  const key = [userId, season.SEASON.id];
  const previous = (await db.query(
    "SELECT xp FROM season_xp_daily WHERE user_id=$1 AND season_id=$2 AND day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE",
    key
  )).rows[0]?.xp || 0;
  const earned = Math.max(0, Math.min(amount, season.SEASON.dailyXpCap - previous));
  if (!earned) return 0;
  await db.query(
    "INSERT INTO season_xp_daily(user_id,season_id,day,xp) VALUES($1,$2,(now() AT TIME ZONE 'UTC')::date,$3) " +
      "ON CONFLICT(user_id,season_id,day) DO UPDATE SET xp=season_xp_daily.xp+EXCLUDED.xp",
    [...key, earned]
  );
  await db.query(
    "INSERT INTO season_progress(user_id,season_id,xp) VALUES($1,$2,$3) " +
      "ON CONFLICT(user_id,season_id) DO UPDATE SET xp=season_progress.xp+EXCLUDED.xp",
    [...key, earned]
  );
  return earned;
}
async function event(db, userId, type, amount, metadata = {}) {
  await db.query("INSERT INTO economy_events(user_id, event_type, amount, metadata) VALUES($1,$2,$3,$4)",
    [userId, type, dec(amount).toFixed(0), JSON.stringify(metadata)]);
  await grantSeasonXp(db, userId, type, metadata);
  await grantCompanionXp(db, userId, type, metadata);
}
async function addItem(db, userId, itemId, quantity) {
  assertItem(itemId);
  assertQuantity(quantity, 1000000);
  const current = await db.query(
    "INSERT INTO inventory (user_id, item_id, quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity RETURNING quantity",
    [userId, itemId, quantity]
  );
  if (current.rows[0].quantity > 1000000000) throw new Error("Inventory limit reached.");
}
async function removeItem(db, userId, itemId, quantity) {
  assertItem(itemId);
  assertQuantity(quantity, 1000000);
  const result = await db.query("UPDATE inventory SET quantity=quantity-$3 WHERE user_id=$1 AND item_id=$2 AND quantity >= $3 RETURNING quantity", [userId, itemId, quantity]);
  if (!result.rowCount) throw new Error("Not enough " + items[itemId].name + ".");
}
function stateOf(states, id) { return states.get(String(id)); }
function perkLevel(state, id) { return state.perks.find((row) => row.perk_id === id)?.level || 0; }
async function profile(userId) {
  return transact([userId], async (db, states) => {
    const player = stateOf(states, userId);
    const inventory = (await db.query("SELECT item_id, quantity FROM inventory WHERE user_id=$1 AND quantity>0 ORDER BY item_id", [userId])).rows;
    const generators = (await db.query("SELECT generator_id, quantity FROM player_generators WHERE user_id=$1 AND quantity>0 ORDER BY generator_id", [userId])).rows;
    return { ...player, inventory, generators };
  });
}
async function buyGenerator(userId, generatorId, quantity) {
  assertQuantity(quantity);
  const entry = byId.get(String(generatorId).toUpperCase());
  if (!entry) throw new Error("Operation not found. Try /idle shop.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const current = (await db.query("SELECT quantity FROM player_generators WHERE user_id=$1 AND generator_id=$2", [userId, entry.id])).rows[0];
    const owned = current ? current.quantity : 0;
    if (owned + quantity > 10000) throw new Error("Generator ownership limit reached (10,000 per type).");
    const cost = purchaseCost(entry.cost, owned, quantity);
    if (state.balance.lt(cost)) throw new Error("Not enough IC. Need " + pretty(cost) + " IC.");
    state.balance = state.balance.minus(cost);
    await db.query(
      "INSERT INTO player_generators(user_id,generator_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,generator_id) DO UPDATE SET quantity=player_generators.quantity + EXCLUDED.quantity",
      [userId, entry.id, quantity]
    );
    const existing = state.generators.find((g) => g.generator_id === entry.id);
    if (existing) existing.quantity += quantity;
    else state.generators.push({ generator_id: entry.id, quantity });
    state.rate = generatorRate(state.generators, state.prestige, state.orbs, perkLevel(state, "investor"));
    await event(db, userId, "generator_purchase", cost.neg(), { generator: entry.id, quantity });
    return { generator: entry, quantity, cost, owned: owned + quantity, balance: state.balance, rate: state.rate };
  });
}
async function mine(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const now = Date.now();
    const cooldown = Math.max(30000, (90 - 6 * perkLevel(state, "sprinter")) * 1000);
    const remaining = state.lastMine ? cooldown - (now - new Date(state.lastMine).getTime()) : 0;
    if (remaining > 0) return { cooldown: Math.ceil(remaining / 1000) };
    const pet = await activeCompanion(db,userId);
    const petBonus = pet?.id === "ember_fox" ? dec(1).plus(dec(companions.boostPct(pet.level)).div(100)) : dec(1);
    const reward = Decimal.max(150, state.rate.times(30))
      .times(dec(1).plus(dec(state.pickaxeTier).times("0.25")))
      .times(dec(1).plus(dec(perkLevel(state, "miner")).times("0.10")))
      .times(state.mineBonus).times(petBonus).floor();
    state.mineBonus = dec(1);
    state.balance = state.balance.plus(reward);
    state.totalEarned = state.totalEarned.plus(reward);
    state.lastMine = new Date(now);
    state.mineXp += 1;
    const fortune = perkLevel(state, "fortune");
    const roll = Math.random();
    const drop = roll < 0.01 + fortune * 0.005 ? "gem" :
      roll < 0.05 + fortune * 0.012 ? "gold" :
      roll < 0.08 + fortune * 0.017 ? "strange_matter" :
      roll < 0.35 + fortune * 0.025 ? "silver" : "ore";
    const dropQuantity = drop === "ore" ? 3 : drop === "silver" ? 2 : 1;
    await addItem(db, userId, drop, dropQuantity);
    const box = Math.random() < 0.04 + 0.03 * perkLevel(state, "scavenger");
    if (box) await addItem(db, userId, "lootbox", 1);
    await event(db, userId, "mine", reward, { drop });
    return { reward, drop, dropQuantity, mineXp: state.mineXp, box };
  });
}
async function daily(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const now = Date.now();
    const cooldown = 22 * 60 * 60 * 1000;
    const remaining = state.lastDaily ? cooldown - (now - new Date(state.lastDaily).getTime()) : 0;
    if (remaining > 0) return { cooldown: Math.ceil(remaining / 1000) };
    state.lastDaily = new Date(now);
    const credits = dec(750);
    state.balance = state.balance.plus(credits);
    state.totalEarned = state.totalEarned.plus(credits);
    await addItem(db, userId, "lootbox", 3);
    await addItem(db, userId, "coffee", 1);
    await addItem(db, userId, "ore", 4);
    await addItem(db, userId, "silver", 2);
    await event(db, userId, "daily", credits);
    return { received: ["750 IC", "3 Supply Caches", "1 Campfire Brew", "4 Rune Ore", "2 Moonsteel"] };
  });
}
async function craft(userId, itemId, quantity) {
  assertQuantity(quantity, 100);
  if (!Object.hasOwn(recipes, itemId)) throw new Error("That item cannot be crafted.");
  return transact([userId], async (db) => {
    for (const [ingredient, each] of Object.entries(recipes[itemId])) await removeItem(db, userId, ingredient, each * quantity);
    await addItem(db, userId, itemId, quantity);
    await event(db, userId, "craft", 0, { itemId, quantity });
    return { itemId, quantity };
  });
}
async function openLootbox(userId, quantity, boxType = "lootbox") {
  assertQuantity(quantity, 20);
  if (!["lootbox", "rare_lootbox", "legendary_lootbox"].includes(boxType)) throw new Error("Unknown supply cache type.");
  return transact([userId], async (db) => {
    await removeItem(db, userId, boxType, quantity);
    const drops = {};
    for (let i = 0; i < quantity; i++) {
      const roll = Math.random();
      const item = boxType === "legendary_lootbox" ?
        (roll < 0.10 ? "orb_of_almanac" : roll < 0.23 ? "gem" : roll < 0.43 ? "pickperk" : roll < 0.65 ? "tinkers_gizmo" : "strange_matter") :
        boxType === "rare_lootbox" ?
        (roll < 0.04 ? "gem" : roll < 0.18 ? "pickperk" : roll < 0.40 ? "gold" : roll < 0.60 ? "starfruit" : "strange_matter") :
        (roll < 0.01 ? "pickperk" : roll < 0.04 ? "gold" : roll < 0.16 ? "silver" : roll < 0.25 ? "apple" : roll < 0.36 ? "bread" : roll < 0.45 ? "cola" : roll < 0.55 ? "cookie" : "ore");
      drops[item] = (drops[item] || 0) + 1;
    }
    for (const [item, amount] of Object.entries(drops)) await addItem(db, userId, item, amount);
    await event(db, userId, "open_lootbox", 0, { quantity, drops, boxType });
    return drops;
  });
}
async function giveItem(from, to, item, quantity) {
  if (from === to) throw new Error("You cannot give items to yourself.");
  assertQuantity(quantity, 1000000);
  return transact([from, to], async (db) => {
    await removeItem(db, from, item, quantity);
    await addItem(db, to, item, quantity);
    await event(db, from, "give_item", 0, { to, item, quantity });
    await event(db, to, "receive_item", 0, { from, item, quantity });
    return { item, quantity };
  });
}
async function prestige(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    if (state.balance.lt(PRESTIGE_REQUIREMENT)) throw new Error("You need 1B IC to prestige.");
    state.prestige += 1;
    state.balance = dec(500);
    state.totalEarned = dec(500);
    state.rate = dec(0);
    state.generators = [];
    await db.query("DELETE FROM player_generators WHERE user_id=$1", [userId]);
    await event(db, userId, "prestige", 0, { newLevel: state.prestige });
    return { prestige: state.prestige, multiplier: prestigeMultiplier(state.prestige) };
  });
}
async function leaderboard(limit = 10) {
  return (await pool.query("SELECT user_id, total_earned, prestige FROM players ORDER BY total_earned DESC, user_id ASC LIMIT $1", [limit])).rows;
}
async function browseMarket() {
  return (await pool.query("SELECT id,seller_id,item_id,quantity,price FROM market_listings WHERE status='active' ORDER BY created_at DESC LIMIT 12")).rows;
}
async function sellItem(userId, item, quantity, price) {
  assertQuantity(quantity, 1000000); assertItem(item);
  const totalPrice = dec(price);
  if (!totalPrice.isInteger() || totalPrice.lt(1) || totalPrice.gt("1e1000")) throw new Error("Price must be a positive whole IC amount.");
  return transact([userId], async (db) => {
    await removeItem(db, userId, item, quantity);
    const r = await db.query("INSERT INTO market_listings(seller_id,item_id,quantity,price) VALUES($1,$2,$3,$4) RETURNING id", [userId, item, quantity, totalPrice.toFixed(0)]);
    await event(db, userId, "market_sell", 0, { listing: r.rows[0].id, item, quantity });
    return { id: r.rows[0].id, item, quantity, price: totalPrice };
  });
}
function listingId(value) {
  const id = String(value);
  if (!/^[1-9][0-9]{0,17}$/.test(id)) throw new Error("Invalid listing ID.");
  return id;
}
async function buyListing(buyerId, rawId) {
  const id = listingId(rawId);
  const listing = (await pool.query("SELECT seller_id FROM market_listings WHERE id=$1 AND status='active'", [id])).rows[0];
  if (!listing) throw new Error("Listing is no longer available.");
  if (listing.seller_id === buyerId) throw new Error("You cannot buy your own listing.");
  return transact([buyerId, listing.seller_id], async (db, states) => {
    const row = (await db.query("SELECT * FROM market_listings WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!row || row.status !== "active" || row.seller_id !== listing.seller_id) throw new Error("Listing is no longer available.");
    const buyer = stateOf(states, buyerId);
    const seller = stateOf(states, listing.seller_id);
    const price = dec(row.price);
    if (buyer.balance.lt(price)) throw new Error("Insufficient IC.");
    buyer.balance = buyer.balance.minus(price);
    seller.balance = seller.balance.plus(price);
    await addItem(db, buyerId, row.item_id, row.quantity);
    await db.query("UPDATE market_listings SET status='sold',buyer_id=$2,resolved_at=now() WHERE id=$1", [id, buyerId]);
    await event(db, buyerId, "market_buy", price.neg(), { listing: id });
    await event(db, seller.id, "market_payment", price, { listing: id });
    return { item: row.item_id, quantity: row.quantity, price };
  });
}
async function cancelListing(userId, rawId) {
  const id = listingId(rawId);
  return transact([userId], async (db) => {
    const listing = (await db.query("SELECT * FROM market_listings WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!listing || listing.status !== "active" || listing.seller_id !== userId) throw new Error("Active listing not found or not owned by you.");
    await addItem(db, userId, listing.item_id, listing.quantity);
    await db.query("UPDATE market_listings SET status='cancelled',resolved_at=now() WHERE id=$1", [id]);
    await event(db, userId, "market_cancel", 0, { listing: id });
    return { item: listing.item_id, quantity: listing.quantity };
  });
}
async function getListing(id) {
  const result = await pool.query("SELECT id,seller_id,item_id,quantity,price,status FROM market_listings WHERE id=$1", [listingId(id)]);
  const row = result.rows[0];
  if (!row || row.status !== "active") throw new Error("That listing is no longer active.");
  return row;
}
async function useItem(userId, itemId) {
  const item = items[itemId];
  if (!item || !item.effect) throw new Error("This item cannot be consumed.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const e = item.effect;
    if (e.orb && state.orbs >= 20) throw new Error("Orb limit reached (20).");
    if (e.nextMine && state.mineBonus.times(e.nextMine).gt(20)) throw new Error("You already have the maximum next-mine boost.");
    if (e.xp && state.mineXp + e.xp > 100000000) throw new Error("Mining XP cap reached.");
    await removeItem(db, userId, itemId, 1);
    let message = "";
    if (e.bp) {
      state.balance = state.balance.plus(e.bp);
      state.totalEarned = state.totalEarned.plus(e.bp);
      message = "Gained " + e.bp + " IC.";
    }
    if (e.nextMine) {
      state.mineBonus = state.mineBonus.times(e.nextMine);
      message = "Next mining multiplier: " + state.mineBonus.toString() + "×.";
    }
    if (e.xp) {
      state.mineXp += e.xp;
      message = "Gained " + e.xp + " mining XP.";
    }
    if (e.orb) {
      state.orbs += e.orb;
      state.rate = generatorRate(state.generators, state.prestige, state.orbs, perkLevel(state, "investor"));
      message = "Permanent +10% generator income. Total orbs: " + state.orbs + ".";
    }
    if (e.grant) {
      await addItem(db, userId, e.grant, e.grantAmount || 1);
      message = "Received " + (e.grantAmount || 1) + "× " + items[e.grant].name + ".";
    }
    await event(db, userId, "use_item", 0, { itemId });
    return { itemId, message };
  });
}
async function upgradePickaxe(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    if (state.pickaxeTier >= 10) throw new Error("Your pickaxe is already maximum tier.");
    const costOre = 8 * (state.pickaxeTier + 1);
    const costSilver = 2 * (state.pickaxeTier + 1);
    const costGold = state.pickaxeTier >= 3 ? Math.ceil(state.pickaxeTier / 2) : 0;
    await removeItem(db, userId, "ore", costOre);
    await removeItem(db, userId, "silver", costSilver);
    if (costGold) await removeItem(db, userId, "gold", costGold);
    state.pickaxeTier++;
    await event(db, userId, "pickaxe_upgrade", 0, { tier: state.pickaxeTier });
    return { tier: state.pickaxeTier };
  });
}
async function upgradePerk(userId, perkId) {
  if (!Object.hasOwn(perks, perkId)) throw new Error("Unknown perk.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const current = perkLevel(state, perkId);
    if (current >= perks[perkId].max) throw new Error("Perk has reached max level.");
    if (state.perks.length >= 3 && current === 0) throw new Error("Maximum 3 equipped perks.");
    await removeItem(db, userId, "pickperk", 1);
    const result = await db.query(
      "INSERT INTO player_perks(user_id,perk_id,level) VALUES($1,$2,1) ON CONFLICT(user_id,perk_id) DO UPDATE SET level=player_perks.level+1 RETURNING level",
      [userId, perkId]
    );
    const level = result.rows[0].level;
    const prior = state.perks.find((p) => p.perk_id === perkId);
    if (prior) prior.level = level;
    else state.perks.push({ perk_id: perkId, level });
    if (perkId === "investor") state.rate = generatorRate(state.generators, state.prestige, state.orbs, level);
    await event(db, userId, "perk_upgrade", 0, { perkId, level });
    return { perkId, level };
  });
}
async function respecPerks(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    if (!state.perks.length) throw new Error("No perks to reset.");
    await removeItem(db, userId, "strange_matter", 5);
    await db.query("DELETE FROM player_perks WHERE user_id=$1", [userId]);
    const removed = state.perks.length;
    state.perks = [];
    state.rate = generatorRate(state.generators, state.prestige, state.orbs);
    await event(db, userId, "perk_respec", 0, { removed });
    return { removed };
  });
}
async function getStats(userId) {
  const player = await profile(userId);
  const rows = (await pool.query(
    "SELECT event_type, count(*)::integer AS count FROM economy_events WHERE user_id=$1 GROUP BY event_type",
    [userId]
  )).rows;
  const counts = Object.fromEntries(rows.map((row) => [row.event_type, row.count]));
  const achievements = [
    { name: "First Expedition", achieved: (counts.daily || 0) >= 1, goal: "Claim your first daily supplies" },
    { name: "Prospector", achieved: (counts.mine || 0) >= 10, goal: "Mine 10 times" },
    { name: "Crafting Artisan", achieved: (counts.craft || 0) >= 10, goal: "Craft 10 times" },
    { name: "Merchant", achieved: (counts.market_sell || 0) >= 1, goal: "List an item for sale" },
    { name: "Shopping Spree", achieved: (counts.generator_purchase || 0) >= 20, goal: "Buy generators 20 times" },
    { name: "Rising Star", achieved: player.prestige >= 1, goal: "Prestige once" }
  ];
  return { ...player, counts, achievements };
}

const DEFAULT_PREFERENCES = Object.freeze({
  shopFilter: "all", shopSort: "price",
  inventoryFilter: "all", inventorySort: "rarity", forgeFilter: "all"
});
const PREFERENCE_COLUMNS = Object.freeze({
  shopFilter: { column: "shop_filter", allowed: ["all", "affordable", "owned"] },
  shopSort: { column: "shop_sort", allowed: ["price", "income"] },
  inventoryFilter: { column: "inventory_filter", allowed: ["all", "materials", "usable", "caches"] },
  inventorySort: { column: "inventory_sort", allowed: ["rarity", "name", "quantity"] },
  forgeFilter: { column: "forge_filter", allowed: ["all", "ready"] }
});
function mapPreferences(row) {
  return {
    shopFilter: row?.shop_filter || "all",
    shopSort: row?.shop_sort || "price",
    inventoryFilter: row?.inventory_filter || "all",
    inventorySort: row?.inventory_sort || "rarity",
    forgeFilter: row?.forge_filter || "all"
  };
}
async function getPreferences(userId) {
  return transact([userId], async (db) => {
    const row = (await db.query("SELECT * FROM player_ui_preferences WHERE user_id=$1", [userId])).rows[0];
    return mapPreferences(row);
  });
}
async function setPreferences(userId, changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length) {
    throw new Error("No filter preferences selected.");
  }
  for (const [field, value] of Object.entries(changes)) {
    const rule = PREFERENCE_COLUMNS[field];
    if (!rule || !rule.allowed.includes(value)) throw new Error("Invalid filter preference.");
  }
  return transact([userId], async (db) => {
    // Player rows are locked by transact, serializing changes across all PM2 instances.
    await db.query("INSERT INTO player_ui_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING", [userId]);
    for (const [field, value] of Object.entries(changes)) {
      const column = PREFERENCE_COLUMNS[field].column;
      await db.query("UPDATE player_ui_preferences SET " + column + "=$2,updated_at=now() WHERE user_id=$1", [userId, value]);
    }
    const row = (await db.query("SELECT * FROM player_ui_preferences WHERE user_id=$1", [userId])).rows[0];
    return mapPreferences(row);
  });
}
async function resetPreferences(userId) {
  return transact([userId], async (db) => {
    await db.query("DELETE FROM player_ui_preferences WHERE user_id=$1", [userId]);
    return { ...DEFAULT_PREFERENCES };
  });
}

async function challengeActivities(db, userId, cycle) {
  return (await db.query(
    "SELECT event_type, COUNT(*)::integer AS occurrences, " +
    "COALESCE(SUM(CASE WHEN jsonb_typeof(metadata->'quantity') = 'number' " +
    "THEN LEAST(GREATEST((metadata->>'quantity')::numeric, 1), 1000) ELSE 1 END),0)::integer AS quantity " +
    "FROM economy_events WHERE user_id=$1 AND created_at >= $2 AND created_at < $3 " +
    "AND event_type=ANY($4::text[]) GROUP BY event_type",
    [userId, cycle.start, cycle.end, [...new Set(cycle.tasks.map((t) => t.event))]]
  )).rows;
}
async function getChallenges(userId) {
  return transact([userId], async (db) => {
    const now = (await db.query("SELECT clock_timestamp() AS time")).rows[0].time;
    const result = {};
    for (const scope of ["daily", "weekly"]) {
      const c = challenges.cycle(scope, now);
      const activities = await challengeActivities(db, userId, c);
      const claims = await db.query("SELECT challenge_id FROM challenge_claims WHERE user_id=$1 AND scope=$2 AND period_key=$3",
        [userId, scope, c.key]);
      result[scope] = challenges.board(c, activities, claims.rows.map((r) => r.challenge_id));
    }
    return result;
  });
}
async function claimChallenge(userId, scope, periodKey, challengeId) {
  if (scope !== "daily" && scope !== "weekly" ||
    !/^[0-9]{8}$/.test(String(periodKey)) || !/^[a-z_]{3,40}$/.test(String(challengeId))) {
    throw new Error("Invalid challenge selection.");
  }
  return transact([userId], async (db, states) => {
    const now = (await db.query("SELECT clock_timestamp() AS time")).rows[0].time;
    const c = challenges.cycle(scope, now);
    if (c.key !== periodKey) throw new Error("That challenge has rotated. Open Challenges again.");
    const task = c.tasks.find((t) => t.id === challengeId);
    if (!task) throw new Error("That challenge is no longer active.");
    const activities = await challengeActivities(db, userId, c);
    const row = activities.find((r) => r.event_type === task.event);
    if (challenges.progressOf(task, row) < task.goal) throw new Error("Challenge is not complete yet.");
    const claim = (await db.query(
      "INSERT INTO challenge_claims(user_id,scope,period_key,challenge_id) VALUES($1,$2,$3,$4) " +
      "ON CONFLICT(user_id,scope,period_key,challenge_id) DO NOTHING RETURNING challenge_id",
      [userId, scope, c.key, task.id]
    )).rows;
    if (!claim.length) return { claimed: false, task: task.label, reward: null };
    const state = stateOf(states, userId);
    if (task.reward.kind === "ic") {
      state.balance = state.balance.plus(task.reward.amount);
      state.totalEarned = state.totalEarned.plus(task.reward.amount);
    } else if (task.reward.kind === "item") {
      await addItem(db, userId, task.reward.item, task.reward.quantity);
    }
    await event(db, userId, "challenge_reward_claim", 0, { scope, periodKey: c.key, challengeId: task.id });
    return { claimed: true, task: task.label, reward: challenges.rewardLabel(task.reward) };
  });
}


async function readExploration(db, userId, state) {
  const progress = await db.query("SELECT xp FROM exploration_progress WHERE user_id=$1", [userId]);
  const equipment = await db.query("SELECT gear_id,level FROM expedition_equipment WHERE user_id=$1 ORDER BY gear_id", [userId]);
  const current = await db.query("SELECT * FROM expedition_missions WHERE user_id=$1 AND claimed_at IS NULL ORDER BY id DESC LIMIT 1", [userId]);
  const clock = await db.query("SELECT clock_timestamp() AS now");
  const inventory = await db.query("SELECT item_id,quantity FROM inventory WHERE user_id=$1 AND quantity>0", [userId]);
  const activePet = await activeCompanion(db,userId);
  const xp = Number(progress.rows[0]?.xp || 0);
  const gear = exploration.levels(equipment.rows);
  const crew = state.generators.reduce((sum, g) => sum + g.quantity, 0);
  const now = new Date(clock.rows[0].now);
  const row = current.rows[0];
  const active = row ? {
    id: String(row.id), regionId: row.region_id, startedAt: row.started_at.toISOString(),
    finishesAt: row.finishes_at.toISOString(), ready: now >= row.finishes_at,
    outcome: row.outcome, credits: dec(row.reward_ic), experience: row.reward_xp,
    itemId: row.reward_item_id, quantity: row.reward_quantity
  } : null;
  return { xp, gear, crew, balance: state.balance, inventory: inventory.rows, companion: activePet, active,
    regions: exploration.REGIONS.map((region) => ({
      id: region.id, unlocked: exploration.unlocked(region, crew, xp)
    })) };
}
async function getExploration(userId) {
  return transact([userId], async (db, states) => readExploration(db, userId, stateOf(states, userId)));
}
async function startExpedition(userId, regionId) {
  const region = exploration.regionById.get(String(regionId));
  if (!region) throw new Error("Unknown region.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const info = await readExploration(db, userId, state);
    if (info.active) throw new Error("Finish or collect your current expedition first.");
    if (!exploration.unlocked(region, info.crew, info.xp))
      throw new Error("Region locked. Recruit " + region.crew + " adventurers and earn " + region.xp + " exploration XP.");
    const seconds = exploration.duration(region, info.gear, info.companion);
    const rewards = exploration.reward(region, info.gear, undefined, info.companion);
    const egg = companions.eggDrop(region.id,rewards.outcome === "success");
    const clock = (await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
    const finishes = new Date(new Date(clock).getTime() + seconds * 1000);
    const result = (await db.query(
      "INSERT INTO expedition_missions(user_id,region_id,started_at,finishes_at,outcome,reward_ic,reward_xp,reward_item_id,reward_quantity,companion_egg) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,finishes_at",
      [userId, region.id, clock, finishes, rewards.outcome, rewards.credits, rewards.experience,
        rewards.itemId, rewards.quantity,egg]
    )).rows[0];
    await event(db, userId, "expedition_start", 0, { region: region.id });
    return { id: String(result.id), region: region.name, finishesAt: result.finishes_at.toISOString() };
  });
}
async function collectExpedition(userId) {
  return transact([userId], async (db, states) => {
    const row = (await db.query(
      "SELECT * FROM expedition_missions WHERE user_id=$1 AND claimed_at IS NULL FOR UPDATE", [userId]
    )).rows[0];
    if (!row) throw new Error("No expedition rewards to collect. Visit the World Map to start one.");
    const time = (await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
    if (new Date(time) < row.finishes_at) throw new Error("Your expedition returns <t:" +
      Math.floor(row.finishes_at.getTime() / 1000) + ":R>.");
    const updated = await db.query(
      "UPDATE expedition_missions SET claimed_at=$3 WHERE id=$1 AND user_id=$2 AND claimed_at IS NULL RETURNING id",
      [row.id, userId, time]
    );
    if (!updated.rowCount) throw new Error("That expedition was already collected.");
    const state = stateOf(states, userId);
    const credits = dec(row.reward_ic);
    state.balance = state.balance.plus(credits);
    state.totalEarned = state.totalEarned.plus(credits);
    await addItem(db, userId, row.reward_item_id, row.reward_quantity);
    if (row.companion_egg) await addItem(db,userId,"companion_egg",1);
    await db.query(
      "INSERT INTO exploration_progress(user_id,xp) VALUES($1,$2) " +
      "ON CONFLICT(user_id) DO UPDATE SET xp=exploration_progress.xp+EXCLUDED.xp",
      [userId, row.reward_xp]
    );
    await event(db, userId, "expedition_complete", credits,
      { region: row.region_id, outcome: row.outcome, xp: row.reward_xp });
    return { regionId: row.region_id, outcome: row.outcome, credits,
      experience: row.reward_xp, itemId: row.reward_item_id, quantity: row.reward_quantity, egg:row.companion_egg };
  });
}
async function upgradeExpeditionGear(userId, gearId) {
  const equipment = exploration.gearById.get(String(gearId));
  if (!equipment) throw new Error("Unknown expedition equipment.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const current = (await db.query(
      "SELECT level FROM expedition_equipment WHERE user_id=$1 AND gear_id=$2", [userId, gearId]
    )).rows[0]?.level || 0;
    const cost = exploration.upgradeCost(gearId, Number(current));
    if (state.balance.lt(cost.credits)) throw new Error("Not enough IC to upgrade " + equipment.name + ".");
    for (const [itemId, quantity] of Object.entries(cost.materials)) {
      await removeItem(db, userId, itemId, quantity);
    }
    state.balance = state.balance.minus(cost.credits);
    await db.query(
      "INSERT INTO expedition_equipment(user_id,gear_id,level) VALUES($1,$2,$3) " +
      "ON CONFLICT(user_id,gear_id) DO UPDATE SET level=EXCLUDED.level",
      [userId, gearId, Number(current) + 1]
    );
    await event(db, userId, "expedition_gear_upgrade", -cost.credits,
      { equipment: gearId, level: Number(current) + 1 });
    return { equipment: equipment.name, level: Number(current) + 1, cost };
  });
}

async function seasonStatus(userId) {
  return transact([userId], async (db) => {
    const progress = (await db.query("SELECT xp FROM season_progress WHERE user_id=$1 AND season_id=$2",
      [userId, season.SEASON.id])).rows[0];
    const claimed = (await db.query("SELECT tier FROM season_claims WHERE user_id=$1 AND season_id=$2 ORDER BY tier",
      [userId, season.SEASON.id])).rows.map((r) => Number(r.tier));
    const daily = (await db.query(
      "SELECT xp FROM season_xp_daily WHERE user_id=$1 AND season_id=$2 AND day=(now() AT TIME ZONE 'UTC')::date",
      [userId, season.SEASON.id])).rows[0]?.xp || 0;
    const counts = (await db.query(
      "SELECT event_type,count(*)::integer AS n FROM economy_events WHERE user_id=$1 " +
      "AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' " +
      "AND event_type=ANY($2::text[]) GROUP BY event_type",
      [userId, season.missions.map((m) => m.event)]
    )).rows;
    const activities = Object.fromEntries(counts.map((r) => [r.event_type, Number(r.n)]));
    return {
      xp: Number(progress?.xp || 0), claimed, dailyXp: Number(daily),
      unlocked: season.unlocked(Number(progress?.xp || 0)),
      activities, phase: season.phase()
    };
  });
}
async function claimSeasonRewards(userId, requested = "all") {
  if (requested !== "all" && (!Number.isInteger(requested) || requested < 1 || requested > season.rewards.length))
    throw new Error("Invalid season tier.");
  if (!["active", "claim_only"].includes(season.phase()))
    throw new Error("Season rewards are not available to claim now.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const earned = (await db.query("SELECT xp FROM season_progress WHERE user_id=$1 AND season_id=$2",
      [userId, season.SEASON.id])).rows[0]?.xp || 0;
    const unlocked = season.unlocked(Number(earned));
    if (requested !== "all" && requested > unlocked)
      throw new Error("Earn " + season.tierNeeded(requested) + " Season XP to unlock this tier.");
    const tiers = requested === "all" ?
      Array.from({ length: unlocked }, (_, n) => n + 1) : [requested];
    const grants = [];
    for (const tier of tiers) {
      const inserted = (await db.query(
        "INSERT INTO season_claims(user_id,season_id,tier) VALUES($1,$2,$3) " +
          "ON CONFLICT(user_id,season_id,tier) DO NOTHING RETURNING tier",
        [userId, season.SEASON.id, tier]
      )).rows;
      if (!inserted.length) continue;
      const reward = season.rewards[tier - 1];
      if (reward.kind === "ic") {
        state.balance = state.balance.plus(reward.amount);
        state.totalEarned = state.totalEarned.plus(reward.amount);
      } else if (reward.kind === "item") {
        await addItem(db, userId, reward.item, reward.quantity);
      }
      await event(db, userId, "season_reward_claim", 0, { season: season.SEASON.id, tier, reward });
      grants.push({ tier, reward: season.label(reward) });
    }
    return { grants, unlocked };
  });
}

module.exports = { pool, transact, profile, getCompanions, adoptCompanion, equipCompanion, hatchCompanion, getExploration, startExpedition, collectExpedition, upgradeExpeditionGear, getPreferences, setPreferences, resetPreferences, getChallenges, claimChallenge, seasonStatus, claimSeasonRewards, buyGenerator, mine, daily, craft, openLootbox, giveItem,
  prestige, leaderboard, browseMarket, sellItem, buyListing, cancelListing, getListing, useItem, upgradePickaxe, upgradePerk,
  respecPerks, getStats };
