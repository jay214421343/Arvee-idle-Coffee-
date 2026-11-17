"use strict";
const {
  ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder,
  ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, MessageFlags, escapeMarkdown
} = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { pretty, dec, purchaseCost, PRESTIGE_REQUIREMENT, Decimal } = require("./economy");
const brand = require("./brand");

const ACCENT = brand.theme.primary;
const SUCCESS = brand.theme.success;
const WARN = brand.theme.warning;
const ERROR = brand.theme.error;
const LIMIT = 8;
const PAGE_SIZE = 4;
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
  return ({ Common: "⚪", Uncommon: "🟢", Rare: "🔵", Epic: "🟣", Legendary: "🟠" })[rarity] || "⚪";
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
  if (opts.buttons?.length) {
    divider(c);
    c.addActionRowComponents(row(opts.buttons));
  } else if (owner) {
    divider(c);
    c.addActionRowComponents(row([
      button(owner, "profile", "Profile", "", ButtonStyle.Primary),
      button(owner, "shop", "Shop"),
      button(owner, "inventory", "Inventory"),
      button(owner, "mine", "Mine")
    ]));
  }
  return c;
}
function home(owner, user, p) {
  const c = container("✦ ARVEE IDLE  /  COMMAND CENTER", "Your adventure continues even while you are away.");
  divider(c);
  const s = new SectionBuilder().addTextDisplayComponents(
    text("### " + escapeMarkdown(user.username).slice(0, 80) +
      "\n**" + pretty(p.balance) + " IC**  ·  +" + pretty(p.rate) + " IC/s"),
    text("**Prestige** " + p.prestige + "   ·   **Mining XP** " + p.mineXp +
      "\n**Lifetime earned** " + pretty(p.totalEarned) + " IC   ·   **Operations** " +
      p.generators.reduce((n, g) => n + g.quantity, 0))
  );
  s.setThumbnailAccessory(new ThumbnailBuilder()
    .setURL(user.displayAvatarURL({ extension: "png", size: 128 }))
    .setDescription("ARVEE Idle adventurer avatar"));
  c.addSectionComponents(s);
  divider(c);
  const progress = Math.max(0, Math.min(10, Decimal.min(p.balance.div(PRESTIGE_REQUIREMENT).times(10), 10).floor().toNumber()));
  foot(c, "**NEXT PRESTIGE**  " + "▰".repeat(progress) + "▱".repeat(10 - progress) +
    "  " + Math.floor(progress * 10) + "%\n" +
    "New here? Start with **Daily → Mine → Operations**. Rewards scale with your empire.");
  c.addActionRowComponents(row([
    button(owner, "mine", "Mine", "", ButtonStyle.Primary),
    button(owner, "daily", "Daily", "", ButtonStyle.Success),
    button(owner, "shop", "Operations"),
    button(owner, "inventory", "Inventory"),
    button(owner, "profile", "Refresh")
  ]));
  c.addActionRowComponents(row([
    button(owner, "market", "Exchange"),
    button(owner, "pickaxe", "Pickaxe"),
    button(owner, "craft", "Crafting"),
    button(owner, "stats", "Milestones"),
    linkButton("ARVEE World", brand.website)
  ]));
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
  const c = container("✦ ARVEE IDLE  /  OPERATIONS",
    "**Wallet** " + (p ? pretty(p.balance) + " IC" : "—") + "  ·  **Production** +" + (p ? pretty(p.rate) : "0") +
    " IC/s\nRecruit adventurers and build your empire.");
  if (!visible.length) c.addTextDisplayComponents(text("No operations match this filter yet. Choose All operations."));
  for (const g of visible) {
    const units = owned(g);
    const next = cost(g);
    c.addSectionComponents(entrySection(owner, "operation", g.id,
      (units ? "🟣 " : "⚔️ ") + g.name,
      "**" + pretty(next) + " IC** next  ·  +" + pretty(g.income) + " IC/s per unit\n" +
      (units ? "Owned: " + units : "Not recruited") + (p && p.balance.gte(next) ? "  ·  ✓ Affordable" : ""), "Details"));
  }
  c.addActionRowComponents(selector(owner, "shop_filter", sort, "Show: " + (filter === "all" ? "All operations" : filter),
    [{ label: "All operations", value: "all", default: filter === "all" },
      { label: "Affordable now", value: "affordable", default: filter === "affordable" },
      { label: "My operations", value: "owned", default: filter === "owned" }]));
  c.addActionRowComponents(selector(owner, "shop_sort", filter, "Sort: " + (sort === "price" ? "Lowest price" : "Highest income"),
    [{ label: "Lowest price", value: "price", default: sort === "price" },
      { label: "Highest income", value: "income", default: sort === "income" }]));
  c.addActionRowComponents(row([
    button(owner, "shop", "◀ Previous", listState(page - 1, filter, sort), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "shop", "Next ▶", listState(page + 1, filter, sort), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**Sector " + page + " / " + total + "**  ·  " + entries.length + " operations  ·  Select Details to recruit");
  return c;
}

function generator(owner, id, page, p, note = "") {
  const g = byId.get(id);
  if (!g) throw new Error("Unknown generator.");
  const owned = p.generators.find((row) => row.generator_id === id)?.quantity || 0;
  const c = container("⚔ " + g.name, g.description || "An ARVEE Idle expedition.");
  const oneCost = purchaseCost(g.cost, owned, 1);
  const tenCost = purchaseCost(g.cost, owned, 10);
  const hundredCost = purchaseCost(g.cost, owned, 100);
  divider(c);
  c.addTextDisplayComponents(text("**Owned**  " + owned + "  ·  **Income/unit**  +" + pretty(g.income) +
    " IC/s\n**Buy 1**  " + pretty(oneCost) + " IC" +
    "\n**Buy 10**  " + pretty(tenCost) + " IC" +
    "\n**Buy 100**  " + pretty(hundredCost) + " IC" +
    "\n**Wallet**  " + pretty(p.balance) + " IC"));
  if (note) foot(c, "✅ " + note);
  c.addActionRowComponents(row([
    button(owner, "buy_one", "Buy 1", id, ButtonStyle.Primary, owned + 1 > 10000 || p.balance.lt(oneCost)),
    button(owner, "buy_ten", "Buy 10", id, ButtonStyle.Success, owned + 10 > 10000 || p.balance.lt(tenCost)),
    button(owner, "buy_hundred", "Buy 100", id, ButtonStyle.Secondary, owned + 100 > 10000 || p.balance.lt(hundredCost)),
    button(owner, "shop", "Operations", String(page)),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function inventory(owner, p, page = 1, filter = "all", sort = "rarity") {
  if (!["all", "materials", "usable", "caches"].includes(filter)) filter = "all";
  if (!["rarity", "name", "quantity"].includes(sort)) sort = "rarity";
  let entries = p.inventory.filter((e) => e.quantity > 0 && (filter === "all" || category(e.item_id) === filter));
  entries = entries.sort((a, b) => {
    if (sort === "quantity") return b.quantity - a.quantity || a.item_id.localeCompare(b.item_id);
    if (sort === "name") return (items[a.item_id]?.name || a.item_id).localeCompare(items[b.item_id]?.name || b.item_id);
    return (SORT_RARITY[items[b.item_id]?.rarity] || 0) - (SORT_RARITY[items[a.item_id]?.rarity] || 0) ||
      (items[a.item_id]?.name || a.item_id).localeCompare(items[b.item_id]?.name || b.item_id);
  });
  const total = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const c = container("✦ ARVEE IDLE  /  INVENTORY", "**" + p.inventory.length +
    " item types** collected  ·  Filter and sort your collection.");
  if (!visible.length) c.addTextDisplayComponents(text("Nothing here yet. Claim /idle daily, mine for materials, or try another filter."));
  for (const e of visible) {
    const item = items[e.item_id];
    if (!item) continue;
    c.addSectionComponents(entrySection(owner, "item_view", e.item_id,
      (item.emoji || "📦") + "  " + item.name,
      rarityMark(item.rarity) + " " + item.rarity.toUpperCase() + "  ·  **Owned ×" + e.quantity + "**\n" +
      (item.description || "An ARVEE collectible.").slice(0, 100), "Inspect"));
  }
  c.addActionRowComponents(selector(owner, "inventory_filter", sort, "Filter: " + filter,
    [{ label: "All items", value: "all", default: filter === "all" },
      { label: "Materials", value: "materials", default: filter === "materials" },
      { label: "Consumables", value: "usable", default: filter === "usable" },
      { label: "Supply caches", value: "caches", default: filter === "caches" }]));
  c.addActionRowComponents(selector(owner, "inventory_sort", filter, "Sort: " + sort,
    [{ label: "Rarity (highest first)", value: "rarity", default: sort === "rarity" },
      { label: "Name (A-Z)", value: "name", default: sort === "name" },
      { label: "Quantity (highest first)", value: "quantity", default: sort === "quantity" }]));
  c.addActionRowComponents(row([
    button(owner, "inventory", "◀ Previous", listState(page - 1, filter, sort), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "inventory", "Next ▶", listState(page + 1, filter, sort), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**Page " + page + " / " + total + "**  ·  " + entries.length + " matching items  ·  Select Inspect for details");
  return c;
}

function item(owner, id, quantity, page = 1) {
  const entry = items[id]; if (!entry) throw new Error("Unknown item.");
  const canOpen = BOX_IDS.has(id);
  const accent = entry.rarity === "Legendary" ? 0xE6AA51 : entry.rarity === "Rare" ? 0x487AD8 : ACCENT;
  const c = container((entry.emoji || "📦") + "  " + entry.name.toUpperCase(),
    rarityMark(entry.rarity) + " **" + entry.rarity + "**  ·  **" + quantity + " owned**", accent);
  c.addTextDisplayComponents(text("### ITEM DETAILS\n" + entry.description +
    (entry.use ? "\n\n**Effect:** " + entry.use : "") +
    (recipes[id] ? "\n\n**Forging recipe:** " + Object.entries(recipes[id]).map(([part, q]) => q + "× " + items[part].name).join(", ") : "")));
  c.addActionRowComponents(row([
    button(owner, canOpen ? "open_one" : "use_item", canOpen ? "Open 1" : "Use item",
      id, ButtonStyle.Primary, (!entry.effect && !canOpen) || quantity < 1),
    button(owner, "inventory", "Collection", "1_all_rarity"),
    button(owner, "craft", "Forge", "1"),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}

function crafting(owner, p = null, page = 1) {
  const entries = Object.entries(recipes);
  const total = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const owned = (id) => p?.inventory.find((e) => e.item_id === id)?.quantity || 0;
  const c = container("✦ ARVEE IDLE  /  FORGE", "Craft gear from materials found on expeditions.");
  for (const [id, ingredients] of visible) {
    const item = items[id];
    const canCraft = p && Object.entries(ingredients).every(([key, quantity]) => owned(key) >= quantity);
    c.addSectionComponents(entrySection(owner, "recipe_view", id,
      (item.emoji || "⚒️") + "  " + item.name,
      rarityMark(item.rarity) + " " + item.rarity + "  ·  " +
      Object.entries(ingredients).map(([key, quantity]) => quantity + "× " + items[key].name).join(", ").slice(0, 120) +
      "\n" + (canCraft ? "✓ Ready to forge" : "Requires materials"), "Recipe"));
  }
  c.addActionRowComponents(row([
    button(owner, "craft", "◀ Previous", String(page - 1), ButtonStyle.Secondary, page === 1),
    button(owner, "inventory", "Inventory"),
    button(owner, "profile", "Command Center", "", ButtonStyle.Primary),
    button(owner, "craft", "Next ▶", String(page + 1), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "**Recipes " + page + "/" + total + "**  ·  Select Recipe to view full requirements");
  return c;
}
function recipe(owner, id, p = null) {
  if (!recipes[id]) throw new Error("Unknown recipe.");
  const item = items[id];
  const owns = (key) => p?.inventory.find((x) => x.item_id === key)?.quantity || 0;
  const craftable = p ? Math.min(...Object.entries(recipes[id]).map(([key, quantity]) => Math.floor(owns(key) / quantity))) : null;
  const c = container((item.emoji || "⚒️") + "  " + item.name.toUpperCase(),
    rarityMark(item.rarity) + " **" + item.rarity + "**  ·  " + item.description);
  c.addTextDisplayComponents(text("### FORGING MATERIALS\n" +
    Object.entries(recipes[id]).map(([key, quantity]) =>
      (p && owns(key) >= quantity ? "✅ " : "▫️ ") + "**" + items[key].name + "**  " + (p ? owns(key) + " / " : "") + quantity).join("\n") +
    "\n\n**You can craft:** " + (craftable ?? "Check inventory")));
  c.addActionRowComponents(row([
    button(owner, "craft_one", "Forge 1", id, ButtonStyle.Primary, craftable !== null && craftable < 1),
    button(owner, "craft_five", "Forge 5", id, ButtonStyle.Success, craftable !== null && craftable < 5),
    button(owner, "craft", "All recipes", "1"),
    button(owner, "inventory", "Inventory")
  ]));
  return c;
}

function market(owner, rows) {
  const c = container("💱 ARVEE Idle Exchange", "Discover player listings. Buy or cancel listings using the selector.");
  divider(c);
  foot(c, rows.length ? rows.map((r) => "**#" + r.id + "**  ·  " + r.quantity + "× " + (items[r.item_id]?.name || r.item_id) +
    "  ·  " + pretty(r.price) + " IC").join("\n") : "There are no active listings yet.");
  if (rows.length) c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "listing_select")).setPlaceholder("Choose a listing")
    .addOptions(rows.map((r) => ({ label: ("#" + r.id + " · " + (items[r.item_id]?.name || r.item_id)).slice(0, 100),
      description: pretty(r.price) + " IC · Quantity " + r.quantity, value: String(r.id) })))));
  c.addActionRowComponents(row([button(owner, "market", "↻ Refresh", "", ButtonStyle.Primary), button(owner, "profile", "Command Center")]));
  return c;
}
function listing(owner, l) {
  const c = container("💱 Listing #" + l.id, (items[l.item_id]?.name || l.item_id) + " × " + l.quantity);
  divider(c);
  foot(c, "**Price**  " + pretty(l.price) + " IC\n**Seller**  <@" + l.seller_id + ">");
  c.addActionRowComponents(row([
    button(owner, "listing_buy", "Purchase", String(l.id), ButtonStyle.Success, owner === l.seller_id),
    button(owner, "listing_cancel", "Cancel listing", String(l.id), ButtonStyle.Danger, owner !== l.seller_id),
    button(owner, "market", "Back")
  ]));
  return c;
}
function prestige(owner, p) {
  const eligible = p.balance.gte(PRESTIGE_REQUIREMENT);
  const c = container("🌟 Prestige", "Reset your IC and generators to gain permanent production power.", WARN);
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
  const c = container("⛏ ARVEE Idle Pickaxe", "Upgrade your pickaxe using minerals. Higher tiers improve your mining rewards.");
  divider(c);
  foot(c, "**Tier**  " + tier + " / 10   ·   **Mining XP**  " + p.mineXp +
    "\n**Reward multiplier**  " + (1 + tier * 0.25).toFixed(2) + "×" +
    "\n**Upgrade cost**  " + (20 * (tier + 1)) + " Ore + " + (5 * (tier + 1)) + " Silver" +
    (tier >= 2 ? " + " + tier + " Gold" : "") +
    "\n**Perks**  " + (p.perks?.length ? p.perks.map((r) => r.perk_id + " Lv." + r.level).join(", ") : "None yet"));
  c.addActionRowComponents(row([
    button(owner, "pickaxe_upgrade", "Upgrade", "", ButtonStyle.Primary, tier >= 10),
    button(owner, "perks", "Manage perks"),
    button(owner, "mine", "Mine"),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function perks(owner, p, defs) {
  const c = container("✨ Pickaxe Perks", "Unlock perks using Rune Fragments, found in high-tier supply caches.");
  divider(c);
  foot(c, Object.entries(defs).map(([id, d]) => "**" + d.name + "** · " + (p.perks?.find((x) => x.perk_id === id)?.level || 0) + " / " + d.max +
    "\n" + d.description).join("\n\n"));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "perk_select")).setPlaceholder("Upgrade a perk (costs 1 token)")
    .addOptions(Object.entries(defs).map(([id, d]) => ({ label: d.name, value: id, description: d.description.slice(0, 100) })))));
  c.addActionRowComponents(row([
    button(owner, "pickaxe", "Back to pickaxe"),
    button(owner, "perk_respec", "Respec perks", "", ButtonStyle.Danger, !p.perks?.length),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function perkRespec(owner) {
  const c = container("⚠ Respec pickaxe perks", "Remove every unlocked perk. Levels and consumed tokens are not refunded.", WARN);
  divider(c);
  foot(c, "**Cost**  5× Strange Matter. Your pickaxe tier and XP are preserved.");
  c.addActionRowComponents(row([
    button(owner, "perk_respec_confirm", "Confirm respec", "", ButtonStyle.Danger),
    button(owner, "perks", "Keep my perks")
  ]));
  return c;
}
function stats(owner, p) {
  const c = container("🏅 ARVEE Idle Achievements", "Player achievements and lifetime activity in the current season.");
  divider(c);
  foot(c, p.achievements.map((a) => (a.achieved ? "✅" : "▫") + " **" + a.name + "** · " + a.goal).join("\n"));
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
  const c = container("🏆 ARVEE Idle Leaderboard", "Ranked by lifetime IC earned this prestige.");
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
  custom, button, category, listState, parseListState, message, home, shop, generator, inventory, item, crafting, recipe, market, listing,
  prestige, pickaxe, perks, perkRespec, stats, leaderboard, help, payload, SUCCESS, WARN, ERROR
};
