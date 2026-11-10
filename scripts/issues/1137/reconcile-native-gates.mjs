import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { summarizeLiveDco } from '../../agent-operations/collect-live-review-input.mjs';

const REPOSITORY = 'Proto-UI/Proto-UI';
const REPOSITORY_ID = `github.com:${REPOSITORY}`;
const API_PREFIX = `https://api.github.com/repos/${REPOSITORY}`;
const ACTIONS_PREFIX = `https://github.com/${REPOSITORY}/actions/runs/`;
const FAILED = new Set(['failure', 'error', 'timed_out', 'action_required', 'cancelled', 'startup_failure']);

function inventory(snapshot, field, endpoint) {
  assert.equal(snapshot.endpoint, endpoint, 'provider endpoint does not bind the requested source');
  assert.ok(Array.isArray(snapshot.pages) && snapshot.pages.length > 0, 'missing provider pages');
  const rows = snapshot.pages.flatMap((page) => (field ? page[field] : page));
  assert.ok(rows.every((row) => Number.isSafeInteger(row.id) && row.id > 0), 'missing provider identity');
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'duplicate provider identity');
  if (field) {
    const total = snapshot.pages[0].total_count;
    assert.ok(Number.isSafeInteger(total) && total >= 0, 'missing independent inventory total');
    assert.ok(snapshot.pages.every((page) => page.total_count === total), 'inventory total changed between pages');
    assert.equal(rows.length, total, 'incomplete provider inventory');
  } else {
    assert.ok(snapshot.pages.at(-1).length < 100, 'status pagination has no bounded terminal page');
  }
  return rows;
}

function state(job) {
  if (!job) return 'missing';
  if (job.status !== 'completed') return 'pending';
  if (job.conclusion === 'success') return 'passed';
  if (FAILED.has(job.conclusion)) return 'failed';
  if (job.conclusion === 'skipped' || job.conclusion === 'neutral') return 'skipped';
  return 'unknown';
}

function combine(states) {
  if (states.includes('failed')) return 'failed';
  if (states.includes('missing')) return 'unobserved';
  if (states.includes('pending')) return 'pending';
  if (states.includes('unknown')) return 'unknown';
  if (states.includes('skipped')) return 'unobserved';
  return states.length > 0 ? 'passed' : 'unobserved';
}

function canonicalCheck(check) {
  return {
    name: check.name,
    status: check.status.toUpperCase(),
    conclusion: check.conclusion?.toUpperCase() ?? null,
    completedAt: check.completed_at,
    detailsUrl: check.details_url,
    source: check.app.slug,
    providerId: check.app.node_id,
    repository: REPOSITORY,
    workflowName: null,
    workflowPath: null,
  };
}

