import { describe, it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './helpers';

const RUNTIME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'runtime');
const env = () => ({ ...process.env, DELPHI_DEV_DATA: tmpDir(), DELPHI_DEV_KB_OFFLINE: '1' });

describe('runtime bundles', () => {
  it('hook-inject answers a Delphi prompt from the real knowledge base', () => {
    const r = spawnSync('node', [path.join(RUNTIME, 'hook-inject.mjs')], {
      input: JSON.stringify({ prompt: 'erro E2356 property accessor class var', cwd: tmpDir() }), env: env(), encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain('class-var-vaza-para-campos-de-instancia.md');
  });

  it('hook-inject exits 0 with no output on garbage', () => {
    const r = spawnSync('node', [path.join(RUNTIME, 'hook-inject.mjs')], { input: 'lixo', env: env(), encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('hook-fix-encoding adds the BOM through the bundle', () => {
    const file = path.join(tmpDir(), 'U.pas');
    fs.writeFileSync(file, 'unit U;');
    const r = spawnSync('node', [path.join(RUNTIME, 'hook-fix-encoding.mjs')], {
      input: JSON.stringify({ tool_input: { file_path: file } }), env: env(), encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(file)[0]).toBe(0xef);
  });

  it('kb-cli prints health', () => {
    const r = spawnSync('node', [path.join(RUNTIME, 'kb-cli.mjs'), 'health'], { env: env(), encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).source).toBe('embedded');
  });

  it('kb-cli install, doctor and uninstall run end to end in an isolated home', () => {
    const home = tmpDir('kb-cli-home-');
    const codexHome = tmpDir('kb-cli-codex-');
    const xdg = tmpDir('kb-cli-xdg-');
    // Every location the CLI could write to is redirected: the real home is never touched.
    const isolated = {
      ...env(), HOME: home, USERPROFILE: home, CODEX_HOME: codexHome, XDG_CONFIG_HOME: xdg, DELPHI_DEV_DATA: path.join(home, '.delphi-dev'),
    };
    const cli = path.join(RUNTIME, 'kb-cli.mjs');
    const run = (...args: string[]) => spawnSync('node', [cli, ...args, '--target', 'all'], { env: isolated, encoding: 'utf8' });

    const dry = run('install', '--dry-run');
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain('[dry-run]');
    expect(fs.readdirSync(home)).toEqual([]);

    const install = run('install');
    expect(install.status).toBe(0);
    expect(fs.existsSync(path.join(xdg, 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(true);
    expect(run('install').stdout).toMatch(/0 gravado\(s\)/);

    const doc = run('doctor');
    expect(doc.status).toBe(0);
    expect(doc.stdout).not.toContain('FAIL');

    expect(run('uninstall').status).toBe(0);
    expect(fs.existsSync(path.join(xdg, 'opencode', 'commands', 'delphi-audit.md'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.delphi-dev', 'install-manifest.json'))).toBe(false);
  }, 60_000);

  it('kb-mcp serves kb_search over stdio', async () => {
    const child = spawn('node', [path.join(RUNTIME, 'kb-mcp.mjs')], { env: env() });
    const lines: string[] = [];
    let buffer = '';
    child.stdout.on('data', (d) => {
      buffer += d.toString();
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      lines.push(...parts.filter(Boolean));
    });
    const send = (msg: object) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'kb_search', arguments: { query: 'E2356 class var' } } });
    const deadline = Date.now() + 10_000;
    while (lines.filter((l) => /"id":3/.test(l)).length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    child.kill();
    const list = JSON.parse(lines.find((l) => /"id":2/.test(l))!);
    expect(list.result.tools.map((t: { name: string }) => t.name).sort())
      .toEqual(['kb_get', 'kb_health', 'kb_prefs', 'kb_search', 'kb_update']);
    const call = JSON.parse(lines.find((l) => /"id":3/.test(l))!);
    expect(call.result.content[0].text).toContain('class-var-vaza-para-campos-de-instancia.md');
  }, 20_000);
});
