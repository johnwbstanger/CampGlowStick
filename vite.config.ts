import { defineConfig } from 'vite';

// GitHub Pages serves the project at /CampGlowStick/. Override with VITE_BASE (the smoke test uses "/").
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/CampGlowStick/' : '/'),
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/unit/**/*.test.ts'] },
}));
