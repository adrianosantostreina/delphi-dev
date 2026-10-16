# Núcleo portátil e entrega para Codex e OpenCode — Plano de implementação (3A + 3B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o `delphi-dev` funcionar no Codex e no OpenCode (terminal e VS Code) a partir deste repositório: núcleo de conteúdo portátil, geradores de arquivos por agente, `kb-cli install/uninstall/doctor/lint/fix-encoding` e `npx delphi-dev --target`.

**Architecture:** O conteúdo (`skills/`, `commands/`, `agents/`) é a fonte única. Funções puras em `kb/src/targets/` convertem esse conteúdo para o formato de cada agente; `kb/src/install/` grava com manifesto de propriedade e merge estrito; tudo entra no bundle commitado `runtime/kb-cli.mjs`. O pacote npm só clona o checkout `~/.delphi-dev/plugin` e chama o `kb-cli`.

**Tech Stack:** TypeScript 5.9 (módulo ESM, `kb/`), vitest 5.0.4, esbuild 0.28.2 (já fixados), Node ≥ 22.13 nos testes, `commander` no installer npm.

**Spec:** [`docs/superpowers/specs/2026-10-15-portable-delivery-design.md`](../specs/2026-10-15-portable-delivery-design.md). Base anterior: [`2026-10-14-kb-v4-design.md`](../specs/2026-10-14-kb-v4-design.md).

## Global Constraints

- Branch `feature/v4.0-multi-agente`. Commits em pt-BR `tipo(escopo): descrição`, terminando com a linha `Co-Authored-By` do modelo que fez o commit. **Push só com confirmação do usuário.** Nada de `npm publish`.
- Toda mudança em `kb/src/**` termina com `cd kb && npm run build:runtime` e o `runtime/*.mjs` regenerado **commitado junto** (o CI falha se divergir).
- `node:sqlite` só é carregado sob demanda (`createRequire`); bundles com `target: node18`. Nada novo pode importar `node:sqlite` estaticamente.
- Código em `kb/src` fica **ASCII** (exceto literais em português que já existem). Ferramentas de edição convertem `\uXXXX` em caracteres reais: depois de escrever, confira com `perl -ne 'print "$ARGV:$.\n" if /[^\x00-\x7F]/' <arquivo>`.
- **Nunca** apagar nem sobrescrever arquivo do usuário: toda escrita em pasta de agente passa por `writeOwnedFile`/`writeOwnedDir`/merge estrito (Tasks 8, 9, 14, 15).
- Testes **nunca** tocam o home real (`~`): sempre `tmpDir()` + parâmetro `home`. Nenhum teste chama `gh`, navegador ou rede.
- Caminhos gravados em TOML/JSON/JS usam `/` (mesmo no Windows) e funcionam com espaços (`D:/2.2 GitHub Adriano Santos/delphi-dev`).
- Texto de skills/commands/agents: neutro de ferramenta (lint de portabilidade, Task 2).
- Alvos: `claude` (intocado), `codex`, `opencode`. Invocação derivada: Claude `/<id>`, Codex `$delphi-cmd-<id>`, OpenCode `/delphi-<id>`.

## Review Focus

1. **Config do usuário preservada:** `opencode.json` com chaves e provedor próprios e **JSONC com comentários** (não tocar, imprimir trecho); `hooks.json` do Codex com hooks do usuário; `config.toml` com tabelas próprias **e** um `[mcp_servers.delphi-dev-kb]` pré-existente (não duplicar). (Tasks 8, 9, 15)
2. **Idempotência e desinstalação:** 2ª execução = 0 mudanças; `uninstall` devolve o arquivo ao estado anterior e não mexe em arquivo alterado pelo usuário. (Tasks 14, 15)
3. **Pasta `~/.agents/skills` compartilhada:** uma skill que não é nossa (sem marcador) nunca é tocada. (Tasks 14, 15)
4. **Caminhos com espaços e barras invertidas** em TOML, JSON e no JS do plugin do OpenCode. (Tasks 8, 13, 15)
5. **Descrição de agente com `<example>`, aspas, barras e `'''` no corpo** gera TOML e YAML válidos. (Task 10)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `portable.json` | Registro de comandos e exceções de skill por alvo |
| `kb/src/frontmatter.ts` | Leitor de frontmatter (subconjunto de YAML: `\|`, `>`, aspas) |
| `kb/src/registry.ts` | Tipos, validação, invocação por alvo |
| `kb/src/lint.ts` | Regras de portabilidade (`lintRepo`) |
| `kb/src/targets/toml.ts` | Bloco gerenciado no `config.toml` |
| `kb/src/targets/jsonMerge.ts` | Merge estrito de `opencode.json` e `hooks.json` |
| `kb/src/targets/agents.ts` | `agents/*.md` → TOML (Codex) e MD (OpenCode) |
| `kb/src/targets/commands.ts` | `commands/*.md` → skill do Codex e comando do OpenCode |
| `kb/src/targets/opencodePlugin.ts` | Gera `delphi-dev.js` do OpenCode |
| `kb/src/install/fsops.ts` | Propriedade: escrita, diretório, remoção, manifesto |
| `kb/src/install/install.ts` | `installTargets`, `uninstallTargets`, `doctor` |
| `kb/src/cli-install.ts` | Handlers dos subcomandos novos |
| `kb/scripts/validate-targets.mjs` | Validação com `codex.exe` e `opencode` reais |
| `installer/src/targets.ts` | Detecção/escolha de alvos, checkout, argumentos |
| `AGENTS.md` | Instruções do repo para Codex/OpenCode |
| `docs/testes-v4.0-codex-opencode.md` | Matriz manual |

---

## PARTE A — Núcleo portátil (3A)

### Task 1: Leitor de frontmatter, registro `portable.json` e helper de teste

**Files:**
- Create: `kb/src/frontmatter.ts`, `kb/src/registry.ts`, `portable.json`, `kb/__tests__/frontmatter.test.ts`, `kb/__tests__/registry.test.ts`
- Modify: `kb/__tests__/helpers.ts` (acrescenta `makeRepo`, `REAL_ROOT`)

**Interfaces:**
- Produces:
  - `readFrontmatter(raw: string): { data: Record<string,string>; keys: string[]; body: string }`
  - `type Target = 'claude'|'codex'|'opencode'`, `TARGETS`, `type Locale = 'pt-BR'|'en-US'`
  - `interface RegistryCommand { id; title: Record<Locale,string>; description: Record<Locale,string>; takesFile: boolean; icon: string }`
  - `interface Registry { schema: 1; skills: Record<string,{targets?: Target[]}>; commands: RegistryCommand[] }`
  - `validateRegistry(input: unknown): string[]`, `parseRegistry(raw: string): Registry`, `readRegistry(root: string): Registry`
  - `invocationFor(target: Target, id: string): string`, `skillTargets(reg: Registry, skill: string): Target[]`
  - `commandSkillName(id): string` (`delphi-cmd-<id>`), `opencodeCommandName(id): string` (`delphi-<id>`)
  - Helpers de teste: `makeRepo(over?: Record<string,string|null>): string`, `REAL_ROOT: string`

- [ ] **Step 1: Escrever os testes**

`kb/__tests__/frontmatter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFrontmatter } from '../src/frontmatter';

describe('readFrontmatter', () => {
  it('reads plain and quoted scalars', () => {
    const fm = readFrontmatter('---\nname: delphi-x\ndescription: "Com: dois pontos"\nmodel: \'inherit\'\n---\nCorpo\n');
    expect(fm.data).toEqual({ name: 'delphi-x', description: 'Com: dois pontos', model: 'inherit' });
    expect(fm.keys).toEqual(['name', 'description', 'model']);
    expect(fm.body).toBe('Corpo\n');
  });

  it('reads a literal block scalar keeping line breaks', () => {
    const fm = readFrontmatter('---\nname: a\ndescription: |\n  Linha um.\n  Linha dois.\nmodel: inherit\n---\nx');
    expect(fm.data.description).toBe('Linha um.\nLinha dois.');
    expect(fm.data.model).toBe('inherit');
  });

  it('reads a folded block scalar joining lines with spaces', () => {
    const fm = readFrontmatter('---\nname: a\ndescription: >\n  Primeira\n  segunda.\n\n  Novo paragrafo.\n---\nx');
    expect(fm.data.description).toBe('Primeira segunda.\nNovo paragrafo.');
  });

  it('records a key whose value is a nested mapping', () => {
    const fm = readFrontmatter('---\nname: a\nmetadata:\n  chave: valor\n---\nx');
    expect(fm.keys).toEqual(['name', 'metadata']);
    expect(fm.data.metadata).toBe('');
  });

  it('handles BOM and CRLF', () => {
    const fm = readFrontmatter('\uFEFF---\r\nname: a\r\ndescription: b\r\n---\r\ncorpo\r\n');
    expect(fm.data).toEqual({ name: 'a', description: 'b' });
    expect(fm.body).toBe('corpo\n');
  });

  it('returns the whole text as body when there is no frontmatter', () => {
    const fm = readFrontmatter('# Titulo\n');
    expect(fm).toEqual({ data: {}, keys: [], body: '# Titulo\n' });
  });
});
```

`kb/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  commandSkillName, invocationFor, opencodeCommandName, parseRegistry, readRegistry, skillTargets,
  validateRegistry, type Registry,
} from '../src/registry';
import { REAL_ROOT } from './helpers';

const good: Registry = {
  schema: 1,
  skills: { 'delphi-claudeignore': { targets: ['claude'] } },
  commands: [{
    id: 'new-project',
    title: { 'pt-BR': 'Novo projeto', 'en-US': 'New project' },
    description: { 'pt-BR': 'Estrutura padrao', 'en-US': 'Standard scaffold' },
    takesFile: false,
    icon: 'folder-opened',
  }],
};

describe('registry', () => {
  it('accepts a valid registry', () => {
    expect(validateRegistry(good)).toEqual([]);
    expect(parseRegistry(JSON.stringify(good))).toEqual(good);
  });

  it.each([
    ['schema', { ...good, schema: 2 }, 'schema'],
    ['target', { ...good, skills: { x: { targets: ['gemini'] } } }, 'targets'],
    ['id', { ...good, commands: [{ ...good.commands[0], id: 'Bad Id' }] }, 'id'],
    ['title', { ...good, commands: [{ ...good.commands[0], title: { 'pt-BR': '', 'en-US': 'x' } }] }, 'title'],
    ['duplicate', { ...good, commands: [good.commands[0], good.commands[0]] }, 'duplicate'],
    ['icon', { ...good, commands: [{ ...good.commands[0], icon: '' }] }, 'icon'],
  ])('rejects a registry with bad %s', (_n, input, fragment) => {
    const errors = validateRegistry(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(fragment);
    expect(() => parseRegistry(JSON.stringify(input))).toThrow();
  });

  it('derives the invocation of each target', () => {
    expect(invocationFor('claude', 'audit')).toBe('/audit');
    expect(invocationFor('codex', 'audit')).toBe('$delphi-cmd-audit');
    expect(invocationFor('opencode', 'audit')).toBe('/delphi-audit');
    expect(commandSkillName('new-project')).toBe('delphi-cmd-new-project');
    expect(opencodeCommandName('new-project')).toBe('delphi-new-project');
  });

  it('defaults a skill to every target and honors exclusions', () => {
    expect(skillTargets(good, 'delphi-write')).toEqual(['claude', 'codex', 'opencode']);
    expect(skillTargets(good, 'delphi-claudeignore')).toEqual(['claude']);
  });

  it('reads the real portable.json with the 11 plugin commands', () => {
    const reg = readRegistry(REAL_ROOT);
    expect(reg.commands.map((c) => c.id).sort()).toEqual([
      'about', 'audit', 'contribute-kb', 'dashboard', 'e2e', 'new-project', 'review', 'spec', 'tdd', 'update', 'write',
    ]);
    expect(reg.skills['delphi-claudeignore']?.targets).toEqual(['claude']);
    expect(fs.existsSync(path.join(REAL_ROOT, 'portable.json'))).toBe(true);
  });
});
```

Acrescentar ao **fim** de `kb/__tests__/helpers.ts`:

```ts
import { fileURLToPath } from 'node:url';

export const REAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const REPO_BASE: Record<string, string> = {
  '.claude-plugin/plugin.json': JSON.stringify({ name: 'delphi-dev', version: '1.2.3' }),
  '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'delphi-dev', version: '1.2.3' }] }),
  'portable.json': JSON.stringify({
    schema: 1,
    skills: {},
    commands: ['audit', 'about'].map((id) => ({
      id,
      title: { 'pt-BR': `Titulo ${id}`, 'en-US': `Title ${id}` },
      description: { 'pt-BR': `Descricao ${id}`, 'en-US': `Description ${id}` },
      takesFile: false,
      icon: 'info',
    })),
  }),
  'skills/delphi-demo/SKILL.md': '---\nname: delphi-demo\ndescription: Skill de demonstracao.\n---\n# Demo\n\nTexto neutro.\n',
  'commands/audit.md': '---\ndescription: Auditar o projeto\n---\nAuditar $ARGUMENTS.\n',
  'commands/about.md': '---\ndescription: Sobre o plugin\n---\n**Versão:** 1.2.3\n\n**Version:** 1.2.3\n',
  'agents/delphi-writer.md':
    '---\nname: delphi-writer\ndescription: |\n  Escreve codigo Delphi novo.\n  Exemplos: <example>x</example>\nmodel: inherit\n---\nCorpo do agente.\n',
};

/** Minimal valid portable repo. `over[path] = null` removes a file. */
export function makeRepo(over: Record<string, string | null> = {}): string {
  const root = tmpDir('kb-repo-');
  const files: Record<string, string> = { ...REPO_BASE };
  for (const [rel, content] of Object.entries(over)) {
    if (content === null) delete files[rel];
    else files[rel] = content;
  }
  writeTree(root, files);
  return root;
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/frontmatter.test.ts __tests__/registry.test.ts`
Expected: FAIL com "Failed to resolve import ../src/frontmatter" / "../src/registry".

- [ ] **Step 3: Implementar**

`kb/src/frontmatter.ts`:

```ts
export interface Frontmatter {
  data: Record<string, string>;
  keys: string[];
  body: string;
}

function fold(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line === '') {
      paragraphs.push(current.join(' '));
      current = [];
    } else {
      current.push(line);
    }
  }
  paragraphs.push(current.join(' '));
  return paragraphs.join('\n').trim();
}

/** YAML subset used by skills, commands and agents: top-level scalars and block scalars. */
export function readFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { data: {}, keys: [], body: text };

  const lines = match[1].split('\n');
  const data: Record<string, string> = {};
  const keys: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    i++;
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    keys.push(key);

    const block = value.match(/^([|>])[+-]?$/);
    if (block || value === '') {
      const collected: string[] = [];
      while (i < lines.length && (lines[i].trim() === '' || /^[ \t]/.test(lines[i]))) {
        collected.push(lines[i]);
        i++;
      }
      while (collected.length && collected[collected.length - 1].trim() === '') collected.pop();
      if (block) {
        const indents = collected.filter((l) => l.trim() !== '').map((l) => l.match(/^[ \t]*/)![0].length);
        const indent = indents.length ? Math.min(...indents) : 0;
        const body = collected.map((l) => (l.trim() === '' ? '' : l.slice(indent)));
        value = block[1] === '|' ? body.join('\n') : fold(body);
      } else {
        value = '';
      }
    } else {
      value = value.replace(/^(["'])([\s\S]*)\1$/, '$2');
    }
    data[key] = value;
  }
  return { data, keys, body: match[2] };
}
```

`kb/src/registry.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export type Target = 'claude' | 'codex' | 'opencode';
export const TARGETS: readonly Target[] = ['claude', 'codex', 'opencode'];
export type Locale = 'pt-BR' | 'en-US';
const LOCALES: Locale[] = ['pt-BR', 'en-US'];

export interface RegistryCommand {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  takesFile: boolean;
  icon: string;
}

export interface Registry {
  schema: 1;
  skills: Record<string, { targets?: Target[] }>;
  commands: RegistryCommand[];
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function localized(value: unknown, label: string, errors: string[]): void {
  const v = value as Record<string, unknown> | undefined;
  for (const locale of LOCALES) {
    if (!v || typeof v[locale] !== 'string' || (v[locale] as string).trim() === '') {
      errors.push(`${label}.${locale} is empty`);
    }
  }
}

export function validateRegistry(input: unknown): string[] {
  const errors: string[] = [];
  const reg = input as Partial<Registry> | null;
  if (!reg || typeof reg !== 'object') return ['registry is not an object'];
  if (reg.schema !== 1) errors.push('schema must be 1');

  const skills = reg.skills ?? {};
  if (typeof skills !== 'object' || Array.isArray(skills)) errors.push('skills must be an object');
  else {
    for (const [name, entry] of Object.entries(skills)) {
      const targets = (entry as { targets?: unknown })?.targets;
      if (targets === undefined) continue;
      if (!Array.isArray(targets) || targets.some((t) => !TARGETS.includes(t as Target))) {
        errors.push(`skills.${name}.targets must be a subset of ${TARGETS.join(', ')}`);
      }
    }
  }

  if (!Array.isArray(reg.commands)) {
    errors.push('commands must be an array');
    return errors;
  }
  const seen = new Set<string>();
  reg.commands.forEach((cmd, index) => {
    const at = `commands[${index}]`;
    if (typeof cmd?.id !== 'string' || !ID.test(cmd.id)) errors.push(`${at}.id is invalid`);
    else if (seen.has(cmd.id)) errors.push(`${at}.id duplicate: ${cmd.id}`);
    else seen.add(cmd.id);
    localized(cmd?.title, `${at}.title`, errors);
    localized(cmd?.description, `${at}.description`, errors);
    if (typeof cmd?.takesFile !== 'boolean') errors.push(`${at}.takesFile must be boolean`);
    if (typeof cmd?.icon !== 'string' || cmd.icon === '') errors.push(`${at}.icon is empty`);
  });
  return errors;
}

export function parseRegistry(raw: string): Registry {
  const parsed = JSON.parse(raw) as unknown;
  const errors = validateRegistry(parsed);
  if (errors.length) throw new Error(`invalid portable.json: ${errors.join('; ')}`);
  const reg = parsed as Registry;
  return { schema: 1, skills: reg.skills ?? {}, commands: reg.commands };
}

export function readRegistry(root: string): Registry {
  return parseRegistry(fs.readFileSync(path.join(root, 'portable.json'), 'utf8'));
}

export function commandSkillName(id: string): string {
  return `delphi-cmd-${id}`;
}

export function opencodeCommandName(id: string): string {
  return `delphi-${id}`;
}

export function invocationFor(target: Target, id: string): string {
  if (target === 'codex') return `$${commandSkillName(id)}`;
  if (target === 'opencode') return `/${opencodeCommandName(id)}`;
  return `/${id}`;
}

export function skillTargets(reg: Registry, skill: string): Target[] {
  return reg.skills[skill]?.targets ?? [...TARGETS];
}
```

`portable.json` (raiz do repositório):

