import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compileTooltipWarmHandoffPlan,
  runTooltipWarmHandoff,
  TOOLTIP_WARM_HANDOFF_STATE,
} from './contrast-tooltip-handoff.mjs';

// Controlled source/planner and sequencing inputs only. Native timing, real
// Group propagation, DOM leases and paint are covered by the dedicated browser
// consumer and source-bound audit; these Node controls never claim those facts.
const authored = () => ({
  root: {
    kind: 'box',
    children: [{
      kind: 'proto', prototypeId: 'brutalist-tooltip-group',
      props: { openDelay: 640, closeDelay: 0, skipDelay: 240 },
      children: ['alpha', 'beta'].map((name) => ({
        kind: 'proto', prototypeId: 'brutalist-tooltip-root',
        children: [
          { kind: 'proto', prototypeId: 'brutalist-tooltip-trigger', children: [`Trigger ${name}`] },
          { kind: 'proto', prototypeId: 'brutalist-tooltip-content', children: [`Description ${name}`] },
        ],
      })),
    }],
  },
});

test('the source plan carries actual sibling descriptions and delays into only declared route cells', () => {
  const plan = compileTooltipWarmHandoffPlan(authored(), '["wc","vue"]');
  assert.deepEqual(plan.cells, [
    { runtime: 'wc', theme: 'light' }, { runtime: 'wc', theme: 'dark' },
    { runtime: 'vue', theme: 'light' }, { runtime: 'vue', theme: 'dark' },
  ]);
  assert.equal(plan.openDelay, 640);
  assert.equal(plan.skipDelay, 240);
  assert.equal(plan.pairs[0].contentText, 'Description alpha');
  assert.equal(plan.pairs[1].triggerText, 'Trigger beta');
  assert.notEqual(plan.pairs[0].rootPath, plan.pairs[1].rootPath);
  assert.ok(plan.warmDeadlineMs < plan.openDelay);
});

test('missing Group, extra siblings and uncontrolled-scope changes fail instead of shrinking the journey', () => {
  const missing = authored();
  missing.root.children = missing.root.children[0].children;
  assert.throws(() => compileTooltipWarmHandoffPlan(missing, '["wc"]'), /shared Group/);
  const extra = authored();
  extra.root.children[0].children.push(extra.root.children[0].children[0]);
  assert.throws(() => compileTooltipWarmHandoffPlan(extra, '["wc"]'), /sibling Roots/);
  const controlled = authored();
  controlled.root.children[0].children[0].props = { open: false };
  assert.throws(() => compileTooltipWarmHandoffPlan(controlled, '["wc"]'), /uncontrolled/);
  assert.throws(() => compileTooltipWarmHandoffPlan(authored(), '["wc","vue2"]'), /runtime/);
});

test('a cold observation barrier prevents sibling input and all captures until its result is known', async () => {
  const calls = [];
  let rejectCold;
  let reachedCold;
  const reached = new Promise((resolve) => { reachedCold = resolve; });
  const cold = new Promise((resolve, reject) => { rejectCold = reject; });
  const record = {};
  const pending = runTooltipWarmHandoff({
    arm: async (phase) => { calls.push(`arm:${phase}`); },
    hover: async (index) => { calls.push(`hover:${index}`); },
    wait: async () => { reachedCold(); return cold; },
    capture: async (state) => { calls.push(`capture:${state}`); },
    record,
  });
  const rejected = assert.rejects(pending, /injected cold boundary/);
  await reached;
  assert.deepEqual(calls, ['arm:cold', 'hover:0']);
  rejectCold(new Error('injected cold boundary'));
  await rejected;
  assert.deepEqual(calls, ['arm:cold', 'hover:0']);
  assert.equal(record.stage, 'cold-observation');
});

test('a failed first PNG/facts capture cannot be hidden by a later successful handoff', async () => {
  const inputs = [];
  const record = {};
  await assert.rejects(runTooltipWarmHandoff({
    arm: async (phase) => { inputs.push(`arm:${phase}`); },
    hover: async (index) => { inputs.push(`hover:${index}`); },
    wait: async () => ({ achieved: true }),
    capture: async () => { throw new Error('injected fingerprint mismatch'); },
    record,
  }), /fingerprint mismatch/);
  assert.deepEqual(inputs, ['arm:cold', 'hover:0']);
  assert.equal(record.stage, 'cold-capture');
});

test('a rejected warm ownership result preserves cold captures without claiming the warm target', async () => {
  const captured = [];
  const record = {};
  await assert.rejects(runTooltipWarmHandoff({
    arm: async () => {},
    hover: async () => {},
    wait: async (phase) => ({ achieved: phase === 'cold', reason: 'injected retained first Content' }),
    capture: async (state) => { captured.push(state); },
    record,
  }), /warm sibling handoff/);
  assert.deepEqual(captured, ['hover', 'hover-open']);
  assert.equal(captured.includes(TOOLTIP_WARM_HANDOFF_STATE), false);
  assert.equal(record.stage, 'warm-observation');
  assert.equal(record.warm.achieved, false);
});

test('falsy capture failures remain failures and cannot advance to a warm input', async () => {
  const inputs = [];
  await assert.rejects(runTooltipWarmHandoff({
    arm: async (phase) => { inputs.push(`arm:${phase}`); },
    hover: async (index) => { inputs.push(`hover:${index}`); },
    wait: async () => ({ achieved: true }),
    capture: async () => { throw undefined; },
    record: {},
  }), (error) => error === undefined);
  assert.deepEqual(inputs, ['arm:cold', 'hover:0']);
});
