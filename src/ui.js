"use strict";
const {
  ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder,
  ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, MessageFlags, escapeMarkdown
} = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { pretty, dec, purchaseCost, PRESTIGE_REQUIREMENT, Decimal } = require("./economy");
const brand = require("./brand");
const challengeData = require("./challenges");
const exploration = require("./exploration");
const companions = require("./companions");
const { SEASON, rewards, missions, label, tierNeeded } = require("./season");

const ACCENT = brand.theme.primary;
const SUCCESS = brand.theme.success;
const WARN = brand.theme.warning;
const ERROR = brand.theme.error;
const LIMIT = 8;
const PAGE_SIZE = 4;
const INVENTORY_PAGE_SIZE = 8;
const SORT_RARITY = Object.freeze({ Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 });
const BOX_IDS = new Set(["lootbox", "rare_lootbox", "legendary_lootbox"]);
function category(id) {
  if (BOX_IDS.has(id)) return "caches";
  if (items[id]?.effect) return "usable";
  return "materials";
}
function listState(page, filter, sort) { return [page, filter, sort].join("_"); }
function parseListState(raw, type = "inventory") {
  const filters = type === "shop" ? ["all", "affordable", "owned"] : ["all", "materials", "usable", "caches"];
  const sorts = type === "shop" ? ["price", "income"] : ["rarity", "name", "quantity"];
  const parts = String(raw || "").split("_");
  const page = Math.min(999, Math.max(1, Number.parseInt(parts[0], 10) || 1));
  return { page, filter: filters.includes(parts[1]) ? parts[1] : "all", sort: sorts.includes(parts[2]) ? parts[2] : sorts[0] };
}
function selector(owner, action, value, placeholder, choices) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, action, value)).setPlaceholder(placeholder).addOptions(choices));
}
function entrySection(owner, action, id, heading, detail, label = "View") {
  return new SectionBuilder()
    .addTextDisplayComponents(text("**" + heading + "**\n" + detail))
    .setButtonAccessory(button(owner, action, label, id, ButtonStyle.Secondary));
}
function rarityMark(rarity) {
  return ({ Common: "◇", Uncommon: "◆", Rare: "✦", Epic: "✧", Legendary: "★" })[rarity] || "◇";
}

function navigation(owner) {
  return selector(owner, "navigate", "", "✦ Navigate ARVEE Idle", [
    { label: "Command Center", value: "profile", description: "Wallet, progression and quick actions" },
    { label: "Expeditions", value: "shop", description: "Recruit passive Idle Credit generators" },
    { label: "Satchel", value: "inventory", description: "Manage your loot and materials" },
    { label: "The Forge", value: "craft", description: "Forge artifacts from gathered materials" },
    { label: "Season Journey", value: "season", description: "Earn Season XP and unlock 20 free rewards" },
    { label: "Adventurer Contracts", value: "challenges", description: "Daily and weekly challenges with claimable rewards" },
    { label: "World Map", value: "explore", description: "Send a crew on timed missions to discover loot" },
    { label: "Companions", value: "companions", description: "Collect, level and equip your pets" },
    { label: "Expedition Gear", value: "equipment", description: "Upgrade your kit, compass and protective ward" },
    { label: "Saved Preferences", value: "settings", description: "View or reset your personal filters" },
    { label: "Pickaxe & Runes", value: "pickaxe", description: "Upgrade mining and permanent perks" },
    { label: "Player Exchange", value: "market", description: "Trade with other adventurers" },
    { label: "Hall of Fame", value: "leaderboard", description: "See top adventurers" },
    { label: "Milestones", value: "stats", description: "Track achievements and records" },
    { label: "Ascension", value: "prestige", description: "Earn a permanent prestige boost" },
    { label: "Field Guide", value: "help", description: "Learn how to play" }
  ]);
}
function filterHeader(owner, action, title, status, state) {
  return new SectionBuilder()
    .addTextDisplayComponents(text("**" + title + "**\n" + status))
    .setButtonAccessory(button(owner, action, "Filters", state, ButtonStyle.Secondary));
}
function choice(owner, action, label, value, selected = false) {
  return button(owner, action, label, value, selected ? ButtonStyle.Primary : ButtonStyle.Secondary, selected);
}
function shopFilters(owner, page = 1, filter = "all", sort = "price") {
  const c = container("RECRUITMENT  /  FILTERS", "Choose what appears on your expedition board.");
  c.addTextDisplayComponents(text("**Current selection**  " +
    ({ all: "All expeditions", affordable: "Can recruit", owned: "My expeditions" }[filter] || "All expeditions") +
    "\nSorting: " + (sort === "income" ? "Highest income" : "Lowest cost")));
  divider(c);
  c.addActionRowComponents(row([
    choice(owner, "shop_filter_set", "All", "all_" + sort, filter === "all"),
    choice(owner, "shop_filter_set", "Affordable", "affordable_" + sort, filter === "affordable"),
    choice(owner, "shop_filter_set", "Owned", "owned_" + sort, filter === "owned")
  ]));
  c.addActionRowComponents(row([button(owner, "shop", "◀ Back to expeditions", listState(page, filter, sort), ButtonStyle.Primary)]));
  return c;
}
function inventoryFilters(owner, page = 1, filter = "all", sort = "rarity") {
  const c = container("SATCHEL  /  FILTERS", "Pick a collection to browse.");
  c.addTextDisplayComponents(text("**Active category:** " +
    ({ all: "Everything", materials: "Crafting materials", usable: "Consumables", caches: "Supply caches" }[filter] || "Everything") +
    "\nSorting: " + ({ rarity: "Rarity", name: "Name", quantity: "Quantity" }[sort] || "Rarity")));
  divider(c);
  c.addActionRowComponents(row([
    choice(owner, "inventory_filter_set", "All", "all_" + sort, filter === "all"),
    choice(owner, "inventory_filter_set", "Materials", "materials_" + sort, filter === "materials")
  ]));
  c.addActionRowComponents(row([
    choice(owner, "inventory_filter_set", "Consumables", "usable_" + sort, filter === "usable"),
    choice(owner, "inventory_filter_set", "Caches", "caches_" + sort, filter === "caches")
  ]));
  c.addActionRowComponents(row([button(owner, "inventory", "◀ Back to Satchel", listState(page, filter, sort), ButtonStyle.Primary)]));
  return c;
}
function craftState(page, filter = "all") { return page + "_" + filter; }
function parseCraftState(raw) {
  const parts = String(raw || "").split("_");
  return { page: Math.max(1, Math.min(999, Number.parseInt(parts[0], 10) || 1)),
    filter: parts[1] === "ready" ? "ready" : "all" };
}

