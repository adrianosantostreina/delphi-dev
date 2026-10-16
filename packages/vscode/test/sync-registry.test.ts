import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
// @ts-expect-error plain ESM script without types
import { buildCommands, camelId, commandId, computeOutputs } from '../scripts/sync-registry.mjs';

const pkgDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgDir, '..', '..');
// Git for Windows may check files out with CRLF; the generated text is always LF.
const readLf = (file: string): string => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const registry = JSON.parse(readLf(path.join(repoRoot, 'portable.json')));
const pkg = JSON.parse(readLf(path.join(pkgDir, 'package.json')));

describe('sync-registry', () => {
  it('derives camelCase VS Code ids', () => {
    expect(camelId('new-project')).toBe('newProject');
    expect(camelId('contribute-kb')).toBe('contributeKb');
    expect(camelId('e2e')).toBe('e2e');
    expect(commandId('audit')).toBe('delphi-dev.audit');
  });

  it('builds one command per registry entry plus the extension-only ones', () => {
    const commands = buildCommands(registry) as { command: string; title: string; icon: string }[];
    expect(commands).toHaveLength(registry.commands.length + 2);
    expect(commands.find((c) => c.command === 'delphi-dev.audit')).toEqual({
      command: 'delphi-dev.audit', title: 'Delphi Dev: Audit project', icon: '$(checklist)',
    });
    expect(commands.map((c) => c.command)).toContain('delphi-dev.createClaudeignore');
    expect(commands.map((c) => c.command)).toContain('delphi-dev.chooseAgent');
  });

  it('the committed registry.json and package.json are in sync with portable.json', () => {
    const out = computeOutputs(registry, pkg);
    expect(readLf(path.join(pkgDir, 'src', 'generated', 'registry.json'))).toBe(out.registryText);
    expect(readLf(path.join(pkgDir, 'package.json'))).toBe(out.pkgText);
  });

  it('every command used by a menu or a welcome view exists in contributes.commands', () => {
    const declared = new Set(pkg.contributes.commands.map((c: { command: string }) => c.command));
    const used: string[] = [];
    for (const group of Object.values(pkg.contributes.menus) as { command: string }[][]) {
      for (const item of group) used.push(item.command);
    }
    for (const w of pkg.contributes.viewsWelcome ?? []) {
      for (const m of String(w.contents).matchAll(/command:([A-Za-z0-9_.-]+)/g)) used.push(m[1]);
    }
    expect(used.length).toBeGreaterThan(0);
    for (const c of used) expect(declared.has(c), c).toBe(true);
  });
});
