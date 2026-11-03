import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUEUE_DELAY_LIMIT_MS,
  SLOT_GRACE_MS,
  auditCycle as buildAudit,
  cycleVerdict,
  expectedSlotAt,
  expectedSlotsBetween,
  laneOutcome,
  runIsBaseline,
  slotLabelForCron,
} from '../cycle-report.mjs';

const auditCycle = (input) => buildAudit({ policyActivatedAt: '2026-11-04T00:00:00Z', ...input });

const run = (id, fields) => ({
  id,
  event: 'schedule',
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-11-04T08:00:00Z',
  run_started_at: '2026-11-04T08:00:05Z',
  head_sha: 'a'.repeat(40),
  ...fields,
});

test('cron labels map to the documented UTC and Asia/Shanghai slots', () => {
  assert.equal(slotLabelForCron('0 0 * * *'), '00:00 UTC / 08:00 Asia/Shanghai');
  assert.equal(slotLabelForCron('0 8 * * *'), '08:00 UTC / 16:00 Asia/Shanghai');
  assert.equal(slotLabelForCron('0 16 * * *'), '16:00 UTC / 00:00 Asia/Shanghai');
  assert.equal(slotLabelForCron('17 * * * *'), null);
});

test('expected slot calculation resolves the previous UTC slot', () => {
  assert.equal(expectedSlotAt('2026-11-04T09:00:00Z'), Date.parse('2026-11-04T08:00:00Z'));
  assert.equal(expectedSlotAt('2026-11-04T02:00:00Z'), Date.parse('2026-11-04T00:00:00Z'));
  // Before the first slot of the day, the previous slot is yesterday's 16:00.
  assert.equal(expectedSlotAt('2026-11-04T00:30:00Z'), Date.parse('2026-11-04T00:00:00Z'));
  assert.equal(expectedSlotAt('2026-11-03T23:00:00Z'), Date.parse('2026-11-03T16:00:00Z'));
});

test('expectedSlotsBetween enumerates three slots per UTC day', () => {
  const slots = expectedSlotsBetween(
    Date.parse('2026-11-03T00:00:00Z'),
    Date.parse('2026-11-04T16:00:00Z')
  );
  assert.equal(slots.length, 6);
  assert.deepEqual(
    slots.map((ms) => new Date(ms).toISOString()),
    [
      '2026-11-03T00:00:00.000Z',
      '2026-11-03T08:00:00.000Z',
      '2026-11-03T16:00:00.000Z',
      '2026-11-04T00:00:00.000Z',
      '2026-11-04T08:00:00.000Z',
      '2026-11-04T16:00:00.000Z',
    ]
  );
});

test('lane outcomes: a skipped lane is not_run and unknown is not passing', () => {
  assert.equal(laneOutcome('skipped'), 'not_run');
  assert.equal(laneOutcome('cancelled'), 'cancelled');
  assert.equal(cycleVerdict({}), 'unknown');
  assert.equal(cycleVerdict({ a: { outcome: 'success' } }), 'pass');
  assert.equal(cycleVerdict({ a: { outcome: 'success' }, b: { outcome: 'failed' } }), 'fail');
  assert.equal(cycleVerdict({ a: { outcome: 'success' }, b: { outcome: 'not_run' } }), 'unknown');
});

test('only a completed green cycle forms a baseline', () => {
  assert.equal(runIsBaseline(run(1)), true);
  assert.equal(runIsBaseline(run(1, { conclusion: 'failure' })), false);
  assert.equal(runIsBaseline(run(1, { conclusion: 'cancelled' })), false);
  assert.equal(runIsBaseline(run(1, { status: 'in_progress' })), false);
  assert.equal(runIsBaseline(run(1, { conclusion: null })), false);
});

test('queue delay beyond 60 minutes is an incident but never a fake green', () => {
  const { receipt, verdict, incidents } = auditCycle({
    now: '2026-11-04T10:00:00Z',
    cron: '0 8 * * *',
    laneResults: { build: 'success', test: 'success' },
    currentRun: run(9, {
      created_at: '2026-11-04T08:05:00Z',
      run_started_at: '2026-11-04T09:30:00Z',
    }),
    recentRuns: [run(1, { created_at: '2026-11-04T08:00:00Z' })],
  });
  assert.equal(verdict, 'pass');
  assert.equal(receipt.slotDelayMs, 90 * 60 * 1000);
  assert.ok(incidents.some((incident) => incident.type === 'queue-delay'));
  assert.equal(receipt.queueDelayMs, 85 * 60 * 1000);
});

test('the expected slot binds to the cycle creation time, not report completion', () => {
  // The cycle started 90 minutes after its own 08:00 slot; evaluating the
  // report at 17:30 must not rebind the expectation to the 16:00 slot.
  const { receipt, incidents } = auditCycle({
    now: '2026-11-04T17:30:00Z',
    cron: '0 8 * * *',
    laneResults: { build: 'success' },
    currentRun: run(9, {
      created_at: '2026-11-04T08:00:00Z',
      run_started_at: '2026-11-04T09:30:00Z',
    }),
    recentRuns: [],
  });
  assert.equal(receipt.slotDelayMs, 90 * 60 * 1000);
  assert.equal(receipt.scheduledSlot.expectedAt, '2026-11-04T08:00:00.000Z');
  assert.ok(incidents.some((incident) => incident.type === 'queue-delay'));
});

test('a missed slot is detected from scheduled-run gaps', () => {
  const { incidents } = auditCycle({
    now: '2026-11-04T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'success' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    recentRuns: [
      run(1, { created_at: '2026-11-04T00:00:00Z' }),
      // 08:00 slot intentionally absent.
      run(3, { created_at: '2026-11-04T16:00:00Z' }),
    ],
  });
  assert.ok(incidents.some((incident) => incident.type === 'missed-slot'));
  const missed = incidents.find((incident) => incident.type === 'missed-slot');
  assert.match(missed.detail, /2026-11-04T08:00:00/);
});

