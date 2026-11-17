"use strict";
// The same authoritative loot-table definitions power rewards and /idle info.
// Cumulative thresholds are percentages per cache opened. Each regular
// cache gives one main item; bonuses/charms roll independently.
const BASE=Object.freeze({
  lootbox:Object.freeze([
    ["pickperk",1],["gold",4],["silver",16],["apple",25],
    ["bread",36],["cola",45],["cookie",55],["ore",100]]),
  rare_lootbox:Object.freeze([
    ["gem",4],["pickperk",18],["gold",40],["starfruit",60],["strange_matter",100]]),
  legendary_lootbox:Object.freeze([
    ["orb_of_almanac",10],["gem",23],["pickperk",43],["tinkers_gizmo",65],
    ["strange_matter",99.5],["creditus_deletus",100]])
});
const BONUS=Object.freeze({
  lootbox:Object.freeze({chance:2,items:["kingstones_stone","reward","payment","crafting_materials"]}),
  rare_lootbox:Object.freeze({chance:4,items:["arthurs_tablet","mine_alert","nametag","stat_card"]}),
  legendary_lootbox:Object.freeze({chance:5,items:["gnome","pick_skin","tag","genreset"]})
});
const CHARMS=Object.freeze({rare_lootbox:8,legendary_lootbox:20});
const LUNCHBOX=Object.freeze({
  ration:Object.freeze(["apple","bread","bacon","cookie"]),
  tonic:Object.freeze(["coffee","cola","jungle_juice","pumpkin_spice_latte"])
});
function mainDrop(boxType,roll){
  if(!Object.hasOwn(BASE,boxType))throw new Error("Unknown cache type.");
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw new Error("Invalid cache roll.");
  return BASE[boxType].find(([,end])=>roll*100<end)[0];
}
function baseChances(boxType){
  if(!Object.hasOwn(BASE,boxType))throw new Error("Unknown cache type.");
  let previous=0;
  return BASE[boxType].map(([id,end])=>{
    const chance=end-previous;previous=end;
    return {id,chance};
  });
}
module.exports={BASE,BONUS,CHARMS,LUNCHBOX,mainDrop,baseChances};
