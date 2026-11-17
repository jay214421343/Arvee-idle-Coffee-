"use strict";
const { SlashCommandBuilder, MessageFlags }=require("discord.js");
const { items, generators, perks }=require("./catalog");
const companions=require("./companions");
const { isAdmin, ADMIN_GUILD_ID }=require("./admin-auth");
const adminStore=require("./admin-store");
const adminCommand=new SlashCommandBuilder().setName("admin")
  .setDescription("Private ARVEE Idle owner administration");
const user=(o)=>o.setName("user").setDescription("Player to manage").setRequired(true);
const mode=(o,choices)=>o.setName("mode").setDescription("Adjustment type").setRequired(true)
  .addChoices(...choices.map(([name,value])=>({name,value})));
const qty=(o,name="quantity",max=1000000)=>o.setName(name).setDescription("Nonnegative amount")
  .setRequired(true).setMinValue(0).setMaxValue(max);
const edits=[["Set","set"],["Add","add"],["Remove","take"]];
adminCommand
  .addSubcommand(c=>c.setName("status").setDescription("Private game health, player counts and suspensions"))
  .addSubcommand(c=>c.setName("inspect").setDescription("Inspect player economy, inventory, season and companions")
    .addUserOption(user))
  .addSubcommand(c=>c.setName("balance").setDescription("Set, grant or remove Idle Credits")
    .addUserOption(user)
    .addStringOption(o=>mode(o,edits))
    .addStringOption(o=>o.setName("amount").setDescription("Whole number of IC (up to 1e24)")
      .setRequired(true).setMinLength(1).setMaxLength(27)))
  .addSubcommand(c=>c.setName("item").setDescription("Set, grant or remove a catalog item")
    .addUserOption(user)
    .addStringOption(o=>mode(o,edits))
    .addStringOption(o=>o.setName("item").setDescription("Item ID").setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>qty(o)))
  .addSubcommand(c=>c.setName("operation").setDescription("Set or adjust an owned operation")
    .addUserOption(user)
    .addStringOption(o=>mode(o,edits))
    .addStringOption(o=>o.setName("operation").setDescription("Operation ID").setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>qty(o,"quantity",10000)))
  .addSubcommand(c=>c.setName("progress").setDescription("Set prestige, mining XP, pickaxe tier or sigils")
    .addUserOption(user)
    .addStringOption(o=>o.setName("field").setDescription("Progress field").setRequired(true)
      .addChoices({name:"Prestige",value:"prestige"},{name:"Mining XP",value:"mine_xp"},
        {name:"Pickaxe tier",value:"pickaxe_tier"},{name:"Astral Sigils",value:"orbs"}))
    .addIntegerOption(o=>qty(o,"value",100000000)))
  .addSubcommand(c=>c.setName("seasonxp").setDescription("Set or add season XP without granting duplicate rewards")
    .addUserOption(user)
    .addStringOption(o=>mode(o,[["Set","set"],["Add","add"]]))
    .addIntegerOption(o=>qty(o,"amount",1000000000)))
  .addSubcommand(c=>c.setName("perk").setDescription("Set a permanent perk level")
    .addUserOption(user)
    .addStringOption(o=>o.setName("perk").setDescription("Perk").setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>qty(o,"level",10)))
  .addSubcommand(c=>c.setName("companion").setDescription("Unlock, remove, equip or manage a companion's XP")
    .addUserOption(user)
    .addStringOption(o=>mode(o,[["Unlock","unlock"],["Remove","remove"],["Equip","equip"],
      ["Set XP","xp_set"],["Add XP","xp_add"]]))
    .addStringOption(o=>o.setName("companion").setDescription("Companion species").setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>o.setName("xp").setDescription("XP for set/add actions").setMinValue(0).setMaxValue(43500)))
  .addSubcommand(c=>c.setName("cooldown").setDescription("Reset mining or daily claim cooldown")
    .addUserOption(user)
    .addStringOption(o=>o.setName("type").setDescription("Cooldown to reset").setRequired(true)
      .addChoices({name:"Mining",value:"mine"},{name:"Daily",value:"daily"},{name:"Both",value:"both"})))
  .addSubcommand(c=>c.setName("suspend").setDescription("Suspend or restore a game account")
    .addUserOption(user)
    .addStringOption(o=>mode(o,[["Suspend","suspend"],["Unsuspend","unsuspend"]]))
    .addStringOption(o=>o.setName("reason").setDescription("Reason (required for suspensions)").setMaxLength(240)))
  .addSubcommand(c=>c.setName("audit").setDescription("Review recent owner actions")
    .addUserOption(o=>o.setName("user").setDescription("Filter by player"))
    .addIntegerOption(o=>o.setName("limit").setDescription("Last 1–20 changes").setMinValue(1).setMaxValue(20)));
