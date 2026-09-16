import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { userInfo } from 'node:os';
import type { Signed } from '../pos-domain.ts';
export interface VaultData {
  installationId: string; lastObservedAtMs: number;
  terminal?: { deviceId: string; branchId: string; installationId: string; token: string; publicKey: string };
  grants: Record<string, Signed>;
  users: Record<string, { signed: Signed; passwordHash: string; revoked: boolean }>;
}
export interface Protector { encrypt(value: string): Promise<string>; decrypt(value: string): Promise<string> }
async function dpapi(value: string, decrypt: boolean) {
  if (process.platform !== 'win32') throw new Error('La custodia local requiere Windows DPAPI.');
  const command = decrypt ? '$v=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString $v;$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}'
    : '$v=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString $v -AsPlainText -Force;[Console]::Write((ConvertFrom-SecureString $s))';
  return new Promise<string>((resolve, reject) => {
    const env = { ...process.env }; delete env.PSModulePath;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, env, stdio: ['pipe','pipe','pipe'] });
    let result = ''; child.stdout.on('data', d => { result += d.toString(); }); child.stderr.resume();
    child.on('error', () => reject(new Error('No fue posible acceder a la custodia local.')));
    child.on('close', code => code === 0 ? resolve(result.trim()) : reject(new Error('No fue posible descifrar la custodia. Conserva los archivos de caja.')));
    child.stdin.end(value);
  });
}
export const windowsProtector: Protector = { encrypt: s => dpapi(s, false), decrypt: s => dpapi(s, true) };
export class Vault {
  data: VaultData;
  private readonly file: string; private readonly protector: Protector;
  private constructor(file: string, protector: Protector, data: VaultData) { this.file = file; this.protector = protector; this.data = data; }
  static async open(directory: string, protector = windowsProtector) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (process.platform === 'win32') await promisify(execFile)('icacls.exe', [directory, '/inheritance:r', '/grant:r', `${process.env.USERDOMAIN ?? '.'}\\${userInfo().username}:(OI)(CI)F`], { windowsHide: true });
    const file = join(directory, 'vault.dpapi'); let data: VaultData;
    try { data = JSON.parse(await protector.decrypt(await readFile(file, 'utf8'))) as VaultData; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; data = { installationId: randomUUID(), lastObservedAtMs: 0, users: {}, grants: {} }; }
    const v = new Vault(file, protector, data); await v.save(); return v;
  }
  async save() {
    const temporary = this.file + '.tmp'; await writeFile(temporary, await this.protector.encrypt(JSON.stringify(this.data)), { mode: 0o600, flush: true }); await rename(temporary, this.file);
  }
}
