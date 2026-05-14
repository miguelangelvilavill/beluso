import { defineConfig } from 'vite';

// Base path: /beluso/ for GitHub Pages, / for Vercel
const base = process.env.GITHUB_ACTIONS ? '/beluso/' : '/';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  base,
});
