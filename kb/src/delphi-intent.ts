import * as fs from 'node:fs';

const EXTENSION = /\.(pas|dfm|dpr|dpk|dproj|fmx|inc)\b/i;
const COMPILER_CODE = /\b[EFWH]\d{4}\b/;
const TERMS =
  /\b(delphi|object\s+pascal|rad\s+studio|firemonkey|fmx|vcl|firedac|datasnap|horse|boss|dunitx|spring4d|livebindings|indy|acbr|skia4delphi)\b|\bT(Form|DataModule|FDQuery|FDConnection)\w*/i;

export function hasExplicitDelphiSignal(prompt: string): boolean {
  return EXTENSION.test(prompt) || COMPILER_CODE.test(prompt) || TERMS.test(prompt);
}

export function isDelphiProjectDir(dir: string | undefined): boolean {
  if (!dir) return false;
  try {
    return fs.readdirSync(dir).some((name) => /\.(dpr|dproj)$/i.test(name));
  } catch {
    return false;
  }
}
