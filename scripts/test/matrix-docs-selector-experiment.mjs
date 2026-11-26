import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const columnsPath = 'apps/www/src/components/override/TwoColumnContent.astro';
export const originalSelector = "body:has(.docs-reading-columns[data-layout='docs'])";
// The repeated attribute preserves the original :has(.class[data-layout])
// specificity (0,2,1) without changing the marker's matching set.
export const directSelector =
  "body[data-pui-matrix-docs-selector-experiment='docs'][data-pui-matrix-docs-selector-experiment='docs']";
const anchor = '<div class="docs-reading-columns lg:sl-flex"';
const marker = `<script is:inline data-astro-rerun define:vars={{ layout: isSplash ? 'splash' : 'docs' }}>
  document.body.dataset.puiMatrixDocsSelectorExperiment = layout;
</script>

`;

// Both diagnostic subjects receive the same route marker. Their only difference
// is the two selector conditions; neither is an unchanged-source acceptance run.
export function subjects(source) {
  assert.equal(
    source.split(originalSelector).length - 1,
    2,
    'Expected the two current Toast selectors'
  );
  assert.equal(source.split(anchor).length - 1, 1, 'Expected the current reading-canvas owner');
  assert(
    !source.includes('puiMatrixDocsSelectorExperiment'),
    'Source already carries the experiment'
  );
  assert(
    source.includes('--docs-preview-header-height, 3.75rem'),
    'Preserve the landed Header fallback'
  );
  const baseline = source.replace(anchor, marker + anchor);
  const direct = baseline.replaceAll(originalSelector, directSelector);
  assert.equal(direct.replaceAll(directSelector, originalSelector), baseline);
  return { baseline, direct };
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const generatedNames = [
  'shadcn-theme.css',
  'proto-ui-style.css',
  'proto-ui-tokens.generated.css',
  'proto-ui-shadow-style.generated.js',
  'proto-ui-shadow-style.generated.d.ts',
];

export function createSubjectDirectory(directory, subject) {
  assert(['baseline', 'direct'].includes(subject));
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, subject);
  // Exclusive creation rejects any stale report, including a previous failed
  // attempt. Never relabel old browser output with a fresh source record.
  mkdirSync(target);
  return target;
}

export function validateObservation(source, report, exitText, phases) {
  const selected = report.testResults
    .flatMap((file) => file.assertionResults)
    .filter((item) => item.title === 'mounts every demo in every official Web adapter');
  assert.equal(selected.length, 1, 'Expected exactly one original selected case');
  const test = selected[0];
  assert(['passed', 'failed'].includes(test.status), 'The selected case did not execute');
  assert.deepEqual(test.ancestorTitles, ['Website Demo Matrix browser smoke']);
  assert.equal(test.fullName, [...test.ancestorTitles, test.title].join(' '));
  // Vitest 2 JSON joins names with spaces; expect.getState() uses " > ".
  const phaseCaseName = [...test.ancestorTitles, test.title].join(' > ');
  for (const phase of phases) {
    assert.equal(
      phase.sourceSha,
      source.baseHead,
      'Readiness source differs from the diagnostic base'
    );
    assert.equal(phase.caseName, phaseCaseName, 'Readiness belongs to another case');
  }
  assert(
    phases.some((phase) => phase.phase === 'route-open' && phase.outcome === 'started'),
    'No actual browser-route observation'
  );
  assert(/^(?:0|[1-9][0-9]{0,2})\n?$/.test(exitText), 'Missing or invalid process exit code');
  const exitCode = Number(exitText.trim());
  assert(exitCode <= 255, 'Process exit code is outside the shell range');
  return { case: test, exitCode, phases };
}

function sourceRecord(subject) {
  assert(
    /^template:\s*splash\s*$/m.test(
      readFileSync('apps/www/src/content/docs/zh-cn/internal/demo-matrix.mdx', 'utf8')
    ),
    'The Matrix layout changed; reconsider the diagnostic hypothesis before running'
  );
  const changes = git('diff', '--name-only', 'HEAD').trim().split('\n').filter(Boolean);
  assert.deepEqual(changes, [columnsPath], 'Only the diagnostic canvas source may change');
  const staged = git('diff', '--cached', '--name-only').trim();
  assert.equal(staged, '', 'No staged source changes are allowed in an evidence checkout');
  const immutable = [
    'pnpm-lock.yaml',
    'apps/www/src/content/docs/zh-cn/demo-matrix.browser.test.ts',
    'apps/www/src/content/docs/zh-cn/demo-matrix-activation.ts',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    'apps/www/src/content/docs/zh-cn/internal/demo-matrix.mdx',
  ].map((file) => ({ path: file, sha256: hash(readFileSync(file)) }));
  return {
    schemaVersion: 1,
    subject,
    diagnosticOnly: true,
    establishesPerformanceAcceptance: false,
    at: new Date().toISOString(),
    baseHead: git('rev-parse', 'HEAD').trim(),
    baseTree: git('rev-parse', 'HEAD^{tree}').trim(),
    adapterTree: git('rev-parse', 'HEAD:packages/adapters').trim(),
    changedFiles: changes,
    immutable,
    columnsSha256: hash(readFileSync(columnsPath)),
    dirtySourceMeaning:
      'The recorded base head plus the retained one-file patch is the actual diagnostic source.',
    marker: 'Identical website route marker in both subjects, including Astro script reruns.',
    matrixLayout:
      'The current Matrix uses template: splash. Both docs conditions are false here; the comparison investigates broad relational dependency/invalidation cost, not active Toast paint.',
    intervention:
      subject === 'direct'
        ? 'Replace only the two document-wide Toast selector conditions.'
        : 'Retain both original body:has selector conditions.',
    caseName: 'mounts every demo in every official Web adapter',
    initializationBudgetMs: 60_000,
    originalCaseDeadlineMs: 180_000,
    cacheBoundary:
      'Each subject launches a fresh browser. Vite/filesystem caches may be warm in the second run; original complete module delivery still precedes the initialization clock.',
  };
}

