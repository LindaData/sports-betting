import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 60 * 1000,
    fileParallelism: false,
  },
});
