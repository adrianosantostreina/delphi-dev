export interface Frontmatter {
  data: Record<string, string>;
  keys: string[];
  body: string;
}

function fold(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line === '') {
      paragraphs.push(current.join(' '));
      current = [];
    } else {
      current.push(line);
    }
  }
  paragraphs.push(current.join(' '));
  return paragraphs.join('\n').trim();
}

/** YAML subset used by skills, commands and agents: top-level scalars and block scalars. */
export function readFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { data: {}, keys: [], body: text };

  const lines = match[1].split('\n');
  const data: Record<string, string> = {};
  const keys: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    i++;
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    keys.push(key);

    const block = value.match(/^([|>])[+-]?$/);
    if (block || value === '') {
      const collected: string[] = [];
      while (i < lines.length && (lines[i].trim() === '' || /^[ \t]/.test(lines[i]))) {
        collected.push(lines[i]);
        i++;
      }
      while (collected.length && collected[collected.length - 1].trim() === '') collected.pop();
      if (block) {
        const indents = collected.filter((l) => l.trim() !== '').map((l) => l.match(/^[ \t]*/)![0].length);
        const indent = indents.length ? Math.min(...indents) : 0;
        const body = collected.map((l) => (l.trim() === '' ? '' : l.slice(indent)));
        value = block[1] === '|' ? body.join('\n') : fold(body);
      } else {
        value = '';
      }
    } else {
      value = value.replace(/^(["'])([\s\S]*)\1$/, '$2');
    }
    data[key] = value;
  }
  return { data, keys, body: match[2] };
}
