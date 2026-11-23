import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import YAML from 'yaml';
import { FOLLOWUP_SUITES } from './sprint3-followup-evidence.mjs';

const readWorkflow = (name) =>
  YAML.parse(readFileSync(new URL('../../.github/workflows/' + name, import.meta.url), 'utf8'));
const workflow = readWorkflow('sprint3-followup-evidence.yml');
const carrier = readWorkflow('browser-suite-repair-evidence.yml');
const original = readWorkflow('sprint3-consumer-evidence.yml');
const direct = workflow.jobs['direct-consumers'];
const installed = workflow.jobs['installed-consumers'];
const step = (job, id) => job.steps.find((entry) => entry.id === id);
const stripExpression = (value) => value.replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, '');
const carrierCondition = (value, inputs, event = 'workflow_dispatch') =>
  new Function('inputs', 'github', 'return (' + stripExpression(value) + ')')(inputs, {
    event_name: event,
  });

test('supplement remains read-only manual admission and never enlarges the five original jobs', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch', 'workflow_call']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(Object.keys(workflow.jobs), ['direct-consumers', 'installed-consumers']);
  assert.deepEqual(Object.keys(original.jobs).sort(), [
    'base-select-consumers',
    'native-consumers',
    'production-compiler',
    'release-rehearsal',
    'strict-package-budgets',
  ]);
  assert.equal(carrier.on.workflow_dispatch.inputs.sprint3_followup.type, 'boolean');
  assert.equal(carrier.on.workflow_dispatch.inputs.sprint3_followup.default, false);
  assert.equal(carrier.on.workflow_dispatch.inputs.sprint3_followup.required, false);
  assert.equal(carrier.on.workflow_call.inputs.sprint3_followup, undefined);
  const call = carrier.jobs['sprint3-followup'];
  assert.equal(call.uses, './.github/workflows/sprint3-followup-evidence.yml');
  assert.deepEqual(call.permissions, { contents: 'read' });
  assert.equal(call.secrets, undefined);
});

test('ordinary and reusable defaults stay the same and two explicit opt-ins remain independent', () => {
  for (const scope of ['repair', 'sprint1']) {
    const defaults = { scope, sprint3_acceptance: false, sprint3_followup: false };
    assert.equal(
      carrierCondition(carrier.jobs['focused-browser'].if, defaults),
      scope === 'repair'
    );
    assert.equal(carrierCondition(carrier.jobs.sprint1.if, defaults), scope === 'sprint1');
    assert.equal(carrierCondition(carrier.jobs['sprint3-followup'].if, defaults), false);
    assert.equal(carrierCondition(carrier.jobs['sprint3-acceptance'].if, defaults), false);
    for (const acceptance of [false, true]) {
      const explicit = { scope, sprint3_acceptance: acceptance, sprint3_followup: true };
      assert.equal(carrierCondition(carrier.jobs['focused-browser'].if, explicit), false);
      assert.equal(carrierCondition(carrier.jobs.sprint1.if, explicit), false);
      assert.equal(carrierCondition(carrier.jobs['sprint3-followup'].if, explicit), true);
      assert.equal(carrierCondition(carrier.jobs['sprint3-acceptance'].if, explicit), acceptance);
      assert.equal(
        carrierCondition(carrier.jobs['sprint3-followup'].if, explicit, 'workflow_call'),
        false
      );
    }
  }
});

test('independent complete native files retain exact candidate checkout and frozen Node 24 tooling', () => {
  assert.deepEqual(direct.strategy, {
    'fail-fast': false,
    matrix: { suite: ['drawer', 'scroll', 'image-preview'] },
  });
  assert.deepEqual(
    FOLLOWUP_SUITES.map(({ id, file, cases }) => ({ id, file, cases })),
    [
      {
        id: 'drawer',
        file: 'packages/prototypes/shadcn/test/drawer-presence.browser.test.ts',
        cases: 7,
      },
      {
        id: 'scroll',
        file: 'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
        cases: 1,
      },
      {
        id: 'image-preview',
        file: 'apps/www/src/components/documentation-image-preview.browser.test.ts',
        cases: 32,
      },
      {
        id: 'select-public-usage',
        file: 'apps/www/test/base-select-public-usage.test.ts',
        cases: 4,
      },
    ]
  );
  for (const job of [direct, installed]) {
    assert.equal(job.needs, undefined);
    assert.equal(job['continue-on-error'], undefined);
    assert.equal(job.env.CANDIDATE_SHA, '${{ github.event.pull_request.head.sha || github.sha }}');
    assert.ok(Object.values(job.env).every((value) => !String(value).includes('${{ runner.')));
    const checkout = job.steps.find((entry) => entry.uses === 'actions/checkout@v4');
    assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
    assert.equal(checkout.with['persist-credentials'], false);
    assert.equal(
      job.steps.find((entry) => entry.uses === 'actions/setup-node@v4').with['node-version'],
      24
    );
    assert.match(
      step(job, 'dependencies').run,
      /corepack pnpm@10\.32\.1 install --frozen-lockfile --ignore-scripts/
    );
    assert.ok(
      job.steps.indexOf(step(job, 'inventory')) < job.steps.indexOf(step(job, 'dependencies'))
    );
    for (const entry of job.steps) assert.equal(entry['continue-on-error'], undefined);
    const scripts = job.steps.map((entry) => entry.run ?? '').join('\n');
    assert.doesNotMatch(
      scripts,
      /--no-sandbox|chromiumSandbox:\s*false|--grep|--testNamePattern|pnpm publish|npm publish/
    );
  }
});

