import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@SDK': path.resolve(__dirname, '../../../frontend/src/SDK'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'HelloPlugin',
      formats: ['iife'],
      fileName: (format) => `index.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'jotai'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          jotai: 'Jotai',
        },
      },
    },
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
});
