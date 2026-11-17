# 2.12.0 — 100 Season Tiers and Private Owner Administration (pending review)

- Expand free Founders' Journey from 20 to 100 tiers, preserving its existing tier 1–20 rewards, player XP, one-time claims and season schedule.
- Add 80 gradual reward milestones across four new reward chapters, with 25,000 XP at tier 100 and no daily XP ceiling.
- Add direct 25-page Season Journey navigation while keeping the mobile layout to four rewards per page.
- Add guild-scoped, owner-authorized `/admin` with auditing and transactional state controls.
- Add public `/idle info item:<item>` and group Settings/Stats beneath `/idle account` to remain within Discord's 25 top-level slash option limit.
- Widen existing PostgreSQL season claims check to 1–100 and add administration records additively.
- Add regression and integration tests for new tier claims, owner restrictions and admin economy integrity.

---

# 2.11.2 — Eligible-Only Quick Mining Reset (pending review)

- Show a context-aware `Use Campfire Brew` or specific reset-item button only while mining is cooling down, if an eligible consumable is owned.
- Prioritize common Campfire Brew before less common resets. Respect active multi-dig food boosts and the 20× combined boost ceiling.
- Show `View pickaxe` instead of a useless disabled reset button when no item qualifies. Always keep the 2-action mobile-friendly receipt.
- On success, offer `Mine now`. Server-side transaction revalidates the cooldown, item compatibility and inventory before consuming anything.
- Unit, routing and PostgreSQL tests cover ineligible state, stale/expired cooldown, missing inventory, boost conflicts and owner-only interactions.
- No database migration or slash-command re-registration required.

---

# 2.11.1 — Rebirth Cocktail in the Lucky Pool Only (pending review)

- Each prestige has one optional reward roll: **5% Rebirth Cocktail**, 5% Adventurer's Lunchbox, 10% Rare Supply Cache, 30% Supply Cache, or **50% no bonus**.
- **Removed the previously guaranteed cocktail.** Players may prestige without any item award; a lucky cocktail result grants exactly one cocktail.
- Preserve existing prestige requirements, permanent production multiplier, inventory, and transaction-backed duplicate protection.
- Update the prestige preview, completion receipt, item description and documentation. Unit and PostgreSQL tests verify all reward outcomes.
- No database migration or slash-command registration required.

---

# 2.11.0 — Companion Builds & Mastery (pending review)

- Remove the Founders' Journey 500 XP/day cap and its progress counter. All qualifying actions contribute full season XP; historical XP and claims are preserved.
- Add three per-pet talent specializations (Focus, Tracker and Vanguard), unlocked at level 10 and enhanced automatically at level 20.
- Add three craftable and collectible equipped charms. One charm follows the active pet; trading away the owned charm disables its effect. Saved choices and bonuses are cross-server.
- Introduce Enchanted and Astral Eggs as craftable rarity-weighted hatch sources, without guaranteeing Mythics or invalidating ordinary eggs.
- Add a compact Hatchery and Mastery UI, preserving one active pet and the concise Command Center navigation.
- Keep the guaranteed Rebirth Cocktail and add a 30% regular cache, 10% rare cache, 5% Adventurer's Lunchbox chance at successful prestige. Lunchboxes yield one ration and one tonic.
- Move `/idle craft` item selection to autocomplete to support more than 25 blueprints.
- Roll optional rebirth rewards atomically under the existing player transaction lock. Never grant on failed or duplicate prestige.
- Requires an additive database migration for pet talents and equipped charms before bot restart; slash-command re-registration also required.

---

# 2.10.0 — Companion Diversity & Supply Cache Improvements (pending review)

- Expand companions from 3 to 18 distinct pets with six rarity tiers and build-oriented mining, expedition, boss, egg and cache effects.
- Keep the three original starters, one active pet, existing player collection and XP persistence, weighted hatching and duplicate XP.
- Increase successful-mine Supply Cache base chance from 4% to 7%. Keep existing Scavenger scaling and add Rune Gecko's non-guaranteed bonus.
- No guaranteed Rune Fragments and no direct mining fragment rewards; retain all current cache loot tables and odds.
- Show rarity and concise effect in a compact Companion collection; make Rune Fragment sources explicit in the talents view.
- Replace developer-facing Coffee references in player item lore and profile title options with ARVEE-world wording.
- Extend companion PostgreSQL CHECK constraints additively; migration is required before bot restart.

