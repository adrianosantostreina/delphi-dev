import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderOpencodePlugin } from '../src/targets/opencodePlugin';
import { REAL_ROOT, tmpDir } from './helpers';

describe('renderOpencodePlugin', () => {
  it('embeds the checkout path with forward slashes', () => {
    const js = renderOpencodePlugin('D:\\2.2 GitHub Adriano Santos\\delphi-dev');
    expect(js).toContain('"D:/2.2 GitHub Adriano Santos/delphi-dev"');
    expect(js).toContain('gerenciado');
  });

  it('spawns node from the trusted checkout, never from the project being edited', () => {
    const js = renderOpencodePlugin('/opt/delphi-dev');
    expect(js).toMatch(/spawnSync\("node", \[script\], \{[^}]*cwd: ROOT/s);
  });

  it('runs: BOM after an edit and knowledge injected into the system prompt', () => {
    const work = tmpDir('kb-oc-plugin-');
    const plugin = path.join(work, 'delphi-dev.mjs');
    fs.writeFileSync(plugin, renderOpencodePlugin(REAL_ROOT));
    const pas = path.join(work, 'Unit1.pas');
    fs.writeFileSync(pas, 'unit Unit1;');

    const runner = path.join(work, 'runner.mjs');
    fs.writeFileSync(runner, `
      import plugin from ${JSON.stringify(pathToFileURL(plugin).href)};
      const hooks = await plugin({ directory: ${JSON.stringify(work)} });
      const out = { keys: Object.keys(hooks).sort() };
      await hooks['chat.message']({ sessionID: 's1' }, { parts: [{ type: 'text', text: 'erro E2356 property accessor class var' }] });
      const output = { system: [] };
      await hooks['experimental.chat.system.transform']({}, output);
      out.system = output.system;
      await hooks['tool.execute.after']({ tool: 'edit', args: { filePath: ${JSON.stringify(pas)} } }, {});
      console.log(JSON.stringify(out));
    `);

    const r = spawnSync(process.execPath, [runner], {
      encoding: 'utf8',
      env: { ...process.env, DELPHI_DEV_DATA: path.join(work, 'data'), DELPHI_DEV_KB_OFFLINE: '1' },
    });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.keys).toEqual(['chat.message', 'experimental.chat.system.transform', 'tool.execute.after']);
    expect(out.system).toHaveLength(1);
    expect(out.system[0]).toContain('[DELPHI-DEV KNOWLEDGE]');
    expect(fs.readFileSync(pas).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
  });

  it('never throws when the hook scripts are missing', () => {
    const work = tmpDir('kb-oc-plugin-');
    const plugin = path.join(work, 'delphi-dev.mjs');
    fs.writeFileSync(plugin, renderOpencodePlugin(path.join(work, 'nao-existe')));
    const runner = path.join(work, 'runner.mjs');
    fs.writeFileSync(runner, `
      import plugin from ${JSON.stringify(pathToFileURL(plugin).href)};
      const hooks = await plugin({});
      await hooks['chat.message']({}, { parts: [{ type: 'text', text: 'E2356' }] });
      const output = { system: [] };
      await hooks['experimental.chat.system.transform']({}, output);
      await hooks['tool.execute.after']({ tool: 'write', args: { filePath: 'x.pas' } }, {});
      console.log(JSON.stringify(output.system));
    `);
    const r = spawnSync(process.execPath, [runner], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual([]);
  });

  it('generates syntactically valid JavaScript, even for odd checkout paths', () => {
    const work = tmpDir('kb-oc-plugin-');
    const odd = ['D:\\2.2 GitHub Adriano Santos\\delphi-dev', '/home/u/with "quotes"/x y', '/tmp/a`b${c}'];
    for (const [i, dir] of odd.entries()) {
      const file = path.join(work, `p${i}.mjs`);
      fs.writeFileSync(file, renderOpencodePlugin(dir));
      const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
    }
  });

  it('survives hostile host input without throwing', () => {
    const work = tmpDir('kb-oc-plugin-');
    const plugin = path.join(work, 'delphi-dev.mjs');
    fs.writeFileSync(plugin, renderOpencodePlugin(REAL_ROOT));
    const runner = path.join(work, 'runner.mjs');
    fs.writeFileSync(runner, `
      import plugin from ${JSON.stringify(pathToFileURL(plugin).href)};
      for (const ctx of [undefined, null, {}, { directory: 5 }]) {
        const hooks = await plugin(ctx);
        for (const args of [[], [undefined, undefined], [null, null], [{}, { parts: 'x' }], [{}, { parts: [null, 1, { type: 'text' }] }]]) {
          await hooks['chat.message'](...args);
        }
        for (const out of [undefined, null, {}, { system: 'x' }]) await hooks['experimental.chat.system.transform']({}, out);
        for (const inp of [undefined, null, {}, { tool: null }, { tool: 'edit' }, { tool: 'edit', args: null }, { tool: 'write', args: { filePath: 42 } }]) {
          await hooks['tool.execute.after'](inp, undefined);
        }
      }
      console.log('ok');
    `);
    const r = spawnSync(process.execPath, [runner], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.trim()).toBe('ok');
  });
});
