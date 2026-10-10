import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

export const FINF_LEDGER = 'internal/coverage-matrices/prototype-coverage-matrix.json';
export const FINF_BUDGET_ENTRIES = Object.freeze([
  'packages/prototypes/lucide/src/icons/x.ts',
  'packages/prototypes/lucide/src/index.ts',
  'packages/core/src/index.ts',
  'packages/runtime/src/index.ts',
  'packages/adapters/react/src/index.ts',
  'packages/adapters/vue/src/index.ts',
  'packages/adapters/web-component/src/index.ts',
  'packages/prototypes/base/src/button/index.ts',
  'packages/prototypes/shadcn/src/button/index.ts',
]);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const fail = (message) => {
  throw new Error(`[package-budgets] ${message}`);
};

// This is a project-stage opt-in, never a new numeric ceiling. The ledger's
// source/native/review acceptance is still enforced by the coverage checks.
export function resolveBudgetPolicy({ finfDevelopment = false, root, read = readFileSync } = {}) {
  if (!finfDevelopment) return { mode: 'strict', scope: 'whole-entry package budgets' };
  const source = read(resolve(root, FINF_LEDGER), 'utf8');
  const data = JSON.parse(source);
  const plan = data?.deliveryPlan;
  if (
    data?.tracker !== 870 ||
    plan?.initialTodoCount !== 68 ||
    plan.coreTodoCount !== 55 ||
    plan.priorWorkRoutingCount !== 13 ||
    !Array.isArray(plan.items) ||
    plan.items.length !== 55 ||
    !Array.isArray(plan.priorWork) ||
    plan.priorWork.length !== 13
  ) {
    fail('missing or invalid Finf full-delivery ledger (55 core + 13 prior-work items required)');
  }
  const items = [...plan.items, ...plan.priorWork];
  if (
    items.some(
      (item) =>
        !item || typeof item.id !== 'string' || !item.id || typeof item.complete !== 'boolean'
    ) ||
    new Set(items.map((item) => item.id)).size !== 68 ||
    plan.checkedCoreTodos !== plan.items.filter((item) => item.complete).length
  ) {
    fail('invalid Finf item identities/completion states or completion count drift');
  }
  const completedItems = items.filter((item) => item.complete).length;
  return {
    mode: completedItems < 68 ? 'finf-development-advisory' : 'strict',
    scope: 'Proto-UI/Proto-UI Finf #870/#872: current nine whole-entry measurements only',
    advisoryEntries: [...FINF_BUDGET_ENTRIES],
    expiresWhen:
      'All 68 full-delivery/closeout items are recorded complete, or the explicit Finf opt-in is removed',
    ledger: FINF_LEDGER,
    ledgerSha256: createHash('sha256').update(source).digest('hex'),
    recordedCompleteItems: completedItems,
    totalItems: 68,
    completionIsAcceptance: false,
  };
}

export function parseBudgetArguments(args) {
  const allowed = new Set(['--json', '--finf-development']);
  if (args.some((arg) => !allowed.has(arg)) || new Set(args).size !== args.length) {
    fail('unknown or duplicate argument; use --json and/or --finf-development');
  }
  return { json: args.includes('--json'), finfDevelopment: args.includes('--finf-development') };
}

// Missing output must never become an apparently tiny successful bundle.
export function measureBuildOutput(result) {
  if (
    (Array.isArray(result?.errors) && result.errors.length > 0) ||
    !Array.isArray(result?.outputFiles) ||
    result.outputFiles.length === 0 ||
    result.outputFiles.some(
      (file) => !(file?.contents instanceof Uint8Array) || file.contents.length === 0
    )
  ) {
    fail('build returned missing or empty bundle output');
  }
  const contents = Buffer.concat(result.outputFiles.map((file) => Buffer.from(file.contents)));
  return {
    minifiedBytes: contents.length,
    minifiedSha256: createHash('sha256').update(contents).digest('hex'),
    gzipBytes: gzipSync(contents, { level: 9 }).length,
  };
}

function validateMeasurement(measurement, name) {
  if (
    !positiveInteger(measurement?.minifiedBytes) ||
    !positiveInteger(measurement?.gzipBytes) ||
    typeof measurement?.minifiedSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(measurement.minifiedSha256)
  ) {
    fail(`missing or invalid measurement for ${name}`);
  }
}

export async function collectBudgetReport({ cases, diagnostics, measure, environment, policy }) {
  if (!['strict', 'finf-development-advisory'].includes(policy?.mode))
    fail('invalid budget policy');
  if (!Array.isArray(cases) || cases.length === 0 || !Array.isArray(diagnostics))
    fail('missing measurement cases');
  for (const key of ['node', 'zlib', 'esbuild', 'platform', 'arch']) {
    if (typeof environment?.[key] !== 'string' || !environment[key])
      fail(`missing toolchain field: ${key}`);
  }
  const results = [];
  for (const [name, entry, budget] of cases) {
    if (!name || !entry || !positiveInteger(budget))
      fail('invalid package case or baseline budget');
    const measurement = await measure(entry);
    validateMeasurement(measurement, name);
    const pass = measurement.gzipBytes <= budget;
    results.push({
      name,
      entry,
      ...measurement,
      budget,
      pass,
      overBudgetBytes: Math.max(0, measurement.gzipBytes - budget),
      blocking:
        !pass &&
        !(policy.mode === 'finf-development-advisory' && FINF_BUDGET_ENTRIES.includes(entry)),
    });
  }
  const diagnosticResults = [];
  for (const [name, entry] of diagnostics) {
    if (!name || !entry) fail('invalid diagnostic case');
    const measurement = await measure(entry);
    validateMeasurement(measurement, name);
    diagnosticResults.push({ name, entry, ...measurement });
  }
  return {
    environment,
    policy,
    measurement: {
      bundle: true,
      minify: true,
      treeShaking: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      gzipLevel: 9,
    },
    results,
    diagnostics: diagnosticResults,
    withinBudgets: results.every((result) => result.pass),
    exitCode: results.some((result) => result.blocking) ? 1 : 0,
  };
}
