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
} from '../cycle-report.mjs';

const auditCycle = (input) => buildAudit({ policyActivatedAt: '2026-11-04T00:00:00Z', ...input });

const SLOT_CRONS = Object.freeze({ 0: '0 0 * * *', 8: '0 8 * * *', 16: '0 16 * * *' });

// A scheduled cycle carries its cron in its native run name.
const runName = (cron) => `regression-cycle:${cron}`;

// The cron a scheduled cycle declares, derived from its creation instant the
// way the reporter does: the latest slot at or before that instant.
const cronForCreatedAt = (createdAt) =>
  SLOT_CRONS[new Date(expectedSlotAt(createdAt)).getUTCHours()];

const run = (id, fields = {}) => {
  const created_at = fields.created_at ?? '2026-11-04T08:00:00Z';
  return {
    id,
    event: 'schedule',
    status: 'completed',
    conclusion: 'success',
    created_at,
    run_started_at: '2026-11-04T08:00:05Z',
    head_sha: 'a'.repeat(40),
    display_title: runName(cronForCreatedAt(created_at)),
    ...fields,
  };
};

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
      display_title: 'regression-cycle:0 8 * * *',
    }),
    recentRuns: [],
  });
  assert.equal(receipt.scheduledSlot.expectedAt, '2026-11-04T08:00:00.000Z');
  assert.ok(!receipt.missedSlots.includes('2026-11-04T08:00:00.000Z'));
});

test('a delayed 08:00 cycle created at 16:30 keeps its declared slot and leaves the 16:00 slot missing', () => {
  const input = {
    now: '2026-11-05T00:30:00Z',
    cron: '0 0 * * *',
    laneResults: { build: 'success' },
    currentRun: run(9, {
      created_at: '2026-11-05T00:00:00Z',
      run_started_at: '2026-11-05T00:00:10Z',
    }),
    recentRuns: [
      run(1, { created_at: '2026-11-04T00:00:00Z' }),
      // The 08:00 cycle was created 8.5 hours late. Its native run name still
      // declares the 08:00 cron, so it covers the 08:00 slot and not the
      // 16:00 slot its creation instant falls into.
      run(2, {
        created_at: '2026-11-04T16:30:00Z',
        display_title: 'regression-cycle:0 8 * * *',
      }),
    ],
  };
  const { receipt, incidents } = auditCycle(input);
  assert.ok(
    !receipt.missedSlots.includes('2026-11-04T08:00:00.000Z'),
    'the delayed 08:00 cycle must cover the 08:00 slot it declared'
  );
  assert.ok(
    receipt.missedSlots.includes('2026-11-04T16:00:00.000Z'),
    'the 16:00 slot is missing while no 16:00 cycle exists'
  );
  assert.ok(
    incidents.some(
      (incident) =>
        incident.type === 'missed-slot' && incident.detail.includes('2026-11-04T16:00:00')
    )
  );
  // Only an actual 16:00 cycle covers the 16:00 slot.
  const withSixteen = auditCycle({
    ...input,
    recentRuns: [
      ...input.recentRuns,
      run(3, {
        created_at: '2026-11-04T16:00:00Z',
        display_title: 'regression-cycle:0 16 * * *',
      }),
    ],
  });
  assert.ok(!withSixteen.receipt.missedSlots.includes('2026-11-04T16:00:00.000Z'));
});

test('a failed 16:00 cycle stays the latest cycle when the earlier 08:00 cycle was created later', () => {
  const { receipt, incidents } = auditCycle({
    now: '2026-11-05T00:30:00Z',
    cron: '0 0 * * *',
    laneResults: { build: 'failure' },
    currentRun: run(9, {
      created_at: '2026-11-05T00:00:00Z',
      run_started_at: '2026-11-05T00:00:10Z',
    }),
    recentRuns: [
      run(1, { created_at: '2026-11-04T00:00:00Z' }),
      run(2, {
        created_at: '2026-11-04T16:30:00Z',
        display_title: 'regression-cycle:0 8 * * *',
      }),
      run(3, {
        created_at: '2026-11-04T16:00:00Z',
        conclusion: 'failure',
        display_title: 'regression-cycle:0 16 * * *',
      }),
    ],
  });
  // Slot order is 00:00 green, 08:00 green, 16:00 failed, current failed:
  // the earlier 08:00 cycle must not reset the failure chain.
  assert.equal(receipt.consecutiveFailedCycles, 2);
  assert.ok(incidents.some((incident) => incident.type === 'consecutive-failures'));
});

