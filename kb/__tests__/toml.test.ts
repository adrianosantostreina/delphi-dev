import { describe, it, expect } from 'vitest';
import {
  BLOCK_END, BLOCK_START, codexMcpBlockBody, hasManagedBlockProblem, hasTableOutsideBlock, removeManagedBlock,
  upsertManagedBlock,
} from '../src/targets/toml';

const SCRIPT = 'D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs';
const body = codexMcpBlockBody(SCRIPT);
const user = 'model = "gpt-5"\n\n[mcp_servers.outro]\ncommand = "x"\n';
const TABLE = 'mcp_servers.delphi-dev-kb';

describe('codex managed TOML block', () => {
  it('builds the mcp table with a path that has spaces', () => {
    expect(body).toBe(
      '[mcp_servers.delphi-dev-kb]\ncommand = "node"\nargs = ["D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs"]',
    );
  });

  it('escapes backslashes and quotes so the TOML string stays valid', () => {
    expect(codexMcpBlockBody('C:\\a "b"\\kb-mcp.mjs')).toContain('args = ["C:\\\\a \\"b\\"\\\\kb-mcp.mjs"]');
  });

  it('appends after the user content without touching it', () => {
    const out = upsertManagedBlock(user, body);
    expect(out.startsWith(user)).toBe(true);
    expect(out).toContain(`${BLOCK_START}\n${body}\n${BLOCK_END}\n`);
  });

  it('keeps the user content intact when the file has no trailing newline', () => {
    const noEol = 'model = "gpt-5"';
    const out = upsertManagedBlock(noEol, body);
    expect(out.startsWith(`${noEol}\n`)).toBe(true);
    expect(out).toContain(`${BLOCK_START}\n${body}\n${BLOCK_END}\n`);
  });

  it('creates the content for an empty file', () => {
    expect(upsertManagedBlock('', body)).toBe(`${BLOCK_START}\n${body}\n${BLOCK_END}\n`);
  });

  it('replaces the existing block instead of duplicating it', () => {
    const once = upsertManagedBlock(user, body);
    const twice = upsertManagedBlock(once, codexMcpBlockBody('C:/outro/runtime/kb-mcp.mjs'));
    expect(twice.split(BLOCK_START)).toHaveLength(2);
    expect(twice).toContain('C:/outro/runtime/kb-mcp.mjs');
    expect(twice).not.toContain('D:/2.2 GitHub');
  });

  it('is idempotent', () => {
    const once = upsertManagedBlock(user, body);
    expect(upsertManagedBlock(once, body)).toBe(once);
  });

  it('keeps CRLF files in CRLF, idempotent and reversible', () => {
    const crlf = 'model = "gpt-5"\r\n';
    const out = upsertManagedBlock(crlf, body);
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
    expect(upsertManagedBlock(out, body)).toBe(out);
    expect(removeManagedBlock(out)).toBe(crlf);
  });

  it('removes the block and gives the user content back', () => {
    expect(removeManagedBlock(upsertManagedBlock(user, body))).toBe(user);
    expect(removeManagedBlock(upsertManagedBlock('', body))).toBe('');
  });

  it('keeps the user content that comes after the block', () => {
    const middle = `a = 1\n\n${BLOCK_START}\n${body}\n${BLOCK_END}\nb = 2\n`;
    expect(removeManagedBlock(middle)).toBe('a = 1\nb = 2\n');
    const replaced = upsertManagedBlock(middle, codexMcpBlockBody('C:/n/runtime/kb-mcp.mjs'));
    expect(replaced.startsWith('a = 1\n')).toBe(true);
    expect(replaced.endsWith('b = 2\n')).toBe(true);
    expect(replaced).toContain('C:/n/runtime/kb-mcp.mjs');
  });

  it('is a no-op to remove when there is no block', () => {
    expect(removeManagedBlock(user)).toBe(user);
  });

  it('collapses duplicated managed blocks into one', () => {
    const block = `${BLOCK_START}\n${body}\n${BLOCK_END}\n`;
    const dup = `a = 1\n${block}\nmid = 2\n${block}`;
    const out = upsertManagedBlock(dup, body);
    expect(out.split(BLOCK_START)).toHaveLength(2);
    expect(out).toContain('mid = 2');
    expect(removeManagedBlock(dup)).not.toContain(BLOCK_START);
    expect(removeManagedBlock(dup)).toContain('mid = 2');
  });
});

