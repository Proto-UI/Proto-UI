import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync('.github/workflows/material-initial-paint-evidence.yml', 'utf8')
);

function verifySourceGate(value) {
  assert.deepEqual(value.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(value.jobs), ['finite-rest-source']);
  const job = value.jobs['finite-rest-source'];
  assert.equal(job.needs, undefined, 'other optical failures must not suppress this experiment');
  assert.equal(job.if, undefined);
  assert.equal(job.permissions, undefined);
  assert.equal(job['continue-on-error'], undefined);
  for (const step of job.steps) {
    assert.equal(step['continue-on-error'], undefined);
    if (step.uses !== 'actions/upload-artifact@v4') assert.equal(step.if, undefined);
  }
  const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.ref, '${{ github.event.pull_request.head.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const paths = value.on.pull_request.paths;
  for (const path of [
    'experiments/material-initial-paint/**',
    'packages/**',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    'apps/www/src/content/docs/zh-cn/library-card-capture.ts',
  ])
    assert.ok(paths.includes(path), `missing input trigger: ${path}`);
  const commands = job.steps.filter((step) => step.run).map((step) => step.run);
  const build = commands.findIndex((run) =>
    run.includes('material-initial-paint/build-browser.mjs')
  );
  const native = commands.findIndex((run) =>
    run.includes('material-initial-paint/browser.test.mjs')
  );
  assert.ok(build >= 0 && native > build);
  assert.match(commands[build], /build:packages --package @proto\.ui\/cli/);
  assert.equal(
    commands[native],
    'node --import tsx experiments/material-initial-paint/browser.test.mjs /tmp/pui-initial-paint /tmp/pui-initial-paint-evidence'
  );
  const upload = job.steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.if, 'always()');
  assert.equal(
    upload.with.name,
    'material-initial-paint-${{ github.event.pull_request.head.sha }}-${{ github.run_id }}'
  );
  assert.deepEqual(upload.with.path.trim().split(/\s+/), [
    '/tmp/pui-initial-paint/',
    '/tmp/pui-initial-paint-evidence/',
  ]);
}

test('official initial-paint gate binds the independent job to actual source and retains failures', () => {
  verifySourceGate(workflow);
});

for (const [name, mutate] of [
  [
    'merge-ref checkout',
    (v) => {
      delete v.jobs['finite-rest-source'].steps[0].with.ref;
    },
  ],
  [
    'persistent credentials',
    (v) => {
      v.jobs['finite-rest-source'].steps[0].with['persist-credentials'] = true;
    },
  ],
  [
    'write permission',
    (v) => {
      v.permissions.contents = 'write';
    },
  ],
  [
    'continuous-job dependency',
    (v) => {
      v.jobs['finite-rest-source'].needs = 'continuous';
    },
  ],
  [
    'skipped native driver',
    (v) => {
      v.jobs['finite-rest-source'].steps.find(
        (s) => s.name === 'Exercise real producer and static consumers'
      ).if = false;
    },
  ],
  [
    'swallowed native failure',
    (v) => {
      v.jobs['finite-rest-source'].steps.find(
        (s) => s.name === 'Exercise real producer and static consumers'
      )['continue-on-error'] = true;
    },
  ],
  [
    'missing experiment trigger',
    (v) => {
      v.on.pull_request.paths = v.on.pull_request.paths.filter(
        (p) => p !== 'experiments/material-initial-paint/**'
      );
    },
  ],
  [
    'omitted native driver',
    (v) => {
      v.jobs['finite-rest-source'].steps = v.jobs['finite-rest-source'].steps.filter(
        (s) => s.name !== 'Exercise real producer and static consumers'
      );
    },
  ],
  [
    'success-only evidence',
    (v) => {
      v.jobs['finite-rest-source'].steps.find((s) => s.uses === 'actions/upload-artifact@v4').if =
        'success()';
    },
  ],
  [
    'missing served assets',
    (v) => {
      v.jobs['finite-rest-source'].steps.find(
        (s) => s.uses === 'actions/upload-artifact@v4'
      ).with.path = '/tmp/pui-initial-paint-evidence/';
    },
  ],
]) {
  test(`initial-paint gate refuses ${name}`, () => {
    const changed = structuredClone(workflow);
    mutate(changed);
    assert.throws(() => verifySourceGate(changed));
  });
}
