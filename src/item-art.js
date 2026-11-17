"use strict";
// Discord application-owned emoji IDs. Unknown is the default until an asset is uploaded.
// Keep art independent of inventory/economy IDs; no asset should be required for gameplay.
const UNKNOWN = "<:unknown:1572286729048821953>";
const ITEM_ART = Object.freeze({
  silver: "<a:silver:1572284313511141477>",
  lootbox: "<:lootbox:1572285929358368799>"
});
const SKIN_ART = Object.freeze({
  "I Skin": "<:i_skin:1572286343055151254>",
  "I Skin II": "<:i_skin2:1572286345165021285>",
  "Demon Skin": "<:demon_skin:1572286340928774184>"
});
function itemArt(id) { return ITEM_ART[id] || UNKNOWN; }
function pickaxeArt(style) { return SKIN_ART[style] || UNKNOWN; }
module.exports = { UNKNOWN, ITEM_ART, SKIN_ART, itemArt, pickaxeArt };
