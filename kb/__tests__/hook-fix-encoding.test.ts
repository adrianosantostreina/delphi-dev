import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { escapeFormText, extractPatchPaths, fixEncoding, main, pathsFromPayload } from '../src/hook-fix-encoding';
import { tmpDir } from './helpers';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const hasBom = (file: string) => fs.readFileSync(file).subarray(0, 3).equals(BOM);

describe('escapeFormText', () => {
  it.each([
    ["Caption = 'Serviço'", "Caption = 'Servi'#231'o'"],
    ["Text = 'Ação'", "Text = 'A'#231#227'o'"],
    ["Caption = 'Ótimo'", "Caption = #211'timo'"],
    ["Caption = 'ç'", 'Caption = #231'],
    ["Caption = 'D''Ávila'", "Caption = 'D'''#193'vila'"],
    ["Caption = '😀'", 'Caption = #55357#56832'],
    ["Caption = 'sem acento'", "Caption = 'sem acento'"],
    ["Caption = ''", "Caption = ''"],
    ["Lines.Strings = (\n  'Primeira'\n  'Opção')", "Lines.Strings = (\n  'Primeira'\n  'Op'#231#227'o')"],
  ])('escapes %s', (input, expected) => {
    expect(escapeFormText(input)).toEqual({ text: expected, nonAsciiOutsideStrings: false });
  });

  it('leaves non-ASCII identifiers alone and reports them', () => {
    const r = escapeFormText("object mnItOpções: TMenuItem\n  Caption = 'Opções'\nend");
    expect(r.text).toBe("object mnItOpções: TMenuItem\n  Caption = 'Op'#231#245'es'\nend");
    expect(r.nonAsciiOutsideStrings).toBe(true);
  });

  it('throws on an unterminated string literal', () => {
    expect(() => escapeFormText("Caption = 'sem fim\nend")).toThrow('unterminated string literal');
  });
});

