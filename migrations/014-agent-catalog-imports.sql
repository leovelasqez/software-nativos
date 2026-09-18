CREATE TABLE agent_catalog_imports (
 id text PRIMARY KEY,
 operation_id text NOT NULL UNIQUE,
 actor_id text NOT NULL REFERENCES app_users(id),
 branch_id text NOT NULL REFERENCES branches(id),
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_catalog_imports_branch ON agent_catalog_imports(branch_id,id);
CREATE TRIGGER agent_catalog_import_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON agent_catalog_imports FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
