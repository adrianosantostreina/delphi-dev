import { describe, it, expect } from 'vitest';
import {
  parseDoc, validateFrontmatter, validateSize, nearestDistance,
  MIN_CHARS, MAX_CHARS, DEDUP_THRESHOLD,
} from '../src/validate-contribution';

const GOOD_FM = [
  '---',
  'title: FireDAC pooling tip',
  'category: patterns',
  'tags: firedac, pooling',
  'source: jdoe',
  '---',
].join('\n');

describe('parseDoc', () => {
  it('splits frontmatter from body', () => {
    const { frontmatter, body } = parseDoc(`${GOOD_FM}\n\nThe body text.`);
    expect(frontmatter.title).toBe('FireDAC pooling tip');
    expect(frontmatter.category).toBe('patterns');
    expect(body.trim()).toBe('The body text.');
  });
});

describe('validateFrontmatter', () => {
  it('accepts all required fields with a valid category', () => {
    expect(validateFrontmatter(GOOD_FM)).toEqual([]);
  });

  it('reports each missing required field', () => {
    const raw = '---\ntitle: x\n---';
    const errors = validateFrontmatter(raw);
    expect(errors.some((e) => e.includes('category'))).toBe(true);
    expect(errors.some((e) => e.includes('tags'))).toBe(true);
    expect(errors.some((e) => e.includes('source'))).toBe(true);
  });

  it('rejects an unknown category', () => {
    const raw = GOOD_FM.replace('category: patterns', 'category: nonsense');
    expect(validateFrontmatter(raw).some((e) => e.includes('category'))).toBe(true);
  });
});

describe('validateSize', () => {
  it('rejects a body shorter than MIN_CHARS', () => {
    expect(validateSize('short').some((e) => e.includes('min'))).toBe(true);
  });
  it('rejects a body longer than MAX_CHARS', () => {
    expect(validateSize('x'.repeat(MAX_CHARS + 1)).some((e) => e.includes('max'))).toBe(true);
  });
  it('accepts a body within range', () => {
    expect(validateSize('y'.repeat(MIN_CHARS + 10))).toEqual([]);
  });
});

describe('nearestDistance', () => {
  it('returns the smallest L2 distance to the existing set', () => {
    const target = new Float32Array([1, 0, 0]);
    const existing = [new Float32Array([0, 1, 0]), new Float32Array([1, 0, 0])];
    expect(nearestDistance(target, existing)).toBeCloseTo(0, 5);
  });
  it('returns Infinity for an empty set', () => {
    expect(nearestDistance(new Float32Array([1]), [])).toBe(Infinity);
  });
});

describe('constants', () => {
  it('exposes calibration defaults', () => {
    expect(MIN_CHARS).toBe(200);
    expect(MAX_CHARS).toBe(8000);
    expect(DEDUP_THRESHOLD).toBe(0.30);
  });
});
