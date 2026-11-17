"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const bosses = require("../src/world-bosses");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const { dec } = require("../src/economy");
const { eventXp } = require("../src/season");
const companions = require("../src/companions");
const { WEEKLY } = require("../src/challenges");
const owner = "123456789012345678";
function status(extra = {}) {
  return { periodKey:"20261116", bossId:"hollow_guardian",name:"Hollow Guardian",
    description:"A forgotten guardian",maxHp:2500,hp:1900,rewardPool:5000,endsAt:"2026-11-23T00:00:00.000Z",
    defeated:false,ended:false,participants:8,myDamage:90,myAttacks:2,
    qualified:true,minDamage:80,minAttacks:2,canAttack:true,nextAttackAt:null,
    leaders:[{userId:"999999999999999999",damage:350}],pending:null,...extra };
}
function controls(v) {
  const j=v.toJSON();
  assert.equal(j.type,17);
  assert.ok(j.components.length<=10);
  assert.ok(JSON.stringify(j).length<12000);
  assert.doesNotMatch(JSON.stringify(j),/\p{Emoji_Presentation}/u);
  const buttons=j.components.filter(x=>x.type===1).flatMap(x=>x.components).filter(x=>x.type===2);
  assert.ok(buttons.length<=3);
  buttons.forEach(b=>assert.match(b.custom_id,new RegExp("^ai:2:"+owner+":")));
  return {j,buttons,text:JSON.stringify(j)};
}
test("one global UTC weekly boss, rotating Monday regardless of server",()=>{
  const monday=bosses.cycle("2026-11-16T00:00:00.000Z");
  const sunday=bosses.cycle("2026-11-22T23:59:59.000Z");
  const next=bosses.cycle("2026-11-23T00:00:00.000Z");
  assert.equal(monday.key,"20261116");
  assert.equal(monday.boss.id,"hollow_guardian");
  assert.equal(sunday.key,monday.key);
  assert.equal(next.key,"20261123");
  assert.equal(next.boss.id,"ashbound_titan");
  assert.equal(bosses.cycle("2026-11-30T00:00:00Z").boss.id,"starved_colossus");
  assert.equal(bosses.cycle("2026-12-07T00:00:00Z").boss.id,"hollow_guardian");
  assert.equal(next.end.toISOString(),"2026-11-30T00:00:00.000Z");
  assert.throws(()=>bosses.cycle("unparsable"),/Invalid boss date/);
});
test("damage has strict scaling and per-pet effects",()=>{
  const p={mineXp:0,pickaxeTier:0,prestige:0};
  const base=bosses.attackPower(p);
  assert.equal(base,45);
  assert.equal(bosses.attackPower(p,{id:"ember_fox",level:1}),47);
  assert.equal(bosses.attackPower(p,{id:"moon_owl",level:30}),45);
  assert.equal(bosses.attackPower(p,{id:"moss_wisp",level:30}),45);
  assert.ok(bosses.attackPower({mineXp:1000000,pickaxeTier:999,prestige:999})<=320);
  assert.equal(bosses.attackCooldownMs(),600000);
  assert.equal(bosses.attackCooldownMs({id:"moss_wisp",level:1}),570000);
  assert.equal(bosses.attackCooldownMs({id:"moss_wisp",level:30}),483000);
  assert.equal(bosses.attackCooldownMs({id:"ember_fox",level:30}),600000);
});
test("reward eligibility requires real participation and never exceeds the fixed IC pool",()=>{
  const b=bosses.BOSSES[0];
  assert.deepEqual(bosses.eligibility(b,45,1),{eligible:false,minDamage:80,minAttacks:2});
  assert.equal(bosses.eligibility(b,90,2).eligible,true);
  assert.equal(bosses.eligibility(b,75,3).eligible,false);
  assert.equal(bosses.reward(b,45,1).eligible,false);
  assert.equal(bosses.reward(b,90,2,0,()=>9999).ic,180);
  assert.equal(bosses.reward(b,b.hp,50,0,()=>9999).ic,b.pool);
  assert.ok(bosses.reward(b,b.hp,50,0,()=>9999).quantity<=8);
  const split=[200,310,290,420,470,810];
  assert.equal(split.reduce((n,x)=>n+x,0),2500);
  const payouts=split.map(x=>bosses.reward(b,x,4,0,()=>9999).ic);
  assert.ok(payouts.reduce((n,x)=>n+x,0)<=b.pool);
  assert.throws(()=>bosses.reward({id:"unknown"}),/Unknown world boss/);
});
test("Moon Owl bonus uses previously persisted weighted strike points, not claim-time pet",()=>{
  const b=bosses.BOSSES[0];
  const normal=bosses.reward(b,400,3,0,()=>600);
  const owl=bosses.reward(b,400,3,400*1950,()=>600);
  assert.equal(normal.rare,false);
  assert.equal(owl.rare,true);
  assert.equal(normal.rareChanceBps,500);
  assert.equal(owl.rareChanceBps,2450);
  const half=bosses.reward(b,400,3,200*1950,()=>600);
  assert.equal(half.rareChanceBps,1475);
  assert.equal(half.ic,owl.ic);
});
test("world boss board uses one contextual attack action plus navigation",()=>{
  const {j,buttons,text}=controls(ui.worldBoss(owner,status()));
  assert.equal(buttons.length,2);
  assert.equal(buttons[0].custom_id,ui.custom(owner,"boss_attack"));
  assert.equal(buttons[1].custom_id,ui.custom(owner,"profile"));
  assert.match(text,/Hollow Guardian/);
  assert.match(text,/TOP CONTRIBUTORS/);
  assert.match(text,/1,900/);
  assert.match(text,/5K IC/);
  assert.match(text,/90 damage/);
  assert.match(text,/PARTICIPANTS|Participants/);
  const c=controls(ui.worldBoss(owner,status({canAttack:false,
    nextAttackAt:"2026-11-17T12:30:00.000Z"})));
  assert.equal(c.buttons[0].custom_id,ui.custom(owner,"boss"));
  assert.match(c.text,/Next attack/);
});
test("a defeated boss shows a single safe claim, old rewards survive rotations",()=>{
  const s=status({hp:0,ended:true,defeated:true,canAttack:false,
    pending:{periodKey:"20261109",name:"Ashbound Titan",damage:500}});
  const {buttons,text}=controls(ui.worldBoss(owner,s));
  assert.equal(buttons.length,2);
  assert.equal(buttons[0].custom_id,ui.custom(owner,"boss_claim","20261109"));
  assert.equal(buttons[1].custom_id,ui.custom(owner,"profile"));
  assert.match(text,/REWARDS AVAILABLE/);
  const previous=controls(ui.worldBoss(owner,status({pending:s.pending})));
  assert.equal(previous.buttons.length,3);
  assert.equal(previous.buttons[0].custom_id,ui.custom(owner,"boss_claim","20261109"));
  assert.equal(previous.buttons[1].custom_id,ui.custom(owner,"boss_attack"));
});
test("slash navigation and event-based progression recognize world bosses",()=>{
  assert.ok(idle.toJSON().options.some(x=>x.name==="boss"));
  const home=ui.home(owner,{username:"Explorer",displayAvatarURL:()=> "https://cdn.discordapp.com/embed/avatars/0.png"},
    {balance:dec(500),rate:dec(0),totalEarned:dec(500),prestige:0,mineXp:0,
      generators:[],lastMine:null,lastDaily:null,perks:[]}).toJSON();
  const values=home.components.filter(x=>x.type===1).flatMap(x=>x.components)
    .filter(x=>x.type===3).flatMap(x=>x.options.map(y=>y.value));
  assert.equal(values.length,18);
  assert.ok(values.includes("boss"));
  assert.equal(eventXp("world_boss_attack"),15);
  assert.equal(eventXp("world_boss_reward"),80);
  assert.equal(companions.eventXp("world_boss_attack"),15);
  assert.ok(WEEKLY.some(x=>x.event==="world_boss_attack"));
});
