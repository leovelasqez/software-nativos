CREATE TABLE notification_intents (
 id text PRIMARY KEY, dedupe_key text NOT NULL UNIQUE,
 type text NOT NULL CHECK(type IN ('low_stock_daily','shift_closed')),
 branch_id text NOT NULL REFERENCES branches(id), causal_id text NOT NULL,
 recipient_role text NOT NULL CHECK(recipient_role IN ('owner','branch_manager')),
 state text NOT NULL CHECK(state IN ('pending','sending','delivered','failed_retryable','failed_terminal','uncertain')),
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_intents_branch_state ON notification_intents(branch_id,state,id);
CREATE TABLE notification_attempts (
 id text PRIMARY KEY, intent_id text NOT NULL REFERENCES notification_intents(id),
 outcome text NOT NULL CHECK(outcome IN ('delivered','retryable','terminal','uncertain')),
 provider_message_id text, safe_error text, started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL,
 CHECK(length(coalesce(safe_error,'')) <= 500)
);
CREATE INDEX notification_attempts_intent ON notification_attempts(intent_id,finished_at,id);
CREATE TABLE notification_operations (id text PRIMARY KEY, actor_id text NOT NULL REFERENCES app_users(id), fingerprint text NOT NULL, response jsonb NOT NULL);
CREATE TRIGGER notification_attempts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON notification_attempts FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TRIGGER notification_operations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON notification_operations FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
