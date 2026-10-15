import { runCli } from '../cli';

runCli(process.argv.slice(2)).then((code) => process.exit(code));
