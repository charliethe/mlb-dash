export const DATABASE_SCHEMA = `
-- MLB Research Command Center Schema

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  team_name TEXT,
  location_name TEXT,
  league TEXT,
  division TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  primary_position TEXT,
  bats TEXT,
  throws TEXT,
  current_team_id INTEGER REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games
CREATE TABLE IF NOT EXISTS games (
  game_pk INTEGER PRIMARY KEY,
  game_date DATE NOT NULL,
  status TEXT NOT NULL,
  detailed_status TEXT,
  away_team_id INTEGER REFERENCES teams(id),
  home_team_id INTEGER REFERENCES teams(id),
  away_score INTEGER,
  home_score INTEGER,
  venue TEXT,
  double_header TEXT,
  game_type TEXT,
  away_probable_pitcher_id INTEGER REFERENCES players(id),
  home_probable_pitcher_id INTEGER REFERENCES players(id),
  away_probable_pitcher_name TEXT,
  home_probable_pitcher_name TEXT,
  away_league_record_wins INTEGER,
  away_league_record_losses INTEGER,
  home_league_record_wins INTEGER,
  home_league_record_losses INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rosters
CREATE TABLE IF NOT EXISTS rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER REFERENCES teams(id),
  season TEXT NOT NULL,
  player_id INTEGER REFERENCES players(id),
  full_name TEXT NOT NULL,
  position TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  jersey_number TEXT,
  bats TEXT,
  throws TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season, player_id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  player_id INTEGER REFERENCES players(id),
  type TEXT NOT NULL,
  description TEXT,
  from_team TEXT,
  to_team TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  duplicate_key TEXT UNIQUE
);

-- News Items
CREATE TABLE IF NOT EXISTS news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  team_id INTEGER REFERENCES teams(id),
  team_abbreviation TEXT,
  players_mentioned TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  importance TEXT NOT NULL DEFAULT 'low',
  published_at TIMESTAMPTZ,
  summary TEXT,
  duplicate_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lineups
CREATE TABLE IF NOT EXISTS lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_pk INTEGER REFERENCES games(game_pk),
  team_id INTEGER REFERENCES teams(id),
  is_confirmed BOOLEAN DEFAULT FALSE,
  batting_order JSONB,
  missing_starters TEXT[] DEFAULT '{}',
  catcher_rest_day BOOLEAN DEFAULT FALSE,
  lineup_strength TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_pk, team_id)
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER REFERENCES players(id),
  player_name TEXT NOT NULL,
  team_abbreviation TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id)
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  team_abbreviation TEXT,
  player_id INTEGER REFERENCES players(id),
  player_name TEXT,
  title TEXT NOT NULL,
  importance TEXT NOT NULL,
  reason TEXT,
  source_url TEXT,
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  source_url TEXT,
  importance TEXT NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Research Notes
CREATE TABLE IF NOT EXISTS research_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  team_ids INTEGER[] DEFAULT '{}',
  player_ids INTEGER[] DEFAULT '{}',
  source_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_team ON transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_items(category);
CREATE INDEX IF NOT EXISTS idx_news_team ON news_items(team_id);
CREATE INDEX IF NOT EXISTS idx_news_duplicate ON news_items(duplicate_key);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_importance ON alerts(importance);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read_status);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_roster_team ON rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_lineups_game ON lineups(game_pk);
`
