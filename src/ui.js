"use strict";
const {
  ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder,
  ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, MessageFlags, escapeMarkdown
} = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { itemArt, pickaxeArt } = require("./item-art");
const { pretty, dec, purchaseCost, maxAffordable, PRESTIGE_REQUIREMENT, Decimal } = require("./economy");
const brand = require("./brand");
const challengeData = require("./challenges");
const exploration = require("./exploration");
const companions = require("./companions");
const activity = require("./activity");
const progression = require("./progression");
const guilds = require("./guilds");
const { SEASON, rewards, missions, label, tierNeeded } = require("./season");

const ACCENT = brand.theme.primary;
const SUCCESS = brand.theme.success;
const WARN = brand.theme.warning;
const ERROR = brand.theme.error;
const LIMIT = 8;
const PAGE_SIZE = 4;
const INVENTORY_PAGE_SIZE = 8;
const SORT_RARITY = Object.freeze({ Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 });
const BOX_IDS = new Set(["lootbox", "rare_lootbox", "legendary_lootbox", "lunchbox"]);
function category(id) {
  if (BOX_IDS.has(id)) return "caches";
  if (items[id]?.effect || Object.hasOwn(companions.CHARMS,id) || Object.hasOwn(companions.EGG_TIERS,id)) return "usable";
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

const NAVIGATION = Object.freeze([
  { label: "Operations", value: "shop", description: "Passive income and recruitment" },
  { label: "Satchel", value: "inventory", description: "Items, materials and caches" },
  { label: "Adventure", value: "adventure_menu", description: "World Map, boss, pets and gear" },
  { label: "Guilds", value: "guild", description: "Your global guild and team goals" },
  { label: "Progress", value: "progress_menu", description: "Season, contracts, prestige and stats" },
  { label: "More", value: "more_menu", description: "Forge, exchange and settings" }
]);
const SECTION_OPTIONS = Object.freeze({
  adventure: Object.freeze([
    { label: "World Map", value: "explore", description: "Timed crew expeditions" },
    { label: "World Boss", value: "boss", description: "Shared weekly encounter" },
    { label: "Companions", value: "companions", description: "Equip and level your pet" },
    { label: "Expedition Gear", value: "equipment", description: "Upgrade your exploration kit" },
    { label: "Pickaxe & Runes", value: "pickaxe", description: "Mining upgrades and perks" }
  ]),
  progress: Object.freeze([
    { label: "Season Journey", value: "season", description: "Claim season tiers" },
    { label: "Contracts", value: "challenges", description: "Daily and weekly goals" },
    { label: "Prestige", value: "prestige", description: "Permanent income multiplier" },
    { label: "Milestones", value: "stats", description: "Achievements and records" },
    { label: "Leaderboard", value: "leaderboard", description: "Top Idle players" }
  ]),
  more: Object.freeze([
    { label: "Forge", value: "craft", description: "Craft with materials" },
    { label: "Exchange", value: "market", description: "Trade with players" },
    { label: "Preferences", value: "settings", description: "Saved browsing filters" },
    { label: "Field Guide", value: "help", description: "How to play" }
  ])
});
function navigation(owner) {
  return selector(owner, "navigate", "", "Explore ARVEE Idle", NAVIGATION);
}
function sectionMenu(owner, key) {
  const options = SECTION_OPTIONS[key];
  if (!options) throw new Error("Unknown navigation section.");
  const title = { adventure: "ADVENTURE", progress: "PROGRESS", more: "MORE" }[key];
  const c = container("ARVEE IDLE  /  " + title,
    "Choose an activity. Your progress is shared across all servers.");
  c.addActionRowComponents(selector(owner, "navigate", "", "Choose a destination", options));
  c.addActionRowComponents(row([button(owner, "profile", "Command Center", "", ButtonStyle.Primary)]));
  return c;
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
  const c = container("RECRUITMENT  /  FILTERS", "Choose what appears on your Operations board.");
  c.addTextDisplayComponents(text("**Current selection**  " +
    ({ all: "All operations", affordable: "Can recruit", owned: "My operations" }[filter] || "All expeditions") +
    "\nSorting: " + (sort === "income" ? "Highest income" : "Lowest cost")));
  divider(c);
  c.addActionRowComponents(row([
    choice(owner, "shop_filter_set", "All", "all_" + sort, filter === "all"),
    choice(owner, "shop_filter_set", "Affordable", "affordable_" + sort, filter === "affordable"),
    choice(owner, "shop_filter_set", "Owned", "owned_" + sort, filter === "owned")
  ]));
  c.addActionRowComponents(row([button(owner, "shop", "Back to operations", listState(page, filter, sort), ButtonStyle.Primary)]));
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
// Coffee-style narrative receipts display exact committed mining rewards and real cooldowns.
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
  const pickaxe = profile ?
    "**PICKAXE**  " + escapeMarkdown(profile.pickaxeName || "Pickaxe").slice(0, 24) +
      " · Tier " + (profile.pickaxeTier || 0) + " · " +
      pickaxeArt(profile.pickaxeStyle) + " " + (profile.pickaxeStyle || "Copper") : "";
  const charged = Number(profile?.mineBoostCharges || 0) > 0 ?
    "**ACTIVE BOOST**  " + escapeMarkdown(profile.mineBoostSource || "Food boost") +
      " · " + profile.mineBoostCharges + " digs left" : "";
  if (waiting) {
    return activityCard(owner, "MINING  /  RESTING", "MR. M. INER  /  THE PROSPECTOR",
      "The mountain can wait. Even a legendary pickaxe needs a break.",
      "**NEXT DIG**  " + retryTime(result.cooldown) +
      "\n**COOLDOWN**  " + countdown(result.cooldown) +
      (charged ? "\n" + charged : "") +
      (pickaxe ? "\n" + pickaxe : ""),
      [button(owner, "pickaxe", "View pickaxe", "", ButtonStyle.Primary),
       button(owner, "profile", "Command Center")],
      "Campfire Brew and selected tonics can reset or shorten mining cooldowns."
    );
  }
  const drop = items[result.drop], qty = result.dropQuantity || 1;
  const loot = drop ? itemArt(result.drop) + " " + drop.name : "Materials";
  const base = result.baseReward === undefined ? result.reward : result.baseReward;
  const bonus = result.bonusReward === undefined ? dec(0) : dec(result.bonusReward);
  const sources = Array.isArray(result.boostSources) ? result.boostSources : [];
  const spent = sources.length > 0 || bonus.gt(0);
  const chargeLeft = Number.isInteger(result.boostChargesLeft) ? result.boostChargesLeft : 0;
  const details = "*You swing your pickaxe with all your might. The stone finally gives way.*" +
    "\n\n**BASE MINING REWARD**  +" + pretty(base) + " IC" +
    (spent ? "\n**BOOST BONUS**  +" + pretty(bonus) + " IC" +
      (result.multiplier ? " · " + result.multiplier + "×" : "") +
      (sources.length ? "\n**FROM**  " + sources.map(s => escapeMarkdown(s)).join(" + ") : "") +
      "\n**REMAINING CHARGES**  " + chargeLeft : "") +
    "\n**TOTAL EARNED**  +" + pretty(result.reward) + " IC" +
    "\n\n**FOUND**  " + qty + "× " + loot +
    (result.box ? "\n1× " + itemArt("lootbox") + " Supply Cache (bonus)" : "") +
    "\n\n**MINING XP**  " + (result.mineXp ?? profile?.mineXp ?? 0) +
    (pickaxe ? "\n" + pickaxe : "");
  return activityCard(owner, "MINING  /  SUCCESS", "MR. M. INER  /  THE PROSPECTOR",
    "Dig deep. Bring something shiny back.", details,
    [button(owner, "pickaxe", "View pickaxe", "", ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "Mining bonuses consume charges only on successful digs."
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
function purchaseResult(owner, result) {
  return activityCard(owner, "OPERATIONS  /  RECRUITED", "THE RECRUITER",
    "Your crew grows. The work continues even while you're away.",
    "**RECRUITED**  " + result.quantity + "× " + escapeMarkdown(result.generator.name) +
    "\n**SPENT**  " + pretty(result.cost) + " IC" +
    "\n**WALLET**  " + pretty(result.balance) + " IC" +
    "\n**PASSIVE INCOME**  +" + pretty(result.rate) + " IC/s",
    [button(owner, "operation", "Recruit more", result.generator.id, ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "Operations produce Idle Credits passively across every server."
  );
}
function prestigeResult(owner, result) {
  return activityCard(owner, "PRESTIGE  /  COMPLETE", "THE CHRONICLER",
    "A new chapter begins with lasting strength.",
    "**PRESTIGE LEVEL**  " + result.prestige +
    "\n**PRODUCTION MULTIPLIER**  " + dec(result.multiplier).toString() + "×" +
    (result.bonusItemId ? "\n**LUCKY BONUS**  1× " + items[result.bonusItemId].name +
      " added to your Satchel" : "\n**LUCKY BONUS**  None this time") +
    "\nYour operation roster and wallet have reset; your permanent progress remains.",
    [button(owner, "shop", "Recruit operations", "", ButtonStyle.Primary),
     button(owner, "profile", "Command Center")],
    "Build your passive production again to reach your next prestige."
  );
}
function home(owner, user, p, readOnly = false) {
  const operations = p.generators.reduce((n, g) => n + g.quantity, 0);
  const c = container("✦ ARVEE IDLE  /  COMMAND CENTER",
    readOnly ? "PLAYER PROFILE  /  READ ONLY" : "THE ADVENTURE CONTINUES WHILE YOU'RE AWAY");
  const s = new SectionBuilder().addTextDisplayComponents(
    text("### " + escapeMarkdown(user.username).slice(0, 80) +
      (p.profileTag ? "\n*" + escapeMarkdown(p.profileTag).slice(0, 24) + "*" : "") + "\n**" +
      pretty(p.balance) + " IC**  ·  **+" + pretty(p.rate) + " IC/s**"),
    text("Crew " + operations + "   ·   Prestige " + p.prestige +
      "\nMining XP " + p.mineXp + "   ·   " + pretty(p.totalEarned) + " IC earned this run")
  ).setThumbnailAccessory(new ThumbnailBuilder()
    .setURL(user.displayAvatarURL({ extension: "png", size: 128 }))
    .setDescription("ARVEE Idle player avatar"));
  c.addSectionComponents(s);
  if (!readOnly) c.addActionRowComponents(navigation(owner));
  divider(c);
  const progress = progression.prestigeProgress(p);
  const progressText = "**PRESTIGE PROGRESS**  " + "▰".repeat(progress.filled) +
    "▱".repeat(10 - progress.filled) + "  " + progress.percent + "%\n" +
    (progress.ready ? "**Ready for prestige** · Review the reset before confirming." :
      "**To next prestige**  " + pretty(progress.remaining) + " IC");
  if (progress.ready && !readOnly) {
    c.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text(progressText))
      .setButtonAccessory(button(owner, "prestige", "Prestige", "", ButtonStyle.Primary)));
  } else {
    c.addTextDisplayComponents(text(progressText));
  }
  if (readOnly) {
    foot(c, "Viewing another player's public progress. Only your own character can perform actions.");
    c.addActionRowComponents(row([button(owner, "profile", "My Command Center", "", ButtonStyle.Primary)]));
    return c;
  }
  const ready = activity.playerReadiness(p);
  const displayReady = (state) => state.ready ? "Ready" : "<t:" + state.readyAt + ":R>";
  c.addTextDisplayComponents(text("**ACTIVITIES**  Mine " + displayReady(ready.mine) +
    "  ·  Daily " + displayReady(ready.daily) +
    (Number(p.mineBoostCharges || 0) > 0 ? "\n**MINING BOOST**  " +
      escapeMarkdown(p.mineBoostSource || "Food") + " · " + p.mineBoostCharges + " digs left" : "")));
  if (Number(p.passiveSeconds) >= 300 && dec(p.passiveEarned || 0).gt(0))
    c.addTextDisplayComponents(text("**PASSIVE INCOME SETTLED**  +" + pretty(p.passiveEarned) +
      " IC since your last saved activity (" + progression.elapsedLabel(p.passiveSeconds) + ")."));
  c.addActionRowComponents(row([
    button(owner, "mine", "Mine", "", ButtonStyle.Primary),
    button(owner, "daily", "Daily Reward"),
    button(owner, "shop", "Operations"),
    button(owner, "inventory", "Satchel")
  ]));
  foot(c, (progress.ready ? "" : "**NEXT STEP**  " + progression.nextStep(p, ready) + "\n") +
    "[ARVEE World](" + brand.website + ")");
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
  const c = container("ARVEE IDLE  /  OPERATIONS",
    "**" + (p ? pretty(p.balance) : "—") + " IC** in treasury  ·  **+" + (p ? pretty(p.rate) : "0") +
    " IC/s**\nRecruit units, expand your empire and earn while offline.");
  c.addSectionComponents(filterHeader(owner, "shop_filters", "RECRUITMENT BOARD",
    (filter === "owned" ? "Owned" : filter === "affordable" ? "Affordable" : "All operations") +
    "  ·  " + (sort === "income" ? "Highest income first" : "Lowest cost first"),
    listState(page, filter, sort)));
  c.addActionRowComponents(selector(owner, "shop_sort", filter, "Sort operations",
    [{ label: "Lowest cost", value: "price", default: sort === "price" },
      { label: "Highest IC per second", value: "income", default: sort === "income" }]));
  if (!visible.length) c.addTextDisplayComponents(text("No operations match this filter. Open Filters to view everything."));
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
  foot(c, "**SECTOR " + page + " / " + total + "**  ·  " + entries.length + " operations  ·  Filters are saved automatically");
  return c;
}

function generator(owner, id, page, p, note = "") {
  const g = byId.get(id);
  if (!g) throw new Error("Unknown generator.");
  const owned = p.generators.find((row) => row.generator_id === id)?.quantity || 0;
  const c = container(g.name, g.description || "An ARVEE Idle expedition.");
  const oneCost = purchaseCost(g.cost, owned, 1);
  const tenCost = purchaseCost(g.cost, owned, 10);
  const max = maxAffordable(g.cost, owned, p.balance);
  const maxCost = max ? purchaseCost(g.cost, owned, max) : null;
  divider(c);
  c.addTextDisplayComponents(text("**Owned**  " + owned + "  ·  **Income/unit**  +" + pretty(g.income) +
    " IC/s\n**Buy 1**  " + pretty(oneCost) + " IC" +
    "\n**Buy 10**  " + pretty(tenCost) + " IC" +
    "\n**Buy Max**  " + (maxCost ? max + " for " + pretty(maxCost) + " IC" : "Not affordable") +
    "\n**Wallet**  " + pretty(p.balance) + " IC" +
    (p.balance.lt(oneCost) && dec(p.rate).gt(0) ?
      "\n**NEXT OPERATION**  " + progression.affordabilityHint(oneCost, p.balance, p.rate) : "")));
  if (note) foot(c, note);
  c.addActionRowComponents(row([
    button(owner, "buy_one", "Buy 1", id, ButtonStyle.Primary, owned + 1 > 10000 || p.balance.lt(oneCost)),
    button(owner, "buy_ten", "Buy 10", id, ButtonStyle.Secondary, owned + 10 > 10000 || p.balance.lt(tenCost)),
    button(owner, "buy_max", "Buy Max" + (max ? " (" + max + ")" : ""), id, ButtonStyle.Secondary, !max),
    button(owner, "shop", "Back", String(page))
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

function inventoryPreview(owner, user, player) {
  const entries = (player.inventory || []).filter((r) => r.quantity > 0 && items[r.item_id])
    .sort((a, b) => items[a.item_id].name.localeCompare(items[b.item_id].name));
  const c = container("ARVEE IDLE  /  PLAYER SATCHEL",
    "**" + escapeMarkdown(user.username).slice(0, 80) + "** · Read-only collection" +
    "\n" + entries.length + " unique items. Use your own Satchel to manage items.");
  if (!entries.length) c.addTextDisplayComponents(text("This player has no items yet."));
  for (let i = 0; i < entries.length && i < 80; i += 16) {
    c.addTextDisplayComponents(text(entries.slice(i, i + 16).map((r) => {
      const item = items[r.item_id];
      return rarityMark(item.rarity) + "  " + escapeMarkdown(item.name) + "  ×" + r.quantity;
    }).join("\n")));
  }
  if (entries.length > 80) foot(c, "Showing 80 of " + entries.length + " unique items.");
  c.addActionRowComponents(row([button(owner, "profile", "My Command Center", "", ButtonStyle.Primary)]));
  return c;
}

const CUSTOM_PRESETS = Object.freeze({
  nametag: ["Moonshard", "Sunbreaker", "Cinderpick"],
  tag: ["Trailblazer", "ARVEE Veteran", "Astral Cartographer"]
});
function customization(owner, id) {
  const names = CUSTOM_PRESETS[id];
  if (!names) throw new Error("This item has no naming options.");
  const c = container("ARVEE IDLE  /  CUSTOMIZE", "Choose a name below, or use /idle use item:" + id + " name:YourName");
  c.addActionRowComponents(selector(owner,"customize_set",id,"Choose a name",
    names.map((name)=>({label:name,value:name}))));
  c.addActionRowComponents(row([button(owner,"inventory","Back to Satchel","1_all_rarity",ButtonStyle.Primary)]));
  return c;
}
function item(owner, id, quantity, back = "1_all_rarity") {
  const entry = items[id]; if (!entry) throw new Error("Unknown item.");
  const canOpen = BOX_IDS.has(id);
  const canHatch = Object.hasOwn(companions.EGG_TIERS,id);
  const canEquip = Object.hasOwn(companions.CHARMS,id);
  const c = container(itemArt(id) + "  " + entry.name.toUpperCase(),
    rarityMark(entry.rarity) + " **" + entry.rarity + "**   ·   **×" + quantity + " owned**");
  divider(c);
  c.addTextDisplayComponents(text("### FIELD NOTES\n" + entry.description +
    (entry.use ? "\n\n**Effect**  " + entry.use : "") +
    (recipes[id] ? "\n\n**Forge recipe**  " + Object.entries(recipes[id]).map(([part, q]) => q + "× " + items[part].name).join(" · ") : "")));
  c.addActionRowComponents(row([
    button(owner, canOpen ? "open_one" : canHatch ? "companion_eggs" : canEquip ? "companion_mastery" :
      (CUSTOM_PRESETS[id] ? "customize" : "use_item"),
      canOpen ? "Open cache" : canHatch ? "Hatch egg" : canEquip ? "Equip charm" :
      (CUSTOM_PRESETS[id] ? "Customize" : "Use item"),
      id, ButtonStyle.Secondary, (!entry.effect && !canOpen && !canHatch && !canEquip) || quantity < 1),
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
    "**" + state.owned.length + " / " + companions.PETS.length +
    " discovered**  ·  **" + state.eggs + " eggs**\n" +
    "One active companion supports your chosen build. No feeding or paid upgrades.");
  if (selected) {
    const next = selected.level === companions.MAX_LEVEL ? companions.MAX_XP : selected.nextXp;
    const progress = next === selected.startXp ? 10 :
      Math.floor(10 * (selected.xp - selected.startXp) / (next - selected.startXp));
    c.addTextDisplayComponents(text("### ACTIVE COMPANION\n" +
      "**" + companions.byId.get(selected.id).name + "**  ·  " +
      companions.byId.get(selected.id).rarity + "  ·  Level " + selected.level +
      "  ·  " + selected.stage + "\n" + selected.bonus.description +
      "\n" + "▰".repeat(Math.min(10, progress)) + "▱".repeat(10 - Math.min(10, progress)) +
      "  " + (selected.level === companions.MAX_LEVEL ? "Max level" : selected.xp + " / " + next + " XP")));
  } else {
    c.addTextDisplayComponents(text("### YOUR FIRST COMPANION\nChoose a starter companion below. It is free, permanent and can be changed later."));
  }
  divider(c);
  const rarities = ["Common","Uncommon","Rare","Epic","Legendary","Mythic"];
  const collection = state.owned.map((p) => {
    const def = companions.byId.get(p.id);
    return (state.activeId === p.id ? "● " : "○ ") + "**" + def.name + "**  ·  " +
      def.rarity + " · Lv " + p.level + "\n   " + p.bonus.description;
  });
  const summary = rarities.map((rarity) => {
    const group = companions.PETS.filter((pet) => pet.rarity === rarity);
    return rarity + " " + group.filter((pet) => owned.has(pet.id)).length + "/" + group.length;
  }).join(" · ");
  c.addTextDisplayComponents(text("**COLLECTION**  " + summary +
    "\n" + (collection.length ? collection.join("\n") : "Discover companions through expeditions and eggs.")));
  c.addActionRowComponents(selector(owner,
    state.starterClaimed ? "companion_select" : "companion_adopt",
    "",
    state.starterClaimed ? "Choose your active companion" : "Choose your free starter",
    (state.starterClaimed ? state.owned.map((pet) => companions.byId.get(pet.id)) : companions.STARTERS)
      .map((pet) => ({
        label: pet.name, value: pet.id,
        description: (pet.rarity + " · " + pet.description).slice(0,100),
        ...(state.starterClaimed ? { default: state.activeId === pet.id } : {})
      }))
  ));
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0,280) + "**"));
  const eggCounts = state.eggCounts || {companion_egg:state.eggs || 0};
  const totalEggs = Object.values(eggCounts).reduce((sum,x)=>sum+Number(x||0),0);
  c.addActionRowComponents(row([
    button(owner, "companion_eggs", "Hatch eggs (" + totalEggs + ")", "", ButtonStyle.Primary, totalEggs < 1),
    button(owner, "companion_mastery", "Mastery", "", ButtonStyle.Secondary, !selected),
    button(owner, "profile", "Command Center")
  ]));
  return c;
}
function companionEggs(owner, state, note = "") {
  const counts = state.eggCounts || {companion_egg:state.eggs||0};
  const available = Object.entries(companions.EGG_TIERS).filter(([id])=>Number(counts[id]||0)>0);
  const c=container("ARVEE IDLE  /  HATCHERY", "Hatch one egg. New discoveries unlock companion build options. Duplicate pets gain XP.");
  c.addTextDisplayComponents(text("**YOUR EGGS**\n" +
    Object.entries(companions.EGG_TIERS).map(([id,t])=>t.name+"  ×"+(counts[id]||0)).join("\n") +
    "\n\nEnchanted and Astral Eggs favor higher rarities. Both can be forged from ordinary eggs."));
  if(available.length)c.addActionRowComponents(selector(owner,"companion_hatch","","Choose an egg to hatch",
    available.map(([id,t])=>({label:t.name,value:id,description:"Owned ×"+counts[id]}))));
  if(note)c.addTextDisplayComponents(text("**"+note.slice(0,240)+"**"));
  c.addActionRowComponents(row([button(owner,"companions","Back to companions","",ButtonStyle.Primary)]));
  return c;
}
function companionMastery(owner,state,note="") {
  const selected=state.owned.find(p=>p.id===state.activeId);
  const c=container("ARVEE IDLE  /  COMPANION MASTERY",
    "One active companion and one equipped charm. Talents unlock at level 10, improving again at level 20.");
  if(selected){
    const def=companions.byId.get(selected.id);
    const talent=companions.TALENTS[selected.talentId];
    c.addTextDisplayComponents(text("**ACTIVE**  "+def.name+"  ·  "+def.rarity+" · Lv "+selected.level+
      "\n**TALENT**  "+(talent?.name || (selected.level<10?"Unlocks at Lv 10":"Not selected"))+
      "\n**CHARM**  "+(companions.CHARMS[state.equippedCharmId]?.name || "None")+
      "\n"+selected.bonus.description));
    if(selected.level>=10)
      c.addActionRowComponents(selector(owner,"companion_talent","","Choose a talent",
        Object.entries(companions.TALENTS).map(([id,t])=>({
          label:t.name,value:id,description:t.description.slice(0,100),default:selected.talentId===id
        }))));
    const available=Object.entries(companions.CHARMS).filter(([id])=>
      Number(state.charms?.[id]||0)>0 || state.equippedCharmId===id);
    if(available.length)
      c.addActionRowComponents(selector(owner,"companion_charm","","Equip one charm",[
        {label:"No charm",value:"none",description:"Unequip your charm",default:!state.equippedCharmId},
        ...available.map(([id,charm])=>({label:charm.name,value:id,
          description:charm.power+"% "+charm.effect.replaceAll("_"," ")+" bonus",
          default:state.equippedCharmId===id}))
      ]));
    else c.addTextDisplayComponents(text("**CHARMS**  None owned yet. Forge charms or find them in Rare and Mythic Supply Caches."));
  } else c.addTextDisplayComponents(text("Choose a companion to unlock mastery."));
  if(note)c.addTextDisplayComponents(text("**"+note.slice(0,240)+"**"));
  c.addActionRowComponents(row([button(owner,"companions","Back to companions","",ButtonStyle.Primary)]));
  return c;
}

function guildExpeditionBoard(owner, data, note = "") {
  const c=container("ARVEE IDLE  /  GUILD EXPEDITIONS",
    data.guild ? "**[" + data.guild.tag + "] " + escapeMarkdown(data.guild.name) +
    "** · Shared weekly objectives" :
    "Team objectives across every ARVEE Idle server.");
  if (data.guild) {
    const weekEnd=Math.floor(Date.parse(data.weekEndsAt)/1000);
    c.addTextDisplayComponents(text("**WEEKLY PROGRESS**  " + data.weekScore + " / 400 league points" +
      "\nResets <t:" + weekEnd + ":R> · Complete objectives with at least two guildmates."));
    if(data.seasonLockedElsewhere) {
      c.addTextDisplayComponents(text("**SEASON LOCK**\nYour league participation is locked to a previous guild for this four-week season." +
        " You can join this guild's expeditions next season."));
    }
    c.addTextDisplayComponents(text(data.missions.map(mission=>{
      const bar=Math.max(0,Math.min(10,Math.floor(10*mission.progress/Math.max(1,mission.goal))));
      return "**" + mission.name + "**  ·  " +
        (mission.completed ? "Completed" : mission.progress + "/" + mission.goal) +
        "\n" + "▰".repeat(bar) + "▱".repeat(10-bar) +
        " ·  " + mission.contributors + " contributors" +
        "\nYour contribution: " + mission.myUnits + " · +" + mission.renown + " shared Renown on completion";
    }).join("\n\n")));
  } else {
    c.addTextDisplayComponents(text("**NO GUILD**\nJoin or create a guild to contribute to team expeditions." +
      " Rewards you already earned with an old guild remain claimable."));
  }
  divider(c);
  if(data.pending) c.addTextDisplayComponents(text("**REWARD READY**\n" +
    data.pending.name + " · Week " + data.pending.periodKey +
    "\n+" + pretty(data.pending.ic) + " IC and " + data.pending.quantity +
    "× " + (items[data.pending.itemId]?.name||"Materials") + " · " +
    data.pending.units + " accepted actions"));
  else c.addTextDisplayComponents(text("**PERSONAL REWARDS**\nContribute at least two accepted actions to a completed objective." +
    " Claims persist after the weekly reset or leaving a guild."));
  if(note)c.addTextDisplayComponents(text("**" + note.slice(0,250) + "**"));
  const actions=[];
  if(data.pending) actions.push(button(owner,"gexp_claim","Claim reward","",ButtonStyle.Primary));
  actions.push(button(owner,"gexp_league","Guild Leagues","",data.pending?ButtonStyle.Secondary:ButtonStyle.Primary));
  actions.push(button(owner,"guild","Guild home"));
  c.addActionRowComponents(row(actions));
  foot(c,"League progress is capped per member and day. Guild switching cannot carry over accepted actions.");
  return c;
}
function guildLeagueBoard(owner,data,note="") {
  const c=container("ARVEE IDLE  /  GUILD LEAGUES",
    "Weekly competition and four-week seasons · one global leaderboard");
  const ends=Math.floor(Date.parse(data.seasonEndsAt)/1000);
  c.addTextDisplayComponents(text("**SEASON**  " + data.seasonKey +
    "  ·  Ends <t:" + ends + ":R>" +
    "\n**YOUR GUILD**  " + (data.guild ?
      "["+data.guild.tag+"] " + escapeMarkdown(data.guild.name) +
      " · " + data.seasonTier + " · " + data.seasonScore + "/1600 points" : "No guild") +
    (data.seasonLockedElsewhere ? "\nYour contribution is locked to an earlier guild this season." : "")));
  divider(c);
  c.addTextDisplayComponents(text("**WEEKLY STANDINGS**  ·  " + data.weekKey + "\n" +
    (data.weekly.length ? data.weekly.map(r=>
      r.rank + ". [" + r.tag + "] " + escapeMarkdown(r.name) +
      " · " + r.score + " pts").join("\n") : "No weekly objectives completed yet.")));
  c.addTextDisplayComponents(text("**SEASONAL STANDINGS**\n" +
    (data.seasonal.length ? data.seasonal.map(r=>
      r.rank + ". [" + r.tag + "] " + escapeMarkdown(r.name) +
      " · " + r.score + " pts · " + r.tier).join("\n") : "Season standings are empty.")));
  c.addTextDisplayComponents(text("**FAIR PLAY**\nEvery completed team objective awards 100 points, regardless of guild size." +
    " League milestones unlock Bronze (400), Silver (800), Gold (1200) and Diamond (1600)." +
    " After the season, members with 6+ accepted actions may claim one tier-based reward."));
  if(data.pendingSeason) {
    const r=data.pendingSeason;
    c.addTextDisplayComponents(text("**SEASON REWARD AVAILABLE**  ·  " +
      r.seasonKey + "\n" + r.tier + " · " + pretty(r.ic) +
      " IC + " + r.quantity + "× " + (items[r.itemId]?.name||"Supply Cache")));
  }
  if(note)c.addTextDisplayComponents(text("**" + note.slice(0,250) + "**"));
  const actions=[];
  if(data.pendingSeason) actions.push(button(owner,"gexp_season_claim",
    "Claim season reward",data.pendingSeason.seasonKey,ButtonStyle.Primary));
  actions.push(button(owner,"gexp","Expeditions","",data.pendingSeason?ButtonStyle.Secondary:ButtonStyle.Primary));
  actions.push(button(owner,"guild","Guild home"));
  c.addActionRowComponents(row(actions));
  return c;
}

function guildOverview(owner, data, note = "") {
  const g = data.guild;
  const c = container("ARVEE IDLE  /  GUILDS",
    g ? "**[" + g.tag + "] " + escapeMarkdown(g.name) + "**  ·  Level " + g.level +
      "  ·  " + data.role.toUpperCase() : "One persistent player guild across every ARVEE Idle server.");
  if (!g) {
    c.addTextDisplayComponents(text("**NO GUILD YET**\nCreate your own with " +
      "/idle guild create name:<name> tag:<tag> or accept a player invitation."));
    if (data.invitations.length) {
      c.addTextDisplayComponents(text("**PENDING INVITATIONS**\n" +
        data.invitations.map(i => "[" + i.tag + "] " + escapeMarkdown(i.name)).join("\n")));
      c.addActionRowComponents(selector(owner,"guild_accept","",
        "Accept a guild invitation",data.invitations.map(i=>({
          label: i.name.slice(0,75), value:i.id, description:"[" + i.tag + "] Join this guild"
        }))));
    }
  } else {
    const levelAt = guilds.xpForLevel(g.level);
    const goal = g.levelGoal;
    const bars = g.level===guilds.MAX_LEVEL ? 10 :
      Math.min(10,Math.max(0,Math.floor(10*(g.xp-levelAt)/Math.max(1,goal-levelAt))));
    c.addTextDisplayComponents(text("**GUILD PROGRESS**\n" +
      "Level " + g.level + "  ·  " + g.xp.toLocaleString("en-US") + " XP" +
      (g.level===guilds.MAX_LEVEL ? "  ·  Max level" : " / " + goal.toLocaleString("en-US")) +
      "\n" + "▰".repeat(bars) + "▱".repeat(10-bars) +
      "\n**Hall**  Tier " + g.hall + "/5  ·  **Renown**  " +
      g.renown.toLocaleString("en-US") + "  ·  **Members**  " +
      g.memberCount + "/" + g.capacity));
    c.addTextDisplayComponents(text("**SHARED PERKS**\n" +
      "+" + g.hall + "% mining IC  ·  +" + (g.hall*2) + "% boss strike damage" +
      "\nGuild XP and Renown are earned from real activity, never deducted from personal IC."));
    c.addTextDisplayComponents(text("**MEMBERS**\n" + data.members.slice(0,6).map(r=>
      "<@" + r.userId + "> · " + r.role + " · " + r.xp + " guild XP"
    ).join("\n")+(g.memberCount>6?"\n+" + (g.memberCount-6) + " more members":"")));
    c.addTextDisplayComponents(text("**WEEKLY BOSS CONTRIBUTION**  " +
      g.damage.toLocaleString("en-US") + " damage\n" +
      "Guilds are ranked by damage dealt during each UTC week."));
    if (data.role==="leader" && g.hall<5) {
      const cost=guilds.hallCost(g.hall);
      c.addTextDisplayComponents(text("**NEXT HALL UPGRADE**  " + cost +
        " Renown  ·  Guild level " + (g.hall+2) + " required"));
    }
    foot(c,"Manage members with /idle guild invite, promote, demote, kick or transfer. " +
      "Leaving and disbanding require explicit confirmation.");
  }
  if(note)c.addTextDisplayComponents(text("**" + note.slice(0,240) + "**"));
  const actions=[];
  if(g && data.role==="leader" && g.hall<5 &&
    g.renown>=guilds.hallCost(g.hall) && g.level>=g.hall+2)
    actions.push(button(owner,"guild_upgrade","Upgrade Hall","",ButtonStyle.Primary));
  actions.push(button(owner,"gexp","Expeditions","",g?ButtonStyle.Primary:ButtonStyle.Secondary));
  actions.push(button(owner,"profile","Command Center"));
  c.addActionRowComponents(row(actions));
  return c;
}
function guildRankings(owner,data) {
  const c=container("ARVEE IDLE  /  GUILD RANKINGS",
    "Global guild boss-damage leaderboard · UTC week " + data.periodKey);
  divider(c);
  c.addTextDisplayComponents(text(data.rankings.length ?
    data.rankings.map(r=>"**"+r.rank+". ["+r.tag+"] "+escapeMarkdown(r.name)+"**  ·  "+
      r.damage.toLocaleString("en-US")+" damage").join("\n") :
    "No guild has damaged this week's boss yet."));
  foot(c,"Damage stays with the guild that earned it, even if a player changes guilds later.");
  c.addActionRowComponents(row([
    button(owner,"guild","My guild","",ButtonStyle.Primary),
    button(owner,"profile","Command Center")
  ]));
  return c;
}

function worldBoss(owner, status, note = "") {
  const max = Math.max(1, status.maxHp);
  const progress = Math.max(0,Math.min(10,Math.round(10*status.hp/max)));
  const finished = status.ended;
  const subtitle = status.defeated ? "Defeated · Awaiting next weekly rotation" :
    finished ? "This week's encounter has ended" : status.description;
  const c = container("ARVEE IDLE  /  WORLD BOSS", subtitle);
  c.addTextDisplayComponents(text("### " + status.name + "\n" +
    "**HP**  " + status.hp.toLocaleString("en-US") + " / " +
    max.toLocaleString("en-US") + "\n" +
    "▰".repeat(progress) + "▱".repeat(10-progress) +
    "\n**IC REWARD POOL**  " + pretty(status.rewardPool || 0) + " IC\n**Participants**  " + status.participants +
    "   ·   **Ends**  <t:" + Math.floor(Date.parse(status.endsAt)/1000) + ":R>"));
  divider(c);
  c.addTextDisplayComponents(text("**YOUR CONTRIBUTION**\n" +
    status.myDamage.toLocaleString("en-US") + " damage  ·  " +
    status.myAttacks + " strikes\n" +
    (status.qualified ? "Qualified for rewards" :
      "To qualify: " + status.minAttacks + " strikes and " +
      status.minDamage + " damage") +
    (!finished && !status.canAttack && status.nextAttackAt
      ? "\n**Next attack**  <t:" + Math.floor(Date.parse(status.nextAttackAt)/1000) + ":R>" : "")));
  if (status.leaders?.length) {
    c.addTextDisplayComponents(text("**TOP CONTRIBUTORS**\n" +
      status.leaders.map((p,i) => (i+1) + ". <@" + p.userId + "> · " +
        p.damage.toLocaleString("en-US")).join("\n")));
  }
  if (status.pending) {
    c.addTextDisplayComponents(text("**REWARDS AVAILABLE**\n" +
      status.pending.name + " · " + status.pending.damage + " damage. Claim any time."));
  }
  if (note) c.addTextDisplayComponents(text("**" + note.slice(0,280) + "**"));
  const actions = [];
  if (status.pending) actions.push(button(owner,"boss_claim","Claim rewards",
    status.pending.periodKey,ButtonStyle.Primary));
  if (status.canAttack) actions.push(button(owner,"boss_attack","Attack boss","",
    status.pending ? ButtonStyle.Secondary : ButtonStyle.Primary));
  if (!status.canAttack && !status.pending) actions.push(
    button(owner,"boss","Refresh","",ButtonStyle.Primary));
  actions.push(button(owner,"profile","Command Center"));
  c.addActionRowComponents(row(actions));
  foot(c,"Shared across all ARVEE Idle servers · One boss per UTC week · Reward claims are permanent.");
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
  c.addTextDisplayComponents(text("**OPERATIONS**\n" +
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
    (currentTier === rewards.length ? "  MAX TIER" : "  " + (xp % SEASON.xpPerTier) + " / " + SEASON.xpPerTier + " to next")));
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
    "\n**Permanent production**  +" + ((p.prestige + 1) * 25) + "%" +
    "\n**Lucky reward**  5% Rebirth Cocktail · 5% Lunchbox · 10% Rare Cache · 30% Supply Cache" +
    "\n50% chance of no bonus item.");
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
  c.addTextDisplayComponents(text("**Pickaxe name**  " + escapeMarkdown(p.pickaxeName || "Pickaxe").slice(0,24) +
    "  ·  **Finish**  " + pickaxeArt(p.pickaxeStyle) + " " + (p.pickaxeStyle || "Copper") +
    "\n**Pickaxe tier**  " + tier + " / 10  ·  **Mining XP**  " + p.mineXp +
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
    "Spend Rune Fragments on permanent talents. Find them in Supply Caches (regular 1%, rare 14%, mythic 20%).");
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
  foot(c, "**START** · /idle daily → /idle mine → /idle shop\n**Grow** · /idle shop, /idle buy, /idle profile\n**Explore** · /idle mine, /idle pickaxe, /idle daily\n**Collect** · /idle inventory, /idle open, /idle craft, /idle use\n**Trade** · /idle give, /idle market\n**Guilds** · /idle guild view, /idle guild create\n**Compete** · /idle boss, /idle leaderboard, /idle prestige\n\nUse the buttons below to navigate without typing commands.");
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
  custom, button, sectionMenu, customization, companionMastery, companionEggs, category, listState, parseListState, craftState, parseCraftState, shopFilters, inventoryFilters, expeditionMap, expeditionRegion, expeditionGear, companionCollection, worldBoss, guildOverview, guildRankings, guildExpeditionBoard, guildLeagueBoard, preferences, challengeBoard, message, home, shop, generator, inventory, inventoryPreview, item, crafting, recipe, season, market, listing,
  prestige, pickaxe, perks, perkRespec, stats, leaderboard, help, payload, miningResult, dailyResult, craftingResult, cacheResult, purchaseResult, prestigeResult, SUCCESS, WARN, ERROR
};
