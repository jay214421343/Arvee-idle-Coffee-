"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const guilds = require("../src/guilds");
const ui = require("../src/ui");
const { idle } = require("../src/commands");
const owner = "123456789012345678";
function sample(overrides={}) {
  return {
    guild: {id:"37",name:"Whispering Vanguard",tag:"WVG",ownerId:owner,
      xp:225,renown:225,hall:1,level:2,levelGoal:400,capacity:16,
      memberCount:3,damage:400},
    role:"leader",members:[
      {userId:owner,role:"leader",xp:150},
      {userId:"999999999999999999",role:"officer",xp:55},
      {userId:"888888888888888888",role:"member",xp:20}
    ],
    periodKey:"20261116",invitations:[],rankings:[
      {rank:1,id:"37",name:"Whispering Vanguard",tag:"WVG",damage:400},
      {rank:2,id:"39",name:"Northwind",tag:"NW",damage:250}
    ],...overrides
  };
}
function inspect(view) {
  const j=view.toJSON(), raw=JSON.stringify(j);
  assert.equal(j.type,17);
  assert.ok(j.components.length<=10);
  assert.ok(raw.length<12000);
  assert.doesNotMatch(raw,/\p{Emoji_Presentation}/u);
  const actions=j.components.filter(c=>c.type===1).flatMap(c=>c.components);
  assert.ok(actions.filter(c=>c.type===2).length<=3);
  actions.filter(c=>c.type===2 || c.type===3).forEach(c=>
    assert.match(c.custom_id,new RegExp("^ai:2:"+owner+":(?:guild|gexp)|^ai:2:"+owner+":profile:")));
  return {j,raw,actions};
}
test("guild names and tags are validated without accepting Discord markup",()=>{
  assert.equal(guilds.validName("  North  Wind  "),"North Wind");
  assert.equal(guilds.validTag("WvG"),"WVG");
  assert.equal(guilds.validGuildId("239"),"239");
  for(const name of ["X","", "A".repeat(27), "@everyone", "**Chaos**","<@123456789012345678>","a\nb"])
    assert.throws(()=>guilds.validName(name),/Guild name/);
  for(const tag of ["X","ABCDE1","a b","@ABC",""])
    assert.throws(()=>guilds.validTag(tag),/Guild tag/);
  for(const id of ["-1","0","1;DROP TABLE players","9223372036854775808","2abc"])
    assert.throws(()=>guilds.validGuildId(id),/Invalid guild ID/);
});
test("XP levels, caps, Guild Hall progression, shared perk values are bounded",()=>{
  assert.equal(guilds.level(0),1);
  assert.equal(guilds.xpForLevel(2),100);
  assert.equal(guilds.xpForLevel(3),400);
  assert.equal(guilds.level(100),2);
  assert.equal(guilds.level(400),3);
  assert.equal(guilds.level(10000000),20);
  assert.equal(guilds.DAILY_XP_CAP,250);
  assert.equal(guilds.xpForEvent("mine"),2);
  assert.equal(guilds.xpForEvent("daily"),12);
  assert.equal(guilds.xpForEvent("world_boss_attack",{damage:100}),25);
  assert.equal(guilds.xpForEvent("craft",{quantity:10000}),25);
  assert.equal(guilds.xpForEvent("guild_create"),0);
  assert.equal(guilds.hallCost(0),100);
  assert.equal(guilds.hallCost(4),500);
  assert.equal(guilds.capacity(0),12);
  assert.equal(guilds.capacity(5),32);
  assert.equal(guilds.mineMultiplier(5),1.05);
  assert.equal(guilds.attackMultiplier(5),1.1);
  assert.throws(()=>guilds.hallCost(5),/maximum/);
});
test("guild permissions distinguish leader/officer/member",()=>{
  assert.equal(guilds.roleCanManage("leader","transfer"),true);
  assert.equal(guilds.roleCanManage("leader","upgrade"),true);
  assert.equal(guilds.roleCanManage("officer","invite"),true);
  assert.equal(guilds.roleCanManage("officer","kick"),true);
  assert.equal(guilds.roleCanManage("officer","promote"),false);
  assert.equal(guilds.roleCanManage("member","invite"),false);
  assert.equal(guilds.roleCanManage("member","disband"),false);
});
test("compact guild board uses contextual actions without emoji overload",()=>{
  const {raw,actions}=inspect(ui.guildOverview(owner,sample()));
  assert.match(raw,/Whispering Vanguard/);
  assert.match(raw,/SHARED PERKS/);
  assert.match(raw,/MEMBERS/);
  assert.match(raw,/WEEKLY BOSS CONTRIBUTION/);
  assert.equal(actions.filter(x=>x.type===2).length,2);
  assert.ok(actions.some(x=>x.custom_id===ui.custom(owner,"gexp")));
  const upgraded=sample({guild:{...sample().guild,renown:350,hall:1}});
  assert.equal(inspect(ui.guildOverview(owner,upgraded)).actions.filter(x=>x.type===2).length,2);
  const allowed=sample({guild:{...sample().guild,renown:350,hall:1,level:3,levelGoal:900}});
  assert.ok(inspect(ui.guildOverview(owner,allowed)).actions
    .some(x=>x.custom_id===ui.custom(owner,"guild_upgrade")));
  const officer=sample({role:"officer",guild:{...allowed.guild}});
  assert.ok(!inspect(ui.guildOverview(owner,officer)).actions
    .some(x=>x.custom_id===ui.custom(owner,"guild_upgrade")));
});
test("guild invitation acceptance is offered in a single dropdown, with strict ownership",()=>{
  const noGuild=sample({guild:null,role:null,members:[],invitations:[
    {id:"37",name:"Whispering Vanguard",tag:"WVG",expiresAt:"2026-11-20T00:00:00Z"},
    {id:"39",name:"Northwind",tag:"NW",expiresAt:"2026-11-20T00:00:00Z"}
  ]});
  const {raw,actions}=inspect(ui.guildOverview(owner,noGuild));
  assert.match(raw,/NO GUILD YET/);
  assert.equal(actions.filter(x=>x.type===3).length,1);
  assert.equal(actions.filter(x=>x.type===2).length,2);
  assert.equal(actions.find(x=>x.type===3).custom_id,ui.custom(owner,"guild_accept"));
  assert.deepEqual(actions.find(x=>x.type===3).options.map(x=>x.value),["37","39"]);
  const empty=inspect(ui.guildOverview(owner,{...noGuild,invitations:[]}));
  assert.equal(empty.actions.filter(x=>x.type===3).length,0);
});
test("rankings screen and slash command expose cross-server guild competition",()=>{
  const {actions,raw}=inspect(ui.guildRankings(owner,sample()));
  assert.match(raw,/Whispering Vanguard/);
  assert.match(raw,/400 damage/);
  assert.equal(actions.filter(x=>x.type===2).length,2);
  const parsed=idle.toJSON();
  assert.ok(parsed.options.length<=25);
  const group=parsed.options.find(o=>o.name==="guild");
  assert.ok(group);
  const names=group.options.map(o=>o.name);
  for(const required of ["view","rankings","create","invite","accept","decline","leave","kick","promote","demote","transfer","upgrade","disband"])
    assert.ok(names.includes(required),required);
  assert.ok(group.options.length<=25);
  assert.equal(group.options.find(o=>o.name==="create").options.length,2);
  assert.equal(group.options.find(o=>o.name==="disband").options[0].required,true);
});