describe('fixEncoding', () => {
  it('leaves an ANSI (Latin-1) form byte-for-byte untouched', () => {
    const file = path.join(tmpDir(), 'Form1.dfm');
    const written = Buffer.from("object Form1: TForm1\n  Caption = 'Servi\xe7o'\nend", 'latin1');
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('leaves a binary form (TPF0) byte-for-byte untouched', () => {
    const file = path.join(tmpDir(), 'Form1.dfm');
    const written = Buffer.concat([Buffer.from('TPF0'), Buffer.from([0x06, 0x54, 0xe7, 0x00])]);
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('leaves a form with an unterminated literal byte-for-byte untouched', () => {
    const file = path.join(tmpDir(), 'Form1.dfm');
    const written = Buffer.from("object F: TForm\n  Caption = 'Opção\nend", 'utf8');
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it.each(['.pas', '.dpr', '.dpk', '.inc'])('adds BOM to %s', (ext) => {
    const file = path.join(tmpDir(), `Unit1${ext}`);
    fs.writeFileSync(file, 'unit Unit1;');
    fixEncoding(file);
    expect(hasBom(file)).toBe(true);
  });

  it('leaves a UTF-16LE .pas untouched byte for byte', () => {
    const file = path.join(tmpDir(), 'U16.pas');
    const written = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('unit U;', 'utf16le')]);
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('leaves a UTF-16BE .pas untouched byte for byte', () => {
    const file = path.join(tmpDir(), 'U16be.pas');
    const written = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('unit U;', 'utf16le').swap16()]);
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('leaves a Latin-1 (ANSI) .pas untouched', () => {
    const file = path.join(tmpDir(), 'Ansi.pas');
    const written = Buffer.from('unit U; // ação', 'latin1');
    fs.writeFileSync(file, written);
    fixEncoding(file);
    expect(fs.readFileSync(file).equals(written)).toBe(true);
  });

  it('still adds the BOM to a valid UTF-8 .pas with accents', () => {
    const file = path.join(tmpDir(), 'Utf8.pas');
    fs.writeFileSync(file, Buffer.from('unit U; // ação', 'utf8'));
    fixEncoding(file);
    expect(hasBom(file)).toBe(true);
  });

  // dfm-fmx-sem-bom.md: a BOM before `object` breaks ObjectTextToBinary.
  it.each(['.dfm', '.fmx'])('never adds BOM to %s', (ext) => {
    const file = path.join(tmpDir(), `Form1${ext}`);
    fs.writeFileSync(file, 'object Form1: TForm1\nend');
    fixEncoding(file);
    expect(hasBom(file)).toBe(false);
  });

  // Raw UTF-8 without BOM is read as ANSI by the resource compiler ("ServiÃ§o").
  it.each(['.dfm', '.fmx'])('rewrites accents in %s as #NNN escapes, pure ASCII, no BOM', (ext) => {
    const file = path.join(tmpDir(), `Form1${ext}`);
    fs.writeFileSync(file, "object Form1: TForm1\n  Caption = 'Serviço'\nend");
    fixEncoding(file);
    const bytes = fs.readFileSync(file);
    expect(bytes.toString('latin1')).toBe("object Form1: TForm1\n  Caption = 'Servi'#231'o'\nend");
    expect(bytes.every((b) => b < 128)).toBe(true);
  });

  it('removes a BOM from a form once it becomes pure ASCII', () => {
    const file = path.join(tmpDir(), 'Form1.dfm');
    fs.writeFileSync(file, Buffer.concat([BOM, Buffer.from("object Form1: TForm1\n  Caption = 'Ação'\nend", 'utf8')]));
    fixEncoding(file);
    expect(hasBom(file)).toBe(false);
    expect(fs.readFileSync(file, 'latin1')).toContain("Caption = 'A'#231#227'o'");
  });

  it('keeps a load-bearing BOM when an identifier is non-ASCII', () => {
    const file = path.join(tmpDir(), 'Form1.dfm');
    const body = "object mnItOpções: TMenuItem\n  Caption = 'Opções'\nend";
    fs.writeFileSync(file, Buffer.concat([BOM, Buffer.from(body, 'utf8')]));
    fixEncoding(file);
    expect(hasBom(file)).toBe(true);
    expect(fs.readFileSync(file).subarray(3).toString('utf8')).toBe(
      "object mnItOpções: TMenuItem\n  Caption = 'Op'#231#245'es'\nend",
    );
  });

  it('does not rewrite a form that is already ASCII', () => {
    const file = path.join(tmpDir(), 'Form1.fmx');
    fs.writeFileSync(file, "object F: TForm\n  Caption = 'Servi'#231'o'\nend");
    const before = fs.statSync(file).mtimeMs;
    fixEncoding(file);
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('does not add a second BOM and ignores missing files', () => {
    const file = path.join(tmpDir(), 'Unit1.pas');
    fs.writeFileSync(file, Buffer.concat([BOM, Buffer.from('unit Unit1;')]));
    fixEncoding(file);
    expect(fs.readFileSync(file).subarray(3, 6).equals(BOM)).toBe(false);
    expect(() => fixEncoding(path.join(tmpDir(), 'nope.pas'))).not.toThrow();
  });
});

describe('payloads', () => {
  it('extracts add, update and move targets from an apply_patch', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: src/Unit1.pas',
      '+unit Unit1;',
      '*** Update File: src/Old.pas',
      '*** Move to: src/New.pas',
      '@@',
      '*** Update File: Form1.dfm',
      '*** End Patch',
    ].join('\r\n');
    expect(extractPatchPaths(patch)).toEqual(['src/Unit1.pas', 'src/Old.pas', 'src/New.pas', 'Form1.dfm']);
  });

  it('reads Claude Code file_path', () => {
    const file = path.join(tmpDir(), 'A.pas');
    expect(pathsFromPayload({ tool_name: 'Write', tool_input: { file_path: file } })).toEqual([path.resolve(file)]);
  });

  it('reads Codex apply_patch nested anywhere in tool_input, relative to cwd', () => {
    const cwd = tmpDir();
    const payload = {
      tool_name: 'apply_patch',
      cwd,
      tool_input: { command: ['apply_patch', '*** Begin Patch\n*** Add File: B.pas\n+x\n*** End Patch'] },
    };
    expect(pathsFromPayload(payload)).toEqual([path.join(cwd, 'B.pas')]);
  });

  it('ignores garbage payloads', () => {
    expect(pathsFromPayload(null)).toEqual([]);
    expect(pathsFromPayload({ tool_input: 42 })).toEqual([]);
  });
});

describe('main', () => {
  it('fixes every .pas in a Codex patch and leaves forms alone', async () => {
    const cwd = tmpDir();
    fs.writeFileSync(path.join(cwd, 'B.pas'), 'unit B;');
    fs.writeFileSync(path.join(cwd, 'F.fmx'), 'object F: TForm\nend');
    const payload = JSON.stringify({
      tool_name: 'apply_patch', cwd,
      tool_input: { patch: '*** Begin Patch\n*** Update File: B.pas\n*** Update File: F.fmx\n*** End Patch' },
    });
    await main(Readable.from([payload]));
    expect(hasBom(path.join(cwd, 'B.pas'))).toBe(true);
    expect(hasBom(path.join(cwd, 'F.fmx'))).toBe(false);
  });

  it('swallows invalid JSON', async () => {
    await expect(main(Readable.from(['not json']))).resolves.toBeUndefined();
  });

  it('keeps going after a file that fails (directory named A.pas)', async () => {
    const cwd = tmpDir();
    fs.mkdirSync(path.join(cwd, 'A.pas'));
    fs.writeFileSync(path.join(cwd, 'B.pas'), 'unit B;');
    const payload = JSON.stringify({
      tool_name: 'apply_patch', cwd,
      tool_input: { patch: '*** Begin Patch\n*** Update File: A.pas\n*** Update File: B.pas\n*** End Patch' },
    });
    await expect(main(Readable.from([payload]))).resolves.toBeUndefined();
    expect(hasBom(path.join(cwd, 'B.pas'))).toBe(true);
  });

  it('decodes stdin once, so a multi-byte character split across chunks survives', async () => {
    const cwd = tmpDir();
    fs.writeFileSync(path.join(cwd, 'Ação.pas'), 'unit A;');
    const payload = Buffer.from(JSON.stringify({ tool_name: 'Write', cwd, tool_input: { file_path: 'Ação.pas' } }), 'utf8');
    // Split inside the two-byte UTF-8 sequence of "ç" (0xC3 0xA7).
    const cut = payload.indexOf(0xc3) + 1;
    await main(Readable.from([payload.subarray(0, cut), payload.subarray(cut)]));
    expect(hasBom(path.join(cwd, 'Ação.pas'))).toBe(true);
  });
});
