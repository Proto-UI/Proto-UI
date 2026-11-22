#!/usr/bin/env node

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ROOT_DIR } from './lib.mjs';
import { runRehearsal } from './rehearsal-receipt.mjs';

const packageManager = JSON.parse(
  readFileSync(join(ROOT_DIR, 'package.json'), 'utf8')
).packageManager;
let artifactDir;
let stepTimeoutMs = 0;
for (let index = 0; index < process.argv.slice(2).length; index += 1) {
  const argv = process.argv.slice(2);
  if (argv[index] === '--') continue;
  if (argv[index] === '--out-dir') {
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error('--out-dir requires a path.');
    artifactDir = resolve(value);
  } else if (argv[index] === '--step-timeout-ms') {
    const value = argv[++index];
    if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw new Error('--step-timeout-ms requires a positive safe integer.');
    }
    stepTimeoutMs = Number(value);
  } else {
    throw new Error(`Unknown rehearsal argument: ${argv[index]}`);
  }
}
artifactDir ??= mkdtempSync(join(tmpdir(), 'proto-ui-release-rehearsal-'));

const steps = [
  ['Release identity', process.execPath, ['scripts/release/check-version-governance.mjs']],
  ['Release assets', process.execPath, ['scripts/release/check-release-assets.mjs', '--check']],
  [
    'Ordinary entity lifecycle review inventory',
    'corepack',
    [
      packageManager,
      '-s',
      'release:lifecycle',
      '--',
      '--out',
      join(artifactDir, 'lifecycle-review.json'),
    ],
  ],
  ['Prototype catalog', process.execPath, ['scripts/spec/check-prototype-catalog.mjs']],
  ['Workspace and docs types', 'corepack', [packageManager, '-s', 'check:types']],
  ['Release script tests', 'corepack', [packageManager, '-s', 'test:release']],
  ['Contract type tests', 'corepack', [packageManager, '-s', 'test:types']],
  ['Runtime tests', 'corepack', [packageManager, '-s', 'test:runtime']],
  [
    'Spec snapshot',
    'corepack',
    [packageManager, '-s', 'spec:snapshot:release', '--', '--out-dir', artifactDir],
  ],
  [
    'Launch governance scan',
    process.execPath,
    ['scripts/release/scan.mjs', '--profile', 'launch', '--check-governance'],
  ],
  [
    'Registry package identities',
    process.execPath,
    ['scripts/release/check-registry-readiness.mjs'],
  ],
  [
    'Package publish dry-run',
    'corepack',
    [packageManager, '-s', 'release:stage', '--', '--out-dir', join(artifactDir, 'staging')],
  ],
  ['React tarball consumer', 'corepack', [packageManager, '-s', 'release:smoke:react']],
  ['CLI multi-host tarball consumer', 'corepack', [packageManager, '-s', 'release:smoke:cli']],
  ['Documentation build', 'corepack', [packageManager, '-s', 'docs:build']],
];

const receipt = runRehearsal({
  rootDir: ROOT_DIR,
  artifactDir,
  steps,
  packageManager,
  stepTimeoutMs,
});
process.exitCode = receipt.status === 'passed' ? 0 : 1;
