import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluateCalibration as evaluate } from './browser-calibration.mjs';

const evidenceRoot = process.env.PROTO_BENCHMARK_EVIDENCE_ROOT || os.tmpdir();
await mkdir(evidenceRoot, { recursive: true });
async function evaluateCalibration(options) {
  const result = await evaluate(options);
  if (options.evidenceDir)
    await writeFile(
      path.join(options.evidenceDir, 'evaluator-result.json'),
      JSON.stringify(result, null, 2) + '\n',
      { flag: 'wx' }
    );
  return result;
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const cases = [
  { caseId: 'dialog-open-close', name: 'dialog', domain: 'html-native-dialog' },
  { caseId: 'tabs-manual-activation', name: 'tabs', domain: 'html-aria-manual-tabs' },
  { caseId: 'select-keyboard', name: 'select', domain: 'html-native-select' },
];
const fixture = (name) => path.join(root, 'benchmarks/interaction/fixtures', `${name}.html`);
const browserOptions = {
  skip: process.env.PROTO_BENCHMARK_BROWSER_TESTS !== '1',
  timeout: 120_000,
};

test('public fixtures identify the native calibration scope and contain no external resources', async () => {
  for (const { name, domain } of cases) {
    const html = await readFile(fixture(name), 'utf8');
    assert.match(html, /hand-authored browser reference/);
    assert.ok(html.includes(`data-calibration-domain="${domain}"`));
    assert.doesNotMatch(html, /(?:src|href)\s*=\s*["'](?:https?:)?\/\//i);
    assert.doesNotMatch(html, /(?:import|require)\s*\(?\s*["']@proto/i);
  }
});

test('an unknown case is rejected rather than scored as passing', async () => {
  await assert.rejects(
    () => evaluateCalibration({ caseId: 'not-a-public-case' }),
    /Unknown public calibration case/
  );
});

test('unavailable Chromium is a blocked setup with raw failure evidence, never a passing result', async () => {
  const evidenceDir = await mkdtemp(path.join(evidenceRoot, 'proto-calibration-blocked-'));
  const result = await evaluateCalibration({
    caseId: 'dialog-open-close',
    htmlPath: fixture('dialog'),
    evidenceDir,
    chromiumPath: path.join(evidenceDir, 'missing-chromium'),
  });
  assert.equal(result.checks.find((item) => item.id === 'host.browser-ready')?.status, 'blocked');
  assert.equal(
    result.checks.find((item) => item.id === 'scope.proto-conformance')?.status,
    'untested'
  );
  assert.equal(result.checks.filter((item) => item.status === 'pass').length, 0);
  assert.equal(result.browser.version, null);
  assert.equal(result.failures[0].stage, 'setup');
  assert.match(result.failures[0].message, /executable.*doesn't exist/i);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(evidenceDir, 'failures.json'), 'utf8')),
    result.failures
  );
  assert.deepEqual(result.artifacts, ['logs.json', 'failures.json']);
});

// Opt in explicitly on a host that permits Chromium. A failed launch is a failed
// browser test, never an implicit skip or a successful calibration run.
for (const { caseId, name, domain } of cases) {
  test(`real Chromium positive control: ${caseId}`, browserOptions, async () => {
    const evidenceDir = await mkdtemp(path.join(evidenceRoot, `proto-calibration-${name}-`));
    const result = await evaluateCalibration({
      caseId,
      htmlPath: fixture(name),
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.deepEqual(result.failures, [], JSON.stringify(result.failures));
    assert.equal(result.environment.semanticDomain, domain);
    assert.equal(result.environment.protoConformance, 'untested');
    assert.ok(result.browser.version);
    assert.ok(result.checks.filter((item) => item.status === 'pass').length > 10);
    assert.ok(
      result.checks.every((item) => item.status === 'pass' || item.id === 'scope.proto-conformance')
    );
    for (const dimension of [
      'behavior',
      'keyboard',
      'focus',
      'accessibility',
      'lifecycle',
      'host',
      'cleanup',
    ]) {
      assert.ok(
        result.checks.some((item) => item.dimension === dimension && item.status === 'pass'),
        `No measured ${dimension} check`
      );
    }
    for (const suffix of ['.png', '.dom.json', '.accessibility.json', 'trace.zip', 'logs.json']) {
      assert.ok(
        result.artifacts.some((file) => file.endsWith(suffix)),
        `Missing ${suffix} evidence`
      );
    }
    for (const file of result.artifacts) {
      assert.equal(path.isAbsolute(file), false);
      assert.ok((await stat(path.join(evidenceDir, file))).size > 0);
    }
    const log = JSON.parse(await readFile(path.join(evidenceDir, 'logs.json'), 'utf8'));
    assert.ok(log.trustedInput.some((event) => event.type === 'keydown' && event.isTrusted));
  });
}

test(
  'real Chromium negative control: removed tabs arrow behavior fails the intended keyboard check',
  browserOptions,
  async () => {
    const evidenceDir = await mkdtemp(path.join(evidenceRoot, 'proto-calibration-negative-tabs-'));
    const htmlPath = path.join(evidenceDir, 'mutated-tabs.html');
    const html = await readFile(fixture('tabs'), 'utf8');
    assert.ok(html.includes('if (targets[event.key]) {'));
    await writeFile(htmlPath, html.replace('if (targets[event.key]) {', 'if (false) {'));
    const result = await evaluateCalibration({
      caseId: 'tabs-manual-activation',
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.ok(
      !result.checks.some((item) => item.status === 'blocked'),
      JSON.stringify(result.failures)
    );
    assert.equal(
      result.checks.find((item) => item.id === 'tabs.initial-selection')?.status,
      'pass'
    );
    assert.equal(
      result.checks.find((item) => item.id === 'tabs.arrow-skip-disabled')?.status,
      'fail'
    );
    assert.ok(result.failures.some((item) => item.stage === 'tabs.arrow-skip-disabled'));
    assert.equal(
      result.checks.find((item) => item.id === 'cleanup.remove-fixture')?.status,
      'pass'
    );
  }
);

test(
  'real Chromium negative control: canceled native dialog Escape fails the intended close check',
  browserOptions,
  async () => {
    const evidenceDir = await mkdtemp(
      path.join(evidenceRoot, 'proto-calibration-negative-dialog-')
    );
    const htmlPath = path.join(evidenceDir, 'mutated-dialog.html');
    const html = await readFile(fixture('dialog'), 'utf8');
    await writeFile(
      htmlPath,
      html.replace(
        '</script>',
        "dialog.addEventListener('cancel', (event) => event.preventDefault());\n</script>"
      )
    );
    const result = await evaluateCalibration({
      caseId: 'dialog-open-close',
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.ok(
      !result.checks.some((item) => item.status === 'blocked'),
      JSON.stringify(result.failures)
    );
    assert.equal(result.checks.find((item) => item.id === 'dialog.keyboard-open')?.status, 'pass');
    assert.equal(result.checks.find((item) => item.id === 'dialog.escape-close')?.status, 'fail');
    assert.ok(result.failures.some((item) => item.stage === 'dialog.escape-close'));
    assert.equal(result.checks.find((item) => item.id === 'dialog.cancel-close')?.status, 'pass');
  }
);

test(
  'real Chromium negative control: blocked native select keys fail keyboard checks',
  browserOptions,
  async () => {
    const evidenceDir = await mkdtemp(
      path.join(evidenceRoot, 'proto-calibration-negative-select-')
    );
    const htmlPath = path.join(evidenceDir, 'mutated-select.html');
    const html = await readFile(fixture('select'), 'utf8');
    await writeFile(
      htmlPath,
      html.replace(
        '</script>',
        "select.addEventListener('keydown', (event) => event.preventDefault());\n</script>"
      )
    );
    const result = await evaluateCalibration({
      caseId: 'select-keyboard',
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.ok(
      !result.checks.some((item) => item.status === 'blocked'),
      JSON.stringify(result.failures)
    );
    assert.equal(
      result.checks.find((item) => item.id === 'select.finite-single-selection')?.status,
      'pass'
    );
    assert.equal(
      result.checks.find((item) => item.id === 'select.down-skip-disabled')?.status,
      'fail'
    );
    assert.ok(result.failures.some((item) => item.stage === 'select.down-skip-disabled'));
  }
);
