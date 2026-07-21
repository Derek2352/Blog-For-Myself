import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests cover the pure content-model logic (dates, periods, orientation,
// textures) — no Astro runtime needed, so a plain config with the @ alias.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
