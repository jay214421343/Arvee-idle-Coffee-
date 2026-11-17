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