```json
{
  "schema": 1,
  "skills": {
    "delphi-claudeignore": { "targets": ["claude"] }
  },
  "commands": [
    { "id": "audit", "title": { "pt-BR": "Auditar projeto", "en-US": "Audit project" },
      "description": { "pt-BR": "Laudo técnico completo com score e recomendações", "en-US": "Complete technical audit with score and recommendations" },
      "takesFile": false, "icon": "checklist" },
    { "id": "review", "title": { "pt-BR": "Revisar código", "en-US": "Review code" },
      "description": { "pt-BR": "Revisão rápida de violações de padrão", "en-US": "Quick review of style violations" },
      "takesFile": true, "icon": "eye" },
    { "id": "write", "title": { "pt-BR": "Escrever código", "en-US": "Write code" },
      "description": { "pt-BR": "Código novo com todos os padrões aplicados", "en-US": "New code with all standards applied" },
      "takesFile": false, "icon": "edit" },
    { "id": "spec", "title": { "pt-BR": "Gerar SPEC", "en-US": "Generate SPEC" },
      "description": { "pt-BR": "Documento de especificação do projeto ou módulo", "en-US": "Software specification document for the project or module" },
      "takesFile": false, "icon": "file-text" },
    { "id": "tdd", "title": { "pt-BR": "Gerar testes (TDD)", "en-US": "Generate tests (TDD)" },
      "description": { "pt-BR": "Suíte DUnitX do projeto ou da classe", "en-US": "DUnitX test suite for the project or class" },
      "takesFile": true, "icon": "beaker" },
    { "id": "new-project", "title": { "pt-BR": "Novo projeto", "en-US": "New project" },
      "description": { "pt-BR": "Estrutura padronizada de projeto Delphi", "en-US": "Standardized Delphi project scaffold" },
      "takesFile": false, "icon": "folder-opened" },
    { "id": "e2e", "title": { "pt-BR": "Teste E2E", "en-US": "E2E test" },
      "description": { "pt-BR": "Cenários ponta a ponta no app desktop em execução", "en-US": "End-to-end scenarios on the running desktop app" },
      "takesFile": false, "icon": "play" },
    { "id": "dashboard", "title": { "pt-BR": "Dashboard do repositório", "en-US": "Repository dashboard" },
      "description": { "pt-BR": "Métricas do repositório no GitHub", "en-US": "GitHub repository metrics" },
      "takesFile": false, "icon": "graph" },
    { "id": "update", "title": { "pt-BR": "Atualizar base", "en-US": "Update knowledge base" },
      "description": { "pt-BR": "Atualiza a base de conhecimento e verifica o plugin", "en-US": "Updates the knowledge base and checks the plugin" },
      "takesFile": false, "icon": "sync" },
    { "id": "contribute-kb", "title": { "pt-BR": "Contribuir com a base", "en-US": "Contribute knowledge" },
      "description": { "pt-BR": "Compartilhar um aprendizado sobre Delphi", "en-US": "Share a Delphi learning" },
      "takesFile": false, "icon": "cloud-upload" },
    { "id": "about", "title": { "pt-BR": "Sobre o plugin", "en-US": "About the plugin" },
      "description": { "pt-BR": "Versão, comandos e status da base", "en-US": "Version, commands and knowledge-base status" },
      "takesFile": false, "icon": "info" }
  ]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: todos PASS (os 220 anteriores + novos), typecheck limpo. Confira ASCII: `perl -ne 'print "$ARGV:$.\n" if /[^\x00-\x7F]/' kb/src/frontmatter.ts kb/src/registry.ts` não imprime nada.

- [ ] **Step 5: Commit**

```bash
git add portable.json kb/src/frontmatter.ts kb/src/registry.ts kb/__tests__/frontmatter.test.ts kb/__tests__/registry.test.ts kb/__tests__/helpers.ts
git commit -m "feat(kb): registro portable.json, leitor de frontmatter e helper makeRepo"
```

---

### Task 2: Lint de portabilidade (`lintRepo` e `kb-cli lint`)

**Files:**
- Create: `kb/src/lint.ts`, `kb/src/cli-install.ts` (só o handler `lintCommand` por enquanto), `kb/__tests__/lint.test.ts`
- Modify: `kb/src/cli.ts` (imports, USAGE, case `lint`), `runtime/*.mjs` (rebuild)

**Interfaces:**
- Consumes: `readFrontmatter`, `validateRegistry`
- Produces:
  - `interface LintFinding { rule: string; file: string; line?: number; message: string }`
  - `lintRepo(root: string): LintFinding[]` (ordenado por arquivo, linha)
  - `lintCommand(args: string[], io: CliIO): number` em `cli-install.ts`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/lint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lintRepo } from '../src/lint';
import { makeRepo } from './helpers';

const rules = (root: string) => lintRepo(root).map((f) => f.rule);
const skill = (name: string, desc: string | null, body = '# T\n', extra = '') =>
  `---\nname: ${name}\n${desc === null ? '' : `description: ${desc}\n`}${extra}---\n${body}`;

describe('lintRepo', () => {
  it('passes a clean repo', () => {
    expect(lintRepo(makeRepo())).toEqual([]);
  });

  it('flags a skill whose folder and name differ', () => {
    const root = makeRepo({ 'skills/delphi-demo/SKILL.md': skill('outro-nome', 'Descricao.') });
    expect(rules(root)).toContain('skill-name');
  });

  it('flags an invalid skill name', () => {
    const root = makeRepo({ 'skills/Bad_Name/SKILL.md': skill('Bad_Name', 'Descricao.') });
    expect(rules(root)).toContain('skill-name');
  });

  it('flags a missing or oversized description', () => {
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', null) }))).toContain('skill-description');
    const long = 'x'.repeat(1025);
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', long) }))).toContain('skill-description');
  });

  it('flags claude-only frontmatter keys', () => {
    const root = makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'Descricao.', '# T\n', 'allowed-tools: Bash\n') });
    expect(rules(root)).toContain('skill-frontmatter');
  });

  it('flags agent-specific tool names with the line number', () => {
    const root = makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'Descricao.', '# T\n\nUse a ferramenta Write para gravar.\n'),
    });
    const f = lintRepo(root).find((x) => x.rule === 'tool-names')!;
    expect(f.file).toBe('skills/delphi-demo/SKILL.md');
    expect(f.line).toBe(7);
  });

  it('flags AskUserQuestion and honors the allow marker', () => {
    const body = '# T\n\nPergunte com AskUserQuestion.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('tool-names');
    const allowed = '# T\n\nPergunte com AskUserQuestion. <!-- portability:allow tool-names -->\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', allowed) }))).not.toContain('tool-names');
  });

  it('flags rules/ and knowledge/ references but not kb: or references/rules/', () => {
    const bad = '# T\n\nLeia `rules/naming.md`.\nLeia `knowledge/core/a.md`.\n';
    const r = lintRepo(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', bad) }));
    expect(r.filter((f) => f.rule === 'path-ref')).toHaveLength(2);
    const ok = '# T\n\nLeia `references/rules/naming.md` e `kb:core/a.md`.\n';
    expect(rules(makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', ok),
      'skills/delphi-demo/references/rules/naming.md': '# n\n',
    }))).not.toContain('path-ref');
  });

  it('flags ../ only in SKILL.md', () => {
    const body = '# T\n\nVeja ../outra/SKILL.md.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('path-ref');
  });

  it('flags a references/ file that does not exist, unless another named skill has it', () => {
    const body = '# T\n\nLeia `references/faltando.md`.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('references-exist');

    const cross = '# T\n\nAtive a skill `delphi-outra` e leia `references/doc.md`.\n';
    expect(rules(makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', cross),
      'skills/delphi-outra/SKILL.md': skill('delphi-outra', 'D.'),
      'skills/delphi-outra/references/doc.md': '# d\n',
    }))).not.toContain('references-exist');
  });

  it('checks commands against the registry in both directions', () => {
    expect(rules(makeRepo({ 'commands/extra.md': '---\ndescription: x\n---\ny\n' }))).toContain('command-registry');
    expect(rules(makeRepo({ 'commands/audit.md': null }))).toContain('command-registry');
  });

  it('flags a registry entry with an empty title', () => {
    const reg = JSON.parse(JSON.stringify({
      schema: 1, skills: {},
      commands: [{ id: 'audit', title: { 'pt-BR': '', 'en-US': 'x' }, description: { 'pt-BR': 'a', 'en-US': 'b' }, takesFile: false, icon: 'i' },
        { id: 'about', title: { 'pt-BR': 'a', 'en-US': 'b' }, description: { 'pt-BR': 'a', 'en-US': 'b' }, takesFile: false, icon: 'i' }],
    }));
    expect(rules(makeRepo({ 'portable.json': JSON.stringify(reg) }))).toContain('command-registry');
  });

  it('flags an agent without a description', () => {
    expect(rules(makeRepo({ 'agents/delphi-writer.md': '---\nname: delphi-writer\n---\ncorpo\n' }))).toContain('agent-frontmatter');
  });

  it('flags versions that are out of sync', () => {
    const root = makeRepo({
      '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'delphi-dev', version: '9.9.9' }] }),
    });
    expect(rules(root)).toContain('version-sync');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/lint.test.ts`
Expected: FAIL com "Failed to resolve import ../src/lint".

- [ ] **Step 3: Implementar `lint.ts`**

`kb/src/lint.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFrontmatter } from './frontmatter';
import { validateRegistry } from './registry';

export interface LintFinding {
  rule: string;
  file: string;
  line?: number;
  message: string;
}

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata']);
const TOOL = 'Write|Edit|Read|Bash|Agent|Task|Skill|Grep|Glob|WebFetch|TodoWrite|AskUserQuestion|PowerShell';
const TOOL_PATTERNS: RegExp[] = [
  new RegExp(`\\bferramentas? (?:${TOOL})\\b`, 'i'),
  new RegExp(`\\b(?:${TOOL}) tool\\b`),
  /\b(?:AskUserQuestion|subagent_type|CLAUDE_PLUGIN_ROOT|allowed-tools)\b/,
];
const PATH_REF = /(?:^|[\s`'"(\[])(?:rules|knowledge)\/[A-Za-z0-9_.\-/]+/;
const PARENT_REF = /(?<![\w.])\.\.\//;
const REFERENCE = /\breferences\/([A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+)/g;
const ALLOW = /<!--\s*portability:allow\s+([a-z-]+)\s*-->/;

const posix = (p: string): string => p.split(path.sep).join('/');

function walkMd(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walkMd(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  });
}

function allowed(lines: string[], index: number, rule: string): boolean {
  for (const i of [index, index - 1]) {
    const m = i >= 0 ? lines[i].match(ALLOW) : null;
    if (m && m[1] === rule) return true;
  }
  return false;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

export function lintRepo(root: string): LintFinding[] {
  const findings: LintFinding[] = [];
  const add = (rule: string, file: string, message: string, line?: number): void => {
    findings.push({ rule, file: posix(path.relative(root, file)), line, message });
  };

  // --- skills
  const skillsDir = path.join(root, 'skills');
  const skillNames: string[] = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];

  for (const name of skillNames) {
    const file = path.join(skillsDir, name, 'SKILL.md');
    if (!fs.existsSync(file)) {
      add('skill-name', path.join(skillsDir, name), 'folder has no SKILL.md');
      continue;
    }
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!SKILL_NAME.test(name) || name.length > 64) add('skill-name', file, `invalid skill folder name "${name}"`);
    if (fm.data.name !== name) add('skill-name', file, `name "${fm.data.name ?? ''}" must equal the folder "${name}"`);
    const description = (fm.data.description ?? '').replace(/\s+/g, ' ').trim();
    if (!description) add('skill-description', file, 'description is missing');
    else if (description.length > 1024) add('skill-description', file, `description has ${description.length} chars (max 1024)`);
    for (const key of fm.keys) {
      if (!ALLOWED_KEYS.has(key)) add('skill-frontmatter', file, `frontmatter key "${key}" is not portable`);
    }
  }

  // --- text rules over skills, commands and agents
  const mdFiles = [
    ...walkMd(skillsDir),
    ...walkMd(path.join(root, 'commands')),
    ...walkMd(path.join(root, 'agents')),
  ];
  for (const file of mdFiles) {
    const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
    const isSkillFile = path.basename(file) === 'SKILL.md' && posix(file).includes('/skills/');
    lines.forEach((text, i) => {
      for (const pattern of TOOL_PATTERNS) {
        if (pattern.test(text) && !allowed(lines, i, 'tool-names')) {
          add('tool-names', file, `agent-specific tool name: ${text.trim().slice(0, 80)}`, i + 1);
          break;
        }
      }
      if (posix(file).includes('/skills/')) {
        const hit = PATH_REF.test(text) && !text.includes('~/.delphi-dev/') && !allowed(lines, i, 'path-ref');
        if (hit) add('path-ref', file, `reference outside the skill folder: ${text.trim().slice(0, 80)}`, i + 1);
        if (isSkillFile && PARENT_REF.test(text) && !allowed(lines, i, 'path-ref')) {
          add('path-ref', file, `parent-relative path in a skill: ${text.trim().slice(0, 80)}`, i + 1);
        }
      }
    });

    if (isSkillFile) {
      const skill = path.basename(path.dirname(file));
      lines.forEach((text, i) => {
        const named = (text.match(/\bdelphi-[a-z0-9-]+\b/g) ?? []).filter((n) => skillNames.includes(n));
        for (const m of text.matchAll(REFERENCE)) {
          const rel = m[1];
          const owners = [skill, ...named];
          const found = owners.some((o) => fs.existsSync(path.join(skillsDir, o, 'references', ...rel.split('/'))));
          if (!found) add('references-exist', file, `references/${rel} does not exist`, i + 1);
        }
      });
    }
  }

  // --- commands x registry
  const commandsDir = path.join(root, 'commands');
  const commandIds = fs.existsSync(commandsDir)
    ? fs.readdirSync(commandsDir).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3))
    : [];
  const registryFile = path.join(root, 'portable.json');
  const registry = readJson(registryFile) as { commands?: { id?: string }[] } | undefined;
  if (!registry) {
    add('command-registry', registryFile, 'portable.json is missing or is not valid JSON');
  } else {
    for (const error of validateRegistry(registry)) add('command-registry', registryFile, error);
    const registered = new Set((registry.commands ?? []).map((c) => c.id));
    for (const id of commandIds) {
      if (!registered.has(id)) add('command-registry', path.join(commandsDir, `${id}.md`), `command "${id}" has no portable.json entry`);
    }
    for (const id of registered) {
      if (id && !commandIds.includes(id)) add('command-registry', registryFile, `portable.json lists "${id}" but commands/${id}.md does not exist`);
    }
  }

  // --- agents
  const agentsDir = path.join(root, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const name of fs.readdirSync(agentsDir).filter((n) => n.endsWith('.md'))) {
      const file = path.join(agentsDir, name);
      const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
      if (!fm.data.name) add('agent-frontmatter', file, 'agent has no name');
      if (!(fm.data.description ?? '').trim()) add('agent-frontmatter', file, 'agent has no description');
    }
  }

  // --- version sync
  const plugin = readJson(path.join(root, '.claude-plugin', 'plugin.json')) as { version?: string } | undefined;
  const market = readJson(path.join(root, '.claude-plugin', 'marketplace.json')) as { plugins?: { version?: string }[] } | undefined;
  if (plugin?.version) {
    const marketVersion = market?.plugins?.[0]?.version;
    if (marketVersion !== undefined && marketVersion !== plugin.version) {
      add('version-sync', path.join(root, '.claude-plugin', 'marketplace.json'),
        `marketplace.json is ${marketVersion} but plugin.json is ${plugin.version}`);
    }
    const about = path.join(root, 'commands', 'about.md');
    if (fs.existsSync(about)) {
      const text = fs.readFileSync(about, 'utf8');
      for (const m of text.matchAll(/\*\*(?:Versão|Version):\*\*\s*([0-9]+\.[0-9]+\.[0-9]+[^\s]*)/g)) {
        if (m[1] !== plugin.version) {
          add('version-sync', about, `about shows ${m[1]} but plugin.json is ${plugin.version}`);
        }
      }
    }
  }

  return findings.sort((a, b) => (a.file === b.file ? (a.line ?? 0) - (b.line ?? 0) : a.file < b.file ? -1 : 1));
}
```

- [ ] **Step 4: Handler do CLI**

`kb/src/cli-install.ts`:

```ts
import { parseArgs } from 'node:util';
import type { CliIO } from './cli';
import { lintRepo } from './lint';

export function lintCommand(args: string[], io: CliIO): number {
  const { values } = parseArgs({ args, options: { root: { type: 'string' } } });
  const findings = lintRepo(values.root ?? process.cwd());
  for (const f of findings) {
    io.out(`${f.file}${f.line ? `:${f.line}` : ''} [${f.rule}] ${f.message}`);
  }
  io.out(`${findings.length} achado(s) de portabilidade`);
  return findings.length ? 1 : 0;
}
```

Em `kb/src/cli.ts`: (1) acrescente `import { lintCommand } from './cli-install';` junto dos imports; (2) em `const USAGE`, acrescente antes de `].join('\n')` a linha `  '  lint [--root <dir>]',`; (3) antes de `default: io.err(USAGE); return 64;` acrescente:

```ts
    case 'lint': return lintCommand(rest, io);
```

Acrescente a `kb/__tests__/cli.test.ts` um teste:

```ts
  it('lints a repo and exits 1 with findings', async () => {
    const { makeRepo } = await import('./helpers');
    const clean = io();
    expect(await runCli(['lint', '--root', makeRepo()], clean.value)).toBe(0);
    expect(clean.out.at(-1)).toBe('0 achado(s) de portabilidade');

    const bad = io();
    const root = makeRepo({ 'commands/audit.md': null });
    expect(await runCli(['lint', '--root', root], bad.value)).toBe(1);
    expect(bad.out.join('\n')).toContain('[command-registry]');
  });
```

- [ ] **Step 5: Rodar tudo e reconstruir o runtime**

Run: `cd kb && npx vitest run && npx tsc --noEmit && npm run build:runtime && git diff --stat -- ../runtime`
Expected: todos PASS; `runtime/kb-cli.mjs` alterado.

- [ ] **Step 6: Commit**

```bash
git add kb/src/lint.ts kb/src/cli-install.ts kb/src/cli.ts kb/__tests__/lint.test.ts kb/__tests__/cli.test.ts runtime/
git commit -m "feat(kb): lint de portabilidade e subcomando kb-cli lint"
```

---

### Task 3: `rules/` passa para dentro da skill `delphi-standards`

**Files:**
- Create: `kb/__tests__/portable-content.test.ts`
- Move: `rules/*.md` → `skills/delphi-standards/references/rules/`
- Modify: `skills/delphi-standards/SKILL.md`, `skills/delphi-legacy/SKILL.md`, `skills/delphi-spring4d/SKILL.md`

**Interfaces:** Produces o contrato de conteúdo do repo real (`portable-content.test.ts`), que as Tasks 4–6 estendem.

- [ ] **Step 1: Escrever o teste (vermelho)**

`kb/__tests__/portable-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { REAL_ROOT } from './helpers';

function walkMd(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walkMd(full);
    return e.name.endsWith('.md') ? [full] : [];
  });
}
const skillFiles = () => walkMd(path.join(REAL_ROOT, 'skills'));
const read = (rel: string) => fs.readFileSync(path.join(REAL_ROOT, ...rel.split('/')), 'utf8');

describe('rules live inside delphi-standards', () => {
  it('has no root rules/ folder and keeps the six rule files in the skill', () => {
    expect(fs.existsSync(path.join(REAL_ROOT, 'rules'))).toBe(false);
    for (const n of ['naming', 'architecture', 'forbidden', 'security', 'legacy', 'testing']) {
      expect(fs.existsSync(path.join(REAL_ROOT, 'skills/delphi-standards/references/rules', `${n}.md`))).toBe(true);
    }
  });

  it('no skill points at a root rules/ path', () => {
    for (const file of skillFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/(?:^|[\s`'"(\[])rules\/[A-Za-z0-9_.\-]+/m);
    }
  });

  it('legacy and spring4d name the skill that owns the rules', () => {
    expect(read('skills/delphi-legacy/SKILL.md')).toContain('ative a skill `delphi-standards` e leia `references/rules/legacy.md`');
    expect(read('skills/delphi-spring4d/SKILL.md')).toContain('`references/rules/architecture.md`');
  });
});
```

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts`
Expected: FAIL (a pasta `rules/` ainda existe).

- [ ] **Step 2: Mover os arquivos**

```bash
cd "<raiz do repo>"
mkdir -p skills/delphi-standards/references/rules
git mv rules/architecture.md rules/forbidden.md rules/legacy.md rules/naming.md rules/security.md rules/testing.md skills/delphi-standards/references/rules/
ls rules 2>/dev/null; rmdir rules 2>/dev/null; ls
```

Expected: `rules/` não existe mais.

- [ ] **Step 3: Ajustar os textos (script com asserções)**

Rode este script uma vez, da raiz do repo (não é commitado):

```bash
node -e '
const fs = require("fs");
function edit(file, pairs) {
  let t = fs.readFileSync(file, "utf8");
  for (const [from, to, count] of pairs) {
    const parts = t.split(from);
    if (parts.length - 1 !== count) throw new Error(`${file}: esperava ${count}x de ${JSON.stringify(from)}, achei ${parts.length - 1}`);
    t = parts.join(to);
  }
  fs.writeFileSync(file, t);
}
edit("skills/delphi-standards/SKILL.md", [
  ["vivem em `rules/` na raiz do plugin:", "vivem em `references/rules/` desta skill:", 1],
  ["- `rules/", "- `references/rules/", 6],
]);
edit("skills/delphi-legacy/SKILL.md", [
  ["leia `rules/legacy.md` integralmente.", "ative a skill `delphi-standards` e leia `references/rules/legacy.md` integralmente.", 1],
]);
edit("skills/delphi-spring4d/SKILL.md", [
  ["(ver `rules/architecture.md` para a base de DI)", "(ver `references/rules/architecture.md` da skill `delphi-standards` para a base de DI)", 1],
  ["O container não substitui o `rules/architecture.md` —", "O container não substitui o `references/rules/architecture.md` (skill `delphi-standards`) —", 1],
]);
console.log("ok");
'
```

Expected: imprime `ok`. Se alguma contagem divergir, o script para sem gravar aquele arquivo: leia a linha real, ajuste só o texto de origem e rode de novo (não relaxe as contagens).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts && npx vitest run`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add -A rules skills kb/__tests__/portable-content.test.ts
git commit -m "refactor(skills): rules/ vira references/rules/ dentro da skill delphi-standards"
```

---

### Task 4: Notação `kb:` nas skills e `kb_get` com fallback para o snapshot embutido

**Files:**
- Modify: `skills/**/*.md` (codemod), `kb/src/mcp-server.ts`, `kb/__tests__/mcp-server.test.ts`, `kb/__tests__/portable-content.test.ts`, `runtime/*.mjs`

**Interfaces:** Produces a linha-padrão da notação `kb:` e `kbGet` com fallback.

- [ ] **Step 1: Escrever os testes (vermelho)**

Acrescente ao fim de `kb/__tests__/portable-content.test.ts`:

```ts
const KB_NOTATION =
  '> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`\n' +
  '> (MCP `delphi-dev-kb`); sem ele, procure em `~/.delphi-dev/kb-cache/current/` ou em\n' +
  '> `~/.delphi-dev/plugin/knowledge/`.';

describe('kb: notation', () => {
  it('no skill uses a raw knowledge/<tier>/ path', () => {
    for (const file of skillFiles()) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/knowledge\/(?:core|fmx|community)\//);
    }
  });

  it('every file that uses kb: carries the notation line exactly once', () => {
    let using = 0;
    for (const file of skillFiles()) {
      const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      if (!/`kb:(?:core|fmx|community)\//.test(text)) continue;
      using++;
      expect(text.split(KB_NOTATION).length - 1, file).toBe(1);
    }
    expect(using).toBeGreaterThanOrEqual(6);
  });
});
```

Acrescente a `kb/__tests__/mcp-server.test.ts` (importando `cacheCurrentDir` de `../src/paths` e `writeTree` de `./helpers` se ainda não importados):

```ts
describe('kb_get fallback', () => {
  it('serves a file missing from the updated snapshot from the embedded copy', () => {
    const c = ctx({ root: makePluginRoot({ 'core/so-embutido.md': '# Embutido\n\ncorpo\n' }) });
    writeTree(cacheCurrentDir(c.data), {
      'core/outro.md': '# Outro\n',
      'meta.json': JSON.stringify({ pluginVersion: c.pluginVersion, commit: 'abcdef1' }),
    });
    expect(healthOf(c).source).toBe('updated');
    expect(text(kbGet(c, { path: 'core/so-embutido.md' }))).toContain('# Embutido');
    expect(kbGet(c, { path: 'core/nao-existe.md' }).isError).toBe(true);
  });
});
```

Run: `cd kb && npx vitest run __tests__/mcp-server.test.ts __tests__/portable-content.test.ts`
Expected: FAIL (notação ausente; `kb_get` devolve erro).

- [ ] **Step 2: Fallback no `kbGet`**

Em `kb/src/mcp-server.ts`, no import de `./paths` acrescente `embeddedKnowledgeDir` e troque o corpo de `kbGet`:

```ts
export function kbGet(ctx: KbContext, args: { path: string }): ToolText {
  if (!isSafeKbPath(args.path)) return reply(`Caminho inválido: ${args.path}`, true);
  const active = resolveActive(ctx.root, ctx.data, ctx.env, ctx.pluginVersion);
  const parts = args.path.split('/');
  const candidates = [path.join(active.dir, ...parts)];
  // The downloaded snapshot has no INDEX.md (it only lists knowledge files): fall back to the embedded copy.
  if (active.kind === 'updated') candidates.push(path.join(embeddedKnowledgeDir(ctx.root), ...parts));
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) return reply(`Arquivo não encontrado na base: ${args.path}`, true);
  return reply(fs.readFileSync(file, 'utf8'));
}
```

- [ ] **Step 3: Codemod das skills**

Rode uma vez, da raiz do repo (não commitado):

```bash
node -e '
const fs = require("fs"), path = require("path");
const NOTATION =
  "> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`\n" +
  "> (MCP `delphi-dev-kb`); sem ele, procure em `~/.delphi-dev/kb-cache/current/` ou em\n" +
  "> `~/.delphi-dev/plugin/knowledge/`.";
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => { const f = path.join(d, e.name); return e.isDirectory() ? walk(f) : e.name.endsWith(".md") ? [f] : []; }); }
let changed = 0;
for (const file of walk("skills")) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let t = raw.replace(/\r\n/g, "\n");
  const next = t.replace(/knowledge\/(core|fmx|community)\//g, "kb:$1/");
  if (next === t) continue;
  t = next;
  if (!t.includes(NOTATION)) {
    const m = t.match(/^# .+$/m);
    if (!m) throw new Error(file + ": sem titulo H1 para ancorar a notacao");
    t = t.replace(m[0], m[0] + "\n\n" + NOTATION);
  }
  fs.writeFileSync(file, crlf ? t.replace(/\n/g, "\r\n") : t);
  changed++; console.log("ajustado", file);
}
console.log("arquivos:", changed);
'
```

Expected: lista os arquivos ajustados (`delphi-acbr`, `delphi-async`, `delphi-build`, `delphi-firedac`, `delphi-fmx` e outros que citem `knowledge/<tier>/`).

- [ ] **Step 4: Conferir e rodar**

Run: `grep -rn "knowledge/\(core\|fmx\|community\)/" skills | head` — Expected: nada.
Run: `cd kb && npx vitest run && npx tsc --noEmit && npm run build:runtime`
Expected: PASS; `runtime/kb-mcp.mjs` e `runtime/kb-cli.mjs` regenerados.

- [ ] **Step 5: Commit**

```bash
git add -A skills kb/src/mcp-server.ts kb/__tests__ runtime/
git commit -m "feat(kb): notacao kb: nas skills e kb_get com fallback para o snapshot embutido"
```

---

### Task 5: Texto neutro, `delphi-claudeignore` só no Claude e fallback do `fix-encoding`

**Files:**
- Modify: `skills/delphi-spec/SKILL.md`, `skills/delphi-contribute/SKILL.md`, `commands/new-project.md`, `kb/__tests__/portable-content.test.ts`

- [ ] **Step 1: Acrescentar o teste (vermelho)**

Ao fim de `kb/__tests__/portable-content.test.ts`:

```ts
describe('neutral wording', () => {
  it('delphi-spec does not name a write tool', () => {
    expect(read('skills/delphi-spec/SKILL.md')).not.toContain('ferramenta Write');
  });

  it('delphi-contribute keeps its per-agent tool list behind the allow marker', () => {
    const text = read('skills/delphi-contribute/SKILL.md');
    const line = text.split('\n').find((l) => l.includes('AskUserQuestion'))!;
    expect(line).toContain('<!-- portability:allow tool-names -->');
  });

  it('new-project says the claudeignore step is Claude Code only', () => {
    expect(read('commands/new-project.md')).toContain('(somente no Claude Code; nos demais agentes, pule este passo)');
  });
});
```

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts`
Expected: FAIL nos três.

- [ ] **Step 2: Aplicar os textos**

```bash
node -e '
const fs = require("fs");
function edit(file, from, to) {
  const raw = fs.readFileSync(file, "utf8");
  const parts = raw.split(from);
  if (parts.length !== 2) throw new Error(`${file}: esperava 1x de ${JSON.stringify(from)}, achei ${parts.length - 1}`);
  fs.writeFileSync(file, parts.join(to));
}
edit("skills/delphi-spec/SKILL.md",
  "- Use a ferramenta Write para criar o arquivo.",
  "- Grave o arquivo no disco (crie-o; não apenas exiba o conteúdo na conversa).");
edit("skills/delphi-contribute/SKILL.md",
  "no Claude Code, `AskUserQuestion`;",
  "no Claude Code, `AskUserQuestion`; <!-- portability:allow tool-names -->");
edit("commands/new-project.md",
  "para criar o `.claudeignore`.",
  "para criar o `.claudeignore` (somente no Claude Code; nos demais agentes, pule este passo).");
console.log("ok");
'
```

Expected: `ok`. (Se o arquivo usar CRLF e o trecho quebrar por `\r`, o script falha alto; ajuste apenas a string de origem.)

- [ ] **Step 3: Rodar**

Run: `cd kb && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/delphi-spec/SKILL.md skills/delphi-contribute/SKILL.md commands/new-project.md kb/__tests__/portable-content.test.ts
git commit -m "docs(skills): texto neutro de ferramenta e passo do claudeignore so no Claude Code"
```

---

### Task 6: O repositório real passa no lint (e o CI roda o lint)

**Files:**
- Modify: `kb/__tests__/portable-content.test.ts`, `.github/workflows/runtime-check.yml`, `CLAUDE.md` (regra de versão)

- [ ] **Step 1: Acrescentar o teste de contrato final**

Ao fim de `kb/__tests__/portable-content.test.ts`:

```ts
import { lintRepo } from '../src/lint';

describe('the real repository is portable', () => {
  it('has no lint findings', () => {
    const findings = lintRepo(REAL_ROOT);
    expect(findings.map((f) => `${f.file}:${f.line ?? 0} [${f.rule}] ${f.message}`)).toEqual([]);
  });
});
```

(mova o `import` para o topo do arquivo junto dos demais.)

- [ ] **Step 2: Rodar**

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts`
Expected: PASS. **Se houver achados**, trate cada um pelo conteúdo — nunca enfraqueça a regra nem o teste:
- `tool-names`/`path-ref` em texto que enumera ferramentas de propósito → comentário `<!-- portability:allow <regra> -->` na linha;
- texto que cita ferramenta por hábito → reescreva em linguagem neutra;
- `references-exist` → crie o arquivo ou corrija o caminho;
- `command-registry` → ajuste `portable.json` (id, títulos).
Registre cada correção em uma linha na mensagem do commit.

- [ ] **Step 3: CI**

Em `.github/workflows/runtime-check.yml`: (1) em `pull_request.paths` e `push.paths` acrescente `'skills/**'`, `'commands/**'`, `'agents/**'` e `'portable.json'`; (2) depois do passo `npm run build:runtime` + `git diff --exit-code`, acrescente, ainda no job `check` (o `working-directory` é `kb`):

```yaml
      - name: Portability lint (skills, commands, agents)
        run: node ../runtime/kb-cli.mjs lint --root ..
```

- [ ] **Step 4: Regra de versão no CLAUDE.md**

Em `CLAUDE.md`, na seção "Versioning", substitua o item 3 por:

```
3. `commands/about.md` → as linhas `Versão:` / `Version:` (o `kb-cli lint` regra `version-sync` confere os três)
```

e acrescente ao fim de "Editing rules":

```
- `portable.json` lista os comandos e as exceções de skill por agente; um comando novo exige a entrada lá (o lint do CI cobra) e fica disponível no Codex (`$delphi-cmd-<id>`) e no OpenCode (`/delphi-<id>`) sem mais nada.
```

- [ ] **Step 5: Rodar tudo e commitar**

Run: `cd kb && npx vitest run && npx tsc --noEmit && node ../runtime/kb-cli.mjs lint --root ..`
Expected: PASS e `0 achado(s) de portabilidade`.

```bash
git add -A kb/__tests__ .github/workflows/runtime-check.yml CLAUDE.md skills commands agents portable.json
git commit -m "test(kb): o repositorio real passa no lint de portabilidade e o CI roda o lint"
```

---

### Task 7: `AGENTS.md` do repositório

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Criar o arquivo**

`AGENTS.md`:

```markdown
# AGENTS.md

Instruções para agentes de IA (Codex, OpenCode e outros) que trabalham **neste repositório**.
A versão completa e canônica é o [CLAUDE.md](CLAUDE.md); abaixo está o essencial.

## O que este repositório é

Fonte do plugin **`delphi-dev`** (um especialista em Delphi para agentes de IA). Não é um projeto
Delphi: o "código" é Markdown + JSON, mais o runtime TypeScript da base de conhecimento em `kb/`.

## Estrutura

- `skills/<nome>/SKILL.md` — conhecimento e protocolos; `references/` carrega sob demanda.
- `commands/*.md` — comandos de usuário; cada um tem entrada em `portable.json`.
- `agents/*.md` — subagentes.
- `knowledge/{core,fmx,community}/` — base de conhecimento (`core`/`fmx` canônicos; `community` subordinado).
- `kb/` (fonte) → `runtime/*.mjs` (bundles **commitados**). Depois de mudar `kb/src`, rode
  `cd kb && npm run build:runtime` e commite os bundles junto.
- `portable.json` — registro de comandos e exceções por agente.

## Regras que não podem ser quebradas

1. Idioma de saída: pt-BR (padrão) e en-US, conforme a conversa. Templates têm par `.en.md`.
2. Texto de skills/commands/agents é **neutro de ferramenta** (nada de "Agent tool", "Edit tool",
   `AskUserQuestion`). O lint cobra: `node runtime/kb-cli.mjs lint --root .`.
3. Skills são autossuficientes: referência a outra skill é **por nome**; arquivos da base usam `kb:<tier>/<arquivo>.md`.
4. Nada que roda na máquina do usuário pode exigir `npm install`, build local ou módulo nativo.
5. Arquivos `.dfm`/`.fmx` **nunca** levam BOM; fontes `.pas/.dpr/.dpk/.inc` levam.
6. Versão: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` e as linhas `Versão:` de
   `commands/about.md` andam juntas (o lint confere).
7. Não "simplifique" o `source` aninhado de `marketplace.json`.

## Como validar

```
cd kb && npm test && npx tsc --noEmit
node runtime/kb-cli.mjs lint --root .
```

Os arquivos de Codex e OpenCode são **gerados** por `kb-cli install` a partir do conteúdo acima;
não os edite à mão.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md para agentes que trabalham neste repositorio"
```

---
## PARTE B — Entrega para Codex e OpenCode (3B)

### Task 8: Bloco gerenciado no `config.toml` do Codex

**Files:**
- Create: `kb/src/targets/toml.ts`, `kb/__tests__/toml.test.ts`

**Interfaces:**
- Produces: `BLOCK_START`, `BLOCK_END`, `upsertManagedBlock(text, body): string`, `removeManagedBlock(text): string`, `hasTableOutsideBlock(text, table): boolean`, `codexMcpBlockBody(serverScript: string): string`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/toml.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  BLOCK_END, BLOCK_START, codexMcpBlockBody, hasTableOutsideBlock, removeManagedBlock, upsertManagedBlock,
} from '../src/targets/toml';

const SCRIPT = 'D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs';
const body = codexMcpBlockBody(SCRIPT);
const user = 'model = "gpt-5"\n\n[mcp_servers.outro]\ncommand = "x"\n';

describe('codex managed TOML block', () => {
  it('builds the mcp table with a path that has spaces', () => {
    expect(body).toBe(
      '[mcp_servers.delphi-dev-kb]\ncommand = "node"\nargs = ["D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs"]',
    );
  });

  it('appends after the user content without touching it', () => {
    const out = upsertManagedBlock(user, body);
    expect(out.startsWith(user)).toBe(true);
    expect(out).toContain(`${BLOCK_START}\n${body}\n${BLOCK_END}\n`);
  });

  it('creates the content for an empty file', () => {
    expect(upsertManagedBlock('', body)).toBe(`${BLOCK_START}\n${body}\n${BLOCK_END}\n`);
  });

  it('replaces the existing block instead of duplicating it', () => {
    const once = upsertManagedBlock(user, body);
    const twice = upsertManagedBlock(once, codexMcpBlockBody('C:/outro/runtime/kb-mcp.mjs'));
    expect(twice.split(BLOCK_START)).toHaveLength(2);
    expect(twice).toContain('C:/outro/runtime/kb-mcp.mjs');
    expect(twice).not.toContain('D:/2.2 GitHub');
  });

  it('is idempotent', () => {
    const once = upsertManagedBlock(user, body);
    expect(upsertManagedBlock(once, body)).toBe(once);
  });

  it('keeps CRLF files in CRLF', () => {
    const crlf = 'model = "gpt-5"\r\n';
    const out = upsertManagedBlock(crlf, body);
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('removes the block and gives the user content back', () => {
    expect(removeManagedBlock(upsertManagedBlock(user, body))).toBe(user);
    expect(removeManagedBlock(upsertManagedBlock('', body))).toBe('');
  });

  it('detects the same table outside the block, quoted or not', () => {
    expect(hasTableOutsideBlock('[mcp_servers.delphi-dev-kb]\ncommand = "x"\n', 'mcp_servers.delphi-dev-kb')).toBe(true);
    expect(hasTableOutsideBlock('[mcp_servers."delphi-dev-kb"]\n', 'mcp_servers.delphi-dev-kb')).toBe(true);
    expect(hasTableOutsideBlock(user, 'mcp_servers.delphi-dev-kb')).toBe(false);
  });

  it('ignores the same table when it is inside the managed block', () => {
    expect(hasTableOutsideBlock(upsertManagedBlock(user, body), 'mcp_servers.delphi-dev-kb')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/toml.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets/toml".

- [ ] **Step 3: Implementar**

`kb/src/targets/toml.ts`:

```ts
export const BLOCK_START = '# >>> delphi-dev (gerenciado; nao edite entre os marcadores) >>>';
export const BLOCK_END = '# <<< delphi-dev <<<';

function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function region(text: string): { start: number; end: number } | null {
  const start = text.indexOf(BLOCK_START);
  if (start < 0) return null;
  const end = text.indexOf(BLOCK_END, start);
  if (end < 0) return null;
  return { start, end: end + BLOCK_END.length };
}

export function upsertManagedBlock(text: string, body: string): string {
  const eol = eolOf(text);
  const block = [BLOCK_START, ...body.replace(/\r\n/g, '\n').split('\n'), BLOCK_END].join(eol);
  const r = region(text);
  if (r) return text.slice(0, r.start) + block + text.slice(r.end);
  if (text.trim() === '') return block + eol;
  const separator = text.endsWith('\n') ? eol : eol + eol;
  return text + separator + block + eol;
}

export function removeManagedBlock(text: string): string {
  const r = region(text);
  if (!r) return text;
  const before = text.slice(0, r.start).replace(/(\r?\n)\r?\n$/, '$1');
  const after = text.slice(r.end).replace(/^\r?\n/, '');
  const out = before + after;
  return out.trim() === '' ? '' : out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `[a.b.c]` is declared outside our managed block (a duplicate would break the agent's config). */
