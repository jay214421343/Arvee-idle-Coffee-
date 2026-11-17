"use strict";
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { generators, byId, items, recipes } = require("./catalog");
const { dec, pretty, purchaseCost, PRESTIGE_REQUIREMENT } = require("./economy");
const store = require("./store");
const ui = require("./ui");

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
idle.addSubcommand((c) => c.setName("season").setDescription("Season Journey: tiers, challenges and free rewards"));
idle.addSubcommand((c) => c.setName("challenges").setDescription("Daily and weekly adventurer contracts with rewards"));
idle.addSubcommand((c) => c.setName("explore").setDescription("World Map: send your crew on timed expeditions"));
idle.addSubcommand((c) => c.setName("boss").setDescription("Fight the shared weekly world boss and claim rewards"));
idle.addSubcommand((c) => c.setName("companions").setDescription("Collect, level and equip an adventure companion"));
idle.addSubcommand((c) => c.setName("equipment").setDescription("Upgrade permanent expedition equipment"));
idle.addSubcommand((c) => c.setName("settings").setDescription("View and reset your saved filter preferences"));
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
  .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).setAutocomplete(true))
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
    .addStringOption((o) => o.setName("item").setDescription("Item").setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Quantity").setRequired(true).setMinValue(1).setMaxValue(1000))
    .addStringOption((o) => o.setName("price").setDescription("Total IC price, as a whole number").setRequired(true)))
  .addSubcommand((c) => c.setName("buy").setDescription("Buy one listing")
    .addStringOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true)))
  .addSubcommand((c) => c.setName("cancel").setDescription("Cancel your active listing")
    .addStringOption((o) => o.setName("id").setDescription("Listing ID").setRequired(true))));

idle.addSubcommandGroup((g) => g.setName("guild").setDescription("Manage global ARVEE Idle player guilds")
  .addSubcommand((c) => c.setName("view").setDescription("Open your guild and invitations"))
  .addSubcommand((c) => c.setName("rankings").setDescription("Weekly guild boss damage rankings"))
  .addSubcommand((c) => c.setName("expeditions").setDescription("Team weekly expedition objectives and rewards"))
  .addSubcommand((c) => c.setName("league").setDescription("Weekly and seasonal guild league standings"))
  .addSubcommand((c) => c.setName("claim").setDescription("Claim your oldest completed Guild Expedition reward"))
  .addSubcommand((c) => c.setName("season_claim").setDescription("Claim an earned reward from a finished guild league season")
    .addStringOption((o) => o.setName("season").setDescription("Season start date (YYYYMMDD)").setRequired(true)))
  .addSubcommand((c) => c.setName("create").setDescription("Create a global player guild")
    .addStringOption((o) => o.setName("name").setDescription("Guild name (3-26 characters)").setRequired(true).setMinLength(3).setMaxLength(26))
    .addStringOption((o) => o.setName("tag").setDescription("Short tag (2-5 letters/numbers)").setRequired(true).setMinLength(2).setMaxLength(5)))
  .addSubcommand((c) => c.setName("invite").setDescription("Invite a player (leader or officer)")
    .addUserOption((o) => o.setName("user").setDescription("Player to invite").setRequired(true)))
  .addSubcommand((c) => c.setName("accept").setDescription("Accept your pending guild invitation")
    .addStringOption((o) => o.setName("id").setDescription("Guild ID from your invitation").setRequired(true)))
  .addSubcommand((c) => c.setName("decline").setDescription("Decline a guild invitation")
    .addStringOption((o) => o.setName("id").setDescription("Inviting guild ID").setRequired(true)))
  .addSubcommand((c) => c.setName("leave").setDescription("Leave your current guild")
    .addBooleanOption((o) => o.setName("confirm").setDescription("Confirm leaving guild").setRequired(true)))
  .addSubcommand((c) => c.setName("kick").setDescription("Remove a member (leader or officer)")
    .addUserOption((o) => o.setName("user").setDescription("Member to remove").setRequired(true)))
  .addSubcommand((c) => c.setName("promote").setDescription("Promote a member to officer (leader only)")
    .addUserOption((o) => o.setName("user").setDescription("Member to promote").setRequired(true)))
  .addSubcommand((c) => c.setName("demote").setDescription("Demote an officer (leader only)")
    .addUserOption((o) => o.setName("user").setDescription("Officer to demote").setRequired(true)))
  .addSubcommand((c) => c.setName("transfer").setDescription("Transfer ownership to a member (leader only)")
    .addUserOption((o) => o.setName("user").setDescription("New leader").setRequired(true))
    .addBooleanOption((o) => o.setName("confirm").setDescription("Confirm ownership transfer").setRequired(true)))
  .addSubcommand((c) => c.setName("upgrade").setDescription("Spend shared renown on the Guild Hall (leader only)"))
  .addSubcommand((c) => c.setName("disband").setDescription("Permanently delete your guild (leader only)")
    .addBooleanOption((o) => o.setName("confirm").setDescription("Confirm permanent disband").setRequired(true))));

