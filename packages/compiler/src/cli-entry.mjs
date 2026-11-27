#!/usr/bin/env node
import { COMPILER_STATUS, CompilerUnavailableError } from './index.ts';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--status') {
  process.stdout.write(`${JSON.stringify(COMPILER_STATUS, null, 2)}\n`);
} else if (args[0] === 'lint') {
  const { runLintCli } = await import('./lint-cli.mjs');
  process.exitCode = runLintCli(args.slice(1));
} else if (args[0] === 'compile') {
  const { runCompileCli } = await import('./compile-cli.mjs');
  process.exitCode = await runCompileCli(args.slice(1));
} else {
  const error = new CompilerUnavailableError();
  process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exitCode = 1;
}
