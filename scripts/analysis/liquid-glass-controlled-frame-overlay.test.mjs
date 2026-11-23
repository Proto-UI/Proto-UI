import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  prepareOverlay,
  verifyOverlay,
  WORKLOAD_FIXTURE,
} from './liquid-glass-controlled-frame-overlay.mjs';
import {
  admitProgressSource,
  assertProgressIdentityStable,
} from './liquid-glass-source-progress.mjs';

const MATERIAL = 'packages/adapters/base/src/material/program.ts';
const KERNEL = 'packages/adapters/base/src/material/liquidgl-kernel.generated.ts';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
async function file(root, relative, contents) {
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), contents);
}
function commit(root) {
  git(root, 'add', '.');
  git(
    root,
    '-c',
    'user.name=Comparison fixture',
    '-c',
    'user.email=fixture@localhost',
    'commit',
    '-qm',
    'controlled measurement fixture'
  );
  return git(root, 'rev-parse', 'HEAD');
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pui-controlled-frame-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = {
    baseline: path.join(root, 'baseline'),
    candidate: path.join(root, 'candidate'),
    output: path.join(root, 'evidence'),
  };
  for (const [kind, directory] of [
    ['baseline', result.baseline],
    ['candidate', result.candidate],
  ]) {
    await mkdir(directory);
    git(directory, '-c', 'init.defaultBranch=main', 'init', '-q');
    await file(
      directory,
      'package.json',
      JSON.stringify({ private: true, packageManager: 'pnpm@10.32.1', marker: kind })
    );
    await file(
      directory,
      'apps/www/package.json',
      JSON.stringify({ name: 'apps-www', version: kind === 'baseline' ? '0.1.0' : '0.2.0' })
    );
    await file(directory, 'pnpm-lock.yaml', `lockfileVersion: '9.0'\n# ${kind}\n`);
    await file(directory, 'pnpm-workspace.yaml', "packages: ['apps/*']\n");
    await file(directory, '.npmrc', 'auto-install-peers=true\n');
    await file(
      directory,
      WORKLOAD_FIXTURE,
      kind === 'baseline' ? '.controls { gap: 21px; }\n' : '.controls { gap: 32px; }\n'
    );
    await file(directory, MATERIAL, `export const algorithm = '${kind}';\n`);
    await file(directory, KERNEL, '// identical generated kernel\n');
    result[`${kind}Sha`] = commit(directory);
  }
  result.receiptFile = path.join(result.output, 'receipt.json');
  return result;
}

test('controlled recipe and fixture overlays preserve each exact algorithm and retain the whole patch', async (t) => {
  const context = await fixture(t);
  const receipt = await prepareOverlay(context);
  assert.match(receipt.attribution, /not a clean historical-source acceptance/);
  assert.equal(
    await readFile(path.join(context.baseline, MATERIAL), 'utf8'),
    "export const algorithm = 'baseline';\n"
  );
  assert.equal(
    await readFile(path.join(context.candidate, MATERIAL), 'utf8'),
    "export const algorithm = 'candidate';\n"
  );
  for (const entry of receipt.inventory)
    assert.equal(
      digest(await readFile(path.join(context.baseline, entry.path))),
      digest(await readFile(path.join(context.candidate, entry.path)))
    );
  assert.ok(receipt.inventory.some((entry) => entry.originalSha256 !== entry.candidateSha256));
  assert.notEqual(receipt.before.baseline.patchSha256, receipt.after.baseline.patchSha256);
  assert.equal(git(context.candidate, 'status', '--porcelain'), '');
  assert.match(
    await readFile(path.join(context.output, 'baseline-overlay.patch'), 'utf8'),
    /gap: 21px/
  );
  assert.equal((await verifyOverlay({ ...context, phase: 'after-preparation' })).passed, true);
});

test('a dirty candidate or wrong exact source is refused before modifying the baseline', async (t) => {
  const context = await fixture(t);
  const original = await readFile(path.join(context.baseline, WORKLOAD_FIXTURE));
  await assert.rejects(
    prepareOverlay({ ...context, baselineSha: 'a'.repeat(40) }),
    /baseline HEAD differs/
  );
  await file(context.candidate, MATERIAL, 'uncommitted algorithm\n');
  await assert.rejects(prepareOverlay(context), /candidate must be clean/);
  assert.deepEqual(await readFile(path.join(context.baseline, WORKLOAD_FIXTURE)), original);
  assert.equal(git(context.baseline, 'status', '--porcelain'), '');
});