test('owned runner paths are distinct, outside checkout and retain the source four separately', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 followup runner paths '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const all = [];
  for (const suite of ['drawer', 'scroll', 'image-preview', 'installed']) {
    const runner = path.join(directory, suite);
    mkdirSync(runner);
    const envFile = path.join(runner, 'github-env');
    const selected = suite === 'installed' ? installed : direct;
    execFileSync('bash', ['-euo', 'pipefail', '-c', selected.steps[0].run], {
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: runner,
        GITHUB_ENV: envFile,
        CANDIDATE_SHA: 'a'.repeat(40),
        FOLLOWUP_SUITE: suite,
        GITHUB_RUN_ID: '45202101258',
        GITHUB_RUN_ATTEMPT: '2',
      },
    });
    const values = Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => {
          const at = line.indexOf('=');
          return [line.slice(0, at), line.slice(at + 1)];
        })
    );
    assert.ok(values.TMPDIR.startsWith(runner + path.sep));
    assert.ok(existsSync(values.TMPDIR));
    const runnerSocket = path.join(
      '/home/runner/work/_temp',
      path.relative(runner, values.TMPDIR),
      'com.google.Chrome.XXXXXX',
      'SingletonSocket'
    );
    assert.ok(
      Buffer.byteLength(runnerSocket, 'utf8') < 108,
      'Chromium singleton socket exceeds the Linux pathname budget: ' + runnerSocket
    );
    all.push(values.SPRINT3_FOLLOWUP_EVIDENCE_DIR);
    if (suite === 'installed')
      assert.equal(
        values.SPRINT3_FOLLOWUP_EVIDENCE_DIR,
        path.join(values.FOLLOWUP_EVIDENCE_DIR, 'public-select-source')
      );
    else assert.ok(existsSync(values.SPRINT3_FOLLOWUP_EVIDENCE_DIR));
  }
  assert.equal(new Set(all).size, 4);
});

test('a failed public source producer does not suppress the independent installed producer', () => {
  const execute = step(installed, 'installed');
  assert.equal(execute.if, step(installed, 'public-source').if);
  assert.match(execute.if, /!cancelled\(\)/);
  const condition = new Function(
    'steps',
    'cancelled',
    'return (' + stripExpression(execute.if) + ')'
  );
  const states = Object.fromEntries(
    ['inventory', 'dependencies', 'controls', 'environment'].map((id) => [
      id,
      { outcome: 'success' },
    ])
  );
  for (const outcome of ['success', 'failure', 'skipped', 'cancelled']) {
    states['public-source'] = { outcome };
    assert.equal(
      condition(states, () => false),
      true
    );
  }
  assert.equal(
    condition(states, () => true),
    false
  );
  states.dependencies.outcome = 'failure';
  assert.equal(
    condition(states, () => false),
    false
  );
  assert.match(
    step(installed, 'public-source').run,
    /sprint3-followup-evidence\.mjs run --suite select-public-usage/
  );
  assert.match(execute.run, /python3 -B scripts\/test\/installed-public-consumers\/run\.py/);
  assert.match(execute.run, /--repository "\$GITHUB_WORKSPACE" --candidate "\$CANDIDATE_SHA"/);
  assert.match(execute.run, /--output "\$FOLLOWUP_EVIDENCE_DIR\/installed"/);
});

