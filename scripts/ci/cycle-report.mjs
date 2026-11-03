// Regression-cycle receipt builder for the daily ci.yml cycle.
//
// Consumed by the `cycle-report` job in `.github/workflows/ci.yml`. All inputs
// are file/env snapshots taken at run time so the analysis is deterministic
// and locally testable; importing this module performs no work.
//
// The receipt records the exact source revision, the complete lane inventory
// with per-lane outcomes (a lane that never started is `not_run`, and unknown
// is not passing), the scheduled slot, actual start and queue delay, missed
// slots, consecutive failed/unknown cycles and hours since the last valid
// complete baseline. Incidents are surfaced as workflow annotations; the job
// exit code is fail-closed on the lane verdict only.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUEUE_DELAY_LIMIT_MS = 60 * 60 * 1000;
export const STALE_BASELINE_HOURS = 24;
export const EXPECTED_CRONS = Object.freeze({
  '0 0 * * *': '00:00 UTC / 08:00 Asia/Shanghai',
  '0 8 * * *': '08:00 UTC / 16:00 Asia/Shanghai',
  '0 16 * * *': '16:00 UTC / 00:00 Asia/Shanghai',
});
export const SLOT_HOURS = Object.freeze([0, 8, 16]);
export const SLOT_GRACE_MS = 90 * 60 * 1000;

export function slotLabelForCron(cron) {
  return EXPECTED_CRONS[cron] ?? null;
}

// Latest expected slot time at or before `date`, in UTC millisecond space.
export function expectedSlotAt(date) {
  const ms = Date.parse(date);
  const dayStart = Date.UTC(
    new Date(ms).getUTCFullYear(),
    new Date(ms).getUTCMonth(),
    new Date(ms).getUTCDate()
  );
  for (let i = SLOT_HOURS.length - 1; i >= 0; i -= 1) {
    const slot = dayStart + SLOT_HOURS[i] * 3600 * 1000;
    if (slot <= ms) return slot;
  }
  return dayStart - (24 - SLOT_HOURS[SLOT_HOURS.length - 1]) * 3600 * 1000;
}

// Enumerate the three expected slot timestamps within [from, to].
export function expectedSlotsBetween(fromMs, toMs) {
  const slots = [];
  for (let day = Math.floor(fromMs / 86400000) * 86400000; day <= toMs; day += 86400000) {
    for (const hour of SLOT_HOURS) {
      const slot = day + hour * 3600 * 1000;
      if (slot >= fromMs && slot <= toMs) slots.push(slot);
    }
  }
  return slots;
}