export function hasTableOutsideBlock(text: string, table: string): boolean {
  const r = region(text);
  const rest = r ? text.slice(0, r.start) + text.slice(r.end) : text;
  const parts = table.split('.').map((p) => `(?:"${escapeRegExp(p)}"|${escapeRegExp(p)})`);
  return new RegExp(`^\\s*\\[\\s*${parts.join('\\s*\\.\\s*')}\\s*\\]`, 'm').test(rest);
}

export function codexMcpBlockBody(serverScript: string): string {
  return ['[mcp_servers.delphi-dev-kb]', 'command = "node"', `args = [${JSON.stringify(serverScript)}]`].join('\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb/src/targets/toml.ts kb/__tests__/toml.test.ts
git commit -m "feat(kb): bloco gerenciado no config.toml do Codex com deteccao de tabela duplicada"
```

---

### Task 9: Merge estrito de `opencode.json` e `hooks.json`

**Files:**
- Create: `kb/src/targets/jsonMerge.ts`, `kb/__tests__/jsonMerge.test.ts`

**Interfaces:**
- Produces:
  - `type MergeResult = { ok: true; text: string; changed: boolean } | { ok: false; reason: string }`
  - `interface HookEntry { event: string; matcher?: string; command: string; commandWindows?: string }`
  - `mergeOpencodeMcp(text: string | null, name: string, entry: Record<string, unknown>): MergeResult`
  - `removeOpencodeMcp(text: string, name: string): MergeResult`
  - `mergeCodexHooks(text: string | null, entries: HookEntry[]): MergeResult`
  - `removeCodexHooks(text: string): MergeResult`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/jsonMerge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  mergeCodexHooks, mergeOpencodeMcp, removeCodexHooks, removeOpencodeMcp, type HookEntry,
} from '../src/targets/jsonMerge';

const entry = { type: 'local', command: ['node', 'D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs'], enabled: true };

const parse = (r: { ok: true; text: string } | { ok: false; reason: string }) => {
  if (!r.ok) throw new Error(r.reason);
  return JSON.parse(r.text);
};

describe('mergeOpencodeMcp', () => {
  it('creates a config when there is no file', () => {
    const r = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    expect(parse(r)).toEqual({ $schema: 'https://opencode.ai/config.json', mcp: { 'delphi-dev-kb': entry } });
  });

  it('adds the server and keeps every other key, in order, with the same indent', () => {
    const original = '{\n\t"$schema": "https://opencode.ai/config.json",\n\t"provider": { "x": { "options": {} } },\n\t"mcp": { "aws-mcp": { "type": "remote", "url": "https://a" } }\n}\n';
    const r = mergeOpencodeMcp(original, 'delphi-dev-kb', entry);
    if (!r.ok) throw new Error(r.reason);
    const out = JSON.parse(r.text);
    expect(Object.keys(out)).toEqual(['$schema', 'provider', 'mcp']);
    expect(Object.keys(out.mcp)).toEqual(['aws-mcp', 'delphi-dev-kb']);
    expect(out.provider).toEqual({ x: { options: {} } });
    expect(r.text).toContain('\n\t"provider"');
    expect(r.changed).toBe(true);
  });

  it('is a no-op when our entry is already identical', () => {
    const first = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    if (!first.ok) throw new Error(first.reason);
    const again = mergeOpencodeMcp(first.text, 'delphi-dev-kb', entry);
    expect(again).toEqual({ ok: true, text: first.text, changed: false });
  });

  it('updates our own entry when it points to another checkout', () => {
    const old = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'local', command: ['node', 'C:/antigo/runtime/kb-mcp.mjs'], enabled: true } } });
    const r = mergeOpencodeMcp(old, 'delphi-dev-kb', entry);
    expect(parse(r).mcp['delphi-dev-kb']).toEqual(entry);
  });

  it('refuses to replace a foreign server with the same name', () => {
    const foreign = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'https://x' } } });
    expect(mergeOpencodeMcp(foreign, 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'conflict' });
  });

  it('refuses JSON with comments (JSONC) and never rewrites it', () => {
    const jsonc = '{\n  // meu provedor\n  "provider": {}\n}\n';
    expect(mergeOpencodeMcp(jsonc, 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('refuses a non-object mcp', () => {
    expect(mergeOpencodeMcp('{"mcp": []}', 'delphi-dev-kb', entry)).toEqual({ ok: false, reason: 'mcp-not-an-object' });
  });
});

describe('removeOpencodeMcp', () => {
  it('removes only our entry and drops an emptied mcp object', () => {
    const only = mergeOpencodeMcp(null, 'delphi-dev-kb', entry);
    if (!only.ok) throw new Error(only.reason);
    expect(parse(removeOpencodeMcp(only.text, 'delphi-dev-kb'))).toEqual({ $schema: 'https://opencode.ai/config.json' });

    const shared = JSON.stringify({ mcp: { a: { type: 'remote', url: 'u' }, 'delphi-dev-kb': entry } });
    expect(parse(removeOpencodeMcp(shared, 'delphi-dev-kb'))).toEqual({ mcp: { a: { type: 'remote', url: 'u' } } });
  });

  it('leaves a foreign entry with the same name alone', () => {
    const foreign = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'u' } } });
    expect(removeOpencodeMcp(foreign, 'delphi-dev-kb')).toEqual({ ok: true, text: foreign, changed: false });
  });
});

const HOOKS: HookEntry[] = [
  { event: 'PostToolUse', matcher: 'apply_patch|Write|Edit',
    command: 'command -v node >/dev/null 2>&1 && node "C:/x/runtime/hook-fix-encoding.mjs"; exit 0',
    commandWindows: 'where node >nul 2>nul && node "C:/x/runtime/hook-fix-encoding.mjs" & exit /b 0' },
  { event: 'UserPromptSubmit',
    command: 'command -v node >/dev/null 2>&1 && node "C:/x/runtime/hook-inject.mjs"; exit 0',
    commandWindows: 'where node >nul 2>nul && node "C:/x/runtime/hook-inject.mjs" & exit /b 0' },
];

describe('codex hooks.json', () => {
  it('creates the file structure', () => {
    const out = parse(mergeCodexHooks(null, HOOKS));
    expect(out.hooks.PostToolUse[0].matcher).toBe('apply_patch|Write|Edit');
    expect(out.hooks.PostToolUse[0].hooks[0]).toMatchObject({ type: 'command' });
    expect(out.hooks.UserPromptSubmit[0].hooks[0].commandWindows).toContain('hook-inject.mjs');
  });

  it('keeps the hooks of the user and of other tools', () => {
    const user = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] }, outra: 1 };
    const out = parse(mergeCodexHooks(JSON.stringify(user), HOOKS));
    expect(out.outra).toBe(1);
    expect(out.hooks.PostToolUse).toHaveLength(2);
    expect(out.hooks.PostToolUse[0].hooks[0].command).toBe('echo meu');
  });

  it('is idempotent and updates our entry when the checkout moves', () => {
    const first = mergeCodexHooks(null, HOOKS);
    if (!first.ok) throw new Error(first.reason);
    expect(mergeCodexHooks(first.text, HOOKS)).toEqual({ ok: true, text: first.text, changed: false });

    const moved = HOOKS.map((h) => ({ ...h, command: h.command.replace('C:/x', 'D:/novo'), commandWindows: h.commandWindows?.replace('C:/x', 'D:/novo') }));
    const out = parse(mergeCodexHooks(first.text, moved));
    expect(out.hooks.PostToolUse).toHaveLength(1);
    expect(out.hooks.PostToolUse[0].hooks[0].command).toContain('D:/novo');
  });

  it('removes only our entries', () => {
    const user = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } };
    const merged = mergeCodexHooks(JSON.stringify(user), HOOKS);
    if (!merged.ok) throw new Error(merged.reason);
    expect(parse(removeCodexHooks(merged.text))).toEqual(user);

    const only = mergeCodexHooks(null, HOOKS);
    if (!only.ok) throw new Error(only.reason);
    expect(parse(removeCodexHooks(only.text))).toEqual({});
  });

  it('refuses invalid JSON', () => {
    expect(mergeCodexHooks('{ nope', HOOKS)).toEqual({ ok: false, reason: 'invalid-json' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/jsonMerge.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets/jsonMerge".

- [ ] **Step 3: Implementar**

`kb/src/targets/jsonMerge.ts`:

```ts
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

function isObject(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseObject(text: string): { ok: true; value: Obj } | { ok: false; reason: string } {
  try {
    const value = JSON.parse(text) as unknown;
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
  return JSON.stringify(value, null, indent).replace(/\n/g, eol) + eol;
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
  if (existing !== undefined) {
    if (JSON.stringify(existing) === JSON.stringify(entry)) return { ok: true, text, changed: false };
    if (!isOurMcp(existing)) return { ok: false, reason: 'conflict' };
  }
  mcp[name] = entry;
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

function hookObject(entry: HookEntry): Obj {
  const hook: Obj = { type: 'command', command: entry.command };
  if (entry.commandWindows) hook.commandWindows = entry.commandWindows;
  return hook;
}

export function mergeCodexHooks(text: string | null, entries: HookEntry[]): MergeResult {
  let root: Obj = {};
  if (text !== null && text.trim() !== '') {
    const parsed = parseObject(text);
    if (!parsed.ok) return parsed;
    root = parsed.value;
  }
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
      const at = list.findIndex((h) => isObject(h) && OUR_HOOK.test(String(h.command)) && scriptOf(h.command) === script);
      if (at >= 0) {
        list[at] = hookObject(entry);
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

  const changed = text === null || text.trim() === '' ? true : JSON.stringify(JSON.parse(text)) !== JSON.stringify(root);
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
    const kept: Obj[] = [];
    for (const group of groups as Obj[]) {
      const list = isObject(group) && Array.isArray(group.hooks) ? (group.hooks as Obj[]) : null;
      if (!list) {
        kept.push(group);
        continue;
      }
      const left = list.filter((h) => !(isObject(h) && OUR_HOOK.test(String(h.command))));
      if (left.length !== list.length) changed = true;
      if (left.length > 0) kept.push({ ...group, hooks: left });
    }
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
  }
  if (Object.keys(hooks).length === 0) delete root.hooks;
  return { ok: true, text: changed ? render(root, text) : text, changed };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb/src/targets/jsonMerge.ts kb/__tests__/jsonMerge.test.ts
git commit -m "feat(kb): merge estrito de opencode.json e hooks.json do Codex, sem tocar no que e do usuario"
```

---

### Task 10: Conversores de subagente (Codex TOML e OpenCode MD)

**Files:**
- Create: `kb/src/targets/agents.ts`, `kb/__tests__/agents.test.ts`

**Interfaces:**
- Produces: `interface AgentDef { name; description; model?; body }`, `parseAgent(raw)`, `cleanDescription(desc, max?)`, `tomlString(value)`, `toCodexToml(a)`, `toOpencodeAgent(a)`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/agents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cleanDescription, parseAgent, toCodexToml, toOpencodeAgent, tomlString } from '../src/targets/agents';
import { REAL_ROOT } from './helpers';

const real = (name: string) => parseAgent(fs.readFileSync(path.join(REAL_ROOT, 'agents', `${name}.md`), 'utf8'));

describe('cleanDescription', () => {
  it('cuts at the first <example> or Exemplos: and collapses whitespace', () => {
    const raw = 'Subagente  especializado\n  em Delphi. Exemplos: <example>Context: x</example>';
    expect(cleanDescription(raw)).toBe('Subagente especializado em Delphi.');
    expect(cleanDescription('Faz X. <example>y</example>')).toBe('Faz X.');
  });

  it('caps at the limit on a word boundary', () => {
    const out = cleanDescription('palavra '.repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('...')).toBe(true);
    expect(out).not.toMatch(/palav\.\.\.$/);
  });
});

describe('tomlString', () => {
  it('uses a literal multiline string when it is safe', () => {
    expect(tomlString('a\\b "c"')).toBe("'''\na\\b \"c\"\n'''");
  });

  it("falls back to an escaped basic string when the body contains '''", () => {
    expect(tomlString("tem ''' aqui\nlinha")).toBe(JSON.stringify("tem ''' aqui\nlinha"));
  });

  it('escapes DEL and control characters through the basic string', () => {
    expect(tomlString(`a${String.fromCharCode(1)}b`)).toBe('"a\\u0001b"');
    expect(tomlString(`a${String.fromCharCode(127)}b`)).toBe('"a\\u007fb"');
  });
});

describe('real agents', () => {
  it.each(['delphi-auditor', 'delphi-spec-writer', 'delphi-tester', 'delphi-writer'])('converts %s', (name) => {
    const agent = real(name);
    expect(agent.name).toBe(name);
    const toml = toCodexToml(agent);
    expect(toml).toContain(`name = "${name}"`);
    expect(toml).toContain("developer_instructions = '''");
    expect(toml).not.toContain('<example>');
    const description = toml.split('\n').find((l) => l.startsWith('description = '))!;
    expect(description.length).toBeLessThan(700);

    const md = toOpencodeAgent(agent);
    expect(md.startsWith('---\ndescription: "')).toBe(true);
    expect(md).toContain('\nmode: subagent\n---\n');
    expect(md).not.toContain('model: inherit');
    expect(md).toContain(agent.body.split('\n')[0]);
  });

  it('keeps the writer -> tester delegation text', () => {
    expect(real('delphi-writer').body).toContain('delphi-tester');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/agents.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets/agents".

- [ ] **Step 3: Implementar**

`kb/src/targets/agents.ts`:

```ts
import { readFrontmatter } from '../frontmatter';

export interface AgentDef {
  name: string;
  description: string;
  model?: string;
  body: string;
}

export function parseAgent(raw: string): AgentDef {
  const fm = readFrontmatter(raw);
  const name = fm.data.name;
  if (!name) throw new Error('agent without a name in the frontmatter');
  return {
    name,
    description: fm.data.description ?? '',
    model: fm.data.model,
    body: fm.body.replace(/^\n+/, '').trimEnd(),
  };
}

/** The original description carries <example> blocks and "Exemplos:" tails meant for Claude Code. */
export function cleanDescription(description: string, max = 600): string {
  let text = description;
  const cut = text.search(/<example>|\bExemplos?:|\bExamples?:/i);
  if (cut >= 0) text = text.slice(0, cut);
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > max) {
    const head = text.slice(0, max - 3);
    const space = head.lastIndexOf(' ');
    text = `${(space > 0 ? head.slice(0, space) : head).trimEnd()}...`;
  }
  return text;
}

function basicString(value: string): string {
  return JSON.stringify(value).replace(/\x7f/g, '\\u007f');
}

export function tomlString(value: string): string {
  const safe = !value.includes("'''") && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
  return safe ? `'''\n${value}\n'''` : basicString(value);
}

export function toCodexToml(agent: AgentDef): string {
  return [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${basicString(cleanDescription(agent.description))}`,
    `developer_instructions = ${tomlString(agent.body)}`,
    '',
  ].join('\n');
}

export function toOpencodeAgent(agent: AgentDef): string {
  return [
    '---',
    `description: ${JSON.stringify(cleanDescription(agent.description))}`,
    'mode: subagent',
    '---',
    '',
    agent.body,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS. Confirme que `\x7f`/`\x00` continuam escritos como escapes de 4 caracteres no arquivo (`grep -n 'x7f' kb/src/targets/agents.ts`).

- [ ] **Step 5: Commit**

```bash
git add kb/src/targets/agents.ts kb/__tests__/agents.test.ts
git commit -m "feat(kb): conversores de subagente para Codex (TOML) e OpenCode (MD)"
```

---

### Task 11: Conversores de comando (skill do Codex e comando do OpenCode)

**Files:**
- Create: `kb/src/targets/commands.ts`, `kb/__tests__/commands.test.ts`

**Interfaces:**
- Consumes: `commandSkillName`, `opencodeCommandName`, `readFrontmatter`
- Produces: `interface CommandDef { id; description; body }`, `parseCommand(id, raw)`, `toCodexCommandSkill(c): { name; skillMd; openaiYaml }`, `toOpencodeCommand(c): { fileName; text }`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/commands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCommand, toCodexCommandSkill, toOpencodeCommand } from '../src/targets/commands';
import { readFrontmatter } from '../src/frontmatter';
import { REAL_ROOT } from './helpers';

const raw = '---\ndescription: Auditar o projeto: com "aspas"\n---\n\nAuditar $ARGUMENTS agora.\n';

describe('command converters', () => {
  it('parses description and body', () => {
    expect(parseCommand('audit', raw)).toEqual({
      id: 'audit',
      description: 'Auditar o projeto: com "aspas"',
      body: 'Auditar $ARGUMENTS agora.',
    });
    expect(() => parseCommand('x', '---\n---\ncorpo')).toThrow();
  });

  it('builds a Codex skill that is explicit-only and yaml-safe', () => {
    const out = toCodexCommandSkill(parseCommand('audit', raw));
    expect(out.name).toBe('delphi-cmd-audit');
    const fm = readFrontmatter(out.skillMd);
    expect(fm.data.name).toBe('delphi-cmd-audit');
    expect(fm.data.description).toContain('Comando /audit do delphi-dev');
    expect(fm.data.description).toContain('Auditar o projeto: com "aspas"');
    expect(fm.body).toContain('Auditar o que o usu');
    expect(fm.body).not.toContain('$ARGUMENTS');
    expect(out.openaiYaml).toBe('policy:\n  allow_implicit_invocation: false\n');
  });

  it('builds the OpenCode command with only description in the frontmatter', () => {
    const out = toOpencodeCommand(parseCommand('new-project', raw));
    expect(out.fileName).toBe('delphi-new-project.md');
    expect(out.text).toBe('---\ndescription: "Auditar o projeto: com \\"aspas\\""\n---\n\nAuditar $ARGUMENTS agora.\n');
  });

  it('converts every real command', () => {
    const dir = path.join(REAL_ROOT, 'commands');
    const files = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    expect(files.length).toBe(11);
    for (const file of files) {
      const def = parseCommand(file.slice(0, -3), fs.readFileSync(path.join(dir, file), 'utf8'));
      const skill = toCodexCommandSkill(def);
      expect(readFrontmatter(skill.skillMd).data.description.length).toBeLessThanOrEqual(1024);
      expect(toOpencodeCommand(def).text.length).toBeGreaterThan(50);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/commands.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets/commands".

- [ ] **Step 3: Implementar**

`kb/src/targets/commands.ts`:

```ts
import { readFrontmatter } from '../frontmatter';
import { commandSkillName, opencodeCommandName } from '../registry';

export interface CommandDef {
  id: string;
  description: string;
  body: string;
}

const ARGUMENTS_TEXT = 'o que o usuário informou depois do comando';

export function parseCommand(id: string, raw: string): CommandDef {
  const fm = readFrontmatter(raw);
  const description = (fm.data.description ?? '').replace(/\s+/g, ' ').trim();
  if (!description) throw new Error(`command ${id} has no description`);
  return { id, description, body: fm.body.replace(/^\n+/, '').trimEnd() };
}

/** Codex has no custom slash commands: each command becomes an explicit-only skill. */
export function toCodexCommandSkill(command: CommandDef): { name: string; skillMd: string; openaiYaml: string } {
  const name = commandSkillName(command.id);
  const description = `Comando /${command.id} do delphi-dev (chamada explícita). ${command.description}`;
  const skillMd = [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    command.body.split('$ARGUMENTS').join(ARGUMENTS_TEXT),
    '',
  ].join('\n');
  const openaiYaml = ['policy:', '  allow_implicit_invocation: false', ''].join('\n');
  return { name, skillMd, openaiYaml };
}

export function toOpencodeCommand(command: CommandDef): { fileName: string; text: string } {
  const text = ['---', `description: ${JSON.stringify(command.description)}`, '---', '', command.body, ''].join('\n');
  return { fileName: `${opencodeCommandName(command.id)}.md`, text };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb/src/targets/commands.ts kb/__tests__/commands.test.ts
git commit -m "feat(kb): conversores de comando para skill do Codex e comando do OpenCode"
```

---

### Task 12: `fix-encoding` entende `filePath`/`path` e ganha o subcomando de rede de proteção

**Files:**
- Modify: `kb/src/hook-fix-encoding.ts`, `kb/src/cli-install.ts`, `kb/src/cli.ts`, `kb/__tests__/hook-fix-encoding.test.ts`, `kb/__tests__/cli.test.ts`, `runtime/*.mjs`

**Interfaces:**
- Produces: `pathsFromPayload` aceita `file_path | filePath | path`; `fixEncodingCommand(args, io): number` e `kb-cli fix-encoding <arquivos…>`

- [ ] **Step 1: Testes (vermelho)**

Em `kb/__tests__/hook-fix-encoding.test.ts`, dentro de `describe('payloads', …)`, acrescente:

```ts
  it('reads OpenCode filePath and a bare path', () => {
    const cwd = tmpDir();
    expect(pathsFromPayload({ tool_name: 'edit', cwd, tool_input: { filePath: 'A.pas' } })).toEqual([path.join(cwd, 'A.pas')]);
    expect(pathsFromPayload({ cwd, tool_input: { path: 'B.dpr' } })).toEqual([path.join(cwd, 'B.dpr')]);
  });
```

Em `kb/__tests__/cli.test.ts` acrescente (reutilizando `io()` do arquivo; importe `fs`, `path` e `tmpDir` se ainda não houver):

```ts
  it('fix-encoding adds the BOM to sources and reports what changed', async () => {
    const dir = tmpDir();
    const pas = path.join(dir, 'U.pas');
    const dfm = path.join(dir, 'F.dfm');
    fs.writeFileSync(pas, 'unit U;');
    fs.writeFileSync(dfm, "object F: TForm\n  Caption = 'Servi\u00e7o'\nend");
    const run = io();
    expect(await runCli(['fix-encoding', pas, dfm], run.value)).toBe(0);
    expect(fs.readFileSync(pas)[0]).toBe(0xef);
    expect(fs.readFileSync(dfm, 'latin1')).toContain("Caption = 'Servi'#231'o'");
    expect(run.out).toEqual([`corrigido ${pas}`, `corrigido ${dfm}`, '2 arquivo(s) corrigido(s)']);

    const again = io();
    await runCli(['fix-encoding', pas], again.value);
    expect(again.out[0]).toBe(`ok ${pas}`);
  });

  it('fix-encoding without files is a usage error', async () => {
    const run = io();
    expect(await runCli(['fix-encoding'], run.value)).toBe(64);
  });
```

Run: `cd kb && npx vitest run __tests__/hook-fix-encoding.test.ts __tests__/cli.test.ts`
Expected: FAIL nos três testes novos.

- [ ] **Step 2: Implementar**

Em `kb/src/hook-fix-encoding.ts`, na função `pathsFromPayload`, substitua as linhas que declaram `input`, `raw` e leem `file_path` por:

```ts
  const input = p.tool_input as { file_path?: unknown; filePath?: unknown; path?: unknown } | undefined;
  const raw: string[] = [];
  if (input && typeof input === 'object') {
    for (const key of ['file_path', 'filePath', 'path'] as const) {
      const value = input[key];
      if (typeof value === 'string') raw.push(value);
    }
  }
```

(removendo o antigo `const input = … { file_path?: unknown } …;`, o `const raw: string[] = [];` e o `if (input && typeof input === 'object' && typeof input.file_path === 'string') raw.push(input.file_path);`).

Em `kb/src/cli-install.ts`, acrescente os imports `import * as fs from 'node:fs'; import * as path from 'node:path'; import { fixEncoding } from './hook-fix-encoding';` e a função:

```ts
export function fixEncodingCommand(args: string[], io: CliIO): number {
  if (!args.length) {
    io.err('usage: kb-cli fix-encoding <arquivo...>');
    return 64;
  }
  let changed = 0;
  for (const file of args) {
    const abs = path.resolve(file);
    let before: Buffer;
    try {
      before = fs.readFileSync(abs);
    } catch {
      io.err(`nao encontrado: ${file}`);
      continue;
    }
    try {
      fixEncoding(abs);
    } catch (err) {
      io.err(`falhou: ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (before.equals(fs.readFileSync(abs))) {
      io.out(`ok ${file}`);
    } else {
      changed++;
      io.out(`corrigido ${file}`);
    }
  }
  io.out(`${changed} arquivo(s) corrigido(s)`);
  return 0;
}
```

Em `kb/src/cli.ts`: troque o import por `import { fixEncodingCommand, lintCommand } from './cli-install';`; no `USAGE` acrescente `'  fix-encoding <arquivo...>',`; antes do `default:` acrescente `case 'fix-encoding': return fixEncodingCommand(rest, io);`.

- [ ] **Step 3: Rodar, reconstruir, commitar**

Run: `cd kb && npx vitest run && npx tsc --noEmit && npm run build:runtime`
Expected: PASS; bundles regenerados.

```bash
git add kb/src kb/__tests__ runtime/
git commit -m "feat(kb): fix-encoding aceita filePath/path e ganha o subcomando kb-cli fix-encoding"
```

---

### Task 13: Gerador do plugin de hooks do OpenCode

**Files:**
- Create: `kb/src/targets/opencodePlugin.ts`, `kb/__tests__/opencodePlugin.test.ts`

**Interfaces:**
- Consumes: bundles `runtime/hook-fix-encoding.mjs` e `runtime/hook-inject.mjs` (da Task 12)
- Produces: `renderOpencodePlugin(checkoutDir: string): string`

- [ ] **Step 1: Escrever o teste (executa o plugin gerado num processo Node)**

`kb/__tests__/opencodePlugin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderOpencodePlugin } from '../src/targets/opencodePlugin';
import { REAL_ROOT, tmpDir } from './helpers';

describe('renderOpencodePlugin', () => {
  it('embeds the checkout path with forward slashes', () => {
    const js = renderOpencodePlugin('D:\\2.2 GitHub Adriano Santos\\delphi-dev');
    expect(js).toContain('"D:/2.2 GitHub Adriano Santos/delphi-dev"');
    expect(js).toContain('gerenciado');
  });

  it('runs: BOM after an edit and knowledge injected into the system prompt', () => {
    const work = tmpDir('kb-oc-plugin-');
    const plugin = path.join(work, 'delphi-dev.mjs');
    fs.writeFileSync(plugin, renderOpencodePlugin(REAL_ROOT));
    const pas = path.join(work, 'Unit1.pas');
    fs.writeFileSync(pas, 'unit Unit1;');

    const runner = path.join(work, 'runner.mjs');
    fs.writeFileSync(runner, `
      import plugin from ${JSON.stringify(pathToFileURL(plugin).href)};
      const hooks = await plugin({ directory: ${JSON.stringify(work)} });
      const out = { keys: Object.keys(hooks).sort() };
      await hooks['chat.message']({ sessionID: 's1' }, { parts: [{ type: 'text', text: 'erro E2356 property accessor class var' }] });
      const output = { system: [] };
      await hooks['experimental.chat.system.transform']({}, output);
      out.system = output.system;
      await hooks['tool.execute.after']({ tool: 'edit', args: { filePath: ${JSON.stringify(pas)} } }, {});
      console.log(JSON.stringify(out));
    `);

    const r = spawnSync(process.execPath, [runner], {
      encoding: 'utf8',
      env: { ...process.env, DELPHI_DEV_DATA: path.join(work, 'data'), DELPHI_DEV_KB_OFFLINE: '1' },
    });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.keys).toEqual(['chat.message', 'experimental.chat.system.transform', 'tool.execute.after']);
    expect(out.system).toHaveLength(1);
    expect(out.system[0]).toContain('[DELPHI-DEV KNOWLEDGE]');
    expect(fs.readFileSync(pas).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
  });

  it('never throws when the hook scripts are missing', () => {
    const work = tmpDir('kb-oc-plugin-');
    const plugin = path.join(work, 'delphi-dev.mjs');
    fs.writeFileSync(plugin, renderOpencodePlugin(path.join(work, 'nao-existe')));
    const runner = path.join(work, 'runner.mjs');
    fs.writeFileSync(runner, `
      import plugin from ${JSON.stringify(pathToFileURL(plugin).href)};
      const hooks = await plugin({});
      await hooks['chat.message']({}, { parts: [{ type: 'text', text: 'E2356' }] });
      const output = { system: [] };
      await hooks['experimental.chat.system.transform']({}, output);
      await hooks['tool.execute.after']({ tool: 'write', args: { filePath: 'x.pas' } }, {});
      console.log(JSON.stringify(output.system));
    `);
    const r = spawnSync(process.execPath, [runner], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/opencodePlugin.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets/opencodePlugin".

- [ ] **Step 3: Implementar**

`kb/src/targets/opencodePlugin.ts`:

```ts
/**
 * JavaScript plugin that OpenCode auto-loads from ~/.config/opencode/plugins/.
 * It only shells out to the committed runtime bundles; every failure is swallowed.
 */
export function renderOpencodePlugin(checkoutDir: string): string {
  const root = checkoutDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return `// delphi-dev (gerenciado: regenerado por \`kb-cli install\`; nao edite)
import { spawnSync } from "node:child_process";

const ROOT = ${JSON.stringify(root)};
const FIX_ENCODING = ROOT + "/runtime/hook-fix-encoding.mjs";
const INJECT = ROOT + "/runtime/hook-inject.mjs";
const EDIT_TOOLS = new Set(["edit", "write", "patch", "apply_patch", "multiedit"]);

function run(script, payload) {
  try {
    const r = spawnSync("node", [script], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    return r.status === 0 && typeof r.stdout === "string" ? r.stdout : "";
  } catch {
    return "";
  }
}

export default async function DelphiDev(ctx) {
  const cwd = (ctx && (ctx.directory || ctx.worktree)) || process.cwd();
  let lastPrompt = "";
  return {
    "chat.message": async (_input, output) => {
      try {
        const parts = (output && output.parts) || [];
        lastPrompt = parts
          .filter((p) => p && p.type === "text" && typeof p.text === "string")
          .map((p) => p.text)
          .join("\\n");
      } catch {}
    },
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        if (!lastPrompt || !output || !Array.isArray(output.system)) return;
        const raw = run(INJECT, { prompt: lastPrompt, cwd });
        if (!raw) return;
        const context = JSON.parse(raw)?.hookSpecificOutput?.additionalContext;
        if (typeof context === "string" && context) output.system.push(context);
      } catch {}
    },
    "tool.execute.after": async (input) => {
      try {
        const tool = input && input.tool;
        if (!EDIT_TOOLS.has(String(tool).toLowerCase())) return;
        run(FIX_ENCODING, { tool_name: tool, tool_input: input.args || {}, cwd });
      } catch {}
    },
  };
}
`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS. O 2º teste depende de `runtime/hook-*.mjs` com o suporte a `filePath` (Task 12): se faltar o BOM, rode `npm run build:runtime` e confirme que a Task 12 foi commitada.

- [ ] **Step 5: Commit**

```bash
git add kb/src/targets/opencodePlugin.ts kb/__tests__/opencodePlugin.test.ts
git commit -m "feat(kb): gerador do plugin de hooks do OpenCode (fix-encoding e injecao da base)"
```

---
### Task 14: Propriedade de arquivos (`fsops`) e manifesto de instalação

**Files:**
- Create: `kb/src/install/fsops.ts`, `kb/__tests__/fsops.test.ts`

**Interfaces:**
- Produces:
  - `MARKER = '.delphi-dev-managed'`
  - tipos `OwnedFile`, `OwnedDir`, `OwnedKey`, `TargetRecord`, `InstallManifest`, `Report`, `Ctx`
  - `emptyRecord()`, `newReport()`, `emptyManifest()`, `sha256(data)`, `readTree(dir, ignore?)`, `treeHash(files)`, `atomicWrite(file, content)`
  - `readManifest(file)`, `writeManifest(file, manifest)`
  - `writeOwnedFile(ctx, file, content, rec)`, `writeOwnedDir(ctx, destDir, files, rec)`, `removeOwned(ctx, rec)`

- [ ] **Step 1: Escrever o teste**

`kb/__tests__/fsops.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  emptyRecord, MARKER, newReport, readManifest, removeOwned, sha256, writeManifest, writeOwnedDir, writeOwnedFile,
  type Ctx, type TargetRecord,
} from '../src/install/fsops';
import { tmpDir } from './helpers';

function ctx(over: Partial<Ctx> = {}): Ctx {
  return { dryRun: false, force: false, stamp: 'T', prev: emptyRecord(), report: newReport(), ...over };
}

const files = (obj: Record<string, string>) => new Map(Object.entries(obj).map(([k, v]) => [k, Buffer.from(v)]));

describe('writeOwnedFile', () => {
  it('creates a file and records its hash', () => {
    const file = path.join(tmpDir(), 'sub', 'a.md');
    const rec = emptyRecord();
    const c = ctx();
    writeOwnedFile(c, file, 'conteudo', rec);
    expect(fs.readFileSync(file, 'utf8')).toBe('conteudo');
    expect(c.report.written).toEqual([file]);
    expect(rec.files).toEqual([{ path: file, sha256: sha256('conteudo') }]);
  });

  it('reports unchanged on the second run', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    const c = ctx({ prev: first });
    const rec = emptyRecord();
    writeOwnedFile(c, file, 'v1', rec);
    expect(c.report.written).toEqual([]);
    expect(c.report.unchanged).toBe(1);
    expect(rec.files).toHaveLength(1);
  });

  it('overwrites a file it owns when the content changes', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    const c = ctx({ prev: first });
    writeOwnedFile(c, file, 'v2', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('v2');
    expect(c.report.written).toEqual([file]);
  });

  it('skips a pre-existing file it does not own', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    const c = ctx();
    const rec = emptyRecord();
    writeOwnedFile(c, file, 'nosso', rec);
    expect(fs.readFileSync(file, 'utf8')).toBe('do usuario');
    expect(c.report.skipped).toEqual([{ path: file, reason: 'exists-not-owned' }]);
    expect(rec.files).toEqual([]);
  });

  it('skips a file the user modified after the install', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    fs.writeFileSync(file, 'v1 editado');
    const c = ctx({ prev: first });
    writeOwnedFile(c, file, 'v2', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('v1 editado');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });

  it('with force, backs up and overwrites', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    writeOwnedFile(ctx({ force: true }), file, 'nosso', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('nosso');
    expect(fs.readFileSync(`${file}.bak-T`, 'utf8')).toBe('do usuario');
  });

  it('dry-run writes nothing but reports', () => {
    const file = path.join(tmpDir(), 'a.md');
    const c = ctx({ dryRun: true });
    writeOwnedFile(c, file, 'x', emptyRecord());
    expect(fs.existsSync(file)).toBe(false);
    expect(c.report.written).toEqual([file]);
  });
});

describe('writeOwnedDir', () => {
  it('copies the tree, writes the marker and is unchanged the second time', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# a', 'references/x.md': '# x' }), first);
    expect(fs.readFileSync(path.join(dest, 'references', 'x.md'), 'utf8')).toBe('# x');
    expect(fs.existsSync(path.join(dest, MARKER))).toBe(true);

    const c = ctx({ prev: first });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# a', 'references/x.md': '# x' }), emptyRecord());
    expect(c.report.unchanged).toBe(1);
    expect(c.report.written).toEqual([]);
  });

  it('never touches a folder without our marker (a skill of someone else)', () => {
    const dest = path.join(tmpDir(), 'aws-cdk');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'de terceiros');
    const c = ctx();
    const rec = emptyRecord();
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# nosso' }), rec);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('de terceiros');
    expect(c.report.skipped).toEqual([{ path: dest, reason: 'exists-not-owned' }]);
    expect(rec.dirs).toEqual([]);
  });

  it('replaces an owned folder when the source changed', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1', 'velho.md': 'x' }), first);
    writeOwnedDir(ctx({ prev: first }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# v2');
    expect(fs.existsSync(path.join(dest, 'velho.md'))).toBe(false);
  });

  it('skips an owned folder the user edited', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), first);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), '# editado');
    const c = ctx({ prev: first });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# editado');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });
});

describe('removeOwned', () => {
  function installed(): { rec: TargetRecord; file: string; dir: string } {
    const base = tmpDir();
    const file = path.join(base, 'a.md');
    const dir = path.join(base, 'skill');
    const rec = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', rec);
    writeOwnedDir(ctx(), dir, files({ 'SKILL.md': '# s' }), rec);
    return { rec, file, dir };
  }

  it('removes what is ours and unchanged', () => {
    const { rec, file, dir } = installed();
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(dir)).toBe(false);
    expect(c.report.removed).toHaveLength(2);
  });

  it('keeps what the user changed and warns', () => {
    const { rec, file, dir } = installed();
    fs.writeFileSync(file, 'editado');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# editado');
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(dir)).toBe(true);
    expect(c.report.warnings).toHaveLength(2);
  });

  it('with force removes even changed files', () => {
    const { rec, file } = installed();
    fs.writeFileSync(file, 'editado');
    removeOwned(ctx({ prev: rec, force: true }), rec);
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('manifest', () => {
  it('round-trips and tolerates a missing or corrupt file', () => {
    const file = path.join(tmpDir(), 'm', 'install-manifest.json');
    expect(readManifest(file).codex).toEqual(emptyRecord());
    const m = readManifest(file);
    m.codex.files.push({ path: 'x', sha256: 'y' });
    writeManifest(file, m);
    expect(readManifest(file).codex.files).toEqual([{ path: 'x', sha256: 'y' }]);
    fs.writeFileSync(file, '{corrompido');
    expect(readManifest(file).opencode).toEqual(emptyRecord());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/fsops.test.ts`
Expected: FAIL com "Failed to resolve import ../src/install/fsops".

- [ ] **Step 3: Implementar**

`kb/src/install/fsops.ts`:

```ts
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const MARKER = '.delphi-dev-managed';

export interface OwnedFile { path: string; sha256: string }
export interface OwnedDir { path: string; treeHash: string }
export interface OwnedKey { file: string; key: string }
export interface TargetRecord { files: OwnedFile[]; dirs: OwnedDir[]; blocks: string[]; keys: OwnedKey[] }
export interface InstallManifest {
  schema: 1;
  version: string;
  installedAt: string;
  codex: TargetRecord;
  opencode: TargetRecord;
}
export interface Report {
  written: string[];
  unchanged: number;
  skipped: { path: string; reason: string }[];
  warnings: string[];
  removed: string[];
}
export interface Ctx {
  dryRun: boolean;
  force: boolean;
  stamp: string;
  prev: TargetRecord;
  report: Report;
}

export const emptyRecord = (): TargetRecord => ({ files: [], dirs: [], blocks: [], keys: [] });
export const newReport = (): Report => ({ written: [], unchanged: 0, skipped: [], warnings: [], removed: [] });
export const emptyManifest = (): InstallManifest => ({
  schema: 1, version: '0', installedAt: '', codex: emptyRecord(), opencode: emptyRecord(),
});

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function readTree(dir: string, ignore: string[] = [MARKER]): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (current: string, rel: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, key);
      else if (entry.isFile()) out.set(key, fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out;
}

export function treeHash(files: Map<string, Buffer>): string {
  const h = createHash('sha256');
  for (const rel of [...files.keys()].sort()) {
    h.update(rel);
    h.update('\0');
    h.update(sha256(files.get(rel) as Buffer));
    h.update('\n');
  }
  return h.digest('hex');
}

export function atomicWrite(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function readManifest(file: string): InstallManifest {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    const rec = (value: unknown): TargetRecord => {
      const r = (value ?? {}) as Partial<TargetRecord>;
      return {
        files: Array.isArray(r.files) ? r.files : [],
        dirs: Array.isArray(r.dirs) ? r.dirs : [],
        blocks: Array.isArray(r.blocks) ? r.blocks : [],
        keys: Array.isArray(r.keys) ? r.keys : [],
      };
    };
    return {
      schema: 1,
      version: String(raw.version ?? '0'),
      installedAt: String(raw.installedAt ?? ''),
      codex: rec(raw.codex),
      opencode: rec(raw.opencode),
    };
  } catch {
    return emptyManifest();
  }
}

export function writeManifest(file: string, manifest: InstallManifest): void {
  atomicWrite(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function upsert<T extends { path: string }>(list: T[], item: T): void {
  const at = list.findIndex((x) => x.path === item.path);
  if (at >= 0) list[at] = item;
  else list.push(item);
}

export function writeOwnedFile(ctx: Ctx, file: string, content: string, rec: TargetRecord): void {
  const hash = sha256(content);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing !== null) {
    if (existing === content) {
      ctx.report.unchanged++;
      upsert(rec.files, { path: file, sha256: hash });
      return;
    }
    const recorded = ctx.prev.files.find((f) => f.path === file)?.sha256;
    const ours = recorded !== undefined && sha256(existing) === recorded;
    if (!ours) {
      if (!ctx.force) {
        ctx.report.skipped.push({ path: file, reason: recorded === undefined ? 'exists-not-owned' : 'modified-by-user' });
        return;
      }
      if (!ctx.dryRun) fs.copyFileSync(file, `${file}.bak-${ctx.stamp}`);
    }
  }
  if (!ctx.dryRun) atomicWrite(file, content);
  ctx.report.written.push(file);
  upsert(rec.files, { path: file, sha256: hash });
}

export function writeOwnedDir(ctx: Ctx, destDir: string, files: Map<string, Buffer>, rec: TargetRecord): void {
  const marker = path.join(destDir, MARKER);
  const next = treeHash(files);
  let replace = false;
  if (fs.existsSync(destDir)) {
    const hasMarker = fs.existsSync(marker);
    if (!hasMarker && !ctx.force) {
      ctx.report.skipped.push({ path: destDir, reason: 'exists-not-owned' });
      return;
    }
    if (hasMarker) {
      const current = treeHash(readTree(destDir));
      if (current === next) {
        ctx.report.unchanged++;
        upsert(rec.dirs, { path: destDir, treeHash: next });
        return;
      }
      const recorded = ctx.prev.dirs.find((d) => d.path === destDir)?.treeHash;
      if (recorded !== undefined && current !== recorded && !ctx.force) {
        ctx.report.skipped.push({ path: destDir, reason: 'modified-by-user' });
        return;
      }
      replace = true;
    } else if (!ctx.dryRun) {
      fs.renameSync(destDir, `${destDir}.bak-${ctx.stamp}`);
    }
  }
  if (!ctx.dryRun) {
    if (replace) fs.rmSync(destDir, { recursive: true, force: true });
    for (const [rel, data] of files) atomicWrite(path.join(destDir, ...rel.split('/')), data);
    atomicWrite(marker, `${JSON.stringify({ treeHash: next })}\n`);
  }
  ctx.report.written.push(destDir);
  upsert(rec.dirs, { path: destDir, treeHash: next });
}

export function removeOwned(ctx: Ctx, rec: TargetRecord): void {
  for (const f of rec.files) {
    if (!fs.existsSync(f.path)) continue;
    if (sha256(fs.readFileSync(f.path)) === f.sha256 || ctx.force) {
      if (!ctx.dryRun) fs.unlinkSync(f.path);
      ctx.report.removed.push(f.path);
    } else {
      ctx.report.warnings.push(`mantido (alterado por voce): ${f.path}`);
    }
  }
  for (const d of rec.dirs) {
    if (!fs.existsSync(d.path)) continue;
    const owned = fs.existsSync(path.join(d.path, MARKER)) && treeHash(readTree(d.path)) === d.treeHash;
    if (owned || ctx.force) {
      if (!ctx.dryRun) fs.rmSync(d.path, { recursive: true, force: true });
      ctx.report.removed.push(d.path);
    } else {
      ctx.report.warnings.push(`mantido (alterado por voce ou sem marcador): ${d.path}`);
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kb/src/install/fsops.ts kb/__tests__/fsops.test.ts
git commit -m "feat(kb): propriedade de arquivos e pastas com manifesto de instalacao"
```

---

### Task 15: `installTargets`, `uninstallTargets` e `doctor`

**Files:**
- Create: `kb/src/install/install.ts`, `kb/__tests__/install.test.ts`
- Modify: `kb/__tests__/helpers.ts` (`makeRepo` ganha o parâmetro `prefix`)

**Interfaces:**
- Consumes: Tasks 1, 8–11, 13, 14
- Produces:
  - `type InstallTarget = 'codex' | 'opencode'`, `MCP_SERVER = 'delphi-dev-kb'`
  - `interface InstallOptions { targets; scope: 'user'|'project'; home; project?; checkout; dryRun; force; env; now? }`
  - `type UninstallOptions = Pick<InstallOptions, 'targets'|'home'|'dryRun'|'force'|'env'|'now'>`
  - `manifestPath(o: { home; env }): string`
  - `installTargets(o): Report`, `uninstallTargets(o): Report`
  - `interface DoctorCheck { target; name; ok; detail }`, `doctor(o: { targets; home; env }): DoctorCheck[]`

- [ ] **Step 1: Ajustar o helper e escrever o teste**

Em `kb/__tests__/helpers.ts`, troque a assinatura de `makeRepo` por:

```ts
export function makeRepo(over: Record<string, string | null> = {}, prefix = 'kb-repo-'): string {
  const root = tmpDir(prefix);
```

(o resto da função não muda).

`kb/__tests__/install.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { doctor, installTargets, manifestPath, uninstallTargets, type InstallOptions } from '../src/install/install';
import { MARKER } from '../src/install/fsops';
import { BLOCK_START } from '../src/targets/toml';
import { makeRepo, REAL_ROOT, tmpDir, writeTree } from './helpers';

const cmd = (id: string) => ({
  id, title: { 'pt-BR': id, 'en-US': id }, description: { 'pt-BR': id, 'en-US': id }, takesFile: false, icon: 'info',
});

function checkout(prefix?: string): string {
  return makeRepo({
    'portable.json': JSON.stringify({
      schema: 1, skills: { 'delphi-claudeignore': { targets: ['claude'] } }, commands: [cmd('audit'), cmd('about')],
    }),
    'skills/delphi-claudeignore/SKILL.md': '---\nname: delphi-claudeignore\ndescription: So Claude.\n---\n# C\n',
    'skills/delphi-demo/references/x.md': '# x\n',
  }, prefix);
}

function opts(over: Partial<InstallOptions> = {}): InstallOptions {
  return {
    targets: ['codex', 'opencode'], scope: 'user', home: tmpDir('kb-home-'), checkout: checkout(),
    dryRun: false, force: false, env: {}, now: new Date('2026-10-15T10:00:00Z'), ...over,
  };
}

const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8');

describe('installTargets (user scope)', () => {
  it('writes the Codex artifacts', () => {
    const o = opts({ targets: ['codex'] });
    const report = installTargets(o);
    const skills = path.join(o.home, '.agents', 'skills');
    expect(fs.existsSync(path.join(skills, 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skills, 'delphi-claudeignore'))).toBe(false);
    expect(read(skills, 'delphi-cmd-audit', 'SKILL.md')).toContain('name: delphi-cmd-audit');
    expect(read(skills, 'delphi-cmd-audit', 'agents', 'openai.yaml')).toContain('allow_implicit_invocation: false');
    expect(read(o.home, '.codex', 'agents', 'delphi-writer.toml')).toContain('name = "delphi-writer"');
    const toml = read(o.home, '.codex', 'config.toml');
    expect(toml).toContain(BLOCK_START);
    expect(toml).toContain('[mcp_servers.delphi-dev-kb]');
    const hooks = JSON.parse(read(o.home, '.codex', 'hooks.json'));
    expect(hooks.hooks.PostToolUse[0].matcher).toBe('apply_patch|Write|Edit');
    expect(hooks.hooks.UserPromptSubmit).toHaveLength(1);
    expect(report.skipped).toEqual([]);
  });

  it('writes the OpenCode artifacts', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const cfg = path.join(o.home, '.config', 'opencode');
    expect(read(cfg, 'commands', 'delphi-audit.md')).toContain('description: ');
    expect(read(cfg, 'agents', 'delphi-writer.md')).toContain('mode: subagent');
    const json = JSON.parse(read(cfg, 'opencode.json'));
    expect(json.mcp['delphi-dev-kb'].command[0]).toBe('node');
    expect(json.mcp['delphi-dev-kb'].command[1].endsWith('/runtime/kb-mcp.mjs')).toBe(true);
    expect(read(cfg, 'plugins', 'delphi-dev.js')).toContain('tool.execute.after');
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo', MARKER))).toBe(true);
  });

  it('is idempotent', () => {
    const o = opts();
    installTargets(o);
    const again = installTargets(o);
    expect(again.written).toEqual([]);
    expect(again.skipped).toEqual([]);
    expect(again.unchanged).toBeGreaterThan(10);
  });

  it('puts forward-slash paths with spaces in every generated config', () => {
    const o = opts({ checkout: checkout('kb dir com espaco-') });
    installTargets(o);
    const normalized = o.checkout.replace(/\\/g, '/');
    expect(normalized).toContain(' ');
    expect(read(o.home, '.codex', 'config.toml')).toContain(`${normalized}/runtime/kb-mcp.mjs`);
    expect(read(o.home, '.config', 'opencode', 'opencode.json')).toContain(`${normalized}/runtime/kb-mcp.mjs`);
    expect(read(o.home, '.config', 'opencode', 'plugins', 'delphi-dev.js')).toContain(normalized);
  });

  it('honors CODEX_HOME and XDG_CONFIG_HOME', () => {
    const codexHome = tmpDir('kb-codexhome-');
    const xdg = tmpDir('kb-xdg-');
    const o = opts({ env: { CODEX_HOME: codexHome, XDG_CONFIG_HOME: xdg } });
    installTargets(o);
    expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(true);
    expect(fs.existsSync(path.join(xdg, 'opencode', 'opencode.json'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.codex'))).toBe(false);
  });

  it('dry-run writes nothing, not even the manifest', () => {
    const o = opts({ dryRun: true });
    const report = installTargets(o);
    expect(report.written.length).toBeGreaterThan(5);
    expect(fs.readdirSync(o.home)).toEqual([]);
  });
});

describe('installTargets keeps what is not ours', () => {
  function userHome(): string {
    const home = tmpDir('kb-home-');
    writeTree(home, {
      '.codex/config.toml': 'model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n',
      '.codex/hooks.json': JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } }),
      '.config/opencode/opencode.json': JSON.stringify({ provider: { x: {} }, mcp: { 'aws-mcp': { type: 'remote', url: 'https://a' } } }, null, 2),
      '.config/opencode/agents/delphi-reviewer.md': '---\ndescription: meu\nmode: subagent\n---\nmeu agente\n',
      '.agents/skills/aws-cdk/SKILL.md': '---\nname: aws-cdk\ndescription: x\n---\nde terceiros\n',
    });
    return home;
  }

  it('preserves user config, hooks, agents and foreign skills', () => {
    const home = userHome();
    installTargets(opts({ home }));
    expect(read(home, '.codex', 'config.toml').startsWith('model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n')).toBe(true);
    const hooks = JSON.parse(read(home, '.codex', 'hooks.json'));
    expect(hooks.hooks.PostToolUse[0].hooks[0].command).toBe('echo meu');
    expect(hooks.hooks.PostToolUse).toHaveLength(2);
    const oc = JSON.parse(read(home, '.config', 'opencode', 'opencode.json'));
    expect(oc.provider).toEqual({ x: {} });
    expect(Object.keys(oc.mcp)).toEqual(['aws-mcp', 'delphi-dev-kb']);
    expect(read(home, '.config', 'opencode', 'agents', 'delphi-reviewer.md')).toContain('meu agente');
    expect(read(home, '.agents', 'skills', 'aws-cdk', 'SKILL.md')).toContain('de terceiros');
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'aws-cdk', MARKER))).toBe(false);
  });

  it('does not duplicate a pre-existing mcp_servers.delphi-dev-kb table', () => {
    const home = tmpDir('kb-home-');
    const original = '[mcp_servers.delphi-dev-kb]\ncommand = "node"\nargs = ["/meu/caminho.mjs"]\n';
    writeTree(home, { '.codex/config.toml': original });
    const report = installTargets(opts({ home, targets: ['codex'] }));
    expect(read(home, '.codex', 'config.toml')).toBe(original);
    expect(report.warnings.join('\n')).toContain('mcp_servers.delphi-dev-kb');
  });

  it('refuses a JSONC opencode.json and prints what to add', () => {
    const home = tmpDir('kb-home-');
    const jsonc = '{\n  // meu\n  "provider": {}\n}\n';
    writeTree(home, { '.config/opencode/opencode.json': jsonc });
    const report = installTargets(opts({ home, targets: ['opencode'] }));
    expect(read(home, '.config', 'opencode', 'opencode.json')).toBe(jsonc);
    expect(report.warnings.join('\n')).toContain('delphi-dev-kb');
    expect(report.warnings.join('\n')).toContain('invalid-json');
  });

  it('refuses to replace a foreign mcp server with the same name', () => {
    const home = tmpDir('kb-home-');
    const original = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'https://x' } } });
    writeTree(home, { '.config/opencode/opencode.json': original });
    const report = installTargets(opts({ home, targets: ['opencode'] }));
    expect(read(home, '.config', 'opencode', 'opencode.json')).toBe(original);
    expect(report.warnings.join('\n')).toContain('conflict');
  });

  it('writes a backup of config files the first time it changes them', () => {
    const home = userHome();
    installTargets(opts({ home }));
    expect(read(home, '.codex', 'config.toml.delphi-dev.bak')).toBe('model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n');
  });
});

describe('uninstallTargets', () => {
  it('restores the user files and removes only what it installed', () => {
    const home = tmpDir('kb-home-');
    const toml = 'model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n';
    const hooks = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } };
    const oc = { provider: { x: {} }, mcp: { 'aws-mcp': { type: 'remote', url: 'https://a' } } };
    writeTree(home, {
      '.codex/config.toml': toml,
      '.codex/hooks.json': JSON.stringify(hooks),
      '.config/opencode/opencode.json': JSON.stringify(oc),
      '.agents/skills/aws-cdk/SKILL.md': 'de terceiros',
    });
    const o = opts({ home });
    installTargets(o);
    const report = uninstallTargets({ targets: ['codex', 'opencode'], home, dryRun: false, force: false, env: {} });

    expect(read(home, '.codex', 'config.toml')).toBe(toml);
    expect(JSON.parse(read(home, '.codex', 'hooks.json'))).toEqual(hooks);
    expect(JSON.parse(read(home, '.config', 'opencode', 'opencode.json'))).toEqual(oc);
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'delphi-demo'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'delphi-cmd-audit'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'agents', 'delphi-writer.toml'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'plugins', 'delphi-dev.js'))).toBe(false);
    expect(read(home, '.agents', 'skills', 'aws-cdk', 'SKILL.md')).toBe('de terceiros');
    expect(report.removed.length).toBeGreaterThan(5);
    expect(fs.existsSync(manifestPath({ home, env: {} }))).toBe(false);
  });

  it('keeps a file the user edited and warns', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const file = path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md');
    fs.appendFileSync(file, '\nminha nota\n');
    const report = uninstallTargets({ targets: ['opencode'], home: o.home, dryRun: false, force: false, env: {} });
    expect(fs.existsSync(file)).toBe(true);
    expect(report.warnings.join('\n')).toContain(file);
  });

  it('keeps shared skills while the other target is still installed', () => {
    const o = opts();
    installTargets(o);
    uninstallTargets({ targets: ['codex'], home: o.home, dryRun: false, force: false, env: {} });
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-cmd-audit'))).toBe(false);
    expect(fs.existsSync(path.join(o.home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
  });
});

describe('project scope', () => {
  it('writes skills, agents and commands inside the project and nothing in the home', () => {
    const project = tmpDir('kb-proj-');
    const o = opts({ scope: 'project', project });
    installTargets(o);
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.codex', 'agents', 'delphi-writer.toml'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.opencode', 'agents', 'delphi-writer.md'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.codex'))).toBe(false);
    expect(fs.existsSync(path.join(o.home, '.config'))).toBe(false);
  });

  it('requires --project', () => {
    expect(() => installTargets(opts({ scope: 'project' }))).toThrow(/--project/);
  });
});

describe('doctor', () => {
  it('reports ok after an install and flags a manual edit', () => {
    const o = opts();
    installTargets(o);
    const env = {};
    expect(doctor({ targets: ['codex', 'opencode'], home: o.home, env }).every((c) => c.ok)).toBe(true);
    fs.appendFileSync(path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md'), 'x');
    const checks = doctor({ targets: ['opencode'], home: o.home, env });
    expect(checks.find((c) => c.name === 'sem alteracao manual')!.ok).toBe(false);
  });

  it('says nothing is installed on a clean home', () => {
    const checks = doctor({ targets: ['codex'], home: tmpDir('kb-home-'), env: {} });
    expect(checks).toEqual([{ target: 'codex', name: 'instalado', ok: false, detail: 'nada registrado no manifesto' }]);
  });
});

describe('the real repository', () => {
  it('installs every skill (but claudeignore), 11 command skills, 4 agents and 11 opencode commands', () => {
    const home = tmpDir('kb-home-');
    const report = installTargets({
      targets: ['codex', 'opencode'], scope: 'user', home, checkout: REAL_ROOT, dryRun: false, force: false, env: {},
    });
    expect(report.skipped).toEqual([]);
    expect(report.warnings).toEqual([]);

    const skillNames = fs.readdirSync(path.join(REAL_ROOT, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).filter((n) => n !== 'delphi-claudeignore');
    const skillsDir = path.join(home, '.agents', 'skills');
    for (const n of skillNames) expect(fs.existsSync(path.join(skillsDir, n, 'SKILL.md')), n).toBe(true);
    expect(fs.readdirSync(skillsDir).filter((n) => n.startsWith('delphi-cmd-'))).toHaveLength(11);
    expect(fs.readdirSync(path.join(home, '.codex', 'agents'))).toHaveLength(4);
    expect(fs.readdirSync(path.join(home, '.config', 'opencode', 'commands'))).toHaveLength(11);
    expect(fs.readdirSync(path.join(home, '.config', 'opencode', 'agents'))).toHaveLength(4);
    expect(doctor({ targets: ['codex', 'opencode'], home, env: {} }).every((c) => c.ok)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd kb && npx vitest run __tests__/install.test.ts`
Expected: FAIL com "Failed to resolve import ../src/install/install".

- [ ] **Step 3: Implementar**

`kb/src/install/install.ts`:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readPluginVersion } from '../paths';
import { readRegistry, skillTargets, type Registry } from '../registry';
import { parseAgent, toCodexToml, toOpencodeAgent, type AgentDef } from '../targets/agents';
import { parseCommand, toCodexCommandSkill, toOpencodeCommand, type CommandDef } from '../targets/commands';
import {
  mergeCodexHooks, mergeOpencodeMcp, removeCodexHooks, removeOpencodeMcp, type HookEntry,
} from '../targets/jsonMerge';
import { renderOpencodePlugin } from '../targets/opencodePlugin';
import {
  BLOCK_START, codexMcpBlockBody, hasTableOutsideBlock, removeManagedBlock, upsertManagedBlock,
} from '../targets/toml';
import {
  atomicWrite, emptyRecord, MARKER, newReport, readManifest, readTree, removeOwned, sha256, treeHash,
  writeManifest, writeOwnedDir, writeOwnedFile, type Ctx, type InstallManifest, type Report, type TargetRecord,
} from './fsops';

export type InstallTarget = 'codex' | 'opencode';
export const MCP_SERVER = 'delphi-dev-kb';

export interface InstallOptions {
  targets: InstallTarget[];
  scope: 'user' | 'project';
  home: string;
  project?: string;
  checkout: string;
  dryRun: boolean;
  force: boolean;
  env: NodeJS.ProcessEnv;
  now?: Date;
}
export type UninstallOptions = Pick<InstallOptions, 'targets' | 'home' | 'dryRun' | 'force' | 'env' | 'now'>;

const posix = (p: string): string => p.replace(/\\/g, '/');
const stampOf = (now: Date): string => now.toISOString().replace(/[:.]/g, '-');

export function manifestPath(o: { home: string; env: NodeJS.ProcessEnv }): string {
  return path.join(o.env.DELPHI_DEV_DATA || path.join(o.home, '.delphi-dev'), 'install-manifest.json');
}

// ---- inputs ---------------------------------------------------------------

function readSkills(checkout: string): { name: string; files: Map<string, Buffer> }[] {
  const dir = path.join(checkout, 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
    .map((e) => ({ name: e.name, files: readTree(path.join(dir, e.name)) }));
}

function readCommands(checkout: string, registry: Registry): CommandDef[] {
  return registry.commands.map((c) =>
    parseCommand(c.id, fs.readFileSync(path.join(checkout, 'commands', `${c.id}.md`), 'utf8')));
}

function readAgents(checkout: string): AgentDef[] {
  const dir = path.join(checkout, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()
    .map((n) => parseAgent(fs.readFileSync(path.join(dir, n), 'utf8')));
}

// ---- helpers --------------------------------------------------------------

function writeConfigText(ctx: Ctx, file: string, text: string): void {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before === text) {
    ctx.report.unchanged++;
    return;
  }
  if (!ctx.dryRun) {
    if (before !== null) {
      const backup = `${file}.delphi-dev.bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    }
    atomicWrite(file, text);
  }
  ctx.report.written.push(file);
}

function codexHookEntries(checkout: string): HookEntry[] {
  const make = (script: string) => ({
    command: `command -v node >/dev/null 2>&1 && node "${script}"; exit 0`,
    commandWindows: `where node >nul 2>nul && node "${script}" & exit /b 0`,
  });
  const root = posix(checkout).replace(/\/+$/, '');
  return [
    { event: 'PostToolUse', matcher: 'apply_patch|Write|Edit', ...make(`${root}/runtime/hook-fix-encoding.mjs`) },
    { event: 'UserPromptSubmit', ...make(`${root}/runtime/hook-inject.mjs`) },
  ];
}

type Base = Omit<Ctx, 'prev'>;

function installCodex(o: InstallOptions, registry: Registry, base: Base, prev: TargetRecord): TargetRecord {
  const rec = emptyRecord();
  const ctx: Ctx = { ...base, prev };
  const user = o.scope === 'user';
  const codexHome = o.env.CODEX_HOME || path.join(o.home, '.codex');
  const skillsDir = user ? path.join(o.home, '.agents', 'skills') : path.join(o.project as string, '.agents', 'skills');
  const agentsDir = user ? path.join(codexHome, 'agents') : path.join(o.project as string, '.codex', 'agents');

  for (const skill of readSkills(o.checkout)) {
    if (!skillTargets(registry, skill.name).includes('codex')) continue;
    writeOwnedDir(ctx, path.join(skillsDir, skill.name), skill.files, rec);
  }
  for (const command of readCommands(o.checkout, registry)) {
    const generated = toCodexCommandSkill(command);
    const files = new Map<string, Buffer>([
      ['SKILL.md', Buffer.from(generated.skillMd, 'utf8')],
      ['agents/openai.yaml', Buffer.from(generated.openaiYaml, 'utf8')],
    ]);
    writeOwnedDir(ctx, path.join(skillsDir, generated.name), files, rec);
  }
  for (const agent of readAgents(o.checkout)) {
    writeOwnedFile(ctx, path.join(agentsDir, `${agent.name}.toml`), toCodexToml(agent), rec);
  }
  if (!user) return rec;

  const configToml = path.join(codexHome, 'config.toml');
  const toml = fs.existsSync(configToml) ? fs.readFileSync(configToml, 'utf8') : '';
  if (hasTableOutsideBlock(toml, `mcp_servers.${MCP_SERVER}`)) {
    ctx.report.warnings.push(
      `${configToml}: ja existe [mcp_servers.${MCP_SERVER}] fora do bloco do delphi-dev; MCP nao configurado`,
    );
  } else {
    const next = upsertManagedBlock(toml, codexMcpBlockBody(`${posix(o.checkout)}/runtime/kb-mcp.mjs`));
    writeConfigText(ctx, configToml, next);
    rec.blocks.push(configToml);
  }

  const hooksJson = path.join(codexHome, 'hooks.json');
  const before = fs.existsSync(hooksJson) ? fs.readFileSync(hooksJson, 'utf8') : null;
  const merged = mergeCodexHooks(before, codexHookEntries(o.checkout));
  if (!merged.ok) {
    ctx.report.warnings.push(`${hooksJson}: nao foi alterado (${merged.reason}); adicione os hooks do delphi-dev a mao`);
  } else {
    if (merged.changed) writeConfigText(ctx, hooksJson, merged.text);
    else ctx.report.unchanged++;
    rec.keys.push({ file: hooksJson, key: 'hooks' });
  }
  return rec;
}

function opencodeConfigDir(o: { home: string; env: NodeJS.ProcessEnv }): string {
  return path.join(o.env.XDG_CONFIG_HOME || path.join(o.home, '.config'), 'opencode');
}

function installOpencode(o: InstallOptions, registry: Registry, base: Base, prev: TargetRecord): TargetRecord {
  const rec = emptyRecord();
  const ctx: Ctx = { ...base, prev };
  const user = o.scope === 'user';
  const cfg = opencodeConfigDir(o);
  const skillsDir = user ? path.join(o.home, '.agents', 'skills') : path.join(o.project as string, '.agents', 'skills');
  const commandsDir = user ? path.join(cfg, 'commands') : path.join(o.project as string, '.opencode', 'commands');
  const agentsDir = user ? path.join(cfg, 'agents') : path.join(o.project as string, '.opencode', 'agents');

  for (const skill of readSkills(o.checkout)) {
    if (!skillTargets(registry, skill.name).includes('opencode')) continue;
    writeOwnedDir(ctx, path.join(skillsDir, skill.name), skill.files, rec);
  }
  for (const command of readCommands(o.checkout, registry)) {
    const generated = toOpencodeCommand(command);
    writeOwnedFile(ctx, path.join(commandsDir, generated.fileName), generated.text, rec);
  }
  for (const agent of readAgents(o.checkout)) {
    writeOwnedFile(ctx, path.join(agentsDir, `${agent.name}.md`), toOpencodeAgent(agent), rec);
  }
  if (!user) return rec;

  const jsonFile = [path.join(cfg, 'opencode.json'), path.join(cfg, 'opencode.jsonc')].find((f) => fs.existsSync(f))
    ?? path.join(cfg, 'opencode.json');
  const entry = { type: 'local', command: ['node', `${posix(o.checkout)}/runtime/kb-mcp.mjs`], enabled: true };
  const before = fs.existsSync(jsonFile) ? fs.readFileSync(jsonFile, 'utf8') : null;
  const merged = mergeOpencodeMcp(before, MCP_SERVER, entry);
  if (!merged.ok) {
    ctx.report.warnings.push(
      `${jsonFile}: nao foi alterado (${merged.reason}). Adicione em "mcp": "${MCP_SERVER}": ${JSON.stringify(entry)}`,
    );
  } else {
    if (merged.changed) writeConfigText(ctx, jsonFile, merged.text);
    else ctx.report.unchanged++;
    rec.keys.push({ file: jsonFile, key: 'mcp' });
  }

  writeOwnedFile(ctx, path.join(cfg, 'plugins', 'delphi-dev.js'), renderOpencodePlugin(o.checkout), rec);
  return rec;
}

function union(a: TargetRecord, b: TargetRecord): TargetRecord {
  const merge = <T>(x: T[], y: T[], key: (t: T) => string): T[] => {
    const map = new Map<string, T>();
    for (const item of [...x, ...y]) map.set(key(item), item);
    return [...map.values()];
  };
  return {
    files: merge(a.files, b.files, (f) => f.path),
    dirs: merge(a.dirs, b.dirs, (d) => d.path),
    blocks: [...new Set([...a.blocks, ...b.blocks])],
    keys: merge(a.keys, b.keys, (k) => `${k.file}#${k.key}`),
  };
}

// ---- public API -----------------------------------------------------------

export function installTargets(o: InstallOptions): Report {
  if (o.scope === 'project' && !o.project) throw new Error('--scope project exige --project <pasta>');
  const registry = readRegistry(o.checkout);
  const file = manifestPath(o);
  const manifest = readManifest(file);
  const report = newReport();
  const now = o.now ?? new Date();
  const base: Base = { dryRun: o.dryRun, force: o.force, stamp: stampOf(now), report };

  for (const target of o.targets) {
    const previous = manifest[target];
    const next = target === 'codex'
      ? installCodex(o, registry, base, previous)
      : installOpencode(o, registry, base, previous);
    manifest[target] = o.scope === 'project' ? union(previous, next) : next;
  }
  manifest.version = readPluginVersion(o.checkout);
  manifest.installedAt = now.toISOString();
  if (!o.dryRun) writeManifest(file, manifest);
  return report;
}

function removeBlockFile(base: Base, file: string): void {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  const next = removeManagedBlock(text);
  if (next === text) return;
  if (!base.dryRun) {
    if (next === '') fs.unlinkSync(file);
    else atomicWrite(file, next);
  }
  base.report.removed.push(`${file} (bloco delphi-dev)`);
}

function removeKey(base: Base, k: { file: string; key: string }): void {
  if (!fs.existsSync(k.file)) return;
  const text = fs.readFileSync(k.file, 'utf8');
  const result = k.key === 'hooks' ? removeCodexHooks(text) : removeOpencodeMcp(text, MCP_SERVER);
  if (!result.ok) {
    base.report.warnings.push(`${k.file}: nao foi possivel remover a entrada do delphi-dev (${result.reason})`);
    return;
  }
  if (!result.changed) return;
  if (!base.dryRun) atomicWrite(k.file, result.text);
  base.report.removed.push(`${k.file} (${k.key})`);
}

export function uninstallTargets(o: UninstallOptions): Report {
  const file = manifestPath(o);
  const manifest = readManifest(file);
  const report = newReport();
  const base: Base = { dryRun: o.dryRun, force: o.force, stamp: stampOf(o.now ?? new Date()), report };

  for (const target of o.targets) {
    const rec = manifest[target];
    const other: InstallTarget = target === 'codex' ? 'opencode' : 'codex';
    const sharedWithOther = new Set(o.targets.includes(other) ? [] : manifest[other].dirs.map((d) => d.path));
    removeOwned({ ...base, prev: rec }, { ...rec, dirs: rec.dirs.filter((d) => !sharedWithOther.has(d.path)) });
    for (const blockFile of rec.blocks) removeBlockFile(base, blockFile);
    for (const key of rec.keys) removeKey(base, key);
    manifest[target] = emptyRecord();
  }

  if (!o.dryRun) {
    const empty = (r: TargetRecord) => r.files.length + r.dirs.length + r.blocks.length + r.keys.length === 0;
    if (empty(manifest.codex) && empty(manifest.opencode)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      writeManifest(file, manifest as InstallManifest);
    }
  }
  return report;
}

export interface DoctorCheck {
  target: InstallTarget;
  name: string;
  ok: boolean;
  detail: string;
}

export function doctor(o: { targets: InstallTarget[]; home: string; env: NodeJS.ProcessEnv }): DoctorCheck[] {
  const manifest = readManifest(manifestPath(o));
  const checks: DoctorCheck[] = [];
  for (const target of o.targets) {
    const rec = manifest[target];
    const installed = rec.files.length + rec.dirs.length > 0;
    checks.push({
      target, name: 'instalado', ok: installed,
      detail: installed ? `${rec.dirs.length} pasta(s) de skill, ${rec.files.length} arquivo(s)` : 'nada registrado no manifesto',
    });
    if (!installed) continue;

    const missing = [
      ...rec.files.filter((f) => !fs.existsSync(f.path)).map((f) => f.path),
      ...rec.dirs.filter((d) => !fs.existsSync(path.join(d.path, MARKER))).map((d) => d.path),
    ];
    checks.push({ target, name: 'arquivos presentes', ok: missing.length === 0, detail: missing.length ? missing.join(', ') : 'ok' });

    const edited = [
      ...rec.files
        .filter((f) => fs.existsSync(f.path) && sha256(fs.readFileSync(f.path)) !== f.sha256)
        .map((f) => f.path),
      ...rec.dirs
        .filter((d) => fs.existsSync(path.join(d.path, MARKER)) && treeHash(readTree(d.path)) !== d.treeHash)
        .map((d) => d.path),
    ];
    checks.push({ target, name: 'sem alteracao manual', ok: edited.length === 0, detail: edited.length ? edited.join(', ') : 'ok' });

    if (target === 'codex') {
      const block = rec.blocks.find((f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(BLOCK_START));
      checks.push({ target, name: 'mcp configurado', ok: !!block, detail: block ?? 'bloco do delphi-dev ausente no config.toml' });
    } else {
      const key = rec.keys.find((k) => k.key === 'mcp');
      let ok = false;
      if (key && fs.existsSync(key.file)) {
        try {
          const json = JSON.parse(fs.readFileSync(key.file, 'utf8')) as { mcp?: Record<string, unknown> };
          ok = !!json.mcp?.[MCP_SERVER];
        } catch {
          ok = false;
        }
      }
      checks.push({ target, name: 'mcp configurado', ok, detail: key?.file ?? 'opencode.json nao foi alterado' });
    }
  }
  return checks;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd kb && npx vitest run && npx tsc --noEmit`
Expected: PASS (inclui o teste do repositório real; se `report.warnings` não for vazio nele, leia o aviso: costuma ser um `commands/<id>.md` sem entrada ou um frontmatter fora do padrão).

- [ ] **Step 5: Commit**

```bash
git add kb/src/install/install.ts kb/__tests__/install.test.ts kb/__tests__/helpers.ts
git commit -m "feat(kb): install, uninstall e doctor para Codex e OpenCode com merge estrito e manifesto"
```

---

### Task 16: Subcomandos `install`, `uninstall` e `doctor` no `kb-cli`

**Files:**
- Modify: `kb/src/cli-install.ts`, `kb/src/cli.ts`, `kb/__tests__/cli.test.ts`, `runtime/*.mjs`

**Interfaces:**
- Produces: `installCommand(args, io)`, `uninstallCommand(args, io)`, `doctorCommand(args, io)`; flags conforme spec §10

- [ ] **Step 1: Testes (vermelho)**

Acrescente a `kb/__tests__/cli.test.ts` (imports já existentes: `fs`, `path`, `runCli`, `io`, `tmpDir`):

```ts
describe('kb-cli install / doctor / uninstall', () => {
  async function checkoutRoot(): Promise<string> {
    const { makeRepo } = await import('./helpers');
    return makeRepo();
  }

  it('install --dry-run reports and writes nothing', async () => {
    const root = await checkoutRoot();
    const home = tmpDir();
    const run = io();
    const code = await runCli(['install', '--target', 'opencode', '--home', home, '--checkout', root, '--dry-run'], run.value);
    expect(code).toBe(0);
    expect(run.out.join('\n')).toContain('[dry-run]');
    expect(fs.readdirSync(home)).toEqual([]);
  });

  it('installs, diagnoses and uninstalls', async () => {
    const root = await checkoutRoot();
    const home = tmpDir();
    const install = io();
    expect(await runCli(['install', '--target', 'all', '--home', home, '--checkout', root], install.value)).toBe(0);
    expect(install.out.at(-1)).toMatch(/gravado\(s\)/);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);

    const doc = io();
    expect(await runCli(['doctor', '--target', 'all', '--home', home], doc.value)).toBe(0);
    expect(doc.out.join('\n')).toContain('ok');

    const un = io();
    expect(await runCli(['uninstall', '--target', 'all', '--home', home], un.value)).toBe(0);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(false);
  });

  it('doctor exits 1 when nothing is installed', async () => {
    const run = io();
    expect(await runCli(['doctor', '--target', 'codex', '--home', tmpDir()], run.value)).toBe(1);
  });

  it('explains that claude is not managed here and rejects unknown targets', async () => {
    const a = io();
    expect(await runCli(['install', '--target', 'claude', '--checkout', await checkoutRoot()], a.value)).toBe(64);
    expect(a.err.join('\n')).toContain('/plugin install');
    const b = io();
    expect(await runCli(['install', '--target', 'gemini'], b.value)).toBe(64);
  });

  it('project scope needs --project', async () => {
    const run = io();
    const code = await runCli(['install', '--target', 'codex', '--scope', 'project', '--checkout', await checkoutRoot(), '--home', tmpDir()], run.value);
    expect(code).toBe(64);
    expect(run.err.join('\n')).toContain('--project');
  });
});
```

Run: `cd kb && npx vitest run __tests__/cli.test.ts`
Expected: FAIL nos novos.

- [ ] **Step 2: Implementar os handlers**

Acrescente a `kb/src/cli-install.ts` (junto dos imports existentes `parseArgs`, `CliIO`, `fs`, `path`):

```ts
import * as os from 'node:os';
import { doctor, installTargets, uninstallTargets, type InstallTarget } from './install/install';
import type { Report } from './install/fsops';
import { pluginRootFromModule } from './paths';

function parseTargets(value: string): InstallTarget[] | string {
  if (value === 'all') return ['codex', 'opencode'];
  if (value === 'codex' || value === 'opencode') return [value];
  if (value === 'claude') {
    return 'O alvo claude usa o marketplace: /plugin install delphi-dev@delphi-dev (ou npx delphi-dev); nao e gerenciado por kb-cli.';
  }
  return `alvo desconhecido: ${value} (use codex, opencode ou all)`;
}

function printReport(io: CliIO, report: Report, dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] ' : '';
  for (const p of report.written) io.out(`${prefix}+ ${p}`);
  for (const p of report.removed) io.out(`${prefix}- ${p}`);
  for (const s of report.skipped) io.out(`${prefix}! ignorado ${s.path} (${s.reason})`);
  for (const w of report.warnings) io.out(`${prefix}? ${w}`);
  io.out(
    `${prefix}${report.written.length} gravado(s), ${report.removed.length} removido(s), ` +
    `${report.unchanged} sem mudanca, ${report.skipped.length} ignorado(s), ${report.warnings.length} aviso(s)`,
  );
}

export function installCommand(args: string[], io: CliIO): number {
  const { values } = parseArgs({
    args,
    options: {
      target: { type: 'string' }, scope: { type: 'string' }, project: { type: 'string' },
      home: { type: 'string' }, checkout: { type: 'string' },
      'dry-run': { type: 'boolean' }, force: { type: 'boolean' },
    },
  });
  const targets = parseTargets(values.target ?? 'all');
  if (typeof targets === 'string') {
    io.err(targets);
    return 64;
  }
  const scope = values.scope === 'project' ? 'project' : 'user';
  if (scope === 'project' && !values.project) {
    io.err('--scope project exige --project <pasta>');
    return 64;
  }
  try {
    const report = installTargets({
      targets, scope, project: values.project ? path.resolve(values.project) : undefined,
      home: values.home ?? os.homedir(),
      checkout: path.resolve(values.checkout ?? pluginRootFromModule(import.meta.url)),
      dryRun: !!values['dry-run'], force: !!values.force, env: io.env,
    });
    printReport(io, report, !!values['dry-run']);
    return 0;
  } catch (err) {
    io.err(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

export function uninstallCommand(args: string[], io: CliIO): number {
  const { values } = parseArgs({
    args,
    options: { target: { type: 'string' }, home: { type: 'string' }, 'dry-run': { type: 'boolean' }, force: { type: 'boolean' } },
  });
  const targets = parseTargets(values.target ?? 'all');
  if (typeof targets === 'string') {
    io.err(targets);
    return 64;
  }
  const report = uninstallTargets({
    targets, home: values.home ?? os.homedir(), dryRun: !!values['dry-run'], force: !!values.force, env: io.env,
  });
  printReport(io, report, !!values['dry-run']);
  return 0;
}

export function doctorCommand(args: string[], io: CliIO): number {
  const { values } = parseArgs({ args, options: { target: { type: 'string' }, home: { type: 'string' } } });
  const targets = parseTargets(values.target ?? 'all');
  if (typeof targets === 'string') {
    io.err(targets);
    return 64;
  }
  const checks = doctor({ targets, home: values.home ?? os.homedir(), env: io.env });
  for (const c of checks) io.out(`${c.ok ? 'ok  ' : 'FAIL'} ${c.target} ${c.name}: ${c.detail}`);
  return checks.every((c) => c.ok) ? 0 : 1;
}
```

Em `kb/src/cli.ts`: no import de `./cli-install` acrescente `doctorCommand, installCommand, uninstallCommand`; no `USAGE` acrescente:

```ts
  '  install --target codex|opencode|all [--scope user|project] [--project <dir>] [--home <dir>] [--checkout <dir>] [--dry-run] [--force]',
  '  uninstall --target codex|opencode|all [--home <dir>] [--dry-run] [--force]',
  '  doctor [--target codex|opencode|all] [--home <dir>]',
```

e antes do `default:` os casos:

```ts
    case 'install': return installCommand(rest, io);
    case 'uninstall': return uninstallCommand(rest, io);
    case 'doctor': return doctorCommand(rest, io);
```

- [ ] **Step 3: Rodar, reconstruir, commitar**

Run: `cd kb && npx vitest run && npx tsc --noEmit && npm run build:runtime`
Expected: PASS; bundles regenerados.

```bash
git add kb/src kb/__tests__ runtime/
git commit -m "feat(kb): kb-cli install, uninstall e doctor para Codex e OpenCode"
```

---

### Task 17: Validação com os CLIs reais (`validate-targets.mjs`)

**Files:**
- Create: `kb/scripts/validate-targets.mjs`

Este script **não roda no CI** (depende dos CLIs na máquina). Ele é a evidência de que os arquivos gerados são os que cada agente lê, como já foi feito à mão em 2026-10-15.

- [ ] **Step 1: Criar o script**

`kb/scripts/validate-targets.mjs`:

```js
#!/usr/bin/env node
// Validates the Codex and OpenCode targets against the REAL CLIs, in temporary folders.
// Never touches ~/.codex or ~/.config/opencode.
//   node kb/scripts/validate-targets.mjs [--codex <codex.exe>] [--opencode <opencode>] [--only codex|opencode]
//                                        [--checkout <repo>] [--work <dir>]
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const checkout = path.resolve(opt('checkout', path.join(here, '..', '..')));
const work = path.resolve(opt('work', fs.mkdtempSync(path.join(os.tmpdir(), 'dd-validate-'))));
const codexExe = opt('codex', 'codex');
const opencodeExe = opt('opencode', 'opencode');
const only = opt('only', 'all');
const kbCli = path.join(checkout, 'runtime', 'kb-cli.mjs');

const results = [];
const check = (target, name, ok, detail = '') => results.push({ target, name, status: ok ? 'PASS' : 'FAIL', detail });
const info = (target, name, detail) => results.push({ target, name, status: 'INFO', detail });
const skip = (target, name, detail) => results.push({ target, name, status: 'SKIP', detail });
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 180000, shell: false, ...options });
  return { status: r.status, out: strip(`${r.stdout ?? ''}${r.stderr ?? ''}`), error: r.error };
}

function mk(...p) {
  const dir = path.join(work, ...p);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

if (!fs.existsSync(kbCli)) {
  console.error(`runtime/kb-cli.mjs nao encontrado em ${checkout}`);
  process.exit(2);
}

// ---------------------------------------------------------------- OpenCode
if (only === 'all' || only === 'opencode') {
  const version = run(opencodeExe, ['--version']);
  if (version.error || version.status !== 0) {
    skip('opencode', 'cli', `${opencodeExe} nao encontrado`);
  } else {
    const home = mk('oc-home');
    const proj = mk('oc-proj');
    const env = { ...process.env, USERPROFILE: home, HOME: home };
    const inst = run(process.execPath, [kbCli, 'install', '--target', 'opencode', '--home', home, '--checkout', checkout]);
    check('opencode', 'kb-cli install exits 0', inst.status === 0, inst.out.trim().split('\n').slice(-1)[0]);

    const skills = run(opencodeExe, ['debug', 'skill'], { env, cwd: proj });
    const names = [...skills.out.matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const n of ['delphi-standards', 'delphi-write', 'delphi-laudo']) {
      check('opencode', `skill ${n} visible`, names.includes(n));
    }
    check('opencode', 'delphi-claudeignore is NOT installed', !names.includes('delphi-claudeignore'));

    const cfg = run(opencodeExe, ['debug', 'config'], { env, cwd: proj });
    let json = null;
    try {
      json = JSON.parse(cfg.out.slice(cfg.out.indexOf('{')));
    } catch {
      /* reported below */
    }
    check('opencode', 'debug config is valid JSON', !!json);
    if (json) {
      const commands = Object.keys(json.command ?? {}).filter((k) => k.startsWith('delphi-'));
      const agents = Object.keys(json.agent ?? {}).filter((k) => k.startsWith('delphi-'));
      check('opencode', '11 delphi-* commands', commands.length === 11, commands.join(', '));
      check('opencode', '4 delphi-* agents', agents.length === 4, agents.join(', '));
      check('opencode', 'mcp delphi-dev-kb declared', !!json.mcp?.['delphi-dev-kb']);
    }

    const mcp = run(opencodeExe, ['mcp', 'list'], { env, cwd: proj, timeout: 90000 });
    check('opencode', 'mcp delphi-dev-kb connected', /delphi-dev-kb/.test(mcp.out) && /connected/.test(mcp.out),
      mcp.out.replace(/\s+/g, ' ').slice(0, 160));
  }
}

// ------------------------------------------------------------------- Codex
if (only === 'all' || only === 'codex') {
  const version = run(codexExe, ['--version']);
  if (version.error || version.status !== 0) {
    skip('codex', 'cli', `${codexExe} nao encontrado (use --codex <caminho do codex.exe>)`);
  } else {
    const proj = mk('cx-proj');
    run('git', ['init', '-q'], { cwd: proj });
    const codexHome = mk('cx-home');
    const userHome = mk('cx-userhome');
    const env = { ...process.env, CODEX_HOME: codexHome };

    const project = run(process.execPath,
      [kbCli, 'install', '--target', 'codex', '--scope', 'project', '--project', proj, '--home', userHome, '--checkout', checkout],
      { env });
    check('codex', 'kb-cli install (project scope) exits 0', project.status === 0);
    const prompt = run(codexExe, ['debug', 'prompt-input'], { env, cwd: proj });
    check('codex', 'skill delphi-standards in the model-visible list', prompt.out.includes('delphi-standards'));
    check('codex', 'skill delphi-write in the model-visible list', prompt.out.includes('delphi-write'));
    check('codex', 'delphi-claudeignore is NOT listed', !prompt.out.includes('delphi-claudeignore'));
    info('codex', 'delphi-cmd-audit in the model-visible list',
      prompt.out.includes('delphi-cmd-audit') ? 'visible' : 'hidden (allow_implicit_invocation=false); explicit $delphi-cmd-audit still works');

    const user = run(process.execPath,
      [kbCli, 'install', '--target', 'codex', '--home', userHome, '--checkout', checkout], { env });
    check('codex', 'kb-cli install (user scope) exits 0', user.status === 0);
    const mcp = run(codexExe, ['mcp', 'get', 'delphi-dev-kb'], { env });
    check('codex', 'mcp get delphi-dev-kb is stdio with kb-mcp.mjs',
      /transport:\s*stdio/.test(mcp.out) && /kb-mcp\.mjs/.test(mcp.out), mcp.out.replace(/\s+/g, ' ').slice(0, 160));
    const hooksFile = path.join(codexHome, 'hooks.json');
    let hooks = null;
    try {
      hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
    } catch {
      /* reported below */
    }
    check('codex', 'hooks.json has PostToolUse and UserPromptSubmit',
      !!hooks?.hooks?.PostToolUse && !!hooks?.hooks?.UserPromptSubmit);
    check('codex', '4 agent TOMLs', fs.existsSync(path.join(codexHome, 'agents')) &&
      fs.readdirSync(path.join(codexHome, 'agents')).filter((n) => n.endsWith('.toml')).length === 4);
    info('codex', 'hooks fire', 'manual: precisa confiar em /hooks e rodar uma edicao (docs/testes-v4.0-codex-opencode.md)');
  }
}

// ------------------------------------------------------------------ report
const width = Math.max(...results.map((r) => r.name.length), 10);
for (const r of results) {
  console.log(`${r.status.padEnd(5)} ${r.target.padEnd(9)} ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n${results.filter((r) => r.status === 'PASS').length} PASS, ${failed} FAIL, ` +
  `${results.filter((r) => r.status === 'SKIP').length} SKIP, ${results.filter((r) => r.status === 'INFO').length} INFO`);
console.log(`pasta de trabalho: ${work}`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Rodar com os CLIs reais desta máquina**

O `codex.exe` vem empacotado na extensão do VS Code do Codex:

```bash
node kb/scripts/validate-targets.mjs \
  --codex "$HOME/.vscode/extensions/openai.chatgpt-26.1007.21434-win32-x64/bin/windows-x86_64/codex.exe" \
  --work "D:/Temp/dd-validate"
```

(ajuste o nome da pasta da extensão se a versão tiver mudado: `ls ~/.vscode/extensions | grep openai.chatgpt`).
Expected: todas as linhas `PASS` (a linha `INFO` do Codex é informativa), e `0 FAIL`.
**Se algum check falhar**, o script é o diagnóstico: leia o `detail`, corrija o **gerador** (nunca o script) e rode de novo. Antes do primeiro run, apague `D:/Temp/dd-validate` se existir.

- [ ] **Step 3: Registrar a evidência**

Cole a saída completa (sem segredos) em `docs/testes-v4.0-codex-opencode.md` na seção "Validação automática com os CLIs reais" (arquivo criado na Task 19; se ainda não existir, crie-o só com esse título e a saída agora).

- [ ] **Step 4: Commit**

```bash
git add kb/scripts/validate-targets.mjs docs/testes-v4.0-codex-opencode.md
git commit -m "test(kb): script de validacao dos alvos com os CLIs reais do Codex e do OpenCode"
```

---

### Task 18: `npx delphi-dev --target` (installer npm)

**Files:**
- Create: `installer/src/targets.ts`, `installer/__tests__/targets.test.ts`
- Modify: `installer/src/detect.ts` (exporta `commandExists`), `installer/src/index.ts`

**Interfaces:**
- Produces:
  - `type Target = 'claude'|'codex'|'opencode'`, `ALL_TARGETS`, `REPO_URL`
  - `interface Probe { commandExists(cmd): boolean; pathExists(p): boolean; home: string; vscodeExtensions: string[] }`
  - `detectTargets(p: Probe): Record<Target, boolean>`, `resolveTargets(flag, detected): Target[]`
  - `checkoutDir(home?): string`, `ensureCheckout(dest, from, deps): string`
  - `kbCliArgs(cmd, checkout, targets, o): string[]`, `installedPortableTargets(manifestJson: string | null): Target[]`
  - `runPortable(cmd, targets, o): void`, `realProbe(): Probe`

- [ ] **Step 1: Escrever o teste**

`installer/__tests__/targets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  detectTargets, ensureCheckout, installedPortableTargets, kbCliArgs, resolveTargets, REPO_URL, type Probe,
} from '../src/targets';

function probe(over: Partial<Probe> & { commands?: string[]; paths?: string[] } = {}): Probe {
  const commands = over.commands ?? [];
  const paths = over.paths ?? [];
  return {
    commandExists: (cmd) => commands.some((c) => cmd.startsWith(c)),
    pathExists: (p) => paths.includes(p.replace(/\\/g, '/')),
    home: '/home/u',
    vscodeExtensions: over.vscodeExtensions ?? [],
  };
}

describe('detectTargets', () => {
  it('finds nothing on a bare machine', () => {
    expect(detectTargets(probe())).toEqual({ claude: false, codex: false, opencode: false });
  });

  it('detects by CLI, by config folder and by VS Code extension', () => {
    expect(detectTargets(probe({ commands: ['claude'] })).claude).toBe(true);
    expect(detectTargets(probe({ paths: ['/home/u/.codex'] })).codex).toBe(true);
    expect(detectTargets(probe({ vscodeExtensions: ['openai.chatgpt'] })).codex).toBe(true);
    expect(detectTargets(probe({ commands: ['opencode'] })).opencode).toBe(true);
    expect(detectTargets(probe({ paths: ['/home/u/.config/opencode'] })).opencode).toBe(true);
    expect(detectTargets(probe({ vscodeExtensions: ['sst-dev.opencode'] })).opencode).toBe(true);
  });
});

describe('resolveTargets', () => {
  const detected = { claude: true, codex: false, opencode: true };
  it('uses what was detected when there is no flag', () => {
    expect(resolveTargets(undefined, detected)).toEqual(['claude', 'opencode']);
  });
  it('all means every target, detected or not', () => {
    expect(resolveTargets('all', detected)).toEqual(['claude', 'codex', 'opencode']);
  });
  it('accepts a comma list and rejects unknown names', () => {
    expect(resolveTargets('codex, opencode', detected)).toEqual(['codex', 'opencode']);
    expect(() => resolveTargets('gemini', detected)).toThrow(/gemini/);
  });
});

describe('ensureCheckout', () => {
  const dest = path.join('/h', '.delphi-dev', 'plugin');

  it('clones when there is no checkout', () => {
    const calls: string[][] = [];
    const out = ensureCheckout(dest, undefined, { run: (c, a) => { calls.push([c, ...a]); return { status: 0 }; }, exists: () => false });
    expect(out).toBe(dest);
    expect(calls).toEqual([['git', 'clone', '--depth=1', REPO_URL, dest]]);
  });

  it('pulls when it exists and survives an offline pull', () => {
    const calls: string[][] = [];
    const out = ensureCheckout(dest, undefined, {
      run: (c, a) => { calls.push([c, ...a]); return { status: 1 }; },
      exists: (p) => p === path.join(dest, '.git'),
    });
    expect(out).toBe(dest);
    expect(calls).toEqual([['git', '-C', dest, 'pull', '--ff-only']]);
  });

  it('uses --from as is, after checking it is a v4 checkout', () => {
    const from = path.resolve('/src/delphi-dev');
    expect(ensureCheckout(dest, from, { run: () => ({ status: 0 }), exists: () => true })).toBe(from);
    expect(() => ensureCheckout(dest, from, { run: () => ({ status: 0 }), exists: () => false })).toThrow(/kb-cli/);
  });

  it('fails loudly when the clone fails', () => {
    expect(() => ensureCheckout(dest, undefined, { run: () => ({ status: 128 }), exists: () => false })).toThrow(/clone/);
  });
});

describe('kbCliArgs', () => {
  it('maps one target and the pair to the kb-cli values', () => {
    const base = path.join('/c', 'runtime', 'kb-cli.mjs');
    expect(kbCliArgs('install', '/c', ['codex'], {})).toEqual([base, 'install', '--target', 'codex', '--checkout', '/c']);
    expect(kbCliArgs('install', '/c', ['codex', 'opencode'], { scope: 'project', project: '/p', dryRun: true, force: true }))
      .toEqual([base, 'install', '--target', 'all', '--checkout', '/c', '--scope', 'project', '--project', '/p', '--dry-run', '--force']);
  });
});

describe('installedPortableTargets', () => {
  it('reads the install manifest', () => {
    const json = JSON.stringify({ codex: { files: [{ path: 'x', sha256: 'y' }], dirs: [] }, opencode: { files: [], dirs: [] } });
    expect(installedPortableTargets(json)).toEqual(['codex']);
    expect(installedPortableTargets(null)).toEqual([]);
    expect(installedPortableTargets('{corrompido')).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd installer && npx vitest run __tests__/targets.test.ts`
Expected: FAIL com "Failed to resolve import ../src/targets".

- [ ] **Step 3: Implementar**

Em `installer/src/detect.ts`, exporte a função existente: troque `function commandExists(cmd: string): boolean {` por `export function commandExists(cmd: string): boolean {`.

`installer/src/targets.ts`:

```ts
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commandExists } from './detect';

export type Target = 'claude' | 'codex' | 'opencode';
export const ALL_TARGETS: Target[] = ['claude', 'codex', 'opencode'];
export const REPO_URL = 'https://github.com/adrianosantostreina/delphi-dev.git';

export interface Probe {
  commandExists(cmd: string): boolean;
  pathExists(p: string): boolean;
  home: string;
  vscodeExtensions: string[];
}

export function detectTargets(p: Probe): Record<Target, boolean> {
  const ext = (id: string): boolean => p.vscodeExtensions.includes(id);
  return {
    claude: p.commandExists('claude --version'),
    codex: p.commandExists('codex --version') || p.pathExists(path.join(p.home, '.codex')) || ext('openai.chatgpt'),
    opencode:
      p.commandExists('opencode --version') ||
      p.pathExists(path.join(p.home, '.config', 'opencode')) ||
      ext('sst-dev.opencode'),
  };
}

export function resolveTargets(flag: string | undefined, detected: Record<Target, boolean>): Target[] {
  if (!flag) return ALL_TARGETS.filter((t) => detected[t]);
  if (flag === 'all') return [...ALL_TARGETS];
  const picked = flag.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = picked.filter((t) => !ALL_TARGETS.includes(t as Target));
  if (unknown.length) throw new Error(`alvo(s) desconhecido(s): ${unknown.join(', ')} (use claude, codex, opencode ou all)`);
  return picked as Target[];
}

export function checkoutDir(home: string = os.homedir()): string {
  return path.join(home, '.delphi-dev', 'plugin');
}

export interface CheckoutDeps {
  run(cmd: string, args: string[]): { status: number | null };
  exists(p: string): boolean;
}

export function ensureCheckout(dest: string, from: string | undefined, deps: CheckoutDeps): string {
  if (from) {
    if (!deps.exists(path.join(from, 'runtime', 'kb-cli.mjs'))) {
      throw new Error(`--from ${from}: runtime/kb-cli.mjs nao encontrado (esse checkout e da v4?)`);
    }
    return from;
  }
  if (deps.exists(path.join(dest, '.git'))) {
    // Offline or diverged: keep what is already there.
    deps.run('git', ['-C', dest, 'pull', '--ff-only']);
    return dest;
  }
  const result = deps.run('git', ['clone', '--depth=1', REPO_URL, dest]);
  if (result.status !== 0) throw new Error('git clone falhou');
  return dest;
}

export function kbCliArgs(
  cmd: 'install' | 'uninstall',
  checkout: string,
  targets: Target[],
  o: { scope?: string; project?: string; dryRun?: boolean; force?: boolean },
): string[] {
  const portable = targets.filter((t) => t !== 'claude');
  const target = portable.length > 1 ? 'all' : portable[0];
  const args = [path.join(checkout, 'runtime', 'kb-cli.mjs'), cmd, '--target', target, '--checkout', checkout];
  if (o.scope) args.push('--scope', o.scope);
  if (o.project) args.push('--project', o.project);
  if (o.dryRun) args.push('--dry-run');
  if (o.force) args.push('--force');
  return args;
}

export function installedPortableTargets(manifestJson: string | null): Target[] {
  if (!manifestJson) return [];
  try {
    const m = JSON.parse(manifestJson) as Record<string, { files?: unknown[]; dirs?: unknown[] } | undefined>;
    return (['codex', 'opencode'] as Target[]).filter((t) => (m[t]?.files?.length ?? 0) + (m[t]?.dirs?.length ?? 0) > 0);
  } catch {
    return [];
  }
}

export function realProbe(): Probe {
  let extensions: string[] = [];
  try {
    extensions = execSync('code --list-extensions', { encoding: 'utf-8', stdio: 'pipe' })
      .split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  } catch {
    extensions = [];
  }
  return {
    commandExists,
    pathExists: (p) => fs.existsSync(p),
    home: os.homedir(),
    vscodeExtensions: extensions,
  };
}

export function runPortable(
  cmd: 'install' | 'uninstall',
  targets: Target[],
  o: { from?: string; scope?: string; project?: string; dryRun?: boolean; force?: boolean },
): void {
  const portable = targets.filter((t) => t !== 'claude');
  if (!portable.length) return;
  const deps: CheckoutDeps = {
    run: (c, a) => spawnSync(c, a, { stdio: 'inherit', shell: process.platform === 'win32' }),
    exists: (p) => fs.existsSync(p),
  };
  const checkout = ensureCheckout(checkoutDir(), o.from ? path.resolve(o.from) : undefined, deps);
  const result = spawnSync(process.execPath, kbCliArgs(cmd, checkout, portable, o), { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`kb-cli ${cmd} falhou (codigo ${result.status})`);
}

export function readInstallManifest(home: string = os.homedir()): string | null {
  try {
    return fs.readFileSync(path.join(home, '.delphi-dev', 'install-manifest.json'), 'utf-8');
  } catch {
    return null;
  }
}
```

Em `installer/src/index.ts`:

(1) Acrescente aos imports: `import { detectTargets, installedPortableTargets, readInstallManifest, realProbe, resolveTargets, runPortable, type Target } from './targets';`

(2) No comando `install`, acrescente as opções e troque o início da ação. Substitua

```ts
program
  .command('install', { isDefault: true })
  .description('Install delphi-dev plugin and VS Code extension')
  .action(async () => {
    header('Installing delphi-dev v3.2');
```

por

```ts
program
  .command('install', { isDefault: true })
  .description('Install delphi-dev for Claude Code, Codex and OpenCode (and the VS Code extension)')
  .option('--target <list>', 'claude, codex, opencode, a comma list, or all (default: detect)')
  .option('--from <path>', 'use an existing checkout instead of ~/.delphi-dev/plugin (development)')
  .option('--scope <scope>', 'user (default) or project (Codex/OpenCode only)')
  .option('--project <dir>', 'project folder for --scope project')
  .option('--dry-run', 'show what would change without writing')
  .option('--force', 'overwrite files that are not ours (a backup is made)')
  .action(async (opts: { target?: string; from?: string; scope?: string; project?: string; dryRun?: boolean; force?: boolean }) => {
    let targets: Target[];
    try {
      targets = resolveTargets(opts.target, detectTargets(realProbe()));
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    const portable = targets.filter((t) => t !== 'claude');
    if (portable.length) {
      header(`Installing delphi-dev for ${portable.join(' + ')}`);
      try {
        runPortable('install', portable, opts);
        success(`delphi-dev installed for ${portable.join(' + ')} — restart the agent session`);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      if (!targets.includes('claude')) return;
    }

    header('Installing delphi-dev v3.2');
```

(o corpo antigo da ação continua logo abaixo, sem alteração).

(3) Substitua o comando `update` inteiro por:

```ts
program
  .command('update')
  .description('Update the plugin (Claude Code, Codex and OpenCode installs)')
  .action(() => {
    header('Updating delphi-dev');
    const sys = detectSystem();
    if (sys.hasClaudeCLI) {
      step('Pulling latest plugin for Claude Code...');
      installPlugin();
      success('Claude Code plugin updated — restart your session');
    }
    const installed = installedPortableTargets(readInstallManifest());
    if (installed.length) {
      step(`Updating ${installed.join(' + ')}...`);
      try {
        runPortable('install', installed, {});
        success(`Updated ${installed.join(' + ')} — restart the agent session`);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
    if (!sys.hasClaudeCLI && !installed.length) {
      warn('Nothing to update: no Claude Code CLI and no Codex/OpenCode install found.');
    }
  });
```

(4) No comando `uninstall`, acrescente ao final da ação (antes do `warn('Plugin files remain …')` ou depois dele):

```ts
    const installed = installedPortableTargets(readInstallManifest());
    if (installed.length) {
      step(`Removing delphi-dev from ${installed.join(' + ')}...`);
      try {
        runPortable('uninstall', installed, {});
        success('Codex/OpenCode files removed (only what delphi-dev installed)');
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
      }
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd installer && npx vitest run && npm run build`
Expected: PASS; build limpo. (Os testes antigos de `hooks.test.ts`/`detect.test.ts` continuam passando.)

- [ ] **Step 5: Teste de fumaça do fluxo completo, sem tocar no home real**

```bash
HOME_TMP=$(mktemp -d)
node installer/dist/index.js install --target opencode --from "$(pwd)" --dry-run
```

Expected: imprime `Installing delphi-dev for opencode`, lista `[dry-run] + …` e termina com `0 gravado(s)`… (`dry-run` mostra o que gravaria). **Não** rode sem `--dry-run` aqui: isso gravaria no seu `~/.config/opencode` real; a validação real fica por conta do script da Task 17.

- [ ] **Step 6: Commit**

```bash
git add installer/src installer/__tests__
git commit -m "feat(installer): npx delphi-dev --target claude|codex|opencode com checkout estavel"
```

---

### Task 19: Documentação, rede de proteção do encoding e matriz manual

**Files:**
- Modify: `skills/delphi-encoding/SKILL.md`, `kb/__tests__/portable-content.test.ts`, `README.md`, `README.pt-BR.md`, `CLAUDE.md`, `docs/handoff.md`
- Create/Modify: `docs/testes-v4.0-codex-opencode.md`

- [ ] **Step 1: Teste do texto da skill (vermelho)**

Ao fim de `kb/__tests__/portable-content.test.ts`:

```ts
describe('encoding safety net', () => {
  it('delphi-encoding tells agents without hooks to run kb-cli fix-encoding', () => {
    const text = read('skills/delphi-encoding/SKILL.md');
    expect(text).toContain('## Sem hook ativo');
    expect(text).toContain('runtime/kb-cli.mjs" fix-encoding');
    expect(text).toContain('~/.delphi-dev/plugin');
  });
});
```

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts`
Expected: FAIL.

- [ ] **Step 2: Texto da skill**

Em `skills/delphi-encoding/SKILL.md`, insira **antes** da linha `## Referência completa`:

````markdown
## Sem hook ativo (Codex, OpenCode ou Claude Code sem Node)

Se o hook de encoding não estiver rodando, aplique a regra da tabela depois de gravar arquivos
Delphi, executando:

```
node "<raiz>/runtime/kb-cli.mjs" fix-encoding <arquivos>
```

`<raiz>` é a raiz do plugin: `~/.delphi-dev/plugin` no Codex e no OpenCode. O comando põe BOM em
`.pas/.dpr/.dpk/.inc` e converte acentos de `.dfm/.fmx` em `#NNN`; não toca arquivos ANSI, UTF-16 nem
binários.

````

- [ ] **Step 3: READMEs**

Rode uma vez (não commitado). Ele insere a seção nova imediatamente antes do cabeçalho de "Update"/"Atualizar" e falha alto se não achar exatamente um:

```bash
node -e '
const fs = require("fs");
const EN = `### Codex and OpenCode

\`\`\`bash
npx delphi-dev --target codex      # or: opencode, or: all
\`\`\`

Without \`--target\` the installer **detects** which agents you have (CLI, config folder or VS Code
extension) and installs for each one. It clones the plugin to \`~/.delphi-dev/plugin\` and writes:

| | Codex | OpenCode |
|---|---|---|
| Skills | \`~/.agents/skills\` | \`~/.agents/skills\` (same folder) |
| Commands | skills \`$delphi-cmd-<name>\` (e.g. \`$delphi-cmd-audit\`) | \`/delphi-<name>\` (e.g. \`/delphi-audit\`) |
| Subagents | \`~/.codex/agents/*.toml\` | \`~/.config/opencode/agents/*.md\` |
| Knowledge base (MCP) | \`config.toml\` | \`opencode.json\` |
| Hooks | \`hooks.json\` (trust once with \`/hooks\`) | \`plugins/delphi-dev.js\` |

It never overwrites files that are not its own: your config, hooks and other skills are preserved,
and \`npx delphi-dev uninstall\` removes only what it installed. Use \`--dry-run\` to preview and
\`--scope project --project <dir>\` to install skills, commands and subagents inside one repository.
If your agent has no hook support for a file edit, the \`delphi-encoding\` skill runs
\`kb-cli fix-encoding\` as a safety net.

`;
const PT = `### Codex e OpenCode

\`\`\`bash
npx delphi-dev --target codex      # ou: opencode, ou: all
\`\`\`

Sem \`--target\` o instalador **detecta** quais agentes você tem (CLI, pasta de configuração ou
extensão do VS Code) e instala para cada um. Ele clona o plugin em \`~/.delphi-dev/plugin\` e grava:

| | Codex | OpenCode |
|---|---|---|
| Skills | \`~/.agents/skills\` | \`~/.agents/skills\` (a mesma pasta) |
| Comandos | skills \`$delphi-cmd-<nome>\` (ex.: \`$delphi-cmd-audit\`) | \`/delphi-<nome>\` (ex.: \`/delphi-audit\`) |
| Subagentes | \`~/.codex/agents/*.toml\` | \`~/.config/opencode/agents/*.md\` |
| Base de conhecimento (MCP) | \`config.toml\` | \`opencode.json\` |
| Hooks | \`hooks.json\` (confie uma vez em \`/hooks\`) | \`plugins/delphi-dev.js\` |

Ele nunca sobrescreve arquivo que não é dele: sua configuração, seus hooks e outras skills ficam
intactos, e \`npx delphi-dev uninstall\` remove só o que ele instalou. Use \`--dry-run\` para
pré-visualizar e \`--scope project --project <pasta>\` para instalar skills, comandos e subagentes
dentro de um repositório. Se o seu agente não tiver hook para edição de arquivo, a skill
\`delphi-encoding\` roda \`kb-cli fix-encoding\` como rede de proteção.

`;
function patch(file, text, heading) {
  const raw = fs.readFileSync(file, "utf8");
  const matches = raw.match(heading);
  if (!matches || (raw.match(new RegExp(heading.source, "gm")) || []).length !== 1) throw new Error(file + ": cabecalho nao encontrado exatamente 1x");
  fs.writeFileSync(file, raw.replace(heading, (m) => text + m));
}
patch("README.md", EN, /^### Update\s*$/m);
patch("README.pt-BR.md", PT, /^### Atualiz\w+\s*$/m);
console.log("ok");
'
```

Expected: `ok`. Se o cabeçalho de atualização tiver outro nome em um dos READMEs, o script falha sem gravar: ajuste só o regex do cabeçalho.

- [ ] **Step 4: CLAUDE.md e matriz manual**

Em `CLAUDE.md`, na seção "Architecture", acrescente após o item "Knowledge base runtime":

```
- **Portable delivery** (`portable.json`, `kb/src/targets/`, `kb/src/install/`) — `kb-cli install --target codex|opencode` generates each agent's files from `skills/`, `commands/` and `agents/` (single source) with strict, owner-tracked writes. Never hand-edit generated Codex/OpenCode files; change the source and re-run the install.
```

`docs/testes-v4.0-codex-opencode.md` (crie, ou complete o que a Task 17 iniciou):

```markdown
# Testes — Codex e OpenCode (v4.0)

## Validação automática com os CLIs reais

`node kb/scripts/validate-targets.mjs --codex <codex.exe> --work <pasta>` — saída da última execução:

(a saída da última execução fica registrada aqui — Task 17, Step 3)

## Matriz manual

Marque com ✅/❌ e a data. Terminal e VS Code valem o mesmo; teste em ambos quando houver dúvida.

| # | Agente | Fluxo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Codex | `npx delphi-dev --target codex`, reiniciar | `$delphi-` lista `delphi-standards` e `delphi-cmd-*` | |
| 2 | Codex | `$delphi-cmd-audit` num projeto Delphi | segue o roteiro do `/audit` | |
| 3 | Codex | `/hooks` → confiar nos hooks do delphi-dev; pedir para criar `Teste.pas` | arquivo com BOM | |
| 4 | Codex | pedir para criar `Teste.dfm` com `Caption = 'Serviço'` | `.dfm` sem BOM e com `#231` | |
| 5 | Codex | prompt "erro E2356 em class var" | trecho `[DELPHI-DEV KNOWLEDGE]` no contexto | |
| 6 | Codex | `kb_search` pelo MCP | resultados `[canonical/...]` | |
| 7 | Codex (extensão VS Code) | repetir 1–6 | idêntico ao terminal | |
| 8 | OpenCode | `npx delphi-dev --target opencode`, reiniciar | `/delphi-audit` aparece no `/` | |
| 9 | OpenCode | `/delphi-audit` | segue o roteiro do `/audit` | |
| 10 | OpenCode | editar um `.pas` com a ferramenta `edit` | BOM aplicado pelo plugin | |
| 11 | OpenCode | prompt "erro E2356 em class var" | contexto da base no system prompt | |
| 12 | OpenCode | subagente `@delphi-writer` | responde seguindo a skill `delphi-write` | |
| 13 | Ambos | sem Node no PATH | nenhum erro de hook a cada prompt | |
| 14 | Ambos | `npx delphi-dev uninstall` | arquivos do usuário intactos | |
| 15 | Ambos | rodar `npx delphi-dev` duas vezes | 2ª execução: 0 gravados | |

## Pontos que dependem de confirmação

- Disparo real dos hooks no Codex (exige `/hooks`) e no plugin do OpenCode (API em reescrita V2).
- `agents/openai.yaml` (`allow_implicit_invocation: false`): conferir se `$delphi-cmd-*` continuam chamáveis.
- `commandWindows` do Codex: forma do comando silencioso sem Node.
```

Em `docs/handoff.md`, no topo, acrescente um item "Sprint 3 (3A+3B) implementado" apontando para a spec, o plano e esta matriz, com o próximo passo "executar a matriz manual e o 3C (extensão)".

- [ ] **Step 5: Rodar tudo e commitar**

Run: `cd kb && npx vitest run && npx tsc --noEmit && node ../runtime/kb-cli.mjs lint --root .. && cd ../installer && npx vitest run`
Expected: PASS e `0 achado(s) de portabilidade`.

```bash
git add skills/delphi-encoding README.md README.pt-BR.md CLAUDE.md docs kb/__tests__/portable-content.test.ts
git commit -m "docs: instalacao para Codex e OpenCode, rede de protecao do encoding e matriz manual"
```

---

## Cobertura da spec

| Spec | Tasks |
|---|---|
| §6 Registro `portable.json` | 1 |
| §7.1 Lint | 2, 6 |
| §7.2 Skills autossuficientes, `kb:` e `kb_get` | 3, 4 |
| §7.3 Texto neutro, claudeignore | 5 |
| §8.1–8.3 Geradores (comandos, subagentes) | 10, 11 |
| §8.4 MCP | 8, 9, 15 |
| §8.5 Hooks | 9, 12, 13, 15 |
| §8.6 Rede de proteção do encoding | 12, 19 |
| §9 Segurança de escrita | 8, 9, 14, 15 |
| §10 `kb-cli` | 2, 12, 16 |
| §11 Installer npm | 18 |
| §13.2 Validação com CLIs reais | 17 |
| §13.3 Matriz manual | 19 |
| AGENTS.md | 7 |
