ALTER TABLE catalog_products ADD COLUMN archived_at timestamptz;
ALTER TABLE inventory_items ADD COLUMN archived_at timestamptz;
CREATE INDEX catalog_products_operational ON catalog_products(id) WHERE archived_at IS NULL;
CREATE INDEX inventory_items_operational ON inventory_items(id) WHERE archived_at IS NULL;
