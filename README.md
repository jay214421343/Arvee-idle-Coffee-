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

## ARVEE Idle 2.12 — 100-Tier Founders' Journey and Owner Administration

Founders' Journey now has **100 fully free tiers** instead of 20. Each tier requires 250 Season XP, for 25,000 XP total. The original 20 rewards, season ID and dates, all prior earned XP and claimed tiers remain unchanged. Tiers 21–100 offer stronger IC and material rewards, more Supply Caches, Rune Fragments, companions eggs, specialty charms, and occasional permanent Astral Sigils. The 25 four-tier pages have a direct tier-range jump menu for mobile. No daily XP limit has returned.

**Owner administration:** a separate `/admin` command is registered only in Discord server `1391028658835034243` and accessible only to user `801148038269763644`. Owner authorization and the server boundary are verified for every action, with ephemeral replies and permanent PostgreSQL audit records. Admin actions manage player credits, items, operations, game progression, companion ownership/XP, talents/perks, Season XP, cooldowns and account suspensions. This is application-level control, not unrestricted SQL or remote code execution. The publicly available `/idle` command remains unchanged.

**Deployment after review/merge:** `npm ci && npm run db:migrate && npm run register && npm run mac:restart`. The migration extends the historical claim tier constraint, creates owner audit/suspension tables and retains existing player and season data. Slash registration keeps `/idle` in its current scope and creates `/admin` **only** in the designated guild.

## ARVEE Idle 2.11.2 — Contextual Mining Reset

The mining cooldown receipt now offers **Use Campfire Brew** (or another owned, compatible cooldown-reset consumable) only when mining is genuinely resting **and** the player has the item. It prefers a common Campfire Brew before rarer tonics, caps the receipt at two buttons, and preserves the View Pickaxe fallback when no reset is eligible. The button labels the exact item that will be consumed. After a valid one-click reset, the receipt offers **Mine now**.

The reset action is not a cooldown bypass: it re-checks mining readiness, the selected item's effect and current boost limits **inside the locked player transaction**, then consumes exactly one owned item via the existing item-use logic. An expired cooldown, stale button, exhausted inventory, or incompatible active boost cannot consume or create items. No gameplay economy, schema, or command registration changes.

## ARVEE Idle 2.11 — Companion Builds & Mastery

**Season XP no longer has a daily cap.** Every qualifying action awards its full normal XP, even after 500 XP earned in a UTC day. The confusing “Today's XP: 500 / 500” bar is removed; season tier thresholds and once-only reward claims remain unchanged. Historic daily XP rows are retained but no longer used.

**Companion mastery and equipment:** your active companion can choose one of three freely switchable talents at level 10 (Focus, Tracker, Vanguard). At level 20 that talent becomes stronger automatically. A single non-consumable charm can be equipped globally alongside the active pet: Prospector, Pathfinder, or Warcaller. Charms are craftable from existing materials and can appear as bonus finds in Rare/Mythic Supply Caches. Equipment only works while the player still owns the charm, preventing stale trade/sell bonuses. All choices are saved per user across Discord servers.

**Egg rarities:** ordinary Companion Eggs keep their original possible species; craft three ordinary eggs and materials into an Enchanted Egg, or combine three Enchanted Eggs with rare resources into an Astral Egg. The higher-rarity eggs use explicit rarity-weighted pools, not guaranteed Mythics. The compact Hatchery and Mastery screens sit one tap away from Companions, keeping the Command Center uncluttered.

**Rebirth bonuses:** each successful prestige rolls for at most one optional reward: **5% Rebirth Cocktail**, **30% Supply Cache**, **10% Rare Supply Cache**, **5% Adventurer's Lunchbox**, or **50% no item**. **No cocktail or item is guaranteed.** Lunchboxes yield one ration and one tonic when opened from the Satchel or with `/idle open`. The bonus roll and rewards are committed in the same database transaction as the prestige reset: failed/replayed requests do not duplicate them.

**Craft slash command:** as the Forge grows beyond Discord's 25-choice limit, `/idle craft item:` now uses autocomplete. Recipes remain accessible through the Forge menus.

**Deploy after review/merge:** pull, run `npm ci && npm run db:migrate && npm run register && npm run mac:restart`. No existing Season XP is removed.

## ARVEE Idle 2.10 — Companion Variety & Better Supply Caches

Expanded the permanent companion collection to **18 species** spanning Common, Uncommon, Rare, Epic, Legendary and Mythic. The original three starters are still free to choose from; additional pets are discovered by hatching expedition eggs with weighted rarity odds and a bias toward undiscovered species. One pet remains active at a time and supports specialized builds: mining power, expedition duration, expedition loot, success chance, World Boss strength/cooldown, extra eggs or Supply Cache discovery. Old companion IDs, XP and collection records remain valid; no monetized pet mechanics.

