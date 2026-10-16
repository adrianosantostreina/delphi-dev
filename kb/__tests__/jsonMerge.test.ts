import { describe, it, expect } from 'vitest';
import {
  mergeCodexHooks, mergeOpencodeMcp, removeCodexHooks, removeOpencodeMcp, type HookEntry,
} from '../src/targets/jsonMerge';

const entry = { type: 'local', command: ['node', 'D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs'], enabled: true };

const parse = (r: { ok: true; text: string } | { ok: false; reason: string }) => {
  if (!r.ok) throw new Error(r.reason);
  return JSON.parse(r.text);
};

describe('mergeOpencodeMcp', () => {
  it('creates a config when there is no file', () => {
    const r = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    expect(parse(r)).toEqual({ $schema: 'https://opencode.ai/config.json', mcp: { 'delphi-dev-kb': entry } });
  });

  it('adds the server and keeps every other key, in order, with the same indent', () => {
    const original = '{\n\t"$schema": "https://opencode.ai/config.json",\n\t"provider": { "x": { "options": {} } },\n\t"mcp": { "aws-mcp": { "type": "remote", "url": "https://a" } }\n}\n';
    const r = mergeOpencodeMcp(original, 'delphi-dev-kb', entry);
    if (!r.ok) throw new Error(r.reason);
    const out = JSON.parse(r.text);
    expect(Object.keys(out)).toEqual(['$schema', 'provider', 'mcp']);
    expect(Object.keys(out.mcp)).toEqual(['aws-mcp', 'delphi-dev-kb']);
    expect(out.provider).toEqual({ x: { options: {} } });
    expect(r.text).toContain('\n\t"provider"');
    expect(r.changed).toBe(true);
  });

  it('is a no-op when our entry is already identical', () => {
    const first = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    if (!first.ok) throw new Error(first.reason);
    const again = mergeOpencodeMcp(first.text, 'delphi-dev-kb', entry);
    expect(again).toEqual({ ok: true, text: first.text, changed: false });
  });

  it('updates our own entry when it points to another checkout', () => {
    const old = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'local', command: ['node', 'C:/antigo/runtime/kb-mcp.mjs'], enabled: true } } });
    const r = mergeOpencodeMcp(old, 'delphi-dev-kb', entry);
    expect(parse(r).mcp['delphi-dev-kb']).toEqual(entry);
  });

  it('refuses to replace a foreign server with the same name', () => {
    const foreign = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'https://x' } } });
    expect(mergeOpencodeMcp(foreign, 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'conflict' });
  });

  it('refuses JSON with comments (JSONC) and never rewrites it', () => {
    const jsonc = '{\n  // meu provedor\n  "provider": {}\n}\n';
    expect(mergeOpencodeMcp(jsonc, 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('refuses a non-object mcp', () => {
    expect(mergeOpencodeMcp('{"mcp": []}', 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'mcp-not-an-object' });
  });
});

describe('removeOpencodeMcp', () => {
  it('removes only our entry and drops an emptied mcp object', () => {
    const only = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    if (!only.ok) throw new Error(only.reason);
    expect(parse(removeOpencodeMcp(only.text, 'delphi-dev-kb'))).toEqual({ $schema: 'https://opencode.ai/config.json' });

    const shared = JSON.stringify({ mcp: { a: { type: 'remote', url: 'u' }, 'delphi-dev-kb': entry } });
    expect(parse(removeOpencodeMcp(shared, 'delphi-dev-kb'))).toEqual({ mcp: { a: { type: 'remote', url: 'u' } } });
  });

  it('leaves a foreign entry with the same name alone', () => {
    const foreign = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'u' } } });
    expect(removeOpencodeMcp(foreign, 'delphi-dev-kb')).toEqual({ ok: true, text: foreign, changed: false });
  });
});

const HOOKS: HookEntry[] = [
  { event: 'PostToolUse', matcher: 'apply_patch|Write|Edit',
    command: 'command -v node >/dev/null 2>&1 && node "C:/x/runtime/hook-fix-encoding.mjs"; exit 0',
    commandWindows: 'where node >nul 2>nul && node "C:/x/runtime/hook-fix-encoding.mjs" & exit /b 0' },
  { event: 'UserPromptSubmit',
    command: 'command -v node >/dev/null 2>&1 && node "C:/x/runtime/hook-inject.mjs"; exit 0',
    commandWindows: 'where node >nul 2>nul && node "C:/x/runtime/hook-inject.mjs" & exit /b 0' },
];

