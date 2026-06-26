import * as fs from 'fs';

export const MIN_CHARS = 200;
export const MAX_CHARS = 8000;
export const DEDUP_THRESHOLD = 0.30;

const REQUIRED_FIELDS = ['title', 'category', 'tags', 'source'];
const VALID_CATEGORIES = ['bugs', 'architecture', 'patterns', 'failures', 'general'];

export function parseDoc(raw: string): { frontmatter: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }
  return { frontmatter, body: match[2] ?? '' };
}

export function validateFrontmatter(raw: string): string[] {
  const { frontmatter } = parseDoc(raw);
  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!frontmatter[field]) errors.push(`missing required frontmatter field: ${field}`);
  }
  if (frontmatter.category && !VALID_CATEGORIES.includes(frontmatter.category)) {
    errors.push(`invalid category "${frontmatter.category}" (must be one of ${VALID_CATEGORIES.join(', ')})`);
  }
  return errors;
}

export function validateSize(body: string): string[] {
  const len = body.trim().length;
  const errors: string[] = [];
  if (len < MIN_CHARS) errors.push(`body too short: ${len} chars (min ${MIN_CHARS})`);
  if (len > MAX_CHARS) errors.push(`body too long: ${len} chars (max ${MAX_CHARS})`);
  return errors;
}

function l2(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function nearestDistance(target: Float32Array, existing: Float32Array[]): number {
  let min = Infinity;
  for (const e of existing) {
    const d = l2(target, e);
    if (d < min) min = d;
  }
  return min;
}

// CLI: validate one or more community .md files. Exits non-zero on any failure.
// Dedup against the existing DB is wired in the workflow (Task 7) via embeddings;
// the pure validators above are what the unit tests exercise.
async function main(): Promise<void> {
  const files = process.argv.slice(2);
  let failed = false;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { body } = parseDoc(raw);
    const errors = [...validateFrontmatter(raw), ...validateSize(body)];
    if (errors.length) {
      failed = true;
      console.error(`FAIL ${file}:`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.log(`OK ${file}`);
    }
  }
  if (failed) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
