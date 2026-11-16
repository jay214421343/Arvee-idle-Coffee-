# ☕ Coffee — Discord Idle Game

Coffee is a modern Discord idle/incremental game with **native Components V2 dashboards**, PostgreSQL, and Discord.js v14. Earn Blob Points (BP), buy passive generators, mine resources, upgrade your pickaxe, collect loot, craft rare items, trade with other players, and prestige.

Original game created by Daniel Tran (MIT). This fork is a fresh-season rewrite: **no MongoDB player data is imported**. Historical source remains in Git history.

## Highlights

- **Components V2:** Styled cards, section thumbnails, accent colors, dropdown menus, pagination, buttons and contextual feedback. One compact /coffee interface for desktop and mobile.
- **Idle economy:** 56 original generator entries, passive BP, transaction-safe purchases, 10,000 units/generator cap, leaderboard.
- **Mining:** Base 5-minute cooldown, materials, rare lootbox drops, 10 pickaxe tiers and persistent mining XP.
- **Pickaxe perks:** Power Strike, Treasure Hunter, Quick Hands, Idle Savant and Scavenger. Pickperk Tokens unlock upgrades (max 3 different perks; each perk capped at level 10).
- **Collecting:** 25 item definitions, 11 crafting recipes, 3 lootbox tiers, consumable boosts and permanent Almanac orbs.
- **Marketplace:** Browse, list, purchase and cancel listings with transaction-safe item/BP transfers.
- **Prestige:** Requires 1B BP. Resets balance/generators for +25% generator output per prestige; keeps inventory, mining XP, pickaxe tiers, perks and orbs.
- **Security:** PostgreSQL row locks, parametrized queries, limited bot intents, owner-locked UI controls. No remote eval or author emulation.

## Requirements

- Node.js 22.12+; PostgreSQL 15+; Discord bot token, application ID and testing server
- A dedicated PostgreSQL database + least-privileged role

## Start a private test instance

1. Clone this repository, then run **npm install**.
2. Copy .env.example to .env. Set DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID (private server) and DATABASE_URL.
3. Create a new, empty PostgreSQL database; restrict access to the Coffee role.
4. Run **npm run db:migrate**. The migration is additive and safe to rerun.
5. Run **npm run register** to register the /coffee command in the test server.
6. Run **npm start**, then use /coffee profile and the buttons.

Invite the bot with the **bot** and **applications.commands** scopes. Once tested, remove DISCORD_GUILD_ID and re-register for global commands. The Message Content privileged intent is not needed.

### Slash commands

Every command lives under /coffee.

| Commands | Purpose |
| --- | --- |
| help, profile, shop, buy, leaderboard | Economy and progress |
| mine, pickaxe, perks, daily | Mining and upgrades |
| inventory, use, open, craft, give | Items and crafting |
| market browse, market sell, market buy, market cancel | Trading |
| prestige | Permanent progression |

Most screens offer buttons or select menus. Each menu is bound to the player who opened it; another player clicking it gets a private rejection.

### Loot and progression

- Lootboxes drop supplies, ore, silver, gold and occasional perk materials.
- Rare lootboxes improve the odds of valuable items.
- Legendary lootboxes can drop Orbs of Almanac, Gems and Pickperk Tokens.
- Craft Coffee, Cookie, Lucky Charm, Golden Apple, Foxtail Amulet, Tinker's Gizmo, Orb of Almanac and more.
- Next-mine boosts are capped to prevent unlimited stacking. Almanac orbs grant +10% permanent passive income each (max 20).

### Persistence and correctness

BP uses Decimal.js in application code and PostgreSQL arbitrary-precision NUMERIC. Never cast BP into JavaScript Number. Passive earnings are calculated lazily when the player is accessed. The leaderboard displays last-settled earnings, not fully projected offline totals.

Every purchase and player transfer runs in one PostgreSQL transaction, locking player rows consistently. Inventory removals reject insufficient stock. Marketplace listings are locked before fulfillment.

Schema changes are additive and do not delete existing Coffee players. There is no MongoDB import.

## Tests and CI

- **npm run check** — JS syntax checks
- **npm test** — economy, UI serializer, PostgreSQL transactions, buying races and progression tests
- **npm run db:migrate** — create/update database schema

Integration tests run only when COFFEE_TEST_DATABASE_URL points to a dedicated database whose name contains coffee_test. CI provisions PostgreSQL 17 and validates UI builders.

## Release checklist

- [ ] CI green after the final changes
- [ ] Verify slash commands in a private Discord server
- [ ] Verify Components V2 across desktop/mobile Discord clients
- [ ] Test listing contention, mining, crafting, prestige and permissions
- [ ] Configure backups and restricted production database access
- [ ] Merge and deploy only after owner review

The new systems cover the core economy and many legacy item concepts, but do not replicate every historical 2021 custom item perk exactly. Live Discord verification still requires the bot credentials and a private server.
