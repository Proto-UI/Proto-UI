import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  FINF_LEDGER,
  FINF_BUDGET_ENTRIES,
  collectBudgetReport,
  measureBuildOutput,
  parseBudgetArguments,
  resolveBudgetPolicy,
} from '../package-budget-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ledger = JSON.parse(readFileSync(resolve(root, FINF_LEDGER), 'utf8'));
const withLedger = (data) =>
  resolveBudgetPolicy({ finfDevelopment: true, root, read: () => JSON.stringify(data) });
const developmentFixture = structuredClone(ledger);
for (const item of [
  ...developmentFixture.deliveryPlan.items,
  ...developmentFixture.deliveryPlan.priorWork,
])
  item.complete = false;
developmentFixture.deliveryPlan.checkedCoreTodos = 0;
const environment = {
  node: process.version,
  zlib: process.versions.zlib,
  esbuild: 'test-fixture',
  platform: process.platform,
  arch: process.arch,
};
const entry = 'packages/adapters/react/src/index.ts';
const measurement = { minifiedBytes: 388240, minifiedSha256: 'a'.repeat(64), gzipBytes: 106392 };
const report = (overrides = {}) =>
  collectBudgetReport({
    cases: [['React fixture', entry, 106000]],
    diagnostics: [],
    measure: async () => measurement,
    environment,
    policy: withLedger(developmentFixture),
    ...overrides,
  });

test('default is strict without reading any Finf ledger; unknown/duplicate flags fail', () => {
  assert.equal(
    resolveBudgetPolicy({
      read: () => {
        throw new Error('must not read');
      },
    }).mode,
    'strict'
  );
  assert.deepEqual(parseBudgetArguments([]), { json: false, finfDevelopment: false });
  assert.equal(parseBudgetArguments(['--json', '--finf-development']).finfDevelopment, true);
  for (const args of [['--advisory'], ['--finf-development', '--finf-development']])
    assert.throws(() => parseBudgetArguments(args));
});

test('Finf phase uses the real 55+13 full-delivery ledger, not family/entity totals', () => {
  const policy = withLedger(ledger);
  assert.equal(policy.totalItems, 68);
  assert.equal(
    policy.recordedCompleteItems,
    [...ledger.deliveryPlan.items, ...ledger.deliveryPlan.priorWork].filter((x) => x.complete)
      .length
  );
  assert.equal(policy.completionIsAcceptance, false);
  assert.match(policy.ledgerSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(policy.advisoryEntries, FINF_BUDGET_ENTRIES);
});

test('automatic expiry restores strict at all 68 recorded completions, without certifying acceptance', async () => {
  const complete = structuredClone(ledger);
  for (const item of [...complete.deliveryPlan.items, ...complete.deliveryPlan.priorWork])
    item.complete = true;
  complete.deliveryPlan.checkedCoreTodos = 55;
  const policy = withLedger(complete);
  assert.equal(policy.mode, 'strict');
  assert.equal(policy.recordedCompleteItems, 68);
  assert.equal((await report({ policy })).exitCode, 1);
  complete.deliveryPlan.priorWork[0].complete = false;
  assert.equal(withLedger(complete).mode, 'finf-development-advisory');
});

test('missing, unparsable and malformed Finf state fails closed', () => {
  assert.throws(
    () =>
      resolveBudgetPolicy({
        finfDevelopment: true,
        root,
        read: () => {
          throw new Error('ENOENT');
        },
      }),
    /ENOENT/
  );
  assert.throws(
    () => resolveBudgetPolicy({ finfDevelopment: true, root, read: () => '{broken' }),
    SyntaxError
  );
  for (const mutate of [
    (d) => delete d.deliveryPlan,
    (d) => {
      d.tracker = 999;
    },
    (d) => {
      d.deliveryPlan.initialTodoCount = 63;
    },
    (d) => d.deliveryPlan.items.pop(),
    (d) => {
      d.deliveryPlan.items[0].complete = 'false';
    },
    (d) => {
      d.deliveryPlan.items[0].id = d.deliveryPlan.items[1].id;
    },
    (d) => {
      d.deliveryPlan.checkedCoreTodos = NaN;
    },
  ]) {
    const data = structuredClone(ledger);
    mutate(data);
    assert.throws(() => withLedger(data), /Finf/);
  }
});

test('over-budget Finf result stays false with exact excess while strict and out-of-scope still fail', async () => {
  const advisory = await report();
  assert.equal(advisory.exitCode, 0);
  assert.equal(advisory.withinBudgets, false);
  assert.deepEqual(advisory.results[0], {
    name: 'React fixture',
    entry,
    ...measurement,
    budget: 106000,
    pass: false,
    overBudgetBytes: 392,
    blocking: false,
  });
  assert.equal((await report({ policy: resolveBudgetPolicy() })).exitCode, 1);
  assert.equal(
    (await report({ cases: [['unrelated', 'packages/other/src/index.ts', 106000]] })).exitCode,
    1
  );
  const within = await report({ measure: async () => ({ ...measurement, gzipBytes: 106000 }) });
  assert.equal(within.withinBudgets, true);
  assert.equal(within.results[0].overBudgetBytes, 0);
});

test('advisory does not swallow build failures or missing/invalid/NaN measurements', async () => {
  await assert.rejects(
    report({
      measure: async () => {
        throw new Error('build failure');
      },
    }),
    /build failure/
  );
  for (const value of [
    undefined,
    {},
    { ...measurement, gzipBytes: NaN },
    { ...measurement, gzipBytes: Infinity },
    { ...measurement, gzipBytes: 0 },
    { ...measurement, minifiedBytes: -1 },
    { ...measurement, minifiedSha256: 'missing' },
  ]) {
    await assert.rejects(report({ measure: async () => value }), /invalid measurement/);
  }
  await assert.rejects(report({ environment: {} }), /toolchain/);
  await assert.rejects(report({ cases: [] }), /missing measurement cases/);
  await assert.rejects(report({ cases: [['bad', entry, NaN]] }), /baseline budget/);
  await assert.rejects(
    report({
      diagnostics: [['diagnostic', 'fixture']],
      measure: async (path) => (path === entry ? measurement : undefined),
    }),
    /invalid measurement/
  );
});

test('missing and empty build outputs fail; real bytes retain hash/raw/gzip measurement', () => {
  for (const value of [
    undefined,
    {},
    { outputFiles: [] },
    { errors: ['failed build'], outputFiles: [{ contents: Buffer.from('partial') }] },
    { outputFiles: [{}] },
    { outputFiles: [{ contents: new Uint8Array() }] },
  ]) {
    assert.throws(() => measureBuildOutput(value), /missing or empty/);
  }
  const result = measureBuildOutput({ outputFiles: [{ contents: Buffer.from('fixture bytes') }] });
  assert.equal(result.minifiedBytes, 13);
  assert.ok(result.gzipBytes > 0);
  assert.match(result.minifiedSha256, /^[a-f0-9]{64}$/);
});

test('actual repository/CI and snapshot entrypoints explicitly select Finf; strict entrypoint stays available', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['check:package-budgets'],
    'node scripts/analysis/package-budgets.mjs --finf-development'
  );
  assert.equal(
    pkg.scripts['check:package-budgets:strict'],
    'node scripts/analysis/package-budgets.mjs'
  );
  assert.match(
    readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'),
    /corepack pnpm@10\.32\.1 check:package-budgets/
  );
  assert.match(
    readFileSync(resolve(root, 'scripts/analysis/monorepo-snapshot.mjs'), 'utf8'),
    /scripts\/analysis\/package-budgets.mjs', '--json', '--finf-development'/
  );
});

