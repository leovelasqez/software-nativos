export type ProductionConfig = {
  databaseUrl: string;
  origin: string;
  port: number;
  poolMax: number;
};

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number, name: string) {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`invalid_${name}`);
  return parsed;
}

export function productionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('missing_database_url');
  let database: URL;
  try { database = new URL(databaseUrl); } catch { throw new Error('invalid_database_url'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname) throw new Error('invalid_database_url');

  const explicitOrigin = env.NATIVOS_ORIGIN?.trim();
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const source = explicitOrigin || (railwayDomain ? `https://${railwayDomain}` : '');
  if (!source) throw new Error('missing_public_origin');
  let publicUrl: URL;
  try { publicUrl = new URL(source); } catch { throw new Error('invalid_public_origin'); }
  if (publicUrl.protocol !== 'https:' || !publicUrl.hostname || publicUrl.username || publicUrl.password
    || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) throw new Error('invalid_public_origin');

  return {
    databaseUrl,
    origin: publicUrl.origin,
    port: integer(env.PORT, 3000, 1, 65535, 'port'),
    poolMax: integer(env.NATIVOS_DB_POOL_MAX, 8, 1, 20, 'pool_max'),
  };
}