describe('codex hooks.json', () => {
  it('creates the file structure', () => {
    const out = parse(mergeCodexHooks(null, HOOKS));
    expect(out.hooks.PostToolUse[0].matcher).toBe('apply_patch|Write|Edit');
    expect(out.hooks.PostToolUse[0].hooks[0]).toMatchObject({ type: 'command' });
    expect(out.hooks.UserPromptSubmit[0].hooks[0].commandWindows).toContain('hook-inject.mjs');
  });

  it('keeps the hooks of the user and of other tools', () => {
    const user = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] }, outra: 1 };
    const out = parse(mergeCodexHooks(JSON.stringify(user), HOOKS));
    expect(out.outra).toBe(1);
    expect(out.hooks.PostToolUse).toHaveLength(2);
    expect(out.hooks.PostToolUse[0].hooks[0].command).toBe('echo meu');
  });

  it('is idempotent and updates our entry when the checkout moves', () => {
    const first = mergeCodexHooks(null, HOOKS);
    if (!first.ok) throw new Error(first.reason);
    expect(mergeCodexHooks(first.text, HOOKS)).toEqual({ ok: true, text: first.text, changed: false });

    const moved = HOOKS.map((h) => ({ ...h, command: h.command.replace('C:/x', 'D:/novo'), commandWindows: h.commandWindows?.replace('C:/x', 'D:/novo') }));
    const out = parse(mergeCodexHooks(first.text, moved));
    expect(out.hooks.PostToolUse).toHaveLength(1);
    expect(out.hooks.PostToolUse[0].hooks[0].command).toContain('D:/novo');
  });

  it('removes only our entries', () => {
    const user = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } };
    const merged = mergeCodexHooks(JSON.stringify(user), HOOKS);
    if (!merged.ok) throw new Error(merged.reason);
    expect(parse(removeCodexHooks(merged.text))).toEqual(user);

    const only = mergeCodexHooks(null, HOOKS);
    if (!only.ok) throw new Error(only.reason);
    expect(parse(removeCodexHooks(only.text))).toEqual({});
  });

  it('refuses invalid JSON', () => {
    expect(mergeCodexHooks('{ nope', HOOKS)).toEqual({ ok: false, reason: 'invalid-json' });
  });
});

describe('opencode.json edge cases (never overwrite the user config)', () => {
  const refuse = (text: string, reason: string) =>
    expect(mergeOpencodeMcp(text, 'delphi-dev-kb', entry)).toEqual({ ok: false, reason });

  it('refuses block comments, trailing commas, a root that is not an object and garbage', () => {
    refuse('{ /* c */ "a": 1 }', 'invalid-json');
    refuse('{ "a": 1, }', 'invalid-json');
    refuse('[]', 'not-an-object');
    refuse('null', 'not-an-object');
    refuse('{ "mcp": null }', 'mcp-not-an-object');
    refuse('{ "mcp": "x" }', 'mcp-not-an-object');
    refuse('nao e json', 'invalid-json');
  });

  it('does not mistake // inside a string value for a comment', () => {
    const r = mergeOpencodeMcp('{"mcp":{"a":{"type":"remote","url":"https://a//b"}}}', 'delphi-dev-kb', entry);
    expect(parse(r).mcp.a.url).toBe('https://a//b');
  });

  it('accepts and keeps a UTF-8 BOM and CRLF line endings', () => {
    const bom = String.fromCharCode(0xfeff);
    const original = `${bom}{\r\n  "provider": {}\r\n}\r\n`;
    const r = mergeOpencodeMcp(original, 'delphi-dev-kb', entry);
    if (!r.ok) throw new Error(r.reason);
    expect(r.text.startsWith(bom)).toBe(true);
    expect(r.text).toContain('\r\n');
    expect(r.text.replace(/\r\n/g, '')).not.toContain('\n');
    expect(JSON.parse(r.text.slice(1)).provider).toEqual({});
  });

  it('keeps what the user added to our own entry (enabled:false stays off)', () => {
    const mine = JSON.stringify({ mcp: { 'delphi-dev-kb': { ...entry, enabled: false, timeout: 5000 } } });
    const r = mergeOpencodeMcp(mine, 'delphi-dev-kb', entry);
    expect(r).toEqual({ ok: true, text: mine, changed: false });

    const moved = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'local', command: ['node', 'C:/antigo/runtime/kb-mcp.mjs'], enabled: false, timeout: 5000 } } });
    const out = parse(mergeOpencodeMcp(moved, 'delphi-dev-kb', entry)).mcp['delphi-dev-kb'];
    expect(out.command).toEqual(entry.command);
    expect(out.enabled).toBe(false);
    expect(out.timeout).toBe(5000);
  });

  it('treats a backslash path of our own server as ours', () => {
    const win = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'local', command: ['node', 'C:\\antigo\\runtime\\kb-mcp.mjs'] } } });
    expect(parse(mergeOpencodeMcp(win, 'delphi-dev-kb', entry)).mcp['delphi-dev-kb'].command).toEqual(entry.command);
  });

  it('refuses a foreign entry that is not even an object', () => {
    expect(mergeOpencodeMcp('{"mcp":{"delphi-dev-kb":"x"}}', 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'conflict' });
  });

  it('treats an empty or blank file as new', () => {
    expect(parse(mergeOpencodeMcp('  \n', 'delphi-dev-kb', entry)).mcp['delphi-dev-kb']).toEqual(entry);
  });
});

