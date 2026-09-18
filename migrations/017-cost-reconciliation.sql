CREATE TABLE inventory_cost_reconciliations (
 id text PRIMARY KEY,
 warehouse_id text NOT NULL REFERENCES warehouses(id),
 item_id text NOT NULL REFERENCES inventory_items(id),
 actor_id text NOT NULL REFERENCES app_users(id),
 unit_cost numeric(30,6) NOT NULL CHECK(unit_cost>=0),
 effective_from date NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason))>=3),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_cost_reconciliations_current ON inventory_cost_reconciliations(warehouse_id,item_id,effective_from DESC,created_at DESC,id DESC);
CREATE TRIGGER inventory_cost_reconciliations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_cost_reconciliations FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
