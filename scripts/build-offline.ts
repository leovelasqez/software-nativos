import { readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { serviceWorkerSource } from '../src/service-worker.ts';

const assets = (await readdir('dist/assets')).map(name => '/assets/' + name);
const paths = ['/', '/caja', '/theme.js', '/manifest.webmanifest', '/nativos-icon.svg', ...assets];
const version = createHash('sha256').update(await readFile('dist/index.html'))
  .update(await readFile('dist/pos.html')).digest('hex').slice(0, 16);
await writeFile('dist/sw.js', serviceWorkerSource(version, paths));
