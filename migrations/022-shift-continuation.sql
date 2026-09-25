-- Keep the original terminal, commercial shift, opening cash and history intact.
ALTER TABLE pos_shifts ADD COLUMN resumed_installations text[] NOT NULL DEFAULT '{}';
