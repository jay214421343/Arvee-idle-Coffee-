"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { generators, byId, items, recipes } = require("../src/catalog");
const catalogue = require("../src/data/generators.json").catalogue;
const source = [["MSPS","Rookie Adventurer","100","1","🗡️",true],["CATV","Campfire Scavengers","4.26e+2","1.2e+1","🔥",true],["MONK","Copper Mining Crew","7.58e+2","4.1e+1","⛏️",true],["CTSH","Village Outpost","2.92e+3","2.04e+2","🏕️",true],["BSTA","Goblin Patrol","5.70e+3","6.35e+2","🛡️",true],["HBSC","Quest Board","3.27e+4","2.26e+3","📜",true],["NKCC","Runesmith Workshop","4.13e+5","3.93e+4","ᚠ",true],["BGSS","Merchant Caravan","1.39e+6","3.78e+5","🛒",true],["IM9S","Forest Rangers","1.35e+9","1.96e+6","🏹",true],["ACFB","Ancient Ruins Expedition","4.23e+10","2.92e+7","🏚️",true],["HARD","Alchemy Circle","4.30e+11","1.28e+8","⚗️",true],["HFB","Dwarven Foundry","2.50e+13","2.58e+11","⚒️",true],["VAPE","Moonlit Library","1.45e+14","2.47e+12","📚",true],["CHBF","Dragon Hatchery","3.61e+16","1.13e+14","🐉",true],["HACK","Dungeon Delvers","4.36e+18","3.76e+16","⚔️",true],["SMRT","Crystal Caverns","1.55e+20","1.46e+18","💎",true],["ATDB","Starfall Observatory","2.39e+24","1.76e+20","🔭",true],["WARL","Void Researchers","4.33e+27","4.72e+23","🌌",true],["FATL","Celestial Armory","1.63e+29","3.23e+25","🛡️",true],["CORN","Arcane Citadel","4.37e+32","2.28e+28","🏰",true],["MCFT","Abyss Watchers","1.49e+35","4.20e+31","🕳️",true],["GOPN","Stormguard Keep","4.68e+38","4.15e+35","⚡",true],["BCTL","Titan Excavators","4.85e+41","4.55e+38","🪨",true],["JACK","Forgotten Gateway","1.44e+44","3.24e+41","🚪",true],["PBG","Mythic Forge","4.16e+49","4.43e+44","🔨",true],["POST","Dungeon Nexus","3.95e+53","3.81e+48","🏛️",true],["SKYP","Soulbound Atelier","4.99e+56","4.57e+51","✨",true],["FROG","Astral Rift Explorers","1.21e+60","1.95e+55","🌠",true],["GRAV","Sky Fortress","4.33e+64","2.17e+59","☁️",true],["SENG","Dragon Dominion","3.49e+68","1.22e+63","🐲",true],["BRUS","Silverguard Legion","1.68e+72","2.25e+67","🛡️",true],["DYST","Arcane Council","4.38e+77","1.58e+73","🧙",true],["GOAT","Sunstone Kingdom","2.08e+83","2.06e+77","☀️",true],["WMDS","Chrono Sanctuary","4.19e+88","2.29e+82","⌛",true],["RMSG","Elysian Vault","4.98e+93","4.85e+87","💠",true],["PLUT","Rune Singularity","4.99e+98","3.86e+92","ᚷ",true],["ARRW","Ember Sovereigns","3.13e+103","3.58e+97","🔥",true],["MARS","Elder Titans","3.95e+108","1.81e+102","🗿",true],["VIPA","Nightmare Foundry","3.94e+113","2.12e+107","🌑",true],["SSDO","Celestial Realm","2.61e+119","4.95e+113","🌟",true],["SOML","Eternal Throne","3.92e+126","3.60e+118","👑",true],["ACAT","Infinite Labyrinth","1.26e+132","2.24e+125","♾️",true],["YOUV","Worldseed Nexus","4.50e+138","3.45e+131","🌱",true],["CATI","Elemental Empire","2.32e+144","4.75e+137","🌊",true],["JNUT","Fabled Pantheon","1.72e+150","1.77e+143","🔱",true],["LOST","Quantum Legion","4.25e+157","1.96e+150","🌀",true],["SCAT","Primal Nebula","4.91e+163","1.59e+156","🌌",true],["FBCS","Timekeeper's Gate","2.46e+170","4.61e+163","⌚",true],["JAZA","Forbidden Archive","1.34e+179","1.44e+170","📖",true],["BOTH","Phoenix Ascendant","3.31e+186","3.27e+177","🔥",true],["HAMO","Grand ARVEE Citadel","2.51e+193","1.42e+184","🏰",true],["KING","Immortal Dynasty","2.13e+200","4.06e+192","🏅",true],["FOBL","Realmforge Engine","2.74e+207","2.60e+199","⚙️",true],["JUJU","Cosmic Arbiter","3.09e+215","4.17e+207","🌠",true],["AICC","Genesis Architects","3.29e+222","1.01e+214","🪄",true],["FRBR","ARVEE Core","4.29e+230","1.53e+222","🌐",true]];
test("56 original operations remain stable alongside 3 prestige unlocks",()=>{
  assert.equal(generators.length,59);
  assert.deepEqual(catalogue.map(x=>[x.alias,x.name,x.baseCost,x.baseIncome,x.emoji,x.available]),source);
  assert.equal(new Set(generators.map(x=>x.description)).size,59);
  assert.deepEqual(generators.slice(0,56).map(x=>[x.id,x.name,x.cost,x.income]),
    catalogue.map(x=>[x.alias,x.name,x.baseCost,x.baseIncome]));
  assert.deepEqual(generators.slice(56).map(x=>[x.id,x.prestigeRequired]),
    [["RNFG",35],["VDXC",50],["ASTP",75]]);
  for(const operation of generators){
    assert.ok(operation.description.length>=45,operation.id+" is too generic");
    assert.ok(operation.description.length<=180,operation.id+" is too long");
    assert.doesNotMatch(operation.description,/a growing operation in|an advanced adventurer operation|a mythic arvee realm operation/i);
  }
  assert.match(byId.get("MONK").description,/copper veins/i);
  assert.match(byId.get("BSTA").description,/doodles/i);
  assert.match(byId.get("FRBR").description,/numbers go up/i);
});
test("Creditus Deletus is a safe usable Easter egg with a real forge recipe",()=>{
  const item=items.creditus_deletus;
  assert.equal(item.name,"Creditus Deletus");
  assert.deepEqual(item.effect,{prank:true});
  assert.match(item.use,/credits and progress stay intact/i);
  assert.deepEqual(recipes.creditus_deletus,{strange_matter:10,silver:15,cookie:1});
  for(const [ingredient,quantity] of Object.entries(recipes.creditus_deletus)){
    assert.ok(items[ingredient]);assert.ok(Number.isSafeInteger(quantity)&&quantity>0);
  }
});
