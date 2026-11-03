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
//
// Slot attribution of the scheduled history comes from the native run name:
// a scheduled cycle is named `regression-cycle:<cron>`, and that declared cron
// is the only authority for the slot a run belongs to. A run whose name is
// missing or declares an unknown cron has an UNKNOWN slot: it never occupies
// a slot, it is never guessed from its creation time, and it is reported
// explicitly.

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

// Native run-name prefix that carries the declared cron of a scheduled cycle.
const RUN_NAME_PREFIX = 'regression-cycle:';

export function slotLabelForCron(cron) {
  return EXPECTED_CRONS[cron] ?? null;
}

// The declared cron of a native run name, or null together with the reason
// why the attribution is unknown. Only the declared EXPECTED_CRONS are valid.
function parseDeclaredCron(displayTitle) {
  if (typeof displayTitle !== 'string' || !displayTitle.startsWith(RUN_NAME_PREFIX)) {
    return { cron: null, reason: 'missing-declared-cron' };
  }
  const cron = displayTitle.slice(RUN_NAME_PREFIX.length).trim();
  if (!Object.hasOwn(EXPECTED_CRONS, cron)) return { cron: null, reason: 'undeclared-cron' };
  return { cron, reason: null };
}

// The intended UTC slot of a declared cron relative to a creation instant:
// the slot hour of that UTC day, rolled back one day when the instant is
// still before the slot. This is the same convention the current cycle uses
// for its own cron binding, so a cycle created long after its slot keeps the
// slot it declared.
function expectedSlotForCron(cron, createdMs) {
  const hour = Number(cron.split(' ')[1]);
  const created = new Date(createdMs);
  let slot = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate(), hour);
  if (slot > createdMs) slot -= 86400000;
  return slot;
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
  // The current cycle keeps its cron binding: the schedule that triggered it.
  // A delayed 08:00 cron created after 16:00 still belongs to the 08:00 slot.
  const expectedMs = cron ? expectedSlotForCron(cron, createdMs) : null;
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
  //
  // Each run is attributed to the slot its native run name declares, never to
  // the slot its creation instant happens to fall near: a 08:00 cycle that
  // was created at 16:30 still occupies the 08:00 slot and must not occupy
  // or reorder behind the 16:00 cycle.
  const scheduleRuns = (recentRuns ?? [])
    .filter(
      (run) =>
        run.event === 'schedule' &&
        Date.parse(run.created_at) >= activationMs &&
        Date.parse(run.created_at) <= nowMs &&
        run.id !== currentRun.id
    )
    .map((run) => {
      const declared = parseDeclaredCron(run.display_title);
      const slotMs = declared.cron
        ? expectedSlotForCron(declared.cron, Date.parse(run.created_at))
        : null;
      return {
        run,
        cron: declared.cron,
        slotMs,
        unknownReason: declared.reason,
        // Chronological position of the cycle: the declared slot when it is
        // known, otherwise the observed creation instant. An unknown
        // attribution is never turned into a slot.
        cycleTimeMs: slotMs ?? Date.parse(run.created_at),
      };
    })
    .sort(
      (a, b) =>
        a.cycleTimeMs - b.cycleTimeMs ||
        Date.parse(a.run.created_at) - Date.parse(b.run.created_at) ||
        (a.run.id < b.run.id ? -1 : a.run.id > b.run.id ? 1 : 0)
    );
  // The current cycle occupies the slot its own cron binding names. A manual
  // cycle has no slot at all and never stands in for a scheduled slot.
  const currentSlotMs = currentRun.event === 'schedule' ? expectedMs : null;
  const occupiedSlotTimes = [
    ...scheduleRuns.filter((entry) => entry.slotMs !== null).map((entry) => entry.slotMs),
    ...(currentSlotMs === null ? [] : [currentSlotMs]),
  ];

  // The producer supplies complete post-activation history or fails closed.
  // A hundred observed runs must not hide earlier genuinely missed slots.
  // A run without a declared slot covers nothing.
  const missedSlots = expectedSlotsBetween(activationMs, nowMs - SLOT_GRACE_MS).filter(
    (slot) => !occupiedSlotTimes.some((occupied) => Math.abs(occupied - slot) <= SLOT_GRACE_MS)
  );

  // Non-green chains: anything that is not a completed-successful cycle —
  // failures, timeouts, cancellations, queued/in_progress runs (unknown) and
  // runs with no recorded conclusion — counts as non-green, including the
  // current cycle itself.
  let consecutiveFailedCycles = 0;
  let consecutiveGreenCycles = 0;
  // Prior cycles are the ones that precede the current cycle in slot order,
  // not in creation order: a cycle that was created late still precedes every
  // cycle of a later slot.
  const priorBoundMs = currentSlotMs ?? createdMs;
  const priorRuns = scheduleRuns.filter((entry) =>
    entry.slotMs !== null
      ? entry.cycleTimeMs <= priorBoundMs
      : Date.parse(entry.run.created_at) <= createdMs
  );
  const scheduledVerdicts = priorRuns.map(
    (entry) => entry.slotMs !== null && runIsBaseline(entry.run)
  );
  if (currentRun.event === 'schedule') scheduledVerdicts.push(verdict === 'pass');
  const latestGreen = scheduledVerdicts.at(-1);
  for (const green of scheduledVerdicts.reverse()) {
    if (green !== latestGreen) break;
    if (green) consecutiveGreenCycles++;
    else consecutiveFailedCycles++;
  }

  const baselineRuns = priorRuns.filter(
    (entry) => entry.slotMs !== null && runIsBaseline(entry.run) && entry.run.id !== currentRun.id
  );
  const lastBaselineEntry = baselineRuns.at(-1) ?? null;
  const lastBaseline = verdict === 'pass' ? currentRun : (lastBaselineEntry?.run ?? null);
  const hoursSinceBaseline =
    verdict === 'pass'
      ? 0
      : (nowMs -
          (lastBaselineEntry === null
            ? activationMs
            : Date.parse(lastBaselineEntry.run.created_at))) /
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
      detail: `no scheduled run with a declared cron slot found for slot ${new Date(slot).toISOString()}`,
    });
  }
  // Scheduled runs whose native run name declares no known cron have an
  // unknown slot: they never occupy a slot and are never taken for one.
  const unknownAttribution = scheduleRuns.filter((entry) => entry.slotMs === null);
  if (unknownAttribution.length > 0) {
    incidents.push({
      type: 'unknown-attribution',
      detail:
        `${unknownAttribution.length} scheduled run(s) declare no known cron slot ` +
        `(${unknownAttribution
          .map((entry) => `#${entry.run.id} ${entry.run.created_at} ${entry.unknownReason}`)
          .join(', ')}); their slot coverage is unknown`,
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
