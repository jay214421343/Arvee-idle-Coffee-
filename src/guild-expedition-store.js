"use strict";
const defs = require("./guild-expeditions");
const guilds = require("./guilds");
const MIN_CONTRIBUTORS = 2;
const MIN_REWARD_UNITS = 2;
const MIN_SEASON_UNITS = 6;
function createGuildExpeditions({ transact, stateOf, addItem, event }) {
  async function currentGuild(db, userId) {
    return (await db.query(
      "SELECT m.guild_id,m.role,g.name,g.tag FROM idle_guild_members m " +
      "JOIN idle_guilds g ON g.id=m.guild_id WHERE m.user_id=$1",[userId]
    )).rows[0] || null;
  }
  async function guildScore(db, guildId, startKey, endKey) {
    const result=await db.query(
      "SELECT COALESCE(SUM(league_points),0)::integer AS score FROM idle_guild_expedition_missions " +
      "WHERE guild_id=$1 AND period_key >= $2 AND period_key < $3 AND completed_at IS NOT NULL",
      [guildId,startKey,endKey]
    );
    return Number(result.rows[0].score);
  }
  async function seasonEligibility(db, userId, seasonKey, now) {
    const dates=defs.parsedSeasonKey(seasonKey);
    if (new Date(now) < dates.end) return null;
    const lock=(await db.query(
      "SELECT guild_id::text AS guild_id FROM idle_guild_league_season_members " +
      "WHERE season_key=$1 AND user_id=$2",[seasonKey,userId]
    )).rows[0];
    if (!lock) return null;
    const scored=await guildScore(db,lock.guild_id,dates.key,dates.endKey);
    const contributions=(await db.query(
      "SELECT COALESCE(SUM(units),0)::integer AS n FROM idle_guild_expedition_contributions " +
      "WHERE guild_id=$1 AND user_id=$2 AND period_key >= $3 AND period_key < $4",
      [lock.guild_id,userId,dates.key,dates.endKey]
    )).rows[0];
    const accepted=Number(contributions.n);
    const reward=defs.seasonReward(scored);
    return reward && accepted >= MIN_SEASON_UNITS ?
      { seasonKey:dates.key,guildId:lock.guild_id,score:scored,accepted,...reward } : null;
  }
  async function grantProgress(db,userId,type,metadata={}) {
    const def=defs.BY_EVENT.get(type);
    if (!def) return 0;
    const member=await currentGuild(db,userId);
    if (!member) return 0;
    // Transaction's player-row lock prevents same-player double credit. The guild-row
    // lock serializes contributions from different members, across servers and shards.
    const exists=await db.query("SELECT id FROM idle_guilds WHERE id=$1 FOR UPDATE",[member.guild_id]);
    if (!exists.rowCount) return 0;
    const time=(await db.query(
      "SELECT clock_timestamp() AS now,(clock_timestamp() AT TIME ZONE 'UTC')::date AS day"
    )).rows[0];
    const week=defs.week(time.now),season=defs.season(time.now);
    await db.query(
      "INSERT INTO idle_guild_expedition_missions" +
      "(guild_id,period_key,mission_id,target,reward_ic,reward_item_id,reward_quantity,renown_reward,league_points) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [member.guild_id,week.key,def.id,def.goal,def.ic,def.itemId,def.quantity,def.renown,def.points]
    );
    const mission=(await db.query(
      "SELECT progress,target,completed_at,renown_reward FROM idle_guild_expedition_missions " +
      "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3 FOR UPDATE",
      [member.guild_id,week.key,def.id]
    )).rows[0];
    if(mission.completed_at) return 0;
    const daily=(await db.query(
      "SELECT units FROM idle_guild_expedition_daily " +
      "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3 AND user_id=$4 AND day=$5",
      [member.guild_id,week.key,def.id,userId,time.day]
    )).rows[0];
    if (Number(daily?.units||0)>=def.perDay) return 0;
    await db.query(
      "INSERT INTO idle_guild_league_season_members(season_key,user_id,guild_id) " +
      "VALUES($1,$2,$3) ON CONFLICT(season_key,user_id) DO NOTHING",
      [season.key,userId,member.guild_id]
    );
    const locked=(await db.query(
      "SELECT guild_id::text AS guild_id FROM idle_guild_league_season_members " +
      "WHERE season_key=$1 AND user_id=$2",[season.key,userId]
    )).rows[0];
    if (!locked || locked.guild_id!==String(member.guild_id)) return 0;
    await db.query(
      "INSERT INTO idle_guild_expedition_daily(guild_id,period_key,mission_id,user_id,day,units) " +
      "VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(guild_id,period_key,mission_id,user_id,day) " +
      "DO UPDATE SET units=idle_guild_expedition_daily.units+1",
      [member.guild_id,week.key,def.id,userId,time.day]
    );
    await db.query(
      "INSERT INTO idle_guild_expedition_contributions(guild_id,period_key,mission_id,user_id,units) " +
      "VALUES($1,$2,$3,$4,1) ON CONFLICT(guild_id,period_key,mission_id,user_id) " +
      "DO UPDATE SET units=idle_guild_expedition_contributions.units+1",
      [member.guild_id,week.key,def.id,userId]
    );
    const incremented=(await db.query(
      "UPDATE idle_guild_expedition_missions SET progress=LEAST(target,progress+1) " +
      "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3 RETURNING progress,target",
      [member.guild_id,week.key,def.id]
    )).rows[0];
    if (incremented.progress>=incremented.target) {
      const peers=(await db.query(
        "SELECT count(*)::integer AS n FROM idle_guild_expedition_contributions " +
        "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3",
        [member.guild_id,week.key,def.id]
      )).rows[0].n;
      if(peers>=MIN_CONTRIBUTORS) {
        const marked=await db.query(
          "UPDATE idle_guild_expedition_missions SET completed_at=$4 " +
          "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3 AND completed_at IS NULL RETURNING guild_id",
          [member.guild_id,week.key,def.id,time.now]
        );
        if(marked.rowCount) await db.query(
          "UPDATE idle_guilds SET xp=xp+$2,renown=renown+$2 WHERE id=$1",
          [member.guild_id,Number(mission.renown_reward)]
        );
      }
    }
    return 1;
  }
  async function ranks(db,startKey,endKey) {
    const rs=(await db.query(
      "SELECT g.id::text AS id,g.name,g.tag,COUNT(*)::integer AS completed," +
      "COALESCE(SUM(m.league_points),0)::integer AS score " +
      "FROM idle_guild_expedition_missions m JOIN idle_guilds g ON g.id=m.guild_id " +
      "WHERE m.completed_at IS NOT NULL AND m.period_key >= $1 AND m.period_key < $2 " +
      "GROUP BY g.id ORDER BY score DESC,completed DESC,MIN(m.completed_at) ASC,g.id LIMIT 5",
      [startKey,endKey]
    )).rows;
    return rs.map((r,i)=>({
      rank:i+1,id:r.id,name:r.name,tag:r.tag,completed:Number(r.completed),
      score:Number(r.score),tier:defs.tier(Number(r.score))
    }));
  }
  async function readBoard(db,userId) {
    const now=(await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
    const week=defs.week(now),season=defs.season(now);
    const member=await currentGuild(db,userId);
    const weekly=await ranks(db,week.key,defs.week(week.end).key);
    const seasonal=await ranks(db,season.key,season.endKey);
    const pending=(await db.query(
      "SELECT c.guild_id::text AS guild_id,c.period_key,c.mission_id,c.units," +
      "m.reward_ic,m.reward_item_id,m.reward_quantity " +
      "FROM idle_guild_expedition_contributions c " +
      "JOIN idle_guild_expedition_missions m " +
      "ON m.guild_id=c.guild_id AND m.period_key=c.period_key AND m.mission_id=c.mission_id " +
      "WHERE c.user_id=$1 AND c.claimed_at IS NULL AND c.units >= $2 " +
      "AND m.completed_at IS NOT NULL ORDER BY c.period_key,c.mission_id LIMIT 1",
      [userId,MIN_REWARD_UNITS]
    )).rows[0] || null;
    const locks=(await db.query(
      "SELECT season_key,guild_id::text AS guild_id FROM idle_guild_league_season_members " +
      "WHERE user_id=$1 AND season_key < $2 ORDER BY season_key ASC LIMIT 12",
      [userId,season.key]
    )).rows;
    let pendingSeason=null;
    for(const prior of locks) {
      const claimed=(await db.query(
        "SELECT 1 FROM idle_guild_league_season_claims WHERE season_key=$1 AND user_id=$2",
        [prior.season_key,userId]
      )).rowCount;
      if(claimed) continue;
      const qualified=await seasonEligibility(db,userId,prior.season_key,now);
      if(qualified) {pendingSeason=qualified;break;}
    }
    const leagueLock=(await db.query(
      "SELECT guild_id::text AS guild_id FROM idle_guild_league_season_members " +
      "WHERE season_key=$1 AND user_id=$2",[season.key,userId]
    )).rows[0];
    let missions=[],guild=null;
    if(member) {
      guild={id:String(member.guild_id),name:member.name,tag:member.tag,
        lockedElsewhere:!!leagueLock && leagueLock.guild_id!==String(member.guild_id)};
      const rows=(await db.query(
        "SELECT m.mission_id,m.progress,m.target,m.completed_at," +
        "COALESCE(c.units,0)::integer AS my_units," +
        "(SELECT count(*)::integer FROM idle_guild_expedition_contributions x " +
        "WHERE x.guild_id=m.guild_id AND x.period_key=m.period_key AND x.mission_id=m.mission_id) AS contributors " +
        "FROM idle_guild_expedition_missions m LEFT JOIN idle_guild_expedition_contributions c " +
        "ON c.guild_id=m.guild_id AND c.period_key=m.period_key AND c.mission_id=m.mission_id AND c.user_id=$3 " +
        "WHERE m.guild_id=$1 AND m.period_key=$2",
        [member.guild_id,week.key,userId]
      )).rows;
      const found=new Map(rows.map(r=>[r.mission_id,r]));
      missions=defs.MISSIONS.map(d=>{
        const r=found.get(d.id);
        return {id:d.id,name:d.name,event:d.event,goal:r?.target||d.goal,progress:Number(r?.progress||0),
          contributors:Number(r?.contributors||0),myUnits:Number(r?.my_units||0),
          completed:!!r?.completed_at,renown:d.renown};
      });
    }
    const score=guild?await guildScore(db,guild.id,season.key,season.endKey):0;
    const weekScore=guild?await guildScore(db,guild.id,week.key,defs.week(week.end).key):0;
    return {
      guild, missions, weekKey:week.key,weekEndsAt:week.end.toISOString(),
      seasonKey:season.key,seasonEndsAt:season.end.toISOString(),
      weekScore, seasonScore:score,seasonTier:defs.tier(score),
      weekly,seasonal,
      pending:pending?{guildId:pending.guild_id,periodKey:pending.period_key,missionId:pending.mission_id,
        units:Number(pending.units),name:defs.BY_ID.get(pending.mission_id)?.name||"Expedition",
        ic:Number(pending.reward_ic),itemId:pending.reward_item_id,quantity:Number(pending.reward_quantity)}:null,
      pendingSeason,seasonLockedElsewhere:!!guild?.lockedElsewhere
    };
  }
  async function getGuildExpeditions(userId) {
    return transact([userId],async db=>readBoard(db,userId));
  }
  async function claimGuildExpedition(userId) {
    return transact([userId],async(db,states)=>{
      const selected=(await db.query(
        "SELECT c.guild_id,c.period_key,c.mission_id,c.units,m.reward_ic,m.reward_item_id,m.reward_quantity " +
        "FROM idle_guild_expedition_contributions c " +
        "JOIN idle_guild_expedition_missions m " +
        "ON m.guild_id=c.guild_id AND m.period_key=c.period_key AND m.mission_id=c.mission_id " +
        "WHERE c.user_id=$1 AND c.claimed_at IS NULL AND c.units >= $2 " +
        "AND m.completed_at IS NOT NULL ORDER BY c.period_key,c.mission_id LIMIT 1 FOR UPDATE OF c",
        [userId,MIN_REWARD_UNITS]
      )).rows[0];
      if(!selected) throw new Error("You have no completed Guild Expedition rewards to claim.");
      const marked=await db.query(
        "UPDATE idle_guild_expedition_contributions SET claimed_at=clock_timestamp() " +
        "WHERE guild_id=$1 AND period_key=$2 AND mission_id=$3 AND user_id=$4 AND claimed_at IS NULL RETURNING user_id",
        [selected.guild_id,selected.period_key,selected.mission_id,userId]
      );
      if(!marked.rowCount) throw new Error("That Guild Expedition reward was already claimed.");
      const state=stateOf(states,userId);
      const ic=Number(selected.reward_ic);
      state.balance=state.balance.plus(ic);
      state.totalEarned=state.totalEarned.plus(ic);
      await addItem(db,userId,selected.reward_item_id,Number(selected.reward_quantity));
      await event(db,userId,"guild_expedition_reward",ic,{
        periodKey:selected.period_key,missionId:selected.mission_id,guildId:String(selected.guild_id)
      });
      return {name:defs.BY_ID.get(selected.mission_id)?.name||"Guild Expedition",ic,
        itemId:selected.reward_item_id,quantity:Number(selected.reward_quantity),periodKey:selected.period_key};
    });
  }
  async function claimGuildLeagueSeason(userId,rawSeasonKey) {
    const key=defs.parsedSeasonKey(rawSeasonKey).key;
    return transact([userId],async(db,states)=>{
      const now=(await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
      const qualified=await seasonEligibility(db,userId,key,now);
      if(!qualified) throw new Error("This league season is active or you did not meet the participation requirements.");
      const inserted=await db.query(
        "INSERT INTO idle_guild_league_season_claims(season_key,user_id,guild_id,tier) " +
        "VALUES($1,$2,$3,$4) ON CONFLICT(season_key,user_id) DO NOTHING RETURNING user_id",
        [key,userId,qualified.guildId,qualified.tier]
      );
      if(!inserted.rowCount) throw new Error("This league season reward was already claimed.");
      const state=stateOf(states,userId);
      state.balance=state.balance.plus(qualified.ic);
      state.totalEarned=state.totalEarned.plus(qualified.ic);
      await addItem(db,userId,qualified.itemId,qualified.quantity);
      await event(db,userId,"guild_league_reward",qualified.ic,{
        seasonKey:key,guildId:qualified.guildId,tier:qualified.tier,score:qualified.score
      });
      return qualified;
    });
  }
  return {grantProgress,getGuildExpeditions,claimGuildExpedition,claimGuildLeagueSeason,readBoard};
}
module.exports = createGuildExpeditions;
