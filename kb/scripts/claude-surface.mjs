#!/usr/bin/env node
// Claude Code non-regression guard.
// Snapshots everything the Claude Code harness reads from this plugin (manifests, hooks, MCP wiring,
// and the frontmatter of every command/agent/skill) and compares it with a committed baseline.
//   node kb/scripts/claude-surface.mjs --check      (default; exit 1 on drift)
//   node kb/scripts/claude-surface.mjs --write      (accept the current surface as the new baseline)
//   node kb/scripts/claude-surface.mjs --check --validate   (also runs `claude plugin validate`)
// A drift is not automatically a bug: it means a human must look at the diff and accept it with --write.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const BASELINE = path.join(ROOT, 'kb', '__tests__', 'fixtures', 'claude-surface.baseline.json');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^﻿/, ''));
  if (!m) return null;
  const out = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      out[key] = kv[2].trim();
    } else if (key && line.trim() !== '') {
      out[key] = `${out[key]} ${line.trim()}`.trim();
    }
  }
  return out;
}

// Ignores the release pins (version, and the beta source.ref) by design.
function withoutVersion(jsonText) {
  const data = JSON.parse(jsonText);
  const strip = (o) => {
    if (Array.isArray(o)) return o.map(strip);
    if (o && typeof o === 'object') {
      const r = {};
      // A pre-release pins the plugin source to its own tag (source.ref = v<version>), exactly like `version`:
      // a release pin that changes on every bump, not part of the surface. kb lint (version-sync) checks it.
      const releasePin = (k) => k === 'version' || (k === 'ref' && o.source === 'url' && typeof o.url === 'string');
      for (const k of Object.keys(o).sort()) if (!releasePin(k)) r[k] = strip(o[k]);
      return r;
    }
    return o;
  };
  return strip(data);
}

export function snapshot() {
  const surface = { manifests: {}, hooks: null, mcp: null, commands: {}, agents: {}, skills: {} };

  for (const rel of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
    surface.manifests[rel] = withoutVersion(read(rel));
  }
  surface.mcp = surface.manifests['.claude-plugin/plugin.json'].mcpServers ?? null;
  surface.hooks = exists('hooks/hooks.json') ? JSON.parse(read('hooks/hooks.json')) : null;
  surface.rootMcpJsonAbsent = !exists('.mcp.json'); // a root .mcp.json would break the KB server (v3.x lesson)

  for (const [dir, bucket] of [['commands', 'commands'], ['agents', 'agents']]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.md')).sort()) {
      surface[bucket][f] = frontmatter(read(`${dir}/${f}`));
    }
  }
  for (const d of fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const skill = `skills/${d.name}/SKILL.md`;
    surface.skills[d.name] = exists(skill) ? { frontmatter: frontmatter(read(skill)) } : { missing: true };
  }

  // Everything the runtime bundles import must exist: the MCP server and both hooks.
  surface.runtimeFiles = ['kb-mcp.mjs', 'hook-inject.mjs', 'hook-fix-encoding.mjs', 'kb-cli.mjs'].map((n) => [n, exists(`runtime/${n}`)]);
  surface.knowledgeFiles = fs.readdirSync(path.join(ROOT, 'knowledge')).length > 0;
  return surface;
}

function diff(a, b, prefix = '') {
  const out = [];
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diff(a[k], b[k], `${prefix}${prefix ? '.' : ''}${k}`));
    return out;
  }
  out.push(`${prefix}: baseline=${JSON.stringify(a)?.slice(0, 160)}  now=${JSON.stringify(b)?.slice(0, 160)}`);
  return out;
}

function main() {
  const write = process.argv.includes('--write');
  const now = snapshot();
  if (write) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    console.log(`baseline written: ${path.relative(ROOT, BASELINE)}`);
    return;
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const drift = diff(base, now);
  if (drift.length) {
    console.error('Claude Code surface drifted from the baseline:');
    for (const d of drift) console.error(`  - ${d}`);
    console.error('If intended, review the diff and accept it with: node kb/scripts/claude-surface.mjs --write');
    process.exit(1);
  }
  console.log('claude surface unchanged');
  if (process.argv.includes('--validate')) {
    for (const target of ['.claude-plugin/plugin.json', '.']) {
      const r = spawnSync('claude', ['plugin', 'validate', target, '--json'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
      let ok = r.status === 0;
      try {
        const rep = JSON.parse(r.stdout);
        ok = rep.success === true && [rep.manifest, ...(rep.contents ?? [])].every((c) => !c || (c.errors ?? []).length === 0);
      } catch {
        ok = false;
      }
      console.log(`claude plugin validate ${target}: ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) {
        console.error(r.stdout || r.stderr);
        process.exit(1);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
