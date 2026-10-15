import { scanText } from './secret-scan';
import { parseFrontmatter } from './snapshot';

export const MIN_CHARS = 200;
export const MAX_CHARS = 8000;
export const VALID_CATEGORIES = ['bugs', 'architecture', 'patterns', 'failures', 'general'];
const REQUIRED_FIELDS = ['title', 'category', 'tags', 'source'];

export function validateCommunityDoc(raw: string): string[] {
  const { frontmatter, body } = parseFrontmatter(raw);
  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!frontmatter[field]) errors.push(`missing required frontmatter field: ${field}`);
  }
  if (frontmatter.category && !VALID_CATEGORIES.includes(frontmatter.category)) {
    errors.push(`invalid category "${frontmatter.category}" (must be one of ${VALID_CATEGORIES.join(', ')})`);
  }
  const len = body.trim().length;
  if (len < MIN_CHARS) errors.push(`body too short: ${len} chars (min ${MIN_CHARS})`);
  if (len > MAX_CHARS) errors.push(`body too long: ${len} chars (max ${MAX_CHARS})`);
  for (const f of scanText(body)) errors.push(`secret (${f.kind}) at body line ${f.line}: ${f.excerpt}`);
  return errors;
}
