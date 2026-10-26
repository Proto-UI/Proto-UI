import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { parse } from 'yaml';
import { Window } from 'happy-dom';
import {
  HOMEPAGE_BASELINE,
  HOMEPAGE_KEYBOARD_TRANSITION,
  HOMEPAGE_POINTER_RUNTIME_SEQUENCE,
  HOMEPAGE_VIEWPORTS,
  layoutFailures,
  classifyHistoricalFailure,
  classifyCapturedFailure,
  verifyRevision,
} from './homepage-evidence-contract';

test('evidence binds to a full exact SHA and a clean source checkout', () => {
  assert.doesNotThrow(() => verifyRevision(HOMEPAGE_BASELINE, HOMEPAGE_BASELINE, ''));
  assert.throws(
    () => verifyRevision(HOMEPAGE_BASELINE, HOMEPAGE_BASELINE.slice(0, 8), ''),
    /full Git SHA/
  );
  assert.throws(() => verifyRevision('a'.repeat(40), HOMEPAGE_BASELINE, ''), /Revision mismatch/);
  assert.throws(
    () => verifyRevision(HOMEPAGE_BASELINE, HOMEPAGE_BASELINE, ' M homepage.css'),
    /clean source/
  );
});

test('candidate layout failures distinguish overflow, missing samples and serif inheritance', () => {
  const valid = {
    viewportWidth: 390,
    documentWidth: 390,
    bodyWidth: 390,
    fonts: [{ name: 'heading', fontFamily: 'Arial, sans-serif' }],
  };
  assert.deepEqual(layoutFailures(valid), []);
  assert.match(layoutFailures({ ...valid, bodyWidth: 411 })[0]!, /Horizontal overflow/);
  assert.match(layoutFailures({ ...valid, fonts: [] })[0]!, /Missing heading/);
  assert.match(
    layoutFailures({
      ...valid,
      fonts: [{ name: 'heading', fontFamily: 'Times New Roman, serif' }],
    })[0]!,
    /sans-serif/
  );
  assert.deepEqual(
    HOMEPAGE_VIEWPORTS.map(({ width, height }) => [width, height]),
    [
      [1440, 1000],
      [390, 844],
    ]
  );
});

test('pointer coverage reaches all four runtimes before strict non-first keyboard navigation', () => {
  assert.deepEqual(
    [...new Set(HOMEPAGE_POINTER_RUNTIME_SEQUENCE)].sort(),
    ['react', 'vue', 'vue2', 'wc'].sort()
  );
  assert.equal(
    HOMEPAGE_POINTER_RUNTIME_SEQUENCE.filter((runtime) => runtime === 'react').length,
    2
  );
  assert.deepEqual(HOMEPAGE_KEYBOARD_TRANSITION, { from: 'react', to: 'vue' });
  const source = readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8');
  assert.match(source, /chooseRuntime\(page, runtime, false\)/);
  assert.ok(
    source.indexOf('HOMEPAGE_POINTER_RUNTIME_SEQUENCE.entries()') <
      source.indexOf('chooseRuntime(page, HOMEPAGE_KEYBOARD_TRANSITION.to, true)')
  );
  assert.match(source, /aria-selected="true"\]:focus/);
  assert.match(source, /report\.failures\.push/);
});

test('CI preserves the pinned baseline, exact head, read-only permissions and artifact boundary', () => {
  const source = readFileSync(
    new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
    'utf8'
  );
  const workflow = parse(source);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.equal(workflow.env.BASELINE_SHA, HOMEPAGE_BASELINE);
  assert.equal(
    workflow.env.CANDIDATE_SHA,
    '${{ github.event.pull_request.head.sha || github.sha }}'
  );
  assert.ok(workflow.on.pull_request.paths.includes('apps/www/**'));
  assert.equal(workflow.on.pull_request_target, undefined);
  const packageMetadata = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
  );
  const nodeSetup = workflow.jobs.capture.steps.find((step: { uses?: string }) =>
    step.uses?.startsWith('actions/setup-node@')
  );
  assert.equal(String(nodeSetup.with['node-version']), packageMetadata.engines.node.split('.')[0]);
  assert.doesNotMatch(source, /\$\{\{\s*secrets\./);
  const steps = workflow.jobs.capture.steps;
  assert.equal(
    steps.find((step: { id?: string }) => step.id === 'baseline_capture')['continue-on-error'],
    true
  );
  const inventory = steps.find((step: { id?: string }) => step.id === 'baseline_visual_inventory');
  assert.ok(inventory.if.includes('always()'));
  assert.ok(inventory.run.includes('report.cases.length, 20'));
  for (const step of steps.filter(
    (step: { name?: string }) =>
      step.name?.includes('Capture real exact-head candidate') ||
      step.name?.includes('Execute focused real-browser')
  )) {
    assert.notEqual(
      step['continue-on-error'],
      true,
      'Candidate evidence and regressions remain strict'
    );
  }

  const checkouts = steps.filter((step: { uses?: string }) =>
    step.uses?.startsWith('actions/checkout@')
  );
  assert.equal(checkouts.length, 2);
  for (const checkout of checkouts) assert.equal(checkout.with['persist-credentials'], false);
  const artifact = steps
    .filter((step: { uses?: string }) => step.uses?.startsWith('actions/upload-artifact@'))
    .at(-1);
  assert.equal(artifact.with.path, '${{ runner.temp }}/homepage-evidence');
  assert.equal(artifact.if, 'always()');
});

test('density retains the whole increment baseline alongside a separately pinned feedback pair', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['visual-density'];
  assert.equal(job.env.DENSITY_BASELINE_SHA, 'ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31');
  assert.equal(job.env.DENSITY_FOLLOWUP_BASELINE_SHA, 'fbd90df092369e6d2aab73c66848f4236ba83a29');
  const before = job.steps.filter((step: { run?: string }) =>
    step.run?.includes('--revision-kind baseline')
  );
  assert.equal(before.length, 2);
  assert.equal(before[0].working_directory ?? before[0]['working-directory'], 'followup-baseline');
  assert.match(before[0].run, /DENSITY_FOLLOWUP_BASELINE_SHA.*--quick-preview/);
  assert.equal(before[1]['working-directory'], 'baseline');
  assert.match(before[1].run, /DENSITY_BASELINE_SHA/);
  assert.doesNotMatch(before[1].run, /--quick-preview/);
});

test('serialized browser probes do not depend on tsx keepNames helpers', () => {
  let inspected = 0;
  for (const file of [
    'capture-homepage-evidence.ts',
    'capture-documentation-evidence.ts',
    'capture-mobile-interaction-evidence.ts',
    'capture-visual-density-evidence.ts',
  ]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, import.meta.url), 'utf8'),
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['evaluate', 'evaluateAll', 'waitForFunction', 'addInitScript'].includes(
          node.expression.name.text
        )
      ) {
        const callback = node.arguments[0];
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const compiled = transformSync(`const probe = ${callback.getText(source)};`, {
            loader: 'ts',
            format: 'cjs',
            target: 'es2022',
            keepNames: true,
          }).code;
          const probe = runInNewContext(`${compiled}\nprobe;`);
          assert.doesNotMatch(
            String(probe),
            /\b__name\s*\(/,
            `${file}:${source.getLineAndCharacterOfPosition(node.pos).line + 1} must be self-contained when Playwright serializes it`
          );
          inspected++;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(inspected >= 15, 'Inspect the actual browser callbacks, not a synthetic subset');
});

