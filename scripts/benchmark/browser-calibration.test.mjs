import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  evaluateCalibration as evaluate,
  PUBLIC_CALIBRATION_ORACLES,
} from './browser-calibration.mjs';

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
  {
    caseId: 'dialog-open-close',
    name: 'dialog',
    domain: 'html-native-dialog',
    oracleRef: 'public-calibration-dialog-open-close-v3',
    requiredChecks: [
      'dialog.trigger-accessible-name',
      'dialog.action-accessible-names',
      'dialog.input-accessible-name',
      'dialog.input-initial-value',
      'dialog.control-tab-sequence',
    ],
  },
  {
    caseId: 'tabs-manual-activation',
    name: 'tabs',
    domain: 'html-aria-manual-tabs',
    oracleRef: 'public-calibration-tabs-manual-activation-v2',
    requiredChecks: [
      'tabs.control-identities',
      'tabs.horizontal-orientation',
      'tabs.initial-roving-stop',
      'tabs.reverse-skip-disabled',
    ],
  },
  {
    caseId: 'select-keyboard',
    name: 'select',
    domain: 'html-native-select',
    oracleRef: 'public-calibration-select-keyboard-v2',
    requiredChecks: ['select.option-configuration', 'select.accessible-label'],
  },
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

test('public oracle identities match source case metadata with explicit Dialog v3 and Tabs/Select v2 coverage', async () => {
  assert.equal(Object.isFrozen(PUBLIC_CALIBRATION_ORACLES), true);
  assert.deepEqual(
    Object.keys(PUBLIC_CALIBRATION_ORACLES).sort(),
    cases.map(({ caseId }) => caseId).sort()
  );
  for (const { caseId, oracleRef } of cases) {
    const task = JSON.parse(
      await readFile(path.join(root, 'benchmarks/interaction/cases', `${caseId}.json`), 'utf8')
    );
    assert.equal(PUBLIC_CALIBRATION_ORACLES[caseId], oracleRef);
    assert.equal(task.oracleRef, oracleRef);
    if (caseId === 'dialog-open-close')
      assert.match(task.requirements, /labelled Display name input initially containing Example/);
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
  assert.equal(result.caseId, 'dialog-open-close');
  assert.equal(result.oracleRef, 'public-calibration-dialog-open-close-v3');
  const raw = JSON.parse(await readFile(path.join(evidenceDir, 'evaluator-result.json'), 'utf8'));
  assert.equal(raw.caseId, result.caseId);
  assert.equal(raw.oracleRef, result.oracleRef);
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
for (const { caseId, name, domain, oracleRef, requiredChecks } of cases) {
  test(`real Chromium positive control: ${caseId}`, browserOptions, async () => {
    const evidenceDir = await mkdtemp(path.join(evidenceRoot, `proto-calibration-${name}-`));
    const result = await evaluateCalibration({
      caseId,
      htmlPath: fixture(name),
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.deepEqual(result.failures, [], JSON.stringify(result.failures));
    assert.equal(result.caseId, caseId);
    assert.equal(result.oracleRef, oracleRef);
    assert.equal(result.environment.semanticDomain, domain);
    for (const id of [...requiredChecks, 'cleanup.control-identities'])
      assert.equal(result.checks.find((item) => item.id === id)?.status, 'pass');
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
  'real Chromium positive variant: native disabled tabindex zero is not a second roving stop',
  browserOptions,
  async () => {
    const evidenceDir = await mkdtemp(
      path.join(evidenceRoot, 'proto-calibration-valid-native-disabled-tabstop-')
    );
    const htmlPath = path.join(evidenceDir, 'variant-tabs.html');
    const html = await readFile(fixture('tabs'), 'utf8');
    assert.equal(html.split('</body>').length, 2);
    await writeFile(
      htmlPath,
      html.replace(
        '</body>',
        `<script>
          // Apply after fixture startup, rather than changing an attribute that
          // startup initialization could reset before the evaluator observes it.
          window.addEventListener('load', () => {
            document.getElementById('tab-disabled').tabIndex = 0;
          }, { once: true });
        </script>\n</body>`
      )
    );
    const result = await evaluateCalibration({
      caseId: 'tabs-manual-activation',
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.deepEqual(result.failures, [], JSON.stringify(result.failures));
    assert.equal(result.oracleRef, 'public-calibration-tabs-manual-activation-v2');
    assert.ok(result.browser.version);
    assert.ok(
      result.checks.every((item) => item.status === 'pass' || item.id === 'scope.proto-conformance')
    );
    const initialFile = result.artifacts.find((file) => /^\d+-initial\.dom\.json$/.test(file));
    assert.ok(initialFile, 'Retain the actual initial browser DOM observation');
    const initial = JSON.parse(await readFile(path.join(evidenceDir, initialFile), 'utf8'));
    const disabledTab = initial.controls.find((control) => control.id === 'tab-disabled');
    assert.equal(disabledTab?.disabled, true);
    assert.equal(disabledTab?.tabIndex, 0, 'The variation must survive startup until observation');
    assert.equal(disabledTab?.rendered, true);
    assert.deepEqual(
      initial.controls
        .filter((control) => control.role === 'tab' && control.tabIndex >= 0)
        .map((control) => control.id),
      ['tab-overview', 'tab-disabled'],
      'The previous tabindex-only helper would reject this genuinely observed valid variant'
    );
    const initialCheck = result.checks.find((item) => item.id === 'tabs.initial-roving-stop');
    assert.equal(initialCheck?.status, 'pass');
    assert.ok(initialCheck.evidence.includes(initialFile));
    for (const id of [
      'tabs.tab-entry',
      'tabs.arrow-skip-disabled',
      'tabs.reverse-skip-disabled',
      'tabs.repeated-selection',
      'cleanup.keyboard-after-removal',
    ])
      assert.equal(result.checks.find((item) => item.id === id)?.status, 'pass');
  }
);

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

for (const { name, suffix, before, after, failedCheck, passingCheck } of [
  {
    name: 'removed dialog input label fails only the intended accessible-name check',
    suffix: 'label',
    before: '<label for="display-name">Display name</label>',
    after: '',
    failedCheck: 'dialog.input-accessible-name',
    passingCheck: 'dialog.input-initial-value',
  },
  {
    name: 'changed dialog initial value fails only the intended value check',
    suffix: 'value',
    before: '<input id="display-name" autofocus value="Example" />',
    after: '<input id="display-name" autofocus value="Changed" />',
    failedCheck: 'dialog.input-initial-value',
    passingCheck: 'dialog.input-accessible-name',
  },
]) {
  test(`real Chromium negative control: ${name}`, browserOptions, async () => {
    const evidenceDir = await mkdtemp(
      path.join(evidenceRoot, `proto-calibration-negative-dialog-${suffix}-`)
    );
    const htmlPath = path.join(evidenceDir, 'mutated-dialog.html');
    const html = await readFile(fixture('dialog'), 'utf8');
    assert.equal(html.split(before).length, 2, 'Mutation must change exactly one fixture element');
    await writeFile(htmlPath, html.replace(before, after));
    const result = await evaluateCalibration({
      caseId: 'dialog-open-close',
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.equal(result.caseId, 'dialog-open-close');
    assert.equal(result.oracleRef, 'public-calibration-dialog-open-close-v3');
    assert.ok(
      !result.checks.some((item) => item.status === 'blocked'),
      JSON.stringify(result.failures)
    );
    assert.equal(result.checks.find((item) => item.id === failedCheck)?.status, 'fail');
    assert.deepEqual(
      result.failures.map((item) => item.stage),
      [failedCheck]
    );
    for (const id of [
      passingCheck,
      'dialog.keyboard-open',
      'dialog.initial-focus',
      'dialog.accessible-name',
      'dialog.repeat-cycle',
      'cleanup.remove-fixture',
    ])
      assert.equal(result.checks.find((item) => item.id === id)?.status, 'pass');
    assert.ok(
      result.checks.every(
        (item) =>
          item.status === 'pass' || item.id === failedCheck || item.id === 'scope.proto-conformance'
      )
    );
  });
}

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

// These mutations change existing public requirements, not Proto semantics. The
// evaluator reads only the resulting DOM/AX facts and trusted browser journey.
// Exact failure sets are required when the mutation leaves the journey intact;
// otherwise target failures plus unrelated passing controls distinguish the
// intended violation from setup, selector, script, or whole-run failure.
const requirementMutations = [
  {
    caseId: 'dialog-open-close',
    suffix: 'button-names',
    name: 'incorrect dialog action names preserve open/close behavior',
    replacements: [
      ['>Open reference dialog</button>', '>Wrong opening name</button>'],
      ['>Cancel</button>', '>Wrong cancel name</button>'],
      ['>Save</button>', '>Wrong save name</button>'],
    ],
    failedChecks: ['dialog.trigger-accessible-name', 'dialog.action-accessible-names'],
    passingChecks: ['dialog.keyboard-open', 'dialog.cancel-close', 'dialog.repeat-cycle'],
  },
  {
    caseId: 'dialog-open-close',
    suffix: 'cleanup-names',
    name: 'incorrect cleanup button names preserve removal and keyboard navigation',
    replacements: [
      ['>Remove reference fixture</button>', '>Wrong remove name</button>'],
      ['>After fixture</button>', '>Wrong outside name</button>'],
    ],
    failedChecks: ['cleanup.control-identities'],
    passingChecks: ['dialog.repeat-cycle', 'cleanup.keyboard-after-removal'],
  },
  {
    caseId: 'dialog-open-close',
    suffix: 'cancel-tab-stop',
    name: 'a skipped Cancel control fails the full forward/reverse focus traversal',
    replacements: [
      ['id="cancel-dialog" type="button"', 'id="cancel-dialog" type="button" tabindex="-1"'],
    ],
    failedChecks: ['dialog.control-tab-sequence'],
    passingChecks: ['dialog.reverse-tab-wrap', 'dialog.forward-tab-wrap', 'dialog.repeat-cycle'],
  },
  {
    caseId: 'tabs-manual-activation',
    suffix: 'orientation',
    name: 'vertical tablist declaration fails horizontal configuration with working arrows',
    replacements: [['aria-orientation="horizontal"', 'aria-orientation="vertical"']],
    failedChecks: ['tabs.horizontal-orientation'],
    passingChecks: [
      'tabs.control-identities',
      'tabs.arrow-skip-disabled',
      'tabs.reverse-skip-disabled',
    ],
  },
  {
    caseId: 'tabs-manual-activation',
    suffix: 'disabled-tab-name',
    name: 'a renamed disabled tab fails identity with an unchanged keyboard journey',
    replacements: [['          Unavailable\n', '          Wrong disabled-tab name\n']],
    failedChecks: ['tabs.control-identities'],
    passingChecks: [
      'tabs.horizontal-orientation',
      'tabs.arrow-skip-disabled',
      'tabs.repeated-selection',
    ],
  },
  {
    caseId: 'tabs-manual-activation',
    suffix: 'initial-roving',
    name: 'a second initial tab stop fails before navigation repairs the roving set',
    replacements: [
      [
        'aria-controls="panel-history"\n          tabindex="-1"',
        'aria-controls="panel-history"\n          tabindex="0"',
      ],
    ],
    failedChecks: ['tabs.initial-roving-stop', 'tabs.tab-entry'],
    passingChecks: [
      'tabs.initial-selection',
      'tabs.arrow-skip-disabled',
      'tabs.repeated-selection',
    ],
  },
  {
    caseId: 'tabs-manual-activation',
    suffix: 'reverse-disabled-skip',
    name: 'broken reverse disabled-skip fails while forward skip and both wraps work',
    replacements: [
      [
        'ArrowLeft: enabled[(index - 1 + enabled.length) % enabled.length],',
        'ArrowLeft: index === 1 ? tab : enabled[(index - 1 + enabled.length) % enabled.length],',
      ],
    ],
    failedChecks: ['tabs.reverse-skip-disabled'],
    passingChecks: [
      'tabs.arrow-skip-disabled',
      'tabs.arrow-wrap',
      'tabs.reverse-wrap',
      'tabs.repeated-selection',
    ],
  },
  {
    caseId: 'tabs-manual-activation',
    suffix: 'rendered-panel',
    name: 'CSS exposing an inactive panel fails rendered visibility despite unchanged hidden flags',
    replacements: [['</style>', '#panel-disabled { display: block; }\n</style>']],
    failedChecks: ['tabs.initial-selection'],
    allowRelatedFailures: true,
    passingChecks: [
      'tabs.control-identities',
      'tabs.horizontal-orientation',
      'tabs.accessibility-relationships',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'option-label',
    name: 'a wrong disabled option label fails configuration with unchanged value transitions',
    replacements: [['>Unavailable Beta</option>', '>Wrong disabled-option name</option>']],
    failedChecks: ['select.option-configuration'],
    passingChecks: [
      'select.finite-single-selection',
      'select.down-skip-disabled',
      'select.repeat-cycle',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'option-value',
    name: 'a wrong disabled option value fails configuration though the option is never committed',
    replacements: [['value="beta" disabled', 'value="wrong-beta" disabled']],
    failedChecks: ['select.option-configuration'],
    passingChecks: [
      'select.finite-single-selection',
      'select.down-skip-disabled',
      'select.repeat-cycle',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'option-order',
    name: 'moving the disabled option fails declared order despite unchanged enabled transitions',
    replacements: [
      [
        '<option value="beta" disabled>Unavailable Beta</option>\n        <option value="gamma">Gamma</option>',
        '<option value="gamma">Gamma</option>\n        <option value="beta" disabled>Unavailable Beta</option>',
      ],
    ],
    failedChecks: ['select.option-configuration'],
    passingChecks: [
      'select.finite-single-selection',
      'select.down-skip-disabled',
      'select.reverse-navigation',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'option-disabled',
    name: 'enabled Beta fails declared disabled configuration and skip behavior',
    replacements: [['value="beta" disabled', 'value="beta"']],
    failedChecks: ['select.option-configuration', 'select.down-skip-disabled'],
    allowRelatedFailures: true,
    passingChecks: [
      'select.finite-single-selection',
      'select.accessible-label',
      'select.label-pointer-focus',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'initial-selection',
    name: 'Gamma selected initially fails both configuration and Alpha initial value',
    replacements: [
      ['value="alpha" selected', 'value="alpha"'],
      ['value="gamma"', 'value="gamma" selected'],
    ],
    failedChecks: ['select.option-configuration', 'select.finite-single-selection'],
    allowRelatedFailures: true,
    passingChecks: ['select.accessible-label', 'select.reverse-navigation', 'select.repeat-cycle'],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'rendered-output',
    name: 'hidden output fails displayed synchronization despite correct DOM text and value',
    replacements: [['id="selection-output"', 'id="selection-output" hidden']],
    failedChecks: ['select.finite-single-selection', 'select.down-skip-disabled'],
    allowRelatedFailures: true,
    passingChecks: [
      'select.option-configuration',
      'select.accessible-label',
      'select.label-pointer-focus',
    ],
  },
  {
    caseId: 'select-keyboard',
    suffix: 'cleanup-order',
    name: 'reversed cleanup controls fail their declared document order',
    replacements: [
      [
        '<button id="remove-fixture" type="button">Remove reference fixture</button>\n    <button id="after-fixture" type="button">After fixture</button>',
        '<button id="after-fixture" type="button">After fixture</button>\n    <button id="remove-fixture" type="button">Remove reference fixture</button>',
      ],
    ],
    failedChecks: ['cleanup.control-identities'],
    allowRelatedFailures: true,
    passingChecks: [
      'select.option-configuration',
      'select.repeat-cycle',
      'select.label-pointer-focus',
    ],
  },
];

function applyRequirementMutation(html, replacements) {
  for (const [before, after] of replacements) {
    assert.equal(
      html.split(before).length,
      2,
      'Mutation must change exactly one public fixture site'
    );
    html = html.replace(before, after);
  }
  return html;
}

test('requirement negative controls each target existing unique fixture sites; this is not browser evidence', async () => {
  for (const mutation of requirementMutations) {
    const { name } = cases.find(({ caseId }) => caseId === mutation.caseId);
    const html = await readFile(fixture(name), 'utf8');
    assert.notEqual(applyRequirementMutation(html, mutation.replacements), html);
  }
});

for (const mutation of requirementMutations) {
  test(`real Chromium negative control: ${mutation.name}`, browserOptions, async () => {
    const { caseId, suffix, replacements, failedChecks, passingChecks, allowRelatedFailures } =
      mutation;
    const { name, oracleRef } = cases.find((item) => item.caseId === caseId);
    const evidenceDir = await mkdtemp(
      path.join(evidenceRoot, `proto-calibration-negative-${name}-${suffix}-`)
    );
    const htmlPath = path.join(evidenceDir, `mutated-${name}.html`);
    await writeFile(
      htmlPath,
      applyRequirementMutation(await readFile(fixture(name), 'utf8'), replacements)
    );
    const result = await evaluateCalibration({
      caseId,
      htmlPath,
      evidenceDir,
      chromiumPath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    });
    assert.equal(result.caseId, caseId);
    assert.equal(result.oracleRef, oracleRef);
    assert.ok(
      !result.checks.some((item) => item.status === 'blocked'),
      JSON.stringify(result.failures)
    );
    for (const id of failedChecks) {
      assert.equal(result.checks.find((item) => item.id === id)?.status, 'fail', id);
      assert.ok(
        result.failures.some((item) => item.stage === id),
        id
      );
    }
    if (!allowRelatedFailures)
      assert.deepEqual(
        result.failures.map((item) => item.stage),
        failedChecks
      );
    for (const id of [
      ...passingChecks,
      'host.fixture-domain',
      'host.no-runtime-errors',
      'cleanup.remove-fixture',
    ])
      assert.equal(result.checks.find((item) => item.id === id)?.status, 'pass', id);
  });
}
