import data from './generated/registry.json';

export type Locale = 'pt-BR' | 'en-US';

export interface RegistryCommand {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  takesFile: boolean;
  icon: string;
}

export interface Registry {
  schema: 1;
  skills: Record<string, { targets?: string[] }>;
  commands: RegistryCommand[];
}

export const registry = data as unknown as Registry;

export function vscodeCommandId(id: string): string {
  return `delphi-dev.${id.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase())}`;
}

export function pickLocale(language: string): Locale {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}
