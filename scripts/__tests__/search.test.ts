import { describe, it, expect } from 'vitest';
import { formatSearchResults } from '../src/search';

describe('formatSearchResults', () => {
  it('formats results as markdown context block', () => {
    const results = [
      { content: 'FireDAC driver must be registered', category: 'patterns', path: 'knowledge/core/firedac.md', distance: 0.1 },
      { content: 'Use TFDConnection.Connected := True only after drivers loaded', category: 'bugs', path: 'knowledge/core/firedac.md', distance: 0.2 },
    ];
    const output = formatSearchResults(results);
    expect(output).toContain('[RELEVANT KNOWLEDGE');
    expect(output).toContain('FireDAC driver');
    expect(output).toContain('[patterns]');
    expect(output).toContain('[bugs]');
  });

  it('returns empty string for no results', () => {
    expect(formatSearchResults([])).toBe('');
  });
});
