import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

/** GitHub 项目站路径为 /<repo>/，CI 里设置 GITHUB_PAGES_BASE=/AI-agent/ 等形式 */
const base =
  process.env.GITHUB_PAGES_BASE?.replace(/\/?$/, '/') ||
  '/';

export default defineConfig({
  base: base === '/' ? '/' : base,
  root: fileURLToPath(new URL('./preview', import.meta.url)),
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@src': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
