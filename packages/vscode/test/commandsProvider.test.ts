import { describe, it, expect } from 'vitest';
import { DelphiCommandsProvider } from '../src/views/delphiCommandsProvider';
import { registry, vscodeCommandId } from '../src/registry';

describe('DelphiCommandsProvider', () => {
  it('lists every registry command with its localized label and VS Code command', async () => {
    const items = await new DelphiCommandsProvider('pt-BR').getChildren();
    expect(items).toHaveLength(registry.commands.length);
    const audit = items.find((i) => i.command?.command === 'delphi-dev.audit')!;
    expect(audit.label).toBe(registry.commands.find((c) => c.id === 'audit')!.title['pt-BR']);
    expect(audit.description).toBe(registry.commands.find((c) => c.id === 'audit')!.description['pt-BR']);
    const en = await new DelphiCommandsProvider('en-US').getChildren();
    expect(en.find((i) => i.command?.command === vscodeCommandId('new-project'))!.label).toBe('New project');
  });

  it('points every item at a command id derived from the registry, in registry order', async () => {
    const items = await new DelphiCommandsProvider('en-US').getChildren();
    expect(items.map((i) => i.command?.command)).toEqual(registry.commands.map((c) => vscodeCommandId(c.id)));
  });
});
