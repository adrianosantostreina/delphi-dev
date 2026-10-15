import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const kbRoot = path.resolve(here, '..');
const outDir = path.resolve(kbRoot, '..', 'runtime');

const entries = ['hook-inject', 'hook-fix-encoding', 'kb-mcp', 'kb-cli'];

for (const name of entries) {
  await build({
    entryPoints: [path.join(kbRoot, 'src', 'entry', `${name}.ts`)],
    outfile: path.join(outDir, `${name}.mjs`),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    minify: true,
    legalComments: 'eof',
    charset: 'utf8',
    logLevel: 'warning',
  });
}
console.log(`runtime: ${entries.length} bundles em ${outDir}`);