---

# 2.9.4 — Animated Silver Emoji Fix (pending review)

- Correct Moonsteel/Silver's registered application emoji from static `<:silver:1572284313511141477>` to animated `<a:silver:1572284313511141477>`.
- Apply the animated syntax consistently in the item catalogue, artwork registry and regression tests so the emoji renders on item cards and mining receipts.
- Keep all other uploaded emoji mappings unchanged: their animation status has not been confirmed.
- Pure presentation fix; no economy, inventory, schema or gameplay changes. Restart ARVEE Idle after review and merge. No migration or slash-command re-registration required.

---

# 2.9.3 — Coffee Mining, Rebirth Cocktail & Art Registry (pending review)

- Coffee-style mining receipts with Mr. M. Iner, precise base vs bonus IC, item sources, charge counts and pickaxe artwork.
- Campfire Brew and selected tonics can reset or reduce mining cooldown; food buffs grant multiple successful digs without stacking and keep ARVEE's 20× ceiling.
- Prestige awards one Rebirth Cocktail atomically; grants a cooldown reset and 2× mining income for three successful digs.
- Register custom application emoji IDs for Moonsteel, Supply Cache and new I Skin, I Skin II and Demon Skin cosmetic finishes; `unknown` is the fallback when an item has no artwork.
- Four additive PostgreSQL boost columns and a backward-compatible pickaxe style constraint extension. Database migration required before restart.
- Regression tests cover mining rewards, icons, item effects, persistence and prestige grant safety.

---

# 2.9.2 — Operation Lore & Coffee Items Restoration (pending review)

- Replaced all repeated operation boilerplate with 56 distinct ARVEE-themed descriptions, including a handful of subtle jokes.
- Added **Creditus Deletus**, a safe Coffee-inspired prank item that displays a fake wallet-deletion message but changes no IC or progression.
- Obtain it from a 0.5% Mythic Supply Cache chance or by crafting 10 Void Essence, 15 Moonsteel and 1 Traveler's Ration.
- Consumption remains owner-bound and database-transactional, with no permanent side effects beyond consuming the scroll and recording its use.
- Added deterministic lore and item regression tests, including database concurrency and loot safety.
- Existing operation economy, player rewards and high-tier drop rates otherwise remain unchanged.
- Restored 12 additional Coffee-inspired consumables and utilities with real ARVEE-safe effects, dedicated Forge recipes and bonus cache finds.
- Added persistent player tags, cosmetic pickaxe names and pickaxe finishes, using three additive PostgreSQL columns; survival across prestige and cross-server use are tested.
- Exposed /idle use item autocomplete for the expanded catalogue, with optional name input and safe compact preset menus.
- Mine Alert and Stat Card are reusable tools, while unfinished Crew Reboot safely recruits one Rookie instead of wiping operations.
- Deployment needs `npm run db:migrate && npm run register` before restarting the dedicated Idle bot.

---

# 2.9.1 — Command Center Navigation & Prestige Shortcut (pending review)

- Moved the six-option navigation dropdown directly underneath the Command Center player summary for easier access without additional UI rows.
- At 100% prestige progress, show a contextual owner-bound Prestige button beside the progress section. Opening the prestige preview never triggers a reset; the user must still explicitly confirm.
- Hide this shortcut below 100% and in read-only profiles, with no redundant next-step message at maximum progress.
- Added regression tests for conditional visibility, safe navigation order, mobile-sized Components V2 and existing quick actions.
- No schema changes, economy adjustments, new permissions or reward changes.

---

# 2.9.0 — Simple Navigation & Smart Idle QoL (pending review)

