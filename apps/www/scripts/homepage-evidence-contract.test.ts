import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { parse } from 'yaml';
import { Window } from 'happy-dom';
import { HOMEPAGE_GALLERY_IDS } from '../src/components/Homepage/homepage-layout-evidence';
import {
  assertClosedHeaderState,
  assertNaturalOneLineCode,
  readCodeReadingGeometry,
} from './mobile-interaction-evidence-contract';
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

const oneLineCode = (rootFontSize: number): ReturnType<typeof readCodeReadingGeometry> => ({
  owner: 'wc-site-code-scroll-viewport',
  containsSource: true,
  sourceHeight: 3.25 * rootFontSize,
  sourceWidth: 548,
  sourceContentHeight: 1.5 * rootFontSize,
  paddingTop: 0.875 * rootFontSize,
  paddingBottom: 0.875 * rootFontSize,
  codeHeight: 1.5 * rootFontSize,
  lineHeights: [1.5 * rootFontSize],
  overflowX: 'auto',
  overflowY: 'auto',
  height: 3.25 * rootFontSize,
  fullHeight: 3.25 * rootFontSize,
  width: 207,
  fullWidth: 548,
  lineHeight: 1.5 * rootFontSize,
  rootFontSize,
  viewportHeight: 640,
  raw: 'npx @proto.ui/cli@latest --help',
  documentOverflow: 0,
});

test('mobile short-code geometry keeps one content line and independent authored padding at 100% and 200%', () => {
  for (const rootFontSize of [16, 32]) {
    const facts = oneLineCode(rootFontSize);
    assert.ok(facts.height > facts.lineHeight + 1, 'Preserve the old wrong-plane red comparison');
    assert.doesNotThrow(() => assertNaturalOneLineCode(facts, 'candidate', 'Short source'));
  }
});

test('mobile short-code geometry rejects blank height, clipping, wrapped or missing actual lines', () => {
  const facts = oneLineCode(32);
  for (const patch of [
    { sourceContentHeight: 50, height: 106, fullHeight: 106 },
    { height: 106, fullHeight: 106 },
    { height: 102 },
    { fullHeight: 106 },
    { codeHeight: 96 },
    { lineHeights: [96] },
    { lineHeights: [] },
    { lineHeights: [48, 48] },
    { raw: 'first\nsecond' },
    { raw: null },
  ]) {
    assert.throws(() =>
      assertNaturalOneLineCode({ ...facts, ...patch }, 'candidate', 'Short source')
    );
  }
});

test('mobile short-code padding cannot disappear or move to one side while content remains one line', () => {
  const facts = oneLineCode(32);
  assert.throws(
    () =>
      assertNaturalOneLineCode(
        { ...facts, paddingTop: 56, paddingBottom: 0 },
        'candidate',
        'Short source'
      ),
    /authored 0.875rem/
  );
  const noPadding = {
    ...facts,
    height: 48,
    fullHeight: 48,
    sourceHeight: 48,
    paddingTop: 0,
    paddingBottom: 0,
  };
  assert.throws(
    () => assertNaturalOneLineCode(noPadding, 'candidate', 'Short source'),
    /authored 0.875rem/
  );
  assert.doesNotThrow(() => assertNaturalOneLineCode(noPadding, 'baseline', 'Historical source'));
});