test('two successive non-green cycles signal the repair-only condition', () => {
  const { receipt, incidents } = auditCycle({
    now: '2026-11-04T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'failure' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    recentRuns: [
      run(1, { created_at: '2026-11-04T00:00:00Z', conclusion: 'failure' }),
      run(2, { created_at: '2026-11-04T08:00:00Z', conclusion: 'failure' }),
    ],
  });
  assert.equal(receipt.consecutiveFailedCycles, 3);
  assert.ok(incidents.some((incident) => incident.type === 'consecutive-failures'));
});

test('a queued or unfinished cycle counts as non-green and the current cycle joins the chain', () => {
  const { receipt } = auditCycle({
    now: '2026-11-04T17:00:00Z',
    cron: '0 16 * * *',
    // The current cycle itself is non-green: an unknown lane.
    laneResults: { build: 'skipped' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    recentRuns: [
      run(1, { created_at: '2026-11-04T00:00:00Z', conclusion: 'failure' }),
      // A queued (never-finished) run also counts: unknown is not green.
      run(2, {
        created_at: '2026-11-04T08:00:00Z',
        status: 'queued',
        conclusion: null,
      }),
    ],
  });
  assert.equal(receipt.consecutiveFailedCycles, 3);
});

test('scheduled history before policy activation never fabricates missed slots', () => {
  const { incidents } = auditCycle({
    now: '2026-11-04T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'success' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    // A run that predates the activation instant must not mark the 08:00
    // slot as "seen history" nor leave earlier slots as fabricated misses.
    recentRuns: [
      run(1, { created_at: '2026-11-03T08:00:00Z', conclusion: 'failure' }),
      run(2, { created_at: '2026-11-04T16:00:00Z' }),
    ],
  });
  const missed = incidents
    .filter((incident) => incident.type === 'missed-slot')
    .map((incident) => incident.detail);
  assert.ok(
    missed.every((detail) => !detail.includes('2026-11-03')),
    `pre-activation slot must never be flagged: ${JSON.stringify(missed)}`
  );
});

test('a 24h stale baseline is flagged without fabricating cycles', () => {
  const { incidents } = auditCycle({
    now: '2026-11-05T20:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'failure' },
    currentRun: run(9, {
      created_at: '2026-11-05T16:00:00Z',
      run_started_at: '2026-11-05T16:00:10Z',
    }),
    recentRuns: [run(1, { created_at: '2026-11-04T12:00:00Z', conclusion: 'success' })],
  });
  assert.ok(incidents.some((incident) => incident.type === 'stale-baseline'));
});

test('cancelled or not-started lanes turn the verdict unknown and fail closed', () => {
  const { verdict, receipt } = auditCycle({
    now: '2026-11-04T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'success', test: 'skipped', rust: 'cancelled' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    recentRuns: [run(1, { created_at: '2026-11-04T16:00:00Z' })],
  });
  assert.equal(verdict, 'unknown');
  assert.equal(receipt.laneInventory.test.outcome, 'not_run');
  assert.equal(receipt.laneInventory.rust.outcome, 'cancelled');
});

test('a green current scheduled cycle resets the red chain and permits measured recovery', () => {
  const { receipt, incidents } = auditCycle({
    now: '2026-11-05T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'success' },
    currentRun: run(9, { created_at: '2026-11-05T16:00:00Z' }),
    recentRuns: [run(1, { conclusion: 'failure' }), run(2, { created_at: '2026-11-05T08:00:00Z' })],
  });
  assert.equal(receipt.consecutiveFailedCycles, 0);
  assert.equal(receipt.consecutiveGreenCycles, 2);
  assert.equal(receipt.hoursSinceBaseline, 0);
  assert.ok(
    !incidents.some((incident) =>
      ['consecutive-failures', 'stale-baseline'].includes(incident.type)
    )
  );
});

test('no-baseline timer starts at the actual integration instant, not the planning date', () => {
  const input = {
    policyActivatedAt: '2026-11-05T15:00:00Z',
    now: '2026-11-05T17:00:00Z',
    cron: '0 16 * * *',
    laneResults: { build: 'skipped' },
    currentRun: run(9, { created_at: '2026-11-05T16:00:00Z' }),
    recentRuns: [run(1, { conclusion: 'failure' })],
  };
  const early = auditCycle(input);
  assert.equal(early.receipt.consecutiveFailedCycles, 1);
  assert.equal(early.receipt.hoursSinceBaseline, 2);
  assert.deepEqual(early.receipt.missedSlots, []);
  assert.ok(!early.incidents.some((incident) => incident.type === 'stale-baseline'));
  const late = auditCycle({ ...input, now: '2026-11-06T15:00:00Z' });
  assert.ok(late.incidents.some((incident) => incident.type === 'stale-baseline'));
});

test('a cron created after the next slot retains its declared slot', () => {
  const { receipt } = auditCycle({
    now: '2026-11-04T17:30:00Z',
    cron: '0 8 * * *',
    laneResults: { build: 'failure' },
    currentRun: run(9, {
      created_at: '2026-11-04T16:30:00Z',
      run_started_at: '2026-11-04T17:00:00Z',
    }),
    recentRuns: [],
  });
  assert.equal(receipt.scheduledSlot.expectedAt, '2026-11-04T08:00:00.000Z');
  assert.ok(!receipt.missedSlots.includes('2026-11-04T08:00:00.000Z'));
});
