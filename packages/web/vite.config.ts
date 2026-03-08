import { fileURLToPath, URL } from 'node:url';
import path from 'path';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import tailwindcss from '@tailwindcss/vite';

// simple-notation 源码目录
const simpleNotationSrc = path.resolve(__dirname, '../simple-notation/src');

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 直接使用 simple-notation 源码，而不是构建后的文件，以实现热重载
      'simple-notation': simpleNotationSrc,
      // simple-notation 内部的路径别名
      '@components': path.resolve(simpleNotationSrc, 'components'),
      '@config': path.resolve(simpleNotationSrc, 'config'),
      '@core': path.resolve(simpleNotationSrc, 'core'),
      '@layers': path.resolve(simpleNotationSrc, 'layers'),
      '@types': path.resolve(simpleNotationSrc, 'types'),
      '@utils': path.resolve(simpleNotationSrc, 'utils'),
    },
  },
  optimizeDeps: {
    // 排除 simple-notation，让它直接从源码加载以实现热重载
    exclude: ['simple-notation'],
  },
});
