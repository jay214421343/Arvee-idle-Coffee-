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

## ARVEE Idle 2.6 — Global Player Guilds

Global guilds are **persistent player groups**, not Discord server configuration. A Discord User ID may belong to one guild at a time, even if the player switches Discord servers. Every guild uses the same PostgreSQL database as the global ARVEE Idle economy.

### Getting started

- **/idle guild view** — Open the compact Coffee-style guild board, roster and pending invitations (the Guilds navigation dropdown is also available from the Command Center).
- **/idle guild create name:<name> tag:<tag>** — Create a guild with a 3–26 character name and unique 2–5 character tag. Names and tags are unique; one guild membership per player.
- **/idle guild invite user:<player>** — Leader or officer issues a three-day invitation; the invited player sees it under `/idle guild view` and can accept from the single dropdown or `/idle guild accept id:<guild ID>`.
- **/idle guild decline id:<guild ID>**, **/idle guild leave confirm:true** — Decline or leave. A leader must transfer ownership or explicitly disband before leaving.
- **/idle guild promote/demote/kick user:<player>** — Leader can promote and demote officers (maximum three); officers may invite and remove regular members. Nobody can kick the leader.
- **/idle guild transfer user:<player> confirm:true** — Leader-only permanent ownership transfer. **/idle guild disband confirm:true** permanently deletes the guild and its historical rankings/records; personal balances and items are untouched.
- **/idle guild upgrade** — Leader spends *shared guild Renown*, not anyone's IC, on a Hall upgrade. Hall tier increases the guild member capacity from 12 up to 32, grants +1% mining IC per tier and +2% World Boss strike damage per tier (maximum +5%/+10%).
- **/idle guild rankings** — Global weekly Guild Boss Rankings. Damage is snapshotted for the guild a player belonged to when the strike committed, so changing guild cannot reassign earlier damage.

### Fair progression and safety

Mining, daily rewards, crafting, expedition claims and World Boss attacks earn Guild XP and Renown together, with a **250 guild XP/renown per-user UTC day cap** to prevent rapid event farming. Guild level follows a bounded quadratic progression (max level 20); Hall upgrades require both Renown and a minimum guild level. No member can withdraw guild funds because there is no IC deposit or withdrawal mechanic.

All guild writes use the existing player-lock transaction engine and guild-row locks. Invitations expire after 72 hours, joining enforces capacity under a lock, roles/ownership are validated server-side, and creation and claiming are constrained by unique database indexes. Global boss damage accounting and guild XP updates occur **in the same transaction as each committed gameplay event**. Historic guild damage survives a member changing guild and is deleted only if the guild itself is permanently disbanded.

The UI keeps ARVEE's restrained purple accent, compact text, minimal emojis, and one Guild board with a contextual Hall upgrade, Boss rankings and Command Center buttons. Guild creation and sensitive management happen via explicit slash commands instead of dangerous one-click buttons.

### Rollout

After CI and review, merge this PR and update only ARVEE Idle (`/Users/gabberjay/Documents/arvee-idle`): `git switch master && git pull --ff-only origin master && npm ci && npm run setup && npm run mac:restart`. The SQL migration is additive. Test invites, role changes, Hall buffs and weekly rankings across two servers with two Discord accounts before considering production verified. The main ARVEE bot and website remain unchanged.
## ARVEE Idle 2.5 — World Bosses

**/idle boss** opens one **global, cooperative weekly encounter** shared by every Discord server using the same ARVEE Idle application and PostgreSQL database. No server-specific save files or duplicate boss HP bars.

