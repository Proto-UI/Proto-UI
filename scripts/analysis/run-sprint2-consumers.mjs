#!/usr/bin/env node
/** One sequential, source-bound queue for the admitted Sprint 2 Web consumers. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const families = ['base', 'shadcn', 'brutalist'];
const runtimes = ['wc', 'react', 'vue', 'vue2'];
const scenarios = {
  'input-otp': ['uncontrolled', 'controlled'],
  'slider-values': ['uncontrolled', 'controlled', 'lifecycle', 'directions'],
};
const native = (id, script, kinds, expectedCases) => ({
  id,
  script,
  kinds,
  expectedCases,
  format: 'native',
});
export const SPRINT2_SUITES = [
  native('input', 'scripts/analysis/sprint2-input-browser.mjs', ['input-otp', 'slider-values'], 72),
  native(
    'collections',
    'scripts/analysis/collections-recipes-browser.mjs',
    ['tree', 'data-table', 'virtual-list'],
    36
  ),
  native(
    'geometry',
    'scripts/analysis/component-capabilities-browser.mjs',
    ['resizable', 'carousel', 'date-picker'],
    36
  ),
  native(
    'form-select',
    'scripts/analysis/form-select-recipes-browser.mjs',
    ['form', 'select', 'choices'],
    36
  ),
  {
    id: 'ordinary-linked-consumers',
    files: ['packages/compiler/test/artifact-linking-consumer.test.ts'],
    evidenceKind: 'ordinary framework imports in Node/HappyDOM; not native browser evidence',
    expectedCases: 12,
    expectedIds: [
      'fails visibly when an ordinary import evaluates an unlinked external obligation',
      'uses React imports through native wrappers and portals, updates repeatedly and disposes subscriptions',
      'uses Vue 3 native component slots, nearest providers and disposal',
      'uses Vue 2 ordinary options imports and native children without a Proto launcher',
      'uses registered Web Components through ordinary DOM wrappers and terminal disconnect',
      'shares Anatomy membership and Focus Scope keys between different independently compiled feature closures',
      'resolves structured A11y targets across independent feature closures without crossing domains or private families',
      'rejects incompatible Focus metadata and declaration kinds before native import',
      ...['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'].map(
        (profile) => `preserves actual nominal references for every declaration kind in ${profile}`
      ),
    ].map((name) => `ordinary consumers of independently compiled and linked libraries ${name}`),
    format: 'vitest',
  },
  {
    id: 'compiled-consumers',
    files: ['packages/compiler/test/sprint2-native.browser.test.ts'],
    evidenceVariable: 'PROTO_UI_RUNTIME_EVIDENCE_DIR',
    expectedCases: 20,
    expectedIds: runtimes.flatMap((target) => [
      ...families.map(
        (family) =>
          `${target}/${family}: native Button activation, preferences and terminal cleanup`
      ),
      ...['sync', 'queued'].map(
        (mode) =>
          `${target}/${mode}: trusted controlled typing preserves caret through candidate refresh`
      ),
    ]),
    format: 'vitest',
  },
  {
    id: 'site',
    files: ['apps/www/src/content/docs/zh-cn/sprint2-site.browser.test.ts'],
    evidenceVariable: 'PROTO_UI_SPRINT2_SITE_EVIDENCE_DIR',
    expectedCases: 42,
    format: 'vitest',
  },
  {
    id: 'preferences',
    files: ['apps/www/test/preferences.browser.test.ts'],
    evidenceVariable: 'PROTO_UI_PREFERENCE_EVIDENCE_DIR',
    expectedCases: 4,
    format: 'vitest',
  },
  {
    id: 'collapsible',
    files: [
      'apps/www/src/content/docs/zh-cn/demo-base-collapsible.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-collapsible-projections.browser.test.ts',
    ],
    pattern: '^(?:Base|shadcn|brutalist) Collapsible public browser evidence ',
    evidenceVariable: 'PROTO_UI_COLLAPSIBLE_SCREENSHOT_DIR',
    expectedCases: 23,
    format: 'vitest',
  },
  {
    id: 'accordion',
    files: ['apps/www/src/content/docs/zh-cn/demo-accordion-family.browser.test.ts'],
    pattern: '^Accordion five families / four native Web consumers (?:base|shadcn|brutalist) ',
    evidenceVariable: 'PROTO_UI_ACCORDION_SCREENSHOT_DIR',
    expectedCases: 23,
    format: 'vitest',
  },
];

export function summarizeReceipt(suite, report) {
  let cases;
  let notSelected = 0;
  if (suite.format === 'native') {
    assert.ok(Array.isArray(report.cases), 'native cases receipt is required');
    cases = report.cases.map((item) => ({
      id: [item.family, item.runtime, item.kind, item.scenario].filter(Boolean).join('/'),
      status: item.status,
    }));
    for (const item of report.cases) {
      assert.ok(families.includes(item.family), `unexpected family: ${item.family}`);
      assert.ok(runtimes.includes(item.runtime), `unexpected runtime: ${item.runtime}`);
      assert.ok(suite.kinds.includes(item.kind), `unexpected kind: ${item.kind}`);
    }
    const expectedIds = families.flatMap((family) =>
      runtimes.flatMap((runtime) =>
        suite.kinds.flatMap((kind) =>
          (scenarios[kind] ?? [null]).map((scenario) =>
            [family, runtime, kind, scenario].filter(Boolean).join('/')
          )
        )
      )
    );
    assert.deepEqual(
      cases.map((item) => item.id).sort(),
      expectedIds.sort(),
      'native receipt must contain each admitted family/host/kind/scenario exactly once'
    );
  } else {
    assert.ok(Array.isArray(report.testResults), 'Vitest testResults receipt is required');
    const all = report.testResults.flatMap((file) => file.assertionResults ?? []);
    const selected = suite.pattern
      ? all.filter((item) => new RegExp(suite.pattern).test(item.fullName))
      : all;
    notSelected = all.length - selected.length;
    cases = selected.map((item) => ({ id: item.fullName, status: item.status }));
    if (suite.expectedIds)
      assert.deepEqual(
        cases.map((item) => item.id).sort(),
        [...suite.expectedIds].sort(),
        'receipt must contain each admitted generated consumer exactly once'
      );
  }
  const summary = {
    expected: suite.expectedCases,
    observed: cases.length,
    passed: cases.filter((item) => item.status === 'passed').length,
    failed: cases.filter((item) => item.status === 'failed').length,
    incomplete: cases.filter((item) => !['passed', 'failed'].includes(item.status)).length,
    notSelected,
    cases,
  };
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length, 'duplicate case receipts');
  assert.equal(
    cases.length,
    suite.expectedCases,
    'selected inventory differs from the admitted matrix'
  );
  return summary;
}

export async function runProcess(
  command,
  args,
  { cwd, env, log, timeoutMs = 15 * 60_000, timeoutGraceMs = 5000 }
) {
  const file = await open(log, 'wx');
  try {
    return await new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        env,
        detached: process.platform !== 'win32',
        stdio: ['ignore', file.fd, file.fd],
      });
      let timeout = false;
      let spawnError;
      let closed;
      let timeoutRetired = false;
      const finish = () => {
        if (closed && (!timeout || timeoutRetired))
          resolve({ ...closed, timeout, ...(spawnError ? { spawnError } : {}) });
      };
      const kill = (signal) => {
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          /* the process group has already exited */
        }
      };
      const timer = setTimeout(() => {
        timeout = true;
        kill('SIGTERM');
        // A graceful leader exit does not prove that its descendants retired.
        // Keep the group deadline and do not start another heavy suite before it.
        setTimeout(() => {
          kill('SIGKILL');
          timeoutRetired = true;
          finish();
        }, timeoutGraceMs);
      }, timeoutMs);
      child.on('error', (error) => {
        spawnError = String(error);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        closed = { code, signal };
        finish();
      });
    });
  } finally {
    await file.close();
  }
}

