-- Fresh PostgreSQL schema for Coffee v1. No MongoDB migration is performed.
CREATE TABLE IF NOT EXISTS players (
  user_id TEXT PRIMARY KEY CHECK (user_id ~ '^[0-9]{15,22}$'),
  balance NUMERIC NOT NULL DEFAULT 10 CHECK (balance >= 0),
  total_earned NUMERIC NOT NULL DEFAULT 10 CHECK (total_earned >= 0),
  prestige INTEGER NOT NULL DEFAULT 0 CHECK (prestige >= 0),
  last_settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_mine_at TIMESTAMPTZ,
  last_daily_at TIMESTAMPTZ,
  mine_xp INTEGER NOT NULL DEFAULT 0 CHECK (mine_xp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
