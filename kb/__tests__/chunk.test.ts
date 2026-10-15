import { describe, it, expect } from 'vitest';
import { MAX_SECTION_CHARS, splitSections } from '../src/chunk';

describe('splitSections', () => {
  it('splits on H2 and keeps the intro', () => {
    const s = splitSections('# T\n\nintro\n\n## Sintoma\nA\n\n## Causa\nB\n');
    expect(s).toEqual([
      { heading: '', body: '# T\n\nintro' },
      { heading: 'Sintoma', body: 'A' },
      { heading: 'Causa', body: 'B' },
    ]);
  });

  it('does not split on H3 or on ## inside a code fence', () => {
    const s = splitSections('## A\n### sub\nx\n```\n## not a heading\n```\n');
    expect(s).toHaveLength(1);
    expect(s[0].heading).toBe('A');
    expect(s[0].body).toContain('## not a heading');
  });

  it('returns one section when there is no H2', () => {
    expect(splitSections('# T\n\nsó texto')).toEqual([{ heading: '', body: '# T\n\nsó texto' }]);
  });

  it('caps long sections by paragraph, keeping the heading', () => {
    const para = 'x'.repeat(1500);
    const s = splitSections(`## Longa\n${[para, para, para, para].join('\n\n')}`);
    expect(s.length).toBeGreaterThan(1);
    for (const part of s) {
      expect(part.heading).toBe('Longa');
      expect(part.body.length).toBeLessThanOrEqual(MAX_SECTION_CHARS);
    }
  });

  it('hard-splits a single paragraph longer than the cap', () => {
    const s = splitSections(`## Enorme\n${'y'.repeat(MAX_SECTION_CHARS * 2 + 10)}`);
    expect(s).toHaveLength(3);
    expect(s.every((p) => p.body.length <= MAX_SECTION_CHARS)).toBe(true);
  });
});
