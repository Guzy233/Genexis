import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr:false,
    proxy: {
      "/reciper": {
        target:"http://localhost:29991",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/reciper/, ""),
      },
    },
  },
});
