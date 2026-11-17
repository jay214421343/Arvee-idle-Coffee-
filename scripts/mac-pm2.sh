#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="/Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin"
export PATH="$NODE_BIN:$PATH"
export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"
cd "$ROOT"
if ! command -v node >/dev/null 2>&1; then echo "Node 22 runtime not found" >&2; exit 1; fi
run_pm2() { npm exec --yes --package=pm2@6.0.14 -- pm2 "$@"; }
case "${1:-}" in
  start) run_pm2 start ecosystem.config.cjs --only arvee-idle; run_pm2 describe arvee-idle ;;
  restart) run_pm2 restart arvee-idle --update-env ;;
  logs) run_pm2 logs arvee-idle --lines 40 ;;
  status) run_pm2 list ;;
  stop) run_pm2 stop arvee-idle ;;
  *) echo "Usage: bash scripts/mac-pm2.sh {start|restart|logs|status|stop}"; exit 2 ;;
esac
