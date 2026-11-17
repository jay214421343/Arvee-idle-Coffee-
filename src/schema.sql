-- ARVEE Idle PostgreSQL schema. Additive: existing inventories and balances remain intact.
CREATE TABLE IF NOT EXISTS players (
  user_id TEXT PRIMARY KEY CHECK (user_id ~ '^[0-9]{15,22}$'),
  balance NUMERIC NOT NULL DEFAULT 500 CHECK (balance >= 0),
  total_earned NUMERIC NOT NULL DEFAULT 500 CHECK (total_earned >= 0),
  prestige INTEGER NOT NULL DEFAULT 0 CHECK (prestige >= 0),
  last_settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_mine_at TIMESTAMPTZ,
  last_daily_at TIMESTAMPTZ,
  mine_xp INTEGER NOT NULL DEFAULT 0 CHECK (mine_xp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Changes to defaults apply only to newly created accounts; existing players are not reset.
ALTER TABLE players ALTER COLUMN balance SET DEFAULT 500;
ALTER TABLE players ALTER COLUMN total_earned SET DEFAULT 500;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pickaxe_tier INTEGER NOT NULL DEFAULT 0 CHECK (pickaxe_tier BETWEEN 0 AND 10);
ALTER TABLE players ADD COLUMN IF NOT EXISTS next_mine_multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (next_mine_multiplier BETWEEN 1 AND 20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS orb_count INTEGER NOT NULL DEFAULT 0 CHECK (orb_count BETWEEN 0 AND 20);
-- Cosmetics stay with the player across servers and prestige. Additive to existing accounts.
ALTER TABLE players ADD COLUMN IF NOT EXISTS pickaxe_name TEXT NOT NULL DEFAULT 'Pickaxe' CHECK (length(pickaxe_name) BETWEEN 1 AND 24);
ALTER TABLE players ADD COLUMN IF NOT EXISTS pickaxe_style TEXT NOT NULL DEFAULT 'Copper' CHECK (pickaxe_style IN ('Copper','Obsidian','Astral'));
-- Extend the original cosmetic enum without changing saved skins.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_pickaxe_style_check;
ALTER TABLE players ADD CONSTRAINT players_pickaxe_style_check
  CHECK (pickaxe_style IN ('Copper','Obsidian','Astral','I Skin','I Skin II','Demon Skin'));
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_tag TEXT NOT NULL DEFAULT '' CHECK (length(profile_tag) <= 24);
-- Coffee-style charged mining buffs: persistent per user across Discord servers.
ALTER TABLE players ADD COLUMN IF NOT EXISTS mine_boost_multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (mine_boost_multiplier BETWEEN 1 AND 4);
ALTER TABLE players ADD COLUMN IF NOT EXISTS mine_boost_charges INTEGER NOT NULL DEFAULT 0 CHECK (mine_boost_charges BETWEEN 0 AND 6);
ALTER TABLE players ADD COLUMN IF NOT EXISTS mine_boost_source TEXT NOT NULL DEFAULT '' CHECK (length(mine_boost_source) <= 64);
ALTER TABLE players ADD COLUMN IF NOT EXISTS next_mine_source TEXT NOT NULL DEFAULT '' CHECK (length(next_mine_source) <= 64);


CREATE TABLE IF NOT EXISTS player_generators (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  generator_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (user_id, generator_id)
);
CREATE TABLE IF NOT EXISTS inventory (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS player_perks (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  perk_id TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  PRIMARY KEY (user_id, perk_id)
);
CREATE TABLE IF NOT EXISTS market_listings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES players(user_id),
  buyer_id TEXT REFERENCES players(user_id),
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS market_active_idx ON market_listings(created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS market_seller_idx ON market_listings(seller_id, status);
CREATE TABLE IF NOT EXISTS economy_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES players(user_id),
  event_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS economy_events_user_idx ON economy_events(user_id, created_at DESC);

-- Season Journey: permanent claims and per-UTC-day XP caps; migrations are additive.
CREATE TABLE IF NOT EXISTS season_progress (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  PRIMARY KEY(user_id, season_id)
);
CREATE TABLE IF NOT EXISTS season_xp_daily (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  day DATE NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  PRIMARY KEY(user_id, season_id, day)
);
CREATE TABLE IF NOT EXISTS season_claims (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 20),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, season_id, tier)
);
CREATE INDEX IF NOT EXISTS season_claims_owner_idx ON season_claims(user_id,season_id);

-- Per-player UI preferences are shared across Discord clients and PM2 restarts.
CREATE TABLE IF NOT EXISTS player_ui_preferences (
  user_id TEXT PRIMARY KEY REFERENCES players(user_id) ON DELETE CASCADE,
  shop_filter TEXT NOT NULL DEFAULT 'all' CHECK (shop_filter IN ('all','affordable','owned')),
  shop_sort TEXT NOT NULL DEFAULT 'price' CHECK (shop_sort IN ('price','income')),
  inventory_filter TEXT NOT NULL DEFAULT 'all' CHECK (inventory_filter IN ('all','materials','usable','caches')),
  inventory_sort TEXT NOT NULL DEFAULT 'rarity' CHECK (inventory_sort IN ('rarity','name','quantity')),
  forge_filter TEXT NOT NULL DEFAULT 'all' CHECK (forge_filter IN ('all','ready')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_claims (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('daily','weekly')),
  period_key TEXT NOT NULL CHECK (period_key ~ '^[0-9]{8}$'),
  challenge_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,scope,period_key,challenge_id)
);

-- Exploration uses separate additive tables: prestige does not reset world progress or gear.
CREATE TABLE IF NOT EXISTS exploration_progress (
  user_id TEXT PRIMARY KEY REFERENCES players(user_id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp BETWEEN 0 AND 1000000000)
);
CREATE TABLE IF NOT EXISTS expedition_equipment (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  gear_id TEXT NOT NULL CHECK (gear_id IN ('kit','compass','ward')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, gear_id)
);
CREATE TABLE IF NOT EXISTS expedition_missions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  region_id TEXT NOT NULL CHECK (region_id IN ('forest','mines','ruins')),
  started_at TIMESTAMPTZ NOT NULL,
  finishes_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','setback')),
  reward_ic NUMERIC NOT NULL CHECK (reward_ic >= 0),
  reward_xp INTEGER NOT NULL CHECK (reward_xp > 0),
  reward_item_id TEXT NOT NULL,
  reward_quantity INTEGER NOT NULL CHECK (reward_quantity BETWEEN 1 AND 1000),
  CHECK (finishes_at > started_at)
);
-- One unclaimed mission per player, including missions waiting for collection.
CREATE UNIQUE INDEX IF NOT EXISTS expedition_missions_active ON expedition_missions(user_id) WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS expedition_missions_recent ON expedition_missions(user_id, id DESC);

-- Companions are a separate collection and are not wiped by prestige.
CREATE TABLE IF NOT EXISTS player_companions (
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL CHECK(pet_id IN ('ember_fox','moss_wisp','moon_owl','cave_ferret','iron_cub','clockwork_sparrow','trail_sprite','zephyr_finch','ash_wolf','nest_fox','tempest_roc','gem_serpent','void_moth','rune_gecko','phoenix_drake','runebound_golem','star_stag','hatchling_drake')),
  xp BIGINT NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 43500),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,pet_id)
);
CREATE TABLE IF NOT EXISTS companion_settings (
  user_id TEXT PRIMARY KEY REFERENCES players(user_id) ON DELETE CASCADE,
  starter_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  active_pet_id TEXT CHECK(active_pet_id IN ('ember_fox','moss_wisp','moon_owl','cave_ferret','iron_cub','clockwork_sparrow','trail_sprite','zephyr_finch','ash_wolf','nest_fox','tempest_roc','gem_serpent','void_moth','rune_gecko','phoenix_drake','runebound_golem','star_stag','hatchling_drake'))
);
-- Extend legacy CHECK constraints for existing accounts without deleting any companion records.
ALTER TABLE player_companions DROP CONSTRAINT IF EXISTS player_companions_pet_id_check;
ALTER TABLE player_companions ADD CONSTRAINT player_companions_pet_id_check CHECK(pet_id IN ('ember_fox','moss_wisp','moon_owl','cave_ferret','iron_cub','clockwork_sparrow','trail_sprite','zephyr_finch','ash_wolf','nest_fox','tempest_roc','gem_serpent','void_moth','rune_gecko','phoenix_drake','runebound_golem','star_stag','hatchling_drake'));
ALTER TABLE companion_settings DROP CONSTRAINT IF EXISTS companion_settings_active_pet_id_check;
ALTER TABLE companion_settings ADD CONSTRAINT companion_settings_active_pet_id_check CHECK(active_pet_id IS NULL OR active_pet_id IN ('ember_fox','moss_wisp','moon_owl','cave_ferret','iron_cub','clockwork_sparrow','trail_sprite','zephyr_finch','ash_wolf','nest_fox','tempest_roc','gem_serpent','void_moth','rune_gecko','phoenix_drake','runebound_golem','star_stag','hatchling_drake'));
ALTER TABLE expedition_missions ADD COLUMN IF NOT EXISTS companion_egg BOOLEAN NOT NULL DEFAULT FALSE;