- Reduced the Command Center navigation dropdown from 18 choices to six, grouping secondary destinations behind short one-step menus without deleting commands.
- Added transaction-safe operation Buy Max (up to 1,000 per action and 10,000 per operation) using exact cost math and a bounded binary search. Available from inspect cards and `/idle buy max:true`.
- Display exact already-settled passive IC earned after five minutes away from saved activity; never double-pay or claim time-based rewards.
- Added a clear approximate time-to-afford hint for the next operation based on the current passive IC/s.
- Added SQL concurrency, precision and Components V2 regression coverage. Economy rates, guilds, World Bosses and all existing player data remain unchanged.

---

# 2.8.0 — Coffee-inspired Core Polish (pending review)

- Fixed Command Center prestige progress to show accurate integer percentages and remaining IC.
- Added contextual next-action guidance using actual daily, mining, passive-income and prestige readiness without extra database reads.
- Clarified passive Operations versus timed and cooperative Expeditions in main navigation.
- Unified operation-purchase and prestige success receipts across slash commands and buttons, with two relevant actions and committed amounts.
- Added a private error fallback for unexpected post-acknowledgement Discord failures.
- Added deterministic regression tests. Preserved all PostgreSQL data, economy formulas, 1e222+ suffixes and reward protections.

---

# 2.7.0 — Guild Expeditions & Seasonal Guild Leagues (unreleased)

- Added four team-based weekly contracts (Mining Run, Frontier Survey, Siege Support, Supply Line), advancing only through committed gameplay events. Per-user daily caps and two distinct contributors are required.
- Guild progress, completed-once shared Renown bonuses, accepted per-member contribution and one-time IC/material payouts are persisted transactionally in PostgreSQL; old-week rewards remain claimable after changing guilds.
- Added four-week seasonal league rankings and Bronze/Silver/Gold/Diamond reward milestones, with per-season prize grants only for members with at least six legitimate accepted actions.
- Season-locked guild attribution prevents guild-hopping or duplicate seasonal prize farming, even after a guild is disbanded. Season payout receipts persist independently of deleted guilds. Mission goals and rewards are snapshotted at creation; league standings score completed team missions rather than guild size or unrestricted activity.
- Added compact Coffee-inspired Components V2 Guild Expeditions and Guild Leagues screens, contextual claims, weekly progress bars and leaderboard views. Discord User IDs and guild membership remain global across servers.
- Additive database schema, owner-locked interactions, and dedicated PostgreSQL integration tests for racing contributions, exact-once claims, cooperative completion, daily caps, cross-guild locks, expired-week payouts and prior-season prizes.

---
# 2.6.0 — Global Player Guilds (unreleased)

- Added global player guild creation, unique tags, one membership per Discord user, 72-hour invitations, permissions for leader/officer/member, safe owner transfer and confirmed disband/leave.
- Added member roster, guild XP/levels, shared Renown and Hall tiers (up to 32 members), with up to +5% mine IC and +10% World Boss strike damage. Per-user UTC daily guild XP/Renown gain is capped at 250.
- Guild actions reuse the authoritative PostgreSQL player locks and guild-row locks; membership caps and invitations are validated transactionally across shards/servers.
- Snapshotted weekly World Boss damage attribution per guild and attacker on committed strikes; weekly guild rankings cannot be manipulated by changing guilds afterward.
- Added `/idle guild` command group with management functions and a compact Coffee-style Components V2 Guild board, invitation picker, Hall upgrade and rankings. Minimal emojis and contextual buttons only.
- New additive schema does not reset personal balances, inventory, prestige, companions, seasons or world bosses. No personal IC deposits or guild-admin withdrawals.
- Added pure model/UI tests and PostgreSQL integration tests for parallel joins, roles, damage attribution, daily caps, upgrade perks, prestige persistence and destructive operations.

---
# 2.5.0 — World Bosses (unreleased)

