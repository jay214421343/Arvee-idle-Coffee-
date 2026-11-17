"use strict";
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { dec, pretty, purchaseCost, PRESTIGE_REQUIREMENT } = require("./economy");
const store = require("./store");
const ui = require("./ui");

const itemChoices = Object.entries(items).map(([value, info]) => ({ name: info.name, value }));
const recipeChoices = Object.keys(recipes).map((id) => ({ name: items[id].name, value: id }));
const idle = new SlashCommandBuilder().setName("idle").setDescription("ARVEE Idle — build, explore, mine and trade");
idle.addSubcommand((c) => c.setName("help").setDescription("Commands and getting started"));
idle.addSubcommand((c) => c.setName("profile").setDescription("View a player profile").addUserOption((o) => o.setName("user").setDescription("Player to inspect")));
idle.addSubcommand((c) => c.setName("shop").setDescription("Browse IC generators").addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)));
idle.addSubcommand((c) => c.setName("buy").setDescription("Buy generators with IC")
  .addStringOption((o) => o.setName("generator").setDescription("Operation to recruit").setRequired(true).setAutocomplete(true))
  .addIntegerOption((o) => o.setName("amount").setDescription("How many (1-1000)").setMinValue(1).setMaxValue(1000)));
idle.addSubcommand((c) => c.setName("mine").setDescription("Mine Idle Credits and crafting materials (90-second cooldown)"));
idle.addSubcommand((c) => c.setName("daily").setDescription("Claim your daily Idle Credits and supply caches"));
idle.addSubcommand((c) => c.setName("inventory").setDescription("Check collected items").addUserOption((o) => o.setName("user").setDescription("Player to inspect")));
idle.addSubcommand((c) => c.setName("craft").setDescription("Craft an item")
  .addStringOption((o) => o.setName("item").setDescription("Item to craft (omit to browse recipes)").addChoices(...recipeChoices))
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity (1-100)").setMinValue(1).setMaxValue(100)));
idle.addSubcommand((c) => c.setName("open").setDescription("Open your Supply Caches")
  .addStringOption((o) => o.setName("type").setDescription("Type of supply cache").addChoices(
    { name: "Supply Cache", value: "lootbox" }, { name: "Rare Supply Cache", value: "rare_lootbox" }, { name: "Mythic Supply Cache", value: "legendary_lootbox" }))
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity (1-20)").setMinValue(1).setMaxValue(20)));
idle.addSubcommand((c) => c.setName("give").setDescription("Give another player an item")
  .addUserOption((o) => o.setName("user").setDescription("Recipient").setRequired(true))
  .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).addChoices(...itemChoices))
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity").setMinValue(1).setMaxValue(1000)));
idle.addSubcommand((c) => c.setName("leaderboard").setDescription("Top players by earned IC"));
idle.addSubcommand((c) => c.setName("pickaxe").setDescription("Upgrade your pickaxe and view mining stats"));
idle.addSubcommand((c) => c.setName("perks").setDescription("View and upgrade permanent pickaxe perks"));
idle.addSubcommand((c) => c.setName("stats").setDescription("View unlocked achievements and game activity"));
idle.addSubcommand((c) => c.setName("use").setDescription("Consume an item from your inventory")
  .addStringOption((o) => o.setName("item").setDescription("Item to consume").setRequired(true)
    .addChoices(...Object.entries(items).filter(([, i]) => !!i.effect).map(([value, i]) => ({ name: i.name, value })))));
idle.addSubcommand((c) => c.setName("prestige").setDescription("Restart your generators with a permanent boost")
  .addBooleanOption((o) => o.setName("confirm").setDescription("Confirm resetting your generators and IC")));
idle.addSubcommandGroup((g) => g.setName("market").setDescription("Trade items for IC")
  .addSubcommand((c) => c.setName("browse").setDescription("Browse active listings"))
  .addSubcommand((c) => c.setName("sell").setDescription("List items for sale")
    .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).addChoices(...itemChoices))
    .addIntegerOption((o) => o.setName("amount").setDescription("Quantity").setRequired(true).setMinValue(1).setMaxValue(1000))
    .addStringOption((o) => o.setName("price").setDescription("Total IC price, as a whole number").setRequired(true)))
  .addSubcommand((c) => c.setName("buy").setDescription("Buy one listing")
    .addStringOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true)))
  .addSubcommand((c) => c.setName("cancel").setDescription("Cancel your active listing")
    .addStringOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true))));

