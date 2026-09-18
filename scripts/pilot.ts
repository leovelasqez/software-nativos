import { resolve } from 'node:path';
import { startLocalPostgres } from './local-postgres.ts';
import { migrate } from '../src/server/db.ts';
import { createApp } from '../src/server/app.ts';

const port = 4410;
const db = await startLocalPostgres(resolve('.local/pilot'), { port: 54339 });
try {
  await migrate(db.pool);
  const app = await createApp({ pool: db.pool, origin: `http://127.0.0.1:${port}`, staticRoot: resolve('dist'), backupDirectory: resolve('.local/pilot-backups'), backupRestoreDatabase: 'nativos_pilot_restore_check', backupRestoreConnection: db.connection });
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`Nativos piloto local: http://127.0.0.1:${port}`);
  console.log('Datos aislados en .local/pilot. No contiene datos de desarrollo ni de Alegra.');
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); await db.stop(); };
  process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
} catch (error) {
  await db.stop(); console.error(error); process.exitCode = 1;
}