- Added globally shared weekly bosses rotating at UTC Monday, with one PostgreSQL boss instance and serializable HP updates across servers/shards.
- Added `/idle boss` and a compact, owner-bound battle board with contextual attack, reward claim, cooldown and top contributor information.
- Added persistent per-player strike cooldown, contribution ledger and once-only reward claims. Old qualified rewards remain claimable after future weekly rotations.
- World Boss rewards share a bounded IC budget by actual global HP damage; qualification requires two strikes and at least 1.5% HP damage (minimum 80). Timed-out encounters grant partial payouts for real damage rather than all-or-nothing rewards.
- Ember Fox increases damage, Moss Wisp shortens strike cooldowns, Moon Owl boosts rare loot odds based on snapshotted on-strike contribution. Attacks earn limited Season/Companion XP and can progress a rotating weekly contract.
- Added the Boss Challenger and Worldbreaker Milestones achievements, derived from committed boss attack and reward events.
- Additive schema, no changes to old balances or player items; CI checks weekly boundaries, cross-user damage races, double-click prevention, payouts, old-week claims, and Components V2 mobile limits.

---
# 2.4.2 — Quality & readiness (unreleased)

- Added unobtrusive Mine/Daily readiness to the Command Center, with Discord-relative cooldown timestamps and no extra buttons.
- Centralized mine and daily cooldown calculations in a pure, testable helper shared by the authoritative PostgreSQL-backed gameplay code and the UI.
- Made other-player `/idle profile user:` and `/idle inventory user:` screens explicitly read-only, avoiding accidental use of your own item action buttons while inspecting someone else's account.
- Fixed an inaccurate lifetime-earnings UI label: `total_earned` resets with prestige and is now described as this-run earnings.
- Added unit/UI and slash-command tests for cooldown math, protected spectator views, mobile-friendly component counts and owner-bound action IDs. No migrations or balance modifications.

---
# 2.4.1 — Coffee-inspired mining and activity UI (unreleased)

- Restyled mining outcomes and cooldowns using Coffee's original dialogue-and-rewards presentation, adapted to native Discord Components V2 and ARVEE's restrained purple palette.
- Made daily supplies, crafting and opened supply caches use matching compact reward receipts with a maximum of two actionable buttons.
- Used self-updating Discord relative timestamps and readable countdowns for real mining/daily cooldowns; only display actual persisted game rewards.
- Removed the bulky default four-button row from generic result messages; no database or gameplay balancing changes.
- Added dedicated component and owner-binding tests for success, cooldown, bonus rewards and item receipts.

---

# 2.4.0 — Companions (unreleased)

- Added Ember Fox, Moss Wisp and Moon Owl, with one-time free starter choice, permanent collection, one active companion and XP-based evolution stages.
- Bonuses improve actual mining IC, expedition duration or material drops, with effects calculated server-side and snapshotted on mission start.
- Successful expeditions may grant a pre-rolled Companion Egg; hatching is transactional, with duplicate pets granting 150 XP. A rotating weekly contract can award eggs too.
- Added owner-bound /idle companions and compact Components V2 adoption, equip and hatch interactions without decorative emoji overload.
- Additive PostgreSQL migrations preserve existing balances, inventories, season claims, preferences and missions. Pets persist through prestige.
- Added unit, Discord serialization and database integration tests for progression, rewards and concurrent actions.

---
# 2.3.0 — Expeditions 2.0 (unreleased)

- Added three persistent explorable regions with progression gates, mission timers, loot tables, outcomes and exploration XP.
- Introduced persistent, upgradeable Trailblazer's Kit, Astral Compass and Guardian Ward with real item/IC costs and meaningful mission effects.
- New `/idle explore` and `/idle equipment` command screens, contextual Discord Components V2 buttons, region inspection and owner-locked actions.
- Reduced decorative emoji density across the Command Center, navigation menus, filters, shop, Forge, World Map, equipment, contracts, exchange, achievements and operation responses. Neutral text and rarity symbols remain; item art appears in detail inspection.
- Expedition rewards are calculated server-side at launch and saved in PostgreSQL; concurrent claims are transactional and idempotent.
- Exploration completion now contributes to the Season Journey and rotating daily/weekly Adventurer Contracts.
- Added additive database tables, rendering tests, economy integration tests, and preserved progress through prestige resets.
- Standardized every large IC amount, generator cost/income, and market price to compact suffixes beyond decillion, including alphabetic tiers past 10^222; gameplay precision is unchanged.

---
# 2.2.0 — Saved filters and Adventurer Contracts (unreleased)

