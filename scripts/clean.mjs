// Removes build outputs from every package.
import { rm } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const pkg of await readdir(`${root}packages`)) {
  await rm(`${root}packages/${pkg}/dist`, { recursive: true, force: true });
  await rm(`${root}packages/${pkg}/tsconfig.tsbuildinfo`, { force: true });
}
await rm(`${root}apps/demo/vendor`, { recursive: true, force: true });
console.log('[eyesfree] clean');