/** A failed suite remains failed; only unavailable shared prerequisites block later suites. */
export async function runQueue(steps, execute, persist) {
  const results = [];
  for (const step of steps) {
    const failedPrerequisites = (step.requires ?? []).filter(
      (id) => results.find((item) => item.id === id)?.status !== 'passed'
    );
    const item = { id: step.id, startedAt: new Date().toISOString(), status: 'running' };
    results.push(item);
    await persist(results);
    if (failedPrerequisites.length) {
      item.status = 'not-run';
      item.reason = `Shared prerequisites did not pass: ${failedPrerequisites.join(', ')}`;
    } else {
      try {
        Object.assign(item, await execute(step));
      } catch (error) {
        item.status = 'failed';
        item.error = error.stack ?? String(error);
      }
    }
    item.finishedAt = new Date().toISOString();
    await persist(results);
  }
  return results;
}

export async function main(args = process.argv.slice(2)) {
  assert.ok(
    args.every((arg) => arg === '--plan'),
    'only --plan is supported; the acceptance matrix cannot be narrowed through ambient selectors'
  );
  if (args.includes('--plan')) {
    console.log(JSON.stringify({ families, runtimes, suites: SPRINT2_SUITES }, null, 2));
    return;
  }
  const output = path.resolve(
    process.env.PUI_SPRINT2_EVIDENCE_DIR ??
      path.join(root, '.tmp', `sprint2-consumers-${Date.now()}`)
  );
  await mkdir(output, { recursive: true });
  const receiptPath = path.join(output, 'receipt.json');
  const git = (...parameters) =>
    execFileSync('git', parameters, { cwd: root, encoding: 'utf8' }).trim();
  const report = {
    kind: 'sprint2-sequential-web-consumer-evidence',
    startedAt: new Date().toISOString(),
    source: {
      head: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      status: git('status', '--porcelain'),
      trackedPatchSha256: createHash('sha256')
        .update(execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: root }))
        .digest('hex'),
      lockSha256: createHash('sha256')
        .update(await readFile(path.join(root, 'pnpm-lock.yaml')))
        .digest('hex'),
      untracked: await Promise.all(
        execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
          cwd: root,
          encoding: 'utf8',
        })
          .split('\0')
          .filter(Boolean)
          .sort()
          .map(async (file) => ({
            path: file,
            sha256: createHash('sha256')
              .update(await readFile(path.join(root, file)))
              .digest('hex'),
          }))
      ),
    },
    environment: { node: process.version, platform: process.platform, families, runtimes },
    boundary:
      'Three admitted families and four real Web hosts. CDP/native browser actions do not certify physical touch, OS IME, assistive technology, non-Web delivery, the real Harness session journey, or historical acceptance.',
    suites: SPRINT2_SUITES,
    steps: [],
  };
  await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const env = { ...process.env };
  // Diagnostic selectors from a caller must not silently shrink a full acceptance run.
  for (const key of Object.keys(env)) {
    if (
      key.startsWith('PUI_BROWSER_') ||
      key.startsWith('PROTO_UI_COLLAPSIBLE_') ||
      key.startsWith('PROTO_UI_ACCORDION_')
    )
      delete env[key];
  }
  env.PUI_CHROME_EXECUTABLE = env.PUI_CHROME_EXECUTABLE ?? env.CHROME_PATH;
  env.CANDIDATE_SHA = report.source.head;
  const steps = [
    {
      id: 'public-packages',
      command: process.execPath,
      args: ['scripts/build/public-packages.mjs'],
    },
    {
      id: 'styles',
      command: 'corepack',
      args: ['pnpm@10.32.1', '--filter', 'apps-www', 'generate:proto-ui-style'],
      requires: ['public-packages'],
    },
    {
      id: 'workspace-types',
      command: 'corepack',
      args: ['pnpm@10.32.1', 'check:types:workspace'],
      requires: ['public-packages', 'styles'],
    },
    ...SPRINT2_SUITES.map((suite) => ({ ...suite, requires: ['public-packages', 'styles'] })),
  ];
  await runQueue(
    steps,
    async (step) => {
      const evidence = path.join(output, step.id);
      await mkdir(evidence, { recursive: true });
      const reportFile = path.join(evidence, 'report.json');
      let command = step.command;
      let parameters = step.args;
      const stepEnv = { ...env };
      if (step.format === 'native') {
        command = process.execPath;
        parameters = ['--import', 'tsx', step.script];
        Object.assign(stepEnv, {
          PUI_EVIDENCE_DIR: evidence,
          PUI_BROWSER_FAMILIES: families.join(','),
          PUI_BROWSER_RUNTIMES: runtimes.join(','),
          PUI_BROWSER_KINDS: step.kinds.join(','),
        });
      } else if (step.format === 'vitest') {
        command = 'corepack';
        parameters = [
          'pnpm@10.32.1',
          'exec',
          'vitest',
          'run',
          ...step.files,
          '--maxWorkers=1',
          '--minWorkers=1',
          '--reporter=default',
          '--reporter=json',
          `--outputFile=${reportFile}`,
        ];
        if (step.pattern) parameters.push('--testNamePattern', step.pattern);
        if (step.evidenceVariable) stepEnv[step.evidenceVariable] = evidence;
      }
      console.log(`[sprint2] ${step.id}: ${command} ${parameters.join(' ')}`);
      const invocation = {
        command,
        args: parameters,
        cwd: root,
        log: path.join(evidence, 'run.log'),
      };
      const result = await runProcess(command, parameters, { ...invocation, env: stepEnv });
      let summary;
      let receiptError;
      if (step.format) {
        try {
          summary = summarizeReceipt(step, JSON.parse(await readFile(reportFile, 'utf8')));
        } catch (error) {
          receiptError = String(error);
        }
      }
      const passed =
        result.code === 0 &&
        !result.timeout &&
        !result.spawnError &&
        !receiptError &&
        (!summary || summary.passed === summary.expected);
      console.log(`[sprint2] ${step.id}: ${passed ? 'passed' : 'failed'}`);
      return {
        status: passed ? 'passed' : 'failed',
        invocation,
        process: result,
        ...(summary ? { summary } : {}),
        ...(receiptError ? { receiptError } : {}),
      };
    },
    async (results) => {
      report.steps = results;
      await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
    }
  );
  report.finishedAt = new Date().toISOString();
  report.status = report.steps.every((step) => step.status === 'passed') ? 'passed' : 'failed';
  await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        output,
        status: report.status,
        steps: report.steps.map(({ id, status, summary }) => ({
          id,
          status,
          summary: summary && { ...summary, cases: undefined },
        })),
      },
      null,
      2
    )
  );
  if (report.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
