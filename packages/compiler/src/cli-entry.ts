#!/usr/bin/env bun
import { runCompilerCli } from './cli';

process.exitCode = await runCompilerCli(process.argv.slice(2));