test('every producer has finalization time, original outcomes and always retained failed artifacts', () => {
  assert.ok(direct['timeout-minutes'] > step(direct, 'consumer')['timeout-minutes'] + 15);
  assert.ok(
    installed['timeout-minutes'] >
      step(installed, 'installed')['timeout-minutes'] +
        step(installed, 'public-source')['timeout-minutes'] +
        20
  );
  for (const job of [direct, installed]) {
    const finalize = job.steps.find((entry) =>
      entry.run?.includes('sprint3-followup-evidence.mjs finalize')
    );
    assert.equal(finalize.if, 'always()');
    assert.equal(finalize.env.WORKFLOW_STEP_OUTCOMES, '${{ toJSON(steps) }}');
    assert.match(finalize.run, /workflow-steps\.json/);
    assert.match(finalize.run, /bootstrap-failure\.json/);
    const upload = job.steps.find((entry) => entry.uses === 'actions/upload-artifact@v4');
    assert.equal(upload.if, 'always()');
    assert.equal(upload.with['if-no-files-found'], 'error');
    assert.ok(job.steps.indexOf(upload) > job.steps.indexOf(finalize));
  }
  const verify = installed.steps.find((entry) =>
    entry.run?.includes('installed-public-consumers/verify-result.mjs')
  );
  const upload = installed.steps.find((entry) => entry.uses === 'actions/upload-artifact@v4');
  assert.equal(verify.if, 'always()');
  assert.ok(installed.steps.indexOf(verify) < installed.steps.indexOf(upload));
  assert.match(
    verify.run,
    /"\$FOLLOWUP_EVIDENCE_DIR\/installed" "\$GITHUB_WORKSPACE" "\$CANDIDATE_SHA"/
  );
  assert.deepEqual(upload.with.path.trim().split('\n'), [
    '${{ env.FOLLOWUP_EVIDENCE_DIR }}',
    '!${{ env.FOLLOWUP_EVIDENCE_DIR }}/**/node_modules/**',
    '!${{ env.FOLLOWUP_EVIDENCE_DIR }}/**/__pycache__/**',
  ]);
});

test('actual video installation and non-fallback CJK font resolution remain required before capture', (t) => {
  const environment = step(direct, 'environment').run;
  assert.match(
    environment,
    /node apps\/www\/node_modules\/playwright-core\/cli\.js install ffmpeg/
  );
  assert.match(
    environment,
    /timeout --signal=TERM --kill-after=5s 220s bash apps\/www\/scripts\/prepare-homepage-composition-fonts\.sh/
  );
  assert.match(environment, /dpkg-query/);
  const match = environment.match(/(for CJK_LANGUAGE in zh-cn ja ko; do[\s\S]*?\n\s*done)/);
  assert.ok(match, 'execute and preserve the actual family-selection loop');
  const directory = mkdtempSync(path.join(tmpdir(), 'sprint3 followup font control '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(
    path.join(bin, 'fc-match'),
    [
      '#!/usr/bin/env bash',
      'case "$*" in',
      '*lang=zh-cn*) if [[ "$FONT_CONTROL" == fallback ]]; then printf "DejaVu Sans\\n"; else printf "Noto Sans CJK SC\\n"; fi ;;',
      '*lang=ja*) printf "Noto Sans CJK JP\\n" ;;',
      '*lang=ko*) printf "Noto Sans CJK KR\\n" ;;',
      '*) exit 2 ;;',
      'esac',
      '',
    ].join('\n'),
    { mode: 0o755 }
  );
  for (const [mode, status] of [
    ['available', 0],
    ['fallback', 1],
  ]) {
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', match[1]], {
      env: { PATH: bin + path.delimiter + process.env.PATH, FONT_CONTROL: mode },
      encoding: 'utf8',
      timeout: 5_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, status, result.stdout + result.stderr);
    assert.match(result.stdout, /Resolved zh-cn family/);
  }
});

test('full independent control files run without replacing original admission policy tests', () => {
  const controls = step(installed, 'controls').run;
  for (const file of [
    'scripts/test/sprint3-followup-evidence.test.mjs',
    'scripts/test/sprint3-followup-workflow.test.mjs',
    'scripts/test/sprint3-consumer-workflow.test.mjs',
    'scripts/ci/check-ci-schedule.mjs',
    'scripts/test/installed-public-consumers/native-cleanup.test.mjs',
    'scripts/test/installed-public-consumers/verify-native.test.mjs',
    'scripts/test/installed-public-consumers/verify-result.test.mjs',
  ])
    assert.ok(controls.includes(file), file);
  assert.match(
    controls,
    /python3 -B -m unittest discover -s scripts\/test\/installed-public-consumers -p 'test_\*\.py'/
  );
});

test('all authored run blocks are valid shell scripts with pipe failures retained', () => {
  for (const job of [direct, installed])
    for (const entry of job.steps)
      if (entry.run) {
        execFileSync('bash', ['-n', '-c', entry.run]);
        if (entry.run.includes('tee ')) assert.match(entry.run, /set -euo pipefail/);
      }
});
