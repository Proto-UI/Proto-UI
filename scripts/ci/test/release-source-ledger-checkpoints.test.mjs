import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { extractCheckboxCriteria, loadEffectiveLedger } from '../release-source-ledger.mjs';

const sourcePath = 'internal/governance/release-0.3-source-ledger.json';
const sourceBytes = readFileSync(new URL('../../../' + sourcePath, import.meta.url));
const ledger = JSON.parse(sourceBytes);
const companion = JSON.parse(
  readFileSync(
    new URL('../../../internal/governance/release-0.3-evidence-checkpoints.json', import.meta.url),
    'utf8'
  )
);
const correctionsPath = 'internal/governance/release-0.3-source-corrections.json';
const corrections = JSON.parse(
  readFileSync(new URL('../../../' + correctionsPath, import.meta.url), 'utf8')
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
const currentSourceIssues = new Map(
  loadEffectiveLedger().issueSnapshot.issues.map((issue) => [issue.number, issue])
);

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
    const source = currentSourceIssues.get(point.issueNumber);
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
// R03-GOV-01 regression: Issue #649's five original acceptance conditions were
// lost at acquisition because its archived/live body lines 51-55 end with CRLF
// while the extractor required LF. The frozen snapshot keeps the omission; the
// additive correction restores the conditions and every current consumer reads
// the corrected effective ledger.
const issue649BodyExcerpt = [
  '## Acceptance and boundaries',
  '',
  '- [ ] Record exception propagation, remaining-watcher fan-out, already-recorded nested events, and recovery semantics.',
  '- [ ] Add deterministic tests for same-state and cross-state reentry, throw before/after nested mutation, later mutation after catch, and disposal during dispatch.',
  '- [ ] Preserve actual transition order under the chosen policy; no silently stranded records or older events delivered after a newer accepted event.',
  '- [ ] Verify Module/Runtime callback-scope restoration and borrowed/observed watcher paths, not only direct kernel subscribers.',
  '- [ ] Preserve no-implicit-render behavior, same-value suppression, setup-only registration, and terminal invalidation; no value-validation/accessor migration scope creep.',
];

test('checkbox acquisition extracts identical criteria from LF and CRLF bodies', () => {
  const lf = issue649BodyExcerpt.join('\n');
  const crlf = issue649BodyExcerpt.join('\r\n');
  const fromLf = extractCheckboxCriteria(lf);
  const fromCrlf = extractCheckboxCriteria(crlf);
  assert.equal(fromLf.length, 5);
  assert.deepEqual(fromCrlf, fromLf);
  assert.deepEqual(
    fromCrlf.map((criterion) => criterion.sourceLine),
    [3, 4, 5, 6, 7]
  );
  assert.ok(fromCrlf.every((criterion) => criterion.section === '## Acceptance and boundaries'));
  assert.ok(fromCrlf.every((criterion) => !criterion.original.includes('\r')));
});

test('the source corrections companion is bound, schema-valid and restores the five lost conditions', () => {
  const correction = corrections.corrections.find((entry) => entry.issueNumber === 649);
  assert.ok(correction, 'the Issue #649 CRLF correction must exist');
  assert.equal(
    createHash('sha256').update(correction.sourceBody).digest('hex'),
    sourceIssues.get(649).sourceBodySha256
  );
  assert.deepEqual(
    extractCheckboxCriteria(correction.sourceBody),
    correction.restoredCriteria.map(({ sourceLine, section, original, historicalChecked }) => ({
      sourceLine,
      section,
      original,
      historicalChecked,
    }))
  );
  assert.equal(correction.restoredCriteria.length, 5);
  assert.deepEqual(
    correction.restoredCriteria.map((criterion) => criterion.key),
    ['issue.649.001', 'issue.649.002', 'issue.649.003', 'issue.649.004', 'issue.649.005']
  );
  assert.deepEqual(
    correction.restoredCriteria.map((criterion) => criterion.sourceLine),
    [51, 52, 53, 54, 55]
  );
  assert.ok(
    correction.restoredCriteria.every(
      (criterion) =>
        criterion.section === '## Acceptance and boundaries' &&
        criterion.historicalChecked === false &&
        criterion.release === 'criterion-split'
    )
  );
});

test('the effective ledger restores all five Issue #649 conditions with the frozen snapshot untouched', () => {
  assert.equal(sourceIssues.get(649).criteria.length, 0);
  const effective = loadEffectiveLedger();
  const effective649 = effective.issueSnapshot.issues.find((issue) => issue.number === 649);
  assert.equal(effective649.criteria.length, 5);
  const total = effective.issueSnapshot.issues.reduce(
    (sum, issue) => sum + issue.criteria.length,
    0
  );
  assert.equal(total, 1238);
  const keys = new Set(
    effective.issueSnapshot.issues.flatMap((issue) =>
      issue.criteria.map((criterion) => criterion.key)
    )
  );
  assert.equal(keys.size, total);
  assert.ok(
    effective649.criteria.every(
      (criterion) => criterion.correctionKey === 'correction.649.20261105.crlf-criteria-loss'
    )
  );
});

function correctionRoot(t, mutate) {
  const directory = mkdtempSync(join(tmpdir(), 'release-source-correction-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = pathToFileURL(directory + sep);
  mkdirSync(new URL('internal/governance/', root), { recursive: true });
  writeFileSync(new URL(sourcePath, root), sourceBytes);
  const changed = structuredClone(corrections);
  mutate(changed);
  writeFileSync(new URL(correctionsPath, root), JSON.stringify(changed));
  return root;
}

test('the effective reader rejects rebound snapshot identities and altered source bodies', (t) => {
  for (const field of ['path', 'gitBlob', 'sha256', 'sourceRevision']) {
    const root = correctionRoot(t, (value) => {
      value.sourceLedger[field] = 'wrong';
    });
    assert.throws(() => loadEffectiveLedger(root), /snapshot binding/i);
  }
  for (const field of ['sourceBody', 'sourceBodySha256', 'sourceIssue']) {
    const root = correctionRoot(t, (value) => {
      value.corrections[0][field] = 'wrong';
    });
    assert.throws(() => loadEffectiveLedger(root), /source binding/i);
  }
});

test('the effective reader rejects valid-looking rewrites and false completion', (t) => {
  const changes = {
    original: '- [ ] A different, syntactically valid acceptance condition.',
    sourceLine: 52,
    section: '## A different source section',
    historicalChecked: true,
    source: 'https://github.com/Proto-UI/Proto-UI/issues/1191',
    release: '0.4',
    developmentState: 'main-integrated',
    acceptanceState: 'complete',
  };
  for (const [field, replacement] of Object.entries(changes)) {
    const root = correctionRoot(t, (value) => {
      value.corrections[0].restoredCriteria[0][field] = replacement;
    });
    assert.throws(() => loadEffectiveLedger(root), /restored criterion/i, field);
  }
});

test('the effective reader rejects duplicate identities and incomplete corrections', (t) => {
  const duplicate = correctionRoot(t, (value) => {
    value.corrections[0].restoredCriteria[0].key = sourceIssues.get(1191).criteria[0].key;
  });
  assert.throws(() => loadEffectiveLedger(duplicate), /duplicate criterion/i);
  const renamedDuplicate = correctionRoot(t, (value) => {
    value.corrections[0].restoredCriteria[1].sourceLine = 51;
  });
  assert.throws(() => loadEffectiveLedger(renamedDuplicate), /restored criterion/i);
  for (const count of [0, 4]) {
    const incomplete = correctionRoot(t, (value) => {
      value.corrections[0].restoredCriteria.length = count;
    });
    assert.throws(() => loadEffectiveLedger(incomplete), /incomplete correction/i);
  }
});

test('current checkpoints can bind restored criteria but still reject unrelated keys', () => {
  const point = structuredClone(target[1]);
  const issue = currentSourceIssues.get(649);
  point.issueNumber = issue.number;
  point.sourceIssue = issue.url;
  point.sourceSnapshotBodySha256 = issue.sourceBodySha256;
  point.sourceCriterionKeys = issue.criteria.map((criterion) => criterion.key);
  assert.deepEqual(checkpointErrors([point]), []);
  point.sourceCriterionKeys.push('issue.649.invented');
  assert.ok(checkpointErrors([point]).includes('criterion-binding'));
});

// F1 regression: a companion with the correct frozen binding but no correction
// entries used to load and return the historical ledger (1233 criteria, no
// Issue #649 conditions). The frozen snapshot identity requires the recorded
// correction ID as a subset; it never fixes the total or the entry count, so a
// separately valid additive entry remains possible.
test('the effective reader rejects a companion that omits the recorded correction entry', (t) => {
  const omitted = correctionRoot(t, (value) => {
    value.corrections.length = 0;
  });
  assert.throws(() => loadEffectiveLedger(omitted), /missing required source correction/i);

  const renamed = correctionRoot(t, (value) => {
    value.corrections[0].key = 'correction.649.20261105.renamed-entry';
  });
  assert.throws(() => loadEffectiveLedger(renamed), /missing required source correction/i);

  // Control: the untouched companion still restores all five conditions, so
  // the rejection is the omitted recorded entry, not a blanket refusal.
  const restored = loadEffectiveLedger().issueSnapshot.issues.find((issue) => issue.number === 649);
  assert.equal(restored.criteria.length, 5);
});
