import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({plugins:[{name:'browser-contracts',enforce:'pre',resolveId(source,importer){if(importer&&source.endsWith('/contracts.ts')&&!importer.includes('/offline/contracts.ts')&&!importer.includes('\\offline\\contracts.ts'))return resolve('web/offline/contracts.ts');}}],build:{rollupOptions:{input:{admin:'index.html',pos:'pos.html'}}}});
