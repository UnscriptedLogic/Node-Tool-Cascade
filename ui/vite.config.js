import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: fileURLToPath(new URL('../app/gen', import.meta.url)),
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: fileURLToPath(new URL('./main.jsx', import.meta.url)),
      name: 'CascadeUI',
      formats: ['iife'],
      fileName: () => 'ui.js',
      cssFileName: 'ui'
    }
  }
});
