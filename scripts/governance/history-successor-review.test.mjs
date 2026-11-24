import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from './history-audit.mjs';
import { applySuccessorReview, successorIdentity } from './history-successor-review.mjs';

const separate =
  'Consequently, if opener disposal rejects, active/pending Dialog teardown is skipped. Calling this entry again returns immediately because alive is already false. This is separate from Search readiness/performance tracked by #848 and historical composition #1038.';
const excluded = 'Shared #1132, other compiler backends, #902 and Adapter #687 remain excluded.';

function source(number, original, targets) {
  const links = targets.map((targetIssue) => ({
    targetIssue,
    source: `https://github.com/Proto-UI/Proto-UI/issues/${number}`,
    line: 102,
    original,
    owner: `#${targetIssue}: original execution owner`,
    interpretation: 'Explicitly mentioned live successor/tracker',
  }));
  return {
    number,
    sourceSuccessors: links,
    conditionDispositions: [
      { sourceKey: 'original-full-condition', historicalChecked: false, targetIssue: number },
    ],
    technicalAcceptance: 'No new product acceptance',
    remaining: [
      {
        disposition: 'historical-source-gap',
        targetIssue: 1147,
        condition: 'Retain original unavailable proof',
      },
      ...links.map((link) => ({
        condition: `Retain the complete source condition associated with this explicit successor reference: ${link.original}`,
        disposition: 'existing-execution-issue',
        source: link.source,
        targetIssue: link.targetIssue,
        owner: link.owner,
      })),
    ],
  };
}

function reading(decisions, disposition, scope) {
  return {
    schemaVersion: 1,
    reviewer: 'independent source reader',
    method: 'Read the actual source condition',
    decisionSetSha256: digest(decisions),
    entries: decisions.flatMap((decision) =>
      decision.sourceSuccessors.map((link) => ({
        ...link,
        number: decision.number,
        identity: successorIdentity(decision.number, link),
        originalSha256: digest(link.original),
        disposition,
        scope,
        rationale: scope,
      }))
    ),
  };
}

test('the real #1488 separation does not assign Dialog teardown to Search', () => {
  const decisions = [source(1488, separate, [848])];
  const before = structuredClone(decisions);
  const corrected = applySuccessorReview(
    decisions,
    reading(decisions, 'excluded', 'Dialog teardown remains #1488 E; #848 readiness is separate.')
  );
  assert.deepEqual(decisions, before, 'frozen source is immutable');
  assert.deepEqual(corrected[0].sourceSuccessors, []);
  assert.equal(
    corrected[0].remaining.some((row) => row.targetIssue === 848),
    false
  );
  assert.deepEqual(corrected[0].conditionDispositions, before[0].conditionDispositions);
  assert.equal(corrected[0].reviewedSourceReferences[0].original, separate);
  assert.equal(corrected[0].remaining[0].disposition, 'historical-source-gap');
});

test('the real #1056 exclusion preserves all three boundaries without positive execution routes', () => {
  const decisions = [source(1056, excluded, [1132, 902, 687])];
  const corrected = applySuccessorReview(
    decisions,
    reading(
      decisions,
      'excluded',
      'The named pointer, compiler-source and Adapter scopes remain excluded.'
    )
  );
  assert.equal(corrected[0].remaining.length, 1);
  assert.equal(corrected[0].reviewedSourceReferences.length, 3);
  assert.deepEqual(corrected[0].sourceSuccessors, []);
});

test('a valid multi-topic transfer carries only its independently read subcondition', () => {
  const original = 'Remaining docs double-focus stays here; Liquid menu state follows #1149.';
  const decisions = [source(420, original, [1149])];
  const review = reading(decisions, 'execution', 'Only Liquid menu state belongs to #1149.');
  const corrected = applySuccessorReview(decisions, review)[0];
  assert.equal(corrected.sourceSuccessors.length, 1);
  assert.equal(corrected.remaining[1].condition, 'Only Liquid menu state belongs to #1149.');
  assert.equal(corrected.reviewedSourceReferences[0].original, original);
  assert.equal(corrected.technicalAcceptance, decisions[0].technicalAcceptance);
});

test('an expired handoff is retained without granting current work or authority', () => {
  const decisions = [
    source(702, 'Historical maintainer handoff under #687; the lease ended.', [687]),
  ];
  const corrected = applySuccessorReview(
    decisions,
    reading(
      decisions,
      'historical-authorization',
      'Retain the expired permission; no current authority follows.'
    )
  )[0];
  assert.equal(corrected.remaining.length, 1);
  assert.equal(corrected.reviewedSourceReferences[0].disposition, 'historical-authorization');
});

test('missing, duplicate and foreign readings cannot silently omit source references', () => {
  const decisions = [source(1056, excluded, [1132, 902, 687])];
  const review = reading(decisions, 'excluded', 'Explicit source exclusion.');
  const missing = structuredClone(review);
  missing.entries.pop();
  assert.throws(() => applySuccessorReview(decisions, missing), /missing reviewed successor/);
  const duplicate = structuredClone(review);
  duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => applySuccessorReview(decisions, duplicate), /duplicate successor review/);
  const foreign = structuredClone(review);
  const extra = { ...foreign.entries[0], number: 999 };
  extra.identity = successorIdentity(extra.number, extra);
  foreign.entries.push(extra);
  assert.throws(() => applySuccessorReview(decisions, foreign), /references absent/);
});

test('changed source text, source position, or original decision invalidates the review', () => {
  const decisions = [source(1488, separate, [848])];
  const review = reading(decisions, 'excluded', 'Keep the explicit separate scope.');
  const changedText = structuredClone(review);
  changedText.entries[0].original += ' Changed.';
  assert.throws(() => applySuccessorReview(decisions, changedText), /reviewed text changed/);
  const moved = structuredClone(review);
  moved.entries[0].line++;
  assert.throws(() => applySuccessorReview(decisions, moved), /source binding changed/);
  const changedDecision = structuredClone(decisions);
  changedDecision[0].conditionDispositions[0].historicalChecked = true;
  assert.throws(() => applySuccessorReview(changedDecision, review), /decision set changed/);
});
