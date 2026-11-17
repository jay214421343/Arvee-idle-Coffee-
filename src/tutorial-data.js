"use strict";
// Compact, factual guide. No rewards or progress changes occur while browsing.
const STEPS=Object.freeze([
  Object.freeze({title:"Welcome to ARVEE Idle",body:
    "Build a crew that earns **Idle Credits (IC)** while you're away. Mine materials, unlock companions, travel the World Map, and compete with other adventurers.\n\n**Your first goal:** claim daily supplies and recruit your first passive operation.",
    commands:["/idle daily","/idle profile"]}),
  Object.freeze({title:"Claim daily supplies & mine",body:
    "**Daily** gives IC, Supply Caches and materials once per day.\n**Mining** earns IC and crafting materials on a cooldown. Perks and certain owned tonics can improve or reset a dig.\n\nTry these before spending your IC.",
    commands:["/idle daily","/idle mine"]}),
  Object.freeze({title:"Recruit an operation",body:
    "Visit the **Operations Shop** to hire your first crew. Operations generate IC passively, even when you're offline. Higher-tier operations cost more but earn more.\n\nRecruit one, then return to your Command Center to see your production.",
    commands:["/idle shop","/idle buy","/idle profile"]}),
  Object.freeze({title:"Use your Satchel & Forge",body:
    "Your **Satchel** stores materials, Supply Caches, consumables and companion eggs. Open caches for random rewards; use the **Forge** to craft useful equipment and eggs.\n\nYou can inspect any item even before owning it.",
    commands:["/idle inventory","/idle open","/idle craft","/idle info"]}),
  Object.freeze({title:"Choose a companion & explore",body:
    "Choose one of **three free starter companions**. Only one pet is active at a time. Pets grow through gameplay, and rarer species hatch from eggs.\n\nSend your operation crew on **World Map expeditions** to gather more resources.",
    commands:["/idle companions","/idle explore","/idle equipment"]}),
  Object.freeze({title:"Grow through seasons & groups",body:
    "The free **100-tier Season Journey** rewards normal gameplay with Season XP and claimable items. Daily and weekly contracts offer more goals.\n\nFight shared World Bosses and join a global guild for cooperative progression.",
    commands:["/idle season","/idle challenges","/idle boss","/idle guild view"]}),
  Object.freeze({title:"Prestige when you're ready",body:
    "At **1 billion IC**, you can **Prestige**: reset your IC and recruited operations for a permanent **+25% production boost per prestige**. Your other persistent progression stays. A bonus item is only a chance, never guaranteed.\n\nYou're ready! You can replay this guide whenever you like.",
    commands:["/idle prestige","/idle profile","/idle account tutorial"]})
]);
module.exports={STEPS};
