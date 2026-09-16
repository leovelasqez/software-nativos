import { randomUUID, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { startLocalPostgres } from './local-postgres.ts';
import { migrate } from '../src/server/db.ts';
import { createApp } from '../src/server/app.ts';
import { registerLocalTransition } from '../src/server/local-transition.ts';
const directory = resolve(`.local/e2e-${randomUUID()}`);
const db = await startLocalPostgres(directory, { password: randomBytes(32).toString('hex') });
await writeFile('.local/e2e-runtime.json', JSON.stringify({ directory }), { mode: 0o600 });
await migrate(db.pool);
const app = await createApp({ pool: db.pool, origin: 'http://127.0.0.1:4320', staticRoot: resolve('dist'), backupDirectory: resolve(directory, 'backups'), backupRestoreDatabase: 'e2e_restore_check', backupRestoreConnection: db.connection });
registerLocalTransition(app, db.pool, resolve(directory, 'pos'), 'http://127.0.0.1:4320');
await app.listen({ port: 4320, host: '127.0.0.1' });
console.log('Servidor de pruebas E2E listo. Base sintética aislada.');
let closing = false;
async function shutdown() { if (closing) return; closing = true; await app.close(); await db.stop(); }
process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
