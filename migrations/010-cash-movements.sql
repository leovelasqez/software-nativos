CREATE TABLE pos_cash_movements (
 id text PRIMARY KEY,
 shift_id text NOT NULL REFERENCES pos_shifts(id),
 device_id text NOT NULL REFERENCES devices(id),
 branch_id text NOT NULL REFERENCES branches(id),
 actor_id text NOT NULL REFERENCES app_users(id),
 class text NOT NULL CHECK(class IN ('income','expense','withdrawal','correction')),
 payment_method text NOT NULL CHECK(payment_method IN ('cash','card','transfer','breb','daviplata','nequi')),
 amount numeric(30,6) NOT NULL CHECK(amount > 0),
 cash_delta numeric(30,6) NOT NULL,
 reverses_id text REFERENCES pos_cash_movements(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 500),
 occurred_at timestamptz NOT NULL,
 data jsonb NOT NULL
);
CREATE INDEX pos_cash_movements_shift ON pos_cash_movements(shift_id,occurred_at,id);
CREATE TRIGGER pos_cash_movement_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON pos_cash_movements FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
