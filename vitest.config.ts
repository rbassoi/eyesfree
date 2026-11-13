import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (name: string, file = 'index.ts') => fileURLToPath(new URL(`./packages/${name}/src/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@eyesfree/core': pkg('core'),
      '@eyesfree/web': pkg('web'),
      '@eyesfree/calibrator': pkg('calibrator'),
      '@eyesfree/react': pkg('react', 'index.tsx'),
      '@eyesfree/distance': pkg('distance'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
