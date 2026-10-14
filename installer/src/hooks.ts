import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PLUGIN_BASE = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const DELPHI_HOOK_KEYS = ['SubagentStop', 'Stop', 'UserPromptSubmit', 'PostToolUse'] as const;

function buildHooks(): Record<string, unknown[]> {
  return {
    SubagentStop: [{
      matcher: '*',
      hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/capture.js" --mode=agent` }],
    }],
    Stop: [{
      matcher: '*',
      hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/capture.js" --mode=session` }],
    }],
    UserPromptSubmit: [{
      matcher: '*',
      hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/search.js"` }],
    }],
    PostToolUse: [{
      matcher: 'Write|Edit',
      hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/hooks/fix-encoding.js"` }],
    }],
  };
}

function readSettings(): Record<string, unknown> {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Record<string, unknown>;
}

function writeSettings(settings: Record<string, unknown>): void {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function registerHooks(): void {
  const settings = readSettings();
  const existing = (settings.hooks as Record<string, unknown[]>) ?? {};
  const newHooks = buildHooks();
  const merged: Record<string, unknown[]> = { ...existing };
  for (const [event, handlers] of Object.entries(newHooks)) {
    if (!merged[event]) merged[event] = handlers;
  }
  writeSettings({ ...settings, hooks: merged });
}

interface HookCommand { command?: string }
interface HookGroup { hooks?: HookCommand[] }

// Matches every command registerHooks() ever wrote (v2.0–v2.2.1), with either path separator.
const DELPHI_HOOK_COMMAND = /delphi-dev[\\/](scripts[\\/](capture|search)|hooks[\\/]fix-encoding)\.js/;

function isDelphiHook(hook: HookCommand): boolean {
  return typeof hook.command === 'string' && DELPHI_HOOK_COMMAND.test(hook.command);
}

/** Removes only delphi-dev's own entries; hooks from the user or other plugins stay. */
export function removeHooks(): void {
  const settings = readSettings();
  const hooks = (settings.hooks as Record<string, HookGroup[]>) ?? {};
  for (const key of DELPHI_HOOK_KEYS) {
    const groups = hooks[key];
    if (!Array.isArray(groups)) continue;

    const kept = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((hook) => !isDelphiHook(hook)) }))
      .filter((group) => group.hooks.length > 0);

    if (kept.length > 0) hooks[key] = kept;
    else delete hooks[key];
  }
  writeSettings({ ...settings, hooks });
}
