import { describe, it, expect } from 'vitest';
import { communityFileName, extractLearning, slugify } from '../src/issue';

describe('issue helpers', () => {
  it('extracts the learning section of an issue form', () => {
    const body = [
      '### Aprendizado / Learning', '', '---', 'title: X', '---', '# X', 'texto', '',
      '### Confirmação / Consent', '', '- [X] não contém dados',
    ].join('\r\n');
    expect(extractLearning(body)).toBe('---\ntitle: X\n---\n# X\ntexto');
  });

  it('keeps a learning that has its own ### heading', () => {
    const body = [
      '### Aprendizado / Learning', '', '---', 'title: X', '---', '# X', '### Detalhe', 'mais texto', '',
      '### Confirmação / Consent', '', '- [X] ok',
    ].join('\n');
    expect(extractLearning(body)).toBe('---\ntitle: X\n---\n# X\n### Detalhe\nmais texto');
  });

  it('takes the learning to the end of the text when the consent heading is absent', () => {
    const body = ['### Aprendizado / Learning', '', '# X', '### Detalhe', 'fim'].join('\n');
    expect(extractLearning(body)).toBe('# X\n### Detalhe\nfim');
  });

  it('returns null when the section is missing or empty', () => {
    expect(extractLearning('### Outra coisa\n\nx')).toBeNull();
    expect(extractLearning('### Aprendizado / Learning\n\n_No response_\n')).toBeNull();
  });

  it('builds safe slugs and file names', () => {
    expect(slugify('Conexão FireDAC: "AV" no console!')).toBe('conexao-firedac-av-no-console');
    expect(slugify('***')).toBe('aprendizado');
    expect(slugify('a'.repeat(100))).toHaveLength(60);
    expect(communityFileName(new Date('2026-10-14T10:00:00Z'), 'x-y', 42)).toBe('2026-10-14-issue-42-x-y.md');
    expect(communityFileName(new Date('2026-10-14T10:00:00Z'), 'x-y')).toBe('2026-10-14-x-y.md');
  });
});
