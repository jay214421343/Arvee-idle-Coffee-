# 2.1.0 — season journey, quieter interface, and easier progression (unreleased)

- Added the **Founders' Journey** season with 20 free tiers, activity XP, daily cap, contracts, 7-day claim grace, and atomic rewards in PostgreSQL.
- Made the UI calmer: one ARVEE-purple accent, neutral rarity markers, and no decorative green buttons; red remains for destructive confirmations.
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