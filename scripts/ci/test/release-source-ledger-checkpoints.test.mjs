import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourcePath = 'internal/governance/release-0.3-source-ledger.json';
const sourceBytes = readFileSync(new URL('../../../' + sourcePath, import.meta.url));
const ledger = JSON.parse(sourceBytes);
const companion = JSON.parse(
  readFileSync(
    new URL('../../../internal/governance/release-0.3-evidence-checkpoints.json', import.meta.url),
    'utf8'
  )
);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const sourceGitBlob = createHash('sha1')
  .update(Buffer.from(`blob ${sourceBytes.length}\0`))
  .update(sourceBytes)
  .digest('hex');
function companionErrors(value) {
  const errors = [];
  if (value.schemaVersion !== 1 || value.kind !== 'additive-evidence-checkpoints')
    errors.push('companion-kind');
  if (
    value.sourceLedger?.path !== sourcePath ||
    value.sourceLedger.gitBlob !== sourceGitBlob ||
    value.sourceLedger.sha256 !== sourceSha256 ||
    value.sourceLedger.sourceRevision !== ledger.sourceRevision
  )
    errors.push('snapshot-binding');
  if (!value.authority || !Array.isArray(value.liveCheckpoints)) errors.push('companion-shape');
  if (Object.keys(ledger).includes('liveCheckpoints')) errors.push('duplicate-completion-source');
  return errors;
}
const originalFields = [
  'schemaVersion',
  'capturedAt',
  'sourceRevision',
  'policy',
  'warning',
  'families',
  'cliRegistry',
  'finfSource',
  'deliverySource',
  'issueSnapshot',
];
const targetKeys = [
  'checkpoint.1073.20261104.finite-scroll-padding',
  'checkpoint.1191.20261104.navigation-scroll-diagnostic',
];
const sourceIssues = new Map(ledger.issueSnapshot.issues.map((issue) => [issue.number, issue]));

// This validates additive live evidence without recasting the captured source
// snapshot as a current acceptance result. New checkpoints may be appended.
// A new source inventory needs a separately versioned snapshot, not a quiet
// rewrite of the original fields or this historical identity.
function checkpointErrors(checkpoints) {
  const errors = [];
  const keys = new Set();
  for (const point of checkpoints) {
    if (!point.key || keys.has(point.key)) errors.push('checkpoint-key');
    keys.add(point.key);
    const source = sourceIssues.get(point.issueNumber);
    if (
      !source ||
      point.sourceIssue !== source.url ||
      point.sourceSnapshotBodySha256 !== source.sourceBodySha256
    )
      errors.push('source-binding');
    const criteria = new Set(source?.criteria.map((criterion) => criterion.key));
    if (
      !Array.isArray(point.sourceCriterionKeys) ||
      point.sourceCriterionKeys.some((key) => !criteria.has(key))
    )
      errors.push('criterion-binding');
    if (
      !['0.3', '0.4', 'split', 'criterion-split'].includes(point.release) ||
      !Number.isFinite(Date.parse(point.recordedAt))
    )
      errors.push('release-time');
    if (!point.scope || !point.reason || !point.nextAction) errors.push('bounded-scope');
    if (!point.developmentOwner?.login || !point.developmentOwner.evidenceUrls?.length)
      errors.push('development-owner');
    if (
      !['unverified', 'verified'].includes(point.acceptanceOwner?.status) ||
      (point.acceptanceOwner.status === 'unverified' && !point.acceptanceOwner.nextAction)
    )
      errors.push('acceptance-owner');
    if (
      point.developmentState === 'main-integrated' &&
      (point.integration?.state !== 'present-on-main' ||
        !/^[a-f0-9]{40}$/.test(point.integration.observedMainRevision ?? ''))
    )
      errors.push('main-integration');
    if (
      point.developmentState === 'draft-published' &&
      (point.integration?.state !== 'not-integrated' ||
        !/^[a-f0-9]{40}$/.test(point.integration.draftRevision ?? ''))
    )
      errors.push('draft-integration');
    const children = point.children ?? [];
    if (!children.length) errors.push('empty-checkpoint');
    for (const child of children) {
      if (!child.key || keys.has(child.key)) errors.push('child-key');
      keys.add(child.key);
      if (
        !['development', 'verification', 'acceptance'].includes(child.phase) ||
        typeof child.checked !== 'boolean' ||
        !child.description
      )
        errors.push('child-state');
      if (
        !['developmentOwner', 'acceptanceOwner'].includes(child.ownerRef) ||
        !point[child.ownerRef]
      )
        errors.push('child-owner');
      if (child.checked && !child.evidenceUrls?.length) errors.push('completed-without-evidence');
      if (!child.checked && !child.nextAction) errors.push('pending-without-action');
    }
    const acceptance = children.filter((child) => child.phase === 'acceptance');
    if (
      point.acceptanceState === 'complete' &&
      (!acceptance.length ||
        acceptance.some((child) => !child.checked) ||
        point.acceptanceOwner.status !== 'verified')
    )
      errors.push('acceptance-promotion');
    if (point.umbrellaCompleted && point.acceptanceState !== 'complete')
      errors.push('umbrella-promotion');
  }
  return errors;
}
const target = targetKeys.map((key) =>
  companion.liveCheckpoints?.find((point) => point.key === key)
);