describe('removeOpencodeMcp edge cases', () => {
  it('refuses to touch JSONC / invalid files', () => {
    expect(removeOpencodeMcp('{ // x\n}', 'delphi-dev-kb')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('is a no-op when there is no mcp or no entry', () => {
    expect(removeOpencodeMcp('{"a":1}', 'delphi-dev-kb')).toEqual({ ok: true, text: '{"a":1}', changed: false });
    expect(removeOpencodeMcp('{"mcp":{"x":{}}}', 'delphi-dev-kb')).toEqual({ ok: true, text: '{"mcp":{"x":{}}}', changed: false });
  });

  it('round-trips: merge then remove keeps every user key', () => {
    const original = '{\n  "provider": { "x": 1 },\n  "mcp": { "a": { "type": "remote", "url": "u" } }\n}\n';
    const merged = mergeOpencodeMcp(original, 'delphi-dev-kb', entry);
    if (!merged.ok) throw new Error(merged.reason);
    expect(parse(removeOpencodeMcp(merged.text, 'delphi-dev-kb'))).toEqual(JSON.parse(original));
  });
});

describe('codex hooks.json edge cases', () => {
  it('refuses JSONC and structural surprises without rewriting', () => {
    expect(mergeCodexHooks('{ // x\n}', HOOKS)).toEqual({ ok: false, reason: 'invalid-json' });
    expect(mergeCodexHooks('[]', HOOKS)).toEqual({ ok: false, reason: 'not-an-object' });
    expect(mergeCodexHooks('{"hooks": []}', HOOKS)).toEqual({ ok: false, reason: 'hooks-not-an-object' });
    expect(mergeCodexHooks('{"hooks": {"PostToolUse": {}}}', HOOKS)).toEqual({ ok: false, reason: 'event-not-an-array' });
  });

  it('does not touch a user hook that only resembles ours (outside runtime/)', () => {
    const user = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node tools/hook-inject.mjs' }] }] } };
    const out = parse(mergeCodexHooks(JSON.stringify(user), HOOKS));
    expect(out.hooks.UserPromptSubmit).toHaveLength(2);
    expect(out.hooks.UserPromptSubmit[0].hooks[0].command).toBe('node tools/hook-inject.mjs');
    const removed = parse(removeCodexHooks(JSON.stringify(out)));
    expect(removed).toEqual(user);
  });

  it('follows a matcher change on a group that holds only our hook', () => {
    const first = mergeCodexHooks(null, HOOKS);
    if (!first.ok) throw new Error(first.reason);
    const widened = HOOKS.map((h) => (h.event === 'PostToolUse' ? { ...h, matcher: 'apply_patch|Write|Edit|MultiEdit' } : h));
    const out = parse(mergeCodexHooks(first.text, widened));
    expect(out.hooks.PostToolUse).toHaveLength(1);
    expect(out.hooks.PostToolUse[0].matcher).toBe('apply_patch|Write|Edit|MultiEdit');
  });

  it('keeps the matcher of a group the user shares with our hook', () => {
    const shared = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [
      { type: 'command', command: 'echo meu' },
      { type: 'command', command: 'node "C:/x/runtime/hook-fix-encoding.mjs"' },
    ] }] } };
    const out = parse(mergeCodexHooks(JSON.stringify(shared), HOOKS));
    expect(out.hooks.PostToolUse).toHaveLength(1);
    expect(out.hooks.PostToolUse[0].matcher).toBe('Bash');
    expect(out.hooks.PostToolUse[0].hooks).toHaveLength(2);
    expect(out.hooks.PostToolUse[0].hooks[1].commandWindows).toContain('hook-fix-encoding.mjs');
    expect(parse(removeCodexHooks(JSON.stringify(out))).hooks.PostToolUse[0].hooks).toEqual([{ type: 'command', command: 'echo meu' }]);
  });

  it('keeps BOM and CRLF', () => {
    const bom = String.fromCharCode(0xfeff);
    const original = `${bom}{\r\n  "outra": 1\r\n}\r\n`;
    const r = mergeCodexHooks(original, HOOKS);
    if (!r.ok) throw new Error(r.reason);
    expect(r.text.startsWith(bom)).toBe(true);
    expect(r.text.replace(/\r\n/g, '')).not.toContain('\n');
    expect(JSON.parse(r.text.slice(1)).outra).toBe(1);
  });

  it('remove does not rewrite the file when there is nothing of ours', () => {
    const user = '{ "hooks": { "PostToolUse": [] , "Stop": [{"hooks":[{"type":"command","command":"echo x"}]}] } }';
    expect(removeCodexHooks(user)).toEqual({ ok: true, text: user, changed: false });
    expect(removeCodexHooks('{}')).toEqual({ ok: true, text: '{}', changed: false });
  });

  it('remove keeps an empty array that belongs to the user while cleaning ours', () => {
    const merged = mergeCodexHooks(JSON.stringify({ hooks: { Stop: [] } }), HOOKS);
    if (!merged.ok) throw new Error(merged.reason);
    expect(parse(removeCodexHooks(merged.text))).toEqual({ hooks: { Stop: [] } });
  });

  it('remove refuses invalid JSON', () => {
    expect(removeCodexHooks('{ nope')).toEqual({ ok: false, reason: 'invalid-json' });
  });
});
