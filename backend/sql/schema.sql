CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'gestor', 'atleta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE team_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE athlete_status AS ENUM ('awaiting_manager', 'awaiting_admin', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE biometry_status AS ENUM ('pending', 'synced', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('proposed', 'confirmed', 'scheduled', 'finished', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  legacy_password_salt text,
  legacy_password_hash text,
  phone text,
  cpf_ciphertext text,
  cpf_hash text,
  totp_secret_ciphertext text,
  consent_at timestamptz,
  consent_version text NOT NULL DEFAULT 'unrecorded',
  consent_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_active_uq ON users (cpf_hash) WHERE cpf_hash IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sessions (
  jti uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  manager_user_id uuid NOT NULL REFERENCES users(id),
  status team_status NOT NULL DEFAULT 'pending',
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_category_active_uq
  ON teams (lower(name), category) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teams_manager_active_uq
  ON teams (manager_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS teams_status_created_idx ON teams (status, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS registration_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  registration_type text NOT NULL CHECK (registration_type IN ('team', 'athlete')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_periods_valid_window CHECK (ends_at > starts_at),
  CONSTRAINT registration_periods_category_type_uq UNIQUE (category, registration_type)
);

CREATE OR REPLACE FUNCTION enforce_team_manager_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.manager_user_id AND role = 'gestor' AND status = 'active' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'team manager must be an active gestor' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS teams_manager_role_guard ON teams;
CREATE TRIGGER teams_manager_role_guard
  BEFORE INSERT OR UPDATE OF manager_user_id ON teams
  FOR EACH ROW EXECUTE FUNCTION enforce_team_manager_role();

CREATE TABLE IF NOT EXISTS athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  team_id uuid NOT NULL REFERENCES teams(id),
  manager_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  cpf_ciphertext text,
  cpf_hash text,
  contact_email text,
  birthdate date,
  age_at_registration smallint CHECK (age_at_registration BETWEEN 0 AND 120),
  positions text[] NOT NULL DEFAULT '{}',
  status athlete_status NOT NULL DEFAULT 'awaiting_manager',
  justification text,
  consent_at timestamptz,
  consent_version text NOT NULL DEFAULT 'unrecorded',
  consent_confirmed boolean NOT NULL DEFAULT false,
  biometry_url text,
  biometry_object_key text,
  biometry_status biometry_status NOT NULL DEFAULT 'pending',
  control_id_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT athlete_positions_valid CHECK (
    positions <@ ARRAY['central', 'ponteiro', 'saida', 'levantador', 'libero']::text[]
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS athletes_cpf_team_active_uq
  ON athletes (cpf_hash, team_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS athletes_control_reference_active_uq
  ON athletes (control_id_reference) WHERE control_id_reference IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS athletes_team_status_idx ON athletes (team_id, status, created_at DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_athlete_team_manager() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.manager_user_id AND role = 'gestor' AND status = 'active' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'athlete manager must be an active gestor' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = NEW.team_id AND manager_user_id = NEW.manager_user_id
      AND status = 'approved' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'athlete team must be approved and belong to the manager' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS athletes_team_manager_guard ON athletes;
CREATE TRIGGER athletes_team_manager_guard
  BEFORE INSERT OR UPDATE OF team_id, manager_user_id ON athletes
  FOR EACH ROW EXECUTE FUNCTION enforce_athlete_team_manager();

CREATE OR REPLACE FUNCTION enforce_athlete_account_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.user_id AND role = 'atleta' AND status = 'active' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'athlete account must have the atleta role' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS athletes_account_role_guard ON athletes;
CREATE TRIGGER athletes_account_role_guard
  BEFORE INSERT OR UPDATE OF user_id ON athletes
  FOR EACH ROW EXECUTE FUNCTION enforce_athlete_account_role();

CREATE TABLE IF NOT EXISTS athlete_positions (
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('central', 'ponteiro', 'saida', 'levantador', 'libero')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, position)
);

CREATE TABLE IF NOT EXISTS game_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  available_at timestamptz NOT NULL,
  venue text NOT NULL DEFAULT '',
  category text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS game_dates_category_time_idx ON game_dates (category, available_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_date_id uuid REFERENCES game_dates(id),
  category text NOT NULL,
  round text NOT NULL DEFAULT '',
  home_team_id uuid NOT NULL REFERENCES teams(id),
  away_team_id uuid NOT NULL REFERENCES teams(id),
  home_name text NOT NULL,
  away_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  venue text NOT NULL DEFAULT '',
  status match_status NOT NULL DEFAULT 'proposed',
  home_accepted_at timestamptz,
  away_accepted_at timestamptz,
  sets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT matches_distinct_teams CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS matches_category_time_idx ON matches (category, scheduled_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id),
  match_id uuid REFERENCES matches(id),
  team_id uuid NOT NULL REFERENCES teams(id),
  attendance_date date NOT NULL,
  present boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'turnstile')),
  source_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_athlete_match_active_uq
  ON attendance (athlete_id, match_id) WHERE match_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_athlete_day_active_uq
  ON attendance (athlete_id, attendance_date) WHERE match_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_source_event_uq
  ON attendance (source_event_id) WHERE source_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rules (
  id text PRIMARY KEY DEFAULT 'league_rules',
  points jsonb NOT NULL DEFAULT '{"win_3_0":3,"win_3_1":3,"win_3_2":2,"loss_3_2":1,"loss_3_1":0,"loss_3_0":0}'::jsonb,
  tiebreakers jsonb NOT NULL DEFAULT '["points","wins","sets_ratio","points_ratio"]'::jsonb,
  min_attendance_percent numeric(5,2) NOT NULL DEFAULT 70 CHECK (min_attendance_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rules (id) VALUES ('league_rules') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_target_created_idx ON notifications (target, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  recipient text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_unpublished_idx ON outbox_events (created_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_imports (
  source text PRIMARY KEY,
  document_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  tier text NOT NULL DEFAULT 'apoio',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS sumulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  category text NOT NULL,
  match_date date NOT NULL,
  filename text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

INSERT INTO sponsors (name, logo_url, website, tier)
SELECT seed.name, '', seed.website, seed.tier
FROM (VALUES
  ('Jundiaí Esportes', 'https://example.com', 'ouro'),
  ('Rede Vôlei Sports', 'https://example.com', 'prata'),
  ('Academia PowerFit', 'https://example.com', 'bronze'),
  ('Padaria do Centro', 'https://example.com', 'apoio')
) AS seed(name, website, tier)
WHERE NOT EXISTS (SELECT 1 FROM sponsors);
