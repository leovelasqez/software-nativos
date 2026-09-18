import test from 'node:test';
import assert from 'node:assert/strict';
import { productionConfig } from '../src/server/production-config.ts';

const databaseUrl = 'postgresql://nativos:secret@postgres.railway.internal:5432/railway';

test('configuración alojada deriva origen seguro de Railway', () => {
  assert.deepEqual(productionConfig({ DATABASE_URL: databaseUrl, RAILWAY_PUBLIC_DOMAIN: 'nativos.example.up.railway.app', PORT: '8080' }), {
    databaseUrl,
    origin: 'https://nativos.example.up.railway.app',
    port: 8080,
    poolMax: 8,
  });
});

test('configuración alojada admite dominio propio y límites explícitos', () => {
  assert.deepEqual(productionConfig({ DATABASE_URL: databaseUrl, NATIVOS_ORIGIN: 'https://app.nativos.example', NATIVOS_DB_POOL_MAX: '4' }), {
    databaseUrl,
    origin: 'https://app.nativos.example',
    port: 3000,
    poolMax: 4,
  });
});

test('configuración alojada rechaza secretos ausentes, HTTP y valores fuera de rango', () => {
  assert.throws(() => productionConfig({ RAILWAY_PUBLIC_DOMAIN: 'nativos.example' }), /missing_database_url/);
  assert.throws(() => productionConfig({ DATABASE_URL: databaseUrl }), /missing_public_origin/);
  assert.throws(() => productionConfig({ DATABASE_URL: databaseUrl, NATIVOS_ORIGIN: 'http://nativos.example' }), /invalid_public_origin/);
  assert.throws(() => productionConfig({ DATABASE_URL: databaseUrl, NATIVOS_ORIGIN: 'https://nativos.example/path' }), /invalid_public_origin/);
  assert.throws(() => productionConfig({ DATABASE_URL: databaseUrl, RAILWAY_PUBLIC_DOMAIN: 'nativos.example', PORT: '70000' }), /invalid_port/);
  assert.throws(() => productionConfig({ DATABASE_URL: 'sqlite://local', RAILWAY_PUBLIC_DOMAIN: 'nativos.example' }), /invalid_database_url/);
});
