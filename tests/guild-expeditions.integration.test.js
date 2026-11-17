"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
test("guild expeditions and seasonal leagues are transactional across players, weeks and guild changes",{
  skip:!process.env.ARVEE_IDLE_TEST_DATABASE_URL
},async()=>{
  if(!/arvee_idle_test/.test(process.env.ARVEE_IDLE_TEST_DATABASE_URL))
    throw new Error("Refusing to test outside arvee_idle_test database.");
  process.env.DATABASE_URL=process.env.ARVEE_IDLE_TEST_DATABASE_URL;
  const store=require("../src/store");
  const defs=require("../src/guild-expeditions");
  const suffix=crypto.randomInt(100000,999999);
  const ids=Array.from({length:5},(_,i)=>String(999790000000000000n+BigInt(i)*1000000n+BigInt(suffix)));
  const [a,b,c,d,e]=ids;
  const week=defs.week(),oldWeek="20261109",oldSeason="20261019";
  const guildIds=[];
  try {
    assert.equal((await store.getGuildExpeditions(a)).guild,null);
    const first=await store.createGuild(a,"Expedition Ward "+suffix,"EW"+String(suffix).slice(0,3));
    guildIds.push(first.id);
    await store.inviteGuild(a,b);
    await store.acceptGuild(b,first.id);
    const second=await store.createGuild(c,"Small Vanguard "+suffix,"SV"+String(suffix).slice(0,3));
    guildIds.push(second.id);
    await store.inviteGuild(c,d);
    await store.acceptGuild(d,second.id);
    const initial=await store.getGuildExpeditions(a);
    assert.equal(initial.guild.id,first.id);
    assert.equal(initial.missions.length,4);
    assert.equal(initial.missions[0].progress,0);
    assert.equal(initial.weekScore,0);
    assert.equal(initial.seasonScore,0);
    assert.equal(initial.weekKey,week.key);

    // Real gameplay event integration: two accounts and a failed cooldown retry.
    assert.ok((await store.mine(a)).reward.gt(0));
    assert.ok((await store.mine(b)).reward.gt(0));
    assert.equal((await store.mine(a)).cooldown>0,true);
    let progress=await store.getGuildExpeditions(a);
    assert.equal(progress.missions.find(m=>m.id==="mining_run").progress,2);
    assert.equal(progress.missions.find(m=>m.id==="mining_run").contributors,2);
    assert.equal(progress.missions.find(m=>m.id==="mining_run").myUnits,1);
    for(let i=0;i<4;i++){
      await store.pool.query(
        "UPDATE players SET last_mine_at=now()-interval '5 minutes' WHERE user_id=ANY($1::text[])",[[a,b]]
      );
      const results=await Promise.all([store.mine(a),store.mine(b)]);
      assert.ok(results.every(r=>r.reward && !r.cooldown));
    }
    progress=await store.getGuildExpeditions(a);
    const mine=progress.missions.find(m=>m.id==="mining_run");
    assert.equal(mine.progress,10);
    assert.equal(mine.completed,true);
    assert.equal(mine.contributors,2);
    assert.equal(mine.myUnits,5);
    assert.equal(progress.weekScore,100);
    assert.equal(progress.seasonScore,100);
    assert.equal(progress.weekly.find(r=>r.id===first.id).score,100);
    const g=await store.getGuild(a);
    assert.ok(g.guild.renown>=50,"mission completion must credit shared Renown");
    const beforeMore=g.guild.renown;
    await store.pool.query("UPDATE players SET last_mine_at=now()-interval '5 minutes' WHERE user_id=$1",[a]);
    await store.mine(a);
    assert.equal((await store.getGuildExpeditions(a)).weekScore,100,"completed mission cannot reward twice");
    assert.ok((await store.getGuild(a)).guild.renown>=beforeMore);

    // Both members may earn one personal reward; duplicate button presses cannot mint twice.
    assert.equal((await store.getGuildExpeditions(a)).pending.missionId,"mining_run");
    const before=await store.profile(a);
    const claims=await Promise.allSettled([store.claimGuildExpedition(a),store.claimGuildExpedition(a)]);
    assert.equal(claims.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(claims.filter(x=>x.status==="rejected").length,1);
    const paid=claims.find(x=>x.status==="fulfilled").value;
    assert.equal(paid.ic,300);
    assert.equal(paid.itemId,"ore");
    const after=await store.profile(a);
    assert.equal(after.balance.minus(before.balance).toNumber(),300);
    assert.equal((await store.getGuildExpeditions(a)).pending,null);
    await assert.rejects(()=>store.claimGuildExpedition(a),/no completed/);
    assert.equal((await store.claimGuildExpedition(b)).ic,300);

    // Season lock: switching guilds cannot move or duplicate accrued expedition progress.
    await store.leaveGuild(b);
    await store.inviteGuild(c,b);
    await store.acceptGuild(b,second.id);
    assert.equal((await store.getGuildExpeditions(b)).seasonLockedElsewhere,true);
    await store.pool.query("UPDATE players SET last_mine_at=now()-interval '5 minutes' WHERE user_id=$1",[b]);
    await store.mine(b);
    assert.equal((await store.getGuildExpeditions(c)).missions.find(m=>m.id==="mining_run").progress,0);
    assert.equal((await store.getGuildExpeditions(a)).weekScore,100);

    // A single large contributor can reach the goal, but cannot finalize a
    // cooperative mission until a second guild member performs a real action.
    for(let i=0;i<5;i++) {
      if(i)await store.pool.query("UPDATE players SET last_mine_at=now()-interval '5 minutes' WHERE user_id=$1",[c]);
      assert.ok((await store.mine(c)).reward.gt(0));
    }
    await store.pool.query(
      "UPDATE idle_guild_expedition_daily SET day=day-interval '1 day' " +
      "WHERE guild_id=$1 AND period_key=$2 AND mission_id='mining_run' AND user_id=$3",
      [second.id,week.key,c]
    );
    for(let i=0;i<5;i++){
      await store.pool.query("UPDATE players SET last_mine_at=now()-interval '5 minutes' WHERE user_id=$1",[c]);
      assert.ok((await store.mine(c)).reward.gt(0));
    }
    let solo=await store.getGuildExpeditions(c);
    let soloMission=solo.missions.find(m=>m.id==="mining_run");
    assert.equal(soloMission.progress,10);
    assert.equal(soloMission.contributors,1);
    assert.equal(soloMission.completed,false);
    assert.equal(solo.weekScore,0);
    await store.mine(d);
    solo=await store.getGuildExpeditions(d);
    soloMission=solo.missions.find(m=>m.id==="mining_run");
    assert.equal(soloMission.progress,10);
    assert.equal(soloMission.completed,true);
    assert.equal(soloMission.contributors,2);
    assert.equal(solo.weekScore,100);
    assert.equal((await store.getGuildExpeditions(d)).pending,null,"one accepted action cannot claim");
    assert.equal((await store.claimGuildExpedition(c)).ic,300);

    // Old-week reward remains claimable after leaving the guild and changing season.
    await store.pool.query(
      "INSERT INTO idle_guild_expedition_missions" +
      "(guild_id,period_key,mission_id,target,progress,reward_ic,reward_item_id,reward_quantity,renown_reward,league_points,completed_at) " +
      "VALUES($1,$2,'frontier_survey',6,6,550,'silver',2,75,100,'2026-11-12T00:00:00Z')",
      [first.id,oldWeek]
    );
    await store.pool.query(
      "INSERT INTO idle_guild_expedition_contributions(guild_id,period_key,mission_id,user_id,units) " +
      "VALUES($1,$2,'frontier_survey',$3,2)",[first.id,oldWeek,b]
    );
    let old=await store.getGuildExpeditions(b);
    assert.equal(old.pending.periodKey,oldWeek);
    assert.equal(old.pending.ic,550);
    assert.equal((await store.claimGuildExpedition(b)).ic,550);
    await assert.rejects(()=>store.claimGuildExpedition(b),/no completed/);

    // Historic league snapshots: season claim is tied to the original guild,
    // requires 6+ accepted actions, and remains once-only after changing guilds.
    await store.pool.query(
      "INSERT INTO idle_guild_league_season_members(season_key,user_id,guild_id) VALUES($1,$2,$3)",
      [oldSeason,b,first.id]
    );
    const snapshots=[
      ["mining_run",10,300,"ore",3,50],
      ["frontier_survey",6,550,"silver",2,75],
      ["siege_support",8,700,"gold",1,90],
      ["supply_line",5,450,"lootbox",1,65]
    ];
    for(const [mission,goal,ic,item,qty,renown] of snapshots){
      await store.pool.query(
        "INSERT INTO idle_guild_expedition_missions" +
        "(guild_id,period_key,mission_id,target,progress,reward_ic,reward_item_id,reward_quantity,renown_reward,league_points,completed_at) " +
        "VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,100,'2026-10-22T00:00:00Z')",
        [first.id,oldSeason,mission,goal,ic,item,qty,renown]
      );
      await store.pool.query(
        "INSERT INTO idle_guild_expedition_contributions(guild_id,period_key,mission_id,user_id,units) " +
        "VALUES($1,$2,$3,$4,2)",[first.id,oldSeason,mission,b]
      );
    }
    const board=await store.getGuildExpeditions(b);
    assert.equal(board.pendingSeason.seasonKey,oldSeason);
    assert.equal(board.pendingSeason.tier,"Bronze");
    assert.ok(board.pendingSeason.score>=400);
    await assert.rejects(()=>store.claimGuildLeagueSeason(d,oldSeason),/participation requirements/);
    const priorBalance=await store.profile(b);
    const seasonClaims=await Promise.allSettled([
      store.claimGuildLeagueSeason(b,oldSeason),store.claimGuildLeagueSeason(b,oldSeason)
    ]);
    assert.equal(seasonClaims.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(seasonClaims.filter(x=>x.status==="rejected").length,1);
    assert.equal(seasonClaims.find(x=>x.status==="fulfilled").value.ic,750);
    const afterSeason=await store.profile(b);
    assert.equal(afterSeason.balance.minus(priorBalance.balance).toNumber(),750);
    assert.equal((await store.getGuildExpeditions(b)).pendingSeason,null);
    await assert.rejects(()=>store.claimGuildLeagueSeason(b,oldSeason),/already claimed/);
    await assert.rejects(()=>store.claimGuildLeagueSeason(b,defs.season().key),/still active|participation requirements/);
    const audits=(await store.pool.query(
      "SELECT event_type,count(*)::integer AS n FROM economy_events " +
      "WHERE user_id=$1 AND event_type IN ('guild_expedition_reward','guild_league_reward') GROUP BY event_type",[b]
    )).rows;
    assert.equal(audits.find(x=>x.event_type==="guild_expedition_reward").n,2);
    assert.equal(audits.find(x=>x.event_type==="guild_league_reward").n,1);

    // Disbanding must NOT erase an account's season lock or an already claimed
    // season receipt. Otherwise a new guild could replay the same season prize.
    await store.disbandGuild(a);
    const preserved=await store.pool.query(
      "SELECT guild_id::text AS id FROM idle_guild_league_season_members WHERE season_key=$1 AND user_id=$2",
      [defs.season().key,a]
    );
    assert.equal(preserved.rows[0].id,first.id);
    const receipt=await store.pool.query(
      "SELECT guild_id::text AS id,tier FROM idle_guild_league_season_claims WHERE season_key=$1 AND user_id=$2",
      [oldSeason,b]
    );
    assert.equal(receipt.rowCount,1);
    assert.equal(receipt.rows[0].id,first.id);
    assert.equal(receipt.rows[0].tier,"Bronze");
    await store.inviteGuild(c,a);
    await store.acceptGuild(a,second.id);
    assert.equal((await store.getGuildExpeditions(a)).seasonLockedElsewhere,true);
    const daily=await store.daily(a);
    assert.ok(daily.received,"the player's regular gameplay still works");
    assert.equal((await store.getGuildExpeditions(c)).missions.find(m=>m.id==="supply_line").progress,0,
      "disbanding and rejoining must not mint a new guild's expedition progress");
    await assert.rejects(()=>store.claimGuildLeagueSeason(b,oldSeason),
      /participation requirements|already claimed/);
  } finally {
    await store.pool.query("DELETE FROM idle_guilds WHERE id=ANY($1::bigint[])",[guildIds]);
    await store.pool.query("DELETE FROM economy_events WHERE user_id=ANY($1::text[])",[ids]);
    await store.pool.query("DELETE FROM players WHERE user_id=ANY($1::text[])",[ids]);
    await store.pool.end();
  }
});
