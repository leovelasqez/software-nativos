-- Una instalación de navegador puede operar perfiles independientes de varias cajas.
-- La secuencia e idempotencia siguen siendo exclusivas de cada device_id.
ALTER TABLE pos_terminals DROP CONSTRAINT pos_terminals_installation_id_key;

