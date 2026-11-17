"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
test("restored Coffee items function transactionally and cosmetics survive prestige",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to use a non-test database.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const user="999993000000"+crypto.randomInt(100000,999999);
  const ids=["arthurs_tablet","crafting_materials","genreset","gnome","kingstones_stone","mine_alert","nametag","payment","pick_skin","reward","stat_card","tag"];
  const oldRandom=Math.random;
  try {
    await store.profile(user);
    await store.pool.query("UPDATE players SET balance=100000,total_earned=100000 WHERE user_id=$1",[user]);
    for(const itemId of ids)
      await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,$2,1)",[user,itemId]);
    const before=await store.profile(user);
    const timer=await store.useItem(user,"mine_alert");
    assert.match(timer.message,/Mining is ready/);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="mine_alert").quantity,1);
    const stats=await store.useItem(user,"stat_card");
    assert.equal(stats.showStats,true);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="stat_card").quantity,1);
    await assert.rejects(()=>store.useItem(user,"nametag","<everyone>"),/Names must/);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="nametag").quantity,1);
    assert.match((await store.useItem(user,"nametag","Moonshard")).message,/Moonshard/);
    assert.match((await store.useItem(user,"tag","Coffee Veteran")).message,/Coffee Veteran/);
    await store.useItem(user,"pick_skin");
    const decorated=await store.profile(user);
    assert.equal(decorated.pickaxeName,"Moonshard");
    assert.equal(decorated.pickaxeStyle,"I Skin");
    assert.equal(decorated.profileTag,"Coffee Veteran");
    await store.useItem(user,"arthurs_tablet");
    await store.useItem(user,"kingstones_stone");
    assert.equal((await store.profile(user)).mineXp,before.mineXp+37);
    await store.useItem(user,"reward");
    assert.equal((await store.profile(user)).mineBoostMultiplier.toString(),"1.6");
    assert.equal((await store.profile(user)).mineBoostCharges,3);
    await store.pool.query("UPDATE players SET last_mine_at=now() WHERE user_id=$1",[user]);
    await store.useItem(user,"gnome");
    const boosted=await store.profile(user);
    assert.equal(boosted.lastMine,null);
    assert.equal(boosted.mineBonus.toString(),"4");
    assert.equal(boosted.mineBoostMultiplier.toString(),"1.6");
    assert.equal(boosted.mineBoostCharges,3);
    await store.useItem(user,"crafting_materials");
    let gathered=await store.profile(user);
    assert.equal(gathered.inventory.find(x=>x.item_id==="ore").quantity,4);
    assert.equal(gathered.inventory.find(x=>x.item_id==="silver").quantity,2);
    const wallet=gathered.balance;
    await store.useItem(user,"payment");
    gathered=await store.profile(user);
    assert.ok(gathered.balance.gte(wallet.plus(500)));
    assert.ok(gathered.balance.minus(wallet).lt(505));
    const rosterBefore=gathered.generators;
    await store.useItem(user,"genreset");
    const rosterAfter=(await store.profile(user)).generators;
    assert.equal(rosterAfter.find(g=>g.generator_id==="MSPS").quantity,1);
    assert.equal(rosterAfter.length,rosterBefore.length+1);
    await store.pool.query("UPDATE players SET balance=2000000000,total_earned=2000000000 WHERE user_id=$1",[user]);
    assert.equal((await store.prestige(user)).prestige,1);
    const retained=await store.profile(user);
    assert.equal(retained.pickaxeName,"Moonshard");
    assert.equal(retained.pickaxeStyle,"I Skin");
    assert.equal(retained.profileTag,"Coffee Veteran");
    assert.equal(retained.generators.length,0);
    assert.equal(retained.inventory.find(x=>x.item_id==="rebirth_cocktail").quantity,1);
    assert.equal(retained.inventory.find(x=>x.item_id==="mine_alert").quantity,1);
    const atLeastOne=await store.pool.query("SELECT count(*)::integer AS n FROM economy_events WHERE user_id=$1 AND event_type='use_item'",[user]);
    assert.ok(atLeastOne.rows[0].n>=8);
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'lootbox',1)",[user]);
    let rolls=0;
    Math.random=()=>[0.7,0.001,0.99][rolls++%3];
    const drops=await store.openLootbox(user,1,"lootbox");
    assert.equal(drops.ore,1);
    assert.equal(drops.crafting_materials,1);
    assert.equal((await store.profile(user)).inventory.find(x=>x.item_id==="crafting_materials").quantity,1);
  } finally {
    Math.random=oldRandom;
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[user]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[user]);
    await store.pool.end();
  }
});
