import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

// Claude Code non-regression guard: the surface the Claude harness reads must match the committed baseline.
// A failure here is a prompt to review the diff; accept intentional changes with
//   node kb/scripts/claude-surface.mjs --write
describe('claude code surface', () => {
  it('matches the committed baseline', () => {
    const script = path.resolve(__dirname, '..', 'scripts', 'claude-surface.mjs');
    const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});
