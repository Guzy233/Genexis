import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const IS_WINDOWS = process.platform === 'win32';
const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const pluginName = path.basename(pluginDir);

function commandName(name) {
  return IS_WINDOWS ? `${name}.cmd` : name;
}

function logStep(message) {
  console.log(`\x1b[36m${message}\x1b[0m`);
}

function logWarn(message) {
  console.warn(`\x1b[33m${message}\x1b[0m`);
}

function logError(message) {
  console.error(`\x1b[31m${message}\x1b[0m`);
}

function hasFrontend() {
  return fs.existsSync(path.join(pluginDir, 'frontend', 'package.json'));
}

function hasBackendSource() {
  return fs.existsSync(path.join(pluginDir, 'main.go'));
}

function ensureFrontendDependencies() {
  const viteBinary = path.join(
    pluginDir,
    'frontend',
    'node_modules',
    '.bin',
    IS_WINDOWS ? 'vite.cmd' : 'vite'
  );

  if (!fs.existsSync(viteBinary)) {
    throw new Error(`[${pluginName}] frontend dependencies are missing. Run "pnpm install" in frontend first.`);
  }
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: IS_WINDOWS,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 'null'} signal ${signal ?? 'null'}`));
    });
  });
}

async function buildBackend() {
  if (!hasBackendSource()) {
    return;
  }

  const outputName = IS_WINDOWS ? `${pluginName}.exe` : pluginName;
  await runProcess('go', ['build', '-trimpath', '-o', outputName, 'main.go'], { cwd: pluginDir });
}

function collectWatchDirs(rootDir, ignoredNames) {
  const result = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    result.push(current);

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (ignoredNames.has(entry.name)) {
        continue;
      }
      stack.push(path.join(current, entry.name));
    }
  }

  return result;
}

function shouldTriggerBackendBuild(fileName) {
  return fileName.endsWith('.go') || fileName === 'go.mod' || fileName === 'go.sum';
}

function startBackendWatcher() {
  if (!hasBackendSource()) {
    logWarn(`[${pluginName}] backend watch skipped because no backend source exists.`);
    return { close() {} };
  }

  const ignoredNames = new Set(['frontend', 'dist', 'dist_plugin', 'node_modules', '.git']);
  const watchDirs = collectWatchDirs(pluginDir, ignoredNames);
  const watchers = [];
  let timer = null;
  let building = false;
  let pending = false;

  const scheduleBuild = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      if (building) {
        pending = true;
        return;
      }

      building = true;
      try {
        logStep(`[${pluginName}] rebuilding backend...`);
        await buildBackend();
        logStep(`[${pluginName}] backend rebuild complete.`);
      } catch (error) {
        logError(`[${pluginName}] backend rebuild failed: ${error.message}`);
      } finally {
        building = false;
        if (pending) {
          pending = false;
          scheduleBuild();
        }
      }
    }, 150);
  };

  for (const dir of watchDirs) {
    const watcher = fs.watch(dir, (eventType, fileName) => {
      if (!fileName) {
        return;
      }
      if ((eventType === 'rename' || eventType === 'change') && shouldTriggerBackendBuild(path.basename(fileName.toString()))) {
        scheduleBuild();
      }
    });
    watchers.push(watcher);
  }

  return {
    close() {
      if (timer) {
        clearTimeout(timer);
      }
      for (const watcher of watchers) {
        watcher.close();
      }
    },
  };
}

let frontendChild = null;
let backendWatcher = null;

if (hasBackendSource()) {
  logStep(`[${pluginName}] initial backend build...`);
  await buildBackend();
  backendWatcher = startBackendWatcher();
}

if (hasFrontend()) {
  ensureFrontendDependencies();
  logStep(`[${pluginName}] starting frontend watch...`);
  frontendChild = spawn(commandName('pnpm'), ['-C', path.join(pluginDir, 'frontend'), 'build', '--watch', '--mode', 'development'], {
    stdio: 'inherit',
    shell: IS_WINDOWS,
  });
  frontendChild.on('error', (error) => {
    logError(`[${pluginName}] frontend watch failed: ${error.message}`);
  });
}

function cleanup() {
  if (backendWatcher) {
    backendWatcher.close();
  }
  if (frontendChild && !frontendChild.killed) {
    frontendChild.kill('SIGINT');
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

if (frontendChild) {
  frontendChild.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
} else if (backendWatcher) {
  logStep(`[${pluginName}] backend watcher active. Press Ctrl+C to stop.`);
} else {
  logWarn(`[${pluginName}] nothing to watch.`);
}
