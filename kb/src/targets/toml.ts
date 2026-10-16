export const BLOCK_START = '# >>> delphi-dev (gerenciado; nao edite entre os marcadores) >>>';
export const BLOCK_END = '# <<< delphi-dev <<<';

interface Range {
  start: number;
  end: number;
}

function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Finds every managed block. `corrupt` is true when a start marker has no end marker, or when a
 * second start marker shows up before the end: in both cases the extent of the block is a guess,
 * and a guess could swallow the user's own configuration, so callers must not edit such files.
 */
function scanBlocks(text: string): { ranges: Range[]; corrupt: boolean } {
  const ranges: Range[] = [];
  let pos = 0;
  for (;;) {
    const start = text.indexOf(BLOCK_START, pos);
    if (start < 0) return { ranges, corrupt: false };
    const end = text.indexOf(BLOCK_END, start + BLOCK_START.length);
    if (end < 0) return { ranges, corrupt: true };
    const nextStart = text.indexOf(BLOCK_START, start + BLOCK_START.length);
    if (nextStart >= 0 && nextStart < end) return { ranges, corrupt: true };
    ranges.push({ start, end: end + BLOCK_END.length });
    pos = end + BLOCK_END.length;
  }
}

/** True when the managed markers are unbalanced (unterminated or nested). */
export function hasManagedBlockProblem(text: string): boolean {
  return scanBlocks(text).corrupt;
}

/** Cuts the block out together with the blank line that separated it from the user's content. */
function cutRange(text: string, range: Range): string {
  const before = text.slice(0, range.start).replace(/(\r?\n)\r?\n$/, '$1');
  const after = text.slice(range.end).replace(/^\r?\n/, '');
  return before + after;
}

export function upsertManagedBlock(text: string, body: string): string {
  const scan = scanBlocks(text);
  if (scan.corrupt) throw new Error('toml-managed-block-corrupt: unterminated or nested delphi-dev markers');
  const eol = eolOf(text);
  const block = [BLOCK_START, ...body.replace(/\r\n/g, '\n').split('\n'), BLOCK_END].join(eol);
  const [first, ...extra] = scan.ranges;
  if (!first) {
    if (text.trim() === '') return block + eol;
    const separator = text.endsWith('\n') ? eol : eol + eol;
    return text + separator + block + eol;
  }
  let out = text;
  for (const range of [...extra].reverse()) out = cutRange(out, range);
  return out.slice(0, first.start) + block + out.slice(first.end);
}

export function removeManagedBlock(text: string): string {
  const scan = scanBlocks(text);
  if (scan.corrupt || scan.ranges.length === 0) return text;
  let out = text;
  for (const range of [...scan.ranges].reverse()) out = cutRange(out, range);
  return out.trim() === '' ? '' : out;
}

/** Parses a TOML dotted key (bare, "basic" or 'literal' parts) from the start of `s`. */
function parseKeyPath(s: string): { parts: string[]; rest: string } | null {
  const parts: string[] = [];
  let i = 0;
  for (;;) {
    while (s[i] === ' ' || s[i] === '\t') i++;
    const c = s[i];
    let part: string;
    if (c === '"') {
      let j = i + 1;
      let value = '';
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\' && j + 1 < s.length) j++;
        value += s[j];
        j++;
      }
      if (j >= s.length) return null;
      part = value;
      i = j + 1;
    } else if (c === "'") {
      const j = s.indexOf("'", i + 1);
      if (j < 0) return null;
      part = s.slice(i + 1, j);
      i = j + 1;
    } else {
      const m = /^[A-Za-z0-9_-]+/.exec(s.slice(i));
      if (!m) return null;
      part = m[0];
      i += part.length;
    }
    parts.push(part);
    while (s[i] === ' ' || s[i] === '\t') i++;
    if (s[i] === '.') {
      i++;
      continue;
    }
    return { parts, rest: s.slice(i) };
  }
}

function startsWithPath(path: string[], prefix: string[]): boolean {
  return path.length >= prefix.length && prefix.every((p, i) => path[i] === p);
}

/**
 * True when the TOML declares `table` (or anything under it) outside our managed block: `[a.b.c]`,
 * `[a.b.c.sub]`, `[[a.b.c.x]]`, dotted keys (`a.b.c.k = 1`), or an inline table under a parent
 * (`[a.b]` + `c = {...}`). A duplicate of the table would make the agent reject the whole config.
 * Conservative: a corrupted managed block counts as "everything is outside".
 */
export function hasTableOutsideBlock(text: string, table: string): boolean {
  const scan = scanBlocks(text);
  let rest = text;
  if (!scan.corrupt) for (const range of [...scan.ranges].reverse()) rest = rest.slice(0, range.start) + rest.slice(range.end);
  const target = table.split('.');
  let current: string[] = [];
  for (const raw of rest.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      const inner = line.startsWith('[[') ? line.slice(2) : line.slice(1);
      const header = parseKeyPath(inner);
      if (!header) continue;
      current = header.parts;
      if (startsWithPath(current, target)) return true;
      continue;
    }
    const key = parseKeyPath(line);
    if (!key || !key.rest.startsWith('=')) continue;
    const full = current.concat(key.parts);
    if (startsWithPath(full, target)) return true;
    const isParent = full.length < target.length && full.every((p, i) => target[i] === p);
    if (isParent && key.rest.includes(target[target.length - 1])) return true;
  }
  return false;
}

export function codexMcpBlockBody(serverScript: string): string {
  return ['[mcp_servers.delphi-dev-kb]', 'command = "node"', `args = [${JSON.stringify(serverScript)}]`].join('\n');
}
