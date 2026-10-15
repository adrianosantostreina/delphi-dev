export const LEARNING_HEADING = 'Aprendizado / Learning';

/** Issue forms render each field as "### <label>\n\n<value>". */
export function extractLearning(issueBody: string): string | null {
  const text = issueBody.replace(/\r\n/g, '\n');
  const marker = `### ${LEARNING_HEADING}`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const after = text.slice(start + marker.length);
  const end = after.search(/\n### /);
  const value = (end < 0 ? after : after.slice(0, end)).trim();
  return value && value !== '_No response_' ? value : null;
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'aprendizado';
}

export function communityFileName(date: Date, slug: string, issue?: number): string {
  const day = date.toISOString().slice(0, 10);
  return `${day}${issue ? `-issue-${issue}` : ''}-${slug}.md`;
}