**Supply Caches** now drop from successful mining with a **7% base chance** instead of 4%; each Scavenger level adds the existing +3 percentage points. Rune Gecko can increase the chance further by about 1.7–6.5 percentage points based on level. Caches, including daily and crafted sources, contain the same random loot tables as before. **Rune Fragments are not guaranteed** and are never granted directly as a mining milestone: regular caches offer a 1% chance, Rare 14%, Mythic 20%. The Runic Talents menu now explains those sources.

Updated a few player-facing item descriptions and the profile title preset to use ARVEE worldbuilding rather than referencing development sources. Proper third-party software attribution remains in the project documentation.

**Deployment:** after reviewing/merging, run `npm ci && npm run db:migrate && npm run register && npm run mac:restart`. Database migration expands allowed pet IDs in existing CHECK constraints (no balances, eggs or companions are deleted). No additional player progress columns are needed.

## ARVEE Idle 2.9.4 — Animated Silver Emoji Fix

Moonsteel/Silver is an animated application emoji and must be rendered with `<a:silver:1572284313511141477>` instead of the static emoji syntax; this corrects the literal `:silver:` shown on the item card. Other uploaded artwork mappings are unchanged until their animation flags are verified. No database migration, slash command re-registration or balance changes are needed.

## ARVEE Idle 2.9.3 — Coffee-style Mining, Rebirth Cocktail & Item Artwork

Mining receipts now have a compact Coffee-style prospector narrative and **base IC**, **real bonus IC**, boost source, remaining charges, found materials, XP and cosmetic pickaxe details.

**Coffee mining mechanics:** Campfire Brew, Spark Tonic and Harvest Brew reset the mining cooldown; Starshard Fruit and Forest Tonic reduce it; Herbal Ration, Traveler Bread, Hunter's Feast, Golden Starfruit and Miner's Reward now grant nonstacking charged boosts for several successful digs. Existing ARVEE base income, cooldowns and the 20× combined boost ceiling are preserved. All boosts are persistent cross-server.

**Rebirth Cocktail:** the cocktail is a rare 5% lucky reward when successfully prestiging; it is not guaranteed. Rewards use the same locked PostgreSQL transaction as prestige to prevent double awards on duplicate clicks. Using a cocktail resets mining cooldown and provides a 2× three-dig boost.

**Discord application emoji artwork:** use the uploaded `silver` artwork for Moonsteel, `lootbox` for Supply Cache and the uploaded `i_skin`, `i_skin2` and `demon_skin` art for the new I Skin, I Skin II and Demon Skin cosmetic finishes. Existing Copper, Obsidian and Astral cosmetics remain valid. `unknown` is the **fallback artwork for any item or cosmetic without a dedicated uploaded asset yet**. All IDs are in `src/item-art.js`, separate from economy data, so replacing the fallback later won't change player records. The application must have access to the specified emoji IDs.

After review and merge, run `npm ci && npm run db:migrate && npm run register && npm run mac:restart` from the ARVEE Idle directory. Migration adds four mining boost fields and extends the cosmetic enum without deleting or resetting player data. Re-registering keeps slash commands in sync.

## ARVEE Idle 2.9.2 — Operation Lore & Coffee Item Restoration

All 56 operations now have their own compact lore tied to their specific crews, kingdoms and cosmic domains, with a handful of in-world jokes. Every operation ID, name, price, income, icon, ordering and progression mechanic is unchanged.

**Creditus Deletus** is a harmless, consumable Easter egg inspired by an original Coffee item. Find it with a 0.5% draw in a Mythic Supply Cache (without reducing any other premium reward drop rates), or craft it from 10 Void Essence, 15 Moonsteel and 1 Traveler's Ration. It shows a dramatic fake-deletion message when used, but **does not subtract or reset IC, player data, generators or prestige**. The one scroll is consumed transactionally, and the item can be traded like regular items.

The restoration also adds 12 Coffee-inspired items: Arthur's Tablet, Crafting Supply Bundle, Crew Reboot Voucher, Gnome's Rocket Brew, Kingstone's Stone, Mine Alert, Pickaxe Nametag, Merchant Pay Slip, Pickaxe Skin Token, Miner's Reward, Stat Card and Profile Tag. Each is obtainable through a Forge recipe and some also appear as additional bonus cache finds; old standard cache rewards keep their existing probabilities. The original Coffee pickaxe is already represented by /idle pickaxe, so it is not duplicated as a collectible. Incomplete and unsafe legacy actions have functional, bounded ARVEE equivalents: Crew Reboot recruits one Rookie rather than resetting existing operations, Mine Alert is a reusable cooldown readout without promises of notifications, and Stat Card is a reusable achievements viewer.
  
