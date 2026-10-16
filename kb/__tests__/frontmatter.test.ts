import { describe, it, expect } from 'vitest';
import { readFrontmatter } from '../src/frontmatter';

describe('readFrontmatter', () => {
  it('reads plain and quoted scalars', () => {
    const fm = readFrontmatter('---\nname: delphi-x\ndescription: "Com: dois pontos"\nmodel: \'inherit\'\n---\nCorpo\n');
    expect(fm.data).toEqual({ name: 'delphi-x', description: 'Com: dois pontos', model: 'inherit' });
    expect(fm.keys).toEqual(['name', 'description', 'model']);
    expect(fm.body).toBe('Corpo\n');
  });

  it('reads a literal block scalar keeping line breaks', () => {
    const fm = readFrontmatter('---\nname: a\ndescription: |\n  Linha um.\n  Linha dois.\nmodel: inherit\n---\nx');
    expect(fm.data.description).toBe('Linha um.\nLinha dois.');
    expect(fm.data.model).toBe('inherit');
  });

  it('reads a folded block scalar joining lines with spaces', () => {
    const fm = readFrontmatter('---\nname: a\ndescription: >\n  Primeira\n  segunda.\n\n  Novo paragrafo.\n---\nx');
    expect(fm.data.description).toBe('Primeira segunda.\nNovo paragrafo.');
  });

  it('records a key whose value is a nested mapping', () => {
    const fm = readFrontmatter('---\nname: a\nmetadata:\n  chave: valor\n---\nx');
    expect(fm.keys).toEqual(['name', 'metadata']);
    expect(fm.data.metadata).toBe('');
  });

  it('handles BOM and CRLF', () => {
    const fm = readFrontmatter('\uFEFF---\r\nname: a\r\ndescription: b\r\n---\r\ncorpo\r\n');
    expect(fm.data).toEqual({ name: 'a', description: 'b' });
    expect(fm.body).toBe('corpo\n');
  });

  it('returns the whole text as body when there is no frontmatter', () => {
    const fm = readFrontmatter('# Titulo\n');
    expect(fm).toEqual({ data: {}, keys: [], body: '# Titulo\n' });
  });
});
