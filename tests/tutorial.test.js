"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {STEPS}=require("../src/tutorial-data");
const {idle,handleComponent}=require("../src/commands"),ui=require("../src/ui");
const store=require("../src/tutorial-store");
const owner="123456789012345678",other="123456789012345679";
const buttons=(c)=>c.components.filter(x=>x.type===1).flatMap(x=>x.components).filter(x=>x.type===2);
test("seven steps accurately teach the actual game without consuming resources",()=>{
  assert.equal(STEPS.length,7);
  for(const [i,step] of STEPS.entries()){
    assert.ok(step.title.length>4);
    assert.ok(step.body.length>30);
    assert.ok(step.commands.length>0);
    const j=ui.tutorialStep(owner,i).toJSON();
    assert.equal(j.type,17);
    assert.ok(j.components.length<=10);
    assert.ok(JSON.stringify(j).length<6000);
    assert.match(JSON.stringify(j),new RegExp("STEP "+(i+1)+" OF 7"));
    assert.match(JSON.stringify(j),/This guide never consumes items or IC/);
    const b=buttons(j);
    assert.equal(b.length,i===0?2:3);
    assert.equal(b.at(-1).label,"Skip guide");
    assert.equal(b.at(-1).custom_id,ui.custom(owner,"tutorial_skip",String(i)));
    if(i===6)assert.equal(b.some(x=>x.label==="Finish guide"),true);
    else assert.equal(b.some(x=>x.label==="Next"),true);
    if(i>0)assert.equal(b[0].custom_id,ui.custom(owner,"tutorial_back",String(i)));
  }
  assert.throws(()=>ui.tutorialStep(owner,7),/Unknown tutorial/);
  assert.match(STEPS[0].body,/Idle Credits/);
  assert.match(STEPS[5].body,/100-tier/);
  assert.match(STEPS[6].body,/1 billion IC/);
});
test("completed and skipped guide screens offer actual gameplay and optional replay",()=>{
  for(const s of ["skipped","finished"]){
    const j=ui.tutorialFinished(owner,s).toJSON();
    assert.ok(j.components.length<=10);
    const b=buttons(j);
    assert.deepEqual(b.map(x=>x.label),["Command Center","Claim daily","Replay guide"]);
    assert.equal(b[2].custom_id,ui.custom(owner,"tutorial_replay"));
  }
  const help=ui.help(owner).toJSON();
  assert.ok(buttons(help).some(x=>x.label==="Replay guide"));
});
test("account tutorial fits Discord slash-command limits and does not replace other commands",()=>{
  const cmd=idle.toJSON();
  assert.ok(cmd.options.length<=25);
  const account=cmd.options.find(x=>x.name==="account");
  assert.ok(account.options.some(x=>x.name==="tutorial"));
  assert.ok(account.options.some(x=>x.name==="settings"));
  assert.ok(account.options.some(x=>x.name==="stats"));
  assert.ok(cmd.options.some(x=>x.name==="help"));
  assert.ok(cmd.options.some(x=>x.name==="mine"));
  const index=fs.readFileSync(require.resolve("../src/index"),"utf8");
  assert.match(index,/routeTutorial\(interaction,respond\)/);
});
test("tutorial navigation checks component ownership before modifying state",async()=>{
  let called=false,reply=null;
  const previous=store.transition;
  store.transition=async()=>{called=true;};
  try{
    const result=await handleComponent({user:{id:other},
      customId:ui.custom(owner,"tutorial_next","0"),isButton:()=>true,isStringSelectMenu:()=>false,
      reply:async r=>{reply=r;}});
    assert.equal(result,true);
    assert.equal(called,false);
    assert.match(reply.content,/another player/);
  }finally{store.transition=previous;}
});
test("tutorial buttons route transitions with exact steps and return compact guides",async()=>{
  const original=store.transition,oldRestart=store.restart;
  const observed=[];
  store.transition=async(id,action,step)=>{
    observed.push([id,action,step]);
    return action==="tutorial_skip"?{status:"skipped",step}: {status:"active",step:1};
  };
  store.restart=async(id)=>{observed.push([id,"replay"]);return {status:"active",step:0};};
  const run=async(action,arg="")=>{
    let p=null,fail=false;
    await handleComponent({user:{id:owner},customId:ui.custom(owner,action,arg),
      isButton:()=>true,isStringSelectMenu:()=>false,
      deferUpdate:async()=>{},editReply:async payload=>{p=payload;},
      followUp:async()=>{fail=true;}});
    assert.equal(fail,false);
    return JSON.stringify(p.components[0].toJSON());
  };
  try{
    assert.match(await run("tutorial_next","0"),/STEP 2 OF 7/);
    assert.match(await run("tutorial_skip","1"),/GUIDE SKIPPED/);
    assert.match(await run("tutorial_replay"),/STEP 1 OF 7/);
    assert.deepEqual(observed,[[owner,"tutorial_next",0],[owner,"tutorial_skip",1],[owner,"replay"]]);
  }finally{store.transition=original;store.restart=oldRestart;}
});
