import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  verifyExpectedBaseline,
  verifyRunnerIntegrity,
} from './check-dialog-baseline-evidence.mjs';

import { fixture } from './dialog-baseline-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reporter = fileURLToPath(new URL('./dialog-run-integrity-reporter.mjs', import.meta.url));
const probePath = 'apps/www/src/content/docs/zh-cn/dialog-available-space.browser.test.ts';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Actual installed Vitest 2.1.9 executes these synthetic reporting controls.
// No browser, product source, native geometry, network or build is involved.
for (const variant of [
  'control',
  'afterall',
  'hook-timeout',
  'unhandled',
  'rejection',
  'global-teardown',
  'resource-cleanup',
  'process-timeout',
  'reporter-error',
  'late-exit-throw',
  'late-exit-log',
  'late-exit-print',
  'late-exit-print-task',
]) {
  test(`actual Vitest reporting: ${variant}`, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dialog-integrity-'));
    try {
      const source = path.join(directory, probePath);
      fs.mkdirSync(path.dirname(source), { recursive: true });
      const cases = ['shadcn', 'brutalist'].flatMap((family) =>
        ['wc', 'react', 'vue', 'vue2'].map((runtime) => ({
          name: `${family}/${runtime}: live available region bounds content, leaves Mask full-size, scrolls long text and restores on close`,
          error:
            family === 'shadcn' && runtime === 'vue2'
              ? 'Error: RuntimeNotOffered:shadcn/vue2:["wc","react","vue"]'
              : family === 'shadcn'
                ? 'AssertionError: expected 0 to be greater than or equal to 15'
                : 'AssertionError: CloseIcon must not cover the Title box: expected 504 to be +0 // Object.is equality',
        }))
      );
      const hooks = {
        afterall: "afterAll(() => { throw new Error('INTEGRITY_AFTERALL_FAILURE'); });",
        'hook-timeout': 'afterAll(() => new Promise(() => {}), 30);',
        unhandled:
          "afterAll(async () => { setTimeout(() => { throw new Error('INTEGRITY_UNHANDLED'); }, 0); await new Promise(r => setTimeout(r, 30)); });",
        rejection:
          "afterAll(async () => { Promise.reject(new Error('INTEGRITY_REJECTION')); await new Promise(r => setTimeout(r, 30)); });",
      };
      fs.writeFileSync(
        source,
        `import { it, afterAll } from ${JSON.stringify(path.join(root, 'node_modules/vitest/dist/index.js'))};
for (const item of ${JSON.stringify(cases)}) it(item.name, () => {
  const separator = item.error.indexOf(': ');
  const error = new Error(item.error.slice(separator + 2));
  error.name = item.error.slice(0, separator); throw error;
});
${hooks[variant] ?? ''}
`
      );
      const extraReporter = path.join(directory, 'cleanup-reporter.mjs');
      fs.writeFileSync(
        extraReporter,
        `import fs from 'node:fs';
export default class {
  ${variant === 'reporter-error' ? "async onFinished() { for (let i = 0; i < 100; i++) { try { JSON.parse(fs.readFileSync(process.env.PROTO_UI_DIALOG_JSON_PATH, 'utf8')); break; } catch { await new Promise(r => setTimeout(r, 5)); } } throw new Error('INTEGRITY_REPORTER_FAILURE'); }" : ''}
  onInit(ctx) {
    ${variant === 'resource-cleanup' ? "ctx.onClose(async () => { throw new Error('INTEGRITY_RESOURCE_CLEANUP'); });" : ''}
    ${variant === 'process-timeout' ? 'ctx.onClose(() => { setInterval(() => {}, 1_000); });' : ''}
    ${variant === 'late-exit-throw' ? "process.once('exit', () => { throw new Error('INTEGRITY_LATE_EXIT_THROW'); });" : ''}
    ${variant === 'late-exit-log' ? "process.once('exit', () => ctx.logger.error('INTEGRITY_LATE_EXIT_LOG'));" : ''}
    ${variant === 'late-exit-print' ? "process.once('exit', () => ctx.logger.printError(new Error('INTEGRITY_LATE_EXIT_PRINT')));" : ''}
    ${variant === 'late-exit-print-task' ? "process.once('exit', () => ctx.logger.printError(new Error('INTEGRITY_LATE_EXIT_PRINT_TASK'), { task: ctx.state.getFiles()[0].tasks[0] }));" : ''}
  }
}`
      );
      const config = path.join(directory, 'vitest.config.mjs');
      const globalSetup = path.join(directory, 'global-setup.mjs');
      fs.writeFileSync(
        globalSetup,
        "export default () => () => { throw new Error('INTEGRITY_GLOBAL_TEARDOWN'); };\n"
      );
      fs.writeFileSync(
        config,
        `export default { test: {
        include: [${JSON.stringify(probePath)}], pool: 'forks',
        poolOptions: { forks: { singleFork: true } }, teardownTimeout: 100,
        ${variant === 'global-teardown' ? `globalSetup: ${JSON.stringify(globalSetup)},` : ''}
      } };`
      );
      const reportPath = path.join(directory, 'vitest.json');
      const integrityPath = path.join(directory, 'runner-integrity.json');
      const result = spawnSync(
        process.execPath,
        [
          path.join(root, 'node_modules/vitest/vitest.mjs'),
          'run',
          '--config',
          config,
          '--reporter',
          reporter,
          '--reporter',
          extraReporter,
          '--reporter',
          'default',
          '--reporter',
          'json',
          '--outputFile',
          reportPath,
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 20_000,
          env: {
            ...process.env,
            PROTO_UI_DIALOG_INTEGRITY_PATH: integrityPath,
            PROTO_UI_DIALOG_JSON_PATH: reportPath,
          },
        }
      );
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const reportBytes = fs.readFileSync(reportPath);
      const report = JSON.parse(reportBytes);
      const integrity = JSON.parse(fs.readFileSync(integrityPath, 'utf8'));
      const binding = {
        runnerIntegrity: integrity,
        reportSha256: sha256(reportBytes),
        expectedReporterSha256: sha256(fs.readFileSync(reporter)),
      };
      if (process.env.PROTO_UI_DIALOG_CONTROL_EVIDENCE_DIR) {
        const output = path.join(process.env.PROTO_UI_DIALOG_CONTROL_EVIDENCE_DIR, variant);
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'vitest.json'), reportBytes);
        fs.copyFileSync(integrityPath, path.join(output, 'runner-integrity.json'));
        fs.writeFileSync(path.join(output, 'process.log'), result.stdout + result.stderr);
        fs.writeFileSync(path.join(output, 'product-exit-code.txt'), String(result.status));
      }
      assert.equal(report.numFailedTests, 8);
      const historical = fixture();
      const classify = () =>
        verifyExpectedBaseline(report, historical.observations, 1, {
          ...historical.binding,
          ...binding,
        });
      if (variant === 'control') {
        assert.equal(classify().classification, 'partial-historical-coverage');
        assert.doesNotThrow(() => verifyRunnerIntegrity(report, binding, 1));
      } else {
        assert.throws(classify);
        assert.throws(() => verifyRunnerIntegrity(report, binding, 1));
        if (['unhandled', 'rejection'].includes(variant)) {
          assert.equal(report.testResults[0].message, '');
          assert.ok(integrity.unhandledErrors.length > 0);
        }
        if (variant === 'resource-cleanup') {
          assert.equal(integrity.closeFinished, true);
          assert.ok(integrity.runnerErrors.some((s) => s.includes('INTEGRITY_RESOURCE_CLEANUP')));
        }
        if (variant === 'process-timeout') assert.equal(integrity.processTimedOut, true);
        if (variant.startsWith('late-exit-')) {
          assert.equal(integrity.phase, 'process-exit');
          assert.equal(integrity.closeFinished, true);
          assert.ok(integrity.runnerErrors.some((error) => error.includes('INTEGRITY_LATE_EXIT_')));
        }
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
