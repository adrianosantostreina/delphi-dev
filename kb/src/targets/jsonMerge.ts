export type MergeResult = { ok: true; text: string; changed: boolean } | { ok: false; reason: string };

export interface HookEntry {
  event: string;
  matcher?: string;
  command: string;
  commandWindows?: string;
}

type Obj = Record<string, unknown>;

const OUR_HOOK = /runtime[\\/]hook-(?:fix-encoding|inject)\.mjs/;
const OUR_MCP = /runtime[\\/]kb-mcp\.mjs$/;
const BOM = String.fromCharCode(0xfeff);

function isObject(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Strict JSON only: comments (JSONC) and trailing commas are refused, never "repaired". A BOM is tolerated. */
function parseObject(text: string): { ok: true; value: Obj } | { ok: false; reason: string } {
  try {
    const value = JSON.parse(text.startsWith(BOM) ? text.slice(1) : text) as unknown;
    return isObject(value) ? { ok: true, value } : { ok: false, reason: 'not-an-object' };
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
}

function indentOf(text: string): string | number {
  const m = text.match(/^([ \t]+)"/m);
  return m ? m[1] : 2;
}

function render(value: unknown, original: string | null): string {
  const eol = original && original.includes('\r\n') ? '\r\n' : '\n';
  const indent = original ? indentOf(original) : 2;
  const bom = original && original.startsWith(BOM) ? BOM : '';
  return bom + JSON.stringify(value, null, indent).replace(/\n/g, eol) + eol;
}

function isOurMcp(entry: unknown): boolean {
  if (!isObject(entry) || !Array.isArray(entry.command)) return false;
  return entry.command.some((part) => typeof part === 'string' && OUR_MCP.test(part.replace(/\\/g, '/')));
}

export function mergeOpencodeMcp(text: string | null, name: string, entry: Obj): MergeResult {
  if (text === null || text.trim() === '') {
    const created = { $schema: 'https://opencode.ai/config.json', mcp: { [name]: entry } };
    return { ok: true, text: render(created, null), changed: true };
  }
  const parsed = parseObject(text);
  if (!parsed.ok) return parsed;
  const config = parsed.value;
  if (config.mcp !== undefined && !isObject(config.mcp)) return { ok: false, reason: 'mcp-not-an-object' };
  const mcp = (config.mcp as Obj | undefined) ?? {};
  const existing = mcp[name];
  let next: Obj = entry;
  if (existing !== undefined) {
    if (!isOurMcp(existing)) return { ok: false, reason: 'conflict' };
    // Our own entry: refresh what we own (type/command), keep what the user added (e.g. enabled:false).
    next = { ...(existing as Obj), ...entry };
    if (typeof (existing as Obj).enabled === 'boolean') next.enabled = (existing as Obj).enabled;
    if (JSON.stringify(next) === JSON.stringify(existing)) return { ok: true, text, changed: false };
  }
  mcp[name] = next;
  config.mcp = mcp;
  return { ok: true, text: render(config, text), changed: true };
}

export function removeOpencodeMcp(text: string, name: string): MergeResult {
  const parsed = parseObject(text);
  if (!parsed.ok) return parsed;
  const config = parsed.value;
  const mcp = config.mcp;
  if (!isObject(mcp) || !isOurMcp(mcp[name])) return { ok: true, text, changed: false };
  delete mcp[name];
  if (Object.keys(mcp).length === 0) delete config.mcp;
  return { ok: true, text: render(config, text), changed: true };
}

function scriptOf(command: unknown): string | undefined {
  return typeof command === 'string' ? command.match(/hook-(?:fix-encoding|inject)\.mjs/)?.[0] : undefined;
}

function isOurHook(hook: unknown): boolean {
  return isObject(hook) && OUR_HOOK.test(String(hook.command));
}

function hookObject(entry: HookEntry): Obj {
  const hook: Obj = { type: 'command', command: entry.command };
  if (entry.commandWindows) hook.commandWindows = entry.commandWindows;
  return hook;
}

export function mergeCodexHooks(text: string | null, entries: HookEntry[]): MergeResult {
  const blank = text === null || text.trim() === '';
  let root: Obj = {};
  if (!blank) {
    const parsed = parseObject(text as string);
    if (!parsed.ok) return parsed;
    root = parsed.value;
  }
  const before = JSON.stringify(root);
  if (root.hooks !== undefined && !isObject(root.hooks)) return { ok: false, reason: 'hooks-not-an-object' };
  const hooks = (root.hooks as Obj | undefined) ?? {};

  for (const entry of entries) {
    const current = hooks[entry.event];
    if (current !== undefined && !Array.isArray(current)) return { ok: false, reason: 'event-not-an-array' };
    const groups = (current as Obj[] | undefined) ?? [];
    const script = scriptOf(entry.command);
    let replaced = false;
    for (const group of groups) {
      const list = isObject(group) && Array.isArray(group.hooks) ? (group.hooks as Obj[]) : [];
      const at = list.findIndex((h) => isOurHook(h) && scriptOf((h as Obj).command) === script);
      if (at >= 0) {
        list[at] = hookObject(entry);
        // A group that holds only our hook follows our matcher; a shared group keeps the user's matcher.
        if (list.length === 1) {
          if (entry.matcher) group.matcher = entry.matcher;
          else delete group.matcher;
        }
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      const group: Obj = { hooks: [hookObject(entry)] };
      if (entry.matcher) group.matcher = entry.matcher;
      groups.push(group);
    }
    hooks[entry.event] = groups;
  }
  root.hooks = hooks;

  const changed = blank || before !== JSON.stringify(root);
  return { ok: true, text: changed ? render(root, text) : (text as string), changed };
}

export function removeCodexHooks(text: string): MergeResult {
  const parsed = parseObject(text);
  if (!parsed.ok) return parsed;
  const root = parsed.value;
  if (!isObject(root.hooks)) return { ok: true, text, changed: false };
  const hooks = root.hooks;
  let changed = false;
  for (const event of Object.keys(hooks)) {
    const groups = hooks[event];
    if (!Array.isArray(groups)) continue;
    let eventChanged = false;
    const kept: Obj[] = [];
    for (const group of groups as Obj[]) {
      const list = isObject(group) && Array.isArray(group.hooks) ? (group.hooks as Obj[]) : null;
      if (!list) {
        kept.push(group);
        continue;
      }
      const left = list.filter((h) => !isOurHook(h));
      if (left.length !== list.length) eventChanged = true;
      if (left.length > 0) kept.push({ ...group, hooks: left });
    }
    if (!eventChanged) continue;
    changed = true;
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
  }
  if (changed && Object.keys(hooks).length === 0) delete root.hooks;
  return { ok: true, text: changed ? render(root, text) : text, changed };
}