test('the dependency topology and original matched kernel cannot be silently normalized', async (t) => {
  const context = await fixture(t);
  await file(context.candidate, KERNEL, 'different kernel algorithm\n');
  context.candidateSha = commit(context.candidate);
  await assert.rejects(prepareOverlay(context), /original matched kernel requirement/);
  await file(context.candidate, 'apps/added/package.json', '{"name":"additional-workspace"}');
  context.candidateSha = commit(context.candidate);
  await assert.rejects(prepareOverlay(context), /dependency recipe file inventory differs/);
  assert.equal(git(context.baseline, 'status', '--porcelain'), '');
});

test('post-preparation algorithm and overlay drift retain failed verification receipts', async (t) => {
  for (const relative of [MATERIAL, 'pnpm-lock.yaml', WORKLOAD_FIXTURE]) {
    const nested = { after: (callback) => t.after(callback) };
    const context = await fixture(nested);
    await prepareOverlay(context);
    await file(context.baseline, relative, 'changed after preparation\n');
    await assert.rejects(
      verifyOverlay({ ...context, phase: 'drift' }),
      /baseline source or overlay changed/
    );
    const evidence = JSON.parse(await readFile(path.join(context.output, 'drift.json'), 'utf8'));
    assert.equal(evidence.passed, false);
  }
});

test('retained patch substitution is an error even when source trees still match', async (t) => {
  const context = await fixture(t);
  await prepareOverlay(context);
  await writeFile(path.join(context.output, 'baseline-overlay.patch'), 'substituted receipt\n');
  await assert.rejects(
    verifyOverlay({ ...context, phase: 'patch-integrity' }),
    /retained overlay patch differs/
  );
});

test('measurement source and end snapshots bind to the prepared dirty baseline and clean candidate', async (t) => {
  const context = await fixture(t);
  const receipt = await prepareOverlay(context);
  const reports = [];
  for (const kind of ['baseline', 'candidate']) {
    const source = {
      sha: receipt.after[kind].sha,
      tree: receipt.after[kind].tree,
      diffSha256: receipt.after[kind].probeDiffSha256,
      hashes: Object.fromEntries(
        await Promise.all(
          [WORKLOAD_FIXTURE, MATERIAL, KERNEL, 'pnpm-lock.yaml'].map(async (relative) => [
            relative,
            digest(await readFile(path.join(context[kind], relative))),
          ])
        )
      ),
    };
    const report = path.join(path.dirname(context.output), `${kind}-report.json`);
    await writeFile(report, JSON.stringify({ source, sourceAtEnd: structuredClone(source) }));
    reports.push(report);
  }
  assert.equal(
    (await verifyOverlay({ ...context, phase: 'paired-reports', reports })).passed,
    true
  );
  const changed = JSON.parse(await readFile(reports[0], 'utf8'));
  changed.sourceAtEnd.diffSha256 = digest('clean baseline wrongly restamped');
  await writeFile(reports[0], JSON.stringify(changed));
  await assert.rejects(
    verifyOverlay({ ...context, phase: 'restamped-report', reports }),
    /measurement patch differs/
  );
});

test('four-host progress admits the exact verified overlay without treating it as a clean source', async (t) => {
  const context = await fixture(t);
  const receipt = await prepareOverlay(context);
  const verification = await verifyOverlay({ ...context, phase: 'before-baseline-progress' });
  const source = {
    sha: receipt.after.baseline.sha,
    tree: receipt.after.baseline.tree,
    changes: receipt.after.baseline.changes,
    diffSha256: receipt.after.baseline.probeDiffSha256,
    hashes: { [MATERIAL]: digest(await readFile(path.join(context.baseline, MATERIAL))) },
  };
  const admission = {
    mode: 'controlled-overlay',
    receiptSha256: verification.receiptSha256,
    source: {
      sha: source.sha,
      tree: source.tree,
      changes: source.changes,
      diffSha256: source.diffSha256,
    },
  };
  const probe = { sha256: 'a'.repeat(64), latencyProbeSha256: 'b'.repeat(64) };
  assert.notEqual(source.changes, '');
  assert.throws(() => assertProgressIdentityStable(source, source, probe, probe));
  assert.doesNotThrow(() =>
    assertProgressIdentityStable(
      source,
      structuredClone(source),
      probe,
      probe,
      admission,
      admission
    )
  );
  for (const mutate of [
    (end) => {
      end.source.diffSha256 = 'c'.repeat(64);
    },
    (end) => {
      end.source.hashes[MATERIAL] = 'd'.repeat(64);
    },
    (end) => {
      end.admission.receiptSha256 = 'e'.repeat(64);
    },
    (end) => {
      end.admission.source.changes = '';
    },
    (end) => {
      end.probe.overlayVerifierSha256 = 'f'.repeat(64);
    },
  ]) {
    const end = {
      source: structuredClone(source),
      admission: structuredClone(admission),
      probe: structuredClone(probe),
    };
    mutate(end);
    assert.throws(() =>
      assertProgressIdentityStable(source, end.source, probe, end.probe, admission, end.admission)
    );
  }
});

