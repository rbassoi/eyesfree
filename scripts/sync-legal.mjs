// Copies LICENSE and NOTICE into every publishable package so attribution travels with
// each npm tarball (required by Apache-2.0 §4).
import { copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const pkg of await readdir(`${root}packages`)) {
  for (const f of ['LICENSE', 'NOTICE']) await copyFile(`${root}${f}`, `${root}packages/${pkg}/${f}`);
}
