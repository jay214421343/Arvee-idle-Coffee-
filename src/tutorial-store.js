"use strict";
const {transact}=require("./store");
const {STEPS}=require("./tutorial-data");
const LAST=STEPS.length-1;
// Called only on the first normal /idle command. A unique row means every
// user sees the automatic introduction once, regardless of server or shard.
async function startIfNew(userId) {
  return transact([userId],async(db)=>{
    const result=await db.query(
      "INSERT INTO player_tutorial(user_id,status,step) VALUES($1,'active',0) " +
      "ON CONFLICT(user_id) DO NOTHING RETURNING step",[userId]);
    return result.rowCount===1;
  });
}
async function restart(userId) {
  return transact([userId],async(db)=>{
    const row=await db.query(
      "INSERT INTO player_tutorial(user_id,status,step,updated_at) VALUES($1,'active',0,now()) " +
      "ON CONFLICT(user_id) DO UPDATE SET status='active',step=0,updated_at=now() " +
      "RETURNING status,step",[userId]);
    return row.rows[0];
  });
}
async function transition(userId,action,expectedStep) {
  if(!Number.isInteger(expectedStep)||expectedStep<0||expectedStep>LAST)
    throw new Error("Invalid guide step.");
  if(!["tutorial_next","tutorial_back","tutorial_skip","tutorial_finish"].includes(action))
    throw new Error("Unknown guide action.");
  return transact([userId],async(db)=>{
    const row=(await db.query(
      "SELECT status,step FROM player_tutorial WHERE user_id=$1 FOR UPDATE",[userId])).rows[0];
    if(!row||row.status!=="active")
      throw new Error("This guide is closed. Replay it with /idle account tutorial.");
    if(Number(row.step)!==expectedStep)
      throw new Error("That guide page is outdated. Use the latest page to continue.");
    let step=expectedStep,status="active";
    if(action==="tutorial_next"){
      if(step===LAST)throw new Error("You have reached the final guide step.");
      step++;
    }else if(action==="tutorial_back"){
      if(step===0)throw new Error("Already at the first guide step.");
      step--;
    }else if(action==="tutorial_skip")status="skipped";
    else if(action==="tutorial_finish"){
      if(step!==LAST)throw new Error("Complete all guide steps or choose Skip.");
      status="finished";
    }
    const result=await db.query(
      "UPDATE player_tutorial SET step=$2,status=$3,updated_at=now() WHERE user_id=$1 RETURNING step,status",
      [userId,step,status]);
    return result.rows[0];
  });
}
module.exports={startIfNew,restart,transition,LAST};
