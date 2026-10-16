// Minimal stand-in for the `vscode` module, only what the unit-tested modules touch.
export class ThemeIcon {
  constructor(public id: string) {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  description?: string;
  iconPath?: unknown;
  command?: { command: string; title: string };
  tooltip?: string;
  constructor(public label: string, public collapsibleState?: TreeItemCollapsibleState) {}
}

export const env = { language: 'en' };
export const window = {};
export const workspace = {};
export const commands = {};
export const extensions = {};
