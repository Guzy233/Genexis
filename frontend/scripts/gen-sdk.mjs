import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../src');
const SDK_DIR = path.resolve(__dirname, '../src/SDK');

// Help function: find all files recursively
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            // Exclude SDK and Reciper directories
            if (file !== 'SDK' && file !== 'Reciper' && file !== 'assets' && file !== 'css' && file !== 'wailsjs') {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                // Exclude entry files like main.jsx, App.tsx (unless you want to expose App)
                if (file !== 'main.jsx' && file !== 'App.tsx') {
                    arrayOfFiles.push(path.relative(SRC_DIR, fullPath));
                }
            }
        }
    });

    return arrayOfFiles;
}

const modulesToExpose = getAllFiles(SRC_DIR);

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

// Sort to ensure consistency
modulesToExpose.sort();

for (const modulePath of modulesToExpose) {
    const fullPath = path.join(SRC_DIR, modulePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const exports = getExports(content);
    if (exports.length === 0) continue; // Skip files with no exports

    // Create a unique module name based on path to avoid collisions
    // e.g. Controllers/Keyboard.ts -> Controllers_Keyboard
    const ext = path.extname(modulePath);
    const moduleBaseName = modulePath.replace(ext, '').replace(/\\/g, '/');
    const moduleInternalName = moduleBaseName.replace(/\//g, '_');

    const depth = moduleBaseName.split('/').length;
    const upPrefix = '../'.repeat(depth);

    let sdkContent = `// Auto-generated SDK for ${moduleBaseName}\n`;
    const originalModPath = `${upPrefix}${moduleBaseName}`;
    sdkContent += `import type * as Types from '${originalModPath}';\n\n`;

    const bindingEntries = [];
    const typeExports = [];

    for (const exp of exports) {
        if (exp.isType) {
            typeExports.push(exp.name);
        } else {
            sdkContent += `export const ${exp.name}: typeof Types.${exp.name} = (window as any).MindGraph['${moduleInternalName}']['${exp.name}'];\n`;
            bindingEntries.push(exp.name);
        }
    }

    if (typeExports.length > 0) {
        sdkContent += `\nexport type { ${typeExports.join(', ')} } from '${originalModPath}';\n`;
    }

    const sdkFilePath = path.join(SDK_DIR, modulePath.replace('.tsx', '.ts'));
    const sdkFileDir = path.dirname(sdkFilePath);
    if (!fs.existsSync(sdkFileDir)) fs.mkdirSync(sdkFileDir, { recursive: true });

    fs.writeFileSync(sdkFilePath, sdkContent);

    binderLines.push(`import * as ${moduleInternalName} from '../${moduleBaseName}';`);
    allModules.push({ internalName: moduleInternalName, pathName: moduleBaseName, entries: bindingEntries });
}

// Generate Binding.ts
let binderContent = `// Auto-generated API Binding\n`;
binderLines.forEach(line => binderContent += line + '\n');
binderContent += `\nexport function registerAPI() {\n`;
binderContent += `    (window as any).MindGraph = {\n`;
allModules.forEach(mod => {
    binderContent += `        '${mod.internalName}': ${mod.internalName},\n`;
    // Also provide a nested structure for better access if needed, 
    // but the SDK uses the flat 'moduleInternalName' key for simplicity in lookups.
});
binderContent += `    };\n`;
binderContent += `}\n`;

fs.writeFileSync(path.join(SDK_DIR, 'Binding.ts'), binderContent);

// Generate index.ts for the SDK
let indexContent = `// SDK Index\n`;
for (const modulePath of modulesToExpose) {
    const moduleBaseName = modulePath.replace(path.extname(modulePath), '').replace(/\\/g, '/');
    // Check if we actually generated a file for it (it might have been skipped if no exports)
    const sdkFilePath = path.join(SDK_DIR, modulePath.replace('.tsx', '.ts'));
    if (fs.existsSync(sdkFilePath)) {
        indexContent += `export * from './${moduleBaseName}';\n`;
    }
}
fs.writeFileSync(path.join(SDK_DIR, 'index.ts'), indexContent);

console.log(`SDK generation complete! Exposed ${allModules.length} modules.`);