- **Weekly rotation:** UTC Monday 00:00. Hollow Guardian (2,500 HP; 5,000 IC reward pool), Ashbound Titan (5,000 HP; 10,000 IC pool), and Starved Colossus (8,500 HP; 16,000 IC pool) rotate automatically. The encounter is created lazily when someone opens or attacks the board; no scheduler or uptime requirement.
- **Combat:** One attack every 10 minutes, with server-authoritative power increasing through mining XP, pickaxe tier and prestige. The exact final hit is capped by remaining boss HP, so damage cannot exceed the shared health pool. Only actual stored damage counts.
- **Companion roles:** Ember Fox boosts strike damage; Moss Wisp reduces the cooldown of its strikes; Moon Owl increases rare-cache odds in proportion to the damage dealt *while equipped*. Pet bonuses are snapshotted on each attack and cannot be changed by swapping at claim time.
- **Fair rewards:** To qualify, hit at least twice and deal at least the greater of 80 damage or 1.5% of the boss HP. When a boss is defeated **or** the UTC week ends, rewards can be claimed. IC is a strict fixed pool allocated by actual HP damage: `floor(pool × your_damage / max_hp)`. Unfinished encounters pay a proportionally smaller total, not unlimited consolation coins. Qualified players also receive bounded materials and a small chance at a Rare Supply Cache, improved by Moon Owl.
- **Persistent claims:** Rewards remain claimable across later weeks and are granted exactly once in a PostgreSQL transaction. Shared boss HP, per-account cooldowns, per-user contribution and claims are persisted. Per-boss reward pool and item type are snapshotted at spawn, protecting old rewards from later balance changes.
- **Progression:** Boss attacks grant Season Journey and active-pet XP. One new rotating weekly contract rewards sustained participation. Boss Challenger and Worldbreaker achievements appear automatically in Milestones.
- **Interface:** Coffee-inspired, mostly emoji-free Components V2. HP, participants, personal contribution, top three contributors and countdown; contextual **Attack**, **Claim rewards** and **Command Center**, never more than three buttons. Reopening the board refreshes current global state.

### Rollout

After CI/review and merge, pull the ARVEE Idle `master` branch in `/Users/gabberjay/Documents/arvee-idle`, then run `npm ci`, `npm run setup`, `npm run mac:restart`, `npm run mac:status`. `npm run setup` performs only additive migrations and slash-command registration. No main ARVEE services are restarted. Test with two Discord accounts in different guilds, verify shared HP and cooldowns, and test a finished-boss claim in a staging/test database before production release.

## ARVEE Idle 2.4.2 — Quality & readiness

- **Activity readiness:** The Command Center shows whether Mine and Daily Reward are ready. When they are cooling down, Discord relative timestamps display the next available time. Quick Hands and the 22-hour daily cooldown use a shared calculation with the game service, so UI and backend cannot drift.
- **Safe player inspection:** `/idle profile user:<player>` shows that player's progress in an explicitly read-only view, with a single return button; it no longer offers action buttons that would act on the viewer's own account.
- **Cross-server satchel preview:** `/idle inventory user:<player>` shows a read-only view of the other player's public inventory, without filters, item-use controls or misleading owner-specific item actions. Their collection can still be viewed from any server connected to the same bot/database.
- **Accurate balance labels:** The Command Center labels `total_earned` as IC earned **this run**, since prestige resets that number. The underlying economy is unchanged.
- **Safety:** No migrations, reward changes or new buttons. Node unit and Discord command-routing tests cover cooldowns, activity controls, and read-only player views. Existing Discord action IDs remain compatible.

## Coffee-inspired activity UI (2.4.1)

Mining, cooldowns, daily supplies, crafting and supply-cache results use the compact **Coffee-style narrative receipt**: a short in-world character line, a clear reward ledger, one useful gameplay action and a return to the Command Center. Results stay in Discord Components V2 with the single ARVEE purple accent and minimal emoji.

- Mining shows actual IC earned, material drop quantity/name, optional bonus cache, current mining XP and pickaxe tier; cooldown messages show the real remaining time and Discord's self-updating relative timestamp.
- Daily supplies show the exact granted rewards and wallet balance; unavailable deliveries show the 22-hour cooldown rather than pretending to claim again.
- Crafting and supply caches share a clear, consistent two-button layout; ordinary action confirmations default to only a Command Center button instead of a four-button toolbar.
- No changes to game math, item rates, rewards, database schema or player progress. Both slash-command and component-button paths render the same activity cards.

