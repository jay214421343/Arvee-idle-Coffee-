"use strict";
const {items,recipes}=require("./catalog");
const loot=require("./loot-tables");
const season=require("./season");
const explore=require("./exploration");
const challenges=require("./challenges");
const bosses=require("./world-bosses");
const {EGG_TIERS,CHARMS}=require("./companions");
const {rollRebirthBonus}=require("./rebirth-loot");
const CAP=8;
const names=(id)=>items[id]?.name||id;
function percent(n){return Number(n.toFixed(4)).toString()+"%";}
function cacheContents(id){
  if(id==="lunchbox"){
    return ["**Always 2 rewards:** one ration and one tonic",
      ...["ration","tonic"].map(type=>type+": "+
        loot.LUNCHBOX[type].map(key=>names(key)+" (25%)").join(" · "))].join("\n");
  }
  if(!Object.hasOwn(loot.BASE,id))return null;
  const main=loot.baseChances(id).map(x=>names(x.id)+" "+percent(x.chance)).join(" · ");
  const bonus=loot.BONUS[id],charm=loot.CHARMS[id];
  const lines=["**One guaranteed main drop:** "+main,
    "**Independent bonus:** "+percent(bonus.chance)+" total; "+bonus.items.map(x=>
      names(x)+" "+percent(bonus.chance/bonus.items.length)).join(" · ")];
  if(charm)lines.push("**Independent charm roll:** "+percent(charm)+" total; "+
    Object.keys(CHARMS).map(x=>names(x)+" "+percent(charm/Object.keys(CHARMS).length)).join(" · "));
  return lines.join("\n");
}
function sources(id){
  if(!Object.hasOwn(items,id))throw new Error("Unknown item.");
  const result=[];
  const add=(source)=>{if(!result.includes(source))result.push(source);};
  if(recipes[id])add("Forge: /idle craft");
  const rewardTiers=season.rewards.flatMap((r,i)=>r.kind==="item"&&r.item===id?[i+1]:[]);
  if(rewardTiers.length)add("Free Season Journey: tier "+rewardTiers.join(", "));
  const c=[...challenges.DAILY.map(x=>({...x,period:"daily"})),
    ...challenges.WEEKLY.map(x=>({...x,period:"weekly"}))]
    .filter(x=>x.reward?.kind==="item"&&x.reward.item===id);
  if(c.length)add("Contracts: "+[...new Set(c.map(x=>x.period+" "+x.label))].join(", "));
  const regions=explore.REGIONS.filter(region=>region.drops.some(x=>x.id===id)).map(r=>r.name);
  if(regions.length)add("World Map expeditions: "+regions.join(", "));
  if(id==="companion_egg")add("Successful World Map expeditions (random discovery)");
  for(const [type,name] of Object.entries({lootbox:"Supply Cache",
    rare_lootbox:"Rare Supply Cache",legendary_lootbox:"Mythic Supply Cache",lunchbox:"Lunchbox"})){
    if(Object.hasOwn(loot.BASE,type) && loot.BASE[type].some(x=>x[0]===id))
      add("Open "+name+" (main pool)");
    if(loot.BONUS[type]?.items.includes(id))add("Open "+name+" (bonus pool)");
    if(loot.CHARMS[type]&&Object.hasOwn(CHARMS,id))add("Open "+name+" (charm bonus)");
    if(type==="lunchbox"&&(loot.LUNCHBOX.ration.includes(id)||loot.LUNCHBOX.tonic.includes(id)))
      add("Open Adventurer's Lunchbox");
  }
  if(["ore","silver","gold","strange_matter","gem"].includes(id))
    add("Mining (material rarity and perk level affect odds)");
  if(id==="lootbox")add("Mining (random Supply Cache find), or /idle daily (3 caches)");
  const rebirthItems=new Set([0.01,0.06,0.12,0.31].map(rollRebirthBonus));
  if(rebirthItems.has(id))add("Rebirth: optional lucky bonus (not guaranteed)");
  if(bosses.BOSSES.some(b=>b.itemId===id))add("Qualified World Boss rewards");
  if(Object.hasOwn(EGG_TIERS,id) && id!=="companion_egg" && recipes[id])add("Craft higher-tier eggs from ordinary eggs");
  // Items not currently awarded by a direct fixed source may be traded.
  add("Trade with other players through /idle market");
  return result;
}
module.exports={cacheContents,sources,percent};
