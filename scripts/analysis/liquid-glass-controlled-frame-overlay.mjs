import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a separate experiment. The original clean-source comparison and its
// matched assertions are unchanged. Only the dependency recipe and workload
// fixture are overlaid; the baseline implementation remains its own Git source.
export const WORKLOAD_FIXTURE = 'apps/www/src/pages/en/test/liquid-glass-material.astro';
const KERNEL = 'packages/adapters/base/src/material/liquidgl-kernel.generated.ts';
const MATERIAL = 'packages/adapters/base/src/material/';
const RECIPE_CONFIG = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs']);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 << 20 });
const gitText = (root, ...args) =>
  git(root, ...args)
    .toString('utf8')
    .trim();
const tracked = (root) =>
  git(root, 'ls-tree', '-r', '--name-only', '-z', 'HEAD')
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
const recipePaths = (files) =>
  files.filter(
    (file) =>
      file === 'package.json' ||
      file.endsWith('/package.json') ||
      RECIPE_CONFIG.has(file) ||
      file.startsWith('patches/')
  );

function checkRevision(actual, expected, description) {
  assert.match(expected, /^[a-f0-9]{40}$/, `${description} needs an exact commit`);
  assert.equal(actual, expected, `${description} HEAD differs`);
}
async function regularFile(root, relative) {
  assert.ok(
    !path.isAbsolute(relative) && !relative.split('/').includes('..'),
    'relative tracked path required'
  );
  const resolved = path.join(root, relative);
  assert.ok((await lstat(resolved)).isFile(), `regular file required: ${relative}`);
  assert.equal(await realpath(resolved), resolved, `symlink in source path: ${relative}`);
  return readFile(resolved);
}
async function hashes(root, files) {
  return Object.fromEntries(
    await Promise.all(files.map(async (file) => [file, sha256(await regularFile(root, file))]))
  );
}
async function unchangedImplementation(root, files) {
  const actual = await hashes(root, files);
  for (const file of files)
    assert.equal(
      actual[file],
      sha256(git(root, 'show', `HEAD:${file}`)),
      `material implementation differs from its own Git source: ${file}`
    );
  return actual;
}
function snapshot(root) {
  const patch = git(root, 'diff', '--binary', 'HEAD');
  return {
    sha: gitText(root, 'rev-parse', 'HEAD'),
    tree: gitText(root, 'rev-parse', 'HEAD^{tree}'),
    changes: gitText(root, 'status', '--porcelain=v1', '--untracked-files=all'),
    patchSha256: sha256(patch),
    // The existing measurement's sourceSnapshot trims Git's diff text.
    probeDiffSha256: sha256(patch.toString('utf8').trim()),
  };
}
function assertSnapshot(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} source or overlay changed`);
}
async function roots(baseline, candidate, output) {
  baseline = await realpath(baseline);
  candidate = await realpath(candidate);
  assert.notEqual(baseline, candidate, 'independent source trees required');
  for (const root of [baseline, candidate]) {
    const relative = path.relative(root, output);
    assert.ok(
      relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
      'evidence must be outside both source trees'
    );
  }
  return { baseline, candidate };
}

export async function prepareOverlay({ baseline, candidate, baselineSha, candidateSha, output }) {
  assert.ok(path.isAbsolute(output), 'an absent absolute evidence directory is required');
  ({ baseline, candidate } = await roots(baseline, candidate, output));
  const before = { baseline: snapshot(baseline), candidate: snapshot(candidate) };
  checkRevision(before.baseline.sha, baselineSha, 'baseline');
  checkRevision(before.candidate.sha, candidateSha, 'candidate');
  assert.equal(before.baseline.changes, '', 'baseline must be clean before the controlled overlay');
  assert.equal(
    before.candidate.changes,
    '',
    'candidate must be clean before the controlled overlay'
  );
  const baselineFiles = tracked(baseline),
    candidateFiles = tracked(candidate);
  const dependencyRecipe = recipePaths(candidateFiles);
  assert.deepEqual(
    recipePaths(baselineFiles),
    dependencyRecipe,
    'dependency recipe file inventory differs; select an explicitly reviewed topology-compatible experiment'
  );
  for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
    assert.ok(dependencyRecipe.includes(file), `missing dependency recipe: ${file}`);
  for (const file of [WORKLOAD_FIXTURE, KERNEL])
    assert.ok(
      baselineFiles.includes(file) && candidateFiles.includes(file),
      `missing source: ${file}`
    );
  assert.equal(
    sha256(await regularFile(baseline, KERNEL)),
    sha256(await regularFile(candidate, KERNEL)),
    'the original matched kernel requirement must already hold; the algorithm is not overlaid'
  );
  const overlayPaths = [...dependencyRecipe, WORKLOAD_FIXTURE].sort();
  const inventory = await Promise.all(
    overlayPaths.map(async (file) => {
      const [original, replacement] = await Promise.all([
        regularFile(baseline, file),
        regularFile(candidate, file),
      ]);
      return {
        path: file,
        originalSha256: sha256(original),
        candidateSha256: sha256(replacement),
        bytes: replacement.length,
      };
    })
  );
  const baselineImplementation = await unchangedImplementation(
    baseline,
    baselineFiles.filter((file) => file.startsWith(MATERIAL))
  );
  const candidateImplementation = await unchangedImplementation(
    candidate,
    candidateFiles.filter((file) => file.startsWith(MATERIAL))
  );
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // A previous receipt can never be silently replaced.
  for (const { path: file } of inventory)
    await writeFile(path.join(baseline, file), await regularFile(candidate, file));
  const after = { baseline: snapshot(baseline), candidate: snapshot(candidate) };
  assertSnapshot(after.candidate, before.candidate, 'candidate');
  assert.deepEqual(
    await hashes(baseline, Object.keys(baselineImplementation)),
    baselineImplementation,
    'baseline material implementation changed'
  );
  for (const entry of inventory)
    for (const root of [baseline, candidate])
      assert.equal(
        sha256(await regularFile(root, entry.path)),
        entry.candidateSha256,
        `overlay input changed during preparation: ${entry.path}`
      );
  const changed = git(baseline, 'diff', '--name-only', '-z', 'HEAD')
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  assert.ok(
    changed.every((file) => overlayPaths.includes(file)),
    'overlay changed an implementation file'
  );
  const patch = git(baseline, 'diff', '--binary', 'HEAD');
  await writeFile(path.join(output, 'baseline-overlay.patch'), patch, { flag: 'wx' });
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.liquid-frame-controlled-overlay',
    attribution:
      'baseline algorithm + candidate dependency recipe and exact workload fixture; not a clean historical-source acceptance',
    createdAt: new Date().toISOString(),
    roots: { baseline, candidate },
    before,
    after,
    dependencyRecipe,
    inventory,
    implementation: { baseline: baselineImplementation, candidate: candidateImplementation },
    patch: { file: 'baseline-overlay.patch', sha256: sha256(patch) },
  };
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  await writeFile(
    path.join(output, 'README.md'),
    [
      '# Controlled-overlay frame experiment',
      '',
      `Baseline algorithm: \`${baselineSha}\`. Candidate source and dependency recipe: \`${candidateSha}\`.`,
      '',
      'The baseline working tree is deliberately modified only by the retained dependency recipe and exact candidate workload fixture. This is not a clean historical-source acceptance or a replacement for the retained failed clean comparison. The original matched assertions still execute.',
      '',
      '`receipt.json` binds both clean inputs, the exact overlay inventory, implementation hashes and resulting patch. Verification receipts recheck both source trees after installation and measurement. `baseline-overlay.patch` is the complete tracked baseline change.',
      '',
      'Browser observation, native framework execution and physical presentation/input remain separate evidence.',
      '',
    ].join('\n'),
    { flag: 'wx' }
  );
  return receipt;
}

