import { describe, it, expect } from 'vitest';
import { buildManifest } from '../src/manifest';
import { healthOf, kbGet, kbPrefs, kbSearch, kbUpdate, type KbContext } from '../src/mcp-server';
import { readSnapshot } from '../src/snapshot';
import * as path from 'node:path';
import { FIXTURE, makePluginRoot, tmpDir } from './helpers';

function ctx(over: Partial<KbContext> = {}): KbContext {
  return { root: makePluginRoot(FIXTURE), data: tmpDir(), env: {}, nodeVersion: '24.18.0', pluginVersion: '4.0.0', ...over };
}

const text = (r: { content: { text: string }[] }) => r.content[0].text;

describe('kb_search', () => {
  it('returns labeled snippets', () => {
    const r = kbSearch(ctx(), { query: 'ShowModal ModalResult mrCancel callback' });
    expect(r.isError).toBeUndefined();
    expect(text(r)).toContain('fmx/modal.md');
  });

  it('degrades with an explanation on old Node', () => {
    const r = kbSearch(ctx({ nodeVersion: '20.0.0' }), { query: 'E2356' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('Node 22.13');
  });

  it('says so when nothing is relevant', () => {
    expect(text(kbSearch(ctx(), { query: 'zzzzqqq' }))).toContain('Nenhum resultado');
  });
});

describe('kb_get', () => {
  it('returns the whole file, even on old Node', () => {
    expect(text(kbGet(ctx({ nodeVersion: '18.20.0' }), { path: 'fmx/ontap.md' }))).toContain('Use OnTap');
  });

  it.each(['../../etc/passwd', 'core/../../x.md', 'local/a.md', 'C:/Windows/win.ini'])('rejects %s', (p) => {
    expect(kbGet(ctx(), { path: p }).isError).toBe(true);
  });

  it('reports a missing file', () => {
    expect(kbGet(ctx(), { path: 'core/nao-existe.md' }).isError).toBe(true);
  });
});

describe('kb_health and kb_prefs', () => {
  it('reports source, counts, versions and preferences', () => {
    const h = healthOf(ctx({ nodeVersion: '18.20.0' }));
    expect(h).toMatchObject({
      source: 'embedded', commit: null, counts: { canonical: 5, community: 1 },
      node: '18.20.0', indexSupported: false, pluginVersion: '4.0.0', suggestions: 'on', offline: false,
    });
  });

  it('gets and sets preferences', () => {
    const c = ctx();
    expect(JSON.parse(text(kbPrefs(c, { action: 'get' })))).toEqual({ suggestions: 'on', offline: false });
    expect(JSON.parse(text(kbPrefs(c, { action: 'set', suggestions: 'off' })))).toEqual({ suggestions: 'off', offline: false });
    expect(healthOf(c).suggestions).toBe('off');
  });
});

describe('kb_update', () => {
  it('summarizes an up-to-date check', async () => {
    const c = ctx();
    const manifest = buildManifest(readSnapshot(path.join(c.root, 'knowledge')), 'abcdef1', '4.1.0');
    const r = await kbUpdate({ ...c, fetcher: async () => Buffer.from(JSON.stringify(manifest)) }, { force: true });
    const summary = JSON.parse(text(r));
    expect(summary).toMatchObject({ status: 'up-to-date', remotePluginVersion: '4.1.0', installedPluginVersion: '4.0.0' });
  });
});