function custom(owner, action, arg = "") {
  if (!/^[0-9]{15,22}$/.test(String(owner)) || !/^[a-z_]+$/.test(action) || !/^[a-zA-Z0-9_]*$/.test(String(arg))) {
    throw new Error("Invalid UI identifier");
  }
  const id = ["ai", "2", owner, action, arg].join(":");
  if (id.length > 100) throw new Error("UI identifier exceeds Discord limit");
  return id;
}
function button(owner, action, label, arg = "", style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder().setCustomId(custom(owner, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled);
}
function row(buttons) { return new ActionRowBuilder().addComponents(...buttons); }
function linkButton(label, url) { return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url); }
function text(content) { return new TextDisplayBuilder().setContent(String(content).slice(0, 3900)); }
function container(title, sub = "", accent = ACCENT) {
  const c = new ContainerBuilder().setAccentColor(accent);
  c.addTextDisplayComponents(text("## " + title));
  if (sub) c.addTextDisplayComponents(text(sub));
  return c;
}
function divider(c) { c.addSeparatorComponents(new SeparatorBuilder().setDivider(true)); return c; }
function foot(c, content) { c.addTextDisplayComponents(text(content)); return c; }
function message(heading, body, owner, opts = {}) {
  const c = container(heading, body, opts.color || ACCENT);
  const actions = opts.buttons || (owner ? [
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary)
  ] : []);
  if (actions.length) {
    divider(c);
    c.addActionRowComponents(row(actions.slice(0, 3)));
  }
  return c;
}
// Coffee-inspired narrative receipts, adapted for ARVEE Idle Components V2.
// No fake cooldown-skipping effect: Campfire Brew currently grants IC only.
function activityCard(owner, heading, speaker, quote, body, actions, footer = "") {
  const c = container(heading, "**" + speaker + "**\n*" + quote + "*");
  divider(c);
  c.addTextDisplayComponents(text(body));
  if (footer) foot(c, footer);
  c.addActionRowComponents(row(actions.slice(0, 2)));
  return c;
}
function countdown(seconds) {
  const remaining = Math.max(1, Math.ceil(Number(seconds) || 1));
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return [h ? h + "h" : "", m ? m + "m" : "", !h && (!m || s) ? s + "s" : ""].filter(Boolean).join(" ");
}
function retryTime(seconds) {
  const remaining = Math.max(1, Math.ceil(Number(seconds) || 1));
  return "<t:" + (Math.floor(Date.now() / 1000) + remaining) + ":R>";
}
function miningResult(owner, result, profile = null) {
  const waiting = Number(result.cooldown) > 0;
  if (waiting) {
    return activityCard(owner, "MINING  /  RESTING", "THE PROSPECTOR",
      "Even the strongest pickaxe needs a moment.",
      "**Next mining session**  " + retryTime(result.cooldown) +
        "\n**Remaining**  " + countdown(result.cooldown) +
        (profile ? "\n**Pickaxe**  Tier " + (profile.pickaxeTier || 0) : ""),
      [button(owner, "pickaxe", "View pickaxe", "", ButtonStyle.Primary),
       button(owner, "profile", "Command Center")],
      "Tip: Quick Hands reduces your mining cooldown. Check Runic Talents from your pickaxe."
    );
  }
  const drop = items[result.drop];
  const loot = drop ? drop.name : "Materials";
  const qty = result.dropQuantity || 1;
  const details = "**EARNED**\n+" + pretty(result.reward) + " IC" +
    "\n\n**FOUND**\n" + qty + "× " + loot +
    (result.box ? "\n1× Supply Cache (bonus)" : "") +
    "\n\n**PICKAXE**\nMining XP " + (result.mineXp ?? profile?.mineXp ?? 0) +
    (profile ? "  ·  Tier " + (profile.pickaxeTier || 0) : "");
  return activityCard(owner, "MINING  /  SUCCESS", "THE PROSPECTOR",
    "A good haul. The mountain has more secrets yet.", details,
    [button(owner, "pickaxe", "View pickaxe", "", ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "More income and stronger pickaxes improve your next dig."
  );
}
function dailyResult(owner, result, profile = null) {
  const waiting = Number(result.cooldown) > 0;
  if (waiting) {
    return activityCard(owner, "DAILY SUPPLIES  /  RESTOCKING", "THE QUARTERMASTER",
      "Your next supply shipment isn't ready just yet.",
      "**Next delivery**  " + retryTime(result.cooldown) +
        "\n**Remaining**  " + countdown(result.cooldown),
      [button(owner, "mine", "Go mining", "", ButtonStyle.Primary),
       button(owner, "profile", "Command Center")],
      "In the meantime, mine or send your crew on an expedition."
    );
  }
  const received = Array.isArray(result.received) ? result.received : [];
  const details = "**DELIVERY RECEIVED**\n" +
    received.map((entry) => "• " + entry).join("\n") +
    (profile ? "\n\n**CURRENT BALANCE**\n" + pretty(profile.balance) + " IC" : "");
  return activityCard(owner, "DAILY SUPPLIES  /  DELIVERED", "THE QUARTERMASTER",
    "Your provisions are ready. Make them count.", details,
    [button(owner, "mine", "Go mining", "", ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "The daily supply delivery refreshes after 22 hours."
  );
}
function craftingResult(owner, itemId, quantity) {
  const entry = items[itemId];
  if (!entry) throw new Error("Unknown item.");
  return activityCard(owner, "THE FORGE  /  FINISHED", "THE ARTIFICER",
    "A fine piece of work. Take care of it.",
    "**CRAFTED**\n" + quantity + "× " + entry.name +
      "\n\n**QUALITY**\n" + entry.rarity,
    [button(owner, "craft", "Back to forge", "", ButtonStyle.Primary),
     button(owner, "inventory", "Satchel")],
    "Your materials and crafted item are saved to your collection."
  );
}
function cacheResult(owner, drops) {
  const entries = Object.entries(drops || {})
    .filter(([, amount]) => Number(amount) > 0 && Number.isFinite(Number(amount)));
  return activityCard(owner, "SUPPLY CACHE  /  OPENED", "THE QUARTERMASTER",
    "Let's see what was tucked away inside.",
    "**CONTENTS**\n" + (entries.length
      ? entries.map(([id, amount]) => "• " + amount + "× " + (items[id]?.name || id)).join("\n")
      : "Nothing found."),
    [button(owner, "inventory", "View satchel", "", ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "Your finds have been added to your inventory."
  );
}
function home(owner, user, p) {
  const operations = p.generators.reduce((n, g) => n + g.quantity, 0);
  const c = container("✦ ARVEE IDLE  /  COMMAND CENTER", "THE ADVENTURE CONTINUES WHILE YOU'RE AWAY");
  const s = new SectionBuilder().addTextDisplayComponents(
    text("### " + escapeMarkdown(user.username).slice(0, 80) + "\n**" +
      pretty(p.balance) + " IC**  ·  **+" + pretty(p.rate) + " IC/s**"),
    text("Crew " + operations + "   ·   Prestige " + p.prestige +
      "\nMining XP " + p.mineXp + "   ·   " + pretty(p.totalEarned) + " lifetime IC")
  ).setThumbnailAccessory(new ThumbnailBuilder()
    .setURL(user.displayAvatarURL({ extension: "png", size: 128 }))
    .setDescription("ARVEE Idle player avatar"));
  c.addSectionComponents(s);
  divider(c);
  const progress = Math.max(0, Math.min(10, Decimal.min(p.balance.div(PRESTIGE_REQUIREMENT).times(10), 10).floor().toNumber()));
  c.addTextDisplayComponents(text("**ASCENSION PROGRESS**  " + "▰".repeat(progress) +
    "▱".repeat(10 - progress) + "  " + Math.floor(progress * 10) + "%\n" +
    (operations === 0 ? "**Getting started:** Claim Daily → Mine → Recruit your first expedition." :
      "**Passive income:** Your expeditions are producing IC, even offline.")));
  c.addActionRowComponents(row([
    button(owner, "mine", "Mine", "", ButtonStyle.Primary),
    button(owner, "daily", "Daily Reward"),
    button(owner, "shop", "Expeditions"),
    button(owner, "inventory", "Satchel")
  ]));
  c.addActionRowComponents(navigation(owner));
  foot(c, "**Next:** Complete expeditions or open your Season Journey to unlock rewards.\n[ARVEE World](" + brand.website + ")");
  return c;
}

function shop(owner, page = 1, p = null, filter = "all", sort = "price") {
  if (!["all", "affordable", "owned"].includes(filter)) filter = "all";
  if (!["price", "income"].includes(sort)) sort = "price";
  const owned = (g) => p?.generators.find((x) => x.generator_id === g.id)?.quantity || 0;
  const cost = (g) => purchaseCost(g.cost, owned(g), 1);
  let entries = generators.filter((g) => filter === "all" ||
    (filter === "owned" ? owned(g) > 0 : p && p.balance.gte(cost(g))));
  entries = entries.sort((a, b) => sort === "income" ? dec(b.income).cmp(dec(a.income)) : cost(a).cmp(cost(b)));
  const total = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const c = container("ARVEE IDLE  /  EXPEDITIONS",
    "**" + (p ? pretty(p.balance) : "—") + " IC** in treasury  ·  **+" + (p ? pretty(p.rate) : "0") +
    " IC/s**\nRecruit units, expand your empire and earn while offline.");
  c.addSectionComponents(filterHeader(owner, "shop_filters", "RECRUITMENT BOARD",
    (filter === "owned" ? "Owned" : filter === "affordable" ? "Affordable" : "All expeditions") +
    "  ·  " + (sort === "income" ? "Highest income first" : "Lowest cost first"),
    listState(page, filter, sort)));
  c.addActionRowComponents(selector(owner, "shop_sort", filter, "↕ Sort expeditions",
    [{ label: "Lowest cost", value: "price", default: sort === "price" },
      { label: "Highest IC per second", value: "income", default: sort === "income" }]));
  if (!visible.length) c.addTextDisplayComponents(text("No expeditions match this filter. Open Filters to view everything."));
  for (const g of visible) {
    const units = owned(g);
    const next = cost(g);
    const affordable = p && p.balance.gte(next);
    c.addSectionComponents(entrySection(owner, "operation", g.id,
      g.name,
      (affordable ? "**READY TO RECRUIT**" : "NEXT COST") + "  " + pretty(next) +
      " IC\n+" + pretty(g.income) + " IC/s per unit" + (units ? "  ·  " + units + " owned" : ""), "Inspect"));
  }
  c.addActionRowComponents(row([
    button(owner, "shop", "◀", listState(page - 1, filter, sort), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "shop", "▶", listState(page + 1, filter, sort), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**SECTOR " + page + " / " + total + "**  ·  " + entries.length + " expeditions  ·  Filters are saved automatically");
  return c;
}

function generator(owner, id, page, p, note = "") {
  const g = byId.get(id);
  if (!g) throw new Error("Unknown generator.");
  const owned = p.generators.find((row) => row.generator_id === id)?.quantity || 0;
  const c = container(g.name, g.description || "An ARVEE Idle expedition.");
  const oneCost = purchaseCost(g.cost, owned, 1);
  const tenCost = purchaseCost(g.cost, owned, 10);
  const hundredCost = purchaseCost(g.cost, owned, 100);
  divider(c);
  c.addTextDisplayComponents(text("**Owned**  " + owned + "  ·  **Income/unit**  +" + pretty(g.income) +
    " IC/s\n**Buy 1**  " + pretty(oneCost) + " IC" +
    "\n**Buy 10**  " + pretty(tenCost) + " IC" +
    "\n**Buy 100**  " + pretty(hundredCost) + " IC" +
    "\n**Wallet**  " + pretty(p.balance) + " IC"));
  if (note) foot(c, note);
  c.addActionRowComponents(row([
    button(owner, "buy_one", "Buy 1", id, ButtonStyle.Primary, owned + 1 > 10000 || p.balance.lt(oneCost)),
    button(owner, "buy_ten", "Buy 10", id, ButtonStyle.Secondary, owned + 10 > 10000 || p.balance.lt(tenCost)),
    button(owner, "buy_hundred", "Buy 100", id, ButtonStyle.Secondary, owned + 100 > 10000 || p.balance.lt(hundredCost)),
    button(owner, "shop", "Operations", String(page)),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function inventory(owner, p, page = 1, filter = "all", sort = "rarity") {
  if (!["all", "materials", "usable", "caches"].includes(filter)) filter = "all";
  if (!["rarity", "name", "quantity"].includes(sort)) sort = "rarity";
  let entries = p.inventory.filter((e) => e.quantity > 0 && items[e.item_id] &&
    (filter === "all" || category(e.item_id) === filter));
  entries = entries.sort((a, b) => {
    if (sort === "quantity") return b.quantity - a.quantity || a.item_id.localeCompare(b.item_id);
    if (sort === "name") return items[a.item_id].name.localeCompare(items[b.item_id].name);
    return (SORT_RARITY[items[b.item_id].rarity] || 0) - (SORT_RARITY[items[a.item_id].rarity] || 0) ||
      items[a.item_id].name.localeCompare(items[b.item_id].name);
  });
  const total = Math.max(1, Math.ceil(entries.length / INVENTORY_PAGE_SIZE));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const visible = entries.slice((page - 1) * INVENTORY_PAGE_SIZE, page * INVENTORY_PAGE_SIZE);
  const c = container("ARVEE IDLE  /  SATCHEL", "**" + p.inventory.length +
    " unique items**  ·  Explore your loot, supplies and forging materials.");
  c.addSectionComponents(filterHeader(owner, "inventory_filters", "COLLECTION",
    (filter === "all" ? "All items" : ({ materials: "Crafting materials", usable: "Consumables", caches: "Supply caches" }[filter])) +
    "  ·  " + ({ rarity: "Rare first", name: "Alphabetical", quantity: "Most owned" }[sort]),
    listState(page, filter, sort)));
  c.addActionRowComponents(selector(owner, "inventory_sort", filter, "↕ Sort your collection", [
    { label: "Rarest first", value: "rarity", default: sort === "rarity" },
    { label: "Alphabetical", value: "name", default: sort === "name" },
    { label: "Most owned", value: "quantity", default: sort === "quantity" }
  ]));
  divider(c);
  if (!visible.length) c.addTextDisplayComponents(text("**Nothing in this category yet.**\nTry Filters, /idle mine, or your daily reward."));
  else c.addTextDisplayComponents(text(visible.map((e) => {
    const item = items[e.item_id];
    return rarityMark(item.rarity) + "  **" + escapeMarkdown(item.name) + "**" +
      "  ×" + e.quantity + "\n" + "   " + item.rarity + "  ·  " + (category(e.item_id) === "caches" ? "Supply cache" :
      category(e.item_id) === "usable" ? "Consumable" : "Forge material");
  }).join("\n\n")));
  if (visible.length) c.addActionRowComponents(selector(owner, "item_select", listState(page, filter, sort),
    "Inspect an item...", visible.map((e) => ({
      label: items[e.item_id].name.slice(0, 100), value: e.item_id,
      description: items[e.item_id].rarity + " · Owned ×" + e.quantity
    }))));
  c.addActionRowComponents(row([
    button(owner, "inventory", "◀ Previous", listState(page - 1, filter, sort), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "inventory", "Next ▶", listState(page + 1, filter, sort), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**BAG " + page + " / " + total + "**  ·  " + entries.length + " matches   ·   " +
    "◇ Common  ·  ◆ Uncommon  ·  ✦ Rare  ·  ✧ Epic  ·  ★ Legendary  ·  Filters auto-save");
  return c;
}

function item(owner, id, quantity, back = "1_all_rarity") {
  const entry = items[id]; if (!entry) throw new Error("Unknown item.");
  const canOpen = BOX_IDS.has(id);
  const c = container(entry.emoji + "  " + entry.name.toUpperCase(),
    rarityMark(entry.rarity) + " **" + entry.rarity + "**   ·   **×" + quantity + " owned**");
  divider(c);
  c.addTextDisplayComponents(text("### FIELD NOTES\n" + entry.description +
    (entry.use ? "\n\n**Effect**  " + entry.use : "") +
    (recipes[id] ? "\n\n**Forge recipe**  " + Object.entries(recipes[id]).map(([part, q]) => q + "× " + items[part].name).join(" · ") : "")));
  c.addActionRowComponents(row([
    button(owner, canOpen ? "open_one" : "use_item", canOpen ? "Open cache" : "Use item",
      id, ButtonStyle.Secondary, (!entry.effect && !canOpen) || quantity < 1),
    button(owner, "inventory", "◀ Back to Satchel", String(back).includes("_") ? String(back) : "1_all_rarity"),
    ...(recipes[id] ? [button(owner, "recipe_view", "Forge recipe", id)] : [])
  ]));
  return c;
}

function crafting(owner, p = null, page = 1, filter = "all") {
  const owned = (id) => p?.inventory.find((e) => e.item_id === id)?.quantity || 0;
  let entries = Object.entries(recipes);
  if (filter === "ready" && p) entries = entries.filter(([, ingredients]) =>
    Object.entries(ingredients).every(([key, quantity]) => owned(key) >= quantity));
  const total = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const c = container("ARVEE IDLE  /  THE FORGE", "Build artifacts and power-ups using loot from your adventures.");
  c.addActionRowComponents(selector(owner, "craft_filter", "", "Choose a recipe collection", [
    { label: "All forge recipes", value: "all", default: filter !== "ready" },
    { label: "Craftable right now", value: "ready", default: filter === "ready" }
  ]));
  if (!visible.length) c.addTextDisplayComponents(text("**No recipes are ready yet.**\nMine for supplies or switch back to All recipes."));
  for (const [id, ingredients] of visible) {
    const entry = items[id];
    const ready = p && Object.entries(ingredients).every(([key, n]) => owned(key) >= n);
    c.addSectionComponents(entrySection(owner, "recipe_view", id,
      entry.name,
      rarityMark(entry.rarity) + " " + entry.rarity + "   ·   " + (ready ? "**Ready to craft**" : "Needs materials") +
      "\n" + Object.entries(ingredients).map(([k, n]) => n + "× " + items[k].name).join("  ·  ").slice(0, 140),
      "Forge"));
  }
  c.addActionRowComponents(row([
    button(owner, "craft", "◀ Previous", craftState(page - 1, filter), ButtonStyle.Secondary, page === 1),
    button(owner, "inventory", "Satchel"),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "craft", "Next ▶", craftState(page + 1, filter), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**BLUEPRINTS " + page + " / " + total + "**  ·  " + entries.length +
    (filter === "ready" ? " craftable now" : " recipes available"));
  return c;
}
function recipe(owner, id, p = null) {
  if (!recipes[id]) throw new Error("Unknown recipe.");
  const item = items[id];
  const owns = (key) => p?.inventory.find((x) => x.item_id === key)?.quantity || 0;
  const craftable = p ? Math.min(...Object.entries(recipes[id]).map(([key, quantity]) => Math.floor(owns(key) / quantity))) : null;
  const c = container(item.name.toUpperCase(),
    rarityMark(item.rarity) + " **" + item.rarity + "**  ·  " + item.description);
  c.addTextDisplayComponents(text("### REQUIRED MATERIALS\n" +
    Object.entries(recipes[id]).map(([key, quantity]) =>
      (p && owns(key) >= quantity ? "✓ " : "· ") + "**" + items[key].name + "**  " +
      (p ? owns(key) + " / " : "") + quantity).join("\n") +
    "\n\n**Ready to forge:** " + (craftable ?? "Check your satchel") + " units"));
  c.addActionRowComponents(row([
    button(owner, "craft_one", "Forge 1", id, ButtonStyle.Primary, craftable !== null && craftable < 1),
    button(owner, "craft_five", "Forge 5", id, ButtonStyle.Secondary, craftable !== null && craftable < 5)
  ]));
  c.addActionRowComponents(row([
    button(owner, "craft", "◀ All blueprints", "1_all"),
    button(owner, "inventory", "Satchel")
  ]));
  return c;
}

function companionCollection(owner, state, note = "") {
  const owned = new Map(state.owned.map((pet) => [pet.id, pet]));
  const selected = owned.get(state.activeId);
  const c = container("ARVEE IDLE  /  COMPANIONS",
    "**" + state.owned.length + " / 3 discovered**  ·  **" + state.eggs + " eggs**\n" +
    "One active companion shares your adventures. No feeding or paid upgrades.");
  if (selected) {
    const next = selected.level === companions.MAX_LEVEL ? companions.MAX_XP : selected.nextXp;
    const progress = next === selected.startXp ? 10 :
      Math.floor(10 * (selected.xp - selected.startXp) / (next - selected.startXp));
    c.addTextDisplayComponents(text("### ACTIVE COMPANION\n" +
      "**" + companions.byId.get(selected.id).name + "**  ·  Level " + selected.level +
      "  ·  " + selected.stage + "\n" + selected.bonus.description +
      "\n" + "▰".repeat(Math.min(10, progress)) + "▱".repeat(10 - Math.min(10, progress)) +
      "  " + (selected.level === companions.MAX_LEVEL ? "Max level" : selected.xp + " / " + next + " XP")));
  } else {
    c.addTextDisplayComponents(text("### YOUR FIRST COMPANION\nChoose a starter companion below. It is free, permanent and can be changed later."));
  }
  divider(c);
  c.addTextDisplayComponents(text("**COLLECTION**\n" + companions.PETS.map((pet) => {
    const p = owned.get(pet.id);
    return (p ? (state.activeId === pet.id ? "● " : "○ ") : "– ") +
      "**" + pet.name + "**  ·  " + (p ? "Lv " + p.level + " · " + p.stage : "Undiscovered") +
      "\n   " + (p ? p.bonus.description : pet.description);
  }).join("\n\n")));
  c.addActionRowComponents(selector(owner,
    state.starterClaimed ? "companion_select" : "companion_adopt",
    "",
    state.starterClaimed ? "Choose your active companion" : "Choose your free starter",
    (state.starterClaimed ? state.owned.map((pet) => companions.byId.get(pet.id)) : companions.PETS)
      .map((pet) => ({
        label: pet.name, value: pet.id,
        description: pet.description.slice(0,100),
        ...(state.starterClaimed ? { default: state.activeId === pet.id } : {})
      }))
  ));
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0,280) + "**"));
  c.addActionRowComponents(row([
    ...(state.eggs > 0 ? [button(owner, "companion_hatch", "Hatch egg (" + state.eggs + ")", "", ButtonStyle.Primary)] : []),
    button(owner, "explore", "World Map", "", state.eggs > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}

function expeditionMap(owner, status, note = "") {
  const c = container("ARVEE IDLE  /  WORLD MAP",
    "Explore new regions with your recruited adventurers. Missions continue while offline.");
  c.addTextDisplayComponents(text("**YOUR CREW**  " + status.crew + " recruited" +
    "   ·   **EXPLORATION XP**  " + status.xp + "\n" +
    "Upgrade equipment to improve rewards, duration and reliability."));
  if (status.active) {
    const r = exploration.regionById.get(status.active.regionId);
    c.addTextDisplayComponents(text("**ACTIVE EXPEDITION**\n" +
      (r?.name || "Expedition") +
      "   ·   " + (status.active.ready ? "**Ready to collect**" :
        "Returns <t:" + Math.floor(Date.parse(status.active.finishesAt) / 1000) + ":R>") +
      "\nStart another mission after claiming these rewards."));
  }
  divider(c);
  for (const region of exploration.REGIONS) {
    const unlocked = exploration.unlocked(region, status.crew, status.xp);
    const duration = exploration.duration(region, status.gear, status.companion);
    const description = (unlocked ? "Available" : "Requires " + region.crew +
      " crew and " + region.xp + " XP") + "  ·  " + Math.ceil(duration / 60) + " min" +
      "  ·  Base reward " + region.credits.toLocaleString("en-US") + " IC";
    c.addSectionComponents(entrySection(owner, "region_view", region.id,
      (unlocked ? "" : "Locked · ") + region.name,
      description, "Inspect"));
  }
  c.addActionRowComponents(row([
    ...(status.active?.ready ? [button(owner, "expedition_collect", "Collect rewards", "", ButtonStyle.Primary)] : []),
    button(owner, "equipment", "Equipment", "", status.active?.ready ? ButtonStyle.Secondary : ButtonStyle.Primary),
    button(owner, "profile", "Command Center")
  ]));
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0, 280) + "**"));
  return c;
}
function expeditionRegion(owner, status, regionId) {
  const region = exploration.regionById.get(regionId);
  if (!region) throw new Error("Unknown exploration region.");
  const unlocked = exploration.unlocked(region, status.crew, status.xp);
  const rate = Math.round(exploration.chance(region, status.gear) * 100);
  const seconds = exploration.duration(region, status.gear, status.companion);
  const c = container(region.name.toUpperCase(),
    region.description);
  divider(c);
  c.addTextDisplayComponents(text("### EXPEDITION BRIEFING\n" +
    "**Unlock:** " + region.crew + " recruited crew · " + region.xp + " exploration XP\n" +
    "**Your progress:** " + status.crew + " crew · " + status.xp + " XP\n" +
    "**Duration:** " + Math.ceil(seconds / 60) + " minutes  ·  **Success:** " + rate + "%\n" +
    "**Companion:** " + (status.companion ? companions.byId.get(status.companion.id).name + " · " + companions.bonus(status.companion).description : "None active") + "\n" +
    "**Potential payout:** up to " + region.credits.toLocaleString("en-US") + " IC and materials\n" +
    "**Possible finds:** " + region.drops.map((drop) => items[drop.id]?.name || drop.id).join(" · ") +
    "\n\n" + (status.active ? "One expedition is already in progress." :
      unlocked ? "Your crew is ready to explore." : "Recruit more crew and explore easier regions to unlock this route.")));
  c.addActionRowComponents(row([
    button(owner, "expedition_start", unlocked ? "Start expedition" : "Region locked",
      region.id, ButtonStyle.Primary, !unlocked || !!status.active),
    button(owner, "explore", "World Map")
  ]));
  return c;
}
function expeditionGear(owner, status, note = "") {
  const c = container("ARVEE IDLE  /  EXPEDITION GEAR",
    "Three permanent upgrades for your adventures. Equipment survives prestige.");
  c.addTextDisplayComponents(text("**TREASURY**  " + pretty(status.balance) +
    " IC   ·   **EXPLORATION XP**  " + status.xp));
  divider(c);
  const affordable = [];
  const details = [];
  for (const g of exploration.GEAR) {
    const level = status.gear[g.id] || 0;
    const maxed = level >= g.max;
    const cost = maxed ? null : exploration.upgradeCost(g.id, level);
    const parts = cost ? Object.entries(cost.materials).map(([id, qty]) => {
      const owned = status.inventory.find((row) => row.item_id === id)?.quantity || 0;
      return qty + "× " + items[id].name + " (" + owned + "/" + qty + ")";
    }).join(" · ") : "";
    const canUpgrade = !!cost && status.balance.gte(cost.credits) &&
      Object.entries(cost.materials).every(([id, quantity]) =>
        (status.inventory.find((r) => r.item_id === id)?.quantity || 0) >= quantity);
    if (canUpgrade) affordable.push(g);
    details.push("**" + g.name + "  ·  Lv " + level + "/" + g.max + "**\n" +
      g.description + "\n" +
      (maxed ? "Fully upgraded" : (canUpgrade ? "Ready" : "Need supplies") +
        "  ·  " + cost.credits + " IC + " + parts));
  }
  c.addTextDisplayComponents(text(details.join("\n\n")));
  const options = affordable.length
    ? affordable.map((g) => ({ label: "Upgrade " + g.name, value: g.id,
      description: "Spend IC and materials to reach the next level" }))
    : [{ label: "No upgrades available", value: "none",
      description: "Collect IC and materials or finish upgrading your equipment" }];
  c.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(custom(owner, "equipment_select"))
      .setPlaceholder("Upgrade equipment").setDisabled(!affordable.length).addOptions(options)
  ));
  c.addActionRowComponents(row([
    button(owner, "explore", "World Map", "", ButtonStyle.Primary),
    button(owner, "profile", "Command Center")
  ]));
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0, 280) + "**"));
  return c;
}

function preferences(owner, p, note = "") {
  const c = container("ARVEE IDLE  /  SAVED PREFERENCES",
    "Your personal filters are remembered on every Discord device and after bot restarts.");
  c.addTextDisplayComponents(text("**EXPEDITIONS**\n" +
    "Collection: " + ({ all: "All expeditions", affordable: "Affordable", owned: "Owned" }[p.shopFilter] || "All") +
    "  ·  Sort: " + (p.shopSort === "income" ? "Highest production" : "Lowest cost") +
    "\n\n**SATCHEL**\n" +
    "Collection: " + ({ all: "Everything", materials: "Materials", usable: "Consumables", caches: "Supply caches" }[p.inventoryFilter] || "Everything") +
    "  ·  Sort: " + ({ rarity: "Rarity", quantity: "Quantity", name: "Name" }[p.inventorySort] || "Rarity") +
    "\n\n**FORGE**\n" +
    "Show: " + (p.forgeFilter === "ready" ? "Craftable only" : "All recipes")));
  if (note) c.addTextDisplayComponents(text("**" + note + "**"));
  c.addActionRowComponents(row([
    button(owner, "shop", "Expeditions", "", ButtonStyle.Primary),
    button(owner, "inventory", "Satchel"),
    button(owner, "craft", "Forge")
  ]));
  c.addActionRowComponents(row([
    button(owner, "preferences_reset", "Restore default filters"),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function challengeBoard(owner, boards, scope = "daily", note = "") {
  const chosen = scope === "weekly" ? "weekly" : "daily";
  const board = boards[chosen];
  if (!board || !Array.isArray(board.tasks)) throw new Error("Challenges are unavailable.");
  const c = container("ARVEE IDLE  /  ADVENTURER CONTRACTS",
    "**" + (chosen === "daily" ? "DAILY" : "WEEKLY") + " CONTRACTS**\n" +
    "Complete your regular adventures and claim extra IC and crafting supplies.");
  c.addActionRowComponents(selector(owner, "challenge_scope", "", "Choose a challenge board", [
    { label: "Daily contracts", value: "daily", default: chosen === "daily",
      description: "Three daily objectives and rewards" },
    { label: "Weekly contracts", value: "weekly", default: chosen === "weekly",
      description: "Bigger goals and rarer rewards" }
  ]));
  c.addTextDisplayComponents(text("**Reset:** <t:" + Math.floor(Date.parse(board.endsAt) / 1000) +
    ":R>   ·   Rewards are claimed individually"));
  for (const task of board.tasks) {
    const complete = task.progress >= task.goal;
    const canClaim = complete && !task.claimed;
    const textBody = "**" + task.label + "**\n" +
      Math.min(task.goal, task.progress) + "/" + task.goal + " completed  ·  " +
      (task.claimed ? "Claimed" : canClaim ? "Ready to claim" : "In progress") +
      "\nReward: " + challengeData.rewardLabel(task.reward);
    c.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text(textBody))
      .setButtonAccessory(button(owner, "challenge_claim",
        task.claimed ? "Claimed" : canClaim ? "Claim" : "Locked",
        chosen + "_" + board.key + "_" + task.id, ButtonStyle.Secondary, !canClaim)));
  }
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0, 300) + "**"));
  c.addActionRowComponents(row([
    button(owner, "challenges", "Refresh", chosen, ButtonStyle.Primary),
    button(owner, "season", "Season Journey", "1"),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}

function season(owner, progress, page = 1, note = "") {
  const total = Math.ceil(rewards.length / 4);
  page = Math.min(total, Math.max(1, Number(page) || 1));
  const xp = Math.max(0, Number(progress.xp || 0));
  const currentTier = Math.min(rewards.length, Math.floor(xp / SEASON.xpPerTier));
  const claimed = new Set(progress.claimed || []);
  const claimable = currentTier - [...claimed].filter((tier) => tier <= currentTier).length;
  const ended = progress.phase === "finished" || progress.phase === "upcoming";
  const c = container("ARVEE IDLE  /  SEASON JOURNEY",
    "**Founders' Journey · Season 01**\n" + SEASON.subtitle +
    "\nFree reward track · 20 tiers · " +
    (progress.phase === "active" ? "Ends 16 Jan 2027" :
      progress.phase === "claim_only" ? "Claim grace until 23 Jan 2027" :
      progress.phase === "upcoming" ? "Coming soon" : "Season finished"));
  c.addTextDisplayComponents(text("### YOUR SEASON PROGRESS\n" +
    "**" + xp.toLocaleString("en-US") + " / " + (rewards.length * SEASON.xpPerTier).toLocaleString("en-US") + " XP**" +
    "   ·   **Tier " + currentTier + " / " + rewards.length + "**\n" +
    "▰".repeat(currentTier === rewards.length ? 10 : Math.min(10, Math.floor((xp % SEASON.xpPerTier) / SEASON.xpPerTier * 10))) +
    "▱".repeat(currentTier === rewards.length ? 0 : 10 - Math.min(10, Math.floor((xp % SEASON.xpPerTier) / SEASON.xpPerTier * 10))) +
    (currentTier === rewards.length ? "  MAX TIER" : "  " + (xp % SEASON.xpPerTier) + " / " + SEASON.xpPerTier + " to next") +
    "\n**Today's XP:** " + (progress.dailyXp || 0) + " / " + SEASON.dailyXpCap));
  c.addTextDisplayComponents(text("**DAILY CONTRACTS**  ·  Earn XP by playing\n" +
    missions.map((m) => {
      const done = Math.min(m.goal, Number(progress.activities?.[m.event] || 0));
      return (done === m.goal ? "✓ " : "○ ") + m.label + "  " + done + "/" + m.goal;
    }).join("   ·   ")));
  const visible = rewards.slice((page - 1) * 4, page * 4);
  for (const [i, reward] of visible.entries()) {
    const tier = (page - 1) * 4 + i + 1;
    const collected = claimed.has(tier);
    const ready = currentTier >= tier && !collected && !ended;
    const section = new SectionBuilder()
      .addTextDisplayComponents(text("**TIER " + String(tier).padStart(2, "0") + "  ·  " + label(reward) +
        "**\n" + (collected ? "✓ COLLECTED" : ready ? "UNLOCKED · READY TO CLAIM" :
          currentTier >= tier ? "REWARD NO LONGER CLAIMABLE" : "LOCKED · " + tierNeeded(tier) + " XP required")))
      .setButtonAccessory(button(owner, "season_claim", collected ? "Claimed" : ready ? "Claim" : "Locked",
        String(tier), ButtonStyle.Secondary, !ready));
    c.addSectionComponents(section);
  }
  c.addActionRowComponents(row([
    button(owner, "season", "◀", String(page - 1), ButtonStyle.Secondary, page === 1),
    button(owner, "season_claim_all", claimable > 0 && !ended ? "Claim all (" + claimable + ")" : "Nothing to claim",
      String(page), ButtonStyle.Primary, claimable < 1 || ended),
    button(owner, "season", "▶", String(page + 1), ButtonStyle.Secondary, page === total),
    button(owner, "profile", "Home")
  ]));
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0, 300) + "**"));
  return c;
}

function market(owner, rows) {
  const listed = rows.slice(0, 8);
  const c = container("ARVEE IDLE  /  PLAYER EXCHANGE",
    "Trade valuable supplies and rare finds with other adventurers.");
  c.addTextDisplayComponents(text("### ACTIVE LISTINGS  ·  " + rows.length +
    "\n" + (listed.length ? listed.map((r) =>
      "#" + r.id + "  **" +
      (items[r.item_id]?.name || r.item_id) + "** ×" + r.quantity +
      "\n     " + pretty(r.price) + " IC   ·   Seller <@" + r.seller_id + ">"
    ).join("\n\n") : "**No listings yet.**\nBe the first to put an item up for sale using /idle market sell.")));
  if (listed.length) c.addActionRowComponents(selector(owner, "listing_select", "", "Inspect a trade...",
    listed.map((r) => ({
      label: ("#" + r.id + " " + (items[r.item_id]?.name || r.item_id)).slice(0, 100),
      description: pretty(r.price) + " IC  ·  ×" + r.quantity,
      value: String(r.id)
    }))));
  c.addActionRowComponents(row([
    button(owner, "market", "↻ Refresh", "", ButtonStyle.Primary),
    button(owner, "inventory", "Satchel"),
    button(owner, "profile", "Command Center")
  ]));
  foot(c, "To sell an item, use **/idle market sell**.");
  return c;
}

function listing(owner, l) {
  const c = container("Listing #" + l.id, (items[l.item_id]?.name || l.item_id) + " × " + l.quantity);
  divider(c);
  foot(c, "**Price**  " + pretty(l.price) + " IC\n**Seller**  <@" + l.seller_id + ">");
  c.addActionRowComponents(row([
    button(owner, "listing_buy", "Purchase", String(l.id), ButtonStyle.Secondary, owner === l.seller_id),
    button(owner, "listing_cancel", "Cancel listing", String(l.id), ButtonStyle.Danger, owner !== l.seller_id),
    button(owner, "market", "Back")
  ]));
  return c;
}
function prestige(owner, p) {
  const eligible = p.balance.gte(PRESTIGE_REQUIREMENT);
  const c = container("Prestige", "Reset your IC and generators to gain permanent production power.", WARN);
  divider(c);
  foot(c, "**Your IC**  " + pretty(p.balance) + " / " + pretty(PRESTIGE_REQUIREMENT) +
    "\n**Current level**  " + p.prestige + "\n**Next level**  " + (p.prestige + 1) +
    "\n**Permanent production**  +" + ((p.prestige + 1) * 25) + "%");
  c.addActionRowComponents(row([
    button(owner, "prestige_confirm", "Confirm prestige", "", ButtonStyle.Danger, !eligible),
    button(owner, "profile", "Cancel")
  ]));
  return c;
}
function pickaxe(owner, p) {
  const tier = p.pickaxeTier || 0;
  const max = tier >= 10;
  const requirements = [
    { id: "ore", amount: 8 * (tier + 1) },
    { id: "silver", amount: 2 * (tier + 1) },
    ...(tier >= 3 ? [{ id: "gold", amount: Math.ceil(tier / 2) }] : [])
  ];
  const owned = (id) => p.inventory?.find((entry) => entry.item_id === id)?.quantity || 0;
  const ready = !max && requirements.every(({ id, amount }) => owned(id) >= amount);
  const c = container("ARVEE IDLE  /  PICKAXE", "Craft stronger mining equipment with your collected materials.");
  divider(c);
  c.addTextDisplayComponents(text("**Pickaxe tier**  " + tier + " / 10  ·  **Mining XP**  " + p.mineXp +
    "\n**Mining multiplier**  " + (1 + tier * 0.25).toFixed(2) + "×" +
    "\n**Next tier**  " + (max ? "Maximum reached" : tier + 1)));
  divider(c);
  if (max) {
    c.addTextDisplayComponents(text("### MAXIMUM TIER UNLOCKED\nYour pickaxe is fully upgraded."));
  } else {
    c.addTextDisplayComponents(text("### REQUIRED MATERIALS\n" + requirements.map(({ id, amount }) =>
      (owned(id) >= amount ? "✓ " : "· ") + "**" + items[id].name + "**  " + owned(id) + " / " + amount
    ).join("\n") + "\n\n" + (ready ? "**Ready to upgrade!**" : "Gather the remaining materials by mining and opening supply caches.")));
  }
  c.addActionRowComponents(row([
    button(owner, "pickaxe_upgrade", max ? "Max tier" : ready ? "Upgrade pickaxe" : "Need materials",
      "", ButtonStyle.Primary, !ready),
    button(owner, "perks", "Runes & perks"),
    button(owner, "mine", "Mine"),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function perks(owner, p, defs) {
  const fragments = p.inventory?.find((r) => r.item_id === "pickperk")?.quantity || 0;
  const equipped = p.perks?.length || 0;
  const c = container("ARVEE IDLE  /  RUNIC TALENTS",
    "Spend Rune Fragments on lasting mining abilities. Choose up to 3 different talents.");
  c.addTextDisplayComponents(text("**Rune Fragments:** " + fragments + "  ·  **Talents:** " + equipped + " / 3"));
  divider(c);
  c.addTextDisplayComponents(text(Object.entries(defs).map(([id, def]) => {
    const level = p.perks?.find((x) => x.perk_id === id)?.level || 0;
    return (level > 0 ? "◆" : "◇") + " **" + def.name + "**  " + level + " / " + def.max +
      "\n   " + def.description;
  }).join("\n\n")));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "perk_select")).setPlaceholder(fragments ? "Choose a runic talent to upgrade" : "Collect Rune Fragments to upgrade")
    .setDisabled(fragments < 1)
    .addOptions(Object.entries(defs).map(([id, def]) => ({
      label: def.name, value: id, description: ("1 fragment · " + def.description).slice(0, 100)
    })))));
  c.addActionRowComponents(row([
    button(owner, "pickaxe", "◀ Pickaxe", "", ButtonStyle.Primary),
    button(owner, "perk_respec", "Reset talents", "", ButtonStyle.Secondary, equipped < 1),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function perkRespec(owner) {
  const c = container("Respec pickaxe perks", "Remove every unlocked perk. Levels and consumed tokens are not refunded.", WARN);
  divider(c);
  foot(c, "**Cost**  5× Void Essence. Your pickaxe tier and XP are preserved.");
  c.addActionRowComponents(row([
    button(owner, "perk_respec_confirm", "Confirm respec", "", ButtonStyle.Danger),
    button(owner, "perks", "Keep my perks")
  ]));
  return c;
}
function stats(owner, p) {
  const c = container("ARVEE Idle Achievements", "Player achievements and lifetime activity in the current season.");
  divider(c);
  foot(c, p.achievements.map((a) => (a.achieved ? "✓" : "·") + " **" + a.name + "** · " + a.goal).join("\n"));
  divider(c);
  const n = (type) => p.counts[type] || 0;
  foot(c, "**Mines**  " + n("mine") + "   ·   **Crafts**  " + n("craft") + "   ·   **Purchases**  " + n("generator_purchase") +
    "\n**Marketplace sales**  " + n("market_sell") + "   ·   **Prestiges**  " + p.prestige);
  c.addActionRowComponents(row([
    button(owner, "stats", "↻ Refresh", "", ButtonStyle.Primary),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function leaderboard(owner, rows) {
  const c = container("ARVEE Idle Leaderboard", "Ranked by lifetime IC earned this prestige.");
  divider(c);
  foot(c, rows.length ? rows.map((r, i) => "**" + (i + 1) + ".** <@" + r.user_id + "> · " + pretty(r.total_earned) + " IC · P" + r.prestige).join("\n") : "No players yet.");
  c.addActionRowComponents(row([button(owner, "leaderboard", "↻ Refresh"), button(owner, "profile", "Command Center")]));
  return c;
}
function help(owner) {
  const c = container("✦ WELCOME TO ARVEE IDLE", "Begin with your starter wallet, quick mining, and your first operation.");
  divider(c);
  foot(c, "**START** · /idle daily → /idle mine → /idle shop\n**Grow** · /idle shop, /idle buy, /idle profile\n**Explore** · /idle mine, /idle pickaxe, /idle daily\n**Collect** · /idle inventory, /idle open, /idle craft, /idle use\n**Trade** · /idle give, /idle market\n**Compete** · /idle leaderboard, /idle prestige\n\nUse the buttons below to navigate without typing commands.");
  c.addActionRowComponents(row([
    button(owner, "profile", "Dashboard", "", ButtonStyle.Primary),
    button(owner, "shop", "Shop"),
    button(owner, "mine", "Mine"),
    button(owner, "inventory", "Inventory")
  ]));
  return c;
}
function payload(view) {
  return { components: [view], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}
module.exports = {
  custom, button, category, listState, parseListState, craftState, parseCraftState, shopFilters, inventoryFilters, expeditionMap, expeditionRegion, expeditionGear, companionCollection, preferences, challengeBoard, message, home, shop, generator, inventory, item, crafting, recipe, season, market, listing,
  prestige, pickaxe, perks, perkRespec, stats, leaderboard, help, payload, miningResult, dailyResult, craftingResult, cacheResult, SUCCESS, WARN, ERROR
};
