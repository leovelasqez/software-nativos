-- A cash movement can be reversed exactly once.  The application validates this
-- for a clear response; this index remains the final integrity boundary.
CREATE UNIQUE INDEX pos_cash_movement_single_correction
  ON pos_cash_movements(reverses_id)
  WHERE reverses_id IS NOT NULL;