test('the original complete source snapshot is unchanged by live checkpoints', () => {
  const original = Object.fromEntries(originalFields.map((key) => [key, ledger[key]]));
  assert.equal(
    createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    '737e080d203a17407dba1e1d62190be1a38abe5d6bea9455e91779c959ba06f7'
  );
  assert.equal(original.finfSource.checkboxes.length, 203);
  assert.equal(original.deliverySource.criteria.length, 68);
  assert.equal(original.issueSnapshot.issues.length, 187);
});
test('the two bounded checkpoints exist once and satisfy source/owner/state schema', () => {
  for (const key of targetKeys)
    assert.equal(companion.liveCheckpoints.filter((point) => point.key === key).length, 1);
  assert.deepEqual(checkpointErrors(companion.liveCheckpoints), []);
});
test('original Issue criterion keys and wording are retained, not replaced by child completion', () => {
  assert.equal(sourceIssues.get(1073).criteria.length, 0);
  assert.equal(sourceIssues.get(1191).criteria.length, 6);
  assert.ok(sourceIssues.get(1191).criteria.every((criterion) => !criterion.historicalChecked));
  assert.ok(
    target.every((point) => !point.umbrellaCompleted && point.acceptanceState === 'incomplete')
  );
});
test('navigation draft delivery remains separate from main and native acceptance', () => {
  const navigation = target[1];
  assert.equal(navigation.developmentState, 'draft-published');
  assert.equal(navigation.integration.state, 'not-integrated');
  assert.deepEqual(navigation.localBrowserAttempt, {
    attempted: true,
    browserStarted: false,
    casesExecuted: 0,
    reason: 'Chromium singleton socket EPERM with sandbox retained.',
  });
  assert.equal(navigation.historicalNativeResult.passed, 13);
  assert.equal(navigation.historicalNativeResult.failed, 19);
  assert.notEqual(
    navigation.historicalNativeResult.sourceRevision,
    navigation.integration.draftRevision
  );
  assert.ok(
    navigation.children
      .filter((child) => child.phase === 'acceptance')
      .every((child) => !child.checked)
  );
});
test('unknown acceptance owners remain explicit rather than inferred from an Issue author', () => {
  assert.ok(target.every((point) => point.acceptanceOwner.status === 'unverified'));
});
test('duplicate checkpoint or child keys fail validation', () => {
  const duplicate = structuredClone(target);
  duplicate[1].children[0].key = duplicate[0].children[0].key;
  assert.ok(checkpointErrors(duplicate).includes('child-key'));
  duplicate[1].key = duplicate[0].key;
  assert.ok(checkpointErrors(duplicate).includes('checkpoint-key'));
});
test('an unrelated criterion key or a stale source body binding is rejected', () => {
  const invalid = structuredClone(target);
  invalid[1].sourceCriterionKeys.push('issue.1073.invented');
  invalid[0].sourceSnapshotBodySha256 = '0'.repeat(64);
  assert.ok(checkpointErrors(invalid).includes('criterion-binding'));
  assert.ok(checkpointErrors(invalid).includes('source-binding'));
});
test('completed children without evidence and pending children without next actions are rejected', () => {
  const invalid = structuredClone(target);
  invalid[0].children[0].evidenceUrls = [];
  invalid[1].children.find((child) => !child.checked).nextAction = '';
  assert.ok(checkpointErrors(invalid).includes('completed-without-evidence'));
  assert.ok(checkpointErrors(invalid).includes('pending-without-action'));
});
test('a draft cannot be promoted to main merely by changing the development label', () => {
  const invalid = structuredClone(target);
  invalid[1].developmentState = 'main-integrated';
  assert.ok(checkpointErrors(invalid).includes('main-integration'));
});
test('pending native criteria and an unknown owner prevent acceptance promotion', () => {
  const invalid = structuredClone(target);
  invalid[1].acceptanceState = 'complete';
  invalid[1].umbrellaCompleted = true;
  assert.ok(checkpointErrors(invalid).includes('acceptance-promotion'));
  invalid[1].acceptanceState = 'incomplete';
  assert.ok(checkpointErrors(invalid).includes('umbrella-promotion'));
});

