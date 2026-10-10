import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import YAML from 'yaml';

const workflowPath = '.github/workflows/brutalist-contrast-evidence.yml';
const testPath = 'scripts/test/brutalist-contrast-toolbar.test.mjs';
const astro = 'corepack pnpm@10.32.1 --filter apps-www exec astro preferences';
const disable = `${astro} disable devToolbar`;
const readBack = `${astro} get devToolbar.enabled`;
const readWorkflow = () => YAML.parse(readFileSync(workflowPath, 'utf8'));
const job = (workflow) => workflow.jobs['family-audit-evidence'];

// This checks workflow wiring only. It never launches Astro or a browser and
// does not establish that a fresh exact-head capture has excluded the toolbar.
function assertToolbarSetup(workflow) {
  const steps = job(workflow).steps;
  const setupIndex = steps.findIndex((step) => step.run?.includes(disable));
  const serverIndex = steps.findIndex((step) => step.run?.includes('--filter apps-www dev --host'));
  assert.ok(
    setupIndex >= 0 && setupIndex < serverIndex,
    'Disable the official Astro developer toolbar before starting the audit server.'
  );
  const setup = steps[setupIndex];
  const commands = setup.run
    .trim()
    .split('\n')
    .map((line) => line.trim());
  assert.equal(commands[0], 'set -euo pipefail', 'Setup commands must fail closed.');
  assert.equal(commands[1], disable);
  assert.equal(commands[2], `TOOLBAR_SETTING=$(NO_COLOR=1 ${readBack})`);
  assert.equal(commands[3], `printf '%s\\n' "$TOOLBAR_SETTING"`);
  assert.equal(
    commands[4],
    `grep -Eq '^◉ devToolbar\\.enabled is set to[[:space:]]+false[[:space:]]*$' <<< "$TOOLBAR_SETTING"`,
    'Reject an enabled or unset preference even when Astro get exits successfully.'
  );
  assert.equal(commands.length, 5);
  assert.equal(setup.if, undefined, 'Every shard must configure the evidence surface.');
  assert.equal(setup['continue-on-error'], undefined, 'Preference setup must fail closed.');
}

test('Brutalist contrast evidence disables and reads back the official toolbar before capture', () => {
  assertToolbarSetup(readWorkflow());
});

for (const [name, mutate] of [
  ['absent setup', (steps, index) => steps.splice(index, 1)],
  ['setup after the server', (steps, index) => steps.push(...steps.splice(index, 1))],
  [
    'missing fail-fast shell options',
    (steps, index) => {
      steps[index].run = steps[index].run.replace('set -euo pipefail\n', '');
    },
  ],
  [
    'missing read-back',
    (steps, index) => {
      steps[index].run = `${disable}\n`;
    },
  ],
  [
    'read-back before disable',
    (steps, index) => {
      steps[index].run = `${readBack}\n${disable}\n`;
    },
  ],
  [
    'conditional setup',
    (steps, index) => {
      steps[index].if = "matrix.shard == 'binary-and-buttons'";
    },
  ],
  [
    'ignored setup failure',
    (steps, index) => {
      steps[index]['continue-on-error'] = true;
    },
  ],
]) {
  test(`toolbar workflow contract rejects ${name}`, () => {
    const workflow = readWorkflow();
    const steps = job(workflow).steps;
    const index = steps.findIndex((step) => step.run?.includes(disable));
    assert.ok(index >= 0, 'The positive control must have a toolbar setup.');
    mutate(steps, index);
    assert.throws(() => assertToolbarSetup(workflow), assert.AssertionError);
  });
}

// Execute the actual setup shell against a controlled command boundary. The
// fake corepack cannot install packages, run Astro, access the network or open
// sockets. This proves command sequencing/failure handling, not rendered pixels.
for (const mode of ['normal', 'disable-fails', 'get-fails', 'still-enabled', 'unset']) {
  test(`actual toolbar setup shell ${mode === 'normal' ? 'accepts disabled' : `rejects ${mode}`}`, () => {
    const setup = job(readWorkflow()).steps.find((step) => step.run?.includes(disable));
    const result = spawnSync(
      'bash',
      [
        '--noprofile',
        '--norc',
        '-c',
        `
          preference=true
          corepack() {
            if [[ "$*" == 'pnpm@10.32.1 --filter apps-www exec astro preferences disable devToolbar' ]]; then
              [[ "$TEST_MODE" != disable-fails ]] || return 41
              preference=false
            elif [[ "$*" == 'pnpm@10.32.1 --filter apps-www exec astro preferences get devToolbar.enabled' ]]; then
              [[ "$TEST_MODE" != get-fails ]] || return 42
              [[ "$NO_COLOR" == 1 ]] || return 43
              if [[ "$TEST_MODE" == still-enabled ]]; then preference=true; fi
              if [[ "$TEST_MODE" == unset ]]; then
                printf '◯ devToolbar.enabled has not been set. It defaults to true\\n'
              else
                printf '◉ devToolbar.enabled is set to  %s \\n' "$preference"
              fi
            else
              printf 'Unexpected corepack command: %s\\n' "$*" >&2
              return 44
            fi
          }
          ${setup.run}
          printf '__SETUP_COMPLETE__\\n'
        `,
      ],
      { encoding: 'utf8', env: { PATH: process.env.PATH, TEST_MODE: mode }, timeout: 5_000 }
    );
    assert.ifError(result.error);
    if (mode === 'normal') {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /__SETUP_COMPLETE__/);
    } else {
      assert.notEqual(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout, /__SETUP_COMPLETE__/);
    }
  });
}

