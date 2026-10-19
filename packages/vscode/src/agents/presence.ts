import * as path from 'node:path';
import type { AgentId } from './types';

/** true/false when we can tell whether the plugin is installed for the agent; undefined when we cannot. */
export function pluginPresent(
  agent: AgentId,
  home: string,
  env: NodeJS.ProcessEnv,
  exists: (p: string) => boolean,
  project?: string,
): boolean | undefined {
  if (agent === 'claude') return undefined;
  if (agent === 'codex') {
    const candidates = [path.join(home, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md')];
    if (project) candidates.push(path.join(project, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md'));
    return candidates.some(exists);
  }
  const config = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode', 'commands', 'delphi-audit.md');
  const candidates = [config];
  if (project) candidates.push(path.join(project, '.opencode', 'commands', 'delphi-audit.md'));
  return candidates.some(exists);
}

// BETA: the stable `delphi-dev` on npm (2.2.x) does not know `--target`, so a bare `npx delphi-dev --target ...`
// fails with "unknown option". Until 4.0.0 is the `latest` package, name the beta channel.
// When promoting to the final release, drop `@beta` here (see docs/release-beta.md).
export const INSTALLER_SPEC = 'delphi-dev@beta';

export function installCommandFor(agent: AgentId): string {
  return `npx ${INSTALLER_SPEC} --target ${agent}`;
}
