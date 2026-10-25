// One packed Checkbox+Label fixture only. Not a general allow-failure policy.
export const REVIEWED_SYNTHETIC_SHA256 =
  'fa39d00dc53f38d90794f0455a834279de8321737862325bfd3d25d8fbba6838';
export const NATIVE_CASES = [
  'default', 'preassembled-explicit', 'rich-label-naming', 'label-pointer',
  'direct-pointer', 'focused-space', 'interactive-descendant-exclusion',
  'pair-isolation', 'omitted-indicator', 'raw-root', 'disabled',
  'controlled-rejection', 'mixed', 'naming-only',
  'detached-label-programmatic-regression', 'removal-without-observed-pageerror',
];
export const FAILURE_CHECKPOINTS = [
  'imports-complete', 'platform-order-canary', 'default-pairs',
  'mount:start:default:{}', 'mount:connected:default:{}',
  'mount:start:default:{}', 'mount:connected:default:{}',
  'rich-label-activation', 'direct-control-activation', 'interactive-descendant',
  'explicit-and-state-cases', 'mount:start:explicit:{}', 'cleanup',
];
export const REPLAY_CHECKPOINTS = [
  "imports-complete",
  "platform-order-canary",
  "default-pairs",
  "mount:start:default:{}",
  "mount:connected:default:{}",
  "mount:start:default:{}",
  "mount:connected:default:{}",
  "rich-label-activation",
  "direct-control-activation",
  "interactive-descendant",
  "explicit-and-state-cases",
  "mount:start:explicit:{}",
  "mount:connected:explicit:{}",
  "mount:start:none:{}",
  "mount:connected:none:{}",
  "mount:start:raw:{}",
  "mount:connected:raw:{}",
  "mount:start:default:{\"disabled\":true,\"defaultChecked\":true}",
  "mount:connected:default:{\"disabled\":true,\"defaultChecked\":true}",
  "mount:start:default:{\"checked\":false}",
  "mount:connected:default:{\"checked\":false}",
  "mount:start:default:{\"defaultIndeterminate\":true}",
  "mount:connected:default:{\"defaultIndeterminate\":true}",
  "disabled-controlled-mixed",
  "naming-only",
  "label-detach",
  "cleanup"
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha256 = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const IDENTITY_KEYS = [
  'testedCommit', 'releaseVersion', 'packages', 'lockSha256',
  'generatedFacadeSha256', 'fixtureSha256', 'replaySourceSha256',
  'originalSyntheticFixtureSha256', 'repoLockSha256',
];
const releaseVersion = (v) => typeof v === 'string' &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(v);
const packedPackages = (packages, version) => Array.isArray(packages) && packages.length > 0 &&
  packages.every((pkg) => pkg && typeof pkg.name === 'string' &&
    /^@proto\.ui\/[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(pkg.name) &&
    pkg.version === version && typeof pkg.integrity === 'string' &&
    /^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity) &&
    typeof pkg.shasum === 'string' && /^[a-f0-9]{40}$/.test(pkg.shasum)) &&
  new Set(packages.map((pkg) => pkg.name)).size === packages.length;
const cleanProcess = (p) => p && p.error === null && p.signal === null && Number.isInteger(p.status);
const structuredError = (e) => e && typeof e.name === 'string' &&
  typeof e.message === 'string' && typeof e.stack === 'string' &&
  (e.code === null || typeof e.code === 'string');

export function decideCheckboxHostAdmission(input) {
  const fail = (reason) => ({ admitted: false, synthetic: 'not-admitted', reason });
  if (!input || input.prepared !== true || input.otherHostsPassed !== true) return fail('preparation-or-other-host');
  const { expected, nativeProcess, nativeReceipt, syntheticProcess, syntheticReceipt: r } = input;
  if (!expected || !IDENTITY_KEYS.every((key) => Object.hasOwn(expected, key)) ||
      !/^[a-f0-9]{40}$/.test(expected.testedCommit ?? '') ||
      !releaseVersion(expected.releaseVersion) || !packedPackages(expected.packages, expected.releaseVersion) ||
      !['lockSha256', 'generatedFacadeSha256', 'fixtureSha256', 'replaySourceSha256',
        'originalSyntheticFixtureSha256', 'repoLockSha256'].every((key) => sha256(expected[key]))) return fail('invalid-identity');
  if (!cleanProcess(nativeProcess) || nativeProcess.status !== 0) return fail('native-process');
  if (nativeReceipt?.kind !== 'checkbox-label-native-process-receipt' || nativeReceipt.version !== 1 || nativeReceipt.final !== true) return fail('native-receipt');
  const { native, replay } = nativeReceipt;
  for (const evidence of [native, replay]) {
    if (!evidence || !IDENTITY_KEYS.every((key) => Object.hasOwn(evidence, key) && same(evidence[key], expected[key]))) return fail('native-identity');
  }
  if (native.kind !== 'checkbox-label-packed-native-evidence' ||
      native.outcome !== 'bounded-wc-composition-contract-cases-passed' ||
      !same(native.coveredCases, NATIVE_CASES) || !same(native.platformOrder, ['parent', 'child'])) return fail('native-cases');
  if (replay.kind !== 'checkbox-label-packed-browser-replay-evidence' || replay.host !== 'native-chromium' ||
      replay.eventMode !== 'original-programmatic-dispatch-not-trusted-pointer' || replay.outcome !== 'passed' ||
      replay.error !== null || replay.cleanupError !== null || replay.runnerError !== null ||
      replay.failureStage !== null || replay.observedPageNetworkErrorCount !== 0 ||
      !same(replay.checkpoints, REPLAY_CHECKPOINTS)) return fail('replay-cases');
  if (!cleanProcess(syntheticProcess)) return fail('synthetic-process');
  if (r?.kind !== 'checkbox-label-synthetic-process-receipt' || r.version !== 1 || r.final !== true ||
      r.fixtureSha256 !== expected.originalSyntheticFixtureSha256 || r.exitCode !== syntheticProcess.status ||
      r.finalStage !== 'cleanup' || !Array.isArray(r.fatal) || !Array.isArray(r.checkpoints)) return fail('synthetic-receipt');
  if (syntheticProcess.status === 0 && r.primary === null && r.cleanup === null &&
      r.cleanupCompleted === true && r.fatal.length === 0 &&
      same(r.checkpoints, REPLAY_CHECKPOINTS)) {
    return { admitted: true, synthetic: 'passed', reason: 'both-native-paths-and-synthetic-passed' };
  }
  const host = input.syntheticHost;
  if (r.fixtureSha256 !== REVIEWED_SYNTHETIC_SHA256 ||
      host?.registrator?.version !== '20.11.0' || host?.implementation?.version !== '20.14.6' ||
      host.registrator.entrySha256 !== 'ef1908cde15d71893a35feddfdb2c3a0891b333e5a9d37275ee80edabb56ca43' ||
      host.implementation.entrySha256 !== 'ef24535de425ea58d8650fca46be1ad4ec33dc817524a500c097e5f4df1e0b00') return fail('unreviewed-synthetic-identity');
  // No message matching: exact stage, structured code, observed order and the
  // very same primary Error propagated into Node's default fatal exit.
  if (syntheticProcess.status !== 1 || !same(r.platformOrder, ['child', 'parent']) ||
      !same(r.checkpoints, FAILURE_CHECKPOINTS) || r.primary?.stage !== 'mount:start:explicit:{}' ||
      !structuredError(r.primary.error) || r.primary.error.code !== 'CONTEXT_PROVIDER_MISSING' ||
      r.cleanup !== null || r.cleanupCompleted !== true || r.fatal.length !== 1 ||
      r.fatal[0]?.origin !== 'unhandledRejection' || r.fatal[0].stage !== 'cleanup' ||
      r.fatal[0].sameAsPrimary !== true || !same(r.fatal[0].error, r.primary.error)) return fail('unknown-synthetic-runtime-failure');
  return { admitted: true, synthetic: 'failed-known-host-compatibility', reason: 'bounded-native-admission-not-synthetic-pass' };
}
