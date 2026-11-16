"use strict";
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { dec, pretty, purchaseCost, PRESTIGE_REQUIREMENT } = require("./economy");
const store = require("./store");

const itemChoices = Object.entries(items).map(([value, info]) => ({ name: info.name, value }));
const recipeChoices = Object.keys(recipes).map((id) => ({ name: items[id].name, value: id }));
const coffee = new SlashCommandBuilder().setName("coffee").setDescription("Play Coffee's idle economy game");
coffee.addSubcommand((c) => c.setName("help").setDescription("Commands and getting started"));
coffee.addSubcommand((c) => c.setName("profile").setDescription("View a player profile").addUserOption((o) => o.setName("user").setDescription("Player to inspect")));
coffee.addSubcommand((c) => c.setName("shop").setDescription("Browse BP generators").addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)));
coffee.addSubcommand((c) => c.setName("buy").setDescription("Buy generators with BP")
  .addStringOption((o) => o.setName("generator").setDescription("Generator code from /coffee shop").setRequired(true))
  .addIntegerOption((o) => o.setName("amount").setDescription("How many (1-1000)").setMinValue(1).setMaxValue(1000)));
coffee.addSubcommand((c) => c.setName("mine").setDescription("Mine BP and materials (5-minute cooldown)"));
coffee.addSubcommand((c) => c.setName("daily").setDescription("Claim daily coffee and lootboxes"));
coffee.addSubcommand((c) => c.setName("inventory").setDescription("Check collected items").addUserOption((o) => o.setName("user").setDescription("Player to inspect")));
coffee.addSubcommand((c) => c.setName("craft").setDescription("Craft an item")
  .addStringOption((o) => o.setName("item").setDescription("Item to craft").setRequired(true).addChoices(...recipeChoices))
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity (1-100)").setMinValue(1).setMaxValue(100)));
coffee.addSubcommand((c) => c.setName("open").setDescription("Open lootboxes")
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity (1-20)").setMinValue(1).setMaxValue(20)));
coffee.addSubcommand((c) => c.setName("give").setDescription("Give another player an item")
  .addUserOption((o) => o.setName("user").setDescription("Recipient").setRequired(true))
  .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).addChoices(...itemChoices))
  .addIntegerOption((o) => o.setName("amount").setDescription("Quantity").setMinValue(1).setMaxValue(1000)));
coffee.addSubcommand((c) => c.setName("leaderboard").setDescription("Top players by earned BP"));
coffee.addSubcommand((c) => c.setName("prestige").setDescription("Restart your generators with a permanent boost")
  .addBooleanOption((o) => o.setName("confirm").setDescription("Confirm resetting your generators and BP")));
