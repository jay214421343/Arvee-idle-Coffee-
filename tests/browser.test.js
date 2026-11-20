"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validate,run,execute}=require("../src/browser");
const ecosystem=require("../src/ecosystem");
const user={id:"123456789012345678",username:"Browser Player"};
test("browser commands validate Discord option types, bounds and allowed commands",()=>{
  for(const action of [
    {kind:"command",command:"admin"},
    {kind:"command",command:"buy",options:{generator:"A1",amount:-1}},
    {kind:"command",command:"buy",options:{generator:"A1",amount:1.5}},
    {kind:"command",command:"prestige",options:{confirm:"true"}},
    {kind:"command",command:"give",options:{user:"invalid",item:"ore"}},
    {kind:"command",command:"mine",options:{balance:100000}},
    {kind:"command",command:"mine",userId:"999999999999999999"}
  ]) assert.throws(()=>validate(action,user.id),{status:400});
  assert.doesNotThrow(()=>validate({kind:"command",command:"buy",options:{generator:"A1",amount:1}},user.id));
});
test("components cannot impersonate another player or inject arbitrary values",()=>{
  assert.throws(()=>validate({kind:"button",customId:"ai:2:999999999999999999:mine:"},user.id),{status:400});
  assert.throws(()=>validate({kind:"select",customId:`ai:2:${user.id}:navigate:`,values:["profile","mine"]},user.id),{status:400});
  assert.throws(()=>validate({kind:"select",customId:`ai:2:${user.id}:navigate:`,values:["../admin"]},user.id),{status:400});
});
test("browser dispatch uses the authenticated identity and existing gameplay handlers",async()=>{
  const result=await run(user,{kind:"command",command:"mine"},{
    routeTutorial:async(interaction,respond)=>respond(interaction),
    respond:async interaction=>{
      assert.equal(interaction.user.id,user.id); assert.equal(interaction.options.getSubcommand(),"mine");
      await interaction.editReply({components:[{type:10,content:"Mined"}]});
    }
  });
  assert.equal(result.view.components[0].content,"Mined");
});
test("native cosmetic presets with spaces remain playable in the browser",()=>{
  const action={kind:"select",customId:`ai:2:${user.id}:customize_set:tag`,values:["ARVEE Veteran"]};
  assert.doesNotThrow(()=>validate(action,user.id));
  assert.doesNotThrow(()=>validate({...action,values:["Astral Cartographer"]},user.id));
  assert.throws(()=>validate({...action,values:["<script>alert(1)</script>"]},user.id),{status:400});
});
test("receipt reservation replays results once and rejects changed or uncertain requests",async()=>{
  const rows=new Map();
  const pool={async query(sql,args){
    const key=args[0]+args[1];
    if(sql.startsWith("INSERT")) { if(rows.has(key))return {rowCount:0}; rows.set(key,{input_hash:args[2],response:null}); return {rowCount:1}; }
    if(sql.startsWith("SELECT"))return {rows:[rows.get(key)]};
    rows.get(key).response=JSON.parse(args[2]); return {rowCount:1};
  }};
  let calls=0,release;
  const requestId=Date.now().toString(36)+".12345678-1234-4234-8234-123456789abc",action={kind:"command",command:"mine"};
  const pending=execute(pool,user,action,requestId,async()=>{calls++;await new Promise(resolve=>{release=resolve;});return {notices:["done"],view:null};});
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(execute(pool,user,action,requestId),{status:409});
  release(); const result=await pending;
  assert.deepEqual(await execute(pool,user,action,requestId),result); assert.equal(calls,1);
  await assert.rejects(execute(pool,user,{kind:"command",command:"daily"},requestId),{status:400});
  const expired=(Date.now()-86400001).toString(36)+".12345678-1234-4234-8234-123456789abc";
  await assert.rejects(execute(pool,user,action,expired),{status:400});
  const future=(Date.now()+600000).toString(36)+".12345678-1234-4234-8234-123456789abc";
  await assert.rejects(execute(pool,user,action,future),{status:400});
});
test("membership transport fails closed, verifies identity and grants only cosmetic milestones",async()=>{
  const environment={ARVEE_ECOSYSTEM_URL:"http://127.0.0.1:3081",ARVEE_ECOSYSTEM_KEY:"x".repeat(32)};
  const unavailable=await ecosystem.account(user.id,{environment,fetch:async()=>{throw Error("offline");}});
  assert.equal(unavailable.available,false); assert.equal(unavailable.membership,null);
  const mismatch=await ecosystem.account(user.id,{environment,fetch:async()=>Response.json({version:1,userId:"999999999999999999",membership:{tier:"inferno"}})});
  assert.equal(mismatch.membership,null);
  assert.deepEqual(ecosystem.earnedCosmetics({rpg:{level:25,prestige:1}}),["realm_traveler","cycle_companion"]);
  assert.deepEqual(ecosystem.earnedCosmetics({rpg:{level:24,prestige:0}}),[]);
  assert.throws(()=>ecosystem.connection({ARVEE_ECOSYSTEM_URL:"http://evil.example",ARVEE_ECOSYSTEM_KEY:"x".repeat(32)}));
});
