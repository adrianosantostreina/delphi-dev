import { describe, it, expect } from 'vitest';
import { buildInjection, type InjectContext } from '../src/hook-inject';
import { FIXTURE, makePluginRoot, tmpDir, writeTree } from './helpers';

function ctx(over: Partial<InjectContext> = {}): InjectContext {
  return {
    root: makePluginRoot(FIXTURE), data: tmpDir(), env: {}, nodeVersion: '24.18.0', pluginVersion: '4.0.0',
    minScore: 0, strongScore: 1e9, ...over,
  };
}

describe('buildInjection', () => {
  it('injects knowledge for an explicit Delphi prompt', () => {
    const out = buildInjection({ prompt: 'erro E2356 com class var', cwd: tmpDir() }, ctx());
    const parsed = JSON.parse(out);
    expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('core/class-var.md');
  });

  it('stays silent for a non-Delphi prompt outside a Delphi project', () => {
    expect(buildInjection({ prompt: 'faz o commit', cwd: tmpDir() }, ctx())).toBe('');
  });

  it('requires a strong match for an implicit prompt inside a Delphi project', () => {
    const project = tmpDir();
    writeTree(project, { 'App.dpr': 'program App;' });
    const payload = { prompt: 'o callback recebe mrcancel', cwd: project };
    expect(buildInjection(payload, ctx())).toBe('');
    expect(buildInjection(payload, ctx({ strongScore: 0 }))).toContain('fmx/modal.md');
  });

  it('stays silent on Node older than 22.13', () => {
    expect(buildInjection({ prompt: 'erro E2356' }, ctx({ nodeVersion: '20.11.0' }))).toBe('');
  });

  // Review Focus 5: odd or huge payloads.
  it.each([[null], [{}], [{ prompt: 42 }], [{ prompt: '   ' }]])('ignores payload %j', (payload) => {
    expect(buildInjection(payload, ctx())).toBe('');
  });

  it('handles a 100 KB prompt quickly', () => {
    const c = ctx();
    buildInjection({ prompt: 'E2356' }, c); // warm the index
    const started = Date.now();
    buildInjection({ prompt: `E2356 ${'palavra '.repeat(12_500)}` }, c);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