- Remember Expedition and Satchel category + sort, and Forge craftability preferences per user across bot restarts through PostgreSQL.
- Add /idle settings with a safe reset to defaults and accessible filter navigation.
- Introduce three daily and three weekly rotating Adventurer Contracts with real activity tracking, claimable IC/item rewards and UTC resets.
- Challenge rewards are atomic/idempotent, protect against forged or expired claims, and never generate additional season XP.
- Add unit, database integration and Components V2 interaction tests. No changes to existing user balances or item identifiers.

---

# 2.1.0 — season journey, quieter interface, and easier progression (unreleased)

- Added the **Founders' Journey** season with 20 free tiers, activity XP, daily cap, contracts, 7-day claim grace, and atomic rewards in PostgreSQL.
- Made the UI calmer: one ARVEE-purple accent, neutral rarity markers, and no decorative green buttons; red remains for destructive confirmations.
- Rebuilt the Rune Talents page with fragment counts and a disabled upgrade dropdown when the player has no tokens.
- Preserved season rewards during prestige resets, corrected the pickaxe Quick Hands cooldown description, and fixed prestige's starter balance to 500 IC.
- Added season progress and claim tests, including concurrent duplicate-claim prevention and daily XP limits.

- Inspired by the supplied Discord UI references: rebuilt the Satchel with compact rarity-coded rows, a right-aligned Filters button, sorting and an Inspect dropdown; streamlined the Expeditions board with context filters and inline Inspect actions.
- Added a ten-destination emoji navigation dropdown to the Command Center while keeping daily actions in one prominent horizontal button row.
- The Forge now has a dynamic Craftable-only menu and contextual action rows; the Player Exchange also uses a compact listing picker.

- Reworked inventory, operations and forging into individual Components V2 cards with buttons, filtering, sorting and pagination.
- Pickaxe upgrades now show owned/required material counts and disable the upgrade action until affordable, avoiding misleading errors.
- Made the early game less grindy: 500 IC starting balance, 150 IC mine minimum, 90-second mining cooldown, 750 IC daily credits, larger material drops and cheaper starter pickaxe tiers.
- Renamed lingering user-facing item names, achievements, help and slash-command descriptions while keeping database IDs compatible.
- Added simple Mac setup/PM2 scripts matched to the existing PM2 6.0.14 daemon and isolated to arvee-idle.
- CI now uses ARVEE_IDLE_TEST_DATABASE_URL and arvee_idle_test.

---

# 2.0.0 — ARVEE Idle rebrand and independent service (unreleased)

- Rebranded the Coffee bot as ARVEE Idle; its public Discord command is now /idle and the separate currency is **Idle Credits (IC)**.
- Rethemed all 56 legacy generator tiers into ARVEE RPG-style expeditions/operations while keeping stable generator IDs and prices.
- Refreshed Components V2 with a purple command center, prestige progression bar, player avatar, clearer shop affordability/ownership indicators, faster 1/10/100 purchases and an ARVEE World link.
- Re-themed consumables, caches and equipment to match the ARVEE universe.
- Added an isolated PM2 ecosystem file that uses the existing Mac Node 22.23.5 interpreter without changing the ARVEE runtime.
- Added environment validation to refuse use of the main ARVEE databases, a database doctor command, database heartbeat checks and PM2 readiness/shutdown handling.
- Changed slash-command registration to single-command upsert so it does not overwrite unrelated commands; old /coffee removal is explicit and opt-in.
- Added serialized schema migrations, repeatable deployment instructions and updated CI checks.

Release is gated on CI and private-server Discord testing. Main ARVEE bot integrations, accounts and Discord SKUs are intentionally not shared automatically.

---

# 1.1.0 — Components V2 and Coffee progression (unreleased)

- Rebuilt Coffee screens with native Components V2: interactive player dashboard, avatar, paginated shop, inventory, crafting, pickaxe, market, and confirmation actions.
- Added pickaxe upgrading, five perk tracks, new mining rewards, consumable boosts, and rare/legendary lootbox drops.
- Expanded crafting and inventory to 25 item types and 11 recipes. Added user-bound interactive controls.
- Added additive PostgreSQL schema changes, transaction-safe upgrades and item use.
- Added layout serialization tests and extended PostgreSQL race tests.
- Private-server Discord verification is required before production deployment.