coffee.addSubcommandGroup((g) => g.setName("market").setDescription("Trade items for BP")
  .addSubcommand((c) => c.setName("browse").setDescription("Browse active listings"))
  .addSubcommand((c) => c.setName("sell").setDescription("List items for sale")
    .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).addChoices(...itemChoices))
    .addIntegerOption((o) => o.setName("amount").setDescription("Quantity").setRequired(true).setMinValue(1).setMaxValue(1000))
    .addStringOption((o) => o.setName("price").setDescription("Total BP price, as a whole number").setRequired(true)))
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
    return "**" + entry.id + "** · " + entry.name + " — " + pretty(cost) + " BP · +" + pretty(dec(entry.income)) + " BP/s";
  });
  return "☕ **Coffee Generator Shop** · Page " + selected + "/" + pages + "\n" + lines.join("\n") +
    "\nUse /coffee buy with a generator code. Generator prices increase as you own more.";
}
async function respond(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "coffee") return;
  await interaction.deferReply();
  try {
    const id = interaction.user.id;
    const opts = interaction.options;
    const group = opts.getSubcommandGroup(false);
    const command = opts.getSubcommand();
    let content = "";
    if (group === "market") {
      if (command === "browse") {
        const rows = await store.browseMarket();
        content = rows.length ? "**Coffee Market**\n" + rows.map((r) =>
          "#" + r.id + " · " + r.quantity + " " + labelItem(r.item_id) + " · " + pretty(r.price) + " BP · Seller <@" + r.seller_id + ">"
        ).join("\n") : "The market is empty. List something with /coffee market sell!";
      } else if (command === "sell") {
        const item = opts.getString("item", true);
        const amount = opts.getInteger("amount", true);
        const price = opts.getString("price", true);
        const result = await store.sellItem(id, item, amount, price);
        content = "Listed #" + result.id + ": " + amount + " " + labelItem(item) + " for " + pretty(result.price) + " BP.";
      } else if (command === "buy") {
        const result = await store.buyListing(id, opts.getString("id", true));
        content = "Purchased " + result.quantity + " " + labelItem(result.item) + " for " + pretty(result.price) + " BP!";
      } else if (command === "cancel") {
        const result = await store.cancelListing(id, opts.getString("id", true));
        content = "Cancelled listing; returned " + result.quantity + " " + labelItem(result.item) + ".";
      }
    } else if (command === "help") {
      content = [
        "**☕ Coffee — Idle Game**",
        "Start with /coffee profile. Earn BP passively by buying generators.",
        "**Economy:** /coffee shop, /coffee buy, /coffee leaderboard, /coffee prestige",
        "**Activities:** /coffee mine, /coffee daily, /coffee craft, /coffee open",
        "**Items:** /coffee inventory, /coffee give, /coffee market",
        "Prestige requires 1B BP and increases production by 25% per level.",
        "All progress is stored in PostgreSQL. This is a fresh season."
      ].join("\n");
    } else if (command === "profile") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      const genTotal = p.generators.reduce((sum, g) => sum + g.quantity, 0);
      content = "**☕ " + target.username + "'s Coffee Profile**\nBP: **" + pretty(p.balance) +
        "**\nBP/s: **" + pretty(p.rate) + "**\nTotal earned: " + pretty(p.totalEarned) +
        "\nGenerators owned: " + genTotal + "\nPrestige: " + p.prestige + " · Mining XP: " + p.mineXp;
    } else if (command === "shop") {
      content = shop(opts.getInteger("page") || 1);
    } else if (command === "buy") {
      const result = await store.buyGenerator(id, opts.getString("generator", true), opts.getInteger("amount") || 1);
      content = "Bought " + result.quantity + " × **" + result.generator.name + "** for **" +
        pretty(result.cost) + " BP**.\nNew balance: " + pretty(result.balance) + " BP · Income: " + pretty(result.rate) + " BP/s.";
    } else if (command === "mine") {
      const result = await store.mine(id);
      content = result.cooldown ? "Your pickaxe is resting. Try again in " + result.cooldown + " seconds." :
        "⛏️ Mined **" + pretty(result.reward) + " BP** and found **" + labelItem(result.drop) + "**! Mining XP: " + result.mineXp;
    } else if (command === "daily") {
      const result = await store.daily(id);
      content = result.cooldown ? "Daily reward available in " + Math.ceil(result.cooldown / 60) + " minutes." :
        "🎁 Daily reward claimed: " + result.received.join(", ") + "!";
    } else if (command === "inventory") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      content = "**" + target.username + "'s inventory**\n" +
        (p.inventory.length ? p.inventory.map((r) => labelItem(r.item_id) + " × " + r.quantity).join("\n") : "Empty. Try /coffee mine or /coffee daily.");
    } else if (command === "craft") {
      const item = opts.getString("item", true);
      const qty = opts.getInteger("amount") || 1;
      await store.craft(id, item, qty);
      content = "Crafted " + qty + " × **" + labelItem(item) + "**!";
    } else if (command === "open") {
      const drops = await store.openLootbox(id, opts.getInteger("amount") || 1);
      content = "📦 Opened lootboxes: " + Object.entries(drops).map(([item, n]) => n + " " + labelItem(item)).join(", ") + ".";
    } else if (command === "give") {
      const recipient = opts.getUser("user", true);
      if (recipient.bot) throw new Error("You cannot send items to bots.");
      const item = opts.getString("item", true);
      const amount = opts.getInteger("amount") || 1;
      await store.giveItem(id, recipient.id, item, amount);
      content = "Sent **" + amount + " " + labelItem(item) + "** to **" + recipient.username + "**.";
    } else if (command === "leaderboard") {
      const top = await store.leaderboard();
      content = "**☕ Coffee Leaderboard**\n" +
        (top.length ? top.map((p, n) => (n + 1) + ". <@" + p.user_id + "> — " + pretty(p.total_earned) + " BP · P" + p.prestige).join("\n") : "Nobody has started playing yet.");
    } else if (command === "prestige") {
      if (!opts.getBoolean("confirm")) {
        content = "Prestige costs **" + pretty(PRESTIGE_REQUIREMENT) + " BP**. It resets your BP and generators (not inventory) and adds +25% permanent production per prestige.\nRun /coffee prestige confirm:true when ready.";
      } else {
        const result = await store.prestige(id);
        content = "🌟 Prestige **" + result.prestige + "**! Permanent production multiplier: " + result.multiplier.toString() + "×.";
      }
    } else content = "Unknown command.";
    await interaction.editReply({ content: content.slice(0, 1990), allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Coffee command]", error);
    const reply = error.message && !/SQL|relation|column|syntax|connect|pool|password|database/i.test(error.message)
      ? error.message : "An unexpected error occurred. Please try again.";
    await interaction.editReply({ content: "☕ " + reply.slice(0, 1800), allowedMentions: { parse: [] } }).catch(console.error);
  }
}
module.exports = { coffee, respond, shop };
