#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ROOT_DIR } from './lib.mjs';

const packageManager = JSON.parse(
  readFileSync(join(ROOT_DIR, 'package.json'), 'utf8')
).packageManager;
const artifactDir = mkdtempSync(join(tmpdir(), 'proto-ui-release-rehearsal-'));
let succeeded = false;

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
  ['Package publish dry-run', 'corepack', [packageManager, '-s', 'release:stage']],
  ['React tarball consumer', 'corepack', [packageManager, '-s', 'release:smoke:react']],
  ['CLI multi-host tarball consumer', 'corepack', [packageManager, '-s', 'release:smoke:cli']],
  ['Documentation build', 'corepack', [packageManager, '-s', 'docs:build']],
];

try {
  for (const [label, command, args] of steps) {
    console.log(`\n[release rehearsal] ${label}`);
    const result = spawnSync(command, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${label} failed with exit code ${result.status}`);
    }
  }
  succeeded = true;
  console.log('\n[release rehearsal] complete: no publication was performed');
} finally {
  if (succeeded) rmSync(artifactDir, { recursive: true, force: true });
  else console.error(`[release rehearsal] snapshot artifacts kept at ${artifactDir}`);
}