export function laneOutcome(result) {
  switch (result) {
    case 'success':
      return 'success';
    case 'failure':
      return 'failed';
    case 'skipped':
      return 'not_run';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function cycleVerdict(lanes) {
  const outcomes = Object.values(lanes).map((lane) => lane.outcome);
  if (outcomes.length === 0) return 'unknown';
  if (outcomes.some((outcome) => outcome === 'failed')) return 'fail';
  if (outcomes.every((outcome) => outcome === 'success')) return 'pass';
  return 'unknown';
}

// A baseline is a cycle that completed green on a source revision. A failed,
// cancelled, skipped or never-finished run is never a baseline: the stale-
// baseline rule requires a valid complete GREEN cycle inside 24h.
export function runIsBaseline(run) {
  return run.status === 'completed' && run.conclusion === 'success';
}

export function auditCycle({ now, cron, laneResults, currentRun, recentRuns, policyActivatedAt }) {
  const nowMs = Date.parse(now);
  const activationMs = Date.parse(policyActivatedAt);
  if (!Number.isFinite(activationMs) || activationMs > nowMs)
    throw new Error('A valid, non-future policy activation instant is required');
  const startedMs = Date.parse(currentRun.run_started_at ?? currentRun.created_at);
  const createdMs = Date.parse(currentRun.created_at);
  // The expected slot binds to when THIS cycle was created, not to when the
  // cycle-report job finished evaluating: a long-running cycle must not drift
  // its slot attribution toward the report's completion time.
  if (cron && !Object.hasOwn(EXPECTED_CRONS, cron)) throw new Error(`Unknown cycle cron: ${cron}`);
  // A delayed 08:00 cron created after 16:00 still belongs to the 08:00 slot.
  const scheduledHour = cron ? Number(cron.split(' ')[1]) : null;
  let expectedMs = cron
    ? Date.UTC(
        new Date(createdMs).getUTCFullYear(),
        new Date(createdMs).getUTCMonth(),
        new Date(createdMs).getUTCDate(),
        scheduledHour
      )
    : null;
  if (expectedMs !== null && expectedMs > createdMs) expectedMs -= 86400000;
  const queueDelayMs = Math.max(0, startedMs - createdMs);
  const slotDelayMs = expectedMs === null ? null : Math.max(0, startedMs - expectedMs);

  const lanes = {};
  for (const [name, result] of Object.entries(laneResults)) {
    lanes[name] = { rawResult: result, outcome: laneOutcome(result) };
  }
  const verdict = cycleVerdict(lanes);

  // All scheduled runs, including queued/in_progress/never-finished ones: an
  // unknown cycle still counts (it breaks the green chain and is counted as
  // non-green), only stale pre-policy history is ignored below.
  const scheduleRuns = (recentRuns ?? [])
    .filter(
      (run) =>
        run.event === 'schedule' &&
        Date.parse(run.created_at) >= activationMs &&
        Date.parse(run.created_at) <= nowMs &&
        run.id !== currentRun.id
    )
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const observedRuns =
    currentRun.event === 'schedule' ? [...scheduleRuns, currentRun] : scheduleRuns;

  const earliestSeenMs = observedRuns.length ? Date.parse(observedRuns[0].created_at) : null;

  // Missed slots: expected slots older than the grace window and newer than
  // the oldest fetched run (or policy activation, whichever is later), with no
  // scheduled run within +/- grace.
  const missedSlots = expectedSlotsBetween(
    Math.max(
      activationMs,
      (recentRuns?.length ?? 0) >= 100 ? (earliestSeenMs ?? activationMs) : activationMs
    ),
    nowMs - SLOT_GRACE_MS
  ).filter(
    (slot) =>
      !observedRuns.some(
        (run) =>
          Math.abs(
            (run.id === currentRun.id && expectedMs !== null
              ? expectedMs
              : Date.parse(run.created_at)) - slot
          ) <= SLOT_GRACE_MS
      )
  );

  // Non-green chains: anything that is not a completed-successful cycle —
  // failures, timeouts, cancellations, queued/in_progress runs (unknown) and
  // runs with no recorded conclusion — counts as non-green, including the
  // current cycle itself.
  let consecutiveFailedCycles = 0;
  let consecutiveGreenCycles = 0;
  const priorRuns = scheduleRuns.filter((run) => Date.parse(run.created_at) <= createdMs);
  const scheduledVerdicts = priorRuns.map(runIsBaseline);
  if (currentRun.event === 'schedule') scheduledVerdicts.push(verdict === 'pass');
  const latestGreen = scheduledVerdicts.at(-1);
  for (const green of scheduledVerdicts.reverse()) {
    if (green !== latestGreen) break;
    if (green) consecutiveGreenCycles++;
    else consecutiveFailedCycles++;
  }

  const baselineRuns = priorRuns.filter((run) => runIsBaseline(run) && run.id !== currentRun.id);
  const lastBaseline = verdict === 'pass' ? currentRun : (baselineRuns.at(-1) ?? null);
  const hoursSinceBaseline =
    verdict === 'pass'
      ? 0
      : (nowMs - (lastBaseline === null ? activationMs : Date.parse(lastBaseline.created_at))) /
        3600000;

  const incidents = [];
  if (cron && expectedMs !== null && startedMs - expectedMs > QUEUE_DELAY_LIMIT_MS) {
    incidents.push({
      type: 'queue-delay',
      detail: `cycle started ${Math.round((startedMs - expectedMs) / 60000)}min after its scheduled slot (limit 60min)`,
    });
  } else if (!cron && queueDelayMs > QUEUE_DELAY_LIMIT_MS) {
    incidents.push({
      type: 'queue-delay',
      detail: `run queued ${Math.round(queueDelayMs / 60000)}min before start (limit 60min)`,
    });
  }
  for (const slot of missedSlots) {
    incidents.push({
      type: 'missed-slot',
      detail: `no scheduled run found for slot ${new Date(slot).toISOString()}`,
    });
  }
  if (consecutiveFailedCycles >= 2) {
    incidents.push({
      type: 'consecutive-failures',
      detail: `${consecutiveFailedCycles} successive scheduled cycles were failed or unknown`,
    });
  }
  if (hoursSinceBaseline >= STALE_BASELINE_HOURS) {
    incidents.push({
      type: 'stale-baseline',
      detail: `no valid complete baseline for ${hoursSinceBaseline.toFixed(1)}h (limit ${STALE_BASELINE_HOURS}h)`,
    });
  }

  const receipt = {
    schema: 'proto-ui/regression-cycle/v1',
    eventName: currentRun.event ?? null,
    policyActivatedAt: new Date(activationMs).toISOString(),
    sourceRevision: currentRun.head_sha,
    sourceRef: currentRun.head_branch ?? null,
    runId: currentRun.id,
    runAttempt: currentRun.run_attempt ?? null,
    scheduledSlot: cron
      ? { cron, label: slotLabelForCron(cron), expectedAt: new Date(expectedMs).toISOString() }
      : null,
    createdAt: new Date(createdMs).toISOString(),
    startedAt: new Date(startedMs).toISOString(),
    queueDelayMs,
    slotDelayMs,
    laneInventory: lanes,
    verdict,
    missedSlots: missedSlots.map((slot) => new Date(slot).toISOString()),
    consecutiveFailedCycles,
    consecutiveGreenCycles,
    lastBaseline,
    hoursSinceBaseline,
    incidents,
    examinedScheduleRuns: scheduleRuns.length,
  };
  return { receipt, verdict, incidents };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

export function emitAnnotations({ receipt, incidents }, out = console.log) {
  out(`::group::Regression cycle receipt`);
  out(
    `event=${receipt.eventName} sha=${receipt.sourceRevision} ` +
      `slot=${receipt.scheduledSlot?.label ?? 'manual'} verdict=${receipt.verdict}`
  );
  for (const [name, lane] of Object.entries(receipt.laneInventory)) {
    out(`  lane ${name}: ${lane.outcome} (${lane.rawResult})`);
  }
  out(`  queue delay: ${Math.round(receipt.queueDelayMs / 60000)}min`);
  if (receipt.slotDelayMs !== null) {
    out(`  slot delay: ${Math.round(receipt.slotDelayMs / 60000)}min`);
  }
  out(`::endgroup::`);
  for (const incident of incidents) {
    out(`::warning::[${incident.type}] ${incident.detail}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const env = process.env;
  const currentRunMeta = JSON.parse(readFileSync(args['current-run'], 'utf8'));
  const recentRunsJson = JSON.parse(readFileSync(args['recent-runs'], 'utf8'));
  const recentRuns = Array.isArray(recentRunsJson)
    ? recentRunsJson
    : (recentRunsJson.workflow_runs ?? []);
  const laneResults = JSON.parse(args.needs ?? env.CYCLE_NEEDS ?? '{}');
  const lanes = {};
  for (const [name, value] of Object.entries(laneResults)) {
    lanes[name] = value?.result ?? value;
  }
  const { receipt, verdict, incidents } = auditCycle({
    now: new Date().toISOString(),
    policyActivatedAt: env.CYCLE_POLICY_ACTIVATED_AT,
    cron: env.CYCLE_SCHEDULE || null,
    laneResults: lanes,
    currentRun: {
      id: currentRunMeta.id,
      head_sha: env.CYCLE_SHA ?? currentRunMeta.head_sha,
      head_branch: env.CYCLE_REF ?? currentRunMeta.head_branch,
      event: env.CYCLE_EVENT ?? currentRunMeta.event,
      run_attempt: Number(env.CYCLE_ATTEMPT ?? currentRunMeta.run_attempt ?? 1),
      created_at: currentRunMeta.created_at,
      run_started_at: currentRunMeta.run_started_at,
    },
    recentRuns,
  });
  writeFileSync(args.out, JSON.stringify(receipt, null, 2) + '\n');
  emitAnnotations({ receipt, incidents });
  // Fail closed on lane outcomes only. Queue/missed-slot incidents are
  // reported as annotations, never converted into a fabricated green.
  if (verdict !== 'pass') {
    console.error(
      `::error::regression cycle verdict is ${verdict}; a lane that never started is unknown, not passing`
    );
    process.exit(1);
  }
}
