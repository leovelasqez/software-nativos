import { resolve } from 'node:path';
import { PosEngine } from '../src/pos/engine.ts';
import { createPosApp } from '../src/pos/app.ts';
const engine = await PosEngine.open(resolve('.local/pos'), 'http://127.0.0.1:4310');
const app = await createPosApp(engine, 'http://127.0.0.1:4311', resolve('dist'));
try { await app.listen({ host: '127.0.0.1', port: 4311 }); console.log('Caja Nativos: http://127.0.0.1:4311'); }
catch { await app.close(); console.error('No se pudo iniciar la caja. Verifica que no esté abierta en el puerto 4311.'); process.exitCode = 1; }
process.once('SIGINT', () => { void app.close(); }); process.once('SIGTERM', () => { void app.close(); });
