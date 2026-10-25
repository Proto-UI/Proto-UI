import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  decideCheckboxHostAdmission, REVIEWED_SYNTHETIC_SHA256, NATIVE_CASES, FAILURE_CHECKPOINTS, REPLAY_CHECKPOINTS,
} from '../checkbox-host-admission.mjs';

// Policy controls only: these records are NOT browser/product acceptance.
function valid() {
  const expected = {
    testedCommit: 'a'.repeat(40), releaseVersion: '0.3.0-alpha.1', packages: [{ name: '@proto.ui/fixture', version: '0.3.0-alpha.1', integrity: `sha512-${'A'.repeat(86)}==`, shasum: '1'.repeat(40) }],
    lockSha256: 'b'.repeat(64), generatedFacadeSha256: 'c'.repeat(64), fixtureSha256: 'd'.repeat(64),
    replaySourceSha256: 'e'.repeat(64), repoLockSha256: 'f'.repeat(64),
    originalSyntheticFixtureSha256: REVIEWED_SYNTHETIC_SHA256,
  };
  const error = { name: 'Error', code: 'CONTEXT_PROVIDER_MISSING', message: 'test only', stack: 'test only' };
  return {
    expected, prepared: true, otherHostsPassed: true,
    nativeProcess: { status: 0, signal: null, error: null },
    nativeReceipt: {
      kind: 'checkbox-label-native-process-receipt', version: 1, final: true,
      native: { ...expected, kind: 'checkbox-label-packed-native-evidence',
        outcome: 'bounded-wc-composition-contract-cases-passed', coveredCases: NATIVE_CASES, platformOrder: ['parent', 'child'] },
      replay: { ...expected, kind: 'checkbox-label-packed-browser-replay-evidence', host: 'native-chromium',
        eventMode: 'original-programmatic-dispatch-not-trusted-pointer', outcome: 'passed',
        error: null, cleanupError: null, runnerError: null, failureStage: null, observedPageNetworkErrorCount: 0,
        checkpoints: REPLAY_CHECKPOINTS },
    },
    syntheticProcess: { status: 1, signal: null, error: null },
    syntheticReceipt: {
      kind: 'checkbox-label-synthetic-process-receipt', version: 1, final: true,
      fixtureSha256: REVIEWED_SYNTHETIC_SHA256, exitCode: 1, finalStage: 'cleanup',
      platformOrder: ['child', 'parent'], checkpoints: FAILURE_CHECKPOINTS,
      primary: { stage: 'mount:start:explicit:{}', error }, cleanup: null, cleanupCompleted: true,
      fatal: [{ origin: 'unhandledRejection', stage: 'cleanup', sameAsPrimary: true, error }],
    },
    syntheticHost: {
      registrator: { version: '20.11.0', entrySha256: 'ef1908cde15d71893a35feddfdb2c3a0891b333e5a9d37275ee80edabb56ca43' },
      implementation: { version: '20.14.6', entrySha256: 'ef24535de425ea58d8650fca46be1ad4ec33dc817524a500c097e5f4df1e0b00' },
    },
  };
}
for (const [name, change] of Object.entries({
  'native fail': x => x.nativeProcess.status = 1,
  'replay fail': x => x.nativeReceipt.replay.outcome = 'failed',
  'preparation fail': x => x.prepared = false,
  'other host fail': x => x.otherHostsPassed = false,
  'spawn error': x => x.syntheticProcess.error = { code: 'ENOENT' },
  'timeout': x => x.syntheticProcess.error = { code: 'ETIMEDOUT' },
  'signal': x => x.syntheticProcess.signal = 'SIGTERM',
  'missing receipt': x => x.syntheticReceipt = null,
  'missing native receipt': x => x.nativeReceipt = null,
  'identity mismatch': x => x.nativeReceipt.replay.lockSha256 = '0'.repeat(64),
  'unknown runtime failure': x => x.syntheticReceipt.primary.error = { code: 'OTHER' },
  'different fatal error': x => x.syntheticReceipt.fatal[0].sameAsPrimary = false,
  'cleanup error': x => x.syntheticReceipt.cleanup = { error: { code: 'OTHER' } },
  'incomplete cleanup': x => x.syntheticReceipt.cleanupCompleted = false,
  'incomplete final': x => x.syntheticReceipt.final = false,
  'malformed receipt': x => x.syntheticReceipt.fatal = {},
  'noncanonical exit': x => x.syntheticProcess.status = 2,
  'wrong stage': x => x.syntheticReceipt.primary.stage = 'default-pairs',
  'incomplete cases': x => x.nativeReceipt.native.coveredCases = ['default'],
  'unknown host version': x => x.syntheticHost.implementation.version = '99.0.0',
  'different order': x => x.syntheticReceipt.platformOrder = ['parent', 'child'],
  'different fixture': x => x.syntheticReceipt.fixtureSha256 = '0'.repeat(64),
})) test(`rejects ${name}`, () => {
  const input = structuredClone(valid());
  change(input);
  assert.equal(decideCheckboxHostAdmission(input).admitted, false);
});

