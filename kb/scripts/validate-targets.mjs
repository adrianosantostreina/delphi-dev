#!/usr/bin/env node
// Validates the Codex and OpenCode targets against the REAL CLIs, in temporary folders.
// Never touches ~/.codex, ~/.config/opencode, ~/.agents, ~/.claude or ~/.delphi-dev: every
// child process gets HOME, USERPROFILE, CODEX_HOME, XDG_*_HOME and DELPHI_DEV_DATA pointing
// inside the work folder, and credential-looking variables are removed from its environment.
//
//   node kb/scripts/validate-targets.mjs [--codex <codex.exe>] [--opencode <opencode>] [--only codex|opencode]
//                                        [--checkout <repo>] [--work <dir>] [--live-opencode]
//
// Offline by default. --live-opencode sends ONE short prompt to opencode's anonymous free model, only
// to prove that the generated plugin is loaded and its hooks fire inside the real opencode.
// Does not run in CI (it needs the CLIs on the machine).
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const checkout = path.resolve(opt('checkout', path.join(here, '..', '..')));
const codexExe = opt('codex', 'codex');
const opencodeExe = opt('opencode', 'opencode');
const only = opt('only', 'all');
const live = flag('live-opencode');
const kbCli = path.join(checkout, 'runtime', 'kb-cli.mjs');
const MARKER = '.dd-validate-work';

const results = [];
const check = (target, name, ok, detail = '') => results.push({ target, name, status: ok ? 'PASS' : 'FAIL', detail: String(detail) });
const info = (target, name, detail) => results.push({ target, name, status: 'INFO', detail: String(detail) });
const skip = (target, name, detail) => results.push({ target, name, status: 'SKIP', detail: String(detail) });
const strip = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
const flat = (s, n = 200) => strip(String(s)).replace(/\s+/g, ' ').trim().slice(0, n);
const posix = (p) => p.replace(/\\/g, '/');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const inside = (p, dir) => {
  const rel = path.relative(path.resolve(dir).toLowerCase(), path.resolve(p).toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// ------------------------------------------------------------------ work folder
function prepareWork() {
  const given = opt('work', null);
  const realHome = os.homedir();
  const base = given ? path.resolve(given) : path.join(os.tmpdir(), `dd-validate-${process.pid}`);
  if (inside(base, realHome)) {
    // The agents look for skills in the parents of the project folder; inside the profile they would read ~/.claude and ~/.agents.
    console.error(`A pasta de trabalho (${base}) fica dentro do seu perfil (${realHome}); os agentes subiriam ate o perfil real.`);
    console.error('Use --work <pasta fora do perfil>, por exemplo --work D:/Temp/dd-validate');
    process.exit(2);
  }
  if (fs.existsSync(base)) {
    if (fs.readdirSync(base).length && !fs.existsSync(path.join(base, MARKER))) {
      console.error(`${base} nao esta vazia e nao foi criada por este script; nao vou apagar. Escolha outra --work.`);
      process.exit(2);
    }
    fs.rmSync(base, { recursive: true, force: true });
  }
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, MARKER), 'created by kb/scripts/validate-targets.mjs\n');
  return base;
}

if (!fs.existsSync(kbCli)) {
  console.error(`runtime/kb-cli.mjs nao encontrado em ${checkout}`);
  process.exit(2);
}
const work = prepareWork();
const mk = (...p) => {
  const dir = path.join(work, ...p);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Environment for a child process: all homes inside `base`, no credentials. */
function isoEnv(base, extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i.test(k)) continue;
    env[k] = v;
  }
  const home = path.join(base, 'home');
  fs.mkdirSync(home, { recursive: true });
  Object.assign(env, {
    HOME: home, USERPROFILE: home,
    CODEX_HOME: path.join(base, 'codex-home'),
    XDG_CONFIG_HOME: path.join(base, 'xdg', 'config'),
    XDG_DATA_HOME: path.join(base, 'xdg', 'data'),
    XDG_STATE_HOME: path.join(base, 'xdg', 'state'),
    XDG_CACHE_HOME: path.join(base, 'xdg', 'cache'),
    DELPHI_DEV_DATA: path.join(base, 'delphi-data'),
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    ...extra,
  });
  // A shell exports PWD/OLDPWD/INIT_CWD of the folder it was launched from; opencode trusts PWD over the real cwd.
  delete env.OLDPWD;
  delete env.INIT_CWD;
  return { env, home };
}