-- Global weekly bosses are keyed by UTC Monday; never by Discord guild/server.
CREATE TABLE IF NOT EXISTS world_boss_instances (
  period_key TEXT PRIMARY KEY CHECK (period_key ~ '^[0-9]{8}$'),
  boss_id TEXT NOT NULL CHECK (boss_id IN ('hollow_guardian','ashbound_titan','starved_colossus')),
  max_hp INTEGER NOT NULL CHECK (max_hp > 0),
  reward_pool INTEGER NOT NULL CHECK (reward_pool > 0),
  reward_item_id TEXT NOT NULL,
  hp INTEGER NOT NULL CHECK (hp >= 0 AND hp <= max_hp),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  defeated_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS world_boss_contributions (
  period_key TEXT NOT NULL REFERENCES world_boss_instances(period_key) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  total_damage INTEGER NOT NULL DEFAULT 0 CHECK (total_damage >= 0),
  attack_count INTEGER NOT NULL DEFAULT 0 CHECK (attack_count >= 0),
  last_attack_at TIMESTAMPTZ,
  next_attack_at TIMESTAMPTZ,
  owl_bonus_points BIGINT NOT NULL DEFAULT 0 CHECK (owl_bonus_points >= 0),
  claimed_at TIMESTAMPTZ,
  PRIMARY KEY(period_key,user_id)
);
CREATE INDEX IF NOT EXISTS world_boss_contributions_player_idx
  ON world_boss_contributions(user_id,period_key) WHERE claimed_at IS NULL;

-- ARVEE Idle global player guilds: a Discord user has one membership across all servers.
CREATE TABLE IF NOT EXISTS idle_guilds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 26),
  tag TEXT NOT NULL UNIQUE CHECK(tag ~ '^[A-Z0-9]{2,5}$'),
  owner_id TEXT NOT NULL REFERENCES players(user_id),
  xp BIGINT NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 1000000000000),
  renown BIGINT NOT NULL DEFAULT 0 CHECK(renown BETWEEN 0 AND 1000000000000),
  hall_tier INTEGER NOT NULL DEFAULT 0 CHECK(hall_tier BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idle_guilds_name_ci ON idle_guilds(lower(name));
CREATE TABLE IF NOT EXISTS idle_guild_members (
  user_id TEXT PRIMARY KEY REFERENCES players(user_id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('leader','officer','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idle_guild_members_by_guild ON idle_guild_members(guild_id,role);
CREATE UNIQUE INDEX IF NOT EXISTS idle_guild_one_leader ON idle_guild_members(guild_id) WHERE role='leader';
CREATE TABLE IF NOT EXISTS idle_guild_invites (
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(guild_id,invitee_id),
  CHECK(invitee_id ~ '^[0-9]{15,22}$')
);
CREATE INDEX IF NOT EXISTS idle_guild_invites_target ON idle_guild_invites(invitee_id,expires_at DESC);
CREATE TABLE IF NOT EXISTS idle_guild_daily_xp (
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  day DATE NOT NULL,
  xp INTEGER NOT NULL CHECK(xp BETWEEN 0 AND 250),
  PRIMARY KEY(guild_id,user_id,day)
);
CREATE TABLE IF NOT EXISTS idle_guild_member_xp (
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  xp BIGINT NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 1000000000000),
  PRIMARY KEY(guild_id,user_id)
);
-- Attribution is snapshotted when each boss strike commits; guild switching cannot rewrite history.
CREATE TABLE IF NOT EXISTS idle_guild_boss_damage (
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL REFERENCES world_boss_instances(period_key) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  damage BIGINT NOT NULL CHECK(damage > 0),
  PRIMARY KEY(guild_id,period_key,user_id)
);
CREATE INDEX IF NOT EXISTS idle_guild_boss_rankings ON idle_guild_boss_damage(period_key,guild_id);

-- Guild Expeditions & Leagues: only committed gameplay advances contracts.
-- Per-user season locks and claim receipts intentionally survive guild disbanding.
CREATE TABLE IF NOT EXISTS idle_guild_league_season_members (
  season_key TEXT NOT NULL CHECK(season_key ~ '^[0-9]{8}$'),
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(season_key,user_id)
);
CREATE INDEX IF NOT EXISTS idle_guild_league_members_guild_idx
  ON idle_guild_league_season_members(guild_id,season_key);

CREATE TABLE IF NOT EXISTS idle_guild_expedition_missions (
  guild_id BIGINT NOT NULL REFERENCES idle_guilds(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK(period_key ~ '^[0-9]{8}$'),
  mission_id TEXT NOT NULL CHECK(mission_id IN ('mining_run','frontier_survey','siege_support','supply_line')),
  target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 1000),
  reward_ic INTEGER NOT NULL CHECK(reward_ic BETWEEN 1 AND 10000),
  reward_item_id TEXT NOT NULL,
  reward_quantity INTEGER NOT NULL CHECK(reward_quantity BETWEEN 1 AND 10),
  renown_reward INTEGER NOT NULL CHECK(renown_reward BETWEEN 0 AND 1000),
  league_points INTEGER NOT NULL CHECK(league_points BETWEEN 1 AND 1000),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= target),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(guild_id,period_key,mission_id)
);
CREATE INDEX IF NOT EXISTS idle_guild_expedition_completed_idx
  ON idle_guild_expedition_missions(period_key,completed_at) WHERE completed_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS idle_guild_expedition_contributions (
  guild_id BIGINT NOT NULL,
  period_key TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 1000),
  claimed_at TIMESTAMPTZ,
  PRIMARY KEY(guild_id,period_key,mission_id,user_id),
  FOREIGN KEY(guild_id,period_key,mission_id) REFERENCES idle_guild_expedition_missions(guild_id,period_key,mission_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idle_guild_expedition_claims_idx
  ON idle_guild_expedition_contributions(user_id,claimed_at) WHERE claimed_at IS NULL;
CREATE TABLE IF NOT EXISTS idle_guild_expedition_daily (
  guild_id BIGINT NOT NULL,
  period_key TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  day DATE NOT NULL,
  units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 10),
  PRIMARY KEY(guild_id,period_key,mission_id,user_id,day),
  FOREIGN KEY(guild_id,period_key,mission_id) REFERENCES idle_guild_expedition_missions(guild_id,period_key,mission_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS idle_guild_league_season_claims (
  season_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  guild_id BIGINT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('Bronze','Silver','Gold','Diamond')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(season_key,user_id)
);