---

# 0.2.3
+ Coffee is now available to be hosted locally

# 0.2.2

***FIXES***
+ Fixed the [ Gold Digger ] issue with items/perks that modify EXP incrimentation
+ Fixed changelog links
+ Fixed issues with emojis

***CHANGES***
+ The changelog command now sends a link to this page.
+ [ Carb scrapper ] perk now accepts cookies
+ Added stats for all variations of boxes

***MINOR***
+ [ Stat Card ] now displays 'single use' in item description
+ using [ Crafting Material ] no longer displays "Crafting is not avaialble yet!"
+ Fixed username markdown injection
+ Fixed "~bp give" responding with the leaderboards
+ Fixed "~patreon" and "~wiki" formatting
+ Fixed "null" on leaderboards

# 0.2.1

***CHANGED***
~ Stuff

***PRESEASON***
Thank you for participating in Coffee season 1, Season 2 will start soonTM after all the bugs have been fixed.

***NEW***
+ Inventory icons
+ Skins
+ Market and Catalogue
+ [ ***Strange Matter*** ]
+ [ ***Pumpkin Spice Latte*** ] Available until DEC 1

***UPDATED***
- Everyone's BP/Bal/Generators/ have been reset for the pre-season. They will be reset again once s2 starts

***ITEMS***
~ [ ***Orb of Almanac*** ] now requires an additional [ ***Strange Matter*** ] x15 to be crafted

# 0.1.30