test('toolbar setup preserves all current manifest families, bounded jobs and exact-head evidence', () => {
  const workflow = readWorkflow();
  const audit = job(workflow);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(audit['timeout-minutes'], 45);
  assert.equal(audit.strategy['fail-fast'], false);
  assert.equal(audit.strategy['max-parallel'], 2);
  assert.deepEqual(audit.strategy.matrix.include, [
    { shard: 'binary-and-buttons', families: 'button,toggle,switch,checkbox' },
    { shard: 'popup-boundaries', families: 'dropdown-menu,select,dialog' },
    { shard: 'intent-and-tabs', families: 'tooltip,hover-card,tabs' },
    { shard: 'naming-and-disclosures', families: 'label,collapsible,accordion,field' },
    {
      shard: 'passive-and-editors',
      families: 'badge,card,skeleton,separator,spinner,textarea,scroll-area',
    },
  ]);
  const checkout = audit.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ github.event.pull_request.head.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const calibration = audit.steps.find(
    (step) => step.name === 'Calibrate paint acceptance and bounded evidence storage'
  );
  assert.ok(calibration.run.includes(testPath), 'Run this contract in the evidence workflow.');
  const observe = audit.steps.find((step) => step.run?.includes('--filter apps-www dev --host'));
  assert.equal(observe.env.PROTO_UI_CONTRAST_FAMILIES, '${{ matrix.families }}');
  assert.equal(observe.env.PROTO_UI_CONTRAST_AUDIT, '1');
  assert.match(observe.run, /seq 1 180/);
  assert.match(observe.run, /audit-brutalist-contrast\.mts/);
});

// Native startup is infrastructure setup, not a product latency assertion.
// Keep this allowance on this one hook; calibration test bodies and the shard
// deadline remain unchanged. This contract runs before native calibration.
const calibrationPath = 'apps/www/src/content/docs/zh-cn/contrast-probe.browser.test.ts';
function assertCalibrationStartupBound(source) {
  const file = ts.createSourceFile(calibrationPath, source, ts.ScriptTarget.Latest, true);
  assert.equal(file.parseDiagnostics.length, 0, 'The calibration source must parse.');
  const hooks = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'beforeAll'
    ) {
      hooks.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.equal(hooks.length, 1);
  // Parse the actual call boundary: a regex can consume a later timed test
  // when the startup timeout is missing, incorrectly accepting that mutation.
  const hook = hooks[0];
  assert.equal(hook.arguments.length, 2, 'The startup hook must have its own finite allowance.');
  const [callback, timeout] = hook.arguments;
  assert.ok(ts.isArrowFunction(callback) && ts.isBlock(callback.body));
  assert.ok(callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword));
  assert.equal(callback.parameters.length, 0);
  assert.ok(ts.isNumericLiteral(timeout));
  assert.equal(Number(timeout.text), 30_000);
  assert.equal((callback.body.getText(file).match(/await launchBrowser\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(source, /hookTimeout\s*:|vi\.setConfig|testTimeout\s*:/);
}

test('only the instrument startup hook has an explicit 30-second allowance', () => {
  assertCalibrationStartupBound(readFileSync(calibrationPath, 'utf8'));
});
for (const [label, change] of [
  ['default hook limit', (s) => s.replace('}, 30_000);', '});')],
  ['unbounded limit', (s) => s.replace('}, 30_000);', '}, 0);')],
  ['larger implicit scope', (s) => s.replace('}, 30_000);', '}, 60_000);')],
  ['global hook override', (s) => `${s}\nvi.setConfig({ hookTimeout: 30_000 });`],
]) {
  test(`instrument startup contract rejects ${label}`, () => {
    const source = readFileSync(calibrationPath, 'utf8');
    const changed = change(source);
    assert.notEqual(changed, source, 'The negative control must actually mutate the source.');
    assert.throws(() => assertCalibrationStartupBound(changed), assert.AssertionError);
  });
}

test('a later timed test cannot supply the missing startup-hook allowance', () => {
  const source = `beforeAll(async () => {
  await launchBrowser();
}, 30_000);
it('a separately bounded calibration', async () => {
}, 30_000);`;
  assertCalibrationStartupBound(source);
  assert.throws(
    () => assertCalibrationStartupBound(source.replace('}, 30_000);', '});')),
    assert.AssertionError
  );
});
