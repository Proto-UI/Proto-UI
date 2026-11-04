import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const original = {
  workflow: read('.github/workflows/library-card-evidence.yml'),
  aggregate: read('.github/workflows/ci-production-suites.yml'),
  liquid: read('.github/workflows/liquid-card-candidate-evidence.yml'),
  plan: read('scripts/test/runtime-test-plan.mjs'),
  scheduling: read('scripts/ci/test/ci-scheduling-policy.test.mjs'),
};
const hash = (text) => createHash('sha256').update(text).digest('hex');
function section(text, start, end) {
  assert.equal(text.split(start).length, 2, 'exactly one ' + start);
  const value = text.split(start)[1];
  if (end === undefined) return value;
  assert.equal(value.split(end).length, 2, 'exactly one ' + end);
  return value.split(end)[0];
}
function contract({ workflow, aggregate, liquid, plan, scheduling }) {
  assert.ok(scheduling.split('\n').includes("import './library-card-font-workflow.test.mjs';"));
  const triggers = section(workflow, '\non:\n', '\npermissions:\n');
  assert.match(
    triggers,
    /  workflow_dispatch:\n    inputs:\n      font_comparison:\n        description: [^\n]+\n        type: boolean\n        required: false\n        default: false\n  workflow_call:/u
  );
  assert.doesNotMatch(triggers, /pull_request|schedule|push/u);
  const concurrency = section(workflow, '\nconcurrency:\n', '\nenv:\n');
  assert.match(concurrency, /  cancel-in-progress: false(?:\n|$)/u);
  assert.ok(
    concurrency.includes(
      '  group: library-card-${{ github.event.pull_request.number || github.ref }}'
    )
  );
  assert.equal(
    hash(section(workflow, '  browser-evidence:\n', '  font-parent-comparison:\n')),
    '804dda96b72b44e380729716b60367fb5961d994dba332d8ef663beaa1de178e'
  );
  const pair = section(workflow, '  font-parent-comparison:\n', '  font-author-boundary:\n');
  assert.match(
    pair,
    /    if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.font_comparison == true \}\}/u
  );
  assert.match(pair, /ref: 1fbbe8cadf4e4592d54dabdb1c346f2d080a094f/u);
  assert.ok(
    pair.includes(
      "'baseline': ('1fbbe8cadf4e4592d54dabdb1c346f2d080a094f', '9d32bc9734f0fccdeca9024b87a365cb395f7f2e')"
    )
  );
  const inventory = pair.match(/EXPECTED_CHANGED = (\[[^\n]+\])/u)?.[1];
  assert.ok(inventory);
  const paths = [...inventory.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  assert.equal(paths.length, 37);
  assert.deepEqual(paths, [...new Set(paths)].sort());
  for (const path of [
    '.github/workflows/ci-production-suites.yml',
    'scripts/ci/test/library-card-font-workflow.test.mjs',
    'scripts/test/runtime-test-plan.mjs',
  ])
    assert.ok(paths.includes(path));
  for (const guard of [
    'assert sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k)) == EXPECTED_CHANGED',
    "assert a['pnpm-lock.yaml'] == b['pnpm-lock.yaml']",
    "assert all(c['exit'] == 0 for r in rows for c in r['commands'])",
    "assert debt['passed'] is False and debt['productFixClaimed'] is False",
    "unit('library-card', 'library-cards-first-frame.browser.test.ts', 9, 1200)",
    "unit('quick-start', 'quick-start-first-frame.browser.test.ts', 20, 1200)",
    "unit('fragment-controls', 'quick-start-first-frame-fragment-control.browser.test.ts', 4, 600)",
    "'historicalBaselineHead': 'd850c28a40bfbc31f10d244b075d6f27038f46fa'",
    "'historicalFixed026ComparisonRun': 41483779188",
  ])
    assert.ok(pair.includes(guard), guard);
  for (const [lane, minutes] of [
    ['library-card', 25],
    ['quick-start', 35],
    ['visual-density', 25],
  ])
    assert.ok(pair.includes(`- lane: ${lane}\n            job_minutes: ${minutes}`));
  const boundary = section(workflow, '  font-author-boundary:\n');
  const beforeRunner = boundary.split('    runs-on:')[0];
  assert.doesNotMatch(beforeRunner, /\bif:|PR1227-only/u);
  assert.equal(
    hash('    runs-on:' + boundary.split('    runs-on:')[1]),
    '29aa42833800e55bb6e5e3363233dc4830eea3e32fa905477043a0f1df7ff398'
  );
  assert.match(
    aggregate,
    /  library-card:\n    needs: select-item-sizing\n    if: \$\{\{ !cancelled\(\) \}\}\n    uses: \.\/\.github\/workflows\/library-card-evidence\.yml/u
  );
  assert.match(liquid, /assert\.equal\(report\.numTotalTests, 18,/u);
  assert.match(liquid, /assert\.equal\(report\.numPassedTests, 18\)/u);
  const identities = JSON.parse(liquid.match(/const expected = (\[[^\n]+\]);/u)?.[1] ?? 'null');
  assert.equal(identities.length, 18);
  assert.equal(new Set(identities).size, 18);
  assert.ok(
    liquid.includes('assert.deepEqual(rows.map(row => row.fullName).sort(), [...expected].sort())')
  );
  assert.ok(liquid.includes("assert.ok(rows.every(row => row.status === 'passed'))"));
  assert.ok(
    plan.includes(
      "'apps/www/src/content/docs/zh-cn/library-card-font-boundary.browser.test.ts':\n    '.github/workflows/library-card-evidence.yml'"
    )
  );
}

test('manual comparison and permanent Card9/font9 ownership retain source gates', () =>
  contract(original));
const mutations = [
  [
    'audit contract disconnected',
    'scheduling',
    "import './library-card-font-workflow.test.mjs';",
    '// import removed',
  ],
  [
    'periodic cycle cancellation restored',
    'workflow',
    '  cancel-in-progress: false',
    '  cancel-in-progress: true',
  ],
  ['automatic fanout', 'workflow', '  workflow_call:', '  pull_request:'],
  ['comparison defaults on', 'workflow', '        default: false', '        default: true'],
  [
    'comparison runs periodically',
    'workflow',
    "github.event_name == 'workflow_dispatch' && inputs.font_comparison == true",
    'true',
  ],
  [
    'original Card9 removed',
    'workflow',
    'assert.equal(report.numTotalTests, 9,',
    'assert.equal(report.numTotalTests, 8,',
  ],
  [
    'source inventory removed',
    'workflow',
    'assert sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k)) == EXPECTED_CHANGED',
    'pass',
  ],
  [
    'original failure waived',
    'workflow',
    "assert all(c['exit'] == 0 for r in rows for c in r['commands'])",
    'assert True',
  ],
  [
    'font9 PR-only again',
    'workflow',
    '  font-author-boundary:\n',
    '  font-author-boundary:\n    if: github.event.pull_request.number == 1227\n',
  ],
  [
    'font9 collect-only',
    'workflow',
    'timeout --signal=TERM --kill-after=10s 960s corepack pnpm@10.32.1 exec vitest run',
    'corepack pnpm@10.32.1 exec vitest list',
  ],
  ['periodic owner removed', 'aggregate', '  library-card:', '  missing-library-card:'],
  [
    'Liquid18 weakened',
    'liquid',
    'assert.equal(report.numTotalTests, 18,',
    'assert.equal(report.numTotalTests, 12,',
  ],
];
for (const [name, field, from, to] of mutations) {
  test('rejects ' + name, () => {
    assert.ok(original[field].includes(from));
    assert.throws(() => contract({ ...original, [field]: original[field].replace(from, to) }));
  });
}
