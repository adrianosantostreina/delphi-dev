import * as vscode from 'vscode';
import { sendToClaudeCode } from './claudeCodeBridge';
import { getActiveFileContext } from '../utils/fileUtils';
import { COMMANDS } from '../constants';

function buildFileRef(filePath: string, lineRange?: string): string {
  if (lineRange) {
    return `@${filePath}:${lineRange}`;
  }
  return `@${filePath}`;
}

async function executeWrite(): Promise<void> {
  await sendToClaudeCode('/write');
}

async function executeAudit(): Promise<void> {
  await sendToClaudeCode('/audit');
}

async function executeReview(): Promise<void> {
  const ctx = getActiveFileContext();
  if (ctx) {
    const ref = buildFileRef(ctx.filePath, ctx.lineRange);
    await sendToClaudeCode(`/review ${ref}`);
  } else {
    await sendToClaudeCode('/review');
  }
}

async function executeSpec(): Promise<void> {
  await sendToClaudeCode('/spec');
}

async function executeTdd(): Promise<void> {
  const ctx = getActiveFileContext();
  if (ctx) {
    await sendToClaudeCode(`/tdd ${buildFileRef(ctx.filePath)}`);
  } else {
    await sendToClaudeCode('/tdd');
  }
}

async function executeNewProject(): Promise<void> {
  await sendToClaudeCode('/new-project');
}

async function executeAbout(): Promise<void> {
  await sendToClaudeCode('/about');
}

async function executeBuild(): Promise<void> {
  await sendToClaudeCode('/build');
}

async function executeRefactor(): Promise<void> {
  const ctx = getActiveFileContext();
  if (ctx) {
    await sendToClaudeCode(`/refactor ${buildFileRef(ctx.filePath)}`);
  } else {
    await sendToClaudeCode('/refactor');
  }
}

async function executeMigrate(): Promise<void> {
  const ctx = getActiveFileContext();
  if (ctx) {
    await sendToClaudeCode(`/migrate --file ${buildFileRef(ctx.filePath)}`);
  } else {
    await sendToClaudeCode('/migrate');
  }
}

async function executeContributeKb(): Promise<void> {
  await sendToClaudeCode('/contribute-kb');
}

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.WRITE, executeWrite),
    vscode.commands.registerCommand(COMMANDS.AUDIT, executeAudit),
    vscode.commands.registerCommand(COMMANDS.REVIEW, executeReview),
    vscode.commands.registerCommand(COMMANDS.SPEC, executeSpec),
    vscode.commands.registerCommand(COMMANDS.TDD, executeTdd),
    vscode.commands.registerCommand(COMMANDS.NEW_PROJECT, executeNewProject),
    vscode.commands.registerCommand(COMMANDS.ABOUT, executeAbout),
    vscode.commands.registerCommand(COMMANDS.BUILD, executeBuild),
    vscode.commands.registerCommand(COMMANDS.REFACTOR, executeRefactor),
    vscode.commands.registerCommand(COMMANDS.MIGRATE, executeMigrate),
    vscode.commands.registerCommand(COMMANDS.CONTRIBUTE_KB, executeContributeKb),
  );
}
