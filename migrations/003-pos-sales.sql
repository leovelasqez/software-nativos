CREATE TABLE pos_signing_key (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), private_key text NOT NULL, public_key text NOT NULL);
CREATE TABLE pos_terminals (
 device_id text PRIMARY KEY REFERENCES devices(id), installation_id text NOT NULL UNIQUE, token_hash text NOT NULL,
 active boolean NOT NULL DEFAULT true, last_sequence bigint NOT NULL DEFAULT 0, last_operation_id text, last_sync_at timestamptz
);
CREATE TABLE pos_snapshots (id text PRIMARY KEY, device_id text NOT NULL REFERENCES devices(id), data jsonb NOT NULL);
CREATE TABLE pos_shifts (
 id text PRIMARY KEY, device_id text NOT NULL REFERENCES devices(id), branch_id text NOT NULL REFERENCES branches(id),
 actor_id text NOT NULL REFERENCES app_users(id), opening_cash numeric(30,6) NOT NULL, opened_at timestamptz NOT NULL,
 closed_at timestamptz, counted numeric(30,6), expected numeric(30,6), difference numeric(30,6)
);
CREATE UNIQUE INDEX pos_one_open_shift ON pos_shifts(device_id) WHERE closed_at IS NULL;
CREATE TABLE pos_sales (
 id text PRIMARY KEY, order_id text NOT NULL UNIQUE, shift_id text NOT NULL REFERENCES pos_shifts(id),
 device_id text NOT NULL REFERENCES devices(id), branch_id text NOT NULL REFERENCES branches(id),
 actor_id text NOT NULL REFERENCES app_users(id), receipt_number text NOT NULL UNIQUE, data jsonb NOT NULL,
 cash_applied numeric(30,6) NOT NULL, occurred_at timestamptz NOT NULL, review_required boolean NOT NULL
);
CREATE TABLE pos_receipts (
 operation_id text PRIMARY KEY, device_id text NOT NULL REFERENCES devices(id), sequence bigint NOT NULL,
 fingerprint text NOT NULL, response jsonb NOT NULL, UNIQUE(device_id,sequence)
);
ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_kind_check;
ALTER TABLE inventory_movements DROP CONSTRAINT inventory_movements_check;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_kind_v3 CHECK(kind IN ('initial','reversal','sale'));
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v3 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL)
);
ALTER TABLE inventory_movements ADD COLUMN sale_id text REFERENCES pos_sales(id);
ALTER TABLE inventory_movements ADD CONSTRAINT sale_reference_required CHECK((kind='sale')=(sale_id IS NOT NULL));
CREATE TRIGGER pos_sale_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_sales FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER pos_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_receipts FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER pos_snapshot_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_snapshots FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