function labelItem(id) { return items[id]?.name || id; }
async function savedShop(userId, page = 1) {
  const prefs = await store.getPreferences(userId);
  return ui.shop(userId, page, await store.profile(userId), prefs.shopFilter, prefs.shopSort);
}
async function savedInventory(owner, target = owner) {
  const prefs = await store.getPreferences(owner);
  return ui.inventory(owner, await store.profile(target), 1, prefs.inventoryFilter, prefs.inventorySort);
}
async function savedForge(owner) {
  const prefs = await store.getPreferences(owner);
  return ui.crafting(owner, await store.profile(owner), 1, prefs.forgeFilter);
}
function shop(page) {
  const pages = Math.max(1, Math.ceil(generators.length / 4));
  const selected = Math.max(1, Math.min(page, pages));
  const lines = generators.slice((selected - 1) * 4, selected * 4).map((entry) => {
    const cost = purchaseCost(entry.cost, 0, 1);
    return "**" + entry.id + "** · " + entry.name + " — " + pretty(cost) + " IC · +" + pretty(dec(entry.income)) + " IC/s";
  });
  return "**ARVEE Idle Expeditions** · Page " + selected + "/" + pages + "\n" + lines.join("\n") +
    "\nUse /idle buy with autocomplete to select an expedition. Costs increase as you recruit more.";
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
    if (group === "guild") {
      let note = "";
      if (command === "create") {
        const made = await store.createGuild(id,opts.getString("name",true),opts.getString("tag",true));
        note = "Guild [" + made.tag + "] " + made.name + " created.";
      } else if (command === "invite") {
        const invited = await store.inviteGuild(id,opts.getUser("user",true).id);
        note = "Invitation saved for <@" + invited.inviteeId + ">. They can find it under /idle guild view.";
      } else if (command === "accept") {
        const joined = await store.acceptGuild(id,opts.getString("id",true));
        note = "Joined [" + joined.tag + "] " + joined.name + ".";
      } else if (command === "decline") {
        await store.declineGuild(id,opts.getString("id",true));
        note = "Invitation declined.";
      } else if (command === "leave") {
        if (!opts.getBoolean("confirm",true)) throw new Error("Run /idle guild leave confirm:true to leave.");
        const left = await store.leaveGuild(id);
        note = "Left " + left.name + ".";
      } else if (["kick","promote","demote","transfer"].includes(command)) {
        if (command === "transfer" && !opts.getBoolean("confirm",true))
          throw new Error("Use confirm:true to transfer guild leadership.");
        const changed = await store.manageGuild(id,opts.getUser("user",true).id,command);
        note = "Guild " + changed.action + " completed for <@" + changed.targetId + ">.";
      } else if (command === "upgrade") {
        const upgraded = await store.upgradeGuild(id);
        note = "Guild Hall upgraded to tier " + upgraded.tier + ".";
      } else if (command === "disband") {
        if (!opts.getBoolean("confirm",true)) throw new Error("Use confirm:true to permanently disband your guild.");
        const removed = await store.disbandGuild(id);
        note = "Guild " + removed.name + " disbanded. This cannot be undone.";
      } else if (command === "claim") {
        const earned=await store.claimGuildExpedition(id);
        note="Claimed " + pretty(earned.ic) + " IC and " + earned.quantity +
          "× " + labelItem(earned.itemId) + " from " + earned.name + ".";
      } else if (command === "season_claim") {
        const earned=await store.claimGuildLeagueSeason(id,opts.getString("season",true));
        note="Claimed " + earned.tier + " league rewards: " + pretty(earned.ic) +
          " IC and " + earned.quantity + "× " + labelItem(earned.itemId) + ".";
      } else if (!["view","rankings","expeditions","league"].includes(command))
        throw new Error("Unknown guild action.");
      if (["expeditions","league","claim","season_claim"].includes(command)) {
        const board=await store.getGuildExpeditions(id);
        view=["league","season_claim"].includes(command)?
          ui.guildLeagueBoard(id,board,note):ui.guildExpeditionBoard(id,board,note);
      } else {
        const board=await store.getGuild(id);
        view=command==="rankings"?ui.guildRankings(id,board):ui.guildOverview(id,board,note);
      }
    } else if (group === "market") {
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
        "**Season:** /idle season to unlock 20 free reward tiers",
        "**Contracts:** /idle challenges for daily and weekly rewards",
        "**World Map:** /idle explore to send crew on timed expeditions",
        "**World Boss:** /idle boss for a cross-server cooperative battle",
        "**Guilds:** /idle guild view for global groups, perks and weekly rankings",
        "**Guild Expeditions:** /idle guild expeditions and /idle guild league",
        "**Companions:** /idle companions to choose a pet and hatch eggs",
        "**Equipment:** /idle equipment to boost expedition rewards",
        "**Preferences:** /idle settings to view and reset your saved filters",
        "**Activities:** /idle mine, /idle daily, /idle craft, /idle open",
        "**Items:** /idle inventory, /idle give, /idle market",
        "Prestige requires 1B IC and increases production by 25% per level.",
        "All progress is stored in PostgreSQL. This is a fresh season."
      ].join("\n");
    } else if (command === "profile") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      view = ui.home(id, target, p, target.id !== id);
    } else if (command === "season") {
      view = ui.season(id, await store.seasonStatus(id));
    } else if (command === "challenges") {
      view = ui.challengeBoard(id, await store.getChallenges(id));
    } else if (command === "settings") {
      view = ui.preferences(id, await store.getPreferences(id));
    } else if (command === "explore") {
      view = ui.expeditionMap(id, await store.getExploration(id));
    } else if (command === "boss") {
      view = ui.worldBoss(id, await store.getWorldBoss(id));
    } else if (command === "companions") {
      view = ui.companionCollection(id, await store.getCompanions(id));
    } else if (command === "equipment") {
      view = ui.expeditionGear(id, await store.getExploration(id));
    } else if (command === "shop") {
      view = await savedShop(id, opts.getInteger("page") || 1);
      content = shop(opts.getInteger("page") || 1);
    } else if (command === "buy") {
      const result = await store.buyGenerator(id, opts.getString("generator", true), opts.getInteger("amount") || 1);
      content = "Bought " + result.quantity + " × **" + result.generator.name + "** for **" +
        pretty(result.cost) + " IC**.\nNew balance: " + pretty(result.balance) + " IC · Income: " + pretty(result.rate) + " IC/s.";
    } else if (command === "mine") {
      const result = await store.mine(id);
      view = ui.miningResult(id, result, await store.profile(id));
    } else if (command === "daily") {
      const result = await store.daily(id);
      view = ui.dailyResult(id, result, await store.profile(id));
    } else if (command === "inventory") {
      const target = opts.getUser("user") || interaction.user;
      const p = await store.profile(target.id);
      if (target.id !== id) view = ui.inventoryPreview(id, target, p);
      else {
        const prefs = await store.getPreferences(id);
        view = ui.inventory(id, p, 1, prefs.inventoryFilter, prefs.inventorySort);
      }
    } else if (command === "craft") {
      const item = opts.getString("item");
      if (!item) {
        view = await savedForge(id);
      } else {
        const qty = opts.getInteger("amount") || 1;
        await store.craft(id, item, qty);
        view = ui.craftingResult(id, item, qty);
      }
    } else if (command === "open") {
      const drops = await store.openLootbox(id, opts.getInteger("amount") || 1, opts.getString("type") || "lootbox");
      view = ui.cacheResult(id, drops);
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
        content = "Prestige **" + result.prestige + "**! Permanent production multiplier: " + result.multiplier.toString() + "×.";
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
  const term = String(focus.value || "").toLowerCase().slice(0, 100);
  let choices;
  if (focus.name === "generator") {
    choices = generators.filter((g) =>
      (g.name + " " + g.id).toLowerCase().includes(term))
      .slice(0, 25).map((g) => ({ name: g.name.slice(0, 100), value: g.id }));
  } else if (focus.name === "item") {
    choices = Object.entries(items).filter(([id, data]) =>
      (data.name + " " + id).toLowerCase().includes(term))
      .slice(0, 25).map(([id, data]) => ({ name: data.name.slice(0, 100), value: id }));
  } else return false;
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
      else if (selected === "shop") view = await savedShop(owner);
      else if (selected === "inventory") view = await savedInventory(owner);
      else if (selected === "craft") view = await savedForge(owner);
      else if (selected === "season") view = ui.season(owner, await store.seasonStatus(owner));
      else if (selected === "challenges") view = ui.challengeBoard(owner, await store.getChallenges(owner));
      else if (selected === "settings") view = ui.preferences(owner, await store.getPreferences(owner));
      else if (selected === "explore") view = ui.expeditionMap(owner, await store.getExploration(owner));
      else if (selected === "boss") view = ui.worldBoss(owner, await store.getWorldBoss(owner));
      else if (selected === "guild") view = ui.guildOverview(owner,await store.getGuild(owner));
      else if (selected === "companions") view = ui.companionCollection(owner, await store.getCompanions(owner));
      else if (selected === "equipment") view = ui.expeditionGear(owner, await store.getExploration(owner));
      else if (selected === "market") view = ui.market(owner, await store.browseMarket());
      else if (selected === "pickaxe") view = ui.pickaxe(owner, await store.profile(owner));
      else if (selected === "perks") view = ui.perks(owner, await store.profile(owner), require("./catalog").perks);
      else if (selected === "stats") view = ui.stats(owner, await store.getStats(owner));
      else if (selected === "leaderboard") view = ui.leaderboard(owner, await store.leaderboard());
      else if (selected === "prestige") view = ui.prestige(owner, await store.profile(owner));
      else if (selected === "help") view = ui.help(owner);
      else throw new Error("Unknown navigation destination.");
    } else if (action === "season") {
      view = ui.season(owner, await store.seasonStatus(owner), Number(argument) || 1);
    } else if (action === "season_claim") {
      const tier = Number(argument);
      if (!Number.isInteger(tier) || tier < 1 || tier > 20) throw new Error("Invalid season tier.");
      result = await store.claimSeasonRewards(owner, tier);
      view = ui.season(owner, await store.seasonStatus(owner), Math.ceil(tier / 4),
        result.grants.length ? "Tier " + tier + " reward claimed!" : "Already collected.");
    } else if (action === "season_claim_all") {
      result = await store.claimSeasonRewards(owner, "all");
      view = ui.season(owner, await store.seasonStatus(owner), Number(argument) || 1,
        result.grants.length ? "Claimed " + result.grants.length + " rewards!" : "Nothing new to claim.");
    } else if (action === "challenges") {
      view = ui.challengeBoard(owner, await store.getChallenges(owner), argument);
    } else if (action === "challenge_scope") {
      view = ui.challengeBoard(owner, await store.getChallenges(owner), selected);
    } else if (action === "challenge_claim") {
      const match = argument.match(/^(daily|weekly)_([0-9]{8})_([a-z_]{3,40})$/);
      if (!match) throw new Error("Invalid challenge selection.");
      result = await store.claimChallenge(owner, match[1], match[2], match[3]);
      view = ui.challengeBoard(owner, await store.getChallenges(owner), match[1],
        result.claimed ? "Claimed " + result.reward + "!" : "Already claimed.");
    } else if (action === "settings") {
      view = ui.preferences(owner, await store.getPreferences(owner));
    } else if (action === "preferences_reset") {
      view = ui.preferences(owner, await store.resetPreferences(owner), "Defaults restored. New filters save automatically.");
    } else if (action === "companions") {
      view = ui.companionCollection(owner, await store.getCompanions(owner));
    } else if (action === "companion_adopt") {
      result = await store.adoptCompanion(owner, selected);
      view = ui.companionCollection(owner, await store.getCompanions(owner),
        result.name + " joined your adventure.");
    } else if (action === "companion_select") {
      result = await store.equipCompanion(owner, selected);
      view = ui.companionCollection(owner, await store.getCompanions(owner),
        result.name + " is now active.");
    } else if (action === "companion_hatch") {
      result = await store.hatchCompanion(owner);
      view = ui.companionCollection(owner, await store.getCompanions(owner),
        result.discovered ? "Discovered " + result.name + "!" :
          result.name + " bonded with you. +" + result.bonusXp + " companion XP.");
    } else if (action === "guild") {
      view = ui.guildOverview(owner,await store.getGuild(owner));
    } else if (action === "guild_rankings") {
      view = ui.guildRankings(owner,await store.getGuild(owner));
    } else if (action === "guild_accept") {
      result = await store.acceptGuild(owner,selected);
      view = ui.guildOverview(owner,await store.getGuild(owner),
        "Joined [" + result.tag + "] " + result.name + ".");
    } else if (action === "guild_upgrade") {
      result = await store.upgradeGuild(owner);
      view = ui.guildOverview(owner,await store.getGuild(owner),
        "Guild Hall upgraded to tier " + result.tier + ".");
    } else if (action === "gexp") {
      view = ui.guildExpeditionBoard(owner,await store.getGuildExpeditions(owner));
    } else if (action === "gexp_league") {
      view = ui.guildLeagueBoard(owner,await store.getGuildExpeditions(owner));
    } else if (action === "gexp_claim") {
      result = await store.claimGuildExpedition(owner);
      view = ui.guildExpeditionBoard(owner,await store.getGuildExpeditions(owner),
        "Claimed " + pretty(result.ic) + " IC and " + result.quantity +
        "× " + labelItem(result.itemId) + ".");
    } else if (action === "gexp_season_claim") {
      result = await store.claimGuildLeagueSeason(owner,argument);
      view = ui.guildLeagueBoard(owner,await store.getGuildExpeditions(owner),
        "Claimed " + result.tier + " season reward: " + pretty(result.ic) + " IC.");
    } else if (action === "boss") {
      view = ui.worldBoss(owner, await store.getWorldBoss(owner));
    } else if (action === "boss_attack") {
      result = await store.attackWorldBoss(owner);
      view = ui.worldBoss(owner, await store.getWorldBoss(owner),
        "Your strike dealt " + result.damage + " damage." +
        (result.finished ? " The boss is defeated!" : ""));
    } else if (action === "boss_claim") {
      result = await store.claimWorldBossReward(owner, argument);
      view = ui.worldBoss(owner, await store.getWorldBoss(owner),
        "Claimed " + pretty(result.ic) + " IC and " + result.quantity + "× " +
        labelItem(result.itemId) + (result.rare ? " plus a Rare Supply Cache." : "."));
    } else if (action === "explore") {
      view = ui.expeditionMap(owner, await store.getExploration(owner));
    } else if (action === "region_view") {
      view = ui.expeditionRegion(owner, await store.getExploration(owner), argument);
    } else if (action === "expedition_start") {
      result = await store.startExpedition(owner, argument);
      view = ui.expeditionMap(owner, await store.getExploration(owner),
        result.region + " expedition started. Your rewards will be ready when the timer ends.");
    } else if (action === "expedition_collect") {
      result = await store.collectExpedition(owner);
      view = ui.expeditionMap(owner, await store.getExploration(owner),
        (result.outcome === "success" ? "Mission successful! " : "A setback, but the crew returned. ") +
        "+" + pretty(result.credits) + " IC, +" + result.experience + " exploration XP, " +
        result.quantity + "× " + labelItem(result.itemId) + (result.egg ? " · Companion Egg found!" : "") + ".");
    } else if (action === "equipment") {
      view = ui.expeditionGear(owner, await store.getExploration(owner));
    } else if (action === "equipment_select" || action === "equipment_upgrade") {
      const gearId = action === "equipment_select" ? selected : argument;
      result = await store.upgradeExpeditionGear(owner, gearId);
      view = ui.expeditionGear(owner, await store.getExploration(owner),
        result.equipment + " upgraded to level " + result.level + "!");
    } else if (action === "profile") {
      view = ui.home(owner, interaction.user, await store.profile(owner));
    } else if (action === "shop") {
      const { page, filter, sort } = ui.parseListState(argument, "shop");
      const prefs = await store.getPreferences(owner);
      view = ui.shop(owner, page, await store.profile(owner),
        argument.includes("_") ? filter : prefs.shopFilter,
        argument.includes("_") ? sort : prefs.shopSort);
    } else if (action === "shop_filters") {
      const { page, filter, sort } = ui.parseListState(argument, "shop");
      view = ui.shopFilters(owner, page, filter, sort);
    } else if (action === "shop_filter_set") {
      const [filter, sort] = argument.split("_");
      const prefs = await store.setPreferences(owner, { shopFilter: filter, shopSort: sort });
      view = ui.shop(owner, 1, await store.profile(owner), prefs.shopFilter, prefs.shopSort);
    } else if (action === "shop_filter") {
      const prefs = await store.setPreferences(owner, { shopFilter: selected });
      view = ui.shop(owner, 1, await store.profile(owner), prefs.shopFilter, prefs.shopSort);
    } else if (action === "shop_sort") {
      const prefs = await store.setPreferences(owner, { shopSort: selected });
      view = ui.shop(owner, 1, await store.profile(owner), prefs.shopFilter, prefs.shopSort);
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
      view = ui.miningResult(owner, result, await store.profile(owner));
    } else if (action === "daily") {
      result = await store.daily(owner);
      view = ui.dailyResult(owner, result, await store.profile(owner));
    } else if (action === "inventory") {
      const { page, filter, sort } = ui.parseListState(argument, "inventory");
      const prefs = await store.getPreferences(owner);
      view = ui.inventory(owner, await store.profile(owner), page,
        argument.includes("_") ? filter : prefs.inventoryFilter,
        argument.includes("_") ? sort : prefs.inventorySort);
    } else if (action === "inventory_filters") {
      const { page, filter, sort } = ui.parseListState(argument, "inventory");
      view = ui.inventoryFilters(owner, page, filter, sort);
    } else if (action === "inventory_filter_set") {
      const [filter, sort] = argument.split("_");
      const prefs = await store.setPreferences(owner, { inventoryFilter: filter, inventorySort: sort });
      view = ui.inventory(owner, await store.profile(owner), 1, prefs.inventoryFilter, prefs.inventorySort);
    } else if (action === "inventory_filter") {
      const prefs = await store.setPreferences(owner, { inventoryFilter: selected });
      view = ui.inventory(owner, await store.profile(owner), 1, prefs.inventoryFilter, prefs.inventorySort);
    } else if (action === "inventory_sort") {
      const prefs = await store.setPreferences(owner, { inventorySort: selected });
      view = ui.inventory(owner, await store.profile(owner), 1, prefs.inventoryFilter, prefs.inventorySort);
    } else if (action === "item_view") {
      const p = await store.profile(owner);
      view = ui.item(owner, argument, p.inventory.find((e) => e.item_id === argument)?.quantity || 0);
    } else if (action === "item_select") {
      const p = await store.profile(owner);
      const quantity = p.inventory.find((r) => r.item_id === selected)?.quantity || 0;
      view = ui.item(owner, selected, quantity, argument);
    } else if (action === "use_item") {
      result = await store.useItem(owner, argument);
      view = ui.message("Item used", "**" + labelItem(result.itemId) + "** · " + result.message, owner, { color: ui.SUCCESS });
    } else if (action === "open_one") {
      const drops = await store.openLootbox(owner, 1, argument);
      view = ui.cacheResult(owner, drops);
    } else if (action === "craft") {
      const { page, filter } = ui.parseCraftState(argument);
      const prefs = await store.getPreferences(owner);
      view = ui.crafting(owner, await store.profile(owner), page,
        argument.includes("_") ? filter : prefs.forgeFilter);
    } else if (action === "craft_filter") {
      const prefs = await store.setPreferences(owner, { forgeFilter: selected });
      view = ui.crafting(owner, await store.profile(owner), 1, prefs.forgeFilter);
    } else if (action === "recipe_view") {
      view = ui.recipe(owner, argument, await store.profile(owner));
    } else if (action === "recipe_select") {
      view = ui.recipe(owner, selected, await store.profile(owner));
    } else if (action === "craft_one" || action === "craft_five") {
      const quantity = action === "craft_five" ? 5 : 1;
      await store.craft(owner, argument, quantity);
      view = ui.craftingResult(owner, argument, quantity);
    } else if (action === "market") {
      view = ui.market(owner, await store.browseMarket());
    } else if (action === "listing_select") {
      view = ui.listing(owner, await store.getListing(selected));
    } else if (action === "listing_buy") {
      result = await store.buyListing(owner, argument);
      view = ui.message("Purchase completed", result.quantity + "× " + labelItem(result.item) + " for " + pretty(result.price) + " IC.", owner, { color: ui.SUCCESS });
    } else if (action === "listing_cancel") {
      result = await store.cancelListing(owner, argument);
      view = ui.message("Listing cancelled", result.quantity + "× " + labelItem(result.item) + " returned.", owner, { color: ui.SUCCESS });
    } else if (action === "leaderboard") {
      view = ui.leaderboard(owner, await store.leaderboard());
    } else if (action === "prestige") {
      view = ui.prestige(owner, await store.profile(owner));
    } else if (action === "prestige_confirm") {
      result = await store.prestige(owner);
      view = ui.message("Prestige complete", "You are now **Prestige " + result.prestige + "**!", owner, { color: ui.SUCCESS });
    } else if (action === "pickaxe") {
      view = ui.pickaxe(owner, await store.profile(owner));
    } else if (action === "pickaxe_upgrade") {
      result = await store.upgradePickaxe(owner);
      view = ui.message("Pickaxe upgraded", "Tier **" + result.tier + "** unlocked!", owner, { color: ui.SUCCESS });
    } else if (action === "perks") {
      view = ui.perks(owner, await store.profile(owner), require("./catalog").perks);
    } else if (action === "stats") {
      view = ui.stats(owner, await store.getStats(owner));
    } else if (action === "perk_respec") {
      view = ui.perkRespec(owner);
    } else if (action === "perk_respec_confirm") {
      result = await store.respecPerks(owner);
      view = ui.message("Perks reset", "Removed " + result.removed + " perk(s). You can unlock new ones.", owner, { color: ui.SUCCESS });
    } else if (action === "perk_select") {
      result = await store.upgradePerk(owner, selected);
      view = ui.message("Perk upgraded", require("./catalog").perks[result.perkId].name + " is now level **" + result.level + "**.", owner, { color: ui.SUCCESS });
    } else return true;
    await interaction.editReply({ components: [view], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[ARVEE Idle component]", error);
    await interaction.followUp({ content: "✦ " + uiError(error).slice(0, 1800), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(console.error);
  }
  return true;
}
module.exports = { idle, respond, handleAutocomplete, handleComponent, shop };
