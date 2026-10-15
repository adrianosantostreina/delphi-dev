import { describe, it, expect } from 'vitest';
import { MAX_CHARS, MIN_CHARS, validateCommunityDoc } from '../src/validate';

const body = (n: number) => `# T\n\n${'a'.repeat(n)}`;
const doc = (fm: string, b = body(MIN_CHARS)) => `---\n${fm}\n---\n${b}`;
const GOOD = 'title: T\ncategory: bugs\ntags: a, b\nsource: community';

describe('validateCommunityDoc', () => {
  it('accepts a complete document', () => {
    expect(validateCommunityDoc(doc(GOOD))).toEqual([]);
  });

  it('requires the four frontmatter fields', () => {
    const errors = validateCommunityDoc(doc('title: T'));
    expect(errors).toEqual(expect.arrayContaining([
      'missing required frontmatter field: category',
      'missing required frontmatter field: tags',
      'missing required frontmatter field: source',
    ]));
  });

  it('rejects an unknown category', () => {
    expect(validateCommunityDoc(doc(GOOD.replace('bugs', 'misc')))[0]).toContain('invalid category');
  });

  it('enforces size limits', () => {
    expect(validateCommunityDoc(doc(GOOD, 'curto'))[0]).toContain('body too short');
    expect(validateCommunityDoc(doc(GOOD, body(MAX_CHARS + 10)))[0]).toContain('body too long');
  });

  it('blocks secrets', () => {
    const errors = validateCommunityDoc(doc(GOOD, `${body(MIN_CHARS)}\nPassword=Pr0d2026;`));
    expect(errors).toEqual([expect.stringContaining('secret (conn-string) at line 10')]);
  });

  it('reports a secret in the frontmatter, with raw-text line numbers', () => {
    const errors = validateCommunityDoc(doc(GOOD.replace('title: T', 'title: Password=Pr0d2026;')));
    expect(errors).toEqual([expect.stringMatching(/^secret \(conn-string\) at line 2: title: Password=Pr0d2026;/)]);
  });
});
