"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { respond } = require("../src/commands");
const store = require("../src/store");
const { dec } = require("../src/economy");
const owner = {id:"123456789012345678",username:"Viewer",displayAvatarURL:()=> "https://cdn.discordapp.com/embed/avatars/0.png"};
const target = {id:"999999999999999999",username:"OtherPlayer",displayAvatarURL:()=> "https://cdn.discordapp.com/embed/avatars/1.png"};
function profile() {
  return {balance:dec(1000),rate:dec(10),totalEarned:dec(1500),
    prestige:0,mineXp:1,lastMine:null,lastDaily:null,perks:[],generators:[],
    inventory:[{item_id:"ore",quantity:4},{item_id:"companion_egg",quantity:1}]};
}
async function exercise(command) {
  const originalProfile=store.profile,originalPreferences=store.getPreferences;
  let queried=[];
  let edited=null;
  store.profile=async (id)=>{ queried.push(id);return profile(); };
  store.getPreferences=async ()=>{ throw new Error("Other-player views must not consult the viewer's filters"); };
  try {
    await respond({
      commandName:"idle",
      user:owner,
      isChatInputCommand:()=>true,
      deferReply:async()=>{},
      options:{ getSubcommandGroup:()=>null,getSubcommand:()=>command,getUser:()=>target },
      editReply:async (payload)=>{edited=payload;}
    });
  } finally {
    store.profile=originalProfile;
    store.getPreferences=originalPreferences;
  }
  assert.deepEqual(queried,[target.id]);
  assert.equal(edited.components.length,1);
  const json=edited.components[0].toJSON();
  const buttons=json.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===2);
  assert.deepEqual(buttons.map(b=>b.label),["My Command Center"]);
  assert.equal(buttons[0].custom_id,"ai:2:"+owner.id+":profile:");
  return JSON.stringify(json);
}
test("slash profile user: shows only read-only controls, not the other account's actions",async()=>{
  const body=await exercise("profile");
  assert.match(body,/READ ONLY/);
  assert.match(body,/OtherPlayer/);
});
test("slash inventory user: shows spectator items, without controls for the viewer's items",async()=>{
  const body=await exercise("inventory");
  assert.match(body,/PLAYER SATCHEL/);
  assert.match(body,/Companion Egg/);
  assert.doesNotMatch(body,/item_select|inventory_sort|use_item/);
});
