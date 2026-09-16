CREATE TABLE inventory_counts (
 id text PRIMARY KEY, warehouse_id text NOT NULL REFERENCES warehouses(id), actor_id text NOT NULL REFERENCES app_users(id),
 data jsonb NOT NULL, counted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory_count_lines (
 id text PRIMARY KEY, count_id text NOT NULL REFERENCES inventory_counts(id), item_id text NOT NULL REFERENCES inventory_items(id),
 expected_quantity numeric(30,6) NOT NULL, actual_quantity numeric(30,6) NOT NULL, difference numeric(30,6) NOT NULL,
 entry jsonb NOT NULL
);
CREATE INDEX inventory_count_lines_by_count ON inventory_count_lines(count_id);
ALTER TABLE inventory_movements ADD COLUMN count_id text REFERENCES inventory_counts(id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v7;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v8 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='purchase' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NOT NULL AND transfer_event_id IS NULL AND count_id IS NULL) OR
 (kind='transfer_dispatch' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL) OR
 (kind='transfer_receipt' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL) OR
 (kind='adjustment_in' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL) OR
 (kind='adjustment_out' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL)
);
CREATE TRIGGER count_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_counts FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER count_line_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_count_lines FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
