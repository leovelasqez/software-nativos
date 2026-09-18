import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createApp } from '../src/server/app.ts';
import { migrate } from '../src/server/db.ts';
import { productionConfig } from '../src/server/production-config.ts';

const config = productionConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.poolMax,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

let app: Awaited<ReturnType<typeof createApp>> | null = null;
let closing = false;

async function shutdown() {
  if (closing) return;
  closing = true;
  if (app) await app.close();
  await pool.end();
}

try {
  await migrate(pool);
  app = await createApp({ pool, origin: config.origin, staticRoot: resolve('dist') });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Nativos disponible en ${config.origin}`);
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
} catch (error) {
  console.error('No se pudo iniciar Nativos en el entorno alojado.', error instanceof Error ? error.message : 'unknown_error');
  await shutdown();
  process.exitCode = 1;
}
