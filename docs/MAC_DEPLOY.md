# ARVEE Idle — Mac + PM2 deployment

ARVEE Idle is a separate Discord application and process from the main ARVEE bot. Do not reuse the main ARVEE bot's Discord token, application ID, database or startup scripts. The runtime binary is shared read-only from /Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin/node.

## One-time preparation

Clone into a separate folder beside the ARVEE repo, e.g. /Users/gabberjay/Documents/arvee-idle, not inside the ARVEE repo.

Open a Terminal with the Node binary on PATH:

    export PATH="/Users/gabberjay/Documents/arvee/.runtime/node-v22.23.5-darwin-x64/bin:$PATH"
    rehash
    node -v

Inside your ARVEE Idle clone:

    npm ci
    cp -n .env.example .env
    nano .env

Configure the dedicated Discord app and PostgreSQL arvee_idle database in .env. Use a separate role (e.g. arvee_idle_app) and the target server's own port; the example uses port 5432.

If you have an empty PostgreSQL server on port 5432 with the psql utilities installed, create a dedicated role and database using an admin role:

    createuser -h 127.0.0.1 -p 5432 -P arvee_idle_app
    createdb -h 127.0.0.1 -p 5432 -O arvee_idle_app arvee_idle

Do not use the ARVEE arvee_hub or arvee_game databases. createuser and createdb are one-time steps and can report "already exists" on repeat.

## Initialize and test

    npm run db:migrate
    npm run doctor
    npm run check
    npm test
    npm run register

npm run register upserts only the /idle slash command in the configured application/scope; it does not delete unrelated slash commands.

## Start only ARVEE Idle in PM2

    pm2 start ecosystem.config.cjs --only arvee-idle
    pm2 logs arvee-idle --lines 60
    pm2 describe arvee-idle

The ecosystem file uses cwd: __dirname and explicitly selects the Node binary above. It uses one fork instance, memory limits, crash recovery and readiness signaling. It does not start, stop or restart other ARVEE processes.

Once you have confirmed every PM2 process is correct with pm2 list, you may run pm2 save to persist the whole PM2 process list. Do not run pm2 restart all, pm2 delete all, or pm2 kill.

## Updating the code

From your ARVEE Idle clone (not /Users/gabberjay/Documents/arvee):

    git switch master
    git pull --ff-only origin master
    npm ci
    npm run db:migrate
    npm run doctor
    npm run register
    pm2 restart arvee-idle --update-env

The process is offline if pm2 reports errored; run pm2 logs arvee-idle for details, without pasting tokens or DB passwords.

## Commands and naming

/idle is the only ARVEE Idle command. The separate ARVEE Idle Discord application requires the bot and applications.commands scopes. It has no shared wallet, API access or SKU entitlements from the main ARVEE application by default.

To remove an older /coffee command from the same application/scope only after checking the application ID, use npm run register -- --remove-legacy-coffee. This action deletes just that legacy command, not any main ARVEE slash command.

## Security

Store .env only inside ARVEE Idle's directory and keep it out of git. Use a dedicated database user and limited network access. Do not run the two apps with the same bot token. A private Discord test server is recommended before switching to global registration.
