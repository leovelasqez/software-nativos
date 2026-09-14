import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, unlink, realpath } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { userInfo } from 'node:os';
import { createServer } from 'node:net';
import { Pool } from 'pg';

const exec = promisify(execFile);
async function control(binary: string, args: string[]) {
  // Detached postgres must not inherit captured pipes and hold the launcher open.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('postgres_control_timeout')); }, 60_000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('postgres_control_unavailable')); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('postgres_control_failed')); });
  });
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port_unavailable');
  const port = address.port; await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); return port;
}
async function dpapi(value: string, decrypt = false) {
  const command = decrypt
    ? '$v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $v; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}'
    : '$v=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $v -AsPlainText -Force; [Console]::Write((ConvertFrom-SecureString $s))';
  return new Promise<string>((resolve, reject) => {
    const env = { ...process.env };
    // PowerShell 7's inherited module path can shadow Windows PowerShell 5 modules.
    delete env.PSModulePath;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => { output += data.toString(); });
    child.on('error', () => reject(new Error('credential_protection_unavailable')));
    child.stderr.resume(); child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error('credential_protection_failed')));
    child.stdin.end(value);
  });
}
export async function startLocalPostgres(directory: string, options: { port?: number; password?: string } = {}) {
  const base = resolve(directory); await mkdir(base, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const account = `${process.env.USERDOMAIN ?? '.'}\\${userInfo().username}`;
    await exec('icacls.exe', [base, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`], { windowsHide: true });
  }
  let password = options.password;
  if (!password) {
    const secretPath = join(base, process.platform === 'win32' ? 'db-secret.dpapi' : 'db-secret');
    if (await exists(secretPath)) {
      const saved = await readFile(secretPath, 'utf8'); password = process.platform === 'win32' ? await dpapi(saved, true) : saved;
    } else {
      password = randomBytes(32).toString('base64url');
      await writeFile(secretPath, process.platform === 'win32' ? await dpapi(password) : password, { mode: 0o600, flag: 'wx' });
    }
  }
  const packageName = `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  const bin = await import(packageName) as { postgres: string; initdb: string; pg_ctl: string };
  const dir = join(base, 'pgdata'); const port = options.port ?? await freePort();
  if (!(await exists(join(dir, 'PG_VERSION')))) {
    const passwordFile = join(base, 'init-password.tmp');
    await writeFile(passwordFile, password, { mode: 0o600, flag: 'wx' });
    try {
      await exec(bin.initdb, ['-D', dir, '-U', 'nativos_local', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C'], { windowsHide: true, timeout: 60_000 });
    } finally { await unlink(passwordFile); }
  }
  await control(bin.pg_ctl, ['-D', dir, '-l', join(base, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  const pool = new Pool({ host: '127.0.0.1', port, user: 'nativos_local', password, database: 'postgres', max: 8 });
  pool.on('error', () => { /* requests receive controlled errors; never log credentials */ });
  let stopped = false;
  return { pool, port, async stop() {
    if (stopped) return; stopped = true;
    await pool.end(); await control(bin.pg_ctl, ['-D', dir, '-m', 'fast', '-w', 'stop']);
  } };
}

// Playwright on Windows can terminate Node without delivering SIGTERM.
// Explicit teardown only accepts a test cluster directly below this workspace's .local.
export async function stopTestPostgres(directory: string) {
  const root = await realpath(resolve('.local')); const actual = await realpath(directory);
  if (!/^(e2e|test)-[a-f0-9-]+$/.test(relative(root, actual))) throw new Error('not_a_test_cluster');
  const dir = join(actual, 'pgdata');
  if (!(await exists(join(dir, 'postmaster.pid')))) return;
  const packageName = `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  const bin = await import(packageName) as { pg_ctl: string };
  await control(bin.pg_ctl, ['-D', dir, '-m', 'fast', '-w', 'stop']);
}
