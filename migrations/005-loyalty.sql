CREATE TABLE loyalty_rules(id text PRIMARY KEY,data jsonb NOT NULL);
INSERT INTO loyalty_rules VALUES('initial-v1',jsonb_build_object('id','initial-v1','earnEvery','1000','pointValue','10','maxPercent','20','createdAtMs',floor(extract(epoch FROM clock_timestamp())*1000)::bigint));
CREATE TABLE loyalty_members(customer_id text PRIMARY KEY REFERENCES customers(id),enrolled_at_ms bigint NOT NULL,balance bigint NOT NULL DEFAULT 0);
CREATE TABLE loyalty_ledger(id text PRIMARY KEY,customer_id text NOT NULL REFERENCES loyalty_members(customer_id),sale_id text REFERENCES pos_sales(id),data jsonb NOT NULL);
CREATE TABLE loyalty_cancellations(operation_id text PRIMARY KEY,device_id text NOT NULL REFERENCES devices(id),actor_id text NOT NULL REFERENCES app_users(id));
CREATE TRIGGER loyalty_rule_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON loyalty_rules FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER loyalty_ledger_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON loyalty_ledger FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
