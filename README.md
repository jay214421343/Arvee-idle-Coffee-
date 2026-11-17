# ✦ ARVEE Idle

**ARVEE Idle** is an independent Discord idle-RPG set in the ARVEE universe. It uses **Discord.js 14, PostgreSQL, and native Components V2** with a compact command center, operations, mining, forging, inventory, player exchange, milestones and prestige.

Website: https://arvee.world/

Originally forked from the MIT-licensed Coffee idle game by Daniel Tran. The old generator aliases and economy progression are retained for compatibility, but the 56 operations, consumables and interface now use ARVEE-themed names. The source repository is still named Coffee until its owner chooses to rename it on GitHub.

## Fast start on macOS

With your dedicated PostgreSQL database and .env configured, run from the ARVEE Idle directory:

    export PATH="/Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin:$PATH"
    npm ci
    npm run setup
    npm run mac:start
    npm run mac:logs

The mac:* scripts use the PM2 6.0.14 CLI and the existing ~/.pm2 daemon. They only start, stop or restart arvee-idle; other ARVEE processes are left alone.

## ARVEE Idle 2.3 — Expeditions 2.0

**World Map:** `/idle explore` shows three regions with distinct requirements, timers, outcomes, and loot tables. Its Inspect buttons show requirements and rewards before launching.

- **Whispering Forest:** requires 1 recruited adventurer; roughly 2-minute expedition; starter forging materials and Idle Credits.
- **Forgotten Mines:** requires 3 adventurers and 70 exploration XP; roughly 8-minute expedition; Moonsteel, Sunforged Gold and rare caches.
- **Ancient Ruins:** requires 8 adventurers and 210 exploration XP; roughly 25-minute expedition; Void Essence, gold and a chance at Astral Gems.
- **One mission at a time:** a mission persists in PostgreSQL while you are offline. Start using the region's Inspect screen, then claim its stored outcome from the World Map after the timer expires.
- **Progression and failure:** successful expeditions provide more IC, XP and loot, while setbacks still grant partial rewards. Exploration XP and permanently upgraded gear survive prestige; you still need to rebuild the required crew afterward.
- **Equipment:** `/idle equipment` upgrades the Trailblazer's Kit (shorter missions), Astral Compass (better loot quantity), and Guardian Ward (higher success chance) using IC and ordinary crafting materials. No paid-only gear.
- **Connected progression:** collecting missions awards Season Journey XP and can satisfy rotating daily/weekly contracts. Simply starting a mission does not award season XP.
- **Safety:** expedition rewards and outcomes are rolled only when starting a mission, stored before the timer begins and granted atomically on claim; repeated clicks or concurrent PM2 instances cannot claim twice.

### Deployment

After approval, update the ARVEE Idle `master` clone, run `npm ci`, `npm run setup` (additive PostgreSQL migration plus registration), and `npm run mac:restart` to restart only ARVEE Idle. No existing balances, inventory, season rewards or settings are reset.

## ARVEE Idle 2.2 — persistent preferences and Adventurer Contracts

- **Saved filters:** Expeditions category/sort, Satchel category/sort, and Forge craftability filter now persist per Discord account in PostgreSQL across PM2 restarts and devices. Opening an existing screen automatically restores your last choices. Use /idle settings to view or reset them.
- **Daily contracts:** three tasks per UTC day. Mining and recruitment are available daily; the third rotates among supplies, caches, crafting and deeper mining.
- **Weekly contracts:** three tasks per week, resetting Monday 00:00 UTC. Larger objectives award more IC or rarer supplies.
- **Progress is real:** contract progress is calculated from authoritative economy events, with buy/open/craft quantities counted correctly. Trades, gifts and reward claims cannot inflate progress.
- **Claim controls:** /idle challenges or the Command Center navigation lets you view daily and weekly progress and claim rewards. Claims are one-time per period and atomic under concurrency.
- **Separate from the season:** both Adventurer Contracts and the Founders' Journey can progress during regular gameplay, but claiming a contract doesn't mint extra season XP. No Discord SKU or paid purchase is involved.
- **Compatibility:** migrations are additive, existing players and their inventories are not reset. Run npm run setup before starting the new code.

## Season Journey — Founders' Journey

Season 01 runs **17 November 2026–15 January 2027 (UTC)**. Players may claim earned rewards until **23 January 2027 00:00 UTC**.

- `/idle season` opens a free 20-tier journey with **Claim All**, personal XP, daily contracts, and reward previews.
- Earn XP through mining, daily claims, recruiting expeditions, crafting, opening caches, pickaxe/perk upgrades, and prestige. The cap is **500 XP per UTC day**; a tier unlocks every **250 XP**.
- Claims are written atomically in PostgreSQL; reconnects or repeated clicks cannot duplicate rewards.
- Your season journey is separate from prestige, and installing this migration does not wipe existing characters or items.
- **No paid pass or Prime purchase is activated.** Paid rewards would require an explicit Discord SKU/entitlement integration with the *ARVEE Idle* Discord application.

## Easier gameplay

- New players get **500 IC** at account creation (no reset of existing accounts).
- Your first operation costs **100 IC**.
- Mining begins at **150 IC**, with a **90-second** cooldown and scaling rewards.
- Daily rewards grant **750 IC**, three Supply Caches, Campfire Brew, Rune Ore and Moonsteel.
- Early pickaxe upgrades start at **8 Rune Ore and 2 Moonsteel**.
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

Expeditions use interactive Components V2 Section cards and contextual Filters; Satchel uses compact rarity-coded rows with a right-aligned Filters button, sort control and Inspect dropdown; Command Center uses an emoji navigation menu with direct action buttons. The Forge shows owned/required material counts. Most screens also offer actions without repeated slash commands. You can navigate operations, purchase upgrades, open supply caches, craft, trade and review progress from the Components V2 interface.

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
