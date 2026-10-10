import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import YAML from 'yaml';
const file = '.github/workflows/brutalist-design-evidence.yml';
const read = () => YAML.parse(readFileSync(file, 'utf8'));
const command = 'corepack pnpm@10.32.1 --filter apps-www exec astro preferences';
const disable = `${command} disable devToolbar`;
const get = `${command} get devToolbar.enabled`;
function assertSurface(workflow) {
  const job = workflow.jobs['family-regressions'];
  assert.deepEqual(job.strategy.matrix.suite, ['dialog', 'remaining', 'controls', 'checkbox']);
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const setup = job.steps.findIndex((s) => s.run?.includes(disable));
  const observe = job.steps.findIndex(
    (s) => s.name === 'Verify actual family component regression suite'
  );
  assert.ok(
    setup >= 0 && setup < observe,
    'Configure the official developer toolbar before native family input.'
  );
  const step = job.steps[setup];
  assert.equal(step.if, undefined);
  assert.equal(step['continue-on-error'], undefined);
  assert.deepEqual(
    step.run
      .trim()
      .split('\n')
      .map((x) => x.trim()),
    [
      'set -euo pipefail',
      disable,
      `TOOLBAR_SETTING=$(NO_COLOR=1 ${get})`,
      `printf '%s\\n' "$TOOLBAR_SETTING"`,
      `grep -Eq '^◉ devToolbar\\.enabled is set to[[:space:]]+false[[:space:]]*$' <<< "$TOOLBAR_SETTING"`,
    ]
  );
  assert.ok(
    job.steps.some((s) =>
      s.run?.includes('node --test scripts/test/brutalist-design-toolbar.test.mjs')
    )
  );
  assert.match(
    job.steps[observe].run,
    /demo-brutalist-\$\{\{ matrix\.suite \}\}\.browser\.test\.ts/
  );
  return step.run;
}
test('source-aligned family evidence configures a verified toolbar-free input surface', () =>
  assertSurface(read()));
for (const [name, mutate] of [
  ['missing setup', (steps, i) => steps.splice(i, 1)],
  ['late setup', (steps, i) => steps.push(...steps.splice(i, 1))],
  [
    'conditional setup',
    (steps, i) => {
      steps[i].if = "matrix.suite == 'dialog'";
    },
  ],
  [
    'ignored setup failure',
    (steps, i) => {
      steps[i]['continue-on-error'] = true;
    },
  ],
  [
    'missing read-back',
    (steps, i) => {
      steps[i].run = `set -euo pipefail\n${disable}\n`;
    },
  ],
])
  test(`source-aligned toolbar guard rejects ${name}`, () => {
    const workflow = read();
    assertSurface(workflow);
    const steps = workflow.jobs['family-regressions'].steps;
    mutate(
      steps,
      steps.findIndex((s) => s.run?.includes(disable))
    );
    assert.throws(() => assertSurface(workflow), assert.AssertionError);
  });
for (const mode of ['normal', 'disable-fails', 'get-fails', 'enabled', 'unset']) {
  test(`actual source-aligned setup shell ${mode}`, () => {
    const run = assertSurface(read());
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
          if [[ "$TEST_MODE" == enabled ]]; then preference=true; fi
          if [[ "$TEST_MODE" == unset ]]; then printf '◯ devToolbar.enabled has not been set. It defaults to true\\n';
          else printf '◉ devToolbar.enabled is set to  %s \\n' "$preference"; fi
        else return 44; fi
      }
      ${run}
      printf '__SETUP_COMPLETE__\\n'
    `,
      ],
      { encoding: 'utf8', env: { PATH: process.env.PATH, TEST_MODE: mode }, timeout: 5000 }
    );
    assert.ifError(result.error);
    if (mode === 'normal') {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /__SETUP_COMPLETE__/);
    } else {
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout, /__SETUP_COMPLETE__/);
    }
  });
}

// The independent Accordion job shares this verified official preference
// protocol, without replacing the standard CI suite or its retained failures.
test('independent Accordion evidence uses the same fail-closed toolbar protocol', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/accordion-family-evidence.yml', 'utf8')
  );
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const steps = workflow.jobs['browser-evidence'].steps;
  const index = steps.findIndex((step) => step.run?.includes(disable));
  const observe = steps.findIndex((step) =>
    step.run?.includes('demo-accordion-family.browser.test.ts')
  );
  assert.ok(index >= 0 && index < observe);
  assert.equal(steps[index].run, assertSurface(read()));
  assert.equal(steps[index].if, undefined);
  assert.equal(steps[index]['continue-on-error'], undefined);
  assert.ok(
    steps.some((step) =>
      step.run?.includes('node --test scripts/test/brutalist-design-toolbar.test.mjs')
    )
  );
});
