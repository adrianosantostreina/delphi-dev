import * as vscode from 'vscode';
import { COMMANDS } from '../constants';

interface CommandEntry {
  label: string;
  description: string;
  command: string;
  icon: vscode.ThemeIcon;
}

const COMMAND_ENTRIES: CommandEntry[] = [
  {
    label: 'Write Code',
    description: 'Create new Delphi code with standards',
    command: COMMANDS.WRITE,
    icon: new vscode.ThemeIcon('edit'),
  },
  {
    label: 'Review Code',
    description: 'Quick code review for style violations',
    command: COMMANDS.REVIEW,
    icon: new vscode.ThemeIcon('eye'),
  },
  {
    label: 'Audit Project',
    description: 'Complete technical audit report',
    command: COMMANDS.AUDIT,
    icon: new vscode.ThemeIcon('checklist'),
  },
  {
    label: 'Generate Spec',
    description: 'Auto-generate SPEC from source code',
    command: COMMANDS.SPEC,
    icon: new vscode.ThemeIcon('file-text'),
  },
  {
    label: 'Generate Tests (TDD)',
    description: 'Generate DUnitX test suite',
    command: COMMANDS.TDD,
    icon: new vscode.ThemeIcon('beaker'),
  },
  {
    label: 'New Project',
    description: 'Scaffold a new Delphi project',
    command: COMMANDS.NEW_PROJECT,
    icon: new vscode.ThemeIcon('folder-opened'),
  },
  {
    label: 'Build Project',
    description: 'Compile and validate with delphi-builder',
    command: COMMANDS.BUILD,
    icon: new vscode.ThemeIcon('play'),
  },
  {
    label: 'Refactor Code',
    description: 'Refactor following Pascal idioms',
    command: COMMANDS.REFACTOR,
    icon: new vscode.ThemeIcon('wand'),
  },
  {
    label: 'Migrate Legacy',
    description: 'Analyze and plan legacy code modernization',
    command: COMMANDS.MIGRATE,
    icon: new vscode.ThemeIcon('arrow-right'),
  },
  {
    label: 'Contribute Knowledge',
    description: 'Share your learnings with the community',
    command: COMMANDS.CONTRIBUTE_KB,
    icon: new vscode.ThemeIcon('cloud-upload'),
  },
];

class DelphiCommandItem extends vscode.TreeItem {
  constructor(entry: CommandEntry) {
    super(entry.label, vscode.TreeItemCollapsibleState.None);
    this.description = entry.description;
    this.iconPath = entry.icon;
    this.command = {
      command: entry.command,
      title: entry.label,
    };
    this.tooltip = entry.description;
  }
}

export class DelphiCommandsProvider implements vscode.TreeDataProvider<DelphiCommandItem> {
  getTreeItem(element: DelphiCommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<DelphiCommandItem[]> {
    const items = COMMAND_ENTRIES.map((entry) => new DelphiCommandItem(entry));
    return Promise.resolve(items);
  }
}