function labelItem(id) { return items[id]?.name || id; }
function shop(page) {
  const pages = Math.max(1, Math.ceil(generators.length / 8));
  const selected = Math.max(1, Math.min(page, pages));
  const lines = generators.slice((selected - 1) * 8, selected * 8).map((entry) => {
    const cost = purchaseCost(entry.cost, 0, 1);
    return "**" + entry.id + "** · " + entry.name + " — " + pretty(cost) + " IC · +" + pretty(dec(entry.income)) + " IC/s";
  });
  return "☕ **ARVEE Idle Generator Shop** · Page " + selected + "/" + pages + "\n" + lines.join("\n") +
    "\nUse /idle buy with a generator code. Generator prices increase as you own more.";
}
async function respond(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "idle") return;
  await interaction.deferReply();
  try {
    const id = interaction.user.id;
    const opts = interaction.options;
    const group = opts.getSubcommandGroup(false);
    const command = opts.getSubcommand();
    let content = "";
    let view = null;
    if (group === "market") {
      if (command === "browse") {
        const rows = await store.browseMarket();
        view = ui.market(id, rows);
        content = rows.length ? "**ARVEE Idle Market**\n" + rows.map((r) =>
          "#" + r.id + " · " + r.quantity + " " + labelItem(r.item_id) + " · " + pretty(r.price) + " IC · Seller <@" + r.seller_id + ">"
        ).join("\n") : "The market is empty. List something with /idle market sell!";
      } else if (command === "sell") {
        const item = opts.getString("item", true);
        const amount = opts.getInteger("amount", true);
        const price = opts.getString("price", true);
        const result = await store.sellItem(id, item, amount, price);
        content = "Listed #" + result.id + ": " + amount + " " + labelItem(item) + " for " + pretty(result.price) + " IC.";
      } else if (command === "buy") {
        const result = await store.buyListing(id, opts.getString("id", true));
        content = "Purchased " + result.quantity + " " + labelItem(result.item) + " for " + pretty(result.price) + " IC!";
      } else if (command === "cancel") {
        const result = await store.cancelListing(id, opts.getString("id", true));
        content = "Cancelled listing; returned " + result.quantity + " " + labelItem(result.item) + ".";
      }
    } else if (command === "help") {
      view = ui.help(id);
      content = [
        "**✦ ARVEE Idle — Adventure & Progression**",
        "Start with /idle daily, /idle mine, then recruit an operation in /idle shop.",
        "**Economy:** /idle shop, /idle buy, /idle leaderboard, /idle prestige",
        "**Activities:** /idle mine, /idle daily, /idle craft, /idle open",
        "**Items:** /idle inventory, /idle give, /idle market",
        "Prestige requires 1B IC and increases production by 25% per level.",
        "All progress is stored in PostgreSQL. This is a fresh season."
      ].join("\n");
    } else if (command === "profile") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      view = ui.home(id, target, p);
      const genTotal = p.generators.reduce((sum, g) => sum + g.quantity, 0);
      content = "**✦ " + target.username + "'s ARVEE Idle Profile**\nIC: **" + pretty(p.balance) +
        "**\nIC/s: **" + pretty(p.rate) + "**\nTotal earned: " + pretty(p.totalEarned) +
        "\nGenerators owned: " + genTotal + "\nPrestige: " + p.prestige + " · Mining XP: " + p.mineXp;
    } else if (command === "shop") {
      view = ui.shop(id, opts.getInteger("page") || 1, await store.profile(id));
      content = shop(opts.getInteger("page") || 1);
    } else if (command === "buy") {
      const result = await store.buyGenerator(id, opts.getString("generator", true), opts.getInteger("amount") || 1);
      content = "Bought " + result.quantity + " × **" + result.generator.name + "** for **" +
        pretty(result.cost) + " IC**.\nNew balance: " + pretty(result.balance) + " IC · Income: " + pretty(result.rate) + " IC/s.";
    } else if (command === "mine") {
      const result = await store.mine(id);
      content = result.cooldown ? "Your pickaxe is resting. Try again in " + result.cooldown + " seconds." :
        "⛏️ Mined **" + pretty(result.reward) + " IC** and found **" + (result.dropQuantity || 1) + "× " + labelItem(result.drop) + "**! Mining XP: " + result.mineXp;
    } else if (command === "daily") {
      const result = await store.daily(id);
      content = result.cooldown ? "Daily reward available in " + Math.ceil(result.cooldown / 60) + " minutes." :
        "🎁 Daily reward claimed: " + result.received.join(", ") + "!";
    } else if (command === "inventory") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      view = ui.inventory(id, p);
      content = "**" + target.username + "'s inventory**\n" +
        (p.inventory.length ? p.inventory.map((r) => labelItem(r.item_id) + " × " + r.quantity).join("\n") : "Empty. Try /idle mine or /idle daily.");
    } else if (command === "craft") {
      const item = opts.getString("item");
      if (!item) {
        view = ui.crafting(id, await store.profile(id));
      } else {
        const qty = opts.getInteger("amount") || 1;
        await store.craft(id, item, qty);
        content = "Crafted " + qty + " × **" + labelItem(item) + "**!";
      }
    } else if (command === "open") {
      const drops = await store.openLootbox(id, opts.getInteger("amount") || 1, opts.getString("type") || "lootbox");
      content = "📦 Opened supply caches: " + Object.entries(drops).map(([item, n]) => n + " " + labelItem(item)).join(", ") + ".";
    } else if (command === "give") {
      const recipient = opts.getUser("user", true);
      if (recipient.bot) throw new Error("You cannot send items to bots.");
      const item = opts.getString("item", true);
      const amount = opts.getInteger("amount") || 1;
      await store.giveItem(id, recipient.id, item, amount);
      content = "Sent **" + amount + " " + labelItem(item) + "** to **" + recipient.username + "**.";
    } else if (command === "leaderboard") {
      const top = await store.leaderboard();
      view = ui.leaderboard(id, top);
      content = "**✦ ARVEE Idle Leaderboard**\n" +
        (top.length ? top.map((p, n) => (n + 1) + ". <@" + p.user_id + "> — " + pretty(p.total_earned) + " IC · P" + p.prestige).join("\n") : "Nobody has started playing yet.");
    } else if (command === "prestige") {
      if (!opts.getBoolean("confirm")) {
        view = ui.prestige(id, await store.profile(id));
        content = "Prestige costs **" + pretty(PRESTIGE_REQUIREMENT) + " IC**. It resets your IC and generators (not inventory) and adds +25% permanent production per prestige.\nRun /idle prestige confirm:true when ready.";
      } else {
        const result = await store.prestige(id);
        content = "🌟 Prestige **" + result.prestige + "**! Permanent production multiplier: " + result.multiplier.toString() + "×.";
      }
    } else if (command === "pickaxe") {
      view = ui.pickaxe(id, await store.profile(id));
    } else if (command === "perks") {
      view = ui.perks(id, await store.profile(id), require("./catalog").perks);
    } else if (command === "stats") {
      view = ui.stats(id, await store.getStats(id));
    } else if (command === "use") {
      const used = await store.useItem(id, opts.getString("item", true));
      content = "Used **" + labelItem(used.itemId) + "**. " + used.message;
    } else content = "Unknown command.";
    view ||= ui.message("✦ ARVEE Idle", content.slice(0, 2900), id);
    await interaction.editReply({ content: null, embeds: [], ...ui.payload(view) });
  } catch (error) {
    console.error("[ARVEE Idle command]", error);
    const reply = error.message && !/SQL|relation|column|syntax|connect|pool|password|database/i.test(error.message)
      ? error.message : "An unexpected error occurred. Please try again.";
    await interaction.editReply({ content: null, embeds: [], ...ui.payload(ui.message("Something went wrong", "✦ " + reply.slice(0, 1800), interaction.user.id, { color: ui.ERROR })) }).catch(console.error);
  }
}
async function handleAutocomplete(interaction) {
  if (!interaction.isAutocomplete() || interaction.commandName !== "idle") return false;
  const focus = interaction.options.getFocused(true);
  if (focus.name !== "generator") return false;
  const term = String(focus.value || "").toLowerCase().slice(0, 100);
  const choices = generators
    .filter((g) => (g.name + " " + g.id).toLowerCase().includes(term))
    .slice(0, 25)
    .map((g) => ({ name: g.name.slice(0, 100), value: g.id }));
  await interaction.respond(choices);
  return true;
}
function uiError(error) {
  if (!error || !error.message) return "An unexpected error occurred.";
  return /SQL|relation|column|syntax|connect|pool|password|database|duplicate key/i.test(error.message)
    ? "A database operation failed. Please retry." : error.message;
}
async function handleComponent(interaction) {
  if (!(interaction.isButton() || interaction.isStringSelectMenu())) return false;
  const parts = interaction.customId.split(":");
  if (parts.length !== 5 || parts[0] !== "ai" || parts[1] !== "2") return false;
  const [, , owner, action, argument] = parts;
  if (owner !== interaction.user.id) {
    await interaction.reply({ content: "This menu belongs to another player. Use /idle profile to open your own.", flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!/^[a-z_]+$/.test(action) || !/^[a-zA-Z0-9_]*$/.test(argument)) return false;
  try {
    await interaction.deferUpdate();
    const selected = interaction.isStringSelectMenu() ? interaction.values[0] : "";
    let view;
    let result;
    if (action === "navigate") {
      if (selected === "profile") view = ui.home(owner, interaction.user, await store.profile(owner));
      else if (selected === "shop") view = ui.shop(owner, 1, await store.profile(owner));
      else if (selected === "inventory") view = ui.inventory(owner, await store.profile(owner));
      else if (selected === "craft") view = ui.crafting(owner, await store.profile(owner));
      else if (selected === "market") view = ui.market(owner, await store.browseMarket());
      else if (selected === "pickaxe") view = ui.pickaxe(owner, await store.profile(owner));
      else if (selected === "perks") view = ui.perks(owner, await store.profile(owner), require("./catalog").perks);
      else if (selected === "stats") view = ui.stats(owner, await store.getStats(owner));
      else if (selected === "leaderboard") view = ui.leaderboard(owner, await store.leaderboard());
      else if (selected === "prestige") view = ui.prestige(owner, await store.profile(owner));
      else if (selected === "help") view = ui.help(owner);
      else throw new Error("Unknown navigation destination.");
    } else if (action === "profile") {
      view = ui.home(owner, interaction.user, await store.profile(owner));
    } else if (action === "shop") {
      const { page, filter, sort } = ui.parseListState(argument, "shop");
      view = ui.shop(owner, page, await store.profile(owner), filter, sort);
    } else if (action === "shop_filters") {
      const { page, filter, sort } = ui.parseListState(argument, "shop");
      view = ui.shopFilters(owner, page, filter, sort);
    } else if (action === "shop_filter_set") {
      const [filter, sort] = argument.split("_");
      view = ui.shop(owner, 1, await store.profile(owner), filter, sort);
    } else if (action === "shop_filter") {
      view = ui.shop(owner, 1, await store.profile(owner), selected, argument);
    } else if (action === "shop_sort") {
      view = ui.shop(owner, 1, await store.profile(owner), argument, selected);
    } else if (action === "operation") {
      view = ui.generator(owner, argument, 1, await store.profile(owner));
    } else if (action === "generator_select") {
      const player = await store.profile(owner);
      view = ui.generator(owner, selected, Number(argument) || 1, player);
    } else if (action === "buy_one" || action === "buy_ten" || action === "buy_hundred") {
      const amount = action === "buy_hundred" ? 100 : action === "buy_ten" ? 10 : 1;
      result = await store.buyGenerator(owner, argument, amount);
      const page = Math.floor(Math.max(0, generators.findIndex((g) => g.id === argument)) / 4) + 1;
      view = ui.generator(owner, argument, page, await store.profile(owner), "Purchased " + amount + " for " + pretty(result.cost) + " IC.");
    } else if (action === "mine") {
      result = await store.mine(owner);
      view = ui.message(result.cooldown ? "⏳ Pickaxe cooling down" : "⛏ Mining complete",
        result.cooldown ? "You can mine again in " + result.cooldown + " seconds." :
          "**+" + pretty(result.reward) + " IC** and **" + (result.dropQuantity || 1) + "× " + labelItem(result.drop) + "**" + (result.box ? " · Bonus Supply Cache!" : ""),
        owner, { color: result.cooldown ? ui.WARN : ui.SUCCESS });
    } else if (action === "daily") {
      result = await store.daily(owner);
      view = ui.message(result.cooldown ? "⏳ Daily claimed" : "🎁 Daily reward",
        result.cooldown ? "Available again in " + Math.ceil(result.cooldown / 60) + " minutes." : result.received.join(" · "),
        owner, { color: result.cooldown ? ui.WARN : ui.SUCCESS });
    } else if (action === "inventory") {
      const { page, filter, sort } = ui.parseListState(argument, "inventory");
      view = ui.inventory(owner, await store.profile(owner), page, filter, sort);
    } else if (action === "inventory_filters") {
      const { page, filter, sort } = ui.parseListState(argument, "inventory");
      view = ui.inventoryFilters(owner, page, filter, sort);
    } else if (action === "inventory_filter_set") {
      const [filter, sort] = argument.split("_");
      view = ui.inventory(owner, await store.profile(owner), 1, filter, sort);
    } else if (action === "inventory_filter") {
      view = ui.inventory(owner, await store.profile(owner), 1, selected, argument);
    } else if (action === "inventory_sort") {
      view = ui.inventory(owner, await store.profile(owner), 1, argument, selected);
    } else if (action === "item_view") {
      const p = await store.profile(owner);
      view = ui.item(owner, argument, p.inventory.find((e) => e.item_id === argument)?.quantity || 0);
    } else if (action === "item_select") {
      const p = await store.profile(owner);
      const quantity = p.inventory.find((r) => r.item_id === selected)?.quantity || 0;
      view = ui.item(owner, selected, quantity, argument);
    } else if (action === "use_item") {
      result = await store.useItem(owner, argument);
      view = ui.message("✨ Item used", "**" + labelItem(result.itemId) + "** · " + result.message, owner, { color: ui.SUCCESS });
    } else if (action === "open_one") {
      const drops = await store.openLootbox(owner, 1, argument);
      view = ui.message("📦 Supply Cache opened", Object.entries(drops).map(([id, n]) => n + "× " + labelItem(id)).join(" · "), owner, { color: ui.SUCCESS });
    } else if (action === "craft") {
      const { page, filter } = ui.parseCraftState(argument);
      view = ui.crafting(owner, await store.profile(owner), page, filter);
    } else if (action === "craft_filter") {
      view = ui.crafting(owner, await store.profile(owner), 1, selected);
    } else if (action === "recipe_view") {
      view = ui.recipe(owner, argument, await store.profile(owner));
    } else if (action === "recipe_select") {
      view = ui.recipe(owner, selected, await store.profile(owner));
    } else if (action === "craft_one" || action === "craft_five") {
      const quantity = action === "craft_five" ? 5 : 1;
      await store.craft(owner, argument, quantity);
      view = ui.message("🛠 Crafted successfully", quantity + "× " + labelItem(argument), owner, { color: ui.SUCCESS });
    } else if (action === "market") {
      view = ui.market(owner, await store.browseMarket());
    } else if (action === "listing_select") {
      view = ui.listing(owner, await store.getListing(selected));
    } else if (action === "listing_buy") {
      result = await store.buyListing(owner, argument);
      view = ui.message("✅ Purchase completed", result.quantity + "× " + labelItem(result.item) + " for " + pretty(result.price) + " IC.", owner, { color: ui.SUCCESS });
    } else if (action === "listing_cancel") {
      result = await store.cancelListing(owner, argument);
      view = ui.message("✅ Listing cancelled", result.quantity + "× " + labelItem(result.item) + " returned.", owner, { color: ui.SUCCESS });
    } else if (action === "leaderboard") {
      view = ui.leaderboard(owner, await store.leaderboard());
    } else if (action === "prestige") {
      view = ui.prestige(owner, await store.profile(owner));
    } else if (action === "prestige_confirm") {
      result = await store.prestige(owner);
      view = ui.message("🌟 Prestige complete", "You are now **Prestige " + result.prestige + "**!", owner, { color: ui.SUCCESS });
    } else if (action === "pickaxe") {
      view = ui.pickaxe(owner, await store.profile(owner));
    } else if (action === "pickaxe_upgrade") {
      result = await store.upgradePickaxe(owner);
      view = ui.message("⛏ Pickaxe upgraded", "Tier **" + result.tier + "** unlocked!", owner, { color: ui.SUCCESS });
    } else if (action === "perks") {
      view = ui.perks(owner, await store.profile(owner), require("./catalog").perks);
    } else if (action === "stats") {
      view = ui.stats(owner, await store.getStats(owner));
    } else if (action === "perk_respec") {
      view = ui.perkRespec(owner);
    } else if (action === "perk_respec_confirm") {
      result = await store.respecPerks(owner);
      view = ui.message("✨ Perks reset", "Removed " + result.removed + " perk(s). You can unlock new ones.", owner, { color: ui.SUCCESS });
    } else if (action === "perk_select") {
      result = await store.upgradePerk(owner, selected);
      view = ui.message("✨ Perk upgraded", require("./catalog").perks[result.perkId].name + " is now level **" + result.level + "**.", owner, { color: ui.SUCCESS });
    } else return true;
    await interaction.editReply({ components: [view], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[ARVEE Idle component]", error);
    await interaction.followUp({ content: "✦ " + uiError(error).slice(0, 1800), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(console.error);
  }
  return true;
}
module.exports = { idle, respond, handleAutocomplete, handleComponent, shop };
