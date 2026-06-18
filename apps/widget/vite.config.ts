import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cssInjectedByJsPlugin(),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'groundeddesk-widget.js',
        assetFileNames: 'groundeddesk-widget.[ext]',
        chunkFileNames: 'groundeddesk-widget.js',
      },
    },
  },
});
