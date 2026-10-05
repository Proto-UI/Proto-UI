import assert from 'node:assert/strict';
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
          ['controls', 'hover', 'preferences', 'editor', 'overlays', 'choices'].map((id) => {
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
