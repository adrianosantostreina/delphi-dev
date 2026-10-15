import { describe, it, expect } from 'vitest';
import { hasExplicitDelphiSignal, isDelphiProjectDir } from '../src/delphi-intent';
import { tmpDir, writeTree } from './helpers';

describe('hasExplicitDelphiSignal', () => {
  it.each([
    'abre o Unit1.pas e corrige',
    'o MainForm.fmx não abre no designer',
    'erro E2003 Undeclared identifier',
    'warning W1036 no build',
    'como configurar o FireDAC com Firebird',
    'botão no FMX não responde',
    'herdar de TForm1',
    'TFDQuery com parâmetro',
    'rota nova no Horse',
    'testes com DUnitX',
    'compilar no RAD Studio 12',
  ])('detects %s', (prompt) => {
    expect(hasExplicitDelphiSignal(prompt)).toBe(true);
  });

  it.each([
    'faz o commit e o push',
    'qual a previsão do tempo amanhã',
    'renomeie a variável total para soma',
    'o arquivo package.json está errado',
    'transforme este texto em lista',
  ])('ignores %s', (prompt) => {
    expect(hasExplicitDelphiSignal(prompt)).toBe(false);
  });
});

describe('isDelphiProjectDir', () => {
  it('detects .dpr or .dproj in the folder', () => {
    const dir = tmpDir();
    expect(isDelphiProjectDir(dir)).toBe(false);
    writeTree(dir, { 'Projeto.dproj': '<Project/>' });
    expect(isDelphiProjectDir(dir)).toBe(true);
  });

  it('is false for missing or undefined folders', () => {
    expect(isDelphiProjectDir(undefined)).toBe(false);
    expect(isDelphiProjectDir('/definitely/not/here')).toBe(false);
  });
});
