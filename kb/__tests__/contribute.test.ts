import { describe, it, expect } from 'vitest';
import { buildIssueUrl, contribute, ISSUE_URL_LIMIT, type ContributeDeps, type RunResult } from '../src/contribute';

const DOC = '---\ntitle: Conexão FireDAC no console\ncategory: bugs\ntags: firedac\nsource: community\n---\n# X\n\ncorpo\n';
const ok = (stdout = ''): RunResult => ({ status: 0, stdout, stderr: '' });
const fail: RunResult = { status: 1, stdout: '', stderr: 'nope' };

function deps(responses: (cmd: string, args: string[]) => RunResult) {
  const calls: string[][] = [];
  const opened: string[] = [];
  const copied: string[] = [];
  const d: ContributeDeps = {
    run: (cmd, args) => { calls.push([cmd, ...args]); return responses(cmd, args); },
    openUrl: (url) => opened.push(url),
    copyToClipboard: (text) => { copied.push(text); return true; },
    now: new Date('2026-10-14T10:00:00Z'),
  };
  return { d, calls, opened, copied };
}

describe('contribute via gh', () => {
  it('forks, creates branch and file, and opens the PR', () => {
    const { d, calls } = deps((_cmd, args) => {
      const joined = args.join(' ');
      if (joined.startsWith('api user')) return ok('octo\n');
      if (joined.includes('git/ref/heads/master')) return ok('deadbeef\n');
      if (args[0] === 'pr') return ok('https://github.com/adrianosantostreina/delphi-dev/pull/99\n');
      return ok();
    });
    const result = contribute(DOC, d);
    expect(result).toEqual({ via: 'pr', url: 'https://github.com/adrianosantostreina/delphi-dev/pull/99', clipboard: false });
    const branch = 'kb/2026-10-14-conexao-firedac-no-console';
    expect(calls).toContainEqual(['gh', 'repo', 'fork', 'adrianosantostreina/delphi-dev', '--clone=false']);
    expect(calls).toContainEqual(['gh', 'api', '-X', 'POST', 'repos/octo/delphi-dev/git/refs',
      '-f', `ref=refs/heads/${branch}`, '-f', 'sha=deadbeef']);
    const put = calls.find((c) => c.includes('PUT'))!;
    expect(put).toContain('repos/octo/delphi-dev/contents/knowledge/community/2026-10-14-conexao-firedac-no-console.md');
    expect(put).toContain(`content=${Buffer.from(DOC, 'utf8').toString('base64')}`);
    expect(calls.at(-1)).toEqual(expect.arrayContaining(['pr', 'create', '--repo', 'adrianosantostreina/delphi-dev', '--head', `octo:${branch}`]));
  });
});

describe('contribute via issue', () => {
  it('opens a prefilled issue when gh is not authenticated', () => {
    const { d, opened } = deps(() => fail);
    const result = contribute(DOC, d);
    expect(result.via).toBe('issue');
    expect(result.clipboard).toBe(false);
    expect(opened[0]).toBe(result.url);
    expect(result.url).toContain('template=kb-contribution.yml');
    expect(decodeURIComponent(result.url)).toContain('Conexão FireDAC no console');
  });

  it('falls back to the issue when a gh step fails midway', () => {
    const { d } = deps((_cmd, args) => (args[0] === 'auth' ? ok() : args.join(' ').startsWith('api user') ? ok('octo') : fail));
    expect(contribute(DOC, d).via).toBe('issue');
  });

  it('copies long text to the clipboard and opens the form without it', () => {
    const long = DOC + 'x'.repeat(ISSUE_URL_LIMIT);
    const { d, copied } = deps(() => fail);
    const result = contribute(long, d);
    expect(result.clipboard).toBe(true);
    expect(copied[0]).toBe(long);
    expect(result.url).not.toContain('learning=');
  });

  it('builds URLs with encoded parameters', () => {
    const { url, fits } = buildIssueUrl('A & B', 'linha 1\nlinha 2');
    expect(fits).toBe(true);
    expect(url).toBe(
      'https://github.com/adrianosantostreina/delphi-dev/issues/new?template=kb-contribution.yml' +
      '&title=kb%3A%20A%20%26%20B&learning=linha%201%0Alinha%202',
    );
  });
});
