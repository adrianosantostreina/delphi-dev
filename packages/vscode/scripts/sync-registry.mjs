#!/usr/bin/env node
// Keeps the extension in step with the plugin's portable.json:
//   src/generated/registry.json  <- copy of portable.json
//   package.json contributes.commands <- one command per registry entry + extension-only commands
//   node scripts/sync-registry.mjs --write | --check
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(here, '..');
const REGISTRY_SRC = path.resolve(pkgDir, '..', '..', 'portable.json');
const REGISTRY_OUT = path.join(pkgDir, 'src', 'generated', 'registry.json');
const PKG = path.join(pkgDir, 'package.json');

const EXTRA_COMMANDS = [
  { command: 'delphi-dev.createClaudeignore', title: 'Delphi Dev: Create .claudeignore', icon: '$(file-add)' },
  { command: 'delphi-dev.chooseAgent', title: 'Delphi Dev: Choose Agent', icon: '$(account)' },
];

// Git for Windows may check files out with CRLF; the generated text is always LF.
const readLf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

export function camelId(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function commandId(id) {
  return `delphi-dev.${camelId(id)}`;
}

export function buildCommands(registry) {
  return [
    ...registry.commands.map((c) => ({
      command: commandId(c.id),
      title: `Delphi Dev: ${c.title['en-US']}`,
      icon: `$(${c.icon})`,
    })),
    ...EXTRA_COMMANDS,
  ];
}

export function computeOutputs(registry, pkg) {
  const next = { ...pkg, contributes: { ...pkg.contributes, commands: buildCommands(registry) } };
  return {
    registryText: `${JSON.stringify(registry, null, 2)}\n`,
    pkgText: `${JSON.stringify(next, null, 2)}\n`,
  };
}

function main() {
  const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--write') ? 'write' : null;
  if (!mode) {
    console.error('usage: sync-registry.mjs --write | --check');
    process.exit(64);
  }
  const registry = JSON.parse(readLf(REGISTRY_SRC));
  const pkg = JSON.parse(readLf(PKG));
  const out = computeOutputs(registry, pkg);
  if (mode === 'write') {
    fs.mkdirSync(path.dirname(REGISTRY_OUT), { recursive: true });
    fs.writeFileSync(REGISTRY_OUT, out.registryText);
    fs.writeFileSync(PKG, out.pkgText);
    console.log('registry.json and package.json updated');
    return;
  }
  const stale = [];
  if (!fs.existsSync(REGISTRY_OUT) || readLf(REGISTRY_OUT) !== out.registryText) stale.push('src/generated/registry.json');
  if (readLf(PKG) !== out.pkgText) stale.push('package.json');
  if (stale.length) {
    console.error(`out of sync with portable.json: ${stale.join(', ')} (run npm run sync)`);
    process.exit(1);
  }
  console.log('registry in sync');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
