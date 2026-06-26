import { describe, it, expect } from 'vitest';
import { formatSearchResults } from '../src/search';

describe('formatSearchResults', () => {
  it('labels each chunk with tier/category and injects the precedence directive', () => {
    const results = [
      { content: 'FireDAC driver must be registered', category: 'patterns', path: 'knowledge/core/firedac.md', distance: 0.1, tier: 'canonical' },
      { content: 'A community tip', category: 'general', path: 'knowledge/community/tip.md', distance: 0.4, tier: 'community' },
    ];
    const output = formatSearchResults(results);
    expect(output).toContain('[RELEVANT KNOWLEDGE');
    expect(output).toContain('[canonical/patterns]');
    expect(output).toContain('[community/general]');
    expect(output).toContain('Canonical é autoritativo');
    expect(output).toContain('FireDAC driver');
  });

  it('returns empty string for no results', () => {
    expect(formatSearchResults([])).toBe('');
  });
});
