import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',          // index.html is in project root
  publicDir: 'public',
  build: {
    outDir: 'dist',   // DO will publish this directory
    assetsDir: 'assets',
    sourcemap: false,  // keep for prod debugging (turn off if you prefer)
    target: 'es2018',
    emptyOutDir: true
  }
});
