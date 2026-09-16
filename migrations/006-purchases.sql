CREATE TABLE suppliers (
 id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id), data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX suppliers_by_branch ON suppliers(branch_id,id);
CREATE TABLE purchases (
 id text PRIMARY KEY, branch_id text NOT NULL REFERENCES branches(id), warehouse_id text NOT NULL REFERENCES warehouses(id),
 supplier_id text NOT NULL REFERENCES suppliers(id), actor_id text NOT NULL REFERENCES app_users(id),
 paid_amount numeric(30,6) NOT NULL CHECK(paid_amount>=0), payment_method text NOT NULL,
 purchased_on date NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchases_by_branch ON purchases(branch_id,id);
CREATE TABLE purchase_lines (
 id text PRIMARY KEY, purchase_id text NOT NULL REFERENCES purchases(id), item_id text NOT NULL REFERENCES inventory_items(id),
 quantity numeric(30,6) NOT NULL CHECK(quantity>0), base_quantity numeric(30,6) NOT NULL CHECK(base_quantity>0),
 unit text NOT NULL, conversion jsonb, unit_price numeric(30,6) NOT NULL CHECK(unit_price>=0), line_total numeric(30,6) NOT NULL CHECK(line_total>=0)
);
CREATE INDEX purchase_lines_by_purchase ON purchase_lines(purchase_id);
ALTER TABLE inventory_movements ADD COLUMN purchase_id text REFERENCES purchases(id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v4;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v6 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL AND purchase_id IS NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL AND purchase_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL AND purchase_id IS NULL) OR
 (kind='purchase' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NOT NULL)
);
CREATE TRIGGER supplier_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON suppliers FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER purchase_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON purchases FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER purchase_line_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON purchase_lines FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