// Mutate all three matching records: equality alone must not validate an absent
// or malformed binding, even when both native receipts repeat the same defect.
for (const [name, change] of Object.entries({
  'missing releaseVersion': identity => delete identity.releaseVersion,
  'null releaseVersion': identity => identity.releaseVersion = null,
  'empty releaseVersion': identity => identity.releaseVersion = '',
  'malformed releaseVersion': identity => identity.releaseVersion = 'latest',
  'invalid semver releaseVersion': identity => identity.releaseVersion = '01.2.3',
  'missing packages': identity => delete identity.packages,
  'null packages': identity => identity.packages = null,
  'non-array packages': identity => identity.packages = {},
  'empty packages': identity => identity.packages = [],
  'null package entry': identity => identity.packages = [null],
  'missing package version': identity => delete identity.packages[0].version,
  'wrong package version': identity => identity.packages[0].version = '0.3.0-alpha.2',
  'invalid package name': identity => identity.packages[0].name = '../fixture',
  'duplicate packages': identity => identity.packages = [identity.packages[0], identity.packages[0]],
  'missing package integrity': identity => delete identity.packages[0].integrity,
  'malformed package integrity': identity => identity.packages[0].integrity = 'sha512-test-only',
  'missing package shasum': identity => delete identity.packages[0].shasum,
  'malformed package shasum': identity => identity.packages[0].shasum = 'test-only',
})) test(`rejects matching malformed identity: ${name}`, () => {
  const input = structuredClone(valid());
  for (const identity of [input.expected, input.nativeReceipt.native, input.nativeReceipt.replay]) change(identity);
  assert.equal(decideCheckboxHostAdmission(input).admitted, false);
});
for (const key of ['releaseVersion', 'packages']) test(`rejects native receipt missing fixed ${key}`, () => {
  const input = valid(); delete input.nativeReceipt.replay[key];
  assert.equal(decideCheckboxHostAdmission(input).admitted, false);
});

test('known failure stays failed, but both mandatory native paths admit this bounded host slice', () => {
  assert.deepEqual(decideCheckboxHostAdmission(valid()), {
    admitted: true, synthetic: 'failed-known-host-compatibility', reason: 'bounded-native-admission-not-synthetic-pass',
  });
});
test('both native passes alone do not admit unknown synthetic failure', () => {
  const input = valid(); input.syntheticReceipt.primary.error = { code: 'ERR_ASSERTION' };
  assert.equal(decideCheckboxHostAdmission(input).admitted, false);
});
test('a genuine synthetic pass is reported as a pass, not a known failure', () => {
  const input = valid(); input.syntheticProcess.status = 0;
  Object.assign(input.syntheticReceipt, { exitCode: 0, primary: null, fatal: [], checkpoints: REPLAY_CHECKPOINTS });
  assert.equal(decideCheckboxHostAdmission(input).synthetic, 'passed');
});
test('reviewed synthetic source hash is bound to the actual checked-out fixture', () => {
  const source = readFileSync(new URL('../../../packages/cli/test/smoke-render/wc-checkbox-label.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), REVIEWED_SYNTHETIC_SHA256);
});
