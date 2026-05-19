import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        bonsai: 'bonsai/index.html',
      },
    },
  },
  plugins: [tailwindcss()],
});
