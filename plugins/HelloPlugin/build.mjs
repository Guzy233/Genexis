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

async function buildFrontend() {
  if (!hasFrontend()) {
    logWarn(`[${pluginName}] frontend/package.json not found, skipping frontend build.`);
    return;
  }

  ensureFrontendDependencies();
  await runProcess(commandName('pnpm'), ['-C', path.join(pluginDir, 'frontend'), 'build', '--mode', 'production']);
}

async function buildBackend() {
  if (!hasBackendSource()) {
    return null;
  }

  const outputName = IS_WINDOWS ? `${pluginName}.exe` : pluginName;
  await runProcess('go', ['build', '-trimpath', '-o', outputName, 'main.go'], { cwd: pluginDir });
  return path.join(pluginDir, outputName);
}

function ensureEmptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeDistPlugin(backendBinaryPath) {
  const pluginJsonPath = path.join(pluginDir, 'plugin.json');
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  const distDir = path.join(pluginDir, 'dist');
  const distPluginDir = path.join(pluginDir, 'dist_plugin');

  ensureEmptyDir(distPluginDir);

  const entrySourcePath = path.join(distDir, 'index.js');
  if (fs.existsSync(entrySourcePath)) {
    fs.copyFileSync(entrySourcePath, path.join(distPluginDir, 'index.js'));
    pluginJson.frontend.entry = `/plugins/${pluginName}/index.js`;
  }

  const cssSourcePath = path.join(distDir, 'style.css');
  if (fs.existsSync(cssSourcePath)) {
    fs.copyFileSync(cssSourcePath, path.join(distPluginDir, 'style.css'));
    pluginJson.frontend.css = `/plugins/${pluginName}/style.css`;
  } else {
    delete pluginJson.frontend.css;
  }

  if (backendBinaryPath && fs.existsSync(backendBinaryPath)) {
    const backendFileName = path.basename(backendBinaryPath);
    fs.copyFileSync(backendBinaryPath, path.join(distPluginDir, backendFileName));
    pluginJson.backend.main = backendFileName;
  }

  fs.writeFileSync(
    path.join(distPluginDir, 'plugin.json'),
    JSON.stringify(pluginJson, null, 2),
    'utf8'
  );
}

logStep(`[${pluginName}] building frontend...`);
await buildFrontend();

let backendBinaryPath = null;
if (hasBackendSource()) {
  logStep(`[${pluginName}] building backend...`);
  backendBinaryPath = await buildBackend();
}

logStep(`[${pluginName}] preparing dist_plugin...`);
writeDistPlugin(backendBinaryPath);
logStep(`[${pluginName}] build complete.`);