export function reconcileCandidate(candidate, policy) {
  const { headSha, evidence } = candidate;
  assert.match(headSha, /^[a-f0-9]{40}$/);
  assert.equal(policy.trustedDcoEvidence.repositoryId, REPOSITORY_ID);
  const checks = inventory(evidence.checks, 'check_runs',
    `repos/${REPOSITORY}/commits/${headSha}/check-runs?filter=all&per_page=100`);
  const runs = inventory(evidence.runs, 'workflow_runs',
    `repos/${REPOSITORY}/actions/runs?head_sha=${headSha}&per_page=100`);
  const statuses = inventory(evidence.statuses, null,
    `repos/${REPOSITORY}/commits/${headSha}/statuses?per_page=100`);
  for (const check of checks) assert.equal(check.head_sha, headSha, 'check belongs to another head');
  for (const run of runs) {
    assert.equal(run.head_sha, headSha, 'workflow belongs to another head');
    assert.equal(run.repository.full_name, REPOSITORY, 'workflow belongs to another repository');
  }
  const trustedDco = policy.trustedDcoEvidence;
  const dco = summarizeLiveDco(checks.map(canonicalCheck), {
    repositoryId: REPOSITORY_ID,
    trustedRepositoryId: trustedDco.repositoryId,
    trustedCheckName: trustedDco.checkName,
    trustedSource: trustedDco.source,
    trustedProviderId: trustedDco.providerId,
    trustedDetailsUrl: trustedDco.detailsUrl,
  });
  const latestStatuses = new Map();
  for (const status of [...statuses].sort((a, b) => b.id - a.id)) {
    if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
  }
  const externalStatuses = [...latestStatuses.values()].map((status) => ({
    id: status.id, name: status.context, state: status.state,
    actor: status.creator.login, url: status.target_url,
  }));
  const ciRuns = runs.filter((run) => run.name === 'CI' && run.path === '.github/workflows/ci.yml');
  const otherWorkflowFailures = runs.filter((run) => FAILED.has(run.conclusion) && !ciRuns.includes(run))
    .map((run) => ({ id: run.id, attempt: run.run_attempt, name: run.name, conclusion: run.conclusion }));
  if (candidate.ciSelection === null) {
    assert.equal(ciRuns.length, 0, 'an unselected CI run requires explicit reconciliation');
    assert.equal(evidence.jobs, null, 'jobs cannot establish an absent CI run');
    return { id: candidate.id, headSha, dco, ci: 'unobserved', native: 'unobserved',
      jobs: [], externalStatuses, otherWorkflowFailures };
  }
  const selection = candidate.ciSelection;
  const matchingRuns = ciRuns.filter((run) => run.id === selection.runId && run.run_attempt === selection.attempt);
  assert.equal(matchingRuns.length, 1, 'exact CI run and attempt are unavailable');
  const run = matchingRuns[0];
  const jobs = inventory(evidence.jobs, 'jobs',
    `repos/${REPOSITORY}/actions/runs/${run.id}/attempts/${selection.attempt}/jobs?per_page=100`);
  assert.equal(new Set(jobs.map((job) => job.name)).size, jobs.length, 'ambiguous job name');
  for (const job of jobs) {
    assert.equal(job.run_id, run.id, 'job belongs to another run');
    assert.equal(job.run_attempt, selection.attempt, 'job belongs to another attempt');
    assert.equal(job.head_sha, headSha, 'job belongs to another head');
    assert.equal(job.run_url, `${API_PREFIX}/actions/runs/${run.id}`, 'job repository is unbound');
    assert.equal(job.html_url, `${ACTIONS_PREFIX}${run.id}/job/${job.id}`, 'job URL is unbound');
    const matches = checks.filter((check) => check.url === job.check_run_url);
    assert.equal(matches.length, 1, 'job has no unique native App check');
    const check = matches[0];
    assert.equal(check.id, job.id, 'job and native check identities differ');
    assert.equal(check.name, job.name, 'job and native check names differ');
    assert.equal(check.check_suite.id, run.check_suite_id, 'job belongs to another workflow suite');
    assert.equal(check.app.id, 15368, 'job is not supplied by the GitHub Actions App');
    assert.equal(check.app.slug, policy.trustedCiEvidence.source, 'job provider source differs');
    assert.equal(check.details_url, job.html_url, 'native check is not bound to the job URL');
    assert.equal(check.status, job.status, 'job and native check status disagree');
    assert.equal(check.conclusion, job.conclusion, 'job and native check conclusion disagree');
  }
  assert.ok(candidate.requiredJobNames.length > 0, 'required hosted boundary inventory is empty');
  assert.equal(new Set(candidate.requiredJobNames).size, candidate.requiredJobNames.length);
  assert.ok(candidate.nativeJobNames.length > 0, 'native boundary inventory is empty');
  for (const name of candidate.nativeJobNames) {
    assert.ok(candidate.requiredJobNames.includes(name), 'native boundary is absent from the required inventory');
  }
  const jobMap = new Map(jobs.map((job) => [job.name, job]));
  const projected = candidate.requiredJobNames.map((name) => {
    const job = jobMap.get(name);
    return { name, state: state(job), id: job?.id ?? null, url: job?.html_url ?? null };
  });
  const native = combine(candidate.nativeJobNames.map((name) => state(jobMap.get(name))));
  const requiredStates = projected.map((job) => job.state);
  const ci = combine([...requiredStates, state(run), ...jobs.map(state)]);
  return { id: candidate.id, headSha, runId: run.id, attempt: selection.attempt,
    dco, ci, native, jobs: projected, externalStatuses, otherWorkflowFailures };
}

export function reconcileLedger(ledger, policy) {
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.repositoryId, REPOSITORY_ID);
  assert.equal(ledger.issue, 1137);
  assert.deepEqual(ledger.criteria.map((row) => row.key), [
    'issue.1137.001', 'issue.1137.002', 'issue.1137.003', 'issue.1137.004',
  ], 'all four original criteria must be retained in order');
  assert.deepEqual(ledger.criteria.map((row) => row.parentSourceKey), [
    'issue.1088.003', 'issue.1088.005', 'issue.1088.007', 'issue.1088.008',
  ], 'original parent source keys must be preserved');
  const identities = ledger.candidates.map((candidate) => candidate.id);
  assert.equal(new Set(identities).size, identities.length, 'duplicate candidate reference');
  const candidates = ledger.candidates.map((candidate) => reconcileCandidate(candidate, policy));
  for (const criterion of ledger.criteria) {
    assert.ok(criterion.candidateIds.length > 0, 'criterion has no bound original candidate');
    for (const id of criterion.candidateIds) assert.ok(identities.includes(id), 'unknown candidate reference');
    const original = ledger.candidates.find((candidate) => candidate.id === criterion.candidateIds[0]);
    assert.equal(original.headSha, criterion.originalHeadSha, 'a successor cannot replace the original candidate');
  }
  return {
    schemaVersion: 1, kind: 'proto-ui.issue-1137-gate-reconciliation',
    evidenceScope: 'Captured historical provider metadata; no product execution or acceptance approval.',
    currentSourceAcceptanceClaimed: false,
    allSelectedCiGatesPassed: candidates.every((candidate) => candidate.ci === 'passed' &&
      candidate.native === 'passed' && candidate.dco === 'success'),
    criteria: ledger.criteria.map(({ key, parentSourceKey, original, candidateIds }) => ({
      key, parentSourceKey, original, candidates: candidateIds,
    })),
    candidates,
  };
}

async function main() {
  const input = process.argv[2] ?? new URL('../../../internal/records/2026-11-10-issue-1137-native-gates.json', import.meta.url);
  const policyPath = new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url);
  const ledger = JSON.parse(await readFile(input, 'utf8'));
  const policy = parse(await readFile(policyPath, 'utf8'));
  const report = reconcileLedger(ledger, policy);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.allSelectedCiGatesPassed ? 0 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