function permitted(interaction) {return isAdmin(interaction?.user?.id,interaction?.guildId);}
function safeText(value){return String(value).slice(0,1800);}
async function respondAdmin(interaction) {
  if(!interaction.isChatInputCommand?.()||interaction.commandName!=="admin")return false;
  if(!permitted(interaction)){
    await interaction.reply({content:"Private owner command. Access denied.",flags:MessageFlags.Ephemeral,
      allowedMentions:{parse:[]}});
    return true;
  }
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try {
    const sub=interaction.options.getSubcommand(), opts=interaction.options;
    const actorId=interaction.user.id,guildId=interaction.guildId;
    let message;
    if(sub==="status"){
      const s=await adminStore.status(actorId,guildId);
      message="**ARVEE IDLE  /  ADMIN**\nPlayers: "+s.players+"  ·  Suspended: "+s.suspensions+
        "  ·  Season claims: "+s.claims+"  ·  Audit entries: "+s.changes+
        "\nAuthorized owner: "+actorId+"  ·  Server: "+ADMIN_GUILD_ID;
    }else if(sub==="audit"){
      const rows=await adminStore.audit(actorId,guildId,opts.getUser("user")?.id||null,opts.getInteger("limit")||10);
      message="**ADMIN  /  AUDIT**\n"+(rows.length?rows.map(r=>
        "#"+r.id+" "+r.action+"  ·  "+r.target_id+"  ·  "+
        JSON.stringify(r.details).slice(0,105)).join("\n"):"No admin edits recorded.");
    }else if(sub==="inspect"){
      const p=await adminStore.inspect(actorId,guildId,opts.getUser("user",true).id);
      message="**ADMIN  /  PLAYER "+p.id+"**\n**Wallet**  "+p.balance+" IC"+
        " · Lifetime "+p.totalEarned+"\n**Progress**  P"+p.prestige+
        " · Pickaxe "+p.pickaxeTier+" · Mine XP "+p.mineXp+" · Sigils "+p.orbs+
        "\n**Season XP**  "+p.seasonXp+"\n**Suspension**  "+(p.suspension||"None")+
        "\n**Operations**  "+(p.operations.slice(0,12).map(x=>x.generator_id+" ×"+x.quantity).join(", ")||"None")+
        (p.operations.length>12?" …":"")+
        "\n**Satchel**  "+(p.items.slice(0,18).map(x=>x.item_id+" ×"+x.quantity).join(", ")||"Empty")+
        (p.items.length>18?" …":"")+
        "\n**Companions**  "+(p.pets.map(x=>x.pet_id+" XP"+x.xp).join(", ")||"None");
    }else{
      const targetId=opts.getUser("user",true).id;
      const type={balance:"balance",item:"item",operation:"operation",progress:"progress",
        seasonxp:"seasonxp",perk:"perk",companion:"companion",cooldown:"cooldown",
        suspend:"suspend"}[sub];
      if(!type)throw new Error("Unknown administration command.");
      const field=sub==="progress"?opts.getString("field",true):
        sub==="perk"?opts.getString("perk",true):
        sub==="cooldown"?opts.getString("type",true):undefined;
      const value=sub==="balance"?opts.getString("amount",true):
        sub==="item"||sub==="operation"?opts.getInteger("quantity",true):
        sub==="progress"?opts.getInteger("value",true):
        sub==="seasonxp"?opts.getInteger("amount",true):
        sub==="perk"?opts.getInteger("level",true):
        sub==="companion"?opts.getInteger("xp"):undefined;
      if(sub==="companion"&&["xp_set","xp_add"].includes(opts.getString("mode",true))&&value===null)
        throw new Error("Companion XP is required for XP adjustments.");
      const result=await adminStore.action({
        actorId,guildId,interactionId:interaction.id,type,targetId,
        mode:["progress","perk","cooldown"].includes(sub)?"set":opts.getString("mode",true),
        value,itemId:sub==="item"?opts.getString("item",true):undefined,
        operationId:sub==="operation"?opts.getString("operation",true):undefined,
        petId:sub==="companion"?opts.getString("companion",true):undefined,
        field,reason:sub==="suspend"?opts.getString("reason"):undefined
      });
      message="**ADMIN  /  SUCCESS**\nTarget: "+targetId+"\n"+result+
        "\nSaved transactionally. This action is recorded in the private audit log.";
    }
    await interaction.editReply({content:safeText(message),allowedMentions:{parse:[]}});
  }catch(error){
    console.error("[ARVEE Idle admin]",error.message);
    const detail=/SQL|relation|column|syntax|connect|pool|password|database/i.test(error.message)?
      "A database operation failed. Check migrations or service logs." : error.message;
    await interaction.editReply({content:"**ADMIN  /  ERROR**\n"+safeText(detail),
      allowedMentions:{parse:[]}}).catch(console.error);
  }
  return true;
}
async function handleAdminAutocomplete(interaction) {
  if(!interaction.isAutocomplete?.()||interaction.commandName!=="admin")return false;
  if(!permitted(interaction)){await interaction.respond([]);return true;}
  const focus=interaction.options.getFocused(true),term=String(focus.value||"").toLowerCase().slice(0,100);
  const options=focus.name==="item"?Object.entries(items).map(([id,data])=>[id,data.name]):
    focus.name==="operation"?generators.map(g=>[g.id,g.name]):
    focus.name==="companion"?companions.PETS.map(p=>[p.id,p.name]):
    focus.name==="perk"?Object.entries(perks).map(([id,data])=>[id,data.name]):[];
  await interaction.respond(options.filter(([id,name])=>
    (id+" "+name).toLowerCase().includes(term)).slice(0,25).map(([id,name])=>({name:name.slice(0,100),value:id})));
  return true;
}
module.exports={adminCommand,respondAdmin,handleAdminAutocomplete,permitted};
