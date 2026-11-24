import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { digest } from './history-audit.mjs';
import { readHistoryJSON } from './history-files.mjs';

const dispositions = new Set(['execution', 'context', 'excluded', 'historical-authorization']);

export function successorIdentity(number, link) {
  return digest({
    number,
    targetIssue: link.targetIssue,
    source: link.source,
    line: link.line,
    original: link.original,
  });
}

// Keyword extraction discovers references. It cannot establish semantic polarity,
// a renewed historical permission, or which clause of a multi-topic line transfers.
// This bounded overlay consumes actual independent source readings. It neither
// guesses new owners nor removes the frozen source conditions/evidence gaps.
export function applySuccessorReview(decisions, review) {
  assert.equal(review.schemaVersion, 1, 'unsupported successor review schema');
  assert.equal(review.decisionSetSha256, digest(decisions), 'decision set changed');
  assert.ok(review.reviewer?.trim(), 'missing reviewer');
  assert.ok(review.method?.trim(), 'missing actual review method');
  const readings = new Map();
  for (const entry of review.entries) {
    assert.ok(dispositions.has(entry.disposition), 'unknown successor disposition');
    assert.ok(entry.rationale?.trim(), 'missing source-specific rationale');
    assert.ok(entry.scope?.trim(), 'missing bounded scope');
    assert.equal(entry.originalSha256, digest(entry.original), 'reviewed text changed');
    const key = successorIdentity(entry.number, entry);
    assert.equal(entry.identity, key, 'review source binding changed');
    assert.ok(!readings.has(key), 'duplicate successor review');
    readings.set(key, entry);
  }
  let reviewed = 0;
  const output = decisions.map((decision) => {
    assert.ok(!decision.successorReview, 'source decision already has a review overlay');
    const originalLinks = decision.sourceSuccessors ?? [];
    if (!originalLinks.length) return decision;
    const remaining = [...decision.remaining];
    const accepted = [];
    const references = [];
    for (const link of originalLinks) {
      const key = successorIdentity(decision.number, link);
      const reading = readings.get(key);
      assert.ok(
        reading,
        `missing reviewed successor for #${decision.number} -> #${link.targetIssue}`
      );
      readings.delete(key);
      reviewed++;
      const originalCondition = `Retain the complete source condition associated with this explicit successor reference: ${link.original}`;
      const index = remaining.findIndex(
        (row) =>
          row.disposition === 'existing-execution-issue' &&
          row.targetIssue === link.targetIssue &&
          row.source === link.source &&
          row.condition === originalCondition
      );
      assert.ok(index >= 0, `source remaining condition changed for #${decision.number}`);
      const [old] = remaining.splice(index, 1);
      const reference = {
        ...link,
        interpretation: reading.rationale,
        disposition: reading.disposition,
        scope: reading.scope,
        originalSha256: reading.originalSha256,
        reviewIdentity: key,
      };
      references.push(reference);
      if (reading.disposition === 'execution') {
        accepted.push(reference);
        remaining.push({
          ...old,
          condition: reading.scope,
          sourceLine: link.line,
          originalSha256: reading.originalSha256,
          successorReviewIdentity: key,
          nextAction: `Continue only this source-supported scope in #${link.targetIssue}; retain the complete original source and its evidence limits. This record supplies no new technical acceptance or takeover authorization.`,
        });
      }
    }
    return {
      ...decision,
      sourceSuccessors: accepted,
      remaining,
      reviewedSourceReferences: references,
      successorReview: {
        reviewer: review.reviewer,
        method: review.method,
        sourceDecisionSetSha256: review.decisionSetSha256,
        reviewSha256: digest(review),
      },
    };
  });
  assert.equal(readings.size, 0, 'review contains references absent from the source decisions');
  assert.equal(reviewed, review.entries.length, 'successor review population mismatch');
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, reviewPath, output] = process.argv.slice(2);
  assert.ok(
    input && reviewPath && output,
    'Usage: history-successor-review.mjs DECISIONS.json.gz REVIEW.json OUTPUT.json.gz'
  );
  assert.notEqual(input, output, 'preserve the frozen input; use a new output path');
  const decisions = await readHistoryJSON(input);
  const review = JSON.parse(await readFile(reviewPath, 'utf8'));
  const corrected = applySuccessorReview(decisions, review);
  const serialized = `${JSON.stringify(corrected, null, 2)}\n`;
  await writeFile(output, output.endsWith('.gz') ? gzipSync(serialized, { level: 9 }) : serialized);
  const counts = {};
  for (const row of review.entries) counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
  console.log(
    JSON.stringify(
      { objects: corrected.length, references: review.entries.length, counts },
      null,
      2
    )
  );
}
