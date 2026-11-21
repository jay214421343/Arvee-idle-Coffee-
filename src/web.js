"use strict";
const http = require("node:http");
const crypto = require("node:crypto");
const { assertNodeVersion, validateDatabaseUrl } = require("./config");
const ecosystem = require("./ecosystem");
function equal(a,b) { return typeof a === "string" && typeof b === "string" && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)); }
async function body(request) {
  let text = "";
  for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text)>24000) throw Object.assign(new Error("Request too large."),{status:413}); }
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("Invalid JSON."),{status:400}); }
}
function createServer({store, browser, key}) {
  if (!key || key.length < 32) throw new Error("IDLE_SERVICE_KEY must contain at least 32 random characters.");
  return http.createServer(async (request,response) => {
    const send = (status,data) => { response.writeHead(status,{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}); response.end(JSON.stringify(data)); };
    try {
      if (!equal(request.headers["x-idle-service-key"],key)) return send(401,{error:"Private Idle service."});
      const url = new URL(request.url,"http://idle.internal");
      if(request.method === "GET" && url.pathname === "/health") { await store.pool.query("SELECT 1"); return send(200,{service:"arvee-idle",browser:true,database:true}); }
      const match = url.pathname.match(/^\/milestones\/([0-9]{15,22})$/);
      if (request.method === "GET" && match) return send(200,await ecosystem.milestones(store.pool,match[1]));
      if (request.method === "GET" && url.pathname === "/catalog") {
        const {idle}=require("./commands"),{items,generators}=require("./catalog");
        return send(200,{commands:idle.toJSON().options,items:Object.entries(items).map(([id,item])=>({id,name:item.name})),generators:generators.map(item=>({id:item.id,name:item.name}))});
      }
      if (request.method !== "POST" || !["/play","/state"].includes(url.pathname)) return send(404,{error:"Unknown endpoint."});
      const input = await body(request);
      if (!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).some(k=>!["user","action","requestId"].includes(k)) || !/^[0-9]{15,22}$/.test(input.user?.id || "") || typeof input.user?.username !== "string" || input.user.username.length > 80)
        return send(400,{error:"Invalid player."});
      // Membership is resolved afresh and never persisted as a second subscription.
      const account = await ecosystem.account(input.user.id);
      if(url.pathname === "/state") {
        if(Object.keys(input).some(k=>k!=="user")) return send(400,{error:"Invalid state request."});
        const state=await ecosystem.withAccount(input.user.id,account,()=>require("./browser-state").snapshot(store,input.user.id));
        return send(200,{state,account});
      }
      const result = await ecosystem.withAccount(input.user.id,account,()=>browser.execute(store.pool,input.user,input.action,input.requestId));
      return send(200,{...result,account});
    } catch(error) { send(error.status || 503,{error:error.status ? error.message : "Idle is temporarily unavailable."}); }
  });
}
async function main() {
  assertNodeVersion(); validateDatabaseUrl(); ecosystem.connection();
  const store=require("./store"), browser=require("./browser");
  await store.pool.query("SELECT request_id FROM browser_actions LIMIT 0");
  const server=createServer({store,browser,key:process.env.IDLE_SERVICE_KEY});
  server.requestTimeout=15000; server.headersTimeout=10000;
  const port=Number(process.env.IDLE_WEB_PORT || 3092);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error("Invalid IDLE_WEB_PORT.");
  server.listen(port,"127.0.0.1",()=>console.log("[ARVEE Idle] Private browser service ready on loopback."));
  const cleanup=setInterval(()=>store.pool.query("DELETE FROM browser_actions WHERE created_at<now()-INTERVAL '25 hours'").catch(()=>console.error("[ARVEE Idle] Browser receipt cleanup failed.")),3600000);
  cleanup.unref();
  for(const signal of ["SIGTERM","SIGINT"]) process.once(signal,()=>{clearInterval(cleanup);server.close(()=>store.pool.end());});
}
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={createServer,equal};
