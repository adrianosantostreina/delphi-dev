export interface Finding {
  line: number;
  kind: string;
  excerpt: string;
}

interface Rule {
  kind: string;
  pattern: RegExp;
  /** Returns true when the match is a placeholder or documentation value. */
  allow?: (m: RegExpExecArray) => boolean;
}

const PLACEHOLDER = /^(\*+|<[^>]*>|x{3,}|\.{3}|suasenha|yourpassword|your_\w+|sua_\w+|seu_\w+)$/i;
const DOC_IP = /^(127\.0\.0\.1|0\.0\.0\.0|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+)$/;

const RULES: Rule[] = [
  { kind: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'aws-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { kind: 'jwt', pattern: /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g },
  {
    kind: 'conn-string',
    pattern: /\b(Password|Pwd)=([^;\s]+)/gi,
    allow: (m) => PLACEHOLDER.test(m[2]),
  },
  {
    kind: 'assignment',
    pattern: /\b(password|passwd|pwd|senha|secret|api[_-]?key|token)\b\s*:?=?\s*[:=]\s*['"]?([^\s'";]{6,}|<[^>]*>)/gi,
    allow: (m) => PLACEHOLDER.test(m[2]),
  },
  {
    kind: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    allow: (m) => DOC_IP.test(m[0]),
  },
  {
    kind: 'email',
    pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    allow: (m) => /@(example\.com|exemplo\.com\.br)$/i.test(m[0]),
  },
  { kind: 'cpf', pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  { kind: 'cnpj', pattern: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g },
  {
    kind: 'abs-path',
    pattern: /[A-Za-z]:\\Users\\([^\\\s]+)|\/(?:home|Users)\/([^/\s]+)/g,
    allow: (m) => /^public$/i.test(m[1] ?? m[2] ?? ''),
  },
];

export function scanText(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((content, index) => {
    const kinds = new Set<string>();
    for (const rule of RULES) {
      // assignment duplicates conn-string on lines like "Password=..."
      if (rule.kind === 'assignment' && kinds.has('conn-string')) continue;
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(content)) !== null) {
        if (!rule.allow?.(m)) {
          kinds.add(rule.kind);
          break;
        }
      }
    }
    for (const kind of kinds) findings.push({ line: index + 1, kind, excerpt: content.trim().slice(0, 120) });
  });
  return findings;
}
