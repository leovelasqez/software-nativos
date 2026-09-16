import {registerLocalTransition} from '../src/server/local-transition.ts';
import { resolve } from 'node:path';
import { startLocalPostgres } from './local-postgres.ts';
import { migrate } from '../src/server/db.ts';
import { createApp } from '../src/server/app.ts';

const port = 4310;
const db = await startLocalPostgres(resolve('.local/development'), { port: 54329 });
try {
  await migrate(db.pool);
  const app = await createApp({ pool: db.pool, origin: `http://127.0.0.1:${port}`, staticRoot: resolve('dist'), backupDirectory: resolve('.local/backups'), backupRestoreDatabase: 'nativos_restore_check', backupRestoreConnection: db.connection });
  registerLocalTransition(app,db.pool,resolve('.local/pos'),`http://127.0.0.1:${port}`,4311);
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`Nativos local: http://127.0.0.1:${port}`);
  console.log('Datos persistentes en .local/development. Cierra con Ctrl+C.');
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); await db.stop(); };
  process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
} catch {
  await db.stop(); console.error('No se pudo iniciar Nativos. Verifica que los puertos 4310 y 54329 estén libres.'); process.exitCode = 1;
}
