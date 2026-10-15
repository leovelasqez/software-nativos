ALTER TABLE notification_intents ADD COLUMN mode text NOT NULL DEFAULT 'legacy' CHECK (mode IN ('legacy','preview','live'));
ALTER TABLE notification_intents DROP CONSTRAINT notification_intents_state_check;
ALTER TABLE notification_intents ADD CONSTRAINT notification_intents_state_check CHECK (state IN ('pending','sending','accepted','sent','delivered','read','failed_retryable','failed_terminal','uncertain'));
ALTER TABLE notification_intents ADD COLUMN delivery_id text;
ALTER TABLE notification_intents ADD COLUMN delivery_config_hash text;
ALTER TABLE notification_intents ADD COLUMN provider_message_id text;
ALTER TABLE notification_intents ADD COLUMN claimed_at timestamptz;
ALTER TABLE notification_intents ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE notification_intents ADD COLUMN attempt_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX notification_provider_message ON notification_intents(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX notification_dispatch ON notification_intents(mode,state,next_attempt_at);
ALTER TABLE notification_attempts DROP CONSTRAINT notification_attempts_outcome_check;
ALTER TABLE notification_attempts ADD CONSTRAINT notification_attempts_outcome_check CHECK (outcome IN ('delivered','accepted','retryable','terminal','uncertain'));
CREATE TABLE notification_delivery_events (
 id text PRIMARY KEY, intent_id text NOT NULL REFERENCES notification_intents(id),
 delivery_id text NOT NULL, provider_message_id text, status text NOT NULL,
 safe_code text, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER notification_delivery_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON notification_delivery_events FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TABLE notification_daily_runs (report_date date PRIMARY KEY, low_stock_rows integer NOT NULL CHECK(low_stock_rows>=0), evaluated_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER notification_daily_runs_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON notification_daily_runs FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE FUNCTION protect_notification_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
 OR NEW.type IS DISTINCT FROM OLD.type OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
 OR NEW.causal_id IS DISTINCT FROM OLD.causal_id OR NEW.recipient_role IS DISTINCT FROM OLD.recipient_role
 OR NEW.data IS DISTINCT FROM OLD.data OR NEW.mode IS DISTINCT FROM OLD.mode
 OR NEW.delivery_config_hash IS DISTINCT FROM OLD.delivery_config_hash
 OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'notification_content_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_content_immutable BEFORE UPDATE ON notification_intents FOR EACH ROW EXECUTE FUNCTION protect_notification_content();
