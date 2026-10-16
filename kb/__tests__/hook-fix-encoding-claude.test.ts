import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './helpers';

// Characterization of the hook exactly as Claude Code runs it on every Write/Edit/MultiEdit
// (hooks/hooks.json, PostToolUse): the REAL bundle, a real process, the real stdin payload.
// Whatever the input, it must exit 0 and print nothing, or Claude may read it as a hook error.
const BUNDLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'runtime', 'hook-fix-encoding.mjs');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function run(stdin: string | Buffer, cwd = tmpDir()) {
  const r = spawnSync('node', [BUNDLE], { input: stdin, cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Same shape Claude Code sends for PostToolUse. */
function claudePayload(toolName: string, toolInput: Record<string, unknown>, cwd: string): string {
  return JSON.stringify({
    session_id: 'abc123',
    transcript_path: '/tmp/transcript.jsonl',
    cwd,
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: { filePath: toolInput.file_path, success: true },
    tool_use_id: 'toolu_01',
  });
}

function expectSilent(r: { status: number | null; stdout: string; stderr: string }) {
  expect(r.status).toBe(0);
  expect(r.stdout).toBe('');
  expect(r.stderr).toBe('');
}

describe('hook-fix-encoding bundle, Claude Code payload', () => {
  it.each(['Write', 'Edit', 'MultiEdit'])('%s: .pas without BOM gets the BOM, silently', (tool) => {
    const dir = tmpDir();
    const file = path.join(dir, 'Unit1.pas');
    fs.writeFileSync(file, 'unit Unit1; // ação');
    const r = run(claudePayload(tool, { file_path: file, content: 'x' }, dir), dir);
    expectSilent(r);
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 3).equals(BOM)).toBe(true);
    expect(bytes.subarray(3).toString('utf8')).toBe('unit Unit1; // ação');
  });

  it('resolves a relative file_path against the payload cwd', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'Rel.dpr'), 'program Rel;');
    expectSilent(run(claudePayload('Write', { file_path: 'Rel.dpr' }, dir), tmpDir()));
    expect(fs.readFileSync(path.join(dir, 'Rel.dpr')).subarray(0, 3).equals(BOM)).toBe(true);
  });

  it('is idempotent: a .pas that already has the BOM stays byte-identical', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'Unit1.pas');
    const written = Buffer.concat([BOM, Buffer.from('unit Unit1;')]);
    fs.writeFileSync(file, written);
    expectSilent(run(claudePayload('Edit', { file_path: file }, dir), dir));
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it.each(['.dfm', '.fmx'])('%s never gets a BOM; ASCII form stays byte-identical', (ext) => {
    const dir = tmpDir();
    const file = path.join(dir, `Form1${ext}`);
    const written = Buffer.from('object Form1: TForm1\n  Caption = \'Teste\'\nend');
    fs.writeFileSync(file, written);
    expectSilent(run(claudePayload('Write', { file_path: file }, dir), dir));
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('.dfm with accents is rewritten as #NNN escapes (pure ASCII, no BOM), as today', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'Form1.dfm');
    fs.writeFileSync(file, "object Form1: TForm1\n  Caption = 'Serviço'\nend", 'utf8');
    expectSilent(run(claudePayload('Write', { file_path: file }, dir), dir));
    const bytes = fs.readFileSync(file);
    expect(bytes.toString('latin1')).toBe("object Form1: TForm1\n  Caption = 'Servi'#231'o'\nend");
  });

  it('a Latin-1 .pas and a UTF-16 .pas are left byte-identical', () => {
    const dir = tmpDir();
    const ansi = path.join(dir, 'Ansi.pas');
    const u16 = path.join(dir, 'U16.pas');
    const ansiBytes = Buffer.from('unit U; // a\xe7\xe3o', 'latin1');
    const u16Bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('unit U;', 'utf16le')]);
    fs.writeFileSync(ansi, ansiBytes);
    fs.writeFileSync(u16, u16Bytes);
    expectSilent(run(claudePayload('Write', { file_path: ansi }, dir), dir));
    expectSilent(run(claudePayload('Write', { file_path: u16 }, dir), dir));
    expect(fs.readFileSync(ansi).equals(ansiBytes)).toBe(true);
    expect(fs.readFileSync(u16).equals(u16Bytes)).toBe(true);
  });

  it.each(['notes.txt', 'README.md', 'data.json', 'script.js', 'Unit1.pas.bak'])('non-Delphi %s is untouched', (name) => {
    const dir = tmpDir();
    const file = path.join(dir, name);
    const written = Buffer.from('conteúdo com acentuação', 'utf8');
    fs.writeFileSync(file, written);
    expectSilent(run(claudePayload('Write', { file_path: file }, dir), dir));
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('a nonexistent file is silent and creates nothing', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'Missing.pas');
    expectSilent(run(claudePayload('Write', { file_path: file }, dir), dir));
    expect(fs.existsSync(file)).toBe(false);
  });

  it('a directory named like a source file is silent', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'Weird.pas'));
    expectSilent(run(claudePayload('Write', { file_path: path.join(dir, 'Weird.pas') }, dir), dir));
  });

  it.each([
    ['empty stdin', ''],
    ['whitespace only', '  \n'],
    ['invalid JSON', 'not json at all'],
    ['truncated JSON', '{"tool_input":{"file_path":'],
    ['JSON null', 'null'],
    ['JSON number', '42'],
    ['JSON array', '[]'],
    ['no tool_input', '{"tool_name":"Write"}'],
    ['tool_input is a string', '{"tool_input":"x.pas"}'],
    ['file_path is not a string', '{"tool_input":{"file_path":123}}'],
    ['invalid UTF-8 bytes', Buffer.from([0xff, 0xfe, 0x00, 0x7b])],
  ])('%s: silent, exit 0', (_name, stdin) => {
    expectSilent(run(stdin));
  });

  it('survives a payload whose file_path has a non-ASCII name', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'Ação.pas');
    fs.writeFileSync(file, 'unit A;');
    expectSilent(run(claudePayload('Write', { file_path: file }, dir), dir));
    expect(fs.readFileSync(file).subarray(0, 3).equals(BOM)).toBe(true);
  });
});
