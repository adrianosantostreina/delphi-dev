import * as vscode from 'vscode';
import { pickLocale, registry, vscodeCommandId, type Locale, type RegistryCommand } from '../registry';

class DelphiCommandItem extends vscode.TreeItem {
  constructor(entry: RegistryCommand, locale: Locale) {
    super(entry.title[locale], vscode.TreeItemCollapsibleState.None);
    this.description = entry.description[locale];
    this.iconPath = new vscode.ThemeIcon(entry.icon);
    this.command = { command: vscodeCommandId(entry.id), title: entry.title[locale] };
    this.tooltip = entry.description[locale];
  }
}

export class DelphiCommandsProvider implements vscode.TreeDataProvider<DelphiCommandItem> {
  private readonly locale: Locale;

  constructor(locale?: Locale) {
    this.locale = locale ?? pickLocale(vscode.env.language);
  }

  getTreeItem(element: DelphiCommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<DelphiCommandItem[]> {
    return Promise.resolve(registry.commands.map((entry) => new DelphiCommandItem(entry, this.locale)));
  }
}
