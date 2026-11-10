import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import { reconcileCandidate, reconcileLedger } from './reconcile-native-gates.mjs';

const policy = parse(readFileSync(new URL('../../../internal/agent-operations/capability-policy.yaml', import.meta.url), 'utf8'));
const captured = JSON.parse(readFileSync(new URL('../../../internal/records/2026-11-10-issue-1137-native-gates.json', import.meta.url), 'utf8'));
const repository = 'Proto-UI/Proto-UI';
const api = `https://api.github.com/repos/${repository}`;
const actions = `https://github.com/${repository}/actions/runs/`;

// These provider responses are injected controls, never historical execution claims.
function injectedCandidate() {
  const headSha = '1'.repeat(40);
  const runId = 100;
  const suite = 200;
  const attempt = 2;
  const nativeJobNames = Array.from({ length: 8 }, (_, i) => `test-browser (${i + 1}/8, browser-${i + 1}-of-8)`);
  const requiredJobNames = ['test-general', 'test', 'public_package_build', ...nativeJobNames];
  const jobs = requiredJobNames.map((name, i) => ({
    id: 300 + i, name, run_id: runId, run_attempt: attempt, head_sha: headSha,
    run_url: `${api}/actions/runs/${runId}`,
    check_run_url: `${api}/check-runs/${300 + i}`,
    html_url: `${actions}${runId}/job/${300 + i}`,
    status: 'completed', conclusion: 'success',
  }));
  const checks = jobs.map((job) => ({
    id: job.id, url: job.check_run_url, head_sha: headSha, name: job.name,
    status: job.status, conclusion: job.conclusion, completed_at: '2026-10-07T12:00:00Z',
    details_url: job.html_url, check_suite: { id: suite },
    app: { id: 15368, slug: 'github-actions', node_id: 'injected-actions-provider' },
  }));
  checks.push({
    id: 999, url: `${api}/check-runs/999`, head_sha: headSha, name: 'DCO',
    status: 'completed', conclusion: 'success', completed_at: '2026-10-07T12:00:00Z',
    details_url: policy.trustedDcoEvidence.detailsUrl, check_suite: { id: 201 },
    app: { id: 1861, slug: 'dco', node_id: policy.trustedDcoEvidence.providerId },
  });
  return {
    id: 'injected', headSha, ciSelection: { runId, attempt }, requiredJobNames, nativeJobNames,
    evidence: {
      checks: { endpoint: `repos/${repository}/commits/${headSha}/check-runs?filter=all&per_page=100`, pages: [{ total_count: checks.length, check_runs: checks }] },
      runs: { endpoint: `repos/${repository}/actions/runs?head_sha=${headSha}&per_page=100`, pages: [{ total_count: 1, workflow_runs: [{
        id: runId, run_attempt: attempt, head_sha: headSha, name: 'CI', path: '.github/workflows/ci.yml',
        check_suite_id: suite, repository: { full_name: repository }, status: 'completed', conclusion: 'success',
      }] }] },
      statuses: { endpoint: `repos/${repository}/commits/${headSha}/statuses?per_page=100`, pages: [[]] },
      jobs: { endpoint: `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`, pages: [{ total_count: jobs.length, jobs }] },
    },
  };
}

function changeJob(candidate, name, conclusion) {
  const job = candidate.evidence.jobs.pages[0].jobs.find((row) => row.name === name);
  const check = candidate.evidence.checks.pages[0].check_runs.find((row) => row.id === job.id);
  job.conclusion = conclusion;
  check.conclusion = conclusion;
}

test('a complete injected exact-attempt inventory establishes only its declared CI and native outcomes', () => {
  const report = reconcileCandidate(injectedCandidate(), policy);
  assert.equal(report.ci, 'passed');
  assert.equal(report.native, 'passed');
  assert.equal(report.dco, 'success');
  assert.equal(report.jobs.filter((job) => job.name.startsWith('test-browser')).length, 8);
});

test('real captured original and successor heads retain separate outcomes', () => {
  const report = reconcileLedger(captured, policy);
  const byId = new Map(report.candidates.map((candidate) => [candidate.id, candidate]));
  assert.equal(byId.get('candidate').ci, 'unobserved');
  assert.equal(byId.get('candidate').native, 'unobserved');
  assert.equal(byId.get('candidate').dco, 'success');
  assert.equal(byId.get('candidateFinal').ci, 'passed');
  assert.equal(report.criteria[0].candidates[0], 'candidate');
  assert.equal(report.allSelectedCiGatesPassed, false);
  assert.equal(report.currentSourceAcceptanceClaimed, false);
});

