"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
test("cross-server companion mastery, equipped charm ownership and rarity eggs are transactional",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))throw Error("Unsafe test DB");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const uid="999984000000"+crypto.randomInt(100000,999999);
  try {
    await store.profile(uid);
    await store.adoptCompanion(uid,"ember_fox");
    await assert.rejects(()=>store.chooseCompanionTalent(uid,"focus"),/level 10/);
    await assert.rejects(()=>store.equipCompanionCharm(uid,"prospector_charm"),/do not own/);
    await store.pool.query("UPDATE player_companions SET xp=4500 WHERE user_id=$1 AND pet_id='ember_fox'",[uid]);
    await store.chooseCompanionTalent(uid,"focus");
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'prospector_charm',1)",[uid]);
    await store.equipCompanionCharm(uid,"prospector_charm");
    let state=await store.getCompanions(uid);
    assert.equal(state.owned.find(p=>p.id==="ember_fox").talentId,"focus");
    assert.equal(state.equippedCharmId,"prospector_charm");
    assert.match(state.owned[0].bonus.description,/Focus/);
    await store.pool.query("DELETE FROM inventory WHERE user_id=$1 AND item_id='prospector_charm'",[uid]);
    state=await store.getCompanions(uid);
    assert.equal(state.equippedCharmId,null,"trading away charm disables bonuses immediately");
    await store.pool.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,'rare_companion_egg',1),($1,'mythic_companion_egg',1)",[uid]);
    const first=await store.hatchCompanion(uid,"rare_companion_egg");
    const second=await store.hatchCompanion(uid,"mythic_companion_egg");
    const cats=require("../src/companions");
    assert.ok(["Uncommon","Rare","Epic","Legendary","Mythic"].includes(cats.byId.get(first.petId).rarity));
    assert.ok(["Rare","Epic","Legendary","Mythic"].includes(cats.byId.get(second.petId).rarity));
    const remaining=await store.getCompanions(uid);
    assert.equal(remaining.eggCounts.rare_companion_egg,0);
    assert.equal(remaining.eggCounts.mythic_companion_egg,0);
    await store.equipCompanion(uid,"ember_fox");
    assert.equal((await store.getCompanions(uid)).owned.find(p=>p.id==="ember_fox").talentId,"focus");
  }finally{
    await store.pool.query("DELETE FROM economy_events WHERE user_id=$1",[uid]);
    await store.pool.query("DELETE FROM players WHERE user_id=$1",[uid]);
    await store.pool.end();
  }
});
