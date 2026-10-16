import { describe, it, expect } from 'vitest';
import { pickLocale, registry, vscodeCommandId } from '../src/registry';

describe('registry', () => {
  it('has the 11 plugin commands with both languages', () => {
    expect(registry.commands).toHaveLength(11);
    for (const c of registry.commands) {
      expect(c.title['pt-BR']).not.toBe('');
      expect(c.title['en-US']).not.toBe('');
    }
  });

  it('maps ids and locales', () => {
    expect(vscodeCommandId('new-project')).toBe('delphi-dev.newProject');
    expect(pickLocale('pt-br')).toBe('pt-BR');
    expect(pickLocale('pt')).toBe('pt-BR');
    expect(pickLocale('en')).toBe('en-US');
    expect(pickLocale('de')).toBe('en-US');
  });
});
