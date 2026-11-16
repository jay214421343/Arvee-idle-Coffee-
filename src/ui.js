"use strict";
const {
  ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder,
  ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, MessageFlags, escapeMarkdown
} = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { pretty, dec, purchaseCost, PRESTIGE_REQUIREMENT } = require("./economy");

const ACCENT = 0xA67B5B;
const SUCCESS = 0x4A9169;
const WARN = 0xCC8941;
const ERROR = 0xC95B5B;
const LIMIT = 8;
function custom(owner, action, arg = "") {
  if (!/^[0-9]{15,22}$/.test(String(owner)) || !/^[a-z_]+$/.test(action) || !/^[a-zA-Z0-9_]*$/.test(String(arg))) {
    throw new Error("Invalid UI identifier");
  }
  const id = ["cf", "1", owner, action, arg].join(":");
  if (id.length > 100) throw new Error("UI identifier exceeds Discord limit");
  return id;
}
function button(owner, action, label, arg = "", style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder().setCustomId(custom(owner, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled);
}
function row(buttons) { return new ActionRowBuilder().addComponents(...buttons); }
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
  const c = container("☕ Coffee  /  Player Dashboard", "Your idle empire, all in one place.");
  divider(c);
  const s = new SectionBuilder().addTextDisplayComponents(
    text("### " + escapeMarkdown(user.username).slice(0, 80) + "\n**" + pretty(p.balance) + " BP**  ·  +" + pretty(p.rate) + " BP/s"),
    text("**Prestige**  " + p.prestige + "   ·   **Mining XP**  " + p.mineXp + "\n**Lifetime BP**  " + pretty(p.totalEarned) + "   ·   **Generators**  " + p.generators.reduce((n, g) => n + g.quantity, 0))
  );
  s.setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ extension: "png", size: 128 })).setDescription("Player avatar"));
  c.addSectionComponents(s);
  divider(c);
  c.addActionRowComponents(row([
    button(owner, "mine", "⛏ Mine", "", ButtonStyle.Primary),
    button(owner, "daily", "🎁 Daily", "", ButtonStyle.Success),
    button(owner, "shop", "🛍 Shop"),
    button(owner, "inventory", "🎒 Inventory")
  ]));
  c.addActionRowComponents(row([
    button(owner, "market", "💱 Market"),
    button(owner, "pickaxe", "⛏ Pickaxe"),
    button(owner, "craft", "🛠 Craft"),
    button(owner, "stats", "🏅 Stats"),
    button(owner, "profile", "↻ Refresh")
  ]));
  return c;
}
function shop(owner, page = 1) {
  const total = Math.max(1, Math.ceil(generators.length / LIMIT));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const entries = generators.slice((page - 1) * LIMIT, page * LIMIT);
  const c = container("🛍 Coffee Shop", "Buy generators to earn BP automatically. Prices rise as you own more.");
  divider(c);
  c.addTextDisplayComponents(text(entries.map((g) => "**" + g.id + "** · " + g.name + "\n" + pretty(g.cost) + " BP · +" + pretty(g.income) + " BP/s").join("\n\n")));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "generator_select", String(page)))
    .setPlaceholder("Choose a generator to buy")
    .addOptions(entries.map((g) => ({ label: g.name.slice(0, 100), description: g.id + " · " + pretty(g.cost) + " BP", value: g.id })))));
  c.addActionRowComponents(row([
    button(owner, "shop", "◀ Previous", String(page - 1), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Dashboard"),
    button(owner, "shop", "Next ▶", String(page + 1), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "Page " + page + " / " + total + "  ·  " + generators.length + " original Coffee generators");
  return c;
}
function generator(owner, id, page, p, note = "") {
  const g = byId.get(id);
  if (!g) throw new Error("Unknown generator.");
  const owned = p.generators.find((row) => row.generator_id === id)?.quantity || 0;
  const c = container("🛒 " + g.name, g.description || "An idle BP generator.");
  divider(c);
  c.addTextDisplayComponents(text("**Owned**  " + owned + "  ·  **Income/unit**  +" + pretty(g.income) +
    " BP/s\n**Buy 1**  " + pretty(purchaseCost(g.cost, owned, 1)) + " BP" +
    "\n**Buy 10**  " + pretty(purchaseCost(g.cost, owned, 10)) + " BP" +
    "\n**Balance**  " + pretty(p.balance) + " BP"));
  if (note) foot(c, "✅ " + note);
  c.addActionRowComponents(row([
    button(owner, "buy_one", "Buy 1", id, ButtonStyle.Primary, owned + 1 > 10000),
    button(owner, "buy_ten", "Buy 10", id, ButtonStyle.Success, owned + 10 > 10000),
    button(owner, "shop", "Back to shop", String(page)),
    button(owner, "profile", "Dashboard")
  ]));
  return c;
}
function inventory(owner, p, page = 1) {
  const total = Math.max(1, Math.ceil(p.inventory.length / LIMIT));
  page = Math.max(1, Math.min(total, Number(page) || 1));
  const entries = p.inventory.slice((page - 1) * LIMIT, page * LIMIT);
  const c = container("🎒 Your Inventory", p.inventory.length + " distinct item types · select an item for details.");
  divider(c);
  foot(c, entries.length ? entries.map((e) => (items[e.item_id]?.emoji || "▪") + "  **" + (items[e.item_id]?.name || e.item_id) + "**  ×" + e.quantity).join("\n") : "Your inventory is empty. Mine or claim your daily reward!");
  if (entries.length) c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "item_select", String(page))).setPlaceholder("Inspect an item")
    .addOptions(entries.map((e) => ({ label: (items[e.item_id]?.name || e.item_id).slice(0, 100), value: e.item_id })))));
  c.addActionRowComponents(row([
    button(owner, "inventory", "◀ Previous", String(page - 1), ButtonStyle.Secondary, page === 1),
    button(owner, "profile", "Dashboard"),
    button(owner, "inventory", "Next ▶", String(page + 1), ButtonStyle.Secondary, page === total)
  ]));
  foot(c, "Page " + page + " / " + total);
  return c;
}
function item(owner, id, quantity, page = 1) {
  const entry = items[id]; if (!entry) throw new Error("Unknown item.");
  const c = container((entry.emoji || "📦") + " " + entry.name, entry.description || "A collectible item.");
  divider(c);
  foot(c, "**Owned**  " + quantity + "   ·   **Rarity**  " + (entry.rarity || "Common") +
    "\n" + (entry.use ? "**Use:** " + entry.use : "") +
    (recipes[id] ? "\n**Recipe:** " + Object.entries(recipes[id]).map(([part, q]) => q + "× " + items[part].name).join(", ") : ""));
  c.addActionRowComponents(row([
    button(owner, ["lootbox", "rare_lootbox", "legendary_lootbox"].includes(id) ? "open_one" : "use_item",
      ["lootbox", "rare_lootbox", "legendary_lootbox"].includes(id) ? "Open 1" : "Use item",
      id, ButtonStyle.Primary, (!entry.effect && !["lootbox", "rare_lootbox", "legendary_lootbox"].includes(id)) || quantity < 1),
    button(owner, "inventory", "Back", String(page)),
    button(owner, "profile", "Dashboard")
  ]));
  return c;
}
function crafting(owner) {
  const c = container("🛠 Crafting Workshop", "Turn mining resources into useful items. Everything is crafted atomically.");
  divider(c);
  foot(c, Object.entries(recipes).map(([id, ingredients]) => "**" + (items[id]?.name || id) + "**\n" +
    Object.entries(ingredients).map(([k, v]) => v + "× " + items[k].name).join(" · ")).join("\n\n"));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "recipe_select")).setPlaceholder("Choose a recipe")
    .addOptions(Object.keys(recipes).map((id) => ({ label: items[id].name, value: id })))));
  c.addActionRowComponents(row([button(owner, "inventory", "Inventory"), button(owner, "profile", "Dashboard")]));
  return c;
}
function recipe(owner, id) {
  if (!recipes[id]) throw new Error("Unknown recipe");
  const c = container("🛠 Craft " + items[id].name, "Resources required per item:");
  divider(c);
  foot(c, Object.entries(recipes[id]).map(([part, amount]) => "• " + amount + " × " + items[part].name).join("\n"));
  c.addActionRowComponents(row([
    button(owner, "craft_one", "Craft 1", id, ButtonStyle.Primary),
    button(owner, "craft_five", "Craft 5", id, ButtonStyle.Success),
    button(owner, "craft", "Back")
  ]));
  return c;
}
function market(owner, rows) {
  const c = container("💱 Coffee Marketplace", "Discover player listings. Buy or cancel listings using the selector.");
  divider(c);
  foot(c, rows.length ? rows.map((r) => "**#" + r.id + "**  ·  " + r.quantity + "× " + (items[r.item_id]?.name || r.item_id) +
    "  ·  " + pretty(r.price) + " BP").join("\n") : "There are no active listings yet.");
  if (rows.length) c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "listing_select")).setPlaceholder("Choose a listing")
    .addOptions(rows.map((r) => ({ label: ("#" + r.id + " · " + (items[r.item_id]?.name || r.item_id)).slice(0, 100),
      description: pretty(r.price) + " BP · Quantity " + r.quantity, value: String(r.id) })))));
  c.addActionRowComponents(row([button(owner, "market", "↻ Refresh", "", ButtonStyle.Primary), button(owner, "profile", "Dashboard")]));
  return c;
}
function listing(owner, l) {
  const c = container("💱 Listing #" + l.id, (items[l.item_id]?.name || l.item_id) + " × " + l.quantity);
  divider(c);
  foot(c, "**Price**  " + pretty(l.price) + " BP\n**Seller**  <@" + l.seller_id + ">");
  c.addActionRowComponents(row([
    button(owner, "listing_buy", "Purchase", String(l.id), ButtonStyle.Success, owner === l.seller_id),
    button(owner, "listing_cancel", "Cancel listing", String(l.id), ButtonStyle.Danger, owner !== l.seller_id),
    button(owner, "market", "Back")
  ]));
  return c;
}
function prestige(owner, p) {
  const eligible = p.balance.gte(PRESTIGE_REQUIREMENT);
  const c = container("🌟 Prestige", "Reset your BP and generators to gain permanent production power.", WARN);
  divider(c);
  foot(c, "**Your BP**  " + pretty(p.balance) + " / " + pretty(PRESTIGE_REQUIREMENT) +
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
  const c = container("⛏ Coffee Pickaxe", "Upgrade your pickaxe using minerals. Higher tiers improve your mining rewards.");
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
    button(owner, "profile", "Dashboard")
  ]));
  return c;
}
function perks(owner, p, defs) {
  const c = container("✨ Pickaxe Perks", "Unlock perks using Pickperk tokens, found in higher-tier lootboxes.");
  divider(c);
  foot(c, Object.entries(defs).map(([id, d]) => "**" + d.name + "** · " + (p.perks?.find((x) => x.perk_id === id)?.level || 0) + " / " + d.max +
    "\n" + d.description).join("\n\n"));
  c.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId(custom(owner, "perk_select")).setPlaceholder("Upgrade a perk (costs 1 token)")
    .addOptions(Object.entries(defs).map(([id, d]) => ({ label: d.name, value: id, description: d.description.slice(0, 100) })))));
  c.addActionRowComponents(row([
    button(owner, "pickaxe", "Back to pickaxe"),
    button(owner, "perk_respec", "Respec perks", "", ButtonStyle.Danger, !p.perks?.length),
    button(owner, "profile", "Dashboard")
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
  const c = container("🏅 Coffee Achievements", "Player achievements and lifetime activity in the current season.");
  divider(c);
  foot(c, p.achievements.map((a) => (a.achieved ? "✅" : "▫") + " **" + a.name + "** · " + a.goal).join("\n"));
  divider(c);
  const n = (type) => p.counts[type] || 0;
  foot(c, "**Mines**  " + n("mine") + "   ·   **Crafts**  " + n("craft") + "   ·   **Purchases**  " + n("generator_purchase") +
    "\n**Marketplace sales**  " + n("market_sell") + "   ·   **Prestiges**  " + p.prestige);
  c.addActionRowComponents(row([
    button(owner, "stats", "↻ Refresh", "", ButtonStyle.Primary),
    button(owner, "profile", "Dashboard")
  ]));
  return c;
}
function leaderboard(owner, rows) {
  const c = container("🏆 Coffee Leaderboard", "Ranked by lifetime BP earned this prestige.");
  divider(c);
  foot(c, rows.length ? rows.map((r, i) => "**" + (i + 1) + ".** <@" + r.user_id + "> · " + pretty(r.total_earned) + " BP · P" + r.prestige).join("\n") : "No players yet.");
  c.addActionRowComponents(row([button(owner, "leaderboard", "↻ Refresh"), button(owner, "profile", "Dashboard")]));
  return c;
}
function help(owner) {
  const c = container("☕ Welcome to Coffee", "The idle economy game built for Discord.");
  divider(c);
  foot(c, "**Grow** · /coffee shop, /coffee buy, /coffee profile\n**Explore** · /coffee mine, /coffee pickaxe, /coffee daily\n**Collect** · /coffee inventory, /coffee open, /coffee craft, /coffee use\n**Trade** · /coffee give, /coffee market\n**Compete** · /coffee leaderboard, /coffee prestige\n\nUse the buttons below to navigate without typing commands.");
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
  custom, button, message, home, shop, generator, inventory, item, crafting, recipe, market, listing,
  prestige, pickaxe, perks, perkRespec, stats, leaderboard, help, payload, SUCCESS, WARN, ERROR
};
