import { describe, it, expect } from 'vitest';
import { chunkText, normalizeChunks } from '../src/capture';

describe('chunkText', () => {
  it('splits long text into chunks of max 300 tokens (approx)', () => {
    const longText = 'word '.repeat(400);
    const chunks = chunkText(longText, 300, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.split(' ').length).toBeLessThanOrEqual(350); // with overlap
    }
  });

  it('returns single chunk for short text', () => {
    const short = 'FireDAC requires driver registration';
    const chunks = chunkText(short, 300, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(short);
  });

  it('preserves content in chunks', () => {
    const text = 'word '.repeat(20);
    const chunks = chunkText(text, 10, 2);
    const allWords = chunks.join(' ').split(' ').filter(Boolean);
    expect(allWords.length).toBeGreaterThanOrEqual(20);
  });
});

describe('normalizeChunks', () => {
  it('removes empty and whitespace-only chunks', () => {
    const chunks = ['hello world', '   ', '', 'valid chunk'];
    expect(normalizeChunks(chunks)).toHaveLength(2);
  });

  it('trims chunks', () => {
    const chunks = ['  hello  '];
    expect(normalizeChunks(chunks)[0]).toBe('hello');
  });
});
