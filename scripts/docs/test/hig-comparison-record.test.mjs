import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
const root = new URL('../../../', import.meta.url);
const record = JSON.parse(
  readFileSync(
    new URL('internal/records/2026-10-06-apple-hig-proto-ui-first-review.json', root),
    'utf8'
  )
);
const markdown = readFileSync(
  new URL('internal/records/2026-10-06-apple-hig-proto-ui-first-review.md', root),
  'utf8'
);
const rows = record.rows;
test('HIG dated comparison has 158 unique mapped topics, six parents and eight Components groups', () => {
  assert.equal(rows.length, 158);
  assert.equal(new Set(rows.map((row) => row.url)).size, 158);
  const parents = new Set(rows.map((row) => row.group.split(' / ')[0]));
  assert.equal(parents.size, 6);
  assert.equal(
    new Set(rows.filter((row) => row.group.startsWith('Components / ')).map((row) => row.group))
      .size,
    8
  );
  for (const row of rows) {
    assert.ok(row.url.startsWith('https://developer.apple.com/design/human-interface-guidelines/'));
    assert.ok(markdown.includes(`](${row.url})`));
    assert.ok(row.source.mainBodyRead);
  }
  assert.ok(markdown.includes('### Components / System experiences'));
  assert.equal(record.coverage.completeArticleRuntimeVerified, 0);
});
test('HIG scope distinguishes positive evidence from exclusions and indirect section mentions', () => {
  const corrected = rows.filter(
    (row) => row.applePlatformScope.basis === 'article-body-and-platform-exclusions'
  );
  assert.equal(corrected.length, 18);
  for (const row of rows) {
    const scope = row.applePlatformScope;
    assert.ok(Array.isArray(scope.affirmedPlatforms));
    assert.ok(Array.isArray(scope.excludedPlatforms));
    assert.ok(
      scope.affirmedPlatforms.every((platform) => !scope.excludedPlatforms.includes(platform))
    );
  }
  for (const [item, platform] of [
    ['Immersive experiences', 'visionOS'],
    ['Camera Control', 'iOS'],
    ['Column views', 'macOS'],
    ['Digit entry views', 'tvOS'],
  ])
    assert.deepEqual(rows.find((row) => row.item === item).applePlatformScope.affirmedPlatforms, [
      platform,
    ]);
  assert.deepEqual(
    rows.find((row) => row.item === 'Digital Crown').applePlatformScope.affirmedPlatforms,
    ['visionOS', 'watchOS']
  );
});
test('HIG issue candidates have one numeric shape with optional separately named notes', () => {
  for (const row of rows) {
    assert.ok(row.existingIssueCandidates.every((id) => Number.isInteger(id) && id > 0));
    assert.equal(new Set(row.existingIssueCandidates).size, row.existingIssueCandidates.length);
    for (const note of row.existingIssueCandidateNotes ?? [])
      assert.ok(row.existingIssueCandidates.includes(note.number));
  }
});
test('HIG final read status does not claim a public failed-attempt ledger', () => {
  assert.equal(record.coverage.initialTransientReadFailuresRetained, false);
  assert.ok(record.coverage.initialTransientReadFailureEvidenceScope);
});
test('HIG code paths resolve against the recorded immutable baseline', () => {
  const tracked = new Set(
    execFileSync('git', ['ls-tree', '-r', '--name-only', record.baseline], {
      cwd: root,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
  );
  const paths = new Set(rows.flatMap((row) => row.proto.sourcePaths));
  assert.equal(paths.size, 143);
  for (const path of paths) assert.ok(tracked.has(path), path);
});
