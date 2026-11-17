"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {routeTutorial}=require("../src/tutorial-router");
const tutorial=require("../src/tutorial-store");
const owner="123456789012345678";
function fake(group="none",command="mine"){
  const calls={deferred:0,response:null,regular:0};
  const interaction={user:{id:owner},commandName:"idle",deferred:false,
    isChatInputCommand:()=>true,
    options:{getSubcommandGroup:()=>group==="none"?null:group,getSubcommand:()=>command},
    deferReply:async()=>{calls.deferred++;interaction.deferred=true;},
    editReply:async reply=>{calls.response=reply;}};
  return {calls,interaction};
}
test("first /idle action displays guide once rather than spending or rewarding",async()=>{
  const orig=tutorial.startIfNew;tutorial.startIfNew=async()=>true;
  try{
    const {calls,interaction}=fake();
    await routeTutorial(interaction,async()=>{calls.regular++;});
    assert.equal(calls.regular,0);
    assert.equal(calls.deferred,1);
    assert.match(JSON.stringify(calls.response),/STEP 1 OF 7/);
    assert.match(JSON.stringify(calls.response),/Skip guide/);
  }finally{tutorial.startIfNew=orig;}
});
test("returning player executes normal /idle command with exactly one defer",async()=>{
  const orig=tutorial.startIfNew;tutorial.startIfNew=async()=>false;
  try{
    const {calls,interaction}=fake();
    await routeTutorial(interaction,async()=>{
      calls.regular++;
      assert.equal(interaction.deferred,true);
    });
    assert.equal(calls.regular,1);
    assert.equal(calls.deferred,1);
    assert.equal(calls.response,null);
  }finally{tutorial.startIfNew=orig;}
});
test("explicit /idle account tutorial restarts guide for a returning player",async()=>{
  const a=tutorial.startIfNew,b=tutorial.restart;let touched=false;
  tutorial.startIfNew=async()=>{touched=true;};
  tutorial.restart=async()=>({status:"active",step:0});
  try{
    const {calls,interaction}=fake("account","tutorial");
    await routeTutorial(interaction,async()=>{calls.regular++;});
    assert.equal(touched,false);
    assert.equal(calls.regular,0);
    assert.match(JSON.stringify(calls.response),/STEP 1 OF 7/);
  }finally{tutorial.startIfNew=a;tutorial.restart=b;}
});
test("onboarding database failure blocks the original action rather than running it",async()=>{
  const orig=tutorial.startIfNew;tutorial.startIfNew=async()=>{throw Error("Unreachable database");};
  const error=console.error;console.error=()=>{};
  try{
    const {calls,interaction}=fake();
    await routeTutorial(interaction,async()=>{calls.regular++;});
    assert.equal(calls.regular,0);
    assert.match(JSON.stringify(calls.response),/Guide unavailable/);
  }finally{tutorial.startIfNew=orig;console.error=error;}
});