Custom pickaxe names and profile tags can be selected from a compact menu or set through /idle use item:<item> name:<name>. A pickaxe skin cycles between Copper, Obsidian and Astral. These cosmetics survive prestige and are stored cross-server using three **additive PostgreSQL columns**. No existing inventory, balance, prestige, operation or guild data is removed.

**After merging, run the database migration before restarting ARVEE Idle and register the updated /idle use command**: `npm ci && npm run db:migrate && npm run register && npm run mac:restart`. Do not deploy this change until it passes the full suite.

## ARVEE Idle 2.9.1 — Command Center Polish

The Command Center now puts its six-option navigation dropdown directly beneath the player summary, above prestige progress, activity readiness and quick actions. All navigation options, slash commands and cross-server data behavior remain unchanged.

At **100% prestige progress**, the owner sees a contextual **Prestige** button beside the progress text. It opens the existing two-step prestige confirmation screen; it never resets a wallet or operation roster on the first click. Below 100%, or when inspecting someone else's read-only profile, no prestige shortcut appears. The existing confirmation button remains server-side eligibility checked.

This is a display-only Components V2 improvement with no migrations, economy changes or new gameplay actions. After review and merge, in `/Users/gabberjay/Documents/arvee-idle` run `git switch master && git pull --ff-only origin master && npm ci && npm run mac:restart`. There are no new slash-command definitions for this patch.

## ARVEE Idle 2.9 — Simpler Navigation & Everyday QoL

The Command Center now has **six destinations**, rather than 18: Operations, Satchel, Adventure, Guilds, Progress and More. Adventure, Progress and More open small one-step category menus; all old commands and in-flight owner-locked component IDs still route to the same existing features.

**Smart Buy Max:** Each operation's inspect card offers Buy 1, Buy 10 and Buy Max. Buy Max uses a monotonic binary search over the existing 3% cost curve and purchases only the number affordable *inside the same locked PostgreSQL transaction* (up to 1,000 per action and 10,000 owned per type). `/idle buy generator:<id> max:true` also works; amount and max are mutually exclusive. No borrowed IC, discounts or unbounded purchases.

**Idle return summary:** After at least five minutes between saved player settlements, opening your own Command Center shows the exact IC passively settled since the last saved activity. Short visits and other-player read-only views do not show an invented offline bonus. Settlements already happen server-side; this is a display of existing earnings, not a new grant.

**Progression guidance:** Operation inspect cards show a simple approximate time until the next purchase at the current passive IC/s. Time estimates are display-only and reflect the current rate, which may change.

No schema migration, no new reward tables or balance resets. CI covers purchase bounds, concurrent writes, single settlement, menu depth and compact Discord Components V2. After review and merge, in `/Users/gabberjay/Documents/arvee-idle` run `git switch master && git pull --ff-only origin master && npm ci && npm run register && npm run mac:restart`. Registration updates the optional `max` slash argument; only ARVEE Idle is restarted.

## ARVEE Idle 2.8 — Coffee-inspired Core Polish

Version 2.8 focuses on improving existing gameplay. There are no economy or reward changes and no database migrations.

- **Accurate prestige:** The Command Center shows exact integer percentage progress to 1B IC (not rounded to 10% steps), remaining IC and readiness.
- **Clear next action:** Daily, mining and prestige readiness guide players to a single relevant activity without added buttons or queries. Other-player profiles stay read-only.
- **Unambiguous navigation:** Passive-income generators are called *Operations*; timed missions remain *World Map expeditions*, and guild weeklies remain *Guild Expeditions*. Existing commands, saved preferences and action identifiers are unchanged.
- **Compact receipts:** Recruiting operations or prestiging, by button or slash command, now shows the same Coffee-style two-button result with actual committed values.
- **Error handling:** Unexpected Discord failures after an interaction acknowledgement now show a private fallback rather than leaving players without feedback.
- **Tests:** New regression tests cover progress boundaries, guidance, cross-server-safe receipts and UI component limits.

**After PR review:** Run `npm ci && npm run check && npm test`. After the PR is merged, update only ARVEE Idle in `/Users/gabberjay/Documents/arvee-idle`: `git switch master && git pull --ff-only origin master && npm ci && npm run register && npm run mac:restart`. Run registration for updated slash-command descriptions; no SQL migration is required for 2.8.

## ARVEE Idle 2.7 — Guild Expeditions & Seasonal Guild Leagues