test('eight real native shard successes do not erase failed general and aggregate gates or skipped package jobs', () => {
  const report = reconcileCandidate(captured.candidates.find((candidate) => candidate.id === 'fiveBoundary'), policy);
  assert.equal(report.runId, 37613588932);
  assert.equal(report.attempt, 2);
  assert.equal(report.native, 'passed');
  assert.equal(report.ci, 'failed');
  assert.equal(report.jobs.find((job) => job.name === 'test-general').state, 'failed');
  assert.equal(report.jobs.find((job) => job.name === 'test').state, 'failed');
  assert.equal(report.jobs.find((job) => job.name === 'public_package_build').state, 'skipped');
});

test('real merged package build and consumer successes do not erase failed native integration', () => {
  const report = reconcileCandidate(captured.candidates.find((candidate) => candidate.id === 'packageMerged'), policy);
  for (const name of ['type-check', 'public_package_build', 'release-stage', 'cli-smoke', 'release-consumer-react']) {
    assert.equal(report.jobs.find((job) => job.name === name).state, 'passed');
  }
  assert.equal(report.native, 'failed');
  assert.equal(report.ci, 'failed');
  assert.equal(report.dco, 'success');
});

test('a skipped native boundary remains unobserved even when the workflow aggregate is successful', () => {
  const candidate = injectedCandidate();
  changeJob(candidate, candidate.nativeJobNames[0], 'skipped');
  const report = reconcileCandidate(candidate, policy);
  assert.equal(report.native, 'unobserved');
  assert.equal(report.ci, 'unobserved');
});

test('a complete returned inventory cannot hide a missing required consumer boundary', () => {
  const candidate = injectedCandidate();
  const jobs = candidate.evidence.jobs.pages[0];
  jobs.jobs = jobs.jobs.filter((job) => job.name !== 'public_package_build');
  jobs.total_count--;
  const report = reconcileCandidate(candidate, policy);
  assert.equal(report.ci, 'unobserved');
  assert.equal(report.jobs.find((job) => job.name === 'public_package_build').state, 'missing');
});

test('truncated and duplicate provider inventories reject before producing gate conclusions', () => {
  const truncated = injectedCandidate();
  truncated.evidence.jobs.pages[0].jobs.pop();
  assert.throws(() => reconcileCandidate(truncated, policy), /incomplete provider inventory/);
  const duplicate = injectedCandidate();
  const page = duplicate.evidence.jobs.pages[0];
  page.jobs.push(structuredClone(page.jobs[0]));
  page.total_count++;
  assert.throws(() => reconcileCandidate(duplicate, policy), /duplicate provider identity/);
});

test('identical green names from another head, run attempt, suite, App or repository cannot supply the gate', () => {
  const mutations = [
    (candidate) => { candidate.evidence.checks.pages[0].check_runs[0].head_sha = '2'.repeat(40); },
    (candidate) => { candidate.evidence.jobs.pages[0].jobs[0].run_id++; },
    (candidate) => { candidate.evidence.jobs.pages[0].jobs[0].run_attempt--; },
    (candidate) => { candidate.evidence.checks.pages[0].check_runs[0].check_suite.id++; },
    (candidate) => { candidate.evidence.checks.pages[0].check_runs[0].app.id = 9999; },
    (candidate) => { candidate.evidence.runs.pages[0].workflow_runs[0].repository.full_name = 'another/repository'; },
    (candidate) => { candidate.evidence.runs.pages[0].workflow_runs[0].path = '.github/workflows/unrelated.yml'; },
  ];
  for (const mutate of mutations) {
    const candidate = injectedCandidate();
    mutate(candidate);
    assert.throws(() => reconcileCandidate(candidate, policy));
  }
});

test('job and native check disagreement is an evidence conflict rather than success', () => {
  const candidate = injectedCandidate();
  candidate.evidence.jobs.pages[0].jobs[0].conclusion = 'failure';
  assert.throws(() => reconcileCandidate(candidate, policy), /conclusion disagree/);
});

test('a DCO label from a different provider does not replace the real configured App', () => {
  const candidate = injectedCandidate();
  candidate.evidence.checks.pages[0].check_runs.at(-1).app.node_id = 'untrusted-provider';
  assert.equal(reconcileCandidate(candidate, policy).dco, 'unknown');
});

test('later successful source cannot replace the original criterion or drop a parent source condition', () => {
  const relabeled = structuredClone(captured);
  relabeled.criteria[0].candidateIds = ['candidateFinal'];
  assert.throws(() => reconcileLedger(relabeled, policy), /successor cannot replace/);
  const omitted = structuredClone(captured);
  omitted.criteria.pop();
  assert.throws(() => reconcileLedger(omitted, policy), /four original criteria/);
});
