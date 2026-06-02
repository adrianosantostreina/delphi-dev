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

export function removeHooks(): void {
  const settings = readSettings();
  const hooks = (settings.hooks as Record<string, unknown[]>) ?? {};
  for (const key of DELPHI_HOOK_KEYS) {
    delete hooks[key];
  }
  writeSettings({ ...settings, hooks });
}
