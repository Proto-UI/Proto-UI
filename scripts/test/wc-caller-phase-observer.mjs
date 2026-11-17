import { writeSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

const runId = process.env.PUI_WC_PHASE_RUN_ID;
const variant = process.env.PUI_WC_PHASE_VARIANT;
if (!runId || (variant !== 'original947a' && variant !== 'r2')) {
  throw new Error('The disposable WC observer requires an exact run ID and runtime variant label.');
}
const started = performance.now();
let sequence = 0;

/** Observation only: these counters count emitted events, not product progress. */
export function recordWCPhase(phase, details = {}) {
  writeSync(
    2,
    JSON.stringify({
      kind: 'pr1484-wc-phase-observation',
      runId,
      runtimeLabel: variant,
      pid: process.pid,
      cwd: process.cwd(),
      sequence: ++sequence,
      phase,
      at: new Date().toISOString(),
      elapsedMs: performance.now() - started,
      details,
    }) + '\n'
  );
}

recordWCPhase('observer-module-loaded', {
  executable: process.execPath,
  nodeVersion: process.version,
});
beforeAll(() => recordWCPhase('test-file-collected'));
beforeEach((context) => recordWCPhase('case-beforeEach', { test: context.task?.name ?? null }));
afterEach((context) =>
  recordWCPhase('case-afterEach-hook', {
    test: context.task?.name ?? null,
    stateAtHook: context.task?.result?.state ?? null,
  })
);
afterAll(() => recordWCPhase('suite-afterAll'));
