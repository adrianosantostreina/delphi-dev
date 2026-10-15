import { spawn, spawnSync } from 'node:child_process';
import { communityFileName, slugify } from './issue';
import { REPO } from './paths';
import { scanText } from './secret-scan';
import { parseFrontmatter } from './snapshot';

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type Runner = (cmd: string, args: string[]) => RunResult;

export interface ContributeDeps {
  run: Runner;
  openUrl(url: string): void;
  copyToClipboard(text: string): boolean;
  now: Date;
}

export interface ContributeResult {
  via: 'pr' | 'issue';
  url: string;
  clipboard: boolean;
}

export class SecretFoundError extends Error {}

export const ISSUE_URL_LIMIT = 7500;

export function buildIssueUrl(title: string, learning: string): { url: string; fits: boolean } {
  const base = `https://github.com/${REPO}/issues/new?template=kb-contribution.yml&title=${encodeURIComponent(`kb: ${title}`)}`;
  const full = `${base}&learning=${encodeURIComponent(learning)}`;
  return full.length <= ISSUE_URL_LIMIT ? { url: full, fits: true } : { url: base, fits: false };
}

function viaGh(raw: string, title: string, run: Runner, now: Date): string | null {
  const gh = (...args: string[]) => run('gh', args);
  if (gh('auth', 'status').status !== 0) return null;
  const user = gh('api', 'user', '--jq', '.login');
  const login = user.stdout.trim();
  if (user.status !== 0 || !login) return null;

  const slug = slugify(title);
  const branch = `kb/${now.toISOString().slice(0, 10)}-${slug}`;
  const file = `knowledge/community/${communityFileName(now, slug)}`;
  const fork = `${login}/delphi-dev`;

  if (gh('repo', 'fork', REPO, '--clone=false').status !== 0) return null;
  if (gh('repo', 'sync', fork, '--source', REPO).status !== 0) return null;
  const base = gh('api', `repos/${fork}/git/ref/heads/master`, '--jq', '.object.sha');
  if (base.status !== 0 || !base.stdout.trim()) return null;
  const steps: string[][] = [
    ['api', '-X', 'POST', `repos/${fork}/git/refs`, '-f', `ref=refs/heads/${branch}`, '-f', `sha=${base.stdout.trim()}`],
    ['api', '-X', 'PUT', `repos/${fork}/contents/${file}`, '-f', `message=kb: ${title}`,
      '-f', `content=${Buffer.from(raw, 'utf8').toString('base64')}`, '-f', `branch=${branch}`],
  ];
  for (const step of steps) if (gh(...step).status !== 0) return null;
  const pr = gh('pr', 'create', '--repo', REPO, '--head', `${login}:${branch}`, '--base', 'master',
    '--title', `kb: ${title}`, '--body', 'Contribuição enviada pelo /contribute-kb do delphi-dev. Revisar antes de mesclar.');
  const url = pr.stdout.trim().split('\n').pop() ?? '';
  return pr.status === 0 && url.startsWith('https://') ? url : null;
}

export function contribute(raw: string, deps: ContributeDeps): ContributeResult {
  // The gh route pushes to a public fork before CI runs: scan the whole text (frontmatter included) first.
  const findings = scanText(raw);
  if (findings.length) {
    throw new SecretFoundError(findings.map((f) => `line ${f.line} [${f.kind}] ${f.excerpt}`).join('\n'));
  }
  const { frontmatter, body } = parseFrontmatter(raw);
  const title = frontmatter.title || body.match(/^#\s+(.+)$/m)?.[1]?.trim() || 'Aprendizado';
  const prUrl = viaGh(raw, title, deps.run, deps.now);
  if (prUrl) return { via: 'pr', url: prUrl, clipboard: false };

  const { url, fits } = buildIssueUrl(title, raw);
  const clipboard = fits ? false : deps.copyToClipboard(raw);
  deps.openUrl(url);
  return { via: 'issue', url, clipboard };
}

export function defaultDeps(): ContributeDeps {
  const run: Runner = (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? String(r.error ?? '') };
  };
  return {
    run,
    now: new Date(),
    openUrl(url) {
      const [cmd, args] =
        process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
      const child = spawn(cmd as string, args as string[], { detached: true, stdio: 'ignore' });
      child.on('error', () => {}); // a missing opener must not raise an uncaught error
      child.unref();
    },
    copyToClipboard(text) {
      if (process.platform === 'win32') {
        const b64 = Buffer.from(text, 'utf8').toString('base64');
        const script = `Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))`;
        return run('powershell', ['-NoProfile', '-Command', script]).status === 0;
      }
      const candidates = process.platform === 'darwin' ? [['pbcopy', []]] : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']]];
      for (const [cmd, args] of candidates as [string, string[]][]) {
        const r = spawnSync(cmd, args, { input: text, encoding: 'utf8' });
        if (r.status === 0) return true;
      }
      return false;
    },
  };
}