async function progressContext(t) {
  const context = await fixture(t);
  const receipt = await prepareOverlay(context);
  const expected = receipt.after.baseline;
  const source = {
    sha: expected.sha,
    tree: expected.tree,
    changes: expected.changes,
    diffSha256: expected.probeDiffSha256,
    hashes: { [MATERIAL]: digest(await readFile(path.join(context.baseline, MATERIAL))) },
  };
  return {
    context,
    source,
    options: { root: context.baseline, source, receiptFile: context.receiptFile },
  };
}

test('progress admission revalidates both source trees before and after the real observation', async (t) => {
  const { context, source, options } = await progressContext(t);
  await assert.rejects(admitProgressSource({ root: context.baseline, source }), /clean checkout/);
  const start = await admitProgressSource({ ...options, phase: 'before-baseline-progress' });
  const end = await admitProgressSource({ ...options, phase: 'after-baseline-progress' });
  assert.deepEqual(end, start);
  assert.equal(start.receiptSha256, digest(await readFile(context.receiptFile)));
  for (const phase of ['before-baseline-progress', 'after-baseline-progress']) {
    const verification = JSON.parse(
      await readFile(path.join(context.output, `${phase}.json`), 'utf8')
    );
    assert.equal(verification.passed, true);
    assert.equal(verification.receiptSha256, start.receiptSha256);
  }
});

test('progress receipt cannot admit an unprepared tree, changed implementation, extra source or overlay drift', async (t) => {
  for (const [tree, relative] of [
    ['baseline', MATERIAL],
    ['baseline', 'pnpm-lock.yaml'],
    ['baseline', 'untracked-source.mjs'],
    ['candidate', MATERIAL],
  ]) {
    const { context, options } = await progressContext(t);
    await admitProgressSource({ ...options, phase: 'before-baseline-progress' });
    await file(context[tree], relative, 'unexpected source change\n');
    await assert.rejects(
      admitProgressSource({ ...options, phase: 'after-baseline-progress' }),
      /source or overlay changed/
    );
    const verification = JSON.parse(
      await readFile(path.join(context.output, 'after-baseline-progress.json'), 'utf8')
    );
    assert.equal(verification.passed, false);
  }
  const { context, options } = await progressContext(t);
  await assert.rejects(
    admitProgressSource({ ...options, root: context.candidate, phase: 'before-baseline-progress' }),
    /prepared baseline tree/
  );
  await assert.rejects(
    admitProgressSource({
      ...options,
      receiptFile: path.join(context.output, 'missing.json'),
      phase: 'before-baseline-progress',
    }),
    /ENOENT/
  );
});

test('progress rejects restamped source identities and a replaced receipt even with unchanged material', async (t) => {
  const { context, source, options } = await progressContext(t);
  const admission = await admitProgressSource({ ...options, phase: 'before-baseline-progress' });
  await writeFile(context.receiptFile, (await readFile(context.receiptFile, 'utf8')) + '\n');
  const changedAdmission = await admitProgressSource({
    ...options,
    phase: 'after-baseline-progress',
  });
  const probe = { sha256: 'a'.repeat(64) };
  assert.throws(
    () => assertProgressIdentityStable(source, source, probe, probe, admission, changedAdmission),
    /Source admission changed/
  );
  const other = await progressContext(t);
  await assert.rejects(
    admitProgressSource({
      ...other.options,
      source: { ...other.source, diffSha256: '0'.repeat(64) },
      phase: 'before-baseline-progress',
    }),
    /Progress source differs from receipt: diffSha256/
  );
});