test('real CLI exits nonzero for strict overflow/build/missing output and reports advisory overflow as false', () => {
  const temp = mkdtempSync(join(tmpdir(), 'pui-budget-cli-'));
  try {
    // Test-only in-process module hook, no network/build or production injection path.
    const hook = join(temp, 'hook.mjs');
    writeFileSync(
      hook,
      `import { registerHooks } from 'node:module';
const source = \`export const version = 'test-fixture';
export async function build(options) {
  if (process.env.BUDGET_TEST_MODE === 'error') throw new Error('test build failed');
  if (process.env.BUDGET_TEST_MODE === 'missing') return { outputFiles: [] };
  const contents = Buffer.alloc(120000); let seed = 1;
  for (let i = 0; i < contents.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; contents[i] = seed & 255; }
  return { outputFiles: [{ contents: options.entryPoints[0].includes('/adapters/react/') ? contents : Buffer.from('fixture') }] };
}\`;
registerHooks({ resolve(specifier, context, next) {
  return specifier === 'esbuild' ? { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true } : next(specifier, context);
} });`
    );
    const run = (args, mode = 'over') =>
      spawnSync(
        process.execPath,
        ['--import', hook, 'scripts/analysis/package-budgets.mjs', '--json', ...args],
        { cwd: root, encoding: 'utf8', env: { ...process.env, BUDGET_TEST_MODE: mode } }
      );
    const strict = run([]);
    assert.equal(strict.status, 1, strict.stderr);
    assert.equal(JSON.parse(strict.stdout).results.find((x) => x.entry === entry).pass, false);
    const advisory = run(['--finf-development']);
    assert.equal(advisory.status, withLedger(ledger).mode === 'strict' ? 1 : 0, advisory.stderr);
    const data = JSON.parse(advisory.stdout);
    assert.equal(data.results.length, 9);
    assert.equal(data.results.find((x) => x.entry === entry).pass, false);
    assert.ok(data.results.find((x) => x.entry === entry).overBudgetBytes > 0);
    for (const mode of ['error', 'missing'])
      assert.equal(run(['--finf-development'], mode).status, 1);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
