CREATE TABLE excel_catalog_imports (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES app_users(id),
  branch_id text NOT NULL REFERENCES branches(id),
  file_name text NOT NULL,
  reason text NOT NULL,
  data jsonb NOT NULL,
  inventory_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
CREATE INDEX excel_catalog_import_expiry ON excel_catalog_imports(expires_at) WHERE response IS NULL;
