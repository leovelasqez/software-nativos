CREATE TABLE catalog_products (
 id text PRIMARY KEY, reference text NOT NULL, kind text NOT NULL CHECK(kind IN ('finished','prepared')),
 current_version integer NOT NULL, active_recipe_version integer
);
CREATE UNIQUE INDEX catalog_reference_unique ON catalog_products(lower(reference));
CREATE TABLE product_versions (
 product_id text NOT NULL REFERENCES catalog_products(id), version integer NOT NULL,
 data jsonb NOT NULL, PRIMARY KEY(product_id,version)
);
CREATE TABLE inventory_items (
 id text PRIMARY KEY, name text NOT NULL, reference text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('raw','consumable','finished')),
 base_unit text NOT NULL CHECK(base_unit IN ('g','ml','unit'))
);
CREATE UNIQUE INDEX item_reference_unique ON inventory_items(lower(reference));
CREATE TABLE recipe_versions (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES catalog_products(id), version integer NOT NULL,
 data jsonb NOT NULL, UNIQUE(product_id,version)
);
CREATE TABLE inventory_movements (
 id text PRIMARY KEY, item_id text NOT NULL REFERENCES inventory_items(id), warehouse_id text NOT NULL REFERENCES warehouses(id),
 kind text NOT NULL CHECK(kind IN ('initial','reversal')), quantity numeric(30,6) NOT NULL,
 unit_cost numeric(30,6), entry jsonb, reverses_id text UNIQUE REFERENCES inventory_movements(id), reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='initial' AND quantity>=0 AND reverses_id IS NULL) OR (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL)),
 CHECK(unit_cost IS NULL OR unit_cost>=0)
);
CREATE INDEX inventory_by_warehouse ON inventory_movements(warehouse_id,item_id);
CREATE TABLE inventory_minimums (
 warehouse_id text NOT NULL REFERENCES warehouses(id), item_id text NOT NULL REFERENCES inventory_items(id),
 minimum numeric(30,6) NOT NULL CHECK(minimum>=0), PRIMARY KEY(warehouse_id,item_id)
);
CREATE TABLE catalog_operations (
 id text PRIMARY KEY, actor_id text NOT NULL REFERENCES app_users(id), fingerprint text NOT NULL, response jsonb NOT NULL
);
CREATE FUNCTION protect_catalog_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'history_is_append_only'; END $$;
CREATE TRIGGER product_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON product_versions FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER recipe_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON recipe_versions FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER movement_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON inventory_movements FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER operation_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON catalog_operations FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
