import chalk from 'chalk';
import ora, { Ora } from 'ora';

export function step(message: string): void {
  console.log(chalk.cyan('→'), message);
}

export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function warn(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function error(message: string): void {
  console.log(chalk.red('✗'), message);
}

export function header(title: string): void {
  console.log('');
  console.log(chalk.bold.blue('━━━ delphi-dev installer ━━━'));
  console.log(chalk.dim(title));
  console.log('');
}

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function summary(items: Array<{ label: string; ok: boolean; note?: string }>): void {
  console.log('');
  console.log(chalk.bold('Installation summary:'));
  for (const item of items) {
    const icon = item.ok ? chalk.green('✓') : chalk.yellow('⚠');
    const note = item.note ? chalk.dim(` — ${item.note}`) : '';
    console.log(`  ${icon} ${item.label}${note}`);
  }
  console.log('');
}