test('a scheduled run without a declared cron never covers a slot', () => {
  for (const display_title of [null, 'regression-cycle:17 * * * *']) {
    const input = {
      now: '2026-11-05T00:30:00Z',
      cron: '0 0 * * *',
      laneResults: { build: 'success' },
      currentRun: run(9, {
        created_at: '2026-11-05T00:00:00Z',
        run_started_at: '2026-11-05T00:00:10Z',
      }),
      recentRuns: [
        run(1, { created_at: '2026-11-04T00:00:00Z' }),
        // Created inside the 16:00 slot window but declaring no known cron:
        // it is explicitly unknown and stands in for no slot at all.
        run(2, { created_at: '2026-11-04T16:10:00Z', display_title }),
      ],
    };
    const { receipt, incidents } = auditCycle(input);
    assert.ok(
      receipt.missedSlots.includes('2026-11-04T16:00:00.000Z'),
      'an unknown label must not cover a slot it never declared'
    );
    const unknown = incidents.find((incident) => incident.type === 'unknown-attribution');
    assert.ok(unknown, 'an unattributable scheduled run must be reported as unknown');
    assert.match(unknown.detail, /#2/);
    assert.equal(
      receipt.consecutiveGreenCycles,
      1,
      'unknown attribution cannot authorize recovery'
    );
    const failedCurrent = auditCycle({ ...input, laneResults: { build: 'failure' } });
    assert.equal(failedCurrent.receipt.lastBaseline.id, 1);
    assert.ok(failedCurrent.incidents.some((incident) => incident.type === 'stale-baseline'));
  }
});

test('unknown cycles before a delayed current creation still fence recovery and count red', () => {
  for (const result of ['success', 'failure']) {
    const { receipt } = auditCycle({
      now: '2026-11-04T17:00:00Z',
      cron: '0 8 * * *',
      laneResults: { build: result },
      currentRun: run(9, { created_at: '2026-11-04T16:30:00Z' }),
      recentRuns: [
        run(1, { created_at: '2026-11-04T00:00:00Z' }),
        run(2, { created_at: '2026-11-04T12:00:00Z', display_title: null }),
      ],
    });
    assert.equal(receipt.consecutiveGreenCycles, result === 'success' ? 1 : 0);
    assert.equal(receipt.consecutiveFailedCycles, result === 'failure' ? 2 : 0);
  }
});

test('complete history retains an early missed slot after a hundred observed cycles', () => {
  const start = Date.parse('2026-11-04T00:00:00Z');
  const interval = 8 * 60 * 60 * 1000;
  const { receipt } = auditCycle({
    now: new Date(start + 102 * interval).toISOString(),
    cron: null,
    laneResults: { build: 'failure' },
    currentRun: run(999, {
      event: 'workflow_dispatch',
      created_at: new Date(start + 102 * interval).toISOString(),
    }),
    recentRuns: Array.from({ length: 100 }, (_, index) =>
      run(index + 1, { created_at: new Date(start + (index + 2) * interval).toISOString() })
    ),
  });
  assert.ok(receipt.missedSlots.includes('2026-11-04T08:00:00.000Z'));
});

test('a manual cycle has no slot and never stands in for a scheduled slot', () => {
  const { receipt } = auditCycle({
    now: '2026-11-04T18:00:00Z',
    cron: null,
    laneResults: { build: 'success' },
    currentRun: run(9, {
      event: 'workflow_dispatch',
      created_at: '2026-11-04T16:00:00Z',
      run_started_at: '2026-11-04T16:00:10Z',
    }),
    recentRuns: [],
  });
  assert.equal(receipt.scheduledSlot, null);
  assert.ok(receipt.missedSlots.includes('2026-11-04T16:00:00.000Z'));
});
