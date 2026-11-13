// Copies the browser bundle into the demo so it can be served as a static site
// (locally or on GitHub Pages).
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = `${root}packages/browser/dist`;
const dest = `${root}apps/demo/vendor`;

await mkdir(dest, { recursive: true });
for (const f of ['eyesfree.js', 'eyesfree.js.map', 'eyesfree.min.js', 'eyesfree.worker.js', 'eyesfree.css']) {
  await cp(`${src}/${f}`, `${dest}/${f}`);
}
console.log('[eyesfree] demo vendor files copied to', dest);
