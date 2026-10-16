export const EXTENSION_ID = 'delphi-dev';

export const VIEWS = {
  COMMANDS_TREE: 'delphiDevCommands',
} as const;

export const CONTEXT_KEYS = {
  IS_DELPHI_PROJECT: `${EXTENSION_ID}.isDelphiProject`,
} as const;

export const DELPHI_FILE_EXTENSIONS = ['.pas', '.dpr', '.dfm', '.dpk', '.inc', '.fmx'];
export const DELPHI_PROJECT_EXTENSIONS = ['.dpr', '.dproj'];
export const DELPHI_GLOB_PATTERN = '**/*.{dpr,pas,dfm,dpk,inc,fmx}';
export const DELPHI_PROJECT_GLOB = '**/*.dpr';
