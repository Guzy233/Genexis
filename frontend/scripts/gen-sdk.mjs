import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../src');
const SDK_DIR = path.resolve(__dirname, '../src/SDK');

const modulesToExpose = [
  'Manager.ts',
  'Globals.ts',
  'Option.ts',
  'Algorithm.ts',
  'Serialization.ts',
  'Controllers/Keyboard.ts',
  'Controllers/Creator.ts',
  'Controllers/Linker.ts',
  'Controllers/Selector.ts',
  'Controllers/Dragger.ts',
  'Controllers/Deleter.ts',
];

if (!fs.existsSync(SDK_DIR)) {
  fs.mkdirSync(SDK_DIR, { recursive: true });
}

function getExports(content) {
  const exports = [];
  const lines = content.split('\n');

  // Handles: export const/function/var/let/class name
  const exportRegex = /^export\s+(const|function|var|let|class)\s+([a-zA-Z0-9_]+)/;
  // Handles: export interface/type name
  const typeRegex = /^export\s+(interface|type)\s+([a-zA-Z0-9_]+)/;

  for (let line of lines) {
    const match = line.match(exportRegex);
    if (match) {
      exports.push({ type: match[1], name: match[2], isType: false });
    }
    const tMatch = line.match(typeRegex);
    if (tMatch) {
      exports.push({ type: tMatch[1], name: tMatch[2], isType: true });
    }
  }
  return exports;
}

const binderLines = [];
const allModules = [];

for (const modulePath of modulesToExpose) {
  const fullPath = path.join(SRC_DIR, modulePath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');
  const exports = getExports(content);
  const moduleName = path.basename(modulePath, '.ts');
  const relativePath = modulePath.replace(/\\/g, '/');
  const depth = modulePath.split('/').length;
  const upPrefix = '../'.repeat(depth);

  let sdkContent = `// Auto-generated SDK for ${moduleName}\n`;
  const originalModPath = `${upPrefix}${relativePath.replace('.ts', '')}`;
  sdkContent += `import type * as Types from '${originalModPath}';\n\n`;

  const bindingEntries = [];
  const typeExports = [];

  for (const exp of exports) {
    if (exp.isType) {
      typeExports.push(exp.name);
    } else {
      sdkContent += `export const ${exp.name}: typeof Types.${exp.name} = (window as any).MindGraph['${moduleName}']['${exp.name}'];\n`;
      bindingEntries.push(exp.name);
    }
  }

  if (typeExports.length > 0) {
    sdkContent += `\nexport type { ${typeExports.join(', ')} } from '${originalModPath}';\n`;
  }

  const sdkFilePath = path.join(SDK_DIR, modulePath);
  const sdkFileDir = path.dirname(sdkFilePath);
  if (!fs.existsSync(sdkFileDir)) fs.mkdirSync(sdkFileDir, { recursive: true });

  fs.writeFileSync(sdkFilePath, sdkContent);

  binderLines.push(`import * as ${moduleName} from '../${relativePath.replace('.ts', '')}';`);
  allModules.push({ name: moduleName, entries: bindingEntries });
}

// Generate Binding.ts
let binderContent = `// Auto-generated API Binding\n`;
binderLines.forEach(line => binderContent += line + '\n');
binderContent += `\nexport function registerAPI() {\n`;
binderContent += `    (window as any).MindGraph = {\n`;
allModules.forEach(mod => {
  binderContent += `        ${mod.name},\n`;
});
binderContent += `    };\n`;
binderContent += `}\n`;

fs.writeFileSync(path.join(SDK_DIR, 'Binding.ts'), binderContent);

// Generate index.ts for the SDK (if needed)
let indexContent = `// SDK Index\n`;
for (const modulePath of modulesToExpose) {
  indexContent += `export * from './${modulePath.replace('.ts', '')}';\n`;
}
fs.writeFileSync(path.join(SDK_DIR, 'index.ts'), indexContent);

console.log('SDK generation complete!');
