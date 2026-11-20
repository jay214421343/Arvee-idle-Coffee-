# ARVEE Idle browser and shared ecosystem

Pair this branch with `codex/unified-ecosystem` in ARVEE (`jay214421343/arvee-source`).
The authoritative rollout and security review is `docs/UNIFIED-ECOSYSTEM.md` in
that PR. Both PRs must be reviewed together. The owner subsequently authorized live
publication; both PRs remain open and unmerged. ARVEE
`docs/ECOSYSTEM-LIVE-RELEASE.md` records the live rollout and browser evidence.
Real PostgreSQL CI passed all 190 tests, and public browser gameplay/mobile QA passed.

Idle retains its existing dedicated PostgreSQL database, Discord application,
gameplay rules and data. The browser uses the existing slash/component handlers
through `src/browser.js`; it cannot access `/admin` or arbitrary store methods.
ARVEE's existing Next.js website hosts the client and its existing gateway
authenticates every browser action, assigns the Discord ID and checks CSRF/origin.
`src/web.js` accepts only authenticated private gateway requests on loopback port
3092. Do not expose this service as a public web server.

Run `npm run db:migrate` after backing up Idle. Idle's additive schema creates only
`ecosystem_cosmetics`, `browser_actions` and the receipt cleanup index. ARVEE
adds one browser-bound sign-in handoff table in its existing Hub database. It does
not move or recreate player records. Run `npm run check` and `npm test`; CI runs
the full suite against PostgreSQL 17, including browser/Discord state and replay
checks. Integration tests require `ARVEE_IDLE_TEST_DATABASE_URL` containing
`arvee_idle_test` and a migrated schema; never target a player database.

Copy the settings from `docs/ECOSYSTEM.env.example` into the existing private
environment. Keep `DATABASE_URL` and all Discord credentials unchanged. The
gateway and this browser service share `IDLE_SERVICE_KEY`; both Idle processes
and the ARVEE gateway share a different `ARVEE_ECOSYSTEM_KEY`. All values remain
server-side. For separate machines use HTTPS; HTTP is restricted to loopback.

Start the optional browser service separately with `npm run web`, or after operator
approval use `pm2 start ecosystem.web.config.cjs --only arvee-idle-web`. Set
`ARVEE_NODE` to the supported Node interpreter when PM2 does not inherit it. The
existing `ecosystem.config.cjs` still controls only the Idle Discord bot. Configure
and restart the Discord process too so its profiles show membership and cosmetics.
Do not run production migrations, command registration or PM2 changes during PR
review.

The existing ARVEE tier/expiry automatically controls Idle's supporter nameplate
and accent. No purchase, entitlement or billing record is stored here. An ARVEE
outage removes paid presentation temporarily but leaves free gameplay available.
RPG level 25 and prestige 1 unlock permanent Idle profile decorations; Idle mining
XP 100 and prestige 1 unlock zero-stat RPG titles. Open the Idle profile to sync.
There are no currency transfers, paid mining multipliers or additional progression
menus. Existing `profile_tag` values and pickaxe skins are preserved.

Browser action receipts use a 24-hour request-ID window and are cleaned after at
least 25 hours. Completed matching retries replay; pending/uncertain actions reject
automatic retries. If a player loses a response, inspect saved state and refresh
the profile before repeating an economic action. Do not erase valid receipts to
retry a purchase. On an explicit Idle account erasure remove its browser receipts
as well as the existing game data; cosmetic rows cascade with player deletion.

Rollback by stopping only the optional web process and removing public Idle
routing. Leave the additive tables and all player data intact. Disconnect ARVEE's
Idle bridge and revert both application releases together if necessary.
