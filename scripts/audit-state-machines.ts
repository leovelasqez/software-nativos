import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Machine {
  id: string; title: string; kind: 'explicit' | 'implicit' | 'historical'; states: string[];
  transitions: [string, string, string][]; guards: string[]; persistence: string; sources: string[]; tests: string[];
}
interface Inventory { version: number; scope: string; baseCommit: string; transitionFormat: string[]; machines: Machine[] }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inventory = JSON.parse(await readFile(resolve(root, 'docs/state-machines.json'), 'utf8')) as Inventory;
const errors: string[] = [];
if (inventory.version !== 1 || !Array.isArray(inventory.machines) || !inventory.machines.length) throw new Error('Invalid state machine inventory');
const seen = new Set<string>();
const referenced = new Set<string>();
for (const machine of inventory.machines) {
  const fail = (message: string) => { errors.push(`${machine.id}: ${message}`); };
  if (!/^[a-z][a-z0-9-]+$/.test(machine.id) || seen.has(machine.id)) fail('invalid or duplicate ID');
  seen.add(machine.id);
  if (!machine.title || !['explicit', 'implicit', 'historical'].includes(machine.kind) || !machine.persistence) fail('missing description/classification');
  if (!Array.isArray(machine.states) || !machine.states.length || new Set(machine.states).size !== machine.states.length) fail('missing or duplicate states');
  if (!Array.isArray(machine.guards) || !machine.guards.length) fail('missing guards');
  if (!Array.isArray(machine.transitions)) { fail('missing transitions'); continue; }
  for (const edge of machine.transitions) {
    if (!Array.isArray(edge) || edge.length !== 3 || !machine.states.includes(edge[0]) || !edge[1] || !machine.states.includes(edge[2])) fail(`invalid transition ${JSON.stringify(edge)}`);
  }
  for (const key of ['sources', 'tests'] as const) {
    if (!Array.isArray(machine[key]) || !machine[key].length) { fail(`missing ${key}`); continue; }
    for (const path of machine[key]) {
      if (typeof path !== 'string' || !path) { fail(`invalid ${key} path`); continue; }
      const absolute = resolve(root, path);
      const rel = relative(root, absolute);
      if (isAbsolute(path) || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) { fail(`path outside repository: ${path}`); continue; }
      if (referenced.has(path)) continue;
      referenced.add(path);
      try { if (!(await stat(absolute)).isFile()) fail(`not a file: ${path}`); }
      catch { fail(`missing file: ${path}`); }
    }
  }
}
if (errors.length) throw new Error(errors.join('\n'));
const summary = { families: inventory.machines.length, sources: new Set(inventory.machines.flatMap(m => m.sources)).size, testFiles: new Set(inventory.machines.flatMap(m => m.tests)).size, byKind: Object.fromEntries(['explicit', 'implicit', 'historical'].map(kind => [kind, inventory.machines.filter(m => m.kind === kind).length])) };
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify({ ...inventory, validation: { valid: true, ...summary } }, null, 2) + '\n');
else {
  process.stdout.write(`State machines: ${summary.families} families, ${summary.sources} source files, ${summary.testFiles} test files; references and transitions valid.\n`);
  for (const machine of inventory.machines) process.stdout.write(`${machine.id}: ${machine.title} [${machine.kind}]\n`);
}
