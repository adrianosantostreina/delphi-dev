import { main } from '../mcp-server';

main().catch((err) => {
  process.stderr.write(`delphi-dev-kb: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
