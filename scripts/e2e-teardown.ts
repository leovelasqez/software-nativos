import { readFile, unlink } from 'node:fs/promises';
import { stopTestPostgres } from './local-postgres.ts';
export default async function teardown() {
  let value: { directory: string };
  try { value = JSON.parse(await readFile('.local/e2e-runtime.json', 'utf8')); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
  await stopTestPostgres(value.directory); await unlink('.local/e2e-runtime.json');
}
