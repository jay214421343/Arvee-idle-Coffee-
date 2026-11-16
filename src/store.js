"use strict";
const { Pool } = require("pg");
const { items, recipes, byId } = require("./catalog");
const { Decimal, dec, generatorRate, purchaseCost, settle, PRESTIGE_REQUIREMENT, prestigeMultiplier } = require("./economy");

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
      const rate = generatorRate(generators, player.prestige);
      const passive = settle(player.balance, player.total_earned, rate, player.last_settled_at, time);
      states.set(id, {
        id, balance: passive.balance, totalEarned: passive.totalEarned,
        prestige: player.prestige, rate, generators,
        mineXp: player.mine_xp, lastMine: player.last_mine_at,
        lastDaily: player.last_daily_at, lastSettledAt: passive.settledAt
      });
    }
    const result = await action(client, states);
    for (const state of states.values()) {
      await client.query(
        "UPDATE players SET balance=$2, total_earned=$3, prestige=$4, mine_xp=$5, last_mine_at=$6, last_daily_at=$7, last_settled_at=$8, updated_at=now() WHERE user_id=$1",
        [state.id, state.balance.toFixed(0), state.totalEarned.toFixed(0), state.prestige,
          state.mineXp, state.lastMine, state.lastDaily, state.lastSettledAt]
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
async function event(db, userId, type, amount, metadata = {}) {
  await db.query("INSERT INTO economy_events(user_id, event_type, amount, metadata) VALUES($1,$2,$3,$4)", [userId, type, dec(amount).toFixed(0), JSON.stringify(metadata)]);
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
  if (!entry) throw new Error("Generator not found. Use /coffee shop.");
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const current = (await db.query("SELECT quantity FROM player_generators WHERE user_id=$1 AND generator_id=$2", [userId, entry.id])).rows[0];
    const owned = current ? current.quantity : 0;
    if (owned + quantity > 10000000) throw new Error("Generator ownership limit reached.");
    const cost = purchaseCost(entry.cost, owned, quantity);
    if (state.balance.lt(cost)) throw new Error("Not enough BP. Need " + cost.toSignificantDigits(5).toString() + " BP.");
    state.balance = state.balance.minus(cost);
    await db.query(
      "INSERT INTO player_generators(user_id,generator_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,generator_id) DO UPDATE SET quantity=player_generators.quantity + EXCLUDED.quantity",
      [userId, entry.id, quantity]
    );
    state.rate = state.rate.plus(dec(entry.income).times(quantity).times(prestigeMultiplier(state.prestige))).floor();
    await event(db, userId, "generator_purchase", cost.neg(), { generator: entry.id, quantity });
    return { generator: entry, quantity, cost, owned: owned + quantity, balance: state.balance, rate: state.rate };
  });
}
async function mine(userId) {
  return transact([userId], async (db, states) => {
    const state = stateOf(states, userId);
    const now = Date.now();
    const cooldown = 5 * 60 * 1000;
    const remaining = state.lastMine ? cooldown - (now - new Date(state.lastMine).getTime()) : 0;
    if (remaining > 0) return { cooldown: Math.ceil(remaining / 1000) };
    const reward = Decimal.max(25, state.rate.times(15)).floor();
    state.balance = state.balance.plus(reward);
    state.totalEarned = state.totalEarned.plus(reward);
    state.lastMine = new Date(now);
    state.mineXp += 1;
    const drop = Math.random() < 0.05 ? "gold" : Math.random() < 0.30 ? "silver" : "ore";
    await addItem(db, userId, drop, 1);
    if (Math.random() < 0.04) await addItem(db, userId, "lootbox", 1);
    await event(db, userId, "mine", reward, { drop });
    return { reward, drop, mineXp: state.mineXp };
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
    await addItem(db, userId, "lootbox", 2);
    await addItem(db, userId, "coffee", 1);
    await event(db, userId, "daily", 0);
    return { received: ["2 Lootboxes", "1 Coffee"] };
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
async function openLootbox(userId, quantity) {
  assertQuantity(quantity, 20);
  return transact([userId], async (db) => {
    await removeItem(db, userId, "lootbox", quantity);
    const drops = {};
    for (let i = 0; i < quantity; i++) {
      const roll = Math.random();
      const item = roll < 0.05 ? "gold" : roll < 0.25 ? "silver" : roll < 0.5 ? "cookie" : "ore";
      drops[item] = (drops[item] || 0) + 1;
    }
    for (const [item, amount] of Object.entries(drops)) await addItem(db, userId, item, amount);
    await event(db, userId, "open_lootbox", 0, { quantity, drops });
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
    if (state.balance.lt(PRESTIGE_REQUIREMENT)) throw new Error("You need 1B BP to prestige.");
    state.prestige += 1;
    state.balance = dec(10);
    state.totalEarned = dec(10);
    state.rate = dec(0);
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
  if (!totalPrice.isInteger() || totalPrice.lt(1) || totalPrice.gt("1e1000")) throw new Error("Price must be a positive whole BP amount.");
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
    if (buyer.balance.lt(price)) throw new Error("Insufficient BP.");
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
module.exports = { pool, transact, profile, buyGenerator, mine, daily, craft, openLootbox, giveItem, prestige, leaderboard, browseMarket, sellItem, buyListing, cancelListing };
