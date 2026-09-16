CREATE TABLE inventory_internal_consumptions (
 id text PRIMARY KEY, warehouse_id text NOT NULL REFERENCES warehouses(id), actor_id text NOT NULL REFERENCES app_users(id),
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory_internal_consumption_lines (
 id text PRIMARY KEY, consumption_id text NOT NULL REFERENCES inventory_internal_consumptions(id), item_id text NOT NULL REFERENCES inventory_items(id),
 base_quantity numeric(30,6) NOT NULL CHECK(base_quantity>0), entry jsonb NOT NULL
);
ALTER TABLE inventory_movements ADD COLUMN internal_consumption_id text REFERENCES inventory_internal_consumptions(id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v8;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v9 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='purchase' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NOT NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='transfer_dispatch' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='transfer_receipt' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL AND internal_consumption_id IS NULL) OR
 (kind='adjustment_in' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL AND internal_consumption_id IS NULL) OR
 (kind='adjustment_out' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL AND internal_consumption_id IS NULL) OR
 (kind='internal_consumption' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NOT NULL)
);
CREATE TRIGGER internal_consumption_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_internal_consumptions FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER internal_consumption_line_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_internal_consumption_lines FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