test('each child names a verified contribution owner or explicitly unresolved acceptance owner', () => {
  for (const point of target)
    for (const child of point.children) {
      assert.equal(child.ownerRef, child.checked ? 'developmentOwner' : 'acceptanceOwner');
      assert.equal(
        point[child.ownerRef].status,
        child.checked ? 'verified-contribution' : 'unverified'
      );
    }
  const invalid = structuredClone(target);
  invalid[0].children[0].ownerRef = 'inventedOwner';
  assert.ok(checkpointErrors(invalid).includes('child-owner'));
});

test('the companion binds the unchanged raw source bytes, Git blob and source revision', () => {
  assert.equal(sourceSha256, '7b8d96ab6368dbb36764346932fd737d5e127c8b27aeb1208d0337b0a3c11a5e');
  assert.equal(sourceGitBlob, 'f97e4a44443666b40592e09ff5a74631c581b633');
  assert.deepEqual(Object.keys(ledger), originalFields);
  assert.deepEqual(companionErrors(companion), []);
});
test('a companion cannot silently rebind the historical snapshot or replace its role', () => {
  for (const field of ['path', 'gitBlob', 'sha256', 'sourceRevision']) {
    const invalid = structuredClone(companion);
    invalid.sourceLedger[field] = 'wrong';
    assert.ok(companionErrors(invalid).includes('snapshot-binding'));
  }
  const invalid = structuredClone(companion);
  invalid.kind = 'replacement-inventory';
  assert.ok(companionErrors(invalid).includes('companion-kind'));
});
test('the existing release list links the companion and its executable validation', () => {
  const list = readFileSync(
    new URL('../../../internal/governance/release-0.3-list.md', import.meta.url),
    'utf8'
  );
  assert.ok(list.includes('[evidence checkpoints](release-0.3-evidence-checkpoints.json)'));
  assert.ok(
    list.includes('node --test scripts/ci/test/release-source-ledger-checkpoints.test.mjs')
  );
  assert.ok(list.includes('do not override original criteria'));
});

test('the existing lightweight CI job executes the checkpoint guard once', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/ci.yml', import.meta.url),
    'utf8'
  );
  const command = 'node --test scripts/ci/test/release-source-ledger-checkpoints.test.mjs';
  const job = workflow.match(
    /^  ci-config-audit:\n[\s\S]*?(?=^  [a-zA-Z][\w-]*:|$(?![\s\S]))/m
  )?.[0];
  assert.ok(job, 'the existing ci-config-audit job must remain present');
  assert.ok(job.includes(command), 'checkpoint validation must run in the lightweight job');
  assert.equal(workflow.split(command).length - 1, 1, 'do not duplicate the checkpoint run');
});
