"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const { adminCommand,respondAdmin,handleAdminAutocomplete,permitted }=require("../src/admin-command");
const { OWNER_ID, ADMIN_GUILD_ID, requireAdmin }=require("../src/admin-auth");
const service=require("../src/admin-store");
const commands=adminCommand.toJSON();
test("/admin is owner-only and rejects all users outside the admin server",async()=>{
  assert.equal(OWNER_ID,"801148038269763644");
  assert.equal(ADMIN_GUILD_ID,"1391028658835034243");
  assert.equal(permitted({user:{id:OWNER_ID},guildId:ADMIN_GUILD_ID}),true);
  assert.equal(permitted({user:{id:OWNER_ID},guildId:"1391028658835034244"}),false);
  assert.equal(permitted({user:{id:"801148038269763645"},guildId:ADMIN_GUILD_ID}),false);
  assert.throws(()=>requireAdmin("801148038269763645",ADMIN_GUILD_ID),/only/);
  await assert.rejects(()=>service.action({actorId:"801148038269763645",guildId:ADMIN_GUILD_ID,
    interactionId:"123456789012345678",targetId:"123456789012345678",type:"balance",mode:"set",value:"1"}),/only/);
  await assert.rejects(()=>service.inspect(OWNER_ID,"1391028658835034244","123456789012345678"),/only/);
  await assert.rejects(()=>service.audit("801148038269763645",ADMIN_GUILD_ID),/only/);
});
test("owner-only guild command is registered separately from the global player command",()=>{
  assert.equal(commands.name,"admin");
  assert.ok(commands.options.length>=10);
  const cmdNames=new Set(commands.options.map(o=>o.name));
  for(const name of ["status","inspect","balance","item","operation","progress","seasonxp",
    "perk","companion","cooldown","suspend","audit"]) assert.ok(cmdNames.has(name),name);
  for(const sub of commands.options)assert.ok(sub.type===1);
  assert.equal(commands.options.find(o=>o.name==="item").options.find(o=>o.name==="item").autocomplete,true);
  const registration=fs.readFileSync(require.resolve("../src/register"),"utf8");
  assert.match(registration,/Routes[.]applicationGuildCommands\(clientId, ADMIN_GUILD_ID\)/);
  assert.match(registration,/rest[.]post\(Routes[.]applicationGuildCommands\(clientId, ADMIN_GUILD_ID\)/);
  assert.doesNotMatch(registration,/rest[.]put\(/i);
  const dispatcher=fs.readFileSync(require.resolve("../src/index"),"utf8");
  assert.match(dispatcher,/respondAdmin\(interaction\)/);
  assert.match(dispatcher,/handleAdminAutocomplete\(interaction\)/);
});
test("unauthorized /admin refuses before defer or accessing database",async()=>{
  let response,called=false;
  const interaction={user:{id:"801148038269763645"},guildId:ADMIN_GUILD_ID,commandName:"admin",
    isChatInputCommand:()=>true,
    deferReply:async()=>{called=true;},
    reply:async p=>{response=p;}};
  assert.equal(await respondAdmin(interaction),true);
  assert.equal(called,false);
  assert.match(response.content,/denied/);
  assert.ok(response.flags);
  assert.deepEqual(response.allowedMentions,{parse:[]});
  let suggestions=null;
  await handleAdminAutocomplete({...interaction,isAutocomplete:()=>true,
    options:{getFocused:()=>({name:"item",value:"ore"})},
    respond:async x=>{suggestions=x;}});
  assert.deepEqual(suggestions,[]);
});
test("admin autocomplete shows only matching known IDs to verified owner",async()=>{
  let suggestions=null;
  await handleAdminAutocomplete({user:{id:OWNER_ID},guildId:ADMIN_GUILD_ID,commandName:"admin",
    isAutocomplete:()=>true,options:{getFocused:()=>({name:"item",value:"cocktail"})},
    respond:async x=>{suggestions=x;}});
  assert.ok(suggestions.some(s=>s.value==="rebirth_cocktail"));
  assert.ok(suggestions.length<=25);
});
test("admin credit adjustment validates whole numbers and refuses invalid or huge amounts",()=>{
  assert.equal(service.credits("0").toFixed(0),"0");
  assert.equal(service.credits("100000000000000000000").toFixed(0),"100000000000000000000");
  assert.throws(()=>service.credits("-5"),/whole number/);
  assert.throws(()=>service.credits("2.5"),/whole number/);
  assert.throws(()=>service.credits("1000000000000000000000001"),/1e24/);
  assert.throws(()=>service.whole(-1,0,10),/between/);
});