## ARVEE Idle 2.4 — Companions

Collect, level and equip a permanent adventure companion via **/idle companions** or the Command Center's navigation dropdown. All three companions can be earned through normal gameplay; none require payments, feeding or repetitive maintenance.

- **Ember Fox:** increases IC earned from mining.
- **Moss Wisp:** reduces duration of newly started timed expeditions.
- **Moon Owl:** increases material quantity on successful expeditions.
- **Free starter:** Choose one of three companions exactly once. Switch between collected pets at any time.
- **Companion Eggs:** Successful timed expeditions may find an egg (12% Forest, 18% Mines, 25% Ruins), rolled and saved at mission start. Hatch to discover new companions; duplicates grant 150 companion XP.
- **Challenges:** A new rotating weekly Companion Discovery contract awards an egg after completing its expedition objective. Existing Season Journey reward tiers/claims are not changed.
- **Leveling and evolution:** Your active companion earns XP from mining, dailies, crafting, cache opening and collecting expeditions. Level 10 unlocks Awakened, and level 20 Evolved. Bonuses grow from 5% at level 1 to 19.5% at level 30.
- **One active pet:** Companion bonuses are computed server-side and expedition modifiers are snapshotted at mission start; switching pets does not reroll a mission.
- **Compact Discord UI:** One text dropdown for adopting/equipping, Hatch Egg when you have eggs, plus navigation; no emoji-heavy menus.
- **Data safety:** PostgreSQL migrations are additive. Pets, levels, and active selection survive prestige, restarts and Discord reconnects. Player-row transactions prevent double-starter choices and duplicate egg spending.

**Rollout:** After review and merge, pull master in the independent ARVEE Idle directory, run npm ci, npm run setup, then npm run mac:restart. Test starter selection, an egg hatch and a completed expedition in Discord before considering the release production verified.
## ARVEE Idle 2.3 — Expeditions 2.0

**World Map:** `/idle explore` shows three regions with distinct requirements, timers, outcomes, and loot tables.

**Visual language:** restrained ARVEE purple and plain-text navigation; minimal decorative emoji. Item icons appear when inspecting a specific item instead of repeating through lists and dropdowns. Its Inspect buttons show requirements and rewards before launching.

- **Whispering Forest:** requires 1 recruited adventurer; roughly 2-minute expedition; starter forging materials and Idle Credits.
- **Forgotten Mines:** requires 3 adventurers and 70 exploration XP; roughly 8-minute expedition; Moonsteel, Sunforged Gold and rare caches.
- **Ancient Ruins:** requires 8 adventurers and 210 exploration XP; roughly 25-minute expedition; Void Essence, gold and a chance at Astral Gems.
- **One mission at a time:** a mission persists in PostgreSQL while you are offline. Start using the region's Inspect screen, then claim its stored outcome from the World Map after the timer expires.
- **Progression and failure:** successful expeditions provide more IC, XP and loot, while setbacks still grant partial rewards. Exploration XP and permanently upgraded gear survive prestige; you still need to rebuild the required crew afterward.
- **Equipment:** `/idle equipment` upgrades the Trailblazer's Kit (shorter missions), Astral Compass (better loot quantity), and Guardian Ward (higher success chance) using IC and ordinary crafting materials. No paid-only gear.
- **Connected progression:** collecting missions awards Season Journey XP and can satisfy rotating daily/weekly contracts. Simply starting a mission does not award season XP.
- **Safety:** expedition rewards and outcomes are rolled only when starting a mission, stored before the timer begins and granted atomically on claim; repeated clicks or concurrent PM2 instances cannot claim twice.
- **Readable huge numbers:** IC, operation costs, rates, and exchange prices use K/M/B/T/Qa/.../No, then an unlimited alphabetic suffix (`aa`, `ab`, ..., `cl` for 10²²², `aaa` and beyond). Examples: `3.29e+222` displays as `3.29cl`. Internal values remain precise PostgreSQL/Decimal numbers.

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
