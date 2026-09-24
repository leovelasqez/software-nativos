-- Preserve every existing token/cursor; an additional browser gets its own stream.
ALTER TABLE pos_receipts ADD COLUMN installation_id text;
ALTER TABLE pos_receipts DISABLE TRIGGER pos_receipt_immutable;
UPDATE pos_receipts r SET installation_id=t.installation_id FROM pos_terminals t WHERE t.device_id=r.device_id;
ALTER TABLE pos_receipts ENABLE TRIGGER pos_receipt_immutable;
ALTER TABLE pos_receipts ALTER COLUMN installation_id SET NOT NULL;
ALTER TABLE pos_receipts DROP CONSTRAINT pos_receipts_device_id_sequence_key;
ALTER TABLE pos_receipts ADD UNIQUE(device_id,installation_id,sequence);

ALTER TABLE pos_shifts ADD COLUMN installation_id text;
UPDATE pos_shifts s SET installation_id=t.installation_id FROM pos_terminals t WHERE t.device_id=s.device_id;
-- Nullable only for old imported/reporting shifts that never had a terminal.
ALTER TABLE pos_terminals DROP CONSTRAINT pos_terminals_pkey;
ALTER TABLE pos_terminals ADD PRIMARY KEY(device_id,installation_id);
CREATE UNIQUE INDEX pos_terminal_token ON pos_terminals(device_id,token_hash);
