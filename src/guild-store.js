"use strict";
const guilds = require("./guilds");
const bosses = require("./world-bosses");
const INVITE_MS = 72 * 60 * 60 * 1000;
const ROSTER_LIMIT = 10;
function createGuildStore({ transact, pool, stateOf, dec, assertId }) {
  async function membership(db, userId) {
    return (await db.query(
      "SELECT m.guild_id,m.role,g.name,g.tag,g.hall_tier FROM idle_guild_members m " +
      "JOIN idle_guilds g ON g.id=m.guild_id WHERE m.user_id=$1", [userId]
    )).rows[0] || null;
  }
  async function perkTier(db, userId) {
    return Number((await membership(db, userId))?.hall_tier || 0);
  }
  async function grantProgress(db, userId, type, metadata = {}) {
    const base = guilds.xpForEvent(type, metadata);
    if (!base && type !== "world_boss_attack") return 0;
    const m = await membership(db, userId);
    if (!m) return 0;
    if (type === "world_boss_attack" && metadata.damage > 0 &&
        /^[0-9]{8}$/.test(String(metadata.periodKey || ""))) {
      await db.query(
        "INSERT INTO idle_guild_boss_damage(guild_id,period_key,user_id,damage) VALUES($1,$2,$3,$4) " +
        "ON CONFLICT(guild_id,period_key,user_id) DO UPDATE " +
        "SET damage=idle_guild_boss_damage.damage+EXCLUDED.damage",
        [m.guild_id, metadata.periodKey, userId, Math.floor(metadata.damage)]
      );
    }
    if (!base) return 0;
    // The player row is locked by transact: concurrent actions cannot exceed the per-user daily cap.
    const today = (await db.query("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date AS day")).rows[0].day;
    const prev = Number((await db.query(
      "SELECT xp FROM idle_guild_daily_xp WHERE guild_id=$1 AND user_id=$2 AND day=$3",
      [m.guild_id,userId,today]
    )).rows[0]?.xp || 0);
    const earned = Math.min(base, Math.max(0, guilds.DAILY_XP_CAP - prev));
    if (!earned) return 0;
    await db.query(
      "INSERT INTO idle_guild_daily_xp(guild_id,user_id,day,xp) VALUES($1,$2,$3,$4) " +
      "ON CONFLICT(guild_id,user_id,day) DO UPDATE SET xp=idle_guild_daily_xp.xp+EXCLUDED.xp",
      [m.guild_id,userId,today,earned]
    );
    await db.query(
      "UPDATE idle_guilds SET xp=xp+$2,renown=renown+$2 WHERE id=$1",
      [m.guild_id,earned]
    );
    await db.query(
      "INSERT INTO idle_guild_member_xp(guild_id,user_id,xp) VALUES($1,$2,$3) " +
      "ON CONFLICT(guild_id,user_id) DO UPDATE SET xp=idle_guild_member_xp.xp+EXCLUDED.xp",
      [m.guild_id,userId,earned]
    );
    return earned;
  }
  async function getGuild(userId) {
    return transact([userId], async (db) => {
      const m = await membership(db,userId);
      const today = (await db.query("SELECT clock_timestamp() AS now")).rows[0].now;
      const periodKey = bosses.cycle(today).key;
      const leaderRows = (await db.query(
        "SELECT g.id::text AS id,g.name,g.tag,COALESCE(SUM(d.damage),0)::bigint AS damage " +
        "FROM idle_guilds g JOIN idle_guild_boss_damage d ON d.guild_id=g.id AND d.period_key=$1 " +
        "GROUP BY g.id ORDER BY damage DESC,g.id LIMIT 5",[periodKey]
      )).rows;
      const rankings = leaderRows.map((r,i)=>({ rank:i+1,id:r.id,name:r.name,tag:r.tag,damage:Number(r.damage) }));
      const invitations = (await db.query(
        "SELECT i.guild_id::text AS id,g.name,g.tag,i.expires_at FROM idle_guild_invites i " +
        "JOIN idle_guilds g ON g.id=i.guild_id WHERE i.invitee_id=$1 AND i.expires_at>$2 " +
        "ORDER BY i.created_at DESC LIMIT 10", [userId,today]
      )).rows.map((r)=>({ id:r.id,name:r.name,tag:r.tag,expiresAt:r.expires_at.toISOString() }));
      if (!m) return {guild:null,role:null,members:[],invitations,rankings,periodKey};
      const g = (await db.query(
        "SELECT *,id::text AS guild_id FROM idle_guilds WHERE id=$1",[m.guild_id]
      )).rows[0];
      const roster = (await db.query(
        "SELECT m.user_id,m.role,m.joined_at,COALESCE(x.xp,0)::bigint AS contributed_xp " +
        "FROM idle_guild_members m LEFT JOIN idle_guild_member_xp x " +
        "ON x.guild_id=m.guild_id AND x.user_id=m.user_id " +
        "WHERE m.guild_id=$1 ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END," +
        "contributed_xp DESC,m.joined_at ASC LIMIT $2", [m.guild_id,ROSTER_LIMIT]
      )).rows;
      const memberCount = Number((await db.query(
        "SELECT count(*)::integer AS n FROM idle_guild_members WHERE guild_id=$1",
        [m.guild_id]
      )).rows[0].n);
      const damage = Number((await db.query(
        "SELECT COALESCE(SUM(damage),0)::bigint AS damage FROM idle_guild_boss_damage WHERE guild_id=$1 AND period_key=$2",
        [m.guild_id,periodKey]
      )).rows[0].damage);
      const xp=Number(g.xp), renown=Number(g.renown),hall=Number(g.hall_tier);
      const guildLevel=guilds.level(xp);
      return { guild: {id:g.guild_id,name:g.name,tag:g.tag,xp,renown,hall,
        level:guildLevel,levelGoal:guildLevel===guilds.MAX_LEVEL?guilds.xpForLevel(guilds.MAX_LEVEL):
          guilds.xpForLevel(guildLevel+1),
        capacity:guilds.capacity(hall),memberCount,ownerId:g.owner_id,damage},
        role:m.role,members:roster.map((r)=>({userId:r.user_id,role:r.role,xp:Number(r.contributed_xp)})),
        invitations,rankings,periodKey };
    });
  }
  async function createGuild(userId,name,tag) {
    const cleanName=guilds.validName(name),cleanTag=guilds.validTag(tag);
    return transact([userId], async(db)=>{
      if(await membership(db,userId)) throw new Error("Leave your current guild before creating another.");
      let created;
      try {
        created = (await db.query(
          "INSERT INTO idle_guilds(name,tag,owner_id) VALUES($1,$2,$3) RETURNING id::text AS id",
          [cleanName,cleanTag,userId]
        )).rows[0];
      } catch(e) {
        if(e.code==="23505") throw new Error("That guild name or tag is already taken.");
        throw e;
      }
      await db.query(
        "INSERT INTO idle_guild_members(user_id,guild_id,role) VALUES($1,$2,'leader')",
        [userId,created.id]
      );
      return {id:created.id,name:cleanName,tag:cleanTag};
    });
  }
  async function inviteGuild(userId,inviteeId) {
    assertId(inviteeId);
    if(String(userId)===String(inviteeId)) throw new Error("You cannot invite yourself.");
    return transact([userId],async(db)=>{
      const m=await membership(db,userId);
      if(!m || !guilds.roleCanManage(m.role,"invite")) throw new Error("Guild officers or the leader can invite players.");
      await db.query("SELECT id FROM idle_guilds WHERE id=$1 FOR UPDATE",[m.guild_id]);
      if(await membership(db,inviteeId)) throw new Error("That player already belongs to a guild.");
      const pending=Number((await db.query(
        "SELECT count(*)::integer AS n FROM idle_guild_invites WHERE guild_id=$1 AND expires_at>clock_timestamp()",
        [m.guild_id]
      )).rows[0].n);
      const existing=(await db.query(
        "SELECT 1 FROM idle_guild_invites WHERE guild_id=$1 AND invitee_id=$2 AND expires_at>clock_timestamp()",
        [m.guild_id,inviteeId]
      )).rowCount>0;
      if(pending>=20 && !existing) throw new Error("Too many pending invitations. Try again after an invitation expires.");
      const expires=new Date(Date.now()+INVITE_MS);
      await db.query(
        "INSERT INTO idle_guild_invites(guild_id,invitee_id,inviter_id,expires_at) " +
        "VALUES($1,$2,$3,$4) ON CONFLICT(guild_id,invitee_id) DO UPDATE " +
        "SET inviter_id=EXCLUDED.inviter_id,expires_at=EXCLUDED.expires_at,created_at=now()",
        [m.guild_id,inviteeId,userId,expires]
      );
      return {name:m.name,tag:m.tag,inviteeId};
    });
  }
  async function acceptGuild(userId,rawGuildId) {
    const id=guilds.validGuildId(rawGuildId);
    return transact([userId],async(db)=>{
      if(await membership(db,userId)) throw new Error("You already belong to a guild.");
      const g=(await db.query("SELECT * FROM idle_guilds WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if(!g) throw new Error("That guild no longer exists.");
      const invite=(await db.query(
        "SELECT 1 FROM idle_guild_invites WHERE guild_id=$1 AND invitee_id=$2 AND expires_at>clock_timestamp()",
        [id,userId]
      )).rowCount>0;
      if(!invite) throw new Error("Your invitation expired or does not exist.");
      const count=Number((await db.query(
        "SELECT count(*)::integer AS n FROM idle_guild_members WHERE guild_id=$1",[id]
      )).rows[0].n);
      if(count>=guilds.capacity(g.hall_tier)) throw new Error("This guild is full.");
      await db.query("INSERT INTO idle_guild_members(user_id,guild_id,role) VALUES($1,$2,'member')",[userId,id]);
      await db.query("DELETE FROM idle_guild_invites WHERE invitee_id=$1",[userId]);
      return {id,name:g.name,tag:g.tag};
    });
  }
  async function declineGuild(userId,rawGuildId) {
    const id=guilds.validGuildId(rawGuildId);
    return transact([userId],async(db)=>{
      const deleted=await db.query("DELETE FROM idle_guild_invites WHERE guild_id=$1 AND invitee_id=$2 RETURNING guild_id",[id,userId]);
      if(!deleted.rowCount) throw new Error("No invitation from that guild.");
      return {id};
    });
  }
  async function leaveGuild(userId) {
    return transact([userId],async(db)=>{
      const m=await membership(db,userId);
      if(!m) throw new Error("You are not in a guild.");
      const g=(await db.query("SELECT name FROM idle_guilds WHERE id=$1 FOR UPDATE",[m.guild_id])).rows[0];
      if(m.role==="leader") throw new Error("Transfer leadership or disband your guild before leaving.");
      await db.query("DELETE FROM idle_guild_members WHERE guild_id=$1 AND user_id=$2",[m.guild_id,userId]);
      return {name:g.name};
    });
  }
  async function manageGuild(userId,targetId,action) {
    assertId(targetId);
    if(String(targetId)===String(userId)) throw new Error("You cannot change your own guild role.");
    if(!["kick","promote","demote","transfer"].includes(action)) throw new Error("Unknown guild management action.");
    return transact([userId,targetId],async(db)=>{
      const m=await membership(db,userId);
      if(!m || !guilds.roleCanManage(m.role,action)) throw new Error("You do not have permission for this guild action.");
      const g=(await db.query("SELECT * FROM idle_guilds WHERE id=$1 FOR UPDATE",[m.guild_id])).rows[0];
      const target=(await db.query(
        "SELECT role FROM idle_guild_members WHERE guild_id=$1 AND user_id=$2",[m.guild_id,targetId]
      )).rows[0];
      if(!target) throw new Error("That player is not in your guild.");
      if(target.role==="leader") throw new Error("Guild leaders cannot be kicked or demoted.");
      if(action==="kick" && m.role==="officer" && target.role!=="member")
        throw new Error("Officers can only remove regular members.");
      if(action==="promote" && target.role!=="member") throw new Error("That player is already an officer.");
      if(action==="demote" && target.role!=="officer") throw new Error("That player is not an officer.");
      if(action==="promote") {
        const count=Number((await db.query(
          "SELECT count(*)::integer AS n FROM idle_guild_members WHERE guild_id=$1 AND role='officer'",
          [m.guild_id]
        )).rows[0].n);
        if(count>=3) throw new Error("A guild can have at most three officers.");
      }
      if(action==="kick") await db.query(
        "DELETE FROM idle_guild_members WHERE guild_id=$1 AND user_id=$2",[m.guild_id,targetId]
      );
      else if(action==="transfer") {
        // Unique leader index: demote old leader before promoting the successor in one atomic transaction.
        await db.query("UPDATE idle_guild_members SET role='officer' WHERE guild_id=$1 AND user_id=$2",[m.guild_id,userId]);
        await db.query("UPDATE idle_guild_members SET role='leader' WHERE guild_id=$1 AND user_id=$2",[m.guild_id,targetId]);
        await db.query("UPDATE idle_guilds SET owner_id=$2 WHERE id=$1",[m.guild_id,targetId]);
      } else await db.query(
        "UPDATE idle_guild_members SET role=$3 WHERE guild_id=$1 AND user_id=$2",
        [m.guild_id,targetId,action==="promote"?"officer":"member"]
      );
      return {name:g.name,targetId,action};
    });
  }
  async function upgradeGuild(userId) {
    return transact([userId],async(db)=>{
      const m=await membership(db,userId);
      if(!m || !guilds.roleCanManage(m.role,"upgrade")) throw new Error("Only the guild leader can upgrade the Hall.");
      const g=(await db.query("SELECT * FROM idle_guilds WHERE id=$1 FOR UPDATE",[m.guild_id])).rows[0];
      const hall=Number(g.hall_tier),cost=guilds.hallCost(hall);
      if(guilds.level(Number(g.xp))<hall+2) throw new Error("Raise your guild level before upgrading the Hall.");
      if(Number(g.renown)<cost) throw new Error("Not enough shared guild renown.");
      await db.query("UPDATE idle_guilds SET hall_tier=hall_tier+1,renown=renown-$2 WHERE id=$1",
        [m.guild_id,cost]);
      return {name:g.name,tier:hall+1,cost};
    });
  }
  async function disbandGuild(userId) {
    return transact([userId],async(db)=>{
      const m=await membership(db,userId);
      if(!m || m.role!=="leader") throw new Error("Only the leader can disband a guild.");
      const g=(await db.query("SELECT name FROM idle_guilds WHERE id=$1 FOR UPDATE",[m.guild_id])).rows[0];
      await db.query("DELETE FROM idle_guilds WHERE id=$1",[m.guild_id]);
      return {name:g.name};
    });
  }
  return { getGuild,createGuild,inviteGuild,acceptGuild,declineGuild,leaveGuild,manageGuild,
    upgradeGuild,disbandGuild,grantProgress,perkTier };
}
module.exports=createGuildStore;
