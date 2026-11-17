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
