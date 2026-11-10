import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  APPLE_PLATFORMS,
  classifyArticlePlatform,
  createHigComparison,
} from '../hig-comparison.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = (relative) => JSON.parse(readFileSync(new URL(relative, new URL('../../../', import.meta.url)), 'utf8'));
const reconciliation = json('internal/records/2026-11-10-apple-hig-source-reconciliation.json');
const review = json(reconciliation.inputs.review.path);
const carrier = json(reconciliation.inputs.carrier.path);
const issue = json(reconciliation.inputs.issueLedger.path).issueSnapshot.issues.find((entry) => entry.number === 864);
const inputs = { reconciliation, review, carrier, issue };
const report = (view = 'reconciled') => createHigComparison({ ...inputs, view });
const row = (comparison, slug) => comparison.rows.find((entry) => entry.sourceKey === `hig:${slug}`);
const scope = (comparison, slug, platform) => classifyArticlePlatform(row(comparison, slug), platform);

function cli(...args) {
  return spawnSync(process.execPath, ['scripts/docs/hig-comparison.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

test('comparison conserves every original row, Issue condition and parent source record', () => {
  const comparison = report();
  assert.deepEqual(comparison.rows.map((entry) => entry.original), review.rows);
  assert.equal(comparison.rows.length, 158);
  const originalParents = carrier.originalDebtSnapshot.records.filter((entry) => entry.kind === 'hig-topic');
  for (const entry of comparison.rows) {
    assert.deepEqual(
      { ...entry.parentCondition, completeOriginalStructuredRow: entry.original },
      originalParents.find((parent) => parent.key === entry.sourceKey)
    );
  }
  assert.equal(comparison.rows.filter((entry) => entry.parentCondition.requiresFollowupCheckbox).length, 82);
  const recoveredCriteria = [...comparison.originalCompletionCriteria, ...comparison.rows.map((entry) => entry.issueCriterion)];
  assert.deepEqual(new Map(recoveredCriteria.map((entry) => [entry.key, entry])), new Map(issue.criteria.map((entry) => [entry.key, entry])));
  assert.equal(recoveredCriteria.length, 163);
  const parentKeys = new Set([
    ...comparison.rows.map((entry) => entry.parentCondition.key),
    ...comparison.parentDiscussionConditions.map((entry) => entry.key),
  ]);
  const originalKeys = new Set([
    ...carrier.originalDebtSnapshot.records,
    ...carrier.firstRefreshRecords,
    ...carrier.finalPostmergeRecords,
  ].filter((entry) => entry.pr === 869 || entry.kind === 'historical-source-drift').map((entry) => entry.key));
  assert.deepEqual(parentKeys, originalKeys);
  assert.deepEqual(comparison.originalCoverage, review.coverage);
  assert.deepEqual(comparison.parentCrossCuttingCriteria, carrier.originalDebtSnapshot.higCrossCuttingCriteria);
  assert.deepEqual(comparison.sourceDriftObservations, review.sourceDriftObservations);
});

test('article-platform consumer recovers both explicit affirmations and exclusions from real retained summaries', () => {
  const before = report('historical');
  const after = report();
  // This is the retained source-data control, not an executed historical product failure.
  for (const [slug, platform, disposition] of [
    ['airplay', 'watchOS', 'excluded'],
    ['always-on', 'watchOS', 'affirmed'],
    ['always-on', 'macOS', 'excluded'],
    ['apple-pay', 'macOS', 'affirmed'],
    ['apple-pay', 'tvOS', 'excluded'],
    ['complications', 'watchOS', 'affirmed'],
    ['complications', 'iOS', 'excluded'],
    ['top-shelf', 'tvOS', 'affirmed'],
    ['top-shelf', 'macOS', 'excluded'],
    ['widgets', 'visionOS', 'affirmed'],
    ['widgets', 'tvOS', 'excluded'],
  ]) {
    assert.notEqual(scope(before, slug, platform).disposition, disposition, `${slug}/${platform} historical loss control`);
    assert.equal(scope(after, slug, platform).disposition, disposition, `${slug}/${platform}`);
  }
  const changedExclusions = after.rows.filter((entry) => entry.appleArticleScope.excludedPlatforms.length > entry.original.applePlatformScope.excludedPlatforms.length);
  assert.equal(changedExclusions.length, 27, 'Account for every topic named by the retained27-topic finding');
  assert.equal(row(after, 'airplay').original.source.bodySha256, row(before, 'airplay').original.source.bodySha256);
});

test('qualified article capabilities stay separate and section mentions never become support', () => {
  const comparison = report();
  for (const [slug, platform] of [
    ['game-center', 'watchOS'],
    ['live-photos', 'visionOS'],
    ['maps', 'watchOS'],
    ['live-activities', 'macOS'],
    ['live-activities', 'watchOS'],
    ['nfc', 'iPadOS'],
  ]) {
    const result = scope(comparison, slug, platform);
    assert.equal(result.disposition, 'qualified');
    assert.equal(result.affirmed, false);
    assert.equal(result.excluded, false);
    assert.ok(result.qualifications.length > 0);
  }
  const shortcuts = scope(comparison, 'app-shortcuts', 'macOS');
  assert.equal(shortcuts.disposition, 'excluded');
  assert.ok(shortcuts.qualifications.length > 0, 'Related App Intents facts survive exclusion of the App Shortcuts subject');
  assert.equal(scope(comparison, 'wallet', 'iPadOS').disposition, 'mentioned-only');
  for (const platform of APPLE_PLATFORMS) {
    assert.equal(scope(comparison, 'siri', platform).disposition, 'unknown');
    assert.equal(scope(comparison, 'generative-ai', platform).affirmed, false);
  }
  for (const entry of comparison.rows) {
    for (const platform of APPLE_PLATFORMS) {
      const result = classifyArticlePlatform(entry, platform);
      assert.equal(result.protoSupport, 'not-established');
      assert.equal(result.currentRuntimeResult, 'not-run');
    }
  }
  assert.equal(comparison.currentEvidence.completeArticleRuntimeVerified, 0);
  assert.equal(comparison.currentEvidence.appleNativeOrAssistiveTechnologyCertification, false);
});

test('source-data admission rejects dropped conditions, changed summaries and conflicting scope', () => {
  // These are explicitly injected negative inputs, not observations about the product or Apple.
  const missingTopic = structuredClone(inputs);
  missingTopic.carrier.originalDebtSnapshot.records = missingTopic.carrier.originalDebtSnapshot.records.filter((entry) => entry.key !== 'hig:labels');
  assert.throws(() => createHigComparison(missingTopic), /Every original parent topic/);
  const changedCondition = structuredClone(inputs);
  changedCondition.carrier.originalDebtSnapshot.records.find((entry) => entry.key === 'hig:labels').requiresFollowupCheckbox = false;
  assert.throws(() => createHigComparison(changedCondition));
  const wrongSummary = structuredClone(inputs);
  wrongSummary.reconciliation.platformCorrections[0].sourceSummary += ' changed';
  assert.throws(() => createHigComparison(wrongSummary), /Changed platform summary/);
  const conflict = structuredClone(inputs);
  conflict.reconciliation.platformCorrections[0].affirmedPlatforms.push('watchOS');
  assert.throws(() => createHigComparison(conflict), /Conflicting article scope/);
  const wrongCriterion = structuredClone(inputs);
  wrongCriterion.reconciliation.topics.find((entry) => entry.sourceKey === 'hig:labels').issueCriterionKey = 'issue.864.001';
  assert.throws(() => createHigComparison(wrongCriterion), /Issue criterion mismatch/);
});

test('actual CLI emits both source views with complete JSON and current source metadata', () => {
  for (const view of ['historical', 'reconciled']) {
    const result = cli('--view', view, '--platform', 'watchOS', '--format', 'json');
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const comparison = JSON.parse(result.stdout);
    assert.equal(comparison.rows.length, 158);
    assert.equal(comparison.platformTriage.length, 158);
    assert.equal(comparison.readback.sources.length, 143);
    assert.deepEqual(new Set(comparison.platformTriage.map((entry) => entry.sourceKey)), new Set(comparison.rows.map((entry) => entry.sourceKey)));
    assert.equal(comparison.view, view);
    assert.equal(scope(comparison, 'always-on', 'watchOS').affirmed, view === 'reconciled');
    assert.equal(scope(comparison, 'airplay', 'watchOS').excluded, view === 'reconciled');
    assert.equal(comparison.currentEvidence.result, 'not-run');
    for (const source of comparison.readback.sources) {
      assert.ok(['present', 'missing'].includes(source.state));
      assert.equal(source.sha256 === null, source.state === 'missing');
    }
  }
});

test('actual Markdown consumer keeps every topic in an intact six-column row', () => {
  const result = cli('--format', 'markdown');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const topicRows = result.stdout.split('\n').filter((line) => line.startsWith('| ['));
  assert.equal(topicRows.length, 158);
  const emittedKeys = new Set();
  for (const line of topicRows) {
    assert.equal(line.match(/(?<!\\)\|/g).length, 7, 'A source pipe or newline must not split the comparison columns');
    emittedKeys.add(line.match(/`(hig:[a-z0-9-]+)`/)[1]);
  }
  assert.deepEqual(emittedKeys, new Set(reconciliation.topics.map((entry) => entry.sourceKey)));
});

test('CLI rejects invalid triage and output requests without a partial report', () => {
  for (const args of [
    ['--platform', 'unlisted-platform'],
    ['--format', 'markdown', '--platform', 'iOS'],
    ['--view', 'unlisted-view'],
    ['--format'],
  ]) {
    const result = cli(...args);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  }
});
