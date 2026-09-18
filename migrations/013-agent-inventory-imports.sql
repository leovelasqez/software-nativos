CREATE TABLE agent_inventory_imports (
  id text PRIMARY KEY,
  operation_id text NOT NULL UNIQUE,
  actor_id text NOT NULL REFERENCES app_users(id),
  branch_id text NOT NULL REFERENCES branches(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_inventory_imports_branch ON agent_inventory_imports(branch_id,id);
ALTER TABLE inventory_movements ADD COLUMN agent_import_id text REFERENCES agent_inventory_imports(id);
ALTER TABLE inventory_movements DROP CONSTRAINT movement_shape_v9;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_shape_v10 CHECK(
 (kind='initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='reversal' AND quantity<=0 AND reverses_id IS NOT NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='sale' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='waste' AND quantity<=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='refund' AND quantity>=0 AND reverses_id IS NULL AND event_id IS NOT NULL AND sale_id IS NOT NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='purchase' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NOT NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='transfer_dispatch' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='transfer_receipt' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NOT NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='adjustment_in' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='adjustment_out' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NOT NULL AND internal_consumption_id IS NULL AND agent_import_id IS NULL) OR
 (kind='internal_consumption' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NOT NULL AND agent_import_id IS NULL) OR
 (kind='import_initial' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NOT NULL) OR
 (kind='import_entry' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NOT NULL) OR
 (kind='import_adjustment_in' AND quantity>=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NOT NULL) OR
 (kind='import_adjustment_out' AND quantity<=0 AND reverses_id IS NULL AND sale_id IS NULL AND event_id IS NULL AND purchase_id IS NULL AND transfer_event_id IS NULL AND count_id IS NULL AND internal_consumption_id IS NULL AND agent_import_id IS NOT NULL)
);
CREATE TRIGGER agent_inventory_import_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON agent_inventory_imports FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
