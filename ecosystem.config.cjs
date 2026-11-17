"use strict";
// Independent PM2 process. Does not reference ARVEE's bot entrypoint, env or database.
const path = require("node:path");
module.exports = {
  apps: [{
    name: "arvee-idle",
    script: path.join(__dirname, "src", "index.js"),
    cwd: __dirname,
    interpreter: "/Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin/node",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    autorestart: true,
    min_uptime: "15s",
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: "450M",
    wait_ready: true,
    listen_timeout: 30000,
    kill_timeout: 10000,
    time: true,
    env: { NODE_ENV: "production", ARVEE_IDLE_SERVICE: "1" }
  }]
};
