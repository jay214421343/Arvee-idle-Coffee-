"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const definitions=require("../src/guild-expeditions");
const ui=require("../src/ui");
const {idle}=require("../src/commands");
const {MessageFlags}=require("discord.js");
const owner="123456789012345678";
const sample=()=>({
  guild:{id:"17",name:"Frontier Wardens",tag:"FW",lockedElsewhere:false},
  missions:definitions.MISSIONS.map((x,i)=>({
    id:x.id,name:x.name,event:x.event,goal:x.goal,
    progress:i===0?6:0,contributors:i===0?2:0,myUnits:i===0?4:0,
    completed:false,renown:x.renown
  })),
  weekKey:"20261116",weekEndsAt:"2026-11-23T00:00:00.000Z",
  seasonKey:"20261116",seasonEndsAt:"2026-12-14T00:00:00.000Z",
  weekScore:100,seasonScore:200,seasonTier:"Explorer",seasonLockedElsewhere:false,
  weekly:[{rank:1,id:"17",tag:"FW",name:"Frontier Wardens",completed:1,score:100,tier:"Explorer"}],
  seasonal:[{rank:1,id:"17",tag:"FW",name:"Frontier Wardens",completed:2,score:200,tier:"Explorer"}],
  pending:null,pendingSeason:null
});
function inspect(view){
  const j=view.toJSON();
  assert.equal(j.type,17);
  assert.ok(j.components.length<=10,"Discord V2 supports up to 10 components");
  const raw=JSON.stringify(j);
  assert.ok(raw.length<12000,"Compact output for mobile");
  assert.doesNotMatch(raw,/\p{Emoji_Presentation}/u);
  const controls=j.components.filter(c=>c.type===1).flatMap(c=>c.components);
  assert.ok(controls.filter(c=>c.type===2).length<=3);
  for(const c of controls) assert.ok(c.custom_id.startsWith("ai:2:"+owner+":"));
  assert.equal(ui.payload(view).flags,MessageFlags.IsComponentsV2);
  assert.deepEqual(ui.payload(view).allowedMentions,{parse:[]});
  return {j,raw,controls};
}
test("UTC week and four-week seasons roll over deterministically",()=>{
  const mon=definitions.week("2026-11-16T00:00:00.000Z");
  assert.equal(mon.key,"20261116");
  assert.equal(definitions.week("2026-11-22T23:59:59Z").key,mon.key);
  assert.equal(definitions.week("2026-11-23T00:00:00Z").key,"20261123");
  const season=definitions.season("2026-11-16T00:00:00Z");
  assert.equal(season.key,"20261116");
  assert.equal(season.end.toISOString(),"2026-12-14T00:00:00.000Z");
  assert.equal(definitions.season("2026-12-13T23:59:59Z").key,season.key);
  assert.equal(definitions.season("2026-12-14T00:00:00Z").key,"20261214");
  assert.equal(definitions.season("2026-10-19T00:00:00Z").key,"20261019");
  assert.equal(definitions.parsedSeasonKey("20261019").endKey,"20261116");
  for(const bad of ["x","20261117","20261301","20261132","20000101"])
    assert.throws(()=>definitions.parsedSeasonKey(bad),/Invalid league season/);
});
test("fixed mission goals, bounded daily caps and rewards are accessible to small guilds",()=>{
  assert.equal(definitions.MISSIONS.length,4);
  assert.deepEqual(definitions.MISSIONS.map(m=>m.goal),[10,6,8,5]);
  assert.deepEqual(definitions.MISSIONS.map(m=>m.perDay),[5,2,3,1]);
  assert.ok(definitions.MISSIONS.every(m=>m.points===100 && m.ic>0 && m.renown>0));
  assert.equal(new Set(definitions.MISSIONS.map(m=>m.event)).size,4);
  assert.equal(definitions.BY_EVENT.get("mine").id,"mining_run");
  assert.equal(definitions.BY_EVENT.get("guild_expedition_reward"),undefined);
  assert.equal(definitions.eligibleContribution(2),true);
  assert.equal(definitions.eligibleContribution(1),false);
});
test("leagues rank completed objectives not unbounded player activity",()=>{
  assert.equal(definitions.tier(0),"Unranked");
  assert.equal(definitions.tier(100),"Explorer");
  assert.equal(definitions.tier(400),"Bronze");
  assert.equal(definitions.tier(800),"Silver");
  assert.equal(definitions.tier(1200),"Gold");
  assert.equal(definitions.tier(1600),"Diamond");
  assert.equal(definitions.seasonReward(399),null);
  assert.equal(definitions.seasonReward(400).ic,750);
  assert.equal(definitions.seasonReward(800).ic,1250);
  assert.equal(definitions.seasonReward(1200).ic,2000);
  assert.equal(definitions.seasonReward(1600).ic,2800);
  assert.equal(definitions.seasonReward(400000).ic,2800);
  assert.throws(()=>definitions.tier(-1),/Invalid league score/);
});
test("guild expedition screen renders 4 missions and personal claim with 3 buttons maximum",()=>{
  const data=sample();
  const view=inspect(ui.guildExpeditionBoard(owner,data));
  assert.match(view.raw,/GUILD EXPEDITIONS/);
  assert.match(view.raw,/Mining Run/);
  assert.match(view.raw,/Frontier Survey/);
  assert.match(view.raw,/Siege Support/);
  assert.match(view.raw,/Supply Line/);
  assert.match(view.raw,/Your contribution: 4/);
  assert.equal(view.controls.filter(c=>c.type===2).length,2);
  const pending={guildId:"17",periodKey:"20261109",missionId:"mining_run",
    name:"Mining Run",units:3,ic:300,itemId:"ore",quantity:3};
  const ready=inspect(ui.guildExpeditionBoard(owner,{...data,pending},"Reward completed"));
  assert.match(ready.raw,/REWARD READY/);
  const controls=ready.controls.filter(c=>c.type===2);
  assert.equal(controls.length,3);
  assert.equal(controls[0].custom_id,ui.custom(owner,"gexp_claim"));
  assert.ok(controls.some(c=>c.custom_id===ui.custom(owner,"gexp_league")));
});
test("guild-hopping warning and historical pending claims remain available without guild",()=>{
  const data=sample();
  const locked=inspect(ui.guildExpeditionBoard(owner,{
    ...data,seasonLockedElsewhere:true
  }));
  assert.match(locked.raw,/SEASON LOCK/);
  const guest=inspect(ui.guildExpeditionBoard(owner,{
    ...data,guild:null,missions:[],pending:{guildId:"17",periodKey:"20261102",
      missionId:"siege_support",name:"Siege Support",units:3,ic:700,itemId:"gold",quantity:1}
  }));
  assert.match(guest.raw,/NO GUILD/);
  assert.match(guest.raw,/REWARD READY/);
  assert.equal(guest.controls.filter(c=>c.type===2).length,3);
});
test("league view has top-five rankings and optional one-time season claim",()=>{
  const data=sample();
  const base=inspect(ui.guildLeagueBoard(owner,data));
  assert.match(base.raw,/WEEKLY STANDINGS/);
  assert.match(base.raw,/SEASONAL STANDINGS/);
  assert.match(base.raw,/SEASON/);
  assert.match(base.raw,/400/);
  assert.equal(base.controls.filter(c=>c.type===2).length,2);
  const pendingSeason={seasonKey:"20261019",guildId:"17",score:800,accepted:6,
    tier:"Silver",ic:1250,itemId:"rare_lootbox",quantity:1};
  const claim=inspect(ui.guildLeagueBoard(owner,{...data,pendingSeason}));
  assert.match(claim.raw,/SEASON REWARD AVAILABLE/);
  assert.equal(claim.controls.filter(c=>c.type===2).length,3);
  assert.equal(claim.controls.filter(c=>c.type===2)[0].custom_id,
    ui.custom(owner,"gexp_season_claim","20261019"));
});
test("guild slash commands expose routes without too many Discord options",()=>{
  const cmd=idle.toJSON();
  const g=cmd.options.find(x=>x.name==="guild");
  assert.ok(g && g.options.length<=25);
  for(const action of ["expeditions","league","claim","season_claim"])
    assert.ok(g.options.some(x=>x.name===action),action);
  const seasonClaim=g.options.find(x=>x.name==="season_claim");
  assert.equal(seasonClaim.options[0].required,true);
  const global=cmd.options.filter(x=>x.type!==2);
  assert.ok(global.length<=25);
});
