import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process';

function sdkGenerator() {
  const run = () => {
    exec('node scripts/gen-sdk.mjs', (err, stdout) => {
      if (err) console.error('SDK Gen Error:', err);
      else if (stdout) console.log(stdout.trim());
    });
  };
  return {
    name: 'sdk-generator',
    buildStart: run,
    handleHotUpdate({ file }) {
      if (file.endsWith('.ts') && !file.includes('SDK')) {
        run();
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), sdkGenerator()],
});
