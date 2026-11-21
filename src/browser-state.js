"use strict";
const {generators,items,recipes}=require("./catalog");
const {dec,pretty,purchaseCost,PRESTIGE_REQUIREMENT}=require("./economy");
const {playerReadiness,miningCooldownMs}=require("./activity");
const rebirth=require("./rebirth");

// Explicit browser projection: never serialize database rows or account credentials.
function project(player,now=Date.now()) {
  const counts=Object.fromEntries(player.inventory.map(row=>[row.item_id,Number(row.quantity)]));
  const owned=Object.fromEntries(player.generators.map(row=>[row.generator_id,Number(row.quantity)]));
  const readiness=playerReadiness(player,now);
  return {
    sampledAt:now,settledAt:new Date(player.lastSettledAt).getTime(),balance:player.balance.toFixed(0),balanceLabel:pretty(player.balance),
    rate:player.rate.toString(),rateLabel:pretty(player.rate),totalEarned:pretty(player.totalEarned),
    prestige:player.prestige,mineXp:player.mineXp,pickaxeTier:player.pickaxeTier,pickaxeName:player.pickaxeName||"Prospector's pickaxe",
    pickaxeStyle:player.pickaxeStyle||"Copper",profileTag:player.profileTag||null,
    mineReadyAt:readiness.mine.readyAt?readiness.mine.readyAt*1000:null,dailyReadyAt:readiness.daily.readyAt?readiness.daily.readyAt*1000:null,
    mineDuration:miningCooldownMs(player.perks),passiveEarned:pretty(player.passiveEarned),passiveSeconds:player.passiveSeconds,
    prestigeProgress:dec(player.balance).div(PRESTIGE_REQUIREMENT).times(100).clamp(0,100).toNumber(),
    decorations:player.ecosystem?.cosmetics||[],
    generators:generators.map((entry,index)=>{
      const quantity=owned[entry.id]||0,unlocked=rebirth.unlocked(player.prestige,entry.prestigeRequired);
      const quotes={};for(const amount of [1,10]){
        const cost=purchaseCost(entry.cost,quantity,amount);
        quotes[amount]={cost:pretty(cost),affordable:unlocked&&quantity+amount<=10000&&player.balance.gte(cost)};
      }
      return {id:entry.id,name:entry.name,description:entry.description,index,owned:quantity,income:pretty(entry.income),unlocked,prestigeRequired:entry.prestigeRequired||0,quotes};
    }),
    inventory:player.inventory.filter(row=>items[row.item_id]).map(row=>{const item=items[row.item_id];return {id:row.item_id,name:item.name,emoji:item.emoji.replace(/<a?:[^:]+:\d+>/g,"✦"),rarity:item.rarity,description:item.description,use:item.use||null,usable:!!item.effect,quantity:Number(row.quantity),openable:["lootbox","rare_lootbox","legendary_lootbox","lunchbox"].includes(row.item_id)};}),
    recipes:Object.entries(recipes).map(([id,ingredients])=>({id,name:items[id].name,emoji:items[id].emoji.replace(/<a?:[^:]+:\d+>/g,"✦"),description:items[id].use||items[id].description,craftable:Object.entries(ingredients).every(([key,n])=>(counts[key]||0)>=n),ingredients:Object.entries(ingredients).map(([key,n])=>({id:key,name:items[key].name,needed:n,owned:counts[key]||0}))}))
  };
}
async function snapshot(store,userId){return project(await store.profile(userId));}
module.exports={project,snapshot};
