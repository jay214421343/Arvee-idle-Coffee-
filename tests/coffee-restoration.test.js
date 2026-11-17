"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { items, recipes } = require("../src/catalog");
const { idle, handleAutocomplete, handleComponent } = require("../src/commands");
const ui = require("../src/ui");
const store = require("../src/store");
const { dec } = require("../src/economy");
const owner = "123456789012345678";
const names = ["arthurs_tablet","crafting_materials","genreset","gnome","kingstones_stone","mine_alert","nametag","payment","pick_skin","reward","stat_card","tag"];
function sample(extra = {}) {
  return {
    balance: dec(500), totalEarned: dec(500), rate: dec(0),
    prestige: 0, mineXp: 0, orbs: 0, pickaxeTier: 0,
    generators: [], inventory: [], perks: [], ...extra
  };
}
function components(view) {
  return view.toJSON().components.filter((c)=>c.type===1).flatMap((r)=>r.components);
}
test("all 12 restored Coffee item aliases have a real effect and Forge recipe",()=>{
  assert.equal(names.length,12);
  for(const id of names){
    assert.ok(items[id]?.effect,"missing effect for "+id);
    assert.ok(recipes[id],"missing recipe for "+id);
    assert.ok(Object.keys(recipes[id]).every(key=>items[key]),"missing ingredient for "+id);
  }
  assert.equal(Object.keys(items).length,39,"26 originals + Creditus Deletus + 12 restored");
  assert.equal(Object.keys(recipes).length,24,"keep slash choice count under 25");
  assert.equal(items.pickaxe,undefined,"pickaxe is already a system, not a disposable inventory item");
});
test("/idle use offers autocomplete for expanded catalogue and an optional name",async()=>{
  const opts=idle.toJSON().options.find((x)=>x.name==="use").options;
  assert.equal(opts.find(x=>x.name==="item").autocomplete,true);
  assert.equal(opts.find(x=>x.name==="name").required,false);
  let found=[];
  await handleAutocomplete({
    isAutocomplete:()=>true,commandName:"idle",
    options:{getFocused:()=>({name:"item",value:"Mine Alert"})},
    respond:async (values)=>{found=values;}
  });
  assert.ok(found.some((x)=>x.value==="mine_alert"));
});
test("nametag and profile tag have owner-bound presets and keep simple UI",()=>{
  for(const id of ["nametag","tag"]){
    const c=ui.customization(owner,id).toJSON();
    assert.equal(c.type,17);
    const sel=c.components.filter(x=>x.type===1).flatMap(x=>x.components).find(x=>x.type===3);
    assert.equal(sel.custom_id,ui.custom(owner,"customize_set",id));
    assert.equal(sel.options.length,3);
    assert.ok(c.components.length<10);
    const view=ui.item(owner,id,1);
    const action=components(view).find(x=>x.type===2&&x.label==="Customize");
    assert.equal(action.custom_id,ui.custom(owner,"customize",id));
  }
  assert.throws(()=>ui.customization(owner,"payment"),/no naming options/);
});
test("profiles show escaped saved cosmetics and pickaxe finish",()=>{
  const p=sample({profileTag:"Coffee Veteran",pickaxeName:"Moonshard",pickaxeStyle:"Astral"});
  const ownerView=ui.home(owner,{username:"Ranger",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},p).toJSON();
  assert.match(JSON.stringify(ownerView),/Coffee Veteran/);
  const otherView=ui.home(owner,{username:"Ranger",displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},p,true).toJSON();
  assert.match(JSON.stringify(otherView),/Coffee Veteran/);
  const pick=ui.pickaxe(owner,p).toJSON();
  assert.match(JSON.stringify(pick),/Moonshard/);
  assert.match(JSON.stringify(pick),/Astral/);
});
test("customize menu only consumes owned item after a valid choice",async()=>{
  const previous=store.useItem;
  let calls=0;
  store.useItem=async (id,item,name)=>{
    calls++;assert.equal(id,owner);assert.equal(item,"tag");assert.equal(name,"Trailblazer");
    return {itemId:item,message:"Profile title set to Trailblazer."};
  };
  let response=null;
  try{
    const interaction={
      user:{id:owner},customId:ui.custom(owner,"customize_set","tag"),values:["Trailblazer"],
      isStringSelectMenu:()=>true,isButton:()=>false,
      deferUpdate:async()=>{},editReply:async x=>{response=x;}
    };
    assert.equal(await handleComponent(interaction),true);
    assert.equal(calls,1);
    assert.match(JSON.stringify(response.components[0].toJSON()),/Customization saved/);
  }finally{store.useItem=previous;}
});
