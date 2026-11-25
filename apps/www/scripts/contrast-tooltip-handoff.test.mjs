import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-tooltip-group',
        props: { openDelay: 640, closeDelay: 0, skipDelay: 240 },
        children: ['alpha', 'beta'].map((name) => ({
          kind: 'proto',
          prototypeId: 'brutalist-tooltip-root',
          children: [
            {
              kind: 'proto',
              prototypeId: 'brutalist-tooltip-trigger',
              children: [`Trigger ${name}`],
            },
            {
              kind: 'proto',
              prototypeId: 'brutalist-tooltip-content',
              children: [`Description ${name}`],
            },
          ],
        })),
      },
    ],
  },
});

test('the source plan carries actual sibling descriptions and delays into only declared route cells', () => {
  const plan = compileTooltipWarmHandoffPlan(authored(), '["wc","vue"]');
  assert.deepEqual(plan.cells, [
    { runtime: 'wc', theme: 'light' },
    { runtime: 'wc', theme: 'dark' },
    { runtime: 'vue', theme: 'light' },
    { runtime: 'vue', theme: 'dark' },
  ]);
  assert.equal(plan.openDelay, 640);
  assert.equal(plan.skipDelay, 240);
  assert.equal(plan.pairs[0].contentText, 'Description alpha');
  assert.equal(plan.pairs[1].triggerText, 'Trigger beta');
  assert.notEqual(plan.pairs[0].rootPath, plan.pairs[1].rootPath);
  assert.ok(plan.warmDeadlineMs < plan.openDelay);
});

for (const locale of ['en', 'zh-cn']) {
  test(`the actual ${locale} Tooltip page and recipe reach all four declared hosts`, async () => {
    const source = await readFile(
      new URL(
        `../src/content/docs/${locale}/ui-libraries/brutalist/components/tooltip.mdx`,
        import.meta.url
      ),
      'utf8'
    );
    const previews = [...source.matchAll(/<PrototypePreviewer\b([\s\S]*?)\/>/g)].filter((match) =>
      /\bdemoId="demo-brutalist-tooltip"/.test(match[1])
    );
    assert.equal(previews.length, 1, 'The public route must bind one actual Tooltip recipe.');
    const declaration = [...previews[0][1].matchAll(/\bruntimes=\{(\[[^\]]*\])\}/g)];
    assert.equal(
      declaration.length,
      1,
      'The observed recipe needs one literal runtime declaration.'
    );
    const runtimes = JSON.parse(declaration[0][1].replaceAll("'", '"'));
    assert.deepEqual(runtimes, ['wc', 'react', 'vue', 'vue2']);
    const { default: demo } =
      await import('../src/content/docs/zh-cn/demo-brutalist-tooltip.demo.ts');
    const plan = compileTooltipWarmHandoffPlan(demo, JSON.stringify(runtimes));
    assert.deepEqual(
      plan.cells,
      runtimes.flatMap((runtime) => ['light', 'dark'].map((theme) => ({ runtime, theme })))
    );
    assert.equal(plan.cells.length, 8);
    assert.equal(plan.openDelay, 500);
    assert.equal(plan.closeDelay, 100);
    assert.equal(plan.skipDelay, 300);
    assert.equal(plan.warmDeadlineMs, 300);
    assert.deepEqual(
      plan.pairs.map((pair) => pair.triggerText),
      ['Account', 'Notifications']
    );
  });
}

test('ordinary close delay does not replace the instant sibling handoff boundary', () => {
  for (const closeDelay of [100, 640]) {
    const demo = authored();
    demo.root.children[0].props.closeDelay = closeDelay;
    const plan = compileTooltipWarmHandoffPlan(demo, '["wc"]');
    assert.equal(plan.closeDelay, closeDelay);
    assert.equal(plan.warmDeadlineMs, 300);
    assert.ok(plan.authority.includes('P-BASE-TOOLTIP-GROUP-INSTANT-HANDOFF'));
  }
});

test('all authored delays remain explicit finite values and cold opening exceeds the warm budget', () => {
  for (const name of ['openDelay', 'closeDelay', 'skipDelay']) {
    for (const value of [undefined, -1, NaN, Infinity, '100']) {
      const demo = authored();
      demo.root.children[0].props[name] = value;
      assert.throws(() => compileTooltipWarmHandoffPlan(demo, '["wc"]'), /explicit finite/);
    }
  }
  for (const [name, value] of [
    ['openDelay', 300],
    ['skipDelay', 0],
  ]) {
    const demo = authored();
    demo.root.children[0].props[name] = value;
    assert.throws(() => compileTooltipWarmHandoffPlan(demo, '["wc"]'), /cold delay/);
  }
});

test('empty, duplicate and unknown runtime declarations still fail before the native journey', () => {
  for (const runtimes of ['[]', '["wc","wc"]', '["wc","native"]']) {
    assert.throws(() => compileTooltipWarmHandoffPlan(authored(), runtimes), /runtime/);
  }
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
  assert.throws(() => compileTooltipWarmHandoffPlan(authored(), '["wc","native"]'), /runtime/);
});

test('a cold observation barrier prevents sibling input and all captures until its result is known', async () => {
  const calls = [];
  let rejectCold;
  let reachedCold;
  const reached = new Promise((resolve) => {
    reachedCold = resolve;
  });
  const cold = new Promise((resolve, reject) => {
    rejectCold = reject;
  });
  const record = {};
  const pending = runTooltipWarmHandoff({
    arm: async (phase) => {
      calls.push(`arm:${phase}`);
    },
    hover: async (index) => {
      calls.push(`hover:${index}`);
    },
    wait: async () => {
      reachedCold();
      return cold;
    },
    capture: async (state) => {
      calls.push(`capture:${state}`);
    },
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
  await assert.rejects(
    runTooltipWarmHandoff({
      arm: async (phase) => {
        inputs.push(`arm:${phase}`);
      },
      hover: async (index) => {
        inputs.push(`hover:${index}`);
      },
      wait: async () => ({ achieved: true }),
      capture: async () => {
        throw new Error('injected fingerprint mismatch');
      },
      record,
    }),
    /fingerprint mismatch/
  );
  assert.deepEqual(inputs, ['arm:cold', 'hover:0']);
  assert.equal(record.stage, 'cold-capture');
});

test('a rejected warm ownership result preserves cold captures without claiming the warm target', async () => {
  const captured = [];
  const record = {};
  await assert.rejects(
    runTooltipWarmHandoff({
      arm: async () => {},
      hover: async () => {},
      wait: async (phase) => ({
        achieved: phase === 'cold',
        reason: 'injected retained first Content',
      }),
      capture: async (state) => {
        captured.push(state);
      },
      record,
    }),
    /warm sibling handoff/
  );
  assert.deepEqual(captured, ['hover', 'hover-open']);
  assert.equal(captured.includes(TOOLTIP_WARM_HANDOFF_STATE), false);
  assert.equal(record.stage, 'warm-observation');
  assert.equal(record.warm.achieved, false);
});

test('falsy capture failures remain failures and cannot advance to a warm input', async () => {
  const inputs = [];
  await assert.rejects(
    runTooltipWarmHandoff({
      arm: async (phase) => {
        inputs.push(`arm:${phase}`);
      },
      hover: async (index) => {
        inputs.push(`hover:${index}`);
      },
      wait: async () => ({ achieved: true }),
      capture: async () => {
        throw undefined;
      },
      record: {},
    }),
    (error) => error === undefined
  );
  assert.deepEqual(inputs, ['arm:cold', 'hover:0']);
});
