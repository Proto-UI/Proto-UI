#!/usr/bin/env node
import { COMPILER_STATUS, CompilerUnavailableError } from './index.ts';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--status') {
  process.stdout.write(`${JSON.stringify(COMPILER_STATUS, null, 2)}\n`);
} else {
  const error = new CompilerUnavailableError();
  process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exitCode = 1;
}
