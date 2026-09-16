CREATE TABLE customers (id text PRIMARY KEY, document_key text NOT NULL UNIQUE, data jsonb NOT NULL);
CREATE TABLE pos_orders_v2 (id text PRIMARY KEY, device_id text NOT NULL REFERENCES devices(id), actor_id text NOT NULL REFERENCES app_users(id), data jsonb NOT NULL);
CREATE TABLE pos_order_events (id text PRIMARY KEY, device_id text NOT NULL REFERENCES devices(id), actor_id text NOT NULL REFERENCES app_users(id), data jsonb NOT NULL);
CREATE TABLE pos_refunds (id text PRIMARY KEY, sale_id text NOT NULL REFERENCES pos_sales(id), shift_id text NOT NULL REFERENCES pos_shifts(id), data jsonb NOT NULL, cash_applied numeric(30,6) NOT NULL);
ALTER TABLE pos_sales DROP CONSTRAINT pos_sales_order_id_key;
CREATE INDEX pos_sales_order ON pos_sales(order_id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_kind_v3;
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v3;
ALTER TABLE inventory_movements DROP CONSTRAINT sale_reference_required;
ALTER TABLE inventory_movements ADD COLUMN event_id text REFERENCES pos_order_events(id);
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v4 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL)
);
CREATE TRIGGER order_event_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_order_events FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER refund_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_refunds FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
