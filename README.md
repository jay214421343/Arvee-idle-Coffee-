# ☕ Coffee

Coffee is a Discord idle game, rebuilt for **Discord.js 14, PostgreSQL and slash commands**. This is a fresh season: **no MongoDB data is imported**.

Original Coffee game by Daniel Tran (MIT); modernization lives in this fork. The repository history retains its original source.

## What's playable

- BP generators, passive earnings, generator shop and player profiles
- Mining (5-minute cooldown), daily rewards (22-hour cooldown), lootboxes
- Inventory, crafting, gifting, player marketplace and leaderboards
- Prestige at 1B BP, adding a permanent +25% generator income per prestige
- PostgreSQL row locking for safe transactions and transfers
- Slash-command-only bot, with no Message Content intent or remote eval

## Requirements

- Node.js 22.12+ and PostgreSQL 15+
- Discord application/bot token and application ID
- A dedicated, empty PostgreSQL database and restricted user account

## Run locally

1. Clone this repository and run: npm install
2. Copy .env.example to .env. Set DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL.
3. Create an **empty** PostgreSQL database, with a user granted access to Coffee only.
4. Run: npm run db:migrate
5. For instant test-server registration, set DISCORD_GUILD_ID, then run: npm run register
6. Run: npm start

Once ready for public use, remove DISCORD_GUILD_ID and rerun registration for global commands. Invite the bot with bot and applications.commands OAuth2 scopes.

Never commit .env, use production DB access for tests, or expose your database publicly.

## Available slash commands

Coffee has a single parent command, /coffee, with these subcommands:

- help, profile, shop, buy, mine, daily, inventory
- craft, open, give, leaderboard, prestige
- market browse, market sell, market buy, market cancel

Recipes: Coffee = 3 ore + 1 silver; Cookie = 2 coffee + 2 ore; Lucky Charm = 2 gold + 8 silver + 1 cookie.

## Architecture

- The original BP generator catalogue is preserved in src/data/generators.json.
- Arbitrarily large BP values use Decimal.js in Node and NUMERIC in PostgreSQL.
- Every player mutation, including two-player item transfers and purchases, is transactional.
- Passive BP is accrued when the player is accessed. The leaderboard uses last-settled earnings, not an offline live projection.
- Price growth is the original 1.03 factor. This reboot **does not yet implement all old pickaxe perks, rare items or item-specific effects**. The original game is still available in the Git history.
- No existing player profiles are migrated or modified.

## Tests

- npm run check — syntax checks
- npm test — unit tests, plus integration tests if COFFEE_TEST_DATABASE_URL is supplied
- npm run db:migrate — idempotent schema creation

Integration tests require a separate database whose name includes coffee_test. CI creates one with PostgreSQL 17.

## Deploy safely

Keep the bot offline while preparing PostgreSQL. Run migrations, register slash commands in a private Discord server, verify gameplay, and only then deploy. Do not merge or deploy without reviewing CI.
