import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One reviewed source-reference renewal. This does not run or alter the
// browser, accept source admission, or reuse a previous native receipt.
const [revision, ...extra] = process.argv.slice(2);
assert.ok(
  /^[a-f0-9]{40}$/.test(revision ?? '') && extra.length === 0,
  'Pass the full final source commit SHA.'
);
const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').toString().trim();
assert.equal(resolve(process.cwd()), root, 'Run from the repository root.');
assert.equal(
  git('rev-parse', 'HEAD').toString().trim(),
  revision,
  'Commit the source candidate before renewing its reference.'
);
assert.equal(git('rev-parse', '--verify', `${revision}^{commit}`).toString().trim(), revision);

const directory = dirname(fileURLToPath(import.meta.url));
const review = JSON.parse(readFileSync(join(directory, 'source-review.json'), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const previousBytes = readFileSync(review.previousProfile.path);
assert.equal(
  sha256(previousBytes),
  review.previousProfile.sha256,
  'The current profile differs from the reviewed predecessor.'
);
assert.equal(gitBlob(previousBytes), review.previousProfile.gitBlob);
assert.ok(
  readFileSync(review.archivePath).equals(previousBytes),
  'The archived predecessor must remain byte-for-byte identical.'
);

const previous = JSON.parse(previousBytes);
assert.equal(previous.revision, '5f0844907895a4ae0db506fe6a5d0bf162318329');
assert.equal(previous.revision, review.previousReferenceRevision);
assert.equal(previous.sourceAdmission, 'unverified');
assert.equal(review.sourceAdmission, 'unverified');
assert.equal(previous.sources.length, 33);
assert.equal(review.sourceCount, 33);
assert.equal(new Set(previous.sources.map((source) => source.path)).size, 33);
const changes = new Map(review.changedSources.map((source) => [source.path, source]));
assert.deepEqual(
  [...changes.keys()],
  [
    'apps/www/src/components/PrototypePreviewer/previewer-client.ts',
    'apps/www/src/components/PrototypePreviewer/previewer-bootstrap.ts',
    'apps/www/src/components/PrototypePreviewer/previewer-removal.ts',
    'apps/www/src/components/docs-header-preparation.ts',
  ]
);
assert.equal(review.changedSources.length, 4);

const sources = [];
const ledger = [];
for (const source of previous.sources) {
  const change = changes.get(source.path);
  if (change) assert.equal(change.previousSha256, source.sha256);
  const expected = change?.reviewedSha256 ?? source.sha256;
  const committed = git('show', `${revision}:${source.path}`);
  const working = readFileSync(source.path);
  assert.equal(sha256(committed), expected, `Unreviewed committed source bytes: ${source.path}`);
  assert.ok(
    working.equals(committed),
    `Working source differs from the committed candidate: ${source.path}`
  );
  if (change) assert.equal(gitBlob(committed), change.reviewedGitBlob);
  sources.push({ ...source, sha256: expected });
  ledger.push({
    path: source.path,
    previousSha256: source.sha256,
    sha256: expected,
    gitBlob: gitBlob(committed),
    changed: Boolean(change),
  });
}
assert.equal(ledger.filter((source) => source.changed).length, 4);
const ledgerPath = join(directory, 'source-ledger.json');
assert.ok(!existsSync(ledgerPath), 'Refuse to overwrite a previous renewal receipt.');

const current = {
  ...previous,
  revision,
  scope:
    'Direct source inventory for the sampled website routes. Four reviewed lifecycle members changed: batched initial theme watching, shared Previewer bootstrap observation, removal-only cleanup notifications, and document preparation leases. The 33 source identities, sampled highlighted/raw-code/Copy owners and unverified admission remain unchanged. All 33 fixed source hashes match this committed source revision and its working files. The preceding reference is byte-preserved in website-markup-provenance-5f08449.json. Browser execution, served content and transitive dependencies require separate evidence.',
  sources,
};
const report = {
  schemaVersion: 1,
  kind: 'issue834.source-reference-renewal',
  previousRevision: previous.revision,
  reviewedSourceRevision: review.reviewedSourceRevision,
  revision,
  sourceAdmission: 'unverified',
  archivePath: review.archivePath,
  archiveSha256: sha256(previousBytes),
  sourceCount: sources.length,
  changedSourceCount: 4,
  sources: ledger,
  nativeResult: 'not-supplied-by-source-renewal',
};
// Every reviewed digest and all unchanged members have been checked before
// either output is written. Nothing derives a new expectation from live bytes.
writeFileSync(review.previousProfile.path, `${JSON.stringify(current, null, 2)}\n`);
writeFileSync(ledgerPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
