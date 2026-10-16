import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  resolve: { alias: { vscode: path.resolve(__dirname, 'test/mocks/vscode.ts') } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
