import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SETTINGS_CHECKS } from './tabs-settings-oracle.mjs';

// Parameterize the existing trusted POSIX deadline implementation at its single
// worker entrypoint, without editing it or duplicating its process cleanup logic.
// Fail closed if that declaration changes. Neither HTML nor config chooses code.
const baselineURL = new URL('./bounded-worker.mjs', import.meta.url);
const workerURL = new URL('./settings-worker.mjs', import.meta.url);
const source = await readFile(baselineURL, 'utf8');
const anchor = "const worker = fileURLToPath(new URL('./tabs-worker.mjs', import.meta.url));";
assert.equal(
  source.split(anchor).length,
  2,
  'Bounded worker entrypoint must have one exact trusted anchor'
);
const adapted = source.replace(
  anchor,
  `const worker = fileURLToPath(new URL(${JSON.stringify(workerURL.href)}));`
);
const { boundedTabs } = await import(
  `data:text/javascript;base64,${Buffer.from(adapted).toString('base64')}`
);
export async function boundedSettings(options) {
  const receipt = await boundedTabs(options);
  await writeFile(
    path.join(options.evidenceDir, 'settings-worker-provenance.json'),
    JSON.stringify(
      {
        kind: 'trusted-worker-entrypoint-parameterization',
        baseline: baselineURL.href,
        baselineSha256: createHash('sha256').update(source).digest('hex'),
        worker: workerURL.href,
        workerSha256: createHash('sha256')
          .update(await readFile(workerURL))
          .digest('hex'),
        evaluatorSha256: createHash('sha256')
          .update(await readFile(new URL('./tabs-settings-oracle.mjs', import.meta.url)))
          .digest('hex'),
        receiptKind: receipt.kind,
        limitation:
          'Reuse retains baseline worker receipt identity. Registered worker/Chrome groups only; not OS sandbox proof.',
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  );
  let result = null;
  try {
    result = JSON.parse(await readFile(path.join(options.evidenceDir, 'result.json'), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const eligibility = settingsEligibility(result, receipt);
  await writeFile(
    path.join(options.evidenceDir, 'settings-eligibility.json'),
    JSON.stringify(eligibility, null, 2) + '\n',
    { flag: 'wx' }
  );
  return { ...receipt, eligibility };
}

/** Admission remains separate; this only evaluates the bounded task evidence. */
export function settingsEligibility(result, receipt) {
  const inventoryComplete =
    result?.checks?.length === SETTINGS_CHECKS.length &&
    result.checks.every((c, i) => c.id === SETTINGS_CHECKS[i]);
  const allCorePassed = !!inventoryComplete && result.checks.every((c) => c.status === 'pass');
  const scoringEligible =
    receipt?.outcome === 'completed' &&
    receipt.deadlineExceeded === false &&
    !!receipt.browserPid &&
    receipt.cleanup?.length === 2 &&
    receipt.cleanup.every((c) => c.status === 'no-live-group-members' && c.live?.length === 0) &&
    !receipt.cleanupError &&
    result?.execution === 'completed' &&
    result.evidence?.status === 'complete' &&
    result.hostErrors?.status === 'pass' &&
    inventoryComplete &&
    result.checks.every((c) => ['pass', 'fail'].includes(c.status) && c.evidence?.length === 3);
  return {
    scoringEligible: !!scoringEligible,
    allCorePassed,
    taskAccepted: !!scoringEligible && allCorePassed,
    admission: 'not-admitted',
    reason: scoringEligible
      ? 'Determinate bounded task observations with complete evidence, no host errors, and verified registered-group cleanup; semantic failures remain scored failures'
      : 'Scoring requires determinate checks, completed execution/evidence, no host errors, and clean bounded-worker receipt; core pass count alone is insufficient',
  };
}