test('full CI uses the same supported toolbar preference before exercising public-page clicks', () => {
  const workflow = parse(
    readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  );
  const steps = workflow.jobs['test-browser'].steps;
  const preferenceIndex = steps.findIndex((step: { run?: string }) =>
    step.run?.includes('astro preferences disable devToolbar')
  );
  const testsIndex = steps.findIndex(
    (step: { name?: string }) =>
      step.name === 'Run the bounded shard with its own documentation server'
  );
  assert.ok(preferenceIndex >= 0 && preferenceIndex < testsIndex);
  assert.match(steps[preferenceIndex].run, /astro preferences get devToolbar.enabled/);
  assert.equal(workflow.jobs['test-browser']['timeout-minutes'], 20);
  assert.deepEqual(workflow.jobs.test.needs, ['test-plan', 'test-general', 'test-browser']);
  assert.equal(workflow.jobs.test.if, 'always()');
});

test('baseline negative control never swallows unrelated or candidate failures', () => {
  const known = {
    revisionKind: 'baseline',
    route: '/en/',
    stage: 'keyboard-home',
    errorName: 'TimeoutError',
    activeRole: 'option',
    activeText: 'React',
    committedRuntime: 'react',
  };
  assert.equal(classifyHistoricalFailure(known), 'baseline-react-select-home-focus');
  for (const different of [
    { revisionKind: 'candidate' },
    { route: '/zh-cn/ui-libraries/base/toggle/' },
    { stage: 'keyboard-arrow-down' },
    { errorName: 'ReferenceError' },
    { activeRole: 'listbox' },
    { activeText: 'Vue' },
    { committedRuntime: 'wc' },
  ])
    assert.equal(classifyHistoricalFailure({ ...known, ...different }), 'unexpected');
});

