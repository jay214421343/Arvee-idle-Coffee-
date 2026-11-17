"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dec, purchaseCost, maxAffordable } = require("../src/economy");
const { elapsedLabel, affordabilityHint } = require("../src/progression");
const ui = require("../src/ui");
const owner = "123456789012345678";
const sample = { balance:dec(25000),rate:dec(100),totalEarned:dec(20000),
  prestige:0,mineXp:1,pickaxeTier:0,perks:[],generators:[],
  inventory:[],lastMine:null,lastDaily:null };
test("buy max returns exact affordable quantity without changing cost math", () => {
  for (const balance of ["0", "99", "100", "1000", "10000", "1e222"]) {
    const amount = maxAffordable(100, 0, dec(balance));
    assert.ok(amount >= 0 && amount <= 1000);
    if (amount) assert.ok(purchaseCost(100,0,amount).lte(dec(balance)));
    if (amount < 1000) assert.ok(purchaseCost(100,0,amount+1).gt(dec(balance)));
  }
  assert.equal(maxAffordable(100,9999,"1e300"),1);
  assert.equal(maxAffordable(100,10000,"1e300"),0);
  assert.equal(maxAffordable(100,0,99),0);
  assert.throws(()=>maxAffordable(100,-1,1000),/Invalid generator quantity/);
  assert.throws(()=>maxAffordable(100,0,1000,1001),/Invalid generator quantity/);
  assert.equal(maxAffordable(100,0,-1),0);
});
test("category navigation uses six choices and one hop for all old destinations", () => {
  const home=ui.home(owner,{username:"IdlePlayer",
    displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},sample).toJSON();
  const dropdown=home.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
  assert.deepEqual(dropdown.options.map(x=>x.value),
    ["shop","inventory","adventure_menu","guild","progress_menu","more_menu"]);
  for(const key of ["adventure","progress","more"]) {
    const board=ui.sectionMenu(owner,key).toJSON();
    assert.equal(board.type,17);
    assert.ok(board.components.length <=10);
    assert.ok(JSON.stringify(board).length<10000);
    const menu=board.components.filter(c=>c.type===1).flatMap(c=>c.components).find(c=>c.type===3);
    assert.ok(menu.options.length<=5);
    assert.match(menu.custom_id,/^ai:2:123456789012345678:navigate:/);
    const buttons=board.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===2);
    assert.deepEqual(buttons.map(c=>c.label),["Command Center"]);
  }
});
test("buy max UI disables unaffordable action and keeps operation screen compact", () => {
  const cheap=ui.generator(owner,"MSPS",1,sample).toJSON();
  const controls=cheap.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===2);
  assert.deepEqual(controls.map(c=>c.label).slice(0,2),["Buy 1","Buy 10"]);
  assert.match(controls[2].label,/^Buy Max/);
  assert.equal(controls[2].disabled,false);
  assert.ok(cheap.components.length<=10);
  const poor=ui.generator(owner,"MSPS",1,{...sample,balance:dec(0)}).toJSON();
  const poorControls=poor.components.filter(c=>c.type===1).flatMap(c=>c.components).filter(c=>c.type===2);
  assert.equal(poorControls[2].disabled,true);
  assert.match(JSON.stringify(poor),/NEXT OPERATION/);
});
test("passive return summaries reflect saved settlements, not repeated bonuses", () => {
  const first=ui.home(owner,{username:"IdlePlayer",
    displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},
    {...sample,passiveEarned:dec(7500),passiveSeconds:750}).toJSON();
  assert.match(JSON.stringify(first),/PASSIVE INCOME SETTLED/);
  assert.match(JSON.stringify(first),/7.5K/);
  const recent=ui.home(owner,{username:"IdlePlayer",
    displayAvatarURL:()=>"https://cdn.discordapp.com/embed/avatars/0.png"},
    {...sample,passiveEarned:dec(20),passiveSeconds:2}).toJSON();
  assert.doesNotMatch(JSON.stringify(recent),/PASSIVE INCOME SETTLED/);
  assert.equal(elapsedLabel(750),"12m");
  assert.match(affordabilityHint(1000,100,100),/About 9s/);
});