***NEW***
+ [ ***Orb of Almanac*** ] item added
+ [ ***Gilded Slurry*** ] item added
+ [ ***Bohemian Cocktail*** ] item added
+ New 'Special Boosts' added
+ [ ***Tinkers Gizmo*** ] item added
+ [ ***Lootbox*** ] can now be crafted
+ [ ***Box Box*** ] can now be crafted
+ Crafting recipes can be located under item info using `~ii <itemType>`
+ Crafting now displays how many of each item you can craft.
+ [ ***Arthur's Tablet*** ] item added
+ `~inv` now shows pickaxe perks

***UPDATED***
+ Gold now can be crafted
+ A few item icons have been updated
~ Silver is now a common item
+ We've recieved a new Wiki writer!
+ Crafting menu has been changed
+ Item recipes can now be viewed with the `~ii` command
~ [ ***Gilded Slurry*** ] recipie now requires 7 [ ***Silver*** ] instead of 3
~ [ ***Bohemian Cocktail*** ] now gives 1-2 [ ***Foxtail Amulets*** ] instead of [ ***Box Box*** ]
[ ***Kingstone's Stone*** ] Changes
~ now gives 1 exp instead of 2 lvls
~ increased drop rate from boxes
~ Nerfed [ ***PP Gold Digger*** ]
~ Lowered [ Legendary Pickbox ] crafting material cost

***FIXED***
~ Fixed formatting issues with a few perks
~ Fixed a few grammatical issues
~ [ ***Gilded slurry*** ] no longer causes mass panic
~ ~~Fixed Coffee's infinite typing~~ ***Removed Coffees typing.***
~ Fixed Coffee from hanging when `~bp give` is used (bp give was removed)
~ [ ***PP Regurgitation*** ] odds fixed
~ Massive bug where mining did not actually give any bp
~ Minor formatting issues

# 0.1.26
~ Pickaxe changes
- Pickaxes level coefficient changed from `6# 0.(1+1# 0.lvl)` to `15*(1+1# 0.lvl*(tier+1))` per mine
- Pickaxe multiplier stat now factors in levels
- Fixed potential exploit with det/king perks
- Fixed carb scrapper perk
- Fixed a few formatting issues
- Added `~eat`, `~equip` and `~open` ailiases for the `~use` command
- Fixed crafting 'not enough resources' formatting issue

# 0.1.25
+ Less lag(?)

# 0.1.24
+ Added inventory filtering, `~inv filter:\box\` will give you your inventory, showing only the boxes

# 0.1.23
Buffed [ ***Golden Apple*** ]

# 0.1.22
+ Added [ ***Carb Scrapper*** ] perk
+ Added [ ***Pickperk Box*** ] Craftable item

# 0.1.21
+ Fixed [***Scrapper***] Perk, used to give CM every mine

# 0.1.20
+ Crafting is released! You can try it out with the `~craft` command.
+ added [***Golden Apple***], craftable
+ added [***Good Pickbox***], craftable
+ added [***Greater Pickbox***], craftable
+ added [***Legendary Pickbox***], craftable

# 0.1.19
+ 3 new perks released
+ Increased [ ***PP Soft Handle*** ]'s bonus from 2# 0. to 5# 0.

# 0.1.18
+ `~ii pickaxe` will show the stats of your current pickaxe
+ `~ii gold` will now show how much all the gold you own is worth
- [ ***Goldboxes*** ] have reduced drop rates from box boxes

# 0.1.17
+ Added 4 new ~shop generators

# 0.1.16
- Numbers now switch to -illion format when they are very large
+ Added 6 new ~shop generators

# 0.1.15
- Reduced [ Treasure Hunter ] perk's lootbox drop from 4 -3
+ Added 4 new ~shop generators

# 0.1.13
+ Added [ ***Kingstone's Stone*** ] item
- Fixed an issue with the [ **Hungry** ] and [ **Starved** ] perks

# 0.1.12
+ Added inventory pages, `~inv 1` or `~inv user 1`
- Fixed bug where mentioning a user for some commands wouldn't work

# 0.1.11
- Fixed a bug with the [ Dumb Luck ] Perk that made its chances of dropping a box higher than it was supposed to be
- Added local leaderboards, use `~leaderboards local 1` to view the local leaderboards.
- Increased [ **Determined Endurance** ] perk's cooldown hard cap from 3# 0.to 12# 0.seconds.
- Fixed bug where using multiple gold did not compound, `~use gold n` works the same as spamming `~use gold`

# 0.1.10
- Gold return value increased from 7% to 8%
- Bacon charge increased from 2 to 4

# 0.1.9
+ Lootboxes now drop 3 items instead of 2
+ Limited time event: May 25-28 Chances of finding Box Boxes when mining are increased!
+ New PickPerk item (PP)
   + `[ PP Perk ]` Ultra Rare
Each pickaxe now has a number of upgrade slots (2 by default)
Perks are dropped through lootboxes and can be used to upgrade
your active pickaxe.


# 0.1.7
Changes
+ New lootboxes
   + `[ Daily box ]`
   + `[ Lootbox ]` (Different from lunchboxes)
   + `[ Goldbox ]` - Drops Gold
   + `[ Box Box ]` - Drops boxes
+ Each box drops its own type of items.
+ Buffed gold - Now gives 8% instead of 7%
+ `~daily` now gives `[ Daily Boxes ] x2` instead of `[ Lunch Boxes ] x2`
+ Fixed `~contributors` issue
~ Inventory view is now sorted by item rank
- `[ Lunchboxes ]` no longer drop: Foxtail amulets

# 0.1.5
Fixed bug where foxtail amulet gave only 1 lunchbox instead of the amount it should have gave
Nerfed Foxtail amulet's lootbox drop amount from 5-1# 0.to 2-5

# 0.1.4
Changes
+ New item `[ Foxtail Amulet ]`!

# 0.1.3
Changes
+ *New* page buttons
You you can now use reactions to change the pages for certain commands.
+ Pages for `~help`
+ Pages for `~shop`
+ Pages for `~leaders <page>`
*more to come*

# 0.1.2
Changes
+ Added ~admin global_lock and ~admin global_unlock
which disables the bot for any user that is not a bot admin
+ Code migrations

# 0.1.1
Changes
+ Gold can now be used. Each piece of Gold will give you an additional +7% of your current balance.
+ Added the changelog command
Minor Changes
+ Added the ability to look at other people's inventories (the same way you'd view other people's profiles)
~ Fixed a typo
~ Fixed bug where you couldn't use more than 1 Gold at a time