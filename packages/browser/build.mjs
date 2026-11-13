// Builds the single-file browser bundles + static assets (worker, CSS).
// Run after `tsc -b` (the monorepo `npm run build` does both).
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, 'dist');
await mkdir(dist, { recursive: true });

const banner = {
  js: '/*! EyesFree v0.4.0 | Apache-2.0 | Original project: https://github.com/rbassoi/eyesfree */',
};
const common = {
  entryPoints: [resolve(here, 'src/index.ts')],
  bundle: true,
  target: ['es2020', 'chrome80', 'safari14', 'firefox78'],
  banner,
  legalComments: 'none',
  logLevel: 'warning',
};

await Promise.all([
  build({ ...common, format: 'esm', outfile: resolve(dist, 'eyesfree.js'), sourcemap: true }),
  build({ ...common, format: 'esm', minify: true, outfile: resolve(dist, 'eyesfree.esm.min.js'), sourcemap: true }),
  build({ ...common, format: 'iife', globalName: 'eyesfree', minify: true, outfile: resolve(dist, 'eyesfree.min.js'), sourcemap: true }),
]);

// Static worker (for CSP policies that forbid blob: workers) and stylesheet (for policies
// that forbid inline <style>). Generated from the same source of truth as the runtime.
const web = await import('@eyesfree/web');
await writeFile(resolve(dist, 'eyesfree.worker.js'), `${banner.js}\n${web.createWorkerSource()}\n`);
const css = `/*! EyesFree v0.4.0 | Apache-2.0 */\n${web.EYESFREE_CSS}\n`;
await writeFile(resolve(dist, 'eyesfree.css'), css);
await writeFile(resolve(here, '../web/eyesfree.css'), css);

console.log('[eyesfree] browser bundles written to', dist);
