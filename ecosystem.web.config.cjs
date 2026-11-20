"use strict";
const path=require("node:path");
// Opt in separately after migration. The Discord process remains independent.
module.exports={apps:[{
  name:"arvee-idle-web",script:path.join(__dirname,"src","web.js"),cwd:__dirname,
  interpreter:process.env.ARVEE_NODE || "node",exec_mode:"fork",instances:1,
  watch:false,autorestart:true,min_uptime:"15s",max_restarts:10,restart_delay:5000,
  max_memory_restart:"350M",kill_timeout:15000,time:true,env:{NODE_ENV:"production"}
}]};