Team expeditions are **global player-guild objectives** rather than Discord-server missions. Successful gameplay events from members of the same guild advance shared objectives regardless of which Discord server hosts the command. Data lives in the existing PostgreSQL database and the Discord UI uses compact, mostly emoji-free Components V2.

### Weekly cooperative expeditions

Open **/idle guild expeditions** or select **Expeditions** from the Guild overview. Each UTC week, a guild can complete:

| Expedition | Successful activity | Goal | Per-player/day cap | Personal reward (2+ accepted actions) | Shared Renown |
| --- | --- | ---: | ---: | --- | ---: |
| Mining Run | Mine successfully | 10 | 5 | 300 IC + 3 Rune Ore | 50 |
| Frontier Survey | Collect a timed expedition | 6 | 2 | 550 IC + 2 Moonsteel | 75 |
| Siege Support | Strike a World Boss | 8 | 3 | 700 IC + 1 Gold | 90 |
| Supply Line | Claim a Daily Reward | 5 | 1 | 450 IC + 1 Supply Cache | 65 |

A team objective is complete only when its goal is reached **and at least two distinct guild members have contributed**. Progress cannot be granted for blocked cooldowns, duplicate expedition collections, failed actions or unlimited command spam. Per-player daily progress is capped for every objective, but real gameplay continues normally after the cap. Each completion grants the guild its fixed shared Renown (and guild XP) once, and **100 weekly league points**.

**Personal rewards:** Any guildmate who accumulated at least two accepted actions before the team objective completed may claim its snapshotted IC/items once using the Guild Expeditions screen or `/idle guild claim`. Payouts remain claimable after the weekly reset or leaving the guild, as long as the guild still exists. Disbanding a guild permanently deletes its guild-specific missions and outstanding mission rewards, as explicitly confirmed by the leader. **Per-player season locks and already-claimed season receipts survive disbanding**, preventing repeat seasonal prizes through guild recreation.

### Four-week Guild Leagues

Open **/idle guild league**. Every four UTC weeks, leagues tally 100 points per completed objective (maximum 400 per week, 1,600 per season) and display weekly and season top-five rankings. Ranking depends on completed cooperative objectives, **not raw participant count or unlimited mined/boss damage**, giving smaller active guilds a genuine chance. Tier titles are Explorer (1–399), Bronze (400+), Silver (800+), Gold (1,200+) and Diamond (1,600).

At the end of a four-week season, a member who contributed **six or more accepted actions** to their locked season guild may claim one tier-based season prize. Bronze awards 750 IC + 2 Supply Caches, Silver 1,250 IC + 1 Rare Cache, Gold 2,000 IC + 2 Rare Caches, and Diamond 2,800 IC + 1 Legendary Cache. Unranked/Explorer have no season prize. Rewards depend on unlocked **season milestones**, not finishing first, and therefore remain accessible to smaller guilds.

Season participation is locked to the **first guild where an accepted expedition action is recorded**. If a player switches guilds mid-season, they may continue their personal game and standard guild progression, but new expedition/league actions in the new guild are deferred until the next four-week season. This prevents moving contributions or hopping guilds for multiple rewards. Previous earned rewards and season claims remain accessible. A single season prize can be claimed per Discord user per season.

### Reliability & operational details

- UTC Monday weekly rotation and four-week league seasons are derived from database timestamps. No bot timer, manual reset, Discord guild ID, or third-party service is required.
- PostgreSQL player locks and guild locks serialize concurrent progress, completion and payouts across bot shards. A unique membership-season lock prevents moving the same player's league contributions between guilds. Personal claims and historic season payouts use unique keys and single database transactions.
- Mission target, IC, material, quantity, Renown and points are snapshotted when the first qualifying event creates each mission; future balance patches cannot rewrite completed rewards.
- Daily caps, two distinct contributors, two accepted actions for weekly payout, six actions for season payout and fixed milestone standings are the primary anti-abuse protections. Discord account farming is still possible and should be reviewed before offering high-value prizes.
- Migrations add tables/indexes only and preserve existing accounts, IC, guilds, pets, inventory, expeditions and World Boss records.

**Deployment after review/merge:** In `/Users/gabberjay/Documents/arvee-idle`, run `git switch master && git pull --ff-only origin master`, `npm ci`, `npm run setup`, `npm run mac:restart`, and `npm run mac:status`. Setup must run **before** restart to apply additive schema and register new guild slash commands. Do a live two-account, two-server Guild Expedition and League UI smoke test. This PR must not be merged automatically.

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
- Earn XP through mining, daily claims, recruiting operations, expeditions, crafting, opening caches, pickaxe/perk upgrades, and prestige. **There is no daily Season XP cap**; a tier unlocks every **250 XP**.
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