// ------------------------------------------------------------------ processes
const winQuote = (s) => (/[\s"&|<>^%]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGKILL');
  }
}

/** Runs a command to completion (or kills its whole tree after `timeout`). Never throws. */
function run(cmd, args, { env, cwd, timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' && !/\.exe$/i.test(cmd);
    if (env && cwd) env = { ...env, PWD: cwd };
    let child;
    try {
      child = shell
        ? spawn(`${winQuote(cmd)} ${args.map(winQuote).join(' ')}`, { shell: true, env, cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        : spawn(cmd, args, { env, cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ status: null, out: '', error });
      return;
    }
    let out = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeout);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ status: null, out, error }); });
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, out: strip(out), timedOut }); });
  });
}

/**
 * Drives `codex app-server --strict-config` over stdio (JSON-RPC, offline): lets us ask Codex itself what it loaded.
 * Returns { init, results: [..], notifs, stderr, exited }.
 */
function appServer(exe, cwd, env, calls, { timeout = 90000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(exe, ['app-server', '--strict-config'], { cwd, env: { ...env, PWD: cwd }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let stderr = '';
    let exited = false;
    let nextId = 0;
    const pending = new Map();
    const notifs = [];
    const done = (payload) => { killTree(child); resolve({ notifs, stderr: strip(stderr), exited, ...payload }); };
    const timer = setTimeout(() => done({ init: { error: 'timeout' }, results: [] }), timeout);
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line);
          if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else notifs.push(m);
        } catch { /* not JSON */ }
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', () => { exited = true; for (const p of pending.values()) p({ error: { message: 'process exited' } }); pending.clear(); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ notifs, stderr: String(error), exited: true, init: { error: String(error) }, results: [] }); });
    const send = (method, params) => new Promise((res) => {
      const id = ++nextId;
      pending.set(id, res);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
    (async () => {
      const init = await send('initialize', { clientInfo: { name: 'dd-validate', version: '0' }, capabilities: {} });
      if (init.error) { clearTimeout(timer); done({ init, results: [] }); return; }
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized' })}\n`);
      const out = [];
      for (const [method, params] of calls) out.push(await send(method, params));
      await new Promise((r) => setTimeout(r, 300)); // late notifications (config warnings)
      clearTimeout(timer);
      done({ init, results: out });
    })();
  });
}

function kb(verb, args, env) {
  return run(process.execPath, [kbCli, verb, ...args], { env, cwd: work });
}
const lastLine = (out) => out.trim().split('\n').pop();
const warningsOf = (out) => Number((out.match(/(\d+) aviso\(s\)/) ?? [])[1] ?? -1);

// ------------------------------------------------------------------ expectations from the checkout
const portable = JSON.parse(fs.readFileSync(path.join(checkout, 'portable.json'), 'utf8'));
const commandIds = portable.commands.map((c) => c.id);
const agentNames = fs.readdirSync(path.join(checkout, 'agents')).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, '')).sort();
const skillsFor = (target) => fs.readdirSync(path.join(checkout, 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(checkout, 'skills', e.name, 'SKILL.md')))
  .map((e) => e.name)
  .filter((n) => (portable.skills?.[n]?.targets ?? ['claude', 'codex', 'opencode']).includes(target))
  .sort();
const hasAll = (have, want) => want.filter((w) => !have.includes(w));
const walkFiles = (dir) => (!fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)])));

