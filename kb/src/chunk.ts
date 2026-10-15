export interface Section {
  heading: string;
  body: string;
}

export const MAX_SECTION_CHARS = 4000;

function capSection(section: Section): Section[] {
  if (section.body.length <= MAX_SECTION_CHARS) return [section];
  const out: Section[] = [];
  let current = '';
  for (const para of section.body.split(/\n{2,}/)) {
    const pieces = para.length > MAX_SECTION_CHARS
      ? para.match(new RegExp(`[\\s\\S]{1,${MAX_SECTION_CHARS}}`, 'g')) ?? []
      : [para];
    for (const piece of pieces) {
      if (current && current.length + 2 + piece.length > MAX_SECTION_CHARS) {
        out.push({ heading: section.heading, body: current });
        current = '';
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) out.push({ heading: section.heading, body: current });
  return out;
}

export function splitSections(body: string): Section[] {
  const sections: Section[] = [];
  let heading = '';
  let lines: string[] = [];
  let inFence = false;

  const flush = (): void => {
    const text = lines.join('\n').trim();
    if (text || heading) sections.push(...capSection({ heading, body: text }));
    lines = [];
  };

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const h2 = inFence ? null : line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (h2) {
      flush();
      heading = h2[1];
      continue;
    }
    lines.push(line);
  }
  flush();
  return sections.length ? sections : [{ heading: '', body: body.trim() }];
}
