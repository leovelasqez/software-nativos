-- cash.movement became a default human permission after the first development
-- users already existed. Backfill it once so upgraded installations match the
-- defaults used for newly created owners, managers and cashiers.
UPDATE app_users
SET actions = array_append(actions, 'cash.movement')
WHERE kind = 'human'
  AND NOT ('cash.movement' = ANY(actions));
