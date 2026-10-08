import assert from 'node:assert/strict';
import { CONDITIONS, TASKS, schedule } from './batch-plan.mjs';

const outcomes = ['completed', 'failed', 'aborted', 'coordinator-failed', 'not-executed'];
const layerNames = ['platform', 'journey', 'proto', 'evidence', 'scope'];
const statuses = ['pass', 'fail', 'blocked', 'disputed', 'untested'];
const completeLayers = (row) =>
  layerNames.every((layer) =>
    statuses.every(
      (status) =>
        Number.isSafeInteger(row.assessment?.layers?.[layer]?.[status]) &&
        row.assessment.layers[layer][status] >= 0
    )
  );
const count = (rows, key, values) =>
  Object.fromEntries(values.map((v) => [v, rows.filter((r) => r[key] === v).length]));
function distribution(values) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    measured: values.length,
    min: sorted[0],
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    max: sorted.at(-1),
  };
}
/** Descriptive observed checks only: no semantic equivalence, full conformance,
 * causal value, first-pass success or provider origin admission from a label.
 */
export function batchReport({ plan, execution }) {
  assert.equal(execution.kind, 'proto-ui.noncompiler-candidate-execution');
  assert.ok(
    ['synthetic-controls', 'provider-attempts-unreviewed'].includes(execution.executionClass)
  );
  assert.ok(
    Number.isSafeInteger(execution.attemptsReserved) &&
      execution.attemptsReserved >= 0 &&
      execution.attemptsReserved <= plan.controls.attemptCap
  );
  const reserved = execution.results.filter((r) => r.reservation !== null);
  assert.deepEqual(
    reserved.map((r) => r.reservation),
    Array.from({ length: execution.attemptsReserved }, (_, i) => i + 1),
    'Reservation count/order differs'
  );
  assert.equal(
    execution.results.length,
    schedule(plan.stage).length,
    'All planned slots must be represented'
  );
  for (let i = 0; i < plan.runs.length; i++) {
    const row = execution.results[i];
    for (const key of ['id', 'task', 'condition', 'repetition', 'requestSha256'])
      assert.equal(row[key], plan.runs[i][key], 'Run binding mismatch');
    assert.ok(outcomes.includes(row.participantOutcome), 'Unknown outcome');
    assert.equal(typeof row.participantInvoked, 'boolean');
    if (row.participantInvoked)
      assert.ok(row.reservation !== null, 'Invocation without reservation');
    if (row.participantOutcome === 'not-executed') assert.equal(row.participantInvoked, false);
    if (row.assessment)
      assert.equal(row.participantOutcome, 'completed', 'Assessment without completed submission');
    if (row.receipt)
      assert.equal(row.receipt.requestSha256, row.requestSha256, 'Receipt binding mismatch');
  }
  const cells = [];
  for (const task of TASKS)
    for (const condition of CONDITIONS) {
      const rows = execution.results.filter((r) => r.task === task && r.condition === condition);
      const assessed = rows.filter((r) => r.assessment?.status === 'candidate-observations');
      const complete = assessed.filter(completeLayers);
      const layers =
        assessed.length && complete.length === assessed.length
          ? Object.fromEntries(
              layerNames.map((layer) => [
                layer,
                Object.fromEntries(
                  statuses.map((status) => [
                    status,
                    complete.reduce((sum, r) => sum + r.assessment.layers[layer][status], 0),
                  ])
                ),
              ])
            )
          : null;
      const tokenRows = rows.filter(
        (r) => r.receipt?.usage?.status === 'provider-reported-unverified'
      );
      const measuredTokens = tokenRows.filter((r) =>
        ['input_tokens', 'output_tokens'].every(
          (field) =>
            Number.isSafeInteger(r.receipt.usage.value?.[field]) &&
            r.receipt.usage.value[field] >= 0
        )
      );
      const duration = rows
        .filter((r) => r.receipt)
        .map((r) => Date.parse(r.receipt.finished) - Date.parse(r.receipt.started))
        .filter((v) => Number.isFinite(v) && v >= 0);
      const proposals = rows.filter((r) => r.assessment?.status === 'proposal-structure-valid');
      cells.push({
        task,
        condition,
        planned: rows.length,
        outcomes: count(rows, 'participantOutcome', outcomes),
        assessmentCoverage: {
          candidateBrowserObservations: assessed.length,
          completeBrowserSummaries: complete.length,
          incompleteBrowserSummaries: assessed.length - complete.length,
          validProposalStructures: proposals.length,
          unavailableOrUnassessed: rows.length - assessed.length - proposals.length,
        },
        layers,
        layerMeaning:
          'Counts of repeated candidate check observations, not independent semantic properties or a conformance score',
        proposalCounts:
          task === 'discovery'
            ? distribution(proposals.map((r) => r.assessment.proposedProperties))
            : null,
        discoveryCategories: null,
        discoveryCategoriesReason: 'Independent semantic crosswalk not available',
        requestWallMs: distribution(duration),
        tokens: {
          status: measuredTokens.length ? 'partial-provider-reported-unverified' : 'unavailable',
          measuredRequests: measuredTokens.length,
          plannedRequestsWithoutVerifiedCounts: rows.length - measuredTokens.length,
          input: measuredTokens.length
            ? measuredTokens.reduce((sum, r) => sum + r.receipt.usage.value.input_tokens, 0)
            : null,
          output: measuredTokens.length
            ? measuredTokens.reduce((sum, r) => sum + r.receipt.usage.value.output_tokens, 0)
            : null,
        },
        cost: {
          status: 'unavailable',
          amount: null,
          reason: 'No verified rate, billing scope or receipt; token totals are not money',
        },
      });
    }
  const clusters = new Map();
  for (const row of execution.results)
    for (const check of row.assessment?.checks ?? []) {
      if (check.status !== 'fail') continue;
      const key = `${row.task}/${row.condition}/${check.layer}/${check.id}`;
      if (!clusters.has(key))
        clusters.set(key, {
          task: row.task,
          condition: row.condition,
          layer: check.layer,
          check: check.id,
          runs: [],
        });
      clusters.get(key).runs.push(row.id);
    }
  const duplicates = new Map();
  for (const row of execution.results)
    if (row.textSha256) {
      if (!duplicates.has(row.textSha256)) duplicates.set(row.textSha256, []);
      duplicates.get(row.textSha256).push(row.id);
    }
  return {
    schemaVersion: 1,
    kind: 'proto-ui.noncompiler-descriptive-candidate-report',
    admission: 'not-admitted',
    executionClass: execution.executionClass,
    realModelRuns: execution.executionClass === 'synthetic-controls' ? 0 : null,
    realModelRunsReason:
      'Synthetic controls are not model outputs; other origin claims require independent provenance verification',
    planSha256: execution.planSha256,
    plannedRuns: plan.runs.length,
    attemptsReserved: execution.attemptsReserved,
    participantInvocations: execution.results.filter((r) => r.participantInvoked === true).length,
    formalCompletion: false,
    modelSnapshot: null,
    cells,
    failedCheckClusters: [...clusters.values()],
    identicalOutputGroups: [...duplicates]
      .filter(([, runs]) => runs.length > 1)
      .map(([sha256, runs]) => ({ sha256, runs })),
    identicalOutputMeaning:
      'Exact byte identity only; not semantic agreement, independence or cache proof',
    limitations: plan.limitations,
    pending: [
      'Fresh independent oracle/executor/semantic review',
      'Authorized real provider and enforceable billing cap',
      'Real Round0 then policy freeze',
      'Real repeated first batch; #734 broader skill/example/controls scope remains',
    ],
  };
}
