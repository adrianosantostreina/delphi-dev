import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fixEncoding } from '../../hooks/fix-encoding';

const BOM = [0xef, 0xbb, 0xbf];

function startsWithBom(file: string): boolean {
  const buf = fs.readFileSync(file);
  return buf.length >= 3 && buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2];
}

describe('fixEncoding', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-encoding-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(['.pas', '.dpr', '.dpk', '.inc'])('adds BOM to %s source files', (ext) => {
    const file = path.join(dir, `Unit1${ext}`);
    fs.writeFileSync(file, 'unit Unit1;');

    fixEncoding(file);

    expect(startsWithBom(file)).toBe(true);
  });

  // dfm-fmx-sem-bom.md: a BOM before `object` breaks ObjectTextToBinary
  // ("Error creating form: Invalid stream format").
  it.each(['.dfm', '.fmx'])('never adds BOM to %s form files', (ext) => {
    const file = path.join(dir, `Form1${ext}`);
    fs.writeFileSync(file, 'object Form1: TForm1\nend');

    fixEncoding(file);

    expect(startsWithBom(file)).toBe(false);
  });

  it('does not add a second BOM', () => {
    const file = path.join(dir, 'Unit1.pas');
    fs.writeFileSync(file, Buffer.concat([Buffer.from(BOM), Buffer.from('unit Unit1;')]));

    fixEncoding(file);

    expect(fs.readFileSync(file).subarray(3, 6).equals(Buffer.from(BOM))).toBe(false);
  });
});