async function verifyMeasurement(file, root, expected) {
  const report = JSON.parse(await readFile(file, 'utf8'));
  for (const source of [report.source, report.sourceAtEnd]) {
    assert.equal(source.sha, expected.sha, 'measurement HEAD differs from overlay receipt');
    assert.equal(source.tree, expected.tree, 'measurement Git tree differs from overlay receipt');
    assert.equal(
      source.diffSha256,
      expected.probeDiffSha256,
      'measurement patch differs from overlay receipt'
    );
    assert.ok(Object.keys(source.hashes).length, 'measurement source hashes are required');
    for (const [relative, digest] of Object.entries(source.hashes))
      assert.equal(
        sha256(await regularFile(root, relative)),
        digest,
        `measurement source differs: ${relative}`
      );
  }
  return {
    file: path.basename(path.dirname(file)) + '/' + path.basename(file),
    sha256: sha256(await readFile(file)),
  };
}
export async function verifyOverlay({ receiptFile, baseline, candidate, phase, reports }) {
  assert.match(phase, /^[a-z][a-z0-9-]*$/, 'a bounded verification phase is required');
  const output = path.dirname(path.resolve(receiptFile));
  ({ baseline, candidate } = await roots(baseline, candidate, output));
  const raw = await readFile(receiptFile),
    receipt = JSON.parse(raw);
  assert.equal(receipt.kind, 'proto-ui.liquid-frame-controlled-overlay');
  assert.deepEqual(
    { baseline, candidate },
    receipt.roots,
    'verification must use the prepared source trees'
  );
  const result = {
    schemaVersion: 1,
    kind: receipt.kind + '-verification',
    phase,
    receiptSha256: sha256(raw),
    verifiedAt: new Date().toISOString(),
    passed: false,
  };
  try {
    assertSnapshot(snapshot(baseline), receipt.after.baseline, 'baseline');
    assertSnapshot(snapshot(candidate), receipt.after.candidate, 'candidate');
    assert.equal(snapshot(candidate).changes, '', 'the candidate must remain a clean exact source');
    assert.equal(
      gitText(baseline, 'ls-files', '--others', '--exclude-standard'),
      '',
      'the baseline cannot acquire untracked source'
    );
    assert.equal(
      sha256(await readFile(path.join(output, receipt.patch.file))),
      receipt.patch.sha256,
      'retained overlay patch differs'
    );
    assert.deepEqual(
      recipePaths(tracked(candidate)),
      receipt.dependencyRecipe,
      'candidate dependency recipe inventory changed'
    );
    assert.deepEqual(
      receipt.inventory.map((entry) => entry.path),
      [...receipt.dependencyRecipe, WORKLOAD_FIXTURE].sort(),
      'only the dependency recipe and workload fixture may be overlaid'
    );
    const changed = git(baseline, 'diff', '--name-only', '-z', 'HEAD')
      .toString('utf8')
      .split('\0')
      .filter(Boolean);
    assert.ok(
      changed.every((file) => receipt.inventory.some((entry) => entry.path === file)),
      'baseline changed outside the controlled overlay'
    );
    for (const entry of receipt.inventory)
      for (const root of [baseline, candidate])
        assert.equal(
          sha256(await regularFile(root, entry.path)),
          entry.candidateSha256,
          `overlay input differs: ${entry.path}`
        );
    for (const [name, root] of [
      ['baseline', baseline],
      ['candidate', candidate],
    ])
      assert.deepEqual(
        await unchangedImplementation(
          root,
          tracked(root).filter((file) => file.startsWith(MATERIAL))
        ),
        receipt.implementation[name],
        `${name} implementation changed`
      );
    if (reports) {
      assert.equal(reports.length, 2, 'both measurements are required');
      result.reports = [
        await verifyMeasurement(reports[0], baseline, receipt.after.baseline),
        await verifyMeasurement(reports[1], candidate, receipt.after.candidate),
      ];
    }
    result.passed = true;
  } catch (error) {
    result.failure = String(error);
  }
  await writeFile(path.join(output, `${phase}.json`), JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  assert.ok(result.passed, result.failure);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  let result;
  if (mode === 'prepare' && args.length === 5)
    result = await prepareOverlay({
      baseline: args[0],
      candidate: args[1],
      baselineSha: args[2],
      candidateSha: args[3],
      output: path.resolve(args[4]),
    });
  else if (mode === 'verify' && [4, 6].includes(args.length))
    result = await verifyOverlay({
      receiptFile: args[0],
      baseline: args[1],
      candidate: args[2],
      phase: args[3],
      reports: args.length === 6 ? args.slice(4) : undefined,
    });
  else
    throw new Error(
      'Usage: prepare BASELINE CANDIDATE BASELINE_SHA CANDIDATE_SHA OUTPUT | verify RECEIPT BASELINE CANDIDATE PHASE [BASELINE_REPORT CANDIDATE_REPORT]'
    );
  console.log(
    JSON.stringify({
      kind: result.kind,
      passed: result.passed,
      phase: result.phase,
      attribution: result.attribution,
    })
  );
}
