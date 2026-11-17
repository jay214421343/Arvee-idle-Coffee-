"use strict";
// No additional currency or second idle loop: milestones apply passively to
// existing mining and operations. All unlocks are retroactive by prestige count.
const PATHS=Object.freeze({
  none:Object.freeze({name:"No specialization",description:"Normal balanced progression"}),
  miner:Object.freeze({name:"Miner",description:"+10% mined IC; normal loot chances"}),
  tycoon:Object.freeze({name:"Tycoon",description:"+10% passive IC from operations"}),
  hunter:Object.freeze({name:"Treasure Hunter",description:"+2 percentage points Supply Cache chance"})
});
const MILESTONES=Object.freeze([
  {tier:5,name:"Ore Seeker",detail:"3% chance of 2 bonus Rune Ore per dig"},
  {tier:10,name:"Cache Scout",detail:"1% independent bonus Supply Cache chance per dig"},
  {tier:20,name:"Deep Miner",detail:"2% Void Essence and 0.25% Rare Cache finds while mining"},
  {tier:35,name:"Runeforge Operator",detail:"Unlock Runeforge Crew in the existing Operations Shop"},
  {tier:50,name:"Relic Seeker",detail:"Unlock Void Excavators; 0.15% chance of a Pickaxe Skin Token while mining"},
  {tier:75,name:"Astral Architect",detail:"Unlock Astral Prospectors; 0.1% chance of a Mythic Supply Cache"},
  {tier:100,name:"Eternal Prospector",detail:"Unlock 0.05% chance of an Astral Egg through normal mining"}
].map(x=>Object.freeze(x)));
const ADVANCED=Object.freeze([
  Object.freeze({id:"RNFG",name:"Runeforge Crew",description:"Elite runesmiths channel ancient ore into powerful autonomous crews. Unlocked at Rebirth 35.",
    cost:"4.5e10",income:"4.0e8",prestigeRequired:35}),
  Object.freeze({id:"VDXC",name:"Void Excavators",description:"Void-powered mining operation unlocked by Rebirth 50.",
    cost:"2.5e14",income:"3.0e12",prestigeRequired:50}),
  Object.freeze({id:"ASTP",name:"Astral Prospectors",description:"Astral harvesting team unlocked by Rebirth 75.",
    cost:"4.0e25",income:"3.5e21",prestigeRequired:75})
]);
function stage(prestige){
  if(!Number.isSafeInteger(prestige)||prestige<0)throw new Error("Invalid prestige level");
  return MILESTONES.filter(x=>prestige>=x.tier);
}
function next(prestige){return MILESTONES.find(x=>x.tier>prestige)||null;}
function miningRewards(prestige,path="none",roll=()=>Math.random()){
  const results=[];
  const check=(tier,chance,id,qty=1)=>{
    if(prestige<tier)return;
    const r=roll();
    if(!Number.isFinite(r)||r<0||r>=1)throw new Error("Invalid milestone RNG");
    if(r<chance)results.push({id,quantity:qty});
  };
  check(5,.03,"ore",2);
  check(10,.01,"lootbox");
  check(20,.02,"strange_matter");
  check(20,.0025,"rare_lootbox");
  check(50,.0015,"pick_skin");
  check(75,.001,"legendary_lootbox");
  check(100,.0005,"mythic_companion_egg");
  return results;
}
function minerMultiplier(path){return path==="miner"?1.10:1;}
function idleMultiplier(path){return path==="tycoon"?1.10:1;}
function extraCacheChance(path){return path==="hunter"?.02:0;}
function unlocked(prestige,required){return !required||prestige>=required;}
module.exports={PATHS,MILESTONES,ADVANCED,stage,next,miningRewards,minerMultiplier,idleMultiplier,extraCacheChance,unlocked};
