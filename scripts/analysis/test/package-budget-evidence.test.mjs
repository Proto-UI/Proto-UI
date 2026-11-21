import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertBudgetCandidate,
  assertStableBudgetSource,
  captureBudgetSource,
  describeBudgetClosure,
} from '../package-budget-evidence.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'pui-budget-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git(['init']);
  git(['config', 'user.email', 'fixture@example.invalid']);
  git(['config', 'user.name', 'Budget Test Fixture']);
  mkdirSync(join(root, 'packages/runtime/src'), { recursive: true });
  writeFileSync(join(root, 'packages/runtime/src/index.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'tsconfig.json'), '{}\n');
  git(['add', '.']);
  git(['commit', '-m', 'synthetic budget source']);
  return { root, git };
}

test('source receipt distinguishes a clean commit, dirty tracked source and added dependencies', (t) => {
  const { root } = fixture(t);
  const clean = captureBudgetSource(root);
  assert.equal(clean.receipt.workingTreeClean, true);
  assert.equal(clean.receipt.measuredSourceMatchesHead, true);
  assert.match(clean.receipt.head, /^[a-f0-9]{40}$/);
  assertStableBudgetSource(clean, captureBudgetSource(root));
  writeFileSync(join(root, 'packages/runtime/src/index.ts'), 'export const value = 2;\n');
  const changed = captureBudgetSource(root);
  assert.equal(changed.receipt.measuredSourceMatchesHead, false);
  assert.throws(() => assertStableBudgetSource(clean, changed), /source changed/);
  writeFileSync(join(root, 'packages/runtime/src/new.ts'), 'export const fresh = true;\n');
  const added = captureBudgetSource(root);
  assert.equal(added.files.size, changed.files.size + 1);
  assert.throws(() => assertStableBudgetSource(changed, added), /source changed/);
});

test('a different Git head cannot reuse a same-content receipt', (t) => {
  const { root, git } = fixture(t);
  const before = captureBudgetSource(root);
  git(['commit', '--allow-empty', '-m', 'different candidate']);
  assert.throws(() => assertStableBudgetSource(before, captureBudgetSource(root)), /\(head\)/);
});

test('absent or invalid stability receipts cannot compare equal', () => {
  assert.throws(() => assertStableBudgetSource(undefined, undefined), /invalid source stability/);
  assert.throws(
    () => assertStableBudgetSource({ receipt: {} }, { receipt: {} }),
    /invalid source stability/
  );
});

test('canonical candidate checks reject a dirty tree or wrong head even if stable', (t) => {
  const { root } = fixture(t);
  const clean = captureBudgetSource(root);
  assertBudgetCandidate(clean, { requireClean: true, expectedSha: clean.receipt.head });
  assert.throws(
    () => assertBudgetCandidate(clean, { expectedSha: 'a'.repeat(40) }),
    /expected candidate/
  );
  assert.throws(() => assertBudgetCandidate(clean, { expectedSha: 'short' }), /invalid expected/);
  writeFileSync(join(root, 'packages/runtime/src/index.ts'), 'export const value = 2;\n');
  const dirty = captureBudgetSource(root);
  assertStableBudgetSource(dirty, captureBudgetSource(root));
  assertBudgetCandidate(dirty); // Explicitly local diagnostics remain useful.
  assert.throws(
    () => assertBudgetCandidate(dirty, { requireClean: true, expectedSha: clean.receipt.head }),
    /clean candidate/
  );
  assert.throws(() => assertBudgetCandidate(undefined, { requireClean: true }), /clean candidate/);
});

test('dependency receipt retains reached bytes and hashes while including zero-retained inputs', (t) => {
  const { root } = fixture(t);
  const path = 'packages/runtime/src/index.ts';
  const source = captureBudgetSource(root);
  const meta = {
    inputs: { [path]: { bytes: source.files.get(path).bytes }, 'tsconfig.json': { bytes: 3 } },
    outputs: { 'out.js': { bytes: 15, inputs: { [path]: { bytesInOutput: 12 } } } },
  };
  const closure = describeBudgetClosure({ metafile: meta, root, source });
  assert.equal(closure.inputCount, 2);
  assert.equal(closure.retainedInputCount, 1);
  assert.equal(closure.inputs.find((input) => input.path === path).retainedBytes, 12);
  assert.equal(closure.inputs.find((input) => input.path === 'tsconfig.json').retainedBytes, 0);
  assert.deepEqual(closure.contributions[0], { path: 'packages/runtime', retainedBytes: 12 });
  assert.match(closure.fingerprintSha256, /^[a-f0-9]{64}$/);
  assert.match(closure.attributionUnit, /not additive/);
});

test('unbound dependencies, escaped sources, missing metadata and invalid attribution fail closed', (t) => {
  const { root } = fixture(t);
  const source = captureBudgetSource(root);
  const path = 'packages/runtime/src/index.ts';
  const good = () => ({
    inputs: { [path]: { bytes: source.files.get(path).bytes } },
    outputs: { 'out.js': { bytes: 15, inputs: { [path]: { bytesInOutput: 12 } } } },
  });
  for (const meta of [undefined, {}, { inputs: {}, outputs: {} }]) {
    assert.throws(() => describeBudgetClosure({ metafile: meta, root, source }), /metadata/);
  }
  const wrongSize = good();
  wrongSize.inputs[path].bytes += 1;
  assert.throws(() => describeBudgetClosure({ metafile: wrongSize, root, source }), /not bound/);
  for (const invalid of ['packages/runtime/src/missing.ts', '../other-checkout/source.ts']) {
    const meta = good();
    meta.inputs[invalid] = { bytes: 1 };
    assert.throws(
      () => describeBudgetClosure({ metafile: meta, root, source }),
      /not bound|escapes/
    );
  }
  const invalidBytes = good();
  invalidBytes.outputs['out.js'].inputs[path].bytesInOutput = NaN;
  assert.throws(
    () => describeBudgetClosure({ metafile: invalidBytes, root, source }),
    /retained dependency/
  );
  const unknownOutputInput = good();
  unknownOutputInput.outputs['out.js'].inputs['ghost.ts'] = { bytesInOutput: 1 };
  assert.throws(
    () => describeBudgetClosure({ metafile: unknownOutputInput, root, source }),
    /retained dependency/
  );
});
