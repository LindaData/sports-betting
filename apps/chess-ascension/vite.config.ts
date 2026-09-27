/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any static host path (GitHub Pages subfolder, file server, etc.).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
  },
});
