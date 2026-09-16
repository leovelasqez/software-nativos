CREATE TABLE inventory_transfers (
 id text PRIMARY KEY, source_warehouse_id text NOT NULL REFERENCES warehouses(id), target_warehouse_id text NOT NULL REFERENCES warehouses(id),
 actor_id text NOT NULL REFERENCES app_users(id), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source_warehouse_id<>target_warehouse_id)
);
CREATE TABLE inventory_transfer_lines (
 id text PRIMARY KEY, transfer_id text NOT NULL REFERENCES inventory_transfers(id), item_id text NOT NULL REFERENCES inventory_items(id),
 base_quantity numeric(30,6) NOT NULL CHECK(base_quantity>0), entry jsonb NOT NULL
);
CREATE TABLE inventory_transfer_events (
 id text PRIMARY KEY, transfer_id text NOT NULL REFERENCES inventory_transfers(id), kind text NOT NULL CHECK(kind IN ('dispatch','receipt')),
 actor_id text NOT NULL REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_transfer_one_dispatch ON inventory_transfer_events(transfer_id) WHERE kind='dispatch';
CREATE TABLE inventory_transfer_event_lines (
 event_id text NOT NULL REFERENCES inventory_transfer_events(id), line_id text NOT NULL REFERENCES inventory_transfer_lines(id),
 base_quantity numeric(30,6) NOT NULL CHECK(base_quantity>0), PRIMARY KEY(event_id,line_id)
);
ALTER TABLE inventory_movements ADD COLUMN transfer_event_id text REFERENCES inventory_transfer_events(id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v6;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v7 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL) OR
 (kind='purchase' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NOT NULL AND transfer_event_id IS NULL) OR
 (kind='transfer_dispatch' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL) OR
 (kind='transfer_receipt' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL)
);
CREATE TRIGGER transfer_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_transfers FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER transfer_line_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_transfer_lines FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER transfer_event_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_transfer_events FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER transfer_event_line_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_transfer_event_lines FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