test('the serialized mobile source reader observes content and padding separately', () => {
  const window = new Window();
  const document = window.document;
  document.documentElement.style.fontSize = '32px';
  document.body.innerHTML =
    '<div id="viewport"><pre style="padding:28px 32px;line-height:48px"><code data-raw-code="command"><span class="line">command</span></code></pre></div>';
  const viewport = document.querySelector('#viewport')!;
  const source = viewport.querySelector('pre')!;
  const code = source.querySelector('code')!;
  const line = source.querySelector('.line')!;
  // Injected geometry isolates the reader; this is not native-browser layout evidence.
  for (const [element, height] of [
    [source, 104],
    [code, 48],
    [line, 48],
  ] as const) {
    element.getBoundingClientRect = () => ({ height, width: 548 }) as DOMRect;
  }
  for (const [element, properties] of [
    [source, { clientHeight: 104 }],
    [viewport, { clientHeight: 104, scrollHeight: 104, clientWidth: 207, scrollWidth: 548 }],
  ] as const) {
    for (const [name, value] of Object.entries(properties))
      Object.defineProperty(element, name, { value });
  }
  const serialized = String(readCodeReadingGeometry);
  assert.doesNotMatch(serialized, /\b__name\s*\(/);
  const read = runInNewContext(`(${serialized})`, {
    document,
    getComputedStyle: window.getComputedStyle.bind(window),
    innerHeight: 640,
    innerWidth: 320,
  });
  const facts = read(viewport) as ReturnType<typeof readCodeReadingGeometry>;
  assert.equal(facts.height, 104);
  assert.equal(facts.sourceContentHeight, 48);
  assert.equal(facts.codeHeight, 48);
  assert.equal(facts.paddingTop, 28);
  assert.equal(facts.paddingBottom, 28);
  assert.doesNotThrow(() => assertNaturalOneLineCode(facts, 'candidate', 'Actual sampled owner'));
  window.happyDOM.abort();
});

test('Header close accepts a painted inert leave phase and rejects a live or wrong owner', () => {
  const closed = {
    menuCount: 1,
    panelCount: 1,
    expanded: 'false',
    hidden: false,
    inert: true,
    menuFocused: true,
  };
  assert.doesNotThrow(() => assertClosedHeaderState(closed));
  assert.doesNotThrow(() => assertClosedHeaderState({ ...closed, hidden: true, inert: false }));
  for (const patch of [
    { expanded: 'true' },
    { inert: false },
    { menuFocused: false },
    { menuCount: 0 },
    { menuCount: 2 },
    { panelCount: 0 },
    { panelCount: 2 },
  ])
    assert.throws(() => assertClosedHeaderState({ ...closed, ...patch }));
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
          HOMEPAGE_GALLERY_IDS.map((id) => {
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
      HOMEPAGE_GALLERY_IDS,
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
  const expectedScopes = [
    { name: 'native-links', suite: 'site-native-links' },
    { name: 'brutalist-action-motion', suite: 'brutalist-action-motion' },
    { name: 'code-surfaces', suite: 'code-surfaces' },
    { name: 'code-surface-grammar', suite: 'code-surface-grammar' },
    { name: 'docs-content-flow', suite: 'docs-content-flow' },
    { name: 'homepage-button-contract', suite: 'homepage-button-contract' },
    { name: 'homepage-composition', suite: 'homepage-composition' },
    { name: 'copy-commands', suite: 'site-copy-commands' },
    { name: 'runtime-box', suite: 'runtime-preview-surface', contract: 'runtime-preview-evidence' },
    {
      name: 'search-activation',
      suite: 'site-search-activation',
      contract: 'site-search-browser-inventory',
    },
    { name: 'search-layout', suite: 'site-search-layout' },
    { name: 'search-menu', suite: 'site-search-menu' },
  ];
  assert.deepEqual(job.strategy.matrix.include, expectedScopes);
  assert.throws(
    () =>
      assert.deepEqual(
        [...job.strategy.matrix.include, { name: 'unknown-scope', suite: 'unknown-scope' }],
        expectedScopes
      ),
    { code: 'ERR_ASSERTION' }
  );
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
  const observe = runInNewContext(`${code}\ngallerySpacingIssues`, { HOMEPAGE_GALLERY_IDS });
  const ids = HOMEPAGE_GALLERY_IDS;
  const facts = {
    columnGap: '20px',
    physicalScale: 1,
    cards: ids.map((id, i) => ({
      id,
      x: Math.floor(i / 4) * 320,
      right: Math.floor(i / 4) * 320 + 300,
      y: (i % 4) * 124,
      bottom: (i % 4) * 124 + 100,
      rowGap: 24,
    })),
  };
  assert.equal(observe(facts, 20).length, 0);
  assert.equal(
    observe({ ...facts, cards: [...facts.cards].reverse() }, 20).length,
    0,
    'Membership and physical spacing do not depend on stale DOM ordering'
  );
  const narrow = {
    columnGap: '16px',
    physicalScale: 0.25,
    cards: ids.map((id, i) => ({
      id,
      x: Math.floor(i / 4) * 74,
      right: Math.floor(i / 4) * 74 + 70,
      y: (i % 4) * 29,
      bottom: (i % 4) * 29 + 25,
      rowGap: 16,
    })),
  };
  assert.equal(observe(narrow, 16).length, 0);
  assert.ok(observe({ ...narrow, physicalScale: 1 }, 16).includes('horizontal card spacing'));
  for (const mutate of [
    (value: typeof facts) => {
      value.cards.pop();
    },
    (value: typeof facts) => {
      value.cards[8]!.id = value.cards[0]!.id;
    },
    (value: typeof facts) => {
      value.columnGap = 'normal 20px';
    },
    (value: typeof facts) => {
      value.cards[1]!.y += 10;
    },
    (value: typeof facts) => {
      value.cards[0]!.rowGap = 14;
    },
    (value: typeof facts) => {
      for (const card of value.cards.slice(4, 8)) {
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
    assert.ok(observe(broken, 20).length > 0);
  }
});

test('isolated controls verify the exact font package within the existing budgets', () => {
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
    (step: { uses?: string }) => step.uses === 'actions/cache/restore@v4'
  );
  assert.ok(cache, 'Every isolated control restores the exact package');
  assert.equal(cache.if, undefined);
  assert.equal(cache['timeout-minutes'], 1);
  assert.deepEqual(cache.with, {
    path: '${{ runner.temp }}/homepage-font-cache/fonts-noto-cjk_20230817+repack1-3_all.deb',
    key: 'ubuntu24-fonts-noto-cjk-7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c',
  });
  const prep = job.steps.find(
    (step: { name?: string }) =>
      step.name === 'Install locked dependencies and the same official font package'
  );
  assert.equal(prep.id, 'prepare-isolated-fonts');
  assert.equal(prep['timeout-minutes'], 5);
  assert.equal(prep.if, undefined);
  assert.equal(prep['continue-on-error'], undefined);
  assert.match(prep.run, /pnpm@10\.32\.1 install --frozen-lockfile --ignore-scripts/);
  assert.match(
    prep.run,
    /timeout --signal=TERM --kill-after=5s 220s bash apps\/www\/scripts\/prepare-homepage-composition-fonts.sh/
  );
  assert.doesNotMatch(prep.run, /matrix\.name|apt-get/);
  const save = job.steps.find((step: { uses?: string }) => step.uses === 'actions/cache/save@v4');
  assert.equal(save['timeout-minutes'], 1);
  assert.equal(
    save.if,
    "${{ !cancelled() && steps.prepare-isolated-fonts.outcome == 'success' && matrix.name == 'homepage-composition' && steps.isolated-font-cache.outputs.cache-hit != 'true' }}"
  );
  assert.equal(save.with.path, cache.with.path);
  assert.equal(save.with.key, '${{ steps.isolated-font-cache.outputs.cache-primary-key }}');
  const browser = job.steps.find(
    (step: { name?: string }) => step.name === 'Execute the exact isolated browser suite'
  );
  assert.equal(browser['timeout-minutes'], 12);
  assert.match(browser.run, /timeout --signal=TERM --kill-after=10s 600s/);
  assert.ok(job.steps.indexOf(cache) < job.steps.indexOf(prep));
  assert.ok(job.steps.indexOf(prep) < job.steps.indexOf(browser));
  assert.ok(job.steps.indexOf(browser) < job.steps.indexOf(save));
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
});

function homepageDisclosureFixture(initiallyOpen: boolean, restoreFocus = true) {
  const calls: string[] = [];
  let expanded = String(initiallyOpen);
  const runtime = {};
  const menu = { getAttribute: (name: string) => (name === 'aria-expanded' ? expanded : null) };
  const document = {
    activeElement: runtime,
    querySelector(selector: string) {
      assert.match(selector, /data-demo-ref="home-menu"/);
      return menu;
    },
  };
  const locator = {
    getAttribute: async (name: string) => menu.getAttribute(name),
    click: async () => {
      calls.push('menu.click');
      expanded = 'true';
      document.activeElement = menu;
    },
    evaluate: async (read: (element: unknown) => unknown) => read(menu),
  };
  const page = {
    locator(selector: string) {
      assert.match(selector, /data-projection-generation-state="active"/);
      assert.match(selector, /data-demo-ref="home-menu"/);
      return locator;
    },
    keyboard: {
      press: async (key: string) => {
        assert.equal(key, 'Escape');
        calls.push('keyboard.Escape');
        expanded = 'false';
        if (restoreFocus) document.activeElement = menu;
      },
    },
    waitForFunction: async (read: () => boolean) => {
      assert.equal(read(), true, 'The original expanded-state predicate must hold');
    },
  };
  const compiled = captureDeclarations([
    'homepageSettingsMenu',
    'openHomepageSettings',
    'closeHomepageSettings',
  ]);
  const driver = runInNewContext(
    `${compiled}\n({ openHomepageSettings, closeHomepageSettings });`,
    { document, assert }
  );
  return { calls, page, driver, document, runtime, menu, expanded: () => expanded };
}

test('actual capture opens full desktop settings even when Runtime preferences are already visible', async () => {
  const f = homepageDisclosureFixture(false);
  await f.driver.openHomepageSettings(f.page);
  assert.equal(f.expanded(), 'true');
  assert.deepEqual(f.calls, ['menu.click']);
  await f.driver.openHomepageSettings(f.page);
  assert.deepEqual(f.calls, ['menu.click'], 'An already-open menu must not be toggled closed');
  await f.driver.closeHomepageSettings(f.page);
  assert.equal(f.expanded(), 'false');
  assert.equal(f.document.activeElement, f.menu);
  assert.deepEqual(f.calls, ['menu.click', 'keyboard.Escape']);
});

test('actual capture dismisses compact settings after Select focus evidence and preserves closed desktop focus', async () => {
  const compact = homepageDisclosureFixture(true);
  assert.equal(compact.document.activeElement, compact.runtime);
  await compact.driver.openHomepageSettings(compact.page);
  assert.deepEqual(compact.calls, []);
  assert.equal(
    compact.document.activeElement,
    compact.runtime,
    'Observe Select return before dismissal'
  );
  await compact.driver.closeHomepageSettings(compact.page);
  assert.deepEqual(compact.calls, ['keyboard.Escape']);
  assert.equal(compact.document.activeElement, compact.menu);
  const desktop = homepageDisclosureFixture(false);
  await desktop.driver.closeHomepageSettings(desktop.page);
  assert.deepEqual(desktop.calls, []);
  assert.equal(desktop.document.activeElement, desktop.runtime);
});

test('actual capture still rejects settings dismissal that loses the original menu focus return', async () => {
  const f = homepageDisclosureFixture(true, false);
  await assert.rejects(
    f.driver.closeHomepageSettings(f.page),
    /Closing settings must restore focus to the real menu control/
  );
});

function documentationCaptureDeclaration() {
  const source = ts.createSourceFile(
    'capture-documentation-evidence.ts',
    readFileSync(new URL('capture-documentation-evidence.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const declaration = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'exerciseDocumentationExample'
  );
  assert.ok(declaration, 'Execute the actual documentation interaction driver');
  return transformSync(declaration.getText(source), {
    loader: 'ts',
    target: 'es2022',
    keepNames: true,
  }).code;
}

function documentationCaptureFixture(
  revision: 'baseline' | 'candidate',
  family: 'base' | 'shadcn' | 'brutalist',
  responds = true
) {
  const calls: string[] = [];
  let checked = 'false';
  let hovered = false;
  const radioSelector =
    revision === 'candidate'
      ? '[data-demo-ref="hero-default"]'
      : '[data-demo-ref="density-default"]';
  const triggerText = revision === 'candidate' ? 'Account' : 'Hover or focus for details';
  const tooltipText = revision === 'candidate' ? 'View account settings' : 'Portable Base behavior';
  const tooltipDocument = new Window().document;
  tooltipDocument.body.innerHTML = `
    <div data-previewer-id>
      <div data-panel="preview"><div class="host"><button id="demo-tooltip-trigger">${triggerText}</button></div></div>
      <div data-panel="code"><pre><code><span>${triggerText}</span></code></pre></div>
    </div>`;
  const tooltipPreview = tooltipDocument.querySelector('[data-previewer-id]')!;
  const element = {
    getAttribute(name: string) {
      assert(['aria-checked', 'aria-pressed', 'aria-describedby'].includes(name));
      return name === 'aria-describedby' ? 'actual-tooltip-content' : checked;
    },
    textContent: 'Pin',
  };
  const control = {
    getAttribute: async (name: string) => element.getAttribute(name),
    click: async () => {
      calls.push('click');
      if (responds) checked = 'true';
    },
    hover: async () => {
      calls.push('hover');
      if (responds) hovered = true;
    },
  };
  const tooltipTextControl = (
    root: typeof tooltipPreview,
    text: string,
    options: { exact: boolean }
  ) => {
    assert.equal(text, triggerText);
    assert.equal(options.exact, true);
    const matches = [...root.querySelectorAll('*')].filter(
      (node) => node.children.length === 0 && node.textContent === text
    );
    assert.equal(matches.length, 1, 'Native input must resolve one rendered target, not code text');
    assert.equal(matches[0]!.id, 'demo-tooltip-trigger');
    calls.push(text);
    return control;
  };
  const document = {
    querySelector(selector: string) {
      assert.equal(
        selector,
        family === 'base'
          ? '[data-previewer-id] [role="button"][aria-pressed="true"]'
          : radioSelector
      );
      return family === 'base' && checked !== 'true' ? null : element;
    },
  };
  const preview = {
    locator(selector: string) {
      if (family === 'brutalist') {
        const scopes = tooltipPreview.querySelectorAll(selector);
        assert.equal(scopes.length, 1, 'The rendered demo must have one input scope');
        return {
          getByText: (text: string, options: { exact: boolean }) =>
            tooltipTextControl(scopes[0]!, text, options),
        };
      }
      assert.equal(selector, radioSelector);
      calls.push(selector);
      return control;
    },
    getByRole(role: string, options: { name: string; exact: boolean }) {
      assert.equal(role, 'button');
      assert.equal(options.name, 'Pin');
      assert.equal(options.exact, true);
      return control;
    },
    getByText(text: string, options: { exact: boolean }) {
      return tooltipTextControl(tooltipPreview, text, options);
    },
  };
  const page = {
    waitForFunction: async (read: (selector?: string) => boolean, selector?: string) => {
      assert.equal(read(selector), true, 'The original checked-state predicate must hold');
    },
    getByRole(role: string) {
      assert.equal(role, 'tooltip');
      return {
        filter(options: { hasText: string }) {
          assert.equal(options.hasText, tooltipText);
          return {
            waitFor: async (options: { state: string }) => {
              assert.equal(options.state, 'visible');
              assert.equal(hovered, true);
            },
            innerText: async () => tooltipText,
          };
        },
      };
    },
  };
  const run = runInNewContext(
    `${documentationCaptureDeclaration()}\nexerciseDocumentationExample;`,
    { document }
  );
  return {
    calls,
    run: () => run(page, preview, family, revision),
    radioSelector,
    triggerText,
    tooltipText,
  };
}

for (const revision of ['baseline', 'candidate'] as const) {
  test(`actual ${revision} documentation capture preserves native Toggle, Radio and Tooltip tasks`, async () => {
    for (const family of ['base', 'shadcn', 'brutalist'] as const) {
      const f = documentationCaptureFixture(revision, family);
      const interaction = await f.run();
      if (family === 'brutalist') {
        assert.deepEqual(f.calls, [f.triggerText, 'hover']);
        assert.equal(interaction.action, 'Pointer hover first trigger');
        assert.equal(interaction.tooltip, f.tooltipText);
        assert.equal(interaction.describedBy, 'actual-tooltip-content');
      } else {
        assert.deepEqual(f.calls, family === 'base' ? ['click'] : [f.radioSelector, 'click']);
        assert.equal(interaction.before, 'false');
        assert.equal(interaction.after, 'true');
      }
    }
  });
}

test('actual documentation capture rejects an interaction that fails to change its original native state', async () => {
  for (const revision of ['baseline', 'candidate'] as const)
    for (const family of ['base', 'shadcn', 'brutalist'] as const)
      await assert.rejects(documentationCaptureFixture(revision, family, false).run());
});
