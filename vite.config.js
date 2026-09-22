import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    allowedHosts: ['.trycloudflare.com']
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
