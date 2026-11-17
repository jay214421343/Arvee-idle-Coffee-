# ✦ ARVEE Idle

**ARVEE Idle** is an independent Discord idle-RPG set in the ARVEE universe. It uses **Discord.js 14, PostgreSQL, and native Components V2** with a compact command center, operations, mining, forging, inventory, player exchange, milestones and prestige.

Website: https://arvee.world/

Originally forked from the MIT-licensed Coffee idle game by Daniel Tran. The old generator aliases and economy progression are retained for compatibility, but the 56 operations, consumables and interface now use ARVEE-themed names. The source repository is still named Coffee until its owner chooses to rename it on GitHub.

## What it includes

- **/idle** slash commands with a modern interactive command center, owner-bound buttons and dropdowns, dashboard avatar and clear progression.
- 56 re-themed RPG operations, passive **Idle Credits (IC)**, mining, pickaxe tiers, lootboxes/supply caches, collectibles, forging, trading, achievements and prestige.
- An ARVEE World link in the command center. **No automatic ARVEE main-bot data, wallet, user-account or SKU synchronization** — this service is isolated by default.
- PostgreSQL transactions, controlled migrations, a dedicated database-name guard, a diagnostics command, command-only registration and a single PM2 process.
- The economy still stores numeric balances in NUMERIC/Decimal.js; only the currency's public display is renamed.

## Run on macOS with ARVEE's Node runtime

Keep this project separate from /Users/gabberjay/Documents/arvee. Suggested clone path: /Users/gabberjay/Documents/arvee-idle.

    cd /Users/gabberjay/Documents
    git clone https://github.com/jay214421343/Coffee.git arvee-idle
    cd arvee-idle
    export PATH="/Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin:$PATH"
    rehash
    npm ci

Copy .env.example to .env and fill in a **separate Discord application** and dedicated PostgreSQL database (recommended name arvee_idle, port 5432 if running a separate local server). NEVER point ARVEE Idle at the main bot's arvee_hub or arvee_game database.

    cp -n .env.example .env
    nano .env
    npm run db:migrate
    npm run doctor
    npm run register
    npm start

See [Mac + PM2 deployment](docs/MAC_DEPLOY.md) for dedicated PostgreSQL setup, isolated PM2 startup, logging, updates, and safe handling of the old /coffee slash command.

## PM2

The committed ecosystem.config.cjs uses the ARVEE Node 22.23.5 binary as a read-only interpreter, but its own project directory as cwd, and launches one independent service named arvee-idle.

    pm2 start ecosystem.config.cjs --only arvee-idle
    pm2 logs arvee-idle --lines 60
    pm2 describe arvee-idle

Do not run pm2 restart all / pm2 delete all. To update only this app after a reviewed merge:

    git pull --ff-only origin master
    npm ci
    npm run db:migrate
    npm run doctor
    npm run register
    pm2 restart arvee-idle --update-env

## Commands

All gameplay lives under /idle:

| Group | Commands |
| --- | --- |
| Overview | help, profile, stats, leaderboard |
| Economy | shop, buy, prestige |
| Adventure | mine, pickaxe, perks, daily |
| Items | inventory, craft, use, open, give |
| Exchange | market browse, market sell, market buy, market cancel |

Most screens also offer actions without repeated slash commands. You can navigate operations, purchase upgrades, open supply caches, craft, trade and review progress from the Components V2 interface.

## Operational safety

- Environment: .env is in this repo; do not share or commit its secrets. The dedicated DATABASE_URL must contain idle or coffee in the database name, not refer to ARVEE databases, and must not equal HUB_DATABASE_URL.
- No server port is opened by the bot. It connects outbound to Discord and PostgreSQL only.
- Command registration **upserts only /idle** using Discord's single-command endpoint; it never bulk-deletes all commands.
- To remove an older /coffee command from this same application/scope explicitly: npm run register -- --remove-legacy-coffee.
- PM2 uses fork mode, one instance, readiness signaling, crash restart and a memory limit; other ARVEE PM2 applications remain untouched.
- Migrations are additive and serialized. Run npm run doctor to check the database and runtime before starting the bot.
- Discord SKUs and entitlements are application-scoped. The main ARVEE application's SKUs do not automatically work in a separate ARVEE Idle application.

## Checks

    npm run check
    npm test

GitHub Actions runs these tests using PostgreSQL 17. A live Discord test is still necessary to verify the mobile appearance, Buttons and Components V2 integration.

## History

This rebrand deliberately keeps Coffee's original code history and MIT provenance. It does **not** import the old MongoDB player records or create connections to the ARVEE main ecosystem without an explicitly designed integration.
