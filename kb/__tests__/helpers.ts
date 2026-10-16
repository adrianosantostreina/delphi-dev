import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function tmpDir(prefix = 'kb-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeTree(root: string, files: Record<string, string | Buffer>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

/** Plugin root with .claude-plugin/plugin.json and knowledge/<files>. */
export function makePluginRoot(knowledge: Record<string, string | Buffer>, version = '4.0.0'): string {
  const root = tmpDir('kb-root-');
  writeTree(root, { '.claude-plugin/plugin.json': JSON.stringify({ version }) });
  writeTree(root, Object.fromEntries(Object.entries(knowledge).map(([k, v]) => [`knowledge/${k}`, v])));
  return root;
}

export const FIXTURE: Record<string, string> = {
  'core/INDEX.md': '# Índice\n',
  'core/class-var.md':
    '# `class var` contamina campos — E2356\n\n## Sintoma\nE2356 Property accessor must be an instance field.\n\n## Causa\nclass var abre seção que linha em branco não fecha.\n',
  'core/encoding.md':
    '# Encoding UTF-8 com BOM\n\n## Regra\nTodo .pas leva BOM. Conexão com acentos vira mojibake sem BOM.\n',
  'core/firedac.md':
    '# FireDAC em app console\n\n## Sintoma\nAccess violation ao conectar no Firebird em app console.\n',
  'fmx/modal.md':
    '# ShowModal e ModalResult\n\n## Sintoma\nClose sobrescreve o ModalResult e o callback recebe mrCancel.\n',
  'fmx/ontap.md': '# OnClick não dispara no iOS\n\n## Solução\nUse OnTap em TRectangle.\n',
  'community/2026-10-01-class-var-dica.md':
    '---\ntitle: Dica sobre class var e E2356\ncategory: bugs\ntags: class var, E2356, instance field\nsource: community\n---\n# Dica\n\nSepare class var com uma nova seção var para evitar E2356 em class var.\n',
};

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
