ALTER TABLE app_users ADD COLUMN kind text NOT NULL DEFAULT 'human' CHECK(kind IN ('human','agent'));
CREATE TABLE agent_credentials (
  user_id text PRIMARY KEY REFERENCES app_users(id),
  token_hash text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_credentials_active ON agent_credentials(token_hash) WHERE active;
