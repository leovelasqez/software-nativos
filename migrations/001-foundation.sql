CREATE TABLE branches (id text PRIMARY KEY, name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 100));
CREATE TABLE warehouses (
  id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id), name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false, UNIQUE(branch_id,name)
);
CREATE UNIQUE INDEX one_default_warehouse ON warehouses(branch_id) WHERE is_default;
CREATE TABLE devices (
  id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id), name text NOT NULL,
  active boolean NOT NULL DEFAULT true, printer_model text, UNIQUE(branch_id,name)
);
CREATE UNIQUE INDEX one_active_register ON devices(branch_id) WHERE active;
CREATE TABLE app_users (
  id text PRIMARY KEY, name text NOT NULL, login text NOT NULL UNIQUE,
  password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('owner','manager','cashier')),
  active boolean NOT NULL DEFAULT true, branch_ids text[] NOT NULL CHECK (cardinality(branch_ids)>0),
  actions text[] NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role='owner' OR NOT (actions && ARRAY['cost.read','cost.write','loyalty.adjust']))
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES app_users(id),
  device_id text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE login_attempts (login text PRIMARY KEY, failures integer NOT NULL, blocked_until timestamptz);
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL, actor_kind text NOT NULL CHECK (actor_kind IN ('human','agent')),
  device_id text NOT NULL, branch_id text REFERENCES branches(id), scope_branch_ids text[] NOT NULL,
  operation_id text NOT NULL UNIQUE, action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL, changes jsonb NOT NULL
);
CREATE INDEX audit_scope ON audit_events USING gin(scope_branch_ids);
CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_is_append_only'; END $$;
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_audit();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION immutable_audit();

INSERT INTO branches VALUES ('milan','Milán'),('centro','Centro');
INSERT INTO warehouses VALUES ('milan-venta','milan','Bodega de venta',true),('centro-venta','centro','Bodega de venta',true);
INSERT INTO devices VALUES ('milan-caja','milan','Caja Milán',true,'T80A'),('centro-caja','centro','Caja Centro',true,'T82E');
