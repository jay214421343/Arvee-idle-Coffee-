"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
test("global player guilds, permissions, shared perks, daily caps and attribution are safe",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to run guild integration tests outside arvee_idle_test.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const rnd=crypto.randomInt(100000,999999);
  const ids=Array.from({length:20},(_,i)=>String(999900000000000000n+BigInt(i)*1000000n+BigInt(rnd)));
  const [a,b,c,d,e,f,g,...fillers]=ids;
  const key="20260202";
  const guildIds=[];
  try{
    const empty=await store.getGuild(a);
    assert.equal(empty.guild,null);
    assert.deepEqual(empty.invitations,[]);
    await assert.rejects(()=>store.acceptGuild(a,"42"),/no longer exists|does not exist/);
    await assert.rejects(()=>store.inviteGuild(a,b),/officers or the leader/);
    const first=await store.createGuild(a,"Frontier "+rnd,"FT"+String(rnd).slice(0,3));
    guildIds.push(first.id);
    assert.equal((await store.getGuild(a)).role,"leader");
    const creates=await Promise.allSettled([
      store.createGuild(a,"Other "+rnd,"AL"+String(rnd).slice(0,3)),
      store.createGuild(a,"Other "+rnd,"AL"+String(rnd).slice(0,3))
    ]);
    assert.equal(creates.filter(x=>x.status==="rejected").length,2);
    await assert.rejects(()=>store.createGuild(d,"Frontier "+rnd,"XX"+String(rnd).slice(0,3)),/already taken/);
    await assert.rejects(()=>store.createGuild(d,"Some Other "+rnd,first.tag),/already taken/);

    const invited=await store.inviteGuild(a,b);
    assert.equal(invited.inviteeId,b);
    assert.equal((await store.getGuild(b)).invitations.length,1);
    await assert.rejects(()=>store.acceptGuild(c,first.id),/invitation/);
    const joins=await Promise.allSettled([store.acceptGuild(b,first.id),store.acceptGuild(b,first.id)]);
    assert.equal(joins.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(joins.filter(x=>x.status==="rejected").length,1);
    assert.equal((await store.getGuild(b)).guild.id,first.id);
    await assert.rejects(()=>store.inviteGuild(b,c),/officers or the leader/);
    await store.manageGuild(a,b,"promote");
    assert.equal((await store.getGuild(b)).role,"officer");
    await assert.rejects(()=>store.manageGuild(b,a,"kick"),/cannot|Guild leaders/);
    await assert.rejects(()=>store.manageGuild(b,c,"promote"),/permission/);
    await store.inviteGuild(b,c);
    await store.acceptGuild(c,first.id);
    await store.manageGuild(a,c,"promote");
    await assert.rejects(()=>store.manageGuild(b,c,"kick"),/Officers can only/);
    await store.manageGuild(a,c,"demote");
    await store.manageGuild(b,c,"kick");
    assert.equal((await store.getGuild(c)).guild,null);
    const second=await store.createGuild(d,"Nightsong "+rnd,"NS"+String(rnd).slice(0,3));
    guildIds.push(second.id);

    // Exercise shared XP/Renown with authoritative transactional guild event updates.
    await store.transact([a],async(db)=>{
      for(let i=0;i<4;i++) await store.grantProgress(db,a,"world_boss_reward",{});
    });
    let hall=await store.getGuild(b);
    assert.equal(hall.guild.xp,140);
    assert.equal(hall.guild.renown,140);
    assert.equal(hall.guild.level,2);
    await assert.rejects(()=>store.upgradeGuild(b),/leader/);
    assert.equal((await store.upgradeGuild(a)).tier,1);
    assert.equal((await store.getGuild(b)).guild.hall,1);
    assert.equal((await store.getGuild(b)).guild.capacity,16);
    await assert.rejects(()=>store.upgradeGuild(a),/guild level/);
    const mined=await store.mine(a);
    assert.ok(mined.reward.gte(151),"Hall I must increase actual IC mining rewards");
    const preCap=await store.getGuild(a);
    await store.transact([a],async(db)=>{
      for(let i=0;i<10;i++) await store.grantProgress(db,a,"world_boss_reward",{});
    });
    const capped=await store.getGuild(a);
    assert.equal(capped.guild.xp-preCap.guild.xp,250-142);
    const afterMore=await store.transact([a],async db=>store.grantProgress(db,a,"world_boss_reward",{}));
    assert.equal(afterMore,0,"daily XP cap must prevent farming");
    assert.equal((await store.getGuild(b)).guild.xp,capped.guild.xp);

    await store.pool.query(
      "INSERT INTO world_boss_instances(period_key,boss_id,max_hp,hp,starts_at,ends_at,reward_pool,reward_item_id) " +
      "VALUES($1,'hollow_guardian',2500,2500,'2026-02-02T00:00:00Z','2026-02-09T00:00:00Z',5000,'ore')",
      [key]
    );
    await store.transact([b],async db=>{
      await store.grantProgress(db,b,"world_boss_attack",{damage:130,periodKey:key});
    });
    const before=(await store.pool.query(
      "SELECT damage FROM idle_guild_boss_damage WHERE guild_id=$1 AND user_id=$2 AND period_key=$3",
      [first.id,b,key]
    )).rows[0];
    assert.equal(Number(before.damage),130);
    await store.leaveGuild(b);
    await store.inviteGuild(d,b);
    await store.acceptGuild(b,second.id);
    await store.transact([b],async db=>{
      await store.grantProgress(db,b,"world_boss_attack",{damage:240,periodKey:key});
    });
    const historical=(await store.pool.query(
      "SELECT guild_id::text AS guild_id,damage FROM idle_guild_boss_damage WHERE user_id=$1 AND period_key=$2 ORDER BY guild_id",
      [b,key]
    )).rows;
    assert.equal(historical.length,2);
    assert.equal(Number(historical.find(x=>x.guild_id===first.id).damage),130);
    assert.equal(Number(historical.find(x=>x.guild_id===second.id).damage),240);
    assert.equal((await store.getGuild(b)).guild.id,second.id);
    await assert.rejects(()=>store.disbandGuild(b),/Only the leader/);
    await store.disbandGuild(d);
    assert.equal((await store.getGuild(b)).guild,null);
    assert.equal((await store.pool.query("SELECT 1 FROM idle_guild_boss_damage WHERE guild_id=$1",[second.id])).rowCount,0);

    // Ownership transfers remain atomic and prevent the former leader from acting.
    await assert.rejects(()=>store.manageGuild(a,c,"promote"),/not in your guild/);
    await assert.rejects(()=>store.manageGuild(a,b,"transfer"),/not in your guild/);
    await store.inviteGuild(a,e);
    await store.acceptGuild(e,first.id);
    await store.manageGuild(a,e,"transfer");
    assert.equal((await store.getGuild(e)).role,"leader");
    assert.equal((await store.getGuild(a)).role,"officer");
    await assert.rejects(()=>store.upgradeGuild(a),/leader/);
    await store.manageGuild(e,a,"transfer");
    assert.equal((await store.getGuild(a)).role,"leader");
    await store.pool.query("UPDATE players SET balance=2000000000,total_earned=2000000000 WHERE user_id=$1",[a]);
    await store.prestige(a);
    assert.equal((await store.getGuild(a)).guild.hall,1,"guild progression must survive personal prestige");

    // Capacity is serialized by the guild row, even if two different invited users race to join.
    const full=await store.createGuild(f,"Capstone "+rnd,"CP"+String(rnd).slice(0,3));
    guildIds.push(full.id);
    const members=fillers.slice(0,10);
    await store.pool.query(
      "INSERT INTO players(user_id) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",[members]
    );
    for(const id of members) await store.pool.query(
      "INSERT INTO idle_guild_members(user_id,guild_id,role) VALUES($1,$2,'member')",[id,full.id]
    );
    await store.inviteGuild(f,c);
    await store.inviteGuild(f,g);
    const races=await Promise.allSettled([store.acceptGuild(c,full.id),store.acceptGuild(g,full.id)]);
    assert.equal(races.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(races.filter(x=>x.status==="rejected").length,1);
    const view=await store.getGuild(f);
    assert.equal(view.guild.memberCount,12);
    assert.equal(view.guild.capacity,12);
    for(const officer of members.slice(0,3)) await store.manageGuild(f,officer,"promote");
    await assert.rejects(()=>store.manageGuild(f,members[3],"promote"),/three officers/);
    await assert.rejects(()=>store.manageGuild(f,members[3],"transfer"),/Demote an officer/);
    assert.equal((await store.getGuild(f)).role,"leader");
    await store.manageGuild(f,members[0],"demote");
    await store.manageGuild(f,members[3],"transfer");
    assert.equal((await store.getGuild(members[3])).role,"leader");
    assert.equal((await store.getGuild(f)).role,"officer");
    await assert.rejects(()=>store.disbandGuild(f),/Only the leader/);
    await store.disbandGuild(members[3]);
    assert.equal((await store.getGuild(f)).guild,null);
  } finally {
    await store.pool.query("DELETE FROM idle_guilds WHERE id=ANY($1::bigint[])",[guildIds]);
    await store.pool.query("DELETE FROM world_boss_instances WHERE period_key=$1",[key]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=ANY($1::text[])",[ids]);
    await store.pool.query("DELETE FROM players WHERE user_id=ANY($1::text[])",[ids]);
    await store.pool.end();
  }
});