test('the actual serialized failure snapshot reaches the historical classifier', () => {
  const source = ts.createSourceFile(
    'capture-homepage-evidence.ts',
    readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  let snapshotProbe: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'failureState') {
      const findEvaluate = (child: ts.Node) => {
        if (
          ts.isCallExpression(child) &&
          ts.isPropertyAccessExpression(child.expression) &&
          child.expression.name.text === 'evaluate'
        ) {
          snapshotProbe = child.arguments[0];
        }
        ts.forEachChild(child, findEvaluate);
      };
      ts.forEachChild(node, findEvaluate);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(snapshotProbe, 'Test the actual capture callback, not a duplicate fixture');
  const compiled = transformSync(`const probe = ${snapshotProbe.getText(source)};`, {
    loader: 'ts',
    format: 'cjs',
    target: 'es2022',
    keepNames: true,
  }).code;
  const document = {
    activeElement: {
      tagName: 'DIV',
      id: 'react-option',
      getAttribute: () => 'option',
      textContent: 'React',
      outerHTML: '<div role="option">React</div>',
    },
    querySelector: (selector: string) =>
      selector === '[data-home-demo-options]' ? { dataset: { runnerRuntime: 'react' } } : null,
    querySelectorAll: () => [],
  };
  const failureState = runInNewContext(`${compiled}\nprobe();`, { document });
  const input = {
    revisionKind: 'baseline',
    route: '/en/',
    stage: 'keyboard-home',
    errorName: 'TimeoutError',
    failureState,
  };
  assert.equal(classifyCapturedFailure(input), 'baseline-react-select-home-focus');
  assert.equal(classifyCapturedFailure({ ...input, revisionKind: 'candidate' }), 'unexpected');
  assert.equal(classifyCapturedFailure({ ...input, failureState: null }), 'unexpected');
});

test('font evidence selects visible captions and excludes clipped accessible labels', () => {
  const source = readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8');
  assert.match(source, /name: 'definition-label', selector: '\.home-demo-previewer__meta-label'/);
  assert.match(source, /getBoundingClientRect\(\)\.width > 2/);
  assert.match(source, /getBoundingClientRect\(\)\.height > 2/);
});

test('the actual ownership probe recognizes real control-only groups and rejects empty ones', async () => {
  const source = ts.createSourceFile(
    'capture-homepage-evidence.ts',
    readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const declaration = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'ownership'
  );
  assert.ok(declaration, 'Execute the actual capture function, including its assertions');
  const compiled = transformSync(`${declaration.getText(source)}\nownership;`, {
    loader: 'ts',
    target: 'es2022',
    keepNames: true,
  }).code;
  const window = new Window();
  const document = window.document;
  const scope = (content: string) => `
    <div data-projection-generation-host data-projection-generation-state="active">
      <div data-projection-scope data-projection-runtime="wc"
        data-projection-generation="7" data-projection-state="ready">${content}</div>
    </div>`;
  // A synthetic DOM fixture of the real composition marker contract, not browser evidence.
  document.body.innerHTML = `
    <header data-homepage-runtime data-runtime-generation="7">
      <div id="home-brand" data-homepage-actions><div data-homepage-mount>
        ${scope('<div data-projection-content><a href="/en/">Proto UI</a></div>')}
      </div></div>
      <div id="home-preferences" data-homepage-actions><div data-homepage-mount>
        ${scope('<div class="pui-projection-controls"><div data-projection-control="runtime"><wc-select-root data-pui-root></wc-select-root></div></div><div data-projection-content></div>')}
      </div></div>
    </header>
    <div data-home-demo-host>
      ${scope('<div data-projection-content><wc-button data-pui-root></wc-button></div>')}
    </div>`;
  const ownership = runInNewContext(compiled, { document, assert, revisionKind: 'candidate' });
  const page = { evaluate: (callback: () => unknown) => callback() };
  const result = await ownership(page, 'wc');
  assert.equal(
    result.find((host: { name: string }) => host.name === 'home-preferences').scopes[0].roots
      .length,
    1
  );

  const control = document.querySelector('[data-projection-control="runtime"]')!;
  control.innerHTML = '<span>Web Components</span>';
  await assert.rejects(
    () => ownership(page, 'wc'),
    /home-preferences: actual prototype or native-anchor content required/
  );
  control.innerHTML = '<wc-select-root data-pui-root></wc-select-root>';
  control.closest('[data-projection-scope]')!.setAttribute('data-projection-generation', '6');
  await assert.rejects(() => ownership(page, 'wc'), /home-preferences: same page generation/);
  window.happyDOM.abort();
});

function captureDeclarations(names: string[]) {
  const source = ts.createSourceFile(
    'capture-homepage-evidence.ts',
    readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const declarations = source.statements.filter((node) =>
    ts.isFunctionDeclaration(node)
      ? names.includes(node.name?.text ?? '')
      : ts.isVariableStatement(node) &&
        node.declarationList.declarations.some((entry) =>
          names.includes(entry.name.getText(source))
        )
  );
  assert.equal(declarations.length, names.length, 'Compile the actual capture declarations');
  return transformSync(declarations.map((node) => node.getText(source)).join('\n'), {
    loader: 'ts',
    target: 'es2022',
    keepNames: true,
  }).code;
}

test('actual pageerror recorder snapshots stack and probe context synchronously without filtering errors', () => {
  const compiled = captureDeclarations(['observePageErrors']);
  const observedAt = '2026-10-03T06:00:00.000Z';
  const observe = runInNewContext(`${compiled}\nobservePageErrors;`, {
    Date: class extends Date {
      constructor() {
        super(observedAt);
      }
    },
  });
  let listener: ((error: Error) => unknown) | undefined;
  const page = {
    on(event: string, callback: typeof listener) {
      assert.equal(event, 'pageerror');
      listener = callback;
    },
  };
  const context = {
    runtime: 'react' as string | null,
    requestedRuntime: null as string | null,
    activeProbeStage: 'workspace-settings-switch-change' as string | null,
  };
  const { pageErrors, pageErrorDetails } = observe(page, () => context);
  assert.ok(listener);
  const error = new Error('[Context] illegal phase for run.context.update: unknown');
  error.stack = `${error.message}\n    at update (http://localhost:4321/context.ts:42:9)`;
  assert.equal(listener(error), undefined, 'No ignored Promise or deferred browser query');
  assert.equal(pageErrors.length, 1, 'The strict message log updates before the listener returns');
  assert.equal(pageErrorDetails.length, 1);
  context.runtime = 'vue';
  context.requestedRuntime = 'wc';
  context.activeProbeStage = 'keyboard-commit';
  assert.equal(listener(error), undefined, 'Repeated identical errors must also be retained');
  const noStack = new Error('unrelated error');
  noStack.stack = undefined;
  context.runtime = null;
  context.activeProbeStage = null;
  listener(noStack);
  assert.deepEqual(Array.from(pageErrors), [error.message, error.message, noStack.message]);
  assert.deepEqual(JSON.parse(JSON.stringify(pageErrorDetails)), [
    {
      message: error.message,
      name: 'Error',
      stack: error.stack,
      observedAt,
      runtime: 'react',
      requestedRuntime: null,
      activeProbeStage: 'workspace-settings-switch-change',
    },
    {
      message: error.message,
      name: 'Error',
      stack: error.stack,
      observedAt,
      runtime: 'vue',
      requestedRuntime: 'wc',
      activeProbeStage: 'keyboard-commit',
    },
    {
      message: noStack.message,
      name: 'Error',
      stack: null,
      observedAt,
      runtime: null,
      requestedRuntime: 'wc',
      activeProbeStage: null,
    },
  ]);
  const source = readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8');
  assert.match(source, /const \{ pageErrors, pageErrorDetails \} = observePageErrors\(page,/);
  assert.match(source, /evidence\.pageErrorDetails = pageErrorDetails;/);
  assert.match(source, /assert\.deepEqual\(pageErrors, \[\], 'No uncaught page errors'\);/);
  assert.throws(() => assert.deepEqual(Array.from(pageErrors), []));
});

test('actual runtime task recorder retains only new errors for repeated runtimes and rethrows task failures', async () => {
  const compiled = captureDeclarations(['recordRuntimeTask']);
  const record = runInNewContext(`${compiled}\nrecordRuntimeTask;`);
  const runtimeTasks: Array<Record<string, any>> = [];
  const earlier = { message: 'before task' };
  const first = { message: 'first task', activeProbeStage: 'workspace-settings-view-select' };
  const second = { message: 'second task', activeProbeStage: 'workspace-settings-default-save' };
  const pageErrorDetails = [earlier];
  const result = { saved: true };
  assert.equal(
    await record(runtimeTasks, pageErrorDetails, 'react', 0, async () => {
      assert.equal(runtimeTasks.length, 1, 'Publish the task before it runs');
      pageErrorDetails.push(first);
      await Promise.resolve();
      return result;
    }),
    result
  );
  const failure = new Error('strict task assertion');
  await assert.rejects(
    record(runtimeTasks, pageErrorDetails, 'react', 4, async () => {
      pageErrorDetails.push(second);
      await Promise.resolve();
      throw failure;
    }),
    (error: unknown) => error === failure
  );
  await record(runtimeTasks, pageErrorDetails, 'wc', 5, async () => undefined);
  assert.deepEqual(
    runtimeTasks.map(
      ({ runtime, pointerStep, pageErrorStartIndex, pageErrorEndIndex, pageErrors }) => ({
        runtime,
        pointerStep,
        pageErrorStartIndex,
        pageErrorEndIndex,
        pageErrors: Array.from(pageErrors),
      })
    ),
    [
      {
        runtime: 'react',
        pointerStep: 0,
        pageErrorStartIndex: 1,
        pageErrorEndIndex: 2,
        pageErrors: [first],
      },
      {
        runtime: 'react',
        pointerStep: 4,
        pageErrorStartIndex: 2,
        pageErrorEndIndex: 3,
        pageErrors: [second],
      },
      {
        runtime: 'wc',
        pointerStep: 5,
        pageErrorStartIndex: 3,
        pageErrorEndIndex: 3,
        pageErrors: [],
      },
    ]
  );
  for (const task of runtimeTasks) {
    assert.ok(Number.isFinite(Date.parse(task.startedAt)));
    assert.ok(Date.parse(task.finishedAt) >= Date.parse(task.startedAt));
  }
  pageErrorDetails.push({ message: 'after tasks' });
  assert.equal(runtimeTasks[0]!.pageErrors.length, 1, 'Finished error slices do not grow later');
  assert.deepEqual(pageErrorDetails, [earlier, first, second, { message: 'after tasks' }]);
  const source = readFileSync(new URL('capture-homepage-evidence.ts', import.meta.url), 'utf8');
  assert.match(source, /workspaceSettings: await recordRuntimeTask\(/);
  assert.match(source, /evidence\.runtimeTasks as Array<Record<string, unknown>>/);
});

test('candidate samples task content while the immutable baseline keeps picker samples', () => {
  const compiled = captureDeclarations([
    'HOME',
    'commonFontSelectors',
    'baselineFontSelectors',
    'candidateFontSelectors',
    'fontSelectors',
    'surfaceSelectors',
  ]);
  const candidate = runInNewContext(`${compiled}\n({ HOME, fontSelectors, surfaceSelectors });`, {
    revisionKind: 'candidate',
  });
  const baseline = runInNewContext(`${compiled}\n({ HOME, fontSelectors, surfaceSelectors });`, {
    revisionKind: 'baseline',
  });
  assert.equal(candidate.HOME, '[data-home-showcase="website-component-gallery"]');
  assert.equal(baseline.HOME, '[data-home-demo-options]');
  const names = (value: typeof candidate) =>
    Array.from(value.fontSelectors, (sample: { name: string }) => sample.name);
  assert.ok(names(candidate).includes('task-feedback'));
  assert.ok(names(candidate).includes('task-save-action'));
  assert.ok(names(candidate).includes('library-control'));
  for (const removed of [
    'component-control',
    'definition-label',
    'preview-intro-title',
    'research-lead',
  ]) {
    assert.ok(names(baseline).includes(removed));
    assert.ok(!names(candidate).includes(removed));
  }
  assert.ok(
    candidate.surfaceSelectors.includes(`${candidate.HOME} [data-demo-ref="settings-view-trigger"]`)
  );
});

test('actual task observer reads physical textarea and rejects stale values or missing feedback', () => {
  const compiled = captureDeclarations(['observeWorkspaceSettings']);
  for (const wrappedTextarea of [false, true]) {
    const window = new Window();
    const document = window.document;
    // Synthetic observer unit fixture, not evidence of rendered controls.
    document.body.innerHTML = `
      <section data-home-showcase="website-component-gallery">
        <div data-demo-ref="settings" data-dirty="false">
          <div data-demo-ref="settings-view-trigger">Board</div>
          <div data-demo-ref="settings-summary" aria-checked="true"></div>
          ${
            wrappedTextarea
              ? '<wc-textarea data-demo-ref="settings-note"><textarea></textarea></wc-textarea>'
              : '<textarea data-demo-ref="settings-note"></textarea>'
          }
          <div data-demo-ref="settings-save" aria-disabled="true"></div>
          <div data-demo-ref="settings-reset" aria-disabled="false"></div>
          <div data-demo-ref="settings-feedback" role="status">Saved to this page</div>
        </div>
      </section>`;
    document.querySelector('textarea')!.value = 'A real note value';
    const observe = runInNewContext(`${compiled}\nobserveWorkspaceSettings;`, { document });
    assert.doesNotMatch(
      String(observe),
      /\b__name\s*\(/,
      'Named browser observer is self-contained'
    );
    const input = {
      homeSelector: '[data-home-showcase="website-component-gallery"]',
      expected: {
        view: 'Board',
        summary: 'true',
        note: 'A real note value',
        dirty: 'false',
        saveDisabled: true,
        resetDisabled: false,
        feedback: 'Saved to this page',
      },
    };
    assert.deepEqual(JSON.parse(JSON.stringify(observe(input))), input.expected);
    assert.equal(observe({ ...input, expected: { ...input.expected, note: 'old note' } }), false);
    assert.equal(observe({ ...input, expected: { ...input.expected, summary: 'false' } }), false);
    assert.equal(
      observe({ ...input, expected: { ...input.expected, saveDisabled: false } }),
      false
    );
    document.querySelector('[data-demo-ref="settings-feedback"]')!.removeAttribute('role');
    assert.equal(observe(input), false, 'An absent live feedback region cannot pass');
    window.happyDOM.abort();
  }
});

test('actual candidate task driver saves edits, restores a dirty draft, then saves defaults in both locales', async () => {
  const compiled = captureDeclarations(['exerciseWorkspaceSettings']);
  for (const route of ['/en/', '/zh-cn/']) {
    const english = route === '/en/';
    const labels = english
      ? {
          list: 'Email',
          board: 'Push',
          changed: 'Unsaved changes',
          unchanged: 'No unsaved changes',
          saved: 'Saved to this page',
          restored: 'Defaults restored',
          on: 'Weekly summary on',
          off: 'Weekly summary off',
        }
      : {
          list: '邮件',
          board: '推送',
          changed: '有未保存的更改',
          unchanged: '没有未保存的更改',
          saved: '已保存到本页',
          restored: '已恢复默认值',
          on: '显示每周摘要',
          off: '隐藏每周摘要',
        };
    let state = {
      view: labels.list,
      summary: 'false',
      note: '',
      dirty: 'false',
      saveDisabled: true,
      resetDisabled: true,
      feedback: labels.unchanged,
    };
    const actions: string[] = [];
    const snapshots: string[] = [];
    const probeStages: Array<string | null> = [];
    const home = '[data-home-showcase="website-component-gallery"]';
    // Driver unit fixture: control behavior is modeled only to reject an
    // incorrect input sequence or expectation. Actual-browser execution is separate.
    const locate = (selector: string): any => ({
      locator: locate,
      async evaluateAll(callback: (nodes: Element[]) => unknown) {
        return callback(
          [
            'controls',
            'hover',
            'workspace-command',
            'workspace-help',
            'preferences',
            'workspace-progress',
            'editor',
            'overlays',
            'choices',
          ].map((id) => {
            const el = previewWindow.document.createElement('div');
            el.setAttribute('data-gallery-demo', id);
            return el as unknown as Element;
          })
        );
      },
      async click() {
        probeStages.push(probeContext.activeProbeStage);
        actions.push(selector);
        if (selector === '[data-demo-ref="settings-summary"]') state.summary = 'true';
        if (selector === '[data-demo-ref="settings-save"]') {
          assert.equal(state.saveDisabled, false, 'Never attempt to save an unchanged draft');
          state.dirty = 'false';
          state.saveDisabled = true;
          const count = english
            ? `Note: ${state.note.length} characters`
            : `备注 ${state.note.length} 字`;
          state.feedback = `${labels.saved} · ${state.view} · ${state.summary === 'true' ? labels.on : labels.off} · ${count}`;
        }
        if (selector === '[data-demo-ref="settings-reset"]') {
          assert.equal(state.resetDisabled, false);
          state = {
            view: labels.list,
            summary: 'false',
            note: '',
            dirty: 'true',
            saveDisabled: false,
            resetDisabled: true,
            feedback: `${labels.restored} · ${labels.changed}`,
          };
        }
      },
      async getAttribute(name: string) {
        probeStages.push(probeContext.activeProbeStage);
        assert.equal(selector, '[data-demo-ref="settings-view-trigger"]');
        assert.equal(name, 'aria-controls');
        return 'task-options';
      },
      async waitFor(options: unknown) {
        probeStages.push(probeContext.activeProbeStage);
        assert.equal(selector, '[id="task-options"]');
        assert.deepEqual(JSON.parse(JSON.stringify(options)), { state: 'visible' });
      },
      getByRole(role: string, options: { name: string; exact: boolean }) {
        assert.equal(selector, '[id="task-options"]');
        assert.equal(role, 'option');
        assert.equal(options.name, labels.board);
        assert.equal(options.exact, true);
        return {
          async click() {
            probeStages.push(probeContext.activeProbeStage);
            actions.push('choose-board');
            state = {
              ...state,
              view: labels.board,
              dirty: 'true',
              saveDisabled: false,
              resetDisabled: false,
              feedback: labels.changed,
            };
          },
        };
      },
    });
    const previewWindow = new Window();
    const page = {
      async waitForFunction(
        callback: (args: unknown) => unknown,
        args: { homeSelector: string; note: string }
      ) {
        assert.equal(state.view, labels.board);
        assert.equal(state.summary, 'true');
        assert.equal(state.note, args.note);
        const document = previewWindow.document;
        document.body.innerHTML = `<section data-home-showcase="website-component-gallery"><div data-demo-ref="settings-preview-tasks" data-view="board"></div><div data-demo-ref="settings-preview-summary"></div><div data-demo-ref="settings-preview-note"><span data-demo-ref="settings-preview-note-text"></span></div>${Array(5).fill('<div data-projection-prototype="shadcn-surface-root" data-pui-style="border"></div>').join('')}</section>`;
        document.querySelector('[data-demo-ref="settings-preview-note-text"]')!.textContent =
          state.note;
        const value = callback(args);
        assert.ok(value, 'The actual preview observer accepts real fixture state');
        const physicalSurface = document.querySelector('[data-projection-prototype]')!;
        physicalSurface.removeAttribute('data-pui-style');
        assert.equal(callback(args), false, 'A merely marked shell must not pass');
        physicalSurface.setAttribute('data-pui-style', 'border');
        document
          .querySelector('[data-demo-ref="settings-preview-summary"]')!
          .setAttribute('hidden', '');
        assert.equal(callback(args), false, 'Hidden output cannot satisfy the active summary');
        return {
          async jsonValue() {
            return value;
          },
          async dispose() {
            previewWindow.happyDOM.abort();
          },
        };
      },
      locator: locate,
      keyboard: {
        async insertText(text: string) {
          probeStages.push(probeContext.activeProbeStage);
          actions.push('type-note');
          state.note = text;
        },
      },
    };
    const probeContext = {
      document: previewWindow.document,
      HOME: home,
      assert,
      activeProbeStage: null as string | null,
      async waitForWorkspaceSettings(_page: unknown, expected: object) {
        probeStages.push(probeContext.activeProbeStage);
        assert.deepEqual(state, JSON.parse(JSON.stringify(expected)));
        return { ...state };
      },
    };
    const exercise = runInNewContext(`${compiled}\nexerciseWorkspaceSettings;`, probeContext);
    const result = await exercise(page, route, async (stage: string) => {
      probeStages.push(probeContext.activeProbeStage);
      snapshots.push(stage);
    });
    assert.equal(result.saved.dirty, 'false');
    assert.equal(result.restoredDraft.dirty, 'true');
    assert.equal(result.restoredDraft.saveDisabled, false);
    assert.equal(result.defaultsSaved.dirty, 'false');
    assert.equal(result.defaultsSaved.note, '');
    assert.deepEqual(snapshots, ['saved', 'restored-draft']);
    assert.deepEqual(probeStages, [
      'workspace-settings-initial',
      'workspace-settings-view-open',
      'workspace-settings-view-portal',
      'workspace-settings-view-portal',
      'workspace-settings-view-select',
      'workspace-settings-view-observe',
      'workspace-settings-switch-change',
      'workspace-settings-switch-observe',
      'workspace-settings-textarea-focus',
      'workspace-settings-textarea-input',
      'workspace-settings-textarea-observe',
      'workspace-settings-save',
      'workspace-settings-save-observe',
      'workspace-settings-saved-capture',
      'workspace-settings-restore',
      'workspace-settings-restore-observe',
      'workspace-settings-restored-draft-capture',
      'workspace-settings-default-save',
      'workspace-settings-default-save-observe',
    ]);
    assert.equal(probeContext.activeProbeStage, null, 'Completed task clears its active stage');
    assert.deepEqual(actions, [
      '[data-demo-ref="settings-view-trigger"]',
      'choose-board',
      '[data-demo-ref="settings-summary"]',
      'textarea[data-demo-ref="settings-note"], [data-demo-ref="settings-note"] textarea',
      'type-note',
      '[data-demo-ref="settings-save"]',
      '[data-demo-ref="settings-reset"]',
      '[data-demo-ref="settings-save"]',
    ]);
    assert.match(result.persistence, /no backend or durable-storage claim/);
  }
});

test('only the declared Brutalist Button/Textarea mono roles may differ from the page sans stack', () => {
  const base = {
    viewportWidth: 390,
    documentWidth: 390,
    bodyWidth: 390,
    family: 'brutalist',
    fonts: [
      { name: 'heading', fontFamily: 'Arial, sans-serif' },
      {
        name: 'task-note-control',
        fontFamily: 'ui-monospace, Consolas, monospace',
        prototypeId: 'brutalist-textarea-root',
        styleTokens: ['font-mono'],
      },
    ],
  };
  assert.deepEqual(layoutFailures(base), []);
  assert.ok(layoutFailures({ ...base, family: 'shadcn' }).length);
  for (const mutation of [
    { prototypeId: 'brutalist-select-trigger' },
    { styleTokens: [] },
    { fontFamily: 'Times New Roman, monospace' },
    { fontFamily: 'serif' },
  ])
    assert.ok(
      layoutFailures({ ...base, fonts: [base.fonts[0]!, { ...base.fonts[1]!, ...mutation }] })
        .length
    );
});

test('Dialog capture waits on the actual bounded focus owner and disposes its physical handle', async () => {
  const source = readFileSync(new URL('./capture-homepage-evidence.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('capture.ts', source, ts.ScriptTarget.Latest, true);
  const helper = parsed.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'waitForDialogEntryFocus'
  );
  assert.ok(helper);
  for (const mode of ['settles', 'never-enters', 'inert', 'detached', 'hidden', 'wrong-role']) {
    const window = new Window();
    const document = window.document;
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    const trigger = document.createElement('button');
    const command = document.createElement('button');
    modal.append(command);
    document.body.append(trigger, modal);
    trigger.focus();
    let disposed = 0;
    const observations: boolean[] = [];
    const handle = Object.assign(modal, {
      dispose: async () => {
        disposed++;
      },
    });
    const dialog = {
      elementHandle: async () => handle,
      evaluate: async (read: (node: typeof modal) => unknown) => read(modal),
    };
    const page = {
      waitForFunction: async (
        predicate: (node: typeof modal) => boolean,
        node: typeof modal,
        options: { timeout: number }
      ) => {
        assert.equal(node, modal);
        assert.equal(options.timeout, 5000);
        observations.push(predicate(node));
        if (mode !== 'never-enters') command.focus();
        if (mode === 'inert') modal.setAttribute('inert', '');
        if (mode === 'detached') modal.remove();
        if (mode === 'hidden') modal.setAttribute('aria-hidden', 'true');
        if (mode === 'wrong-role') modal.setAttribute('role', 'region');
        observations.push(predicate(node));
        if (!observations[1]) throw new Error('focus readiness deadline');
      },
    };
    const context = { assert, Date, document, result: undefined as unknown };
    runInNewContext(
      transformSync(`${helper.getText(parsed)}; result = waitForDialogEntryFocus;`, {
        loader: 'ts',
        target: 'es2022',
      }).code,
      context
    );
    const run = context.result as (
      page: unknown,
      dialog: unknown
    ) => Promise<{ initiallyInside: boolean; ownsEntryFocus: boolean }>;
    if (mode === 'settles') {
      const result = await run(page, dialog);
      assert.equal(result.initiallyInside, false);
      assert.equal(result.ownsEntryFocus, true);
      assert.deepEqual(observations, [false, true]);
    } else {
      await assert.rejects(run(page, dialog), /focus readiness deadline/);
      assert.deepEqual(observations, [false, false]);
    }
    assert.equal(disposed, 1);
    await window.happyDOM.close();
  }
});

test('native and Copy browser scopes have independent bounded jobs and small evidence bundles', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['isolated-controls'];
  assert.equal(job.needs, undefined);
  assert.equal(job['timeout-minutes'], 15);
  assert.equal(job.strategy['fail-fast'], false);
  assert.deepEqual(job.strategy.matrix.include, [
    { name: 'native-links', suite: 'site-native-links' },
    { name: 'code-surfaces', suite: 'code-surfaces' },
    { name: 'code-surface-grammar', suite: 'code-surface-grammar' },
    { name: 'docs-content-flow', suite: 'docs-content-flow' },
    { name: 'homepage-button-contract', suite: 'homepage-button-contract' },
    { name: 'homepage-composition', suite: 'homepage-composition' },
    { name: 'copy-commands', suite: 'site-copy-commands' },
    { name: 'runtime-box', suite: 'runtime-preview-surface', contract: 'runtime-preview-evidence' },
    { name: 'search-commands', suite: 'site-search-commands' },
  ]);
  const run = job.steps.find(
    (step: { name?: string }) => step.name === 'Execute the exact isolated browser suite'
  );
  assert.equal(run['continue-on-error'], undefined);
  assert.match(run.run, /timeout --signal=TERM --kill-after=10s 600s/);
  assert.match(run.run, /vitest run --no-file-parallelism "\$\{files\[@\]\}"/);
  assert.match(run.run, /files\+=\("\$CONTRACT_FILE"\)/);
  const checkout = job.steps.find((step: { uses?: string }) =>
    step.uses?.startsWith('actions/checkout@')
  );
  assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const artifact = job.steps.at(-1);
  assert.equal(artifact.if, 'always()');
  assert.match(artifact.with.name, /matrix.name/);
  const focused = workflow.jobs.capture.steps.find((step: { name?: string }) =>
    step.name?.startsWith('Execute focused real-browser')
  );
  for (const entry of job.strategy.matrix.include)
    assert.ok(
      !focused.run.includes(`${entry.suite}.browser.test.ts`),
      'No duplicated shared-lifetime suite'
    );
  for (const suite of [
    'homepage-dogfood',
    'home-demo-runtime',
    'prototype-projection-scope',
    'demo-brutalist-checkbox',
    'demo-brutalist-remaining',
  ])
    assert.ok(focused.run.includes(`${suite}.browser.test.ts`), `${suite} still runs`);
  const frames = workflow.jobs.capture.steps.find(
    (step: { name?: string }) => step.name === 'Retain small candidate frame and metadata bundles'
  );
  assert.equal(frames.if, 'always()');
  for (const pattern of [
    '*-initial-viewport.png',
    '*-initial-full.png',
    '*-navigation-open-viewport.png',
    '*brutalist-*-viewport.png',
    '*.json',
  ])
    assert.ok(frames.with.path.includes(pattern));
});

test('density observer rejects missing cards and incorrect physical multicol spacing', () => {
  const source = readFileSync(
    new URL('capture-visual-density-evidence.ts', import.meta.url),
    'utf8'
  );
  const ast = ts.createSourceFile(
    'density.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const declaration = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'gallerySpacingIssues'
  );
  assert.ok(declaration);
  const code = transformSync(declaration.getText(ast).replace('export ', ''), {
    loader: 'ts',
    target: 'es2022',
  }).code;
  const observe = runInNewContext(`${code}\ngallerySpacingIssues`);
  const ids = [
    'controls',
    'hover',
    'workspace-command',
    'workspace-help',
    'preferences',
    'workspace-progress',
    'editor',
    'overlays',
    'choices',
  ];
  const facts = {
    columnGap: '24px',
    cards: ids.map((id, i) => ({
      id,
      x: Math.floor(i / 3) * 324,
      right: Math.floor(i / 3) * 324 + 300,
      y: (i % 3) * 124,
      bottom: (i % 3) * 124 + 100,
    })),
  };
  assert.equal(observe(facts, 24).length, 0);
  const narrow = {
    columnGap: '20px',
    cards: ids.map((id, i) => ({ id, x: 0, right: 280, y: i * 120, bottom: i * 120 + 100 })),
  };
  assert.equal(observe(narrow, 20).length, 0);
  for (const mutate of [
    (value: typeof facts) => {
      value.cards.pop();
    },
    (value: typeof facts) => {
      value.cards[8]!.id = value.cards[0]!.id;
    },
    (value: typeof facts) => {
      value.columnGap = 'normal 24px';
    },
    (value: typeof facts) => {
      value.cards[1]!.y += 10;
    },
    (value: typeof facts) => {
      for (const card of value.cards.slice(3, 6)) {
        card.x += 10;
        card.right += 10;
      }
    },
    (value: typeof facts) => {
      value.cards[0]!.right = value.cards[0]!.x;
    },
  ]) {
    const broken = structuredClone(facts);
    mutate(broken);
    assert.ok(observe(broken, 24).length > 0);
  }
  assert.match(source, /assert\.deepEqual\(\s*gallerySpacingIssues\(facts\.gallerySpacing,/);
  assert.match(source, /select\.height - \(v\.width === 390 \? 44 : 36\)/);
});

test('only composition restores a hash-keyed font package without extending existing budgets', () => {
  const workflow = parse(
    readFileSync(
      new URL('../../../.github/workflows/homepage-visual-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const job = workflow.jobs['isolated-controls'];
  assert.equal(job['timeout-minutes'], 15);
  const cache = job.steps.find(
    (step: { name?: string }) => step.name === 'Restore the exact composition font package only'
  );
  assert.equal(cache.if, "matrix.name == 'homepage-composition'");
  assert.equal(cache.uses, 'actions/cache@v4');
  assert.equal(cache['timeout-minutes'], 1);
  assert.equal(
    cache.with.path,
    '${{ runner.temp }}/homepage-font-cache/fonts-noto-cjk_20230817+repack1-3_all.deb'
  );
  assert.equal(
    cache.with.key,
    'ubuntu24-fonts-noto-cjk-7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c'
  );
  assert.equal(cache.with['restore-keys'], undefined);
  const prep = job.steps.find(
    (step: { name?: string }) =>
      step.name === 'Install locked dependencies and the same official font package'
  );
  assert.equal(prep['timeout-minutes'], 5);
  assert.match(prep.run, /pnpm@10\.32\.1 install --frozen-lockfile --ignore-scripts/);
  assert.match(prep.run, /if \[\[ '\$\{\{ matrix.name \}\}' == 'homepage-composition' \]\]; then/);
  assert.match(
    prep.run,
    /timeout --signal=TERM --kill-after=5s 220s bash apps\/www\/scripts\/prepare-homepage-composition-fonts.sh/
  );
  assert.match(
    prep.run,
    /else\s+sudo apt-get update -qq\s+sudo apt-get install -y --no-install-recommends fonts-noto-cjk\s+fi/
  );
});

test('font acceptance rejects missing Chinese glyphs and malformed selected-face charsets', () => {
  const shell = readFileSync(
    new URL('prepare-homepage-composition-fonts.sh', import.meta.url),
    'utf8'
  );
  const body = shell.match(/<<'JS'\n([\s\S]*?)\nJS/);
  assert.ok(body);
  const code = transformSync(body[1]!, { loader: 'js', format: 'cjs', target: 'es2022' }).code;
  const verify = (charset: string) =>
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'node:assert/strict') return assert;
        if (name === 'node:fs') return { readFileSync: () => charset };
        throw new Error(`Unexpected font verifier import: ${name}`);
      },
      process: { argv: ['node', '-', 'selected-face.txt'] },
      console: { log: () => undefined },
    });
  assert.doesNotThrow(() => verify('20-7e 4e00-9fff'));
  for (const bad of ['', '20-7e', 'garbage', '9fff-4e00', '110000-110001'])
    assert.throws(() => verify(bad));
  assert.match(shell, /readonly VERSION='1:20230817\+repack1-3'/);
  assert.match(shell, /readonly SIZE='61229778'/);
  assert.match(
    shell,
    /readonly SHA256='7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c'/
  );
  assert.match(shell, /verify_deb "\$DEB" \|\| fail 'Cached Ubuntu font package/);
  assert.match(shell, /--connect-timeout 10 --max-time 60/);
  assert.match(shell, /Noto Sans CJK SC/);
  assert.match(shell, /dpkg-query -L "\$PACKAGE"/);
});

test('font preparation mocks preserve integrity and glyph failure gates without downloads', () => {
  const output = execFileSync(
    'bash',
    [
      new URL('prepare-homepage-composition-fonts.test.sh', import.meta.url).pathname,
      new URL('prepare-homepage-composition-fonts.sh', import.meta.url).pathname,
    ],
    { encoding: 'utf8', timeout: 20_000 }
  );
  assert.deepEqual(
    [...output.matchAll(/^PASS: ([\w-]+) \(exit /gm)].map((match) => match[1]),
    ['success', 'bad-sha', 'bad-version', 'wrong-family', 'missing-glyphs']
  );
});

test('200% text observer records the animated intermediate frame then requires the exact endpoint', async () => {
  const browser = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  );
  const start = browser.indexOf('async function resizeText200(');
  const end = browser.indexOf('\nasync function settled(', start);
  assert.ok(start >= 0 && end > start);
  const code = transformSync(
    `${browser.slice(start, end)}\nexports.resizeText200 = resizeText200;`,
    { loader: 'ts', format: 'cjs', target: 'es2022' }
  ).code;
  for (const reachesEndpoint of [true, false]) {
    let size = 16.45,
      disposed = false,
      reads = 0;
    const node = {
      tagName: 'BUTTON',
      textContent: 'Primary',
      isConnected: true,
      closest: () => null,
      getAnimations: () => [{ playState: 'running', currentTime: 25, effect: null }],
    };
    const samples = [{ node, before: 14 }];
    const context = {
      exports: {} as { resizeText200?: (page: unknown) => Promise<any[]> },
      KeyframeEffect: class {},
      getComputedStyle: () => ({
        fontSize: String(size),
        transitionProperty: 'all',
        transitionDuration: '0.15s',
      }),
      expect: {
        poll: (observe: () => Promise<boolean>, options: unknown) => ({
          toBe: async (value: boolean) => {
            assert.deepEqual(JSON.parse(JSON.stringify(options)), { timeout: 1500, interval: 25 });
            assert.equal(await observe(), false);
            if (reachesEndpoint) size = 28;
            if ((await observe()) !== value)
              throw new Error('bounded exact endpoint was not reached');
          },
        }),
      },
    };
    runInNewContext(code, context);
    const result = await context.exports.resizeText200!({
      evaluateHandle: async () => ({
        evaluate: async (fn: (samples: unknown) => unknown) => {
          reads++;
          return fn(samples);
        },
        dispose: async () => {
          disposed = true;
        },
      }),
    });
    assert.equal(result[0].immediate.after, 16.45);
    assert.equal(result[0].immediate.animations[0].playState, 'running');
    assert.equal(result[0].after, reachesEndpoint ? 28 : 16.45);
    assert.equal(result[0].settleFailure === null, reachesEndpoint);
    assert.ok(disposed);
    assert.ok(reads >= 4);
  }
});

test('Accordion readiness remains count-one and width failures retain full physical layout evidence', () => {
  const browser = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  );
  const verify = (source: string) => {
    assert.match(
      source,
      /await expect\.poll\(\(\) => panel\.count\(\), \{ timeout: 1500, interval: 25 \}\)\.toBe\(1\)/
    );
    assert.match(source, /step\.afterPress = await accordionSnapshot\(\)/);
    assert.match(source, /step\.ready = await accordionSnapshot\(\)/);
    assert.match(source, /await attribute\(panel, 'aria-labelledby', triggerId\)/);
    assert.match(source, /expect\(fact\.input\.width\)\.toBeCloseTo\(fact\.parentWidth, 0\)/);
    assert.match(source, /flexBasis: css\.flexBasis/);
    assert.match(source, /record\.failureDOM = await page\.evaluate/);
  };
  verify(browser);
  for (const fragment of [
    'step.ready = await accordionSnapshot()',
    "await attribute(panel, 'aria-labelledby', triggerId)",
    'expect(fact.input.width).toBeCloseTo(fact.parentWidth, 0)',
    'record.failureDOM = await page.evaluate',
  ])
    assert.throws(() => verify(browser.replaceAll(fragment, '')));
});

test('homepage Command verifies the public outer shell and actual muted active paint without changing the editor', () => {
  const source = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  );
  const required = [
    'expect(paint.shellCount).toBe(1)',
    "expect(paint.rootRadius).toBe('22px')",
    "expect(paint.shellRadius).toBe('18px')",
    'expect(paint.shellHeight).toBe(32)',
    "expect(paint.innerRadius).toBe('0px')",
    "expect(paint.innerBorder).toBe('0px')",
    "expect(paint.innerFont).toBe('14px')",
    "expect(paint.activeRadius).toBe('14px')",
    'expect(paint.activeBackground).toBe(paint.expectedMuted)',
    "expect(paint.activeText).toBe('Build a prototype')",
    'record.commandPaint = paint',
    'record.commandPaintSamples = samples',
    "expect(paint.themeMutedToken).not.toBe('')",
    "expect(paint.expectedMuted).not.toBe('rgba(0, 0, 0, 0)')",
    'reference.remove()',
  ];
  const verify = (candidate: string) => {
    for (const fragment of required) assert.ok(candidate.includes(fragment), fragment);
    assert.match(candidate, /finally\s*\{\s*record\.commandPaint = paint;\s*await save\(\);/);
  };
  verify(source);
  for (const fragment of required) assert.throws(() => verify(source.replaceAll(fragment, '')));
});

test('homepage Select verifies the inherited Rhea surface, real portal and keyboard continuity', () => {
  const source = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  );
  const required = [
    "await stage('select-rhea')",
    "await trigger.press('ArrowDown')",
    "await page.keyboard.press('End')",
    "await page.keyboard.press('Home')",
    "await page.keyboard.press('Enter')",
    'await hasFocus(trigger)',
    "radius: '18px', height: 32, fontSize: '14px', gap: '6px'",
    "filter: 'blur(40px) saturate(1.5)'",
    "leafAriaHidden: 'true'",
    "padding: '4px', itemRadius: '14px', escaped: true",
    'record.selectPaintSamples = selectPaintSamples',
    'record.selectPaint = facts',
    'editor.evaluate((current, original) => current === original, originalEditor)',
    'backgroundMatches: background === expectedBackground',
    'Boolean(themePopover)',
    "expectedBackground !== 'rgba(0, 0, 0, 0)'",
    'reference.remove()',
    "await capture('select-rhea-open')",
    "expect(background).not.toBe('rgba(0, 0, 0, 0)')",
    'expect(await sameEditor()).toBe(true)',
  ];
  const verify = (candidate: string) => {
    candidate = candidate.replace(/\s+/g, ' ');
    for (const fragment of required) assert.ok(candidate.includes(fragment), fragment);
    assert.match(candidate, /finally\s*\{\s*await save\(\);\s*\}/);
    assert.equal(candidate.split('expect(await sameEditor()).toBe(true)').length - 1, 2);
  };
  const normalized = source.replace(/\s+/g, ' ');
  verify(normalized);
  for (const fragment of required) assert.throws(() => verify(normalized.replaceAll(fragment, '')));
});

test('composition screenshots preserve and disclose actual interaction framing', () => {
  const source = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  );
  const capture = source.slice(
    source.indexOf('const capture = async (name: string)'),
    source.indexOf('await save();\n          try {')
  );
  const required = [
    "mode: 'preserve-interaction-position'",
    'scrollX, scrollY',
    'width: innerWidth, height: innerHeight',
    'document.documentElement.scrollHeight',
    "header: box('header')",
    "heroHeading: box('main h1')",
    "search: box('.site-header-search')",
    'node.getBoundingClientRect()',
    'position: style.position',
    'zIndex: style.zIndex',
    'const beforeCapture = await framing()',
    'record.captureFraming',
    'afterCapture: await framing()',
    'fullPage: true',
  ];
  const verify = (candidate: string) => {
    for (const fragment of required) assert.ok(candidate.includes(fragment), fragment);
    assert.match(
      candidate,
      /record\.captureFraming =[^;]+;\s*await save\(\);\s*const bytes = await page!\.screenshot/
    );
    assert.ok(!candidate.includes('scrollTo('));
  };
  const normalized = capture.replace(/\s+/g, ' ');
  verify(normalized);
  for (const fragment of required) assert.throws(() => verify(normalized.replaceAll(fragment, '')));
});

test('gallery activation requires one exact localized result rather than a removed checkmark', () => {
  const text = readFileSync(new URL('./capture-homepage-evidence.ts', import.meta.url), 'utf8');
  const source = ts.createSourceFile('capture.ts', text, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'galleryButtonActivated'
  );
  assert.ok(declaration);
  const compiled = transformSync(declaration.getText(source), { loader: 'ts', format: 'cjs' }).code;
  for (const expected of ['主要按钮: 已触发', 'Primary button: Activated']) {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = '<main data-home-showcase="website-component-gallery"></main>';
    const home = '[data-home-showcase="website-component-gallery"]';
    const observe = runInNewContext(`${compiled}\ngalleryButtonActivated;`, { document });
    const probe = () => observe({ home, expected });
    assert.equal(probe(), false, 'missing result');
    const feedback = document.createElement('span');
    feedback.dataset.demoRef = 'gallery-controls-feedback';
    document.querySelector(home)!.append(feedback);
    for (const wrong of ['', '✓', 'Try any control', expected + ' extra']) {
      feedback.textContent = wrong;
      assert.equal(probe(), false, 'wrong or partial result');
    }
    feedback.textContent = expected;
    assert.equal(probe(), true);
    feedback.after(feedback.cloneNode(true));
    assert.equal(probe(), false, 'duplicate result');
    window.happyDOM.abort();
  }
  assert.ok(text.includes("expected: zh ? '主要按钮: 已触发' : 'Primary button: Activated'"));
  assert.match(
    text,
    /gallery-primary[^\n]+\.click\(\);\s*await page\.waitForFunction\(galleryButtonActivated/
  );
});

test('Hero native evidence measures actual Text paint, real resize and unchanged editor without changing budgets', () => {
  const source = readFileSync(
    new URL('../src/content/docs/zh-cn/homepage-composition.browser.test.ts', import.meta.url),
    'utf8'
  ).replace(/\s+/g, ' ');
  const required = [
    "await stage('hero-responsive-typography')",
    'await page.setViewportSize({ width, height: 1000 })',
    "native.querySelector<HTMLElement>( '[data-typography-prototype]' )",
    'getComputedStyle(owner)',
    "fontSize: width >= 1280 ? '48px' : '30px'",
    "lineHeight: width >= 1280 ? '52.8px' : '33px'",
    "fontWeight: '600'",
    "letterSpacing: width >= 1280 ? '-2.4px' : '-0.75px'",
    'heroSamples.push({ width, expected, facts })',
    'current === original, originalNote',
    'current === original, originalHeading',
    'await hasFocus(note)',
    "expect(await note.inputValue()).toBe('Preserved across Hero viewport changes')",
    'record.nativeHero = nativeHero',
    'enhanced: false',
    '45_000',
  ];
  const verify = (candidate: string) => {
    for (const fragment of required) assert.ok(candidate.includes(fragment), fragment);
  };
  verify(source);
  for (const fragment of required) assert.throws(() => verify(source.replaceAll(fragment, '')));
});


test('density candidate uses the independent exact family heading oracle without relaxing other checks', () => {
  const source = readFileSync(
    new URL('capture-visual-density-evidence.ts', import.meta.url),
    'utf8'
  );
  const ast = ts.createSourceFile(
    'density.ts',
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const declaration = ast.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'expectedCandidateSloganFontSize'
  );
  assert.ok(declaration);
  const code = ts.transpileModule(declaration.getText(ast).replace('export ', ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const expected = runInNewContext(`${code}\nexpectedCandidateSloganFontSize`);
  const cases = [
    ['shadcn', 390, 30],
    ['shadcn', 960, 30],
    ['shadcn', 1279, 30],
    ['shadcn', 1280, 48],
    ['shadcn', 1440, 48],
    ['brutalist', 390, 24],
    ['brutalist', 1440, 36],
  ] as const;
  const check = (oracle: typeof expected) => {
    for (const [family, width, size] of cases) assert.equal(oracle(family, width), size);
  };
  check(expected);
  // Old shared sizing, wrong xl boundary, and accidentally changing Brutalist all fail.
  for (const mutant of [
    (_family: string, width: number) => (width === 390 ? 24 : 36),
    (family: string, width: number) =>
      family === 'shadcn' ? (width > 1280 ? 48 : 30) : expected(family, width),
    (_family: string, width: number) => (width >= 1280 ? 48 : 30),
  ])
    assert.throws(() => check(mutant));
  const call =
    'assert.equal(facts.slogan.fontSize, expectedCandidateSloganFontSize(v.family, v.width))';
  const checkCall = (text: string) => assert.ok(text.includes(call));
  checkCall(source);
  assert.throws(() => checkCall(source.replace(call, '')));
  assert.ok(source.includes('assert.ok(facts.overflow <= 1)'));
  assert.ok(source.includes('assert.equal(facts.title.fontSize, 16)'));
  assert.ok(
    source.includes("assert.equal(facts.caption.fontSize, v.family === 'shadcn' ? 14 : 12)")
  );
});