// ================================================================== OpenCode
async function validateOpencode() {
  const T = 'opencode';
  const base = mk('opencode');
  const { env, home } = isoEnv(base);
  const proj = mk('opencode', 'proj');
  const cfgDir = path.join(env.XDG_CONFIG_HOME, 'opencode');

  const version = await run(opencodeExe, ['--version'], { env, cwd: proj, timeout: 60000 });
  if (version.error || version.status !== 0) {
    skip(T, 'cli', `${opencodeExe} nao encontrado (use --opencode <caminho>)`);
    return;
  }
  info(T, 'cli version', flat(version.out));

  // Pre-existing user config that must survive install and uninstall.
  fs.mkdirSync(cfgDir, { recursive: true });
  const userConfig = { $schema: 'https://opencode.ai/config.json', theme: 'opencode', mcp: { 'user-own': { type: 'local', command: ['node', '-e', ''], enabled: false } } };
  fs.writeFileSync(path.join(cfgDir, 'opencode.json'), `${JSON.stringify(userConfig, null, 2)}\n`);

  // Safety: prove the CLI honours the isolated folders before letting it near anything else.
  const paths = await run(opencodeExe, ['debug', 'paths'], { env, cwd: proj, timeout: 60000 });
  const cfgLine = (paths.out.match(/^config\s+(.+)$/m) ?? [])[1] ?? '';
  const dataLine = (paths.out.match(/^data\s+(.+)$/m) ?? [])[1] ?? '';
  const isolated = !!cfgLine && inside(cfgLine.trim(), work) && inside(dataLine.trim(), work);
  check(T, 'isolation: config/data folders are inside the work folder', isolated, flat(paths.out, 160));
  if (!isolated) return;

  const inst = await kb('install', ['--target', 'opencode', '--home', home, '--checkout', checkout], env);
  check(T, 'kb-cli install exits 0 with 0 warnings', inst.status === 0 && warningsOf(inst.out) === 0, lastLine(inst.out));

  const doc = await kb('doctor', ['--target', 'opencode', '--home', home], env);
  check(T, 'kb-cli doctor exits 0', doc.status === 0, doc.out.trim().split('\n').map((l) => l.trim()).join(' | ').slice(0, 220));

  const again = await kb('install', ['--target', 'opencode', '--home', home, '--checkout', checkout], env);
  check(T, 'second install changes nothing (idempotent)', /\b0 gravado\(s\)/.test(again.out), lastLine(again.out));

  // --- skills
  const expectedSkills = skillsFor('opencode');
  const skills = await run(opencodeExe, ['debug', 'skill'], { env, cwd: proj, timeout: 90000 });
  let skillList = [];
  try { skillList = JSON.parse(skills.out.slice(skills.out.indexOf('['))); } catch { /* reported below */ }
  const mine = skillList.filter((s) => s.location && inside(s.location, home));
  const missingSkills = hasAll(mine.map((s) => s.name), expectedSkills);
  check(T, `${expectedSkills.length} knowledge skills discovered from ~/.agents/skills`, !!skillList.length && !missingSkills.length,
    missingSkills.length ? `missing: ${missingSkills.join(', ')}` : `${mine.length} found`);
  check(T, 'delphi-claudeignore is NOT installed', !skillList.some((s) => s.name === 'delphi-claudeignore'));
  const foreign = skillList.filter((s) => s.location && s.location !== '<built-in>' && !inside(s.location, work));
  check(T, 'no skill came from outside the work folder (isolation)', foreign.length === 0, foreign.length ? foreign.map((s) => s.name).join(', ') : 'ok');

  // --- config: commands, agents, mcp, plugin
  const cfg = await run(opencodeExe, ['debug', 'config'], { env, cwd: proj, timeout: 90000 });
  let json = null;
  try { json = JSON.parse(cfg.out.slice(cfg.out.indexOf('{'))); } catch { /* reported below */ }
  check(T, 'opencode.json accepted (debug config resolves to valid JSON)', !!json, json ? 'ok' : flat(cfg.out));
  if (json) {
    const commands = Object.keys(json.command ?? {}).filter((k) => k.startsWith('delphi-')).sort();
    const agents = Object.keys(json.agent ?? {}).filter((k) => k.startsWith('delphi-')).sort();
    check(T, `${commandIds.length} /delphi-* commands resolved`, commands.length === commandIds.length, commands.join(', '));
    check(T, `${agentNames.length} delphi-* agents resolved`, JSON.stringify(agents) === JSON.stringify(agentNames), agents.join(', '));
    const entry = json.mcp?.['delphi-dev-kb'];
    check(T, 'mcp delphi-dev-kb declared (local, enabled)', entry?.type === 'local' && entry?.enabled === true, JSON.stringify(entry ?? null).slice(0, 160));
    check(T, 'user mcp entry preserved by the merge', !!json.mcp?.['user-own'], 'mcp.user-own');
    const pluginUrl = (json.plugin ?? []).find((p) => /delphi-dev\.js$/.test(p));
    check(T, 'plugin delphi-dev.js registered from the config folder', !!pluginUrl, pluginUrl ?? 'not in plugin[]');
  }

  const agentList = await run(opencodeExe, ['agent', 'list'], { env, cwd: proj, timeout: 90000 });
  const listed = [...agentList.out.matchAll(/^(delphi-[a-z-]+) \(subagent\)/gm)].map((m) => m[1]).sort();
  check(T, 'opencode agent list shows the delphi agents', JSON.stringify(listed) === JSON.stringify(agentNames), listed.join(', '));

  const mcp = await run(opencodeExe, ['mcp', 'list'], { env, cwd: proj, timeout: 90000 });
  check(T, 'mcp delphi-dev-kb connected', /delphi-dev-kb\s+connected/.test(flat(mcp.out, 4000)), flat(mcp.out, 140));

  // --- plugin: loads as a module and its hooks behave (offline)
  const pluginFile = path.join(cfgDir, 'plugins', 'delphi-dev.js');
  try {
    const saved = { ...process.env };
    Object.assign(process.env, { DELPHI_DEV_DATA: env.DELPHI_DEV_DATA, HOME: home, USERPROFILE: home });
    const mod = await import(`${pathToFileURL(pluginFile).href}?v=${Date.now()}`);
    const hooks = await mod.default({ directory: proj });
    const names = Object.keys(hooks).sort();
    check(T, 'plugin imports and exposes chat.message, system.transform, tool.execute.after',
      JSON.stringify(names) === JSON.stringify(['chat.message', 'experimental.chat.system.transform', 'tool.execute.after']), names.join(', '));
    const prompt = 'como uso TFDQuery com parametros e transacao no Delphi FireDAC?';
    await hooks['chat.message']({}, { parts: [{ type: 'text', text: prompt }] });
    const output = { system: ['base'] };
    await hooks['experimental.chat.system.transform']({}, output);
    check(T, 'plugin injects knowledge into the system prompt (real hook-inject)', output.system.length === 2 && output.system[1].length > 40,
      `system entries: ${output.system.length}, injected chars: ${output.system[1]?.length ?? 0}`);
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  } catch (error) {
    check(T, 'plugin imports and runs', false, flat(error?.stack ?? error));
  }

  // --- live: the real opencode loads the plugin (opt-in, one prompt to the anonymous free model)
  if (live) {
    const stubRoot = mk('opencode', 'stub-root');
    fs.mkdirSync(path.join(stubRoot, 'runtime'), { recursive: true });
    const marker = path.join(stubRoot, 'inject-called.txt');
    fs.writeFileSync(path.join(stubRoot, 'runtime', 'hook-inject.mjs'),
      `import * as fs from 'node:fs';\nlet raw = '';\nprocess.stdin.setEncoding('utf8');\nfor await (const c of process.stdin) raw += c;\nfs.writeFileSync(${JSON.stringify(marker)}, raw);\n`);
    fs.writeFileSync(path.join(stubRoot, 'runtime', 'hook-fix-encoding.mjs'), '');
    const text = fs.readFileSync(pluginFile, 'utf8');
    const swapped = text.replace(/const ROOT = "[^"]*";/, `const ROOT = ${JSON.stringify(posix(stubRoot))};`);
    check(T, 'live: generated plugin has a ROOT line to point at the stub', swapped !== text);
    fs.writeFileSync(pluginFile, swapped);
    const r = await run(opencodeExe, ['run', 'responda apenas: ok'], { env: { ...env, OPENCODE_DISABLE_AUTOUPDATE: '1' }, cwd: proj, timeout: 120000 });
    const called = fs.existsSync(marker);
    let payload = {};
    try { payload = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch { /* reported below */ }
    check(T, 'live: real opencode loaded the plugin and fired its prompt hooks', called && String(payload.prompt ?? '').includes('responda'),
      called ? `hook payload: ${flat(JSON.stringify(payload), 120)}` : `no marker; run exited ${r.status}: ${flat(r.out, 120)}`);
    check(T, 'live: the hook payload carries the project folder as cwd', called && samePath(String(payload.cwd ?? ''), proj), String(payload.cwd ?? ''));
    fs.writeFileSync(pluginFile, text); // restore the generated file before uninstall
  } else {
    info(T, 'live: real opencode loads the plugin', 'not run (opt-in: --live-opencode; no log line or debug command reports plugin loading)');
  }

  // --- uninstall
  const un = await kb('uninstall', ['--target', 'opencode', '--home', home], env);
  check(T, 'kb-cli uninstall exits 0 with 0 warnings', un.status === 0 && warningsOf(un.out) === 0, lastLine(un.out));
  const leftovers = [
    ...walkFiles(path.join(home, '.agents')),
    ...walkFiles(path.join(cfgDir, 'commands')),
    ...walkFiles(path.join(cfgDir, 'agents')),
    ...walkFiles(path.join(cfgDir, 'plugins')),
  ];
  check(T, 'uninstall leaves no delphi files', leftovers.length === 0, leftovers.slice(0, 3).join(', ') || 'clean');
  let after = null;
  try { after = JSON.parse(fs.readFileSync(path.join(cfgDir, 'opencode.json'), 'utf8')); } catch { /* reported below */ }
  check(T, 'uninstall restored the user config (own entries kept, delphi-dev-kb gone)',
    !!after && after.theme === 'opencode' && !!after.mcp?.['user-own'] && !after.mcp?.['delphi-dev-kb'], JSON.stringify(after?.mcp ?? null).slice(0, 120));
  check(T, 'uninstall removed the manifest', !fs.existsSync(path.join(env.DELPHI_DEV_DATA, 'install-manifest.json')));
  const doc2 = await kb('doctor', ['--target', 'opencode', '--home', home], env);
  check(T, 'doctor fails after uninstall (nothing registered)', doc2.status === 1, flat(doc2.out, 100));
  const mcp2 = await run(opencodeExe, ['mcp', 'list'], { env, cwd: proj, timeout: 90000 });
  check(T, 'opencode no longer lists delphi-dev-kb after uninstall', !/delphi-dev-kb/.test(mcp2.out), flat(mcp2.out, 100));
}

// ================================================================== Codex
async function validateCodex() {
  const T = 'codex';
  const base = mk('codex');
  const { env, home } = isoEnv(base);
  const codexHome = env.CODEX_HOME;
  fs.mkdirSync(codexHome, { recursive: true });
  const proj = mk('codex', 'proj');

  const version = await run(codexExe, ['--version'], { env, cwd: proj, timeout: 60000 });
  if (version.error || version.status !== 0) {
    skip(T, 'cli', `${codexExe} nao encontrado (use --codex <caminho do codex.exe>)`);
    return;
  }
  info(T, 'cli version', flat(version.out));
  await run('git', ['init', '-q'], { cwd: proj, env });

  // Pre-existing user config that must survive install and uninstall.
  const userToml = '# user config\nmodel_reasoning_effort = "low"\n';
  fs.writeFileSync(path.join(codexHome, 'config.toml'), userToml);

  const projectInst = await kb('install', ['--target', 'codex', '--scope', 'project', '--project', proj, '--home', home, '--checkout', checkout], env);
  check(T, 'kb-cli install (project scope) exits 0 with 0 warnings', projectInst.status === 0 && warningsOf(projectInst.out) === 0, lastLine(projectInst.out));
  const userInst = await kb('install', ['--target', 'codex', '--home', home, '--checkout', checkout], env);
  check(T, 'kb-cli install (user scope) exits 0 with 0 warnings', userInst.status === 0 && warningsOf(userInst.out) === 0, lastLine(userInst.out));
  const doc = await kb('doctor', ['--target', 'codex', '--home', home], env);
  check(T, 'kb-cli doctor exits 0', doc.status === 0, doc.out.trim().split('\n').map((l) => l.trim()).join(' | ').slice(0, 220));
  const again = await kb('install', ['--target', 'codex', '--home', home, '--checkout', checkout], env);
  check(T, 'second install changes nothing (idempotent)', /\b0 gravado\(s\)/.test(again.out), lastLine(again.out));

  // --- ask Codex itself (app-server over stdio, --strict-config: unknown keys in config.toml are errors)
  const wanted = skillsFor('codex');
  const cmdSkills = commandIds.map((id) => `delphi-cmd-${id}`);
  const srv = await appServer(codexExe, proj, env, [
    ['skills/list', { cwds: [posix(proj)], forceReload: true }],
    ['hooks/list', { cwds: [posix(proj)] }],
    ['mcpServerStatus/list', {}],
  ]);
  const ok = !srv.init.error;
  check(T, 'app-server --strict-config starts with the generated config.toml', ok, ok ? `CODEX_HOME=${srv.init.result?.codexHome}` : flat(JSON.stringify(srv.init) + srv.stderr, 220));
  check(T, 'isolation: Codex runs with the temporary CODEX_HOME', ok && samePath(srv.init.result?.codexHome ?? '', codexHome), srv.init.result?.codexHome ?? '');
  if (ok && samePath(srv.init.result?.codexHome ?? '', codexHome)) {
    const [skillsRes, hooksRes, mcpRes] = srv.results;
    const repoSkills = (skillsRes.result?.data?.[0]?.skills ?? []).filter((s) => s.scope === 'repo').map((s) => s.name);
    const missingK = hasAll(repoSkills, wanted);
    check(T, `${wanted.length} knowledge skills discovered (project .agents/skills)`, !missingK.length, missingK.length ? `missing: ${missingK.join(', ')}` : `${wanted.length} found`);
    const missingC = hasAll(repoSkills, cmdSkills);
    check(T, `${cmdSkills.length} delphi-cmd-* skills discovered`, !missingC.length, missingC.length ? `missing: ${missingC.join(', ')}` : `${cmdSkills.length} found`);
    check(T, 'delphi-claudeignore is NOT installed', !repoSkills.includes('delphi-claudeignore'));
    check(T, 'skills/list reports no load errors', (skillsRes.result?.data?.[0]?.errors ?? []).length === 0, JSON.stringify(skillsRes.result?.data?.[0]?.errors ?? []).slice(0, 160));

    const hooks = hooksRes.result?.data?.[0]?.hooks ?? [];
    const events = hooks.map((h) => h.eventName).sort();
    check(T, 'hooks.json accepted: postToolUse + userPromptSubmit registered', JSON.stringify(events) === JSON.stringify(['postToolUse', 'userPromptSubmit']),
      events.join(', ') || flat(JSON.stringify(hooksRes), 160));
    check(T, 'hooks report no warnings/errors', (hooksRes.result?.data?.[0]?.errors ?? []).length === 0 && (hooksRes.result?.data?.[0]?.warnings ?? []).length === 0);
    info(T, 'hooks trust status', `${[...new Set(hooks.map((h) => h.trustStatus))].join(', ')} (hooks only fire after /hooks trust; manual)`);

    const server = (mcpRes.result?.data ?? []).find((s) => s.name === 'delphi-dev-kb');
    const tools = Object.keys(server?.tools ?? {});
    check(T, 'mcp delphi-dev-kb connects (initialize + tools/list)', !!server?.serverInfo && !server?.toolsError && tools.length > 0,
      server ? `server ${server.serverInfo?.name} ${server.serverInfo?.version}; tools: ${tools.join(', ')}` : 'server not listed');
    check(T, 'mcp exposes kb_search', tools.includes('kb_search'));

    const warnings = srv.notifs.filter((n) => n.method === 'configWarning').map((n) => n.params?.summary ?? '');
    const bad = warnings.filter((w) => /malformed agent role|failed to parse|unknown field|invalid/i.test(w));
    check(T, 'agents/*.toml loaded with no "malformed agent role" warning', bad.length === 0, bad.length ? flat(bad.join(' | '), 200) : `${agentNames.length} files in ${path.join(codexHome, 'agents')}`);
  }
  const agentFiles = fs.existsSync(path.join(codexHome, 'agents')) ? fs.readdirSync(path.join(codexHome, 'agents')).filter((n) => n.endsWith('.toml')).sort() : [];
  check(T, `${agentNames.length} agent TOML files installed`, JSON.stringify(agentFiles) === JSON.stringify(agentNames.map((n) => `${n}.toml`)), agentFiles.join(', '));

  // --- control: the checks above would notice a bad agent / bad key
  {
    const cbase = mk('codex-control');
    const { env: cenv } = isoEnv(cbase);
    fs.mkdirSync(path.join(cenv.CODEX_HOME, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(cenv.CODEX_HOME, 'agents', 'zz-broken.toml'), 'name = "broken"\n[[[ nope\n');
    const ctl = await appServer(codexExe, mk('codex-control', 'proj'), cenv, []);
    const seen = ctl.notifs.some((n) => /malformed agent role/.test(n.params?.summary ?? ''));
    check(T, 'control: Codex does warn about a malformed agent TOML (so the clean result above means something)', seen, seen ? 'warning observed' : flat(ctl.stderr, 160));
    fs.rmSync(path.join(cenv.CODEX_HOME, 'agents'), { recursive: true, force: true });
    fs.writeFileSync(path.join(cenv.CODEX_HOME, 'config.toml'), '[mcp_servers.x]\ncommand = "node"\nbogus_key = 1\n');
    const strict = await appServer(codexExe, mk('codex-control', 'proj'), cenv, [], { timeout: 30000 });
    check(T, 'control: --strict-config rejects an unknown key (so the clean start above means something)', !!strict.init.error || strict.exited, flat(JSON.stringify(strict.init) + strict.stderr, 160));
  }

  // --- model-visible list (project scope; user-scope skills root is the OS profile and cannot be redirected on Windows)
  const prompt = await run(codexExe, ['debug', 'prompt-input'], { env, cwd: proj, timeout: 90000 });
  const first = (() => { try { return JSON.parse(prompt.out)[0]?.content?.[0]?.text ?? ''; } catch { return ''; } })();
  const visible = wanted.filter((n) => new RegExp(`^- ${n}:`, 'm').test(first));
  check(T, 'knowledge skills are in the model-visible list', first !== '' && visible.length === wanted.length, `${visible.length}/${wanted.length}`);
  check(T, 'delphi-claudeignore is NOT in the model-visible list', first !== '' && !/^- delphi-claudeignore:/m.test(first));
  info(T, 'delphi-cmd-* in the model-visible list', cmdSkills.some((n) => new RegExp(`^- ${n}:`, 'm').test(first))
    ? 'visible' : 'hidden (allow_implicit_invocation=false); explicit $delphi-cmd-<name> still works');

  const mcpGet = await run(codexExe, ['mcp', 'get', 'delphi-dev-kb'], { env, cwd: proj, timeout: 60000 });
  check(T, 'codex mcp get delphi-dev-kb is stdio with kb-mcp.mjs', /transport:\s*stdio/.test(mcpGet.out) && /kb-mcp\.mjs/.test(mcpGet.out), flat(mcpGet.out, 160));

  // --- probe: does mcp_servers.<name> accept and honour `cwd`?
  {
    const cbase = mk('codex-cwd');
    const { env: cenv } = isoEnv(cbase);
    const target = mk('codex-cwd', 'target');
    const stub = path.join(cbase, 'stub-mcp.mjs');
    fs.writeFileSync(stub, [
      "import * as readline from 'node:readline';",
      "const rl = readline.createInterface({ input: process.stdin });",
      "const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');",
      "rl.on('line', (l) => { let m; try { m = JSON.parse(l); } catch { return; }",
      "  if (m.method === 'initialize') reply(m.id, { protocolVersion: m.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cwd=' + process.cwd(), version: '0' } });",
      "  else if (m.method === 'tools/list') reply(m.id, { tools: [] });",
      "  else if (m.id !== undefined) reply(m.id, {}); });",
    ].join('\n'));
    fs.mkdirSync(cenv.CODEX_HOME, { recursive: true });
    fs.writeFileSync(path.join(cenv.CODEX_HOME, 'config.toml'),
      `[mcp_servers.stub]\ncommand = "node"\nargs = [${JSON.stringify(posix(stub))}]\ncwd = ${JSON.stringify(posix(target))}\n`);
    const r = await appServer(codexExe, mk('codex-cwd', 'proj'), cenv, [['mcpServerStatus/list', {}]]);
    const name = r.results[0]?.result?.data?.[0]?.serverInfo?.name ?? '';
    const effective = name.startsWith('cwd=') && samePath(name.slice(4), target);
    info(T, 'mcp_servers.<name>.cwd accepted by --strict-config and applied to the server process', effective ? `yes (server saw ${name})` : `NO (${flat(name || r.stderr, 120)})`);
  }

  info(T, 'hooks fire', 'manual: Codex asks to trust the hooks (/hooks) and the model must edit a file (docs/testes-v4.0-codex-opencode.md)');
  info(T, 'project-scope agents (.codex/agents)', 'only load once the project is trusted; not exercised here');

  // --- uninstall
  const un = await kb('uninstall', ['--target', 'codex', '--home', home], env);
  check(T, 'kb-cli uninstall exits 0 with 0 warnings', un.status === 0 && warningsOf(un.out) === 0, lastLine(un.out));
  const leftovers = [
    ...walkFiles(path.join(home, '.agents')),
    ...walkFiles(path.join(proj, '.agents')),
    ...walkFiles(path.join(proj, '.codex')),
    ...walkFiles(path.join(codexHome, 'agents')),
  ];
  check(T, 'uninstall leaves no delphi files', leftovers.length === 0, leftovers.slice(0, 3).join(', ') || 'clean');
  const toml = fs.existsSync(path.join(codexHome, 'config.toml')) ? fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8') : null;
  check(T, 'uninstall restored config.toml (user content kept, managed block gone)', toml !== null && toml.includes('model_reasoning_effort') && !toml.includes('delphi-dev'),
    toml === null ? 'config.toml deleted' : flat(toml, 100));
  check(T, 'uninstall removed hooks.json entries', !fs.existsSync(path.join(codexHome, 'hooks.json')) || !fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8').includes('delphi-dev'));
  check(T, 'uninstall removed the manifest', !fs.existsSync(path.join(env.DELPHI_DEV_DATA, 'install-manifest.json')));
  const doc2 = await kb('doctor', ['--target', 'codex', '--home', home], env);
  check(T, 'doctor fails after uninstall (nothing registered)', doc2.status === 1, flat(doc2.out, 100));
  const after = await appServer(codexExe, proj, env, [['mcpServerStatus/list', {}]]);
  check(T, 'Codex no longer lists delphi-dev-kb after uninstall', !after.init.error && !(after.results[0]?.result?.data ?? []).some((s) => s.name === 'delphi-dev-kb'),
    flat(JSON.stringify(after.results[0]?.result?.data?.map((s) => s.name) ?? after.init), 100));
}

// ================================================================== run + report
if (only === 'all' || only === 'opencode') await validateOpencode();
if (only === 'all' || only === 'codex') await validateCodex();

console.log(`delphi-dev validate-targets  ${new Date().toISOString()}  node ${process.version}  ${process.platform}`);
console.log(`checkout: ${checkout}`);
const width = Math.max(...results.map((r) => r.name.length), 10);
for (const r of results) {
  console.log(`${r.status.padEnd(5)} ${r.target.padEnd(9)} ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n${results.filter((r) => r.status === 'PASS').length} PASS, ${failed} FAIL, ` +
  `${results.filter((r) => r.status === 'SKIP').length} SKIP, ${results.filter((r) => r.status === 'INFO').length} INFO`);
console.log(`pasta de trabalho: ${work}`);
process.exit(failed ? 1 : 0);
