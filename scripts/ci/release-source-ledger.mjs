import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sourceLedgerPath = 'internal/governance/release-0.3-source-ledger.json';
const sourceCorrectionsPath = 'internal/governance/release-0.3-source-corrections.json';
const repositoryRoot = new URL('../../', import.meta.url);

// The frozen snapshot's exact bytes are its immutable identity, and a companion
// bound to them must retain every correction already recorded against them.
// Dropping one would silently return the historical ledger (1233 criteria) and
// lose restored obligations such as the five Issue #649 conditions. Membership
// is a subset requirement, not exact equality: a companion may still append
// further independently valid corrections.
const requiredCorrectionsBySourceSha256 = new Map([
  [
    '7b8d96ab6368dbb36764346932fd737d5e127c8b27aeb1208d0337b0a3c11a5e',
    ['correction.649.20261105.crlf-criteria-loss'],
  ],
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

// Extracts "- [ ]"/"- [x]" checkbox criteria from a Markdown source body.
// GitHub Issue/comment bodies may use either LF or CRLF line endings, so a
// line is matched on its content and the trailing CR is removed rather than
// requiring an LF-only terminator. sourceLine is 1-based over the body's
// logical lines and stays identical for both endings.
export function extractCheckboxCriteria(body) {
  const lines = body.split('\n');
  const criteria = [];
  let section = '';
  lines.forEach((rawLine, index) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (/^#{1,6}\s/.test(line)) section = line;
    if (/^- \[[ xX]\] /.test(line)) {
      criteria.push({
        sourceLine: index + 1,
        section,
        original: line,
        historicalChecked: /^- \[[xX]\]/.test(line),
      });
    }
  });
  return criteria;
}

// Returns the effective release-0.3 source ledger: the frozen source snapshot
// with every recorded additive correction applied. The frozen file itself is
// never rewritten; consumers MUST use this corrected view rather than reading
// the raw snapshot for current criterion identities or denominators.
export function loadEffectiveLedger(root = repositoryRoot) {
  const sourceBytes = readFileSync(new URL(sourceLedgerPath, root));
  const ledger = JSON.parse(sourceBytes.toString('utf8'));
  const corrections = JSON.parse(readFileSync(new URL(sourceCorrectionsPath, root), 'utf8'));
  if (
    corrections.schemaVersion !== 1 ||
    corrections.kind !== 'additive-source-corrections' ||
    !Array.isArray(corrections.corrections)
  )
    throw new Error('invalid source corrections companion');
  const sourceSha256 = sha256(sourceBytes);
  const sourceGitBlob = createHash('sha1')
    .update(`blob ${sourceBytes.length}\0`)
    .update(sourceBytes)
    .digest('hex');
  if (
    corrections.sourceLedger?.path !== sourceLedgerPath ||
    corrections.sourceLedger.gitBlob !== sourceGitBlob ||
    corrections.sourceLedger.sha256 !== sourceSha256 ||
    corrections.sourceLedger.sourceRevision !== ledger.sourceRevision
  )
    throw new Error('source corrections snapshot binding mismatch');

  // A companion that binds this frozen snapshot may not silently drop the
  // corrections already recorded against it; the reader would otherwise return
  // the historical ledger with their restored obligations missing.
  const suppliedCorrectionKeys = new Set(corrections.corrections.map((entry) => entry?.key));
  for (const requiredKey of requiredCorrectionsBySourceSha256.get(sourceSha256) ?? [])
    if (!suppliedCorrectionKeys.has(requiredKey))
      throw new Error(`missing required source correction ${requiredKey}`);

  // Each call owns its parsed snapshot. Append only after checking the archived
  // body; neither the frozen file nor a shared in-memory snapshot is mutated.
  const issuesByNumber = new Map(ledger.issueSnapshot.issues.map((issue) => [issue.number, issue]));
  const existingKeys = new Set(
    ledger.issueSnapshot.issues.flatMap((issue) => issue.criteria.map((criterion) => criterion.key))
  );
  const correctionKeys = new Set();
  for (const correction of corrections.corrections) {
    if (typeof correction.key !== 'string' || !correction.key || correctionKeys.has(correction.key))
      throw new Error('invalid or duplicate correction key');
    correctionKeys.add(correction.key);
    const issue = issuesByNumber.get(correction.issueNumber);
    if (
      !issue ||
      correction.sourceIssue !== issue.url ||
      correction.sourceBodySha256 !== issue.sourceBodySha256 ||
      typeof correction.sourceBody !== 'string' ||
      sha256(correction.sourceBody) !== issue.sourceBodySha256
    )
      throw new Error(`correction source binding mismatch for Issue ${correction.issueNumber}`);
    if (!correction.cause || !Number.isFinite(Date.parse(correction.recordedAt)))
      throw new Error(`missing correction provenance for Issue ${issue.number}`);

    const existingLines = new Set(issue.criteria.map((criterion) => criterion.sourceLine));
    const missing = new Map(
      extractCheckboxCriteria(correction.sourceBody)
        .filter((criterion) => !existingLines.has(criterion.sourceLine))
        .map((criterion) => [criterion.sourceLine, criterion])
    );
    if (
      !Array.isArray(correction.restoredCriteria) ||
      !correction.restoredCriteria.length ||
      correction.restoredCriteria.length !== missing.size
    )
      throw new Error(`incomplete correction for Issue ${issue.number}`);
    for (const criterion of correction.restoredCriteria) {
      if (existingKeys.has(criterion.key))
        throw new Error(`duplicate criterion key ${criterion.key}`);
      const source = missing.get(criterion.sourceLine);
      if (
        !source ||
        typeof criterion.key !== 'string' ||
        !criterion.key.startsWith(`issue.${issue.number}.`) ||
        criterion.source !== issue.url ||
        criterion.original !== source.original ||
        criterion.section !== source.section ||
        criterion.historicalChecked !== source.historicalChecked ||
        criterion.release !== issue.release ||
        criterion.developmentState !== 'reconcile-live-evidence' ||
        criterion.acceptanceState !== 'not-yet-reconciled' ||
        !criterion.nextAction
      )
        throw new Error(
          `invalid restored criterion for Issue ${issue.number}, line ${criterion.sourceLine}`
        );
      issue.criteria.push({ ...criterion, correctionKey: correction.key });
      existingKeys.add(criterion.key);
      missing.delete(criterion.sourceLine);
    }
  }
  return ledger;
}
