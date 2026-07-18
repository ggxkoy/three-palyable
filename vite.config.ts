import { defineConfig } from 'vite';

// Relative base so the built assets also resolve correctly when the site is
// served from a subpath, e.g. GitHub Pages at /three-palyable/.
export default defineConfig({
  base: './',
});
