"use strict";
const store=require("./store");
const { items, byId, perks }=require("./catalog");
const companions=require("./companions");
const season=require("./season");
const { dec, Decimal }=require("./economy");
const { requireAdmin, OWNER_ID }=require("./admin-auth");
const ID=/^[0-9]{15,22}$/;
function validTarget(id) {
  if(!ID.test(String(id))) throw new Error("Choose a valid Discord player.");
  return String(id);
}
function whole(value,min,max,label="Value") {
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new Error(label+" must be between "+min+" and "+max+".");
  return value;
}
function credits(value) {
  if(!/^[0-9]{1,27}$/.test(String(value))) throw new Error("Credits must be a whole number of up to 27 digits.");
  const n=dec(String(value));
  if(n.gt("1e24"))throw new Error("Credits are capped to 1e24 per admin action.");
  return n;
}
function adjust(current,amount,mode,maximum) {
  let result;
  if(mode==="set") result=amount;
  else if(mode==="add") result=current+amount;
  else if(mode==="take") result=current-amount;
  else throw new Error("Invalid adjustment.");
  if(result<0||result>maximum)throw new Error("Adjustment exceeds allowed bounds or available amount.");
  return result;
}
async function action({ actorId,guildId,interactionId,type,targetId,mode,value,itemId,operationId,petId,field,reason }) {
  requireAdmin(actorId,guildId);
  const target=validTarget(targetId);
  if(!ID.test(String(interactionId)))throw new Error("Invalid interaction identifier.");
  if(type==="suspend" && target===OWNER_ID && mode==="suspend")
    throw new Error("You cannot suspend the ARVEE Idle owner.");
  return store.transact([target],async(db,states)=>{
    const state=states.get(target);
    const audit=await db.query(
      "INSERT INTO admin_audit(interaction_id,actor_id,guild_id,target_id,action,details) " +
        "VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(interaction_id) DO NOTHING RETURNING id",
      [interactionId,actorId,guildId,target,type,JSON.stringify({mode,field,itemId,operationId,petId})]);
    if(!audit.rowCount)throw new Error("This admin interaction was already applied.");
    let before,after,detail;
    if(type==="balance"){
      const qty=credits(value);
      const original=state.balance;
      if(mode==="set") state.balance=qty;
      else if(mode==="add")state.balance=state.balance.plus(qty);
      else if(mode==="take")state.balance=state.balance.minus(qty);
      else throw new Error("Invalid credit adjustment.");
      if(state.balance.lt(0)||state.balance.gt("1e100"))throw new Error("Credit balance out of allowed bounds.");
      state.totalEarned=Decimal.max(state.totalEarned,state.balance);
      before=original.toFixed(0);after=state.balance.toFixed(0);
      detail="IC balance";
    }else if(type==="item"){
      if(!Object.hasOwn(items,itemId))throw new Error("Unknown item.");
      const qty=whole(value,0,1000000,"Item quantity");
      if(mode!=="set"&&qty===0)throw new Error("Specify an amount greater than zero.");
      const current=(await db.query("SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE",
        [target,itemId])).rows[0]?.quantity || 0;
      const next=adjust(Number(current),qty,mode,10000000);
      if(next===0)await db.query("DELETE FROM inventory WHERE user_id=$1 AND item_id=$2",[target,itemId]);
      else await db.query("INSERT INTO inventory(user_id,item_id,quantity) VALUES($1,$2,$3) " +
        "ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=$3",[target,itemId,next]);
      before=Number(current);after=next;detail=items[itemId].name;
    }else if(type==="operation"){
      if(!byId.has(operationId))throw new Error("Unknown operation.");
      const qty=whole(value,0,10000,"Operation quantity");
      if(mode!=="set"&&qty===0)throw new Error("Specify an amount greater than zero.");
      const current=(await db.query("SELECT quantity FROM player_generators WHERE user_id=$1 AND generator_id=$2 FOR UPDATE",
        [target,operationId])).rows[0]?.quantity || 0;
      const next=adjust(Number(current),qty,mode,10000);
      if(next===0)await db.query("DELETE FROM player_generators WHERE user_id=$1 AND generator_id=$2",[target,operationId]);
      else await db.query("INSERT INTO player_generators(user_id,generator_id,quantity) VALUES($1,$2,$3) " +
        "ON CONFLICT(user_id,generator_id) DO UPDATE SET quantity=$3",[target,operationId,next]);
      before=Number(current);after=next;detail=byId.get(operationId).name;
    }else if(type==="progress"){
      const bounds={prestige:10000,mine_xp:100000000,pickaxe_tier:10,orbs:20};
      if(!Object.hasOwn(bounds,field))throw new Error("Unknown progress field.");
      const next=whole(value,0,bounds[field],"Progress");
      const key={prestige:"prestige",mine_xp:"mineXp",pickaxe_tier:"pickaxeTier",orbs:"orbs"}[field];
      before=state[key];state[key]=next;after=next;detail=field;
    }else if(type==="seasonxp"){
      const qty=whole(value,0,1000000000,"Season XP");
      const current=(await db.query("SELECT xp FROM season_progress WHERE user_id=$1 AND season_id=$2 FOR UPDATE",
        [target,season.SEASON.id])).rows[0]?.xp || 0;
      const next=mode==="set"?qty:mode==="add"?Number(current)+qty:NaN;
      if(!Number.isSafeInteger(next)||next<0||next>1000000000)throw new Error("Invalid Season XP adjustment.");
      const claimed=(await db.query("SELECT max(tier)::integer AS tier FROM season_claims WHERE user_id=$1 AND season_id=$2",
        [target,season.SEASON.id])).rows[0]?.tier || 0;
      if(next<season.tierNeeded(claimed || 1)-(claimed?0:250))throw new Error("Season XP cannot fall below an already claimed tier.");
      await db.query("INSERT INTO season_progress(user_id,season_id,xp) VALUES($1,$2,$3) " +
        "ON CONFLICT(user_id,season_id) DO UPDATE SET xp=$3",[target,season.SEASON.id,next]);
      before=Number(current);after=next;detail="Founders' Journey Season XP";
    }else if(type==="perk"){
      if(!Object.hasOwn(perks,field))throw new Error("Unknown perk.");
      const next=whole(value,0,perks[field].max,"Perk level");
      const current=(await db.query("SELECT level FROM player_perks WHERE user_id=$1 AND perk_id=$2 FOR UPDATE",
        [target,field])).rows[0]?.level || 0;
      if(next===0)await db.query("DELETE FROM player_perks WHERE user_id=$1 AND perk_id=$2",[target,field]);
      else await db.query("INSERT INTO player_perks(user_id,perk_id,level) VALUES($1,$2,$3) " +
        "ON CONFLICT(user_id,perk_id) DO UPDATE SET level=$3",[target,field,next]);
      before=Number(current);after=next;detail=perks[field].name;
    }else if(type==="companion"){
      if(!companions.byId.has(petId))throw new Error("Unknown companion.");
      const current=(await db.query("SELECT xp FROM player_companions WHERE user_id=$1 AND pet_id=$2 FOR UPDATE",
        [target,petId])).rows[0];
      if(mode==="unlock"){
        await db.query("INSERT INTO player_companions(user_id,pet_id,xp) VALUES($1,$2,0) " +
          "ON CONFLICT(user_id,pet_id) DO NOTHING",[target,petId]);
        before=Boolean(current);after=true;detail="Unlocked "+companions.byId.get(petId).name;
      }else if(mode==="remove"){
        if(!current)throw new Error("Player does not own that companion.");
        await db.query("UPDATE companion_settings SET active_pet_id=NULL WHERE user_id=$1 AND active_pet_id=$2",
          [target,petId]);
        await db.query("DELETE FROM player_companions WHERE user_id=$1 AND pet_id=$2",[target,petId]);
        before=true;after=false;detail="Removed "+companions.byId.get(petId).name;
      }else{
        if(!current)throw new Error("Unlock this companion before adjusting XP or equipping.");
        if(mode==="equip"){
          await db.query("INSERT INTO companion_settings(user_id,starter_claimed,active_pet_id) " +
            "VALUES($1,TRUE,$2) ON CONFLICT(user_id) DO UPDATE SET active_pet_id=$2",[target,petId]);
          before=null;after=petId;detail="Equipped companion";
        }else if(mode==="xp_set"||mode==="xp_add"){
          const qty=whole(value,0,companions.MAX_XP,"Companion XP");
          const next=mode==="xp_set"?qty:Number(current.xp)+qty;
          if(next>companions.MAX_XP)throw new Error("Companion XP would exceed its maximum.");
          await db.query("UPDATE player_companions SET xp=$3 WHERE user_id=$1 AND pet_id=$2",
            [target,petId,next]);
          before=Number(current.xp);after=next;detail=companions.byId.get(petId).name+" XP";
        }else throw new Error("Unknown companion action.");
      }
    }else if(type==="cooldown"){
      if(!["mine","daily","both"].includes(field))throw new Error("Invalid cooldown choice.");
      before={mine:state.lastMine?String(state.lastMine):null,daily:state.lastDaily?String(state.lastDaily):null};
      if(field==="mine"||field==="both")state.lastMine=null;
      if(field==="daily"||field==="both")state.lastDaily=null;
      after={mine:state.lastMine,daily:state.lastDaily};detail="Reset "+field+" cooldown";
    }else if(type==="suspend"){
      if(mode==="suspend"){
        const why=String(reason||"").trim();
        if(why.length<4||why.length>240)throw new Error("Suspension reason must be 4–240 characters.");
        const existing=(await db.query("SELECT reason FROM admin_suspensions WHERE user_id=$1",[target])).rows[0];
        await db.query("INSERT INTO admin_suspensions(user_id,reason,actor_id) VALUES($1,$2,$3) " +
          "ON CONFLICT(user_id) DO UPDATE SET reason=$2,actor_id=$3,created_at=now()",
          [target,why,actorId]);
        before=existing?.reason||null;after=why;detail="Account suspended";
      }else if(mode==="unsuspend"){
        const deleted=await db.query("DELETE FROM admin_suspensions WHERE user_id=$1 RETURNING reason",[target]);
        before=deleted.rows[0]?.reason||null;after=null;detail="Suspension lifted";
      }else throw new Error("Invalid suspension action.");
    }else throw new Error("Unknown admin action.");
    await db.query("UPDATE admin_audit SET details=$2::jsonb WHERE id=$1",[
      audit.rows[0].id,JSON.stringify({mode,field,itemId,operationId,petId,reason:type==="suspend"?String(reason||"").slice(0,240):undefined,before,after})]);
    return detail+": "+JSON.stringify(before)+" → "+JSON.stringify(after);
  },{allowSuspended:true});
}
async function inspect(actorId,guildId,targetId) {
  requireAdmin(actorId,guildId);
  const target=validTarget(targetId);
  return store.transact([target],async(db,states)=>{
    const state=states.get(target);
    const inventory=(await db.query("SELECT item_id,quantity FROM inventory WHERE user_id=$1 ORDER BY item_id",[target])).rows;
    const operations=(await db.query("SELECT generator_id,quantity FROM player_generators WHERE user_id=$1 ORDER BY generator_id",[target])).rows;
    const pets=(await db.query("SELECT pet_id,xp FROM player_companions WHERE user_id=$1",[target])).rows;
    const xp=(await db.query("SELECT xp FROM season_progress WHERE user_id=$1 AND season_id=$2",
      [target,season.SEASON.id])).rows[0]?.xp||0;
    const ban=(await db.query("SELECT reason FROM admin_suspensions WHERE user_id=$1",[target])).rows[0]?.reason||null;
    return {id:target,balance:state.balance.toFixed(0),totalEarned:state.totalEarned.toFixed(0),
      prestige:state.prestige,pickaxeTier:state.pickaxeTier,mineXp:state.mineXp,orbs:state.orbs,
      seasonXp:Number(xp),suspension:ban,items:inventory,operations,pets};
  },{allowSuspended:true});
}
async function audit(actorId,guildId,targetId=null,limit=10) {
  requireAdmin(actorId,guildId);
  whole(limit,1,20,"Audit limit");
  if(targetId)validTarget(targetId);
  const rows=await store.pool.query(
    "SELECT id,actor_id,target_id,action,details,created_at FROM admin_audit " +
      "WHERE ($1::text IS NULL OR target_id=$1) ORDER BY id DESC LIMIT $2",
    [targetId,limit]);
  return rows.rows;
}
async function status(actorId,guildId) {
  requireAdmin(actorId,guildId);
  const r=await store.pool.query("SELECT " +
    "(SELECT count(*)::integer FROM players) AS players," +
    "(SELECT count(*)::integer FROM admin_suspensions) AS suspensions," +
    "(SELECT count(*)::integer FROM admin_audit) AS changes," +
    "(SELECT count(*)::integer FROM season_claims) AS claims");
  return r.rows[0];
}
module.exports={action,inspect,audit,status,credits,whole,validTarget};