function prepare(subject, directory) {
  assert(['baseline', 'direct'].includes(subject));
  const original = git('show', `HEAD:${columnsPath}`);
  const variants = subjects(original);
  const current = readFileSync(columnsPath, 'utf8');
  assert.equal(
    current,
    subject === 'baseline' ? original : variants.baseline,
    'Refuse an unexpected worktree source'
  );
  if (subject === 'baseline')
    assert.equal(
      git('diff', '--name-only', 'HEAD').trim(),
      '',
      'Baseline requires a clean tracked source'
    );
  else {
    const before = json(path.join(directory, 'baseline', 'source.json'));
    assert.equal(before.baseHead, git('rev-parse', 'HEAD').trim());
    sourceRecord('baseline');
  }
  const target = createSubjectDirectory(directory, subject);
  writeFileSync(columnsPath, variants[subject]);
  write(path.join(target, 'source.json'), sourceRecord(subject));
  writeFileSync(path.join(target, 'source.patch'), git('diff', '--binary', '--', columnsPath));
}

function finish(subject, directory) {
  const target = path.join(directory, subject);
  const before = json(path.join(target, 'source.json'));
  const after = sourceRecord(subject);
  assert.equal(after.baseHead, before.baseHead);
  assert.equal(after.columnsSha256, before.columnsSha256);
  assert.deepEqual(after.immutable, before.immutable);
  const generated = generatedNames.map((name) => {
    const file = `apps/www/src/styles/${name}`;
    try {
      return { path: file, sha256: hash(readFileSync(file)) };
    } catch {
      return { path: file, missing: true };
    }
  });
  write(path.join(target, 'source-after.json'), { ...after, generated });
}

function summarize(directory) {
  const result = {
    schemaVersion: 1,
    diagnosticOnly: true,
    establishesPerformanceAcceptance: false,
    at: new Date().toISOString(),
    subjects: [],
    failures: [],
    scope:
      'A sequential, instrumented selector comparison. It cannot certify all four Matrix cases or production performance.',
  };
  for (const subject of ['baseline', 'direct']) {
    const target = path.join(directory, subject);
    try {
      const source = json(path.join(target, 'source-after.json'));
      const report = json(path.join(target, 'vitest.json'));
      const readiness = path.join(target, 'demo-matrix', 'readiness');
      const phases = readdirSync(readiness)
        .filter((name) => name.endsWith('.json'))
        .map((name) => json(path.join(readiness, name)));
      result.subjects.push({
        subject,
        source,
        ...validateObservation(
          source,
          report,
          readFileSync(path.join(target, 'exit-code.txt'), 'utf8'),
          phases
        ),
      });
    } catch (error) {
      result.failures.push({ subject, error: String(error) });
    }
  }
  if (result.subjects.length === 2) {
    const [baseline, direct] = result.subjects;
    for (const key of ['baseHead', 'baseTree', 'adapterTree'])
      assert.equal(
        baseline.source[key],
        direct.source[key],
        `${key} changed across the comparison`
      );
    assert.deepEqual(baseline.source.immutable, direct.source.immutable);
    assert.deepEqual(
      baseline.source.generated,
      direct.source.generated,
      'Generated adapter/style inputs changed'
    );
  }
  write(path.join(directory, 'comparison.json'), result);
  assert.equal(
    result.failures.length,
    0,
    'Incomplete diagnostic observations; inspect retained failures'
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, subject, directory] = process.argv.slice(2);
  if (command === 'summary') summarize(path.resolve(subject));
  else {
    assert(directory, 'An explicit evidence directory is required');
    if (command === 'prepare') prepare(subject, path.resolve(directory));
    else if (command === 'finish') finish(subject, path.resolve(directory));
    else throw new Error('Expected prepare, finish or summary');
  }
}
