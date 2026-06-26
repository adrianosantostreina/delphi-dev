import { describe, it, expect } from 'vitest';
import { tierForPath } from '../src/build-rag';

describe('tierForPath', () => {
  it('maps community/ files to the community tier', () => {
    expect(tierForPath('community/some-note.md')).toBe('community');
    expect(tierForPath('community/sub/note.md')).toBe('community');
  });

  it('maps core/ and fmx/ files to canonical', () => {
    expect(tierForPath('core/naming.md')).toBe('canonical');
    expect(tierForPath('fmx/scroll.md')).toBe('canonical');
  });

  it('defaults unknown directories to canonical', () => {
    expect(tierForPath('whatever/x.md')).toBe('canonical');
    expect(tierForPath('top-level.md')).toBe('canonical');
  });
});