describe('corrupted managed block (never guess, never eat user content)', () => {
  const noEnd = `a = 1\n${BLOCK_START}\n${body}\n[mcp_servers.meu]\ncommand = "meu"\n`;
  const nested = `${BLOCK_START}\n${body}\n[mcp_servers.meu]\ncommand = "meu"\n${BLOCK_START}\n${body}\n${BLOCK_END}\n`;

  it('flags start without end and a start inside another block', () => {
    expect(hasManagedBlockProblem(noEnd)).toBe(true);
    expect(hasManagedBlockProblem(nested)).toBe(true);
    expect(hasManagedBlockProblem(upsertManagedBlock(user, body))).toBe(false);
    expect(hasManagedBlockProblem(user)).toBe(false);
  });

  it('upsert refuses to touch a corrupted file', () => {
    expect(() => upsertManagedBlock(noEnd, body)).toThrow(/unterminated|corrupt/i);
    expect(() => upsertManagedBlock(nested, body)).toThrow(/unterminated|corrupt/i);
  });

  it('remove leaves a corrupted file exactly as it was', () => {
    expect(removeManagedBlock(noEnd)).toBe(noEnd);
    expect(removeManagedBlock(nested)).toBe(nested);
  });
});

describe('hasTableOutsideBlock', () => {
  it('detects the same table outside the block, quoted or not', () => {
    expect(hasTableOutsideBlock('[mcp_servers.delphi-dev-kb]\ncommand = "x"\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('[mcp_servers."delphi-dev-kb"]\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock("[mcp_servers.'delphi-dev-kb']\n", TABLE)).toBe(true);
    expect(hasTableOutsideBlock('[ mcp_servers . delphi-dev-kb ] # meu\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('  [mcp_servers.delphi-dev-kb]\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock(user, TABLE)).toBe(false);
  });

  it('ignores the same table when it is inside the managed block', () => {
    expect(hasTableOutsideBlock(upsertManagedBlock(user, body), TABLE)).toBe(false);
  });

  it('detects the user own copy even when our block is also present', () => {
    const both = upsertManagedBlock('[mcp_servers.delphi-dev-kb]\ncommand = "meu"\n', body);
    expect(hasTableOutsideBlock(both, TABLE)).toBe(true);
  });

  it('detects sub-tables and array tables of the same server', () => {
    expect(hasTableOutsideBlock('[mcp_servers.delphi-dev-kb.env]\nA = "1"\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('[[mcp_servers.delphi-dev-kb.tools]]\nname = "x"\n', TABLE)).toBe(true);
  });

  it('detects the server declared with dotted keys or inline tables', () => {
    expect(hasTableOutsideBlock('mcp_servers.delphi-dev-kb.command = "node"\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('[mcp_servers]\ndelphi-dev-kb = { command = "node" }\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('[mcp_servers]\n"delphi-dev-kb".command = "node"\n', TABLE)).toBe(true);
    expect(hasTableOutsideBlock('mcp_servers = { delphi-dev-kb = { command = "node" } }\n', TABLE)).toBe(true);
  });

  it('does not flag different servers, similar names, comments or other tables', () => {
    expect(hasTableOutsideBlock('[mcp_servers.delphi-dev-kb-2]\n', TABLE)).toBe(false);
    expect(hasTableOutsideBlock('[mcp_servers.other]\ncommand = "delphi-dev-kb"\n', TABLE)).toBe(false);
    expect(hasTableOutsideBlock('# [mcp_servers.delphi-dev-kb]\n', TABLE)).toBe(false);
    expect(hasTableOutsideBlock('[mcp_servers]\nother = { command = "node" }\n', TABLE)).toBe(false);
    expect(hasTableOutsideBlock('[projects.delphi-dev-kb]\n', TABLE)).toBe(false);
    expect(hasTableOutsideBlock('[other]\ndelphi-dev-kb = 1\n', TABLE)).toBe(false);
  });

  it('works with CRLF text', () => {
    expect(hasTableOutsideBlock('model = "x"\r\n[mcp_servers.delphi-dev-kb]\r\ncommand = "x"\r\n', TABLE)).toBe(true);
  });

  it('is conservative with a corrupted block (counts everything as outside)', () => {
    expect(hasTableOutsideBlock(`${BLOCK_START}\n${body}\n`, TABLE)).toBe(true);
  });
});
