export const EXTENSION_ID = 'delphi-dev';

export const COMMANDS = {
  WRITE: `${EXTENSION_ID}.write`,
  AUDIT: `${EXTENSION_ID}.audit`,
  REVIEW: `${EXTENSION_ID}.review`,
  SPEC: `${EXTENSION_ID}.spec`,
  TDD: `${EXTENSION_ID}.tdd`,
  NEW_PROJECT: `${EXTENSION_ID}.newProject`,
  ABOUT: `${EXTENSION_ID}.about`,
  CREATE_CLAUDEIGNORE: `${EXTENSION_ID}.createClaudeignore`,
  BUILD: `${EXTENSION_ID}.build`,
  REFACTOR: `${EXTENSION_ID}.refactor`,
  MIGRATE: `${EXTENSION_ID}.migrate`,
  CONTRIBUTE_KB: `${EXTENSION_ID}.contributeKb`,
} as const;

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
