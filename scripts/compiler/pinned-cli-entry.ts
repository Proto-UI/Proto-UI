#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { runCompilerCli } from '../../packages/compiler/src/cli';

if (process.argv.length === 3 && process.argv[2] === '--build-info') {
  process.stdout.write(readFileSync(new URL('./compiler-build.json', import.meta.url), 'utf8'));
} else {
  const result = runCompilerCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
