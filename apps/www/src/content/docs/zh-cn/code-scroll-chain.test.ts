// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import vm from 'node:vm';
import ts from 'typescript';
const css = readFileSync('apps/www/src/styles/code-surfaces.css', 'utf8');
const browser = readFileSync(
  'apps/www/src/content/docs/zh-cn/code-scroll-chain.browser.test.ts',
  'utf8'
);
it('allows vertical document chaining without changing native code overflow or horizontal containment', () => {
  const block = css.match(/\.proto-previewer__code\s*\{([^}]+)\}/)![1];
  for (const token of [
    'overscroll-behavior-x: contain;',
    'overscroll-behavior-y: auto;',
    'overflow: auto;',
    'white-space: pre;',
    'max-height: 4.5rem;',
  ])
    expect(block).toContain(token);
  expect(block).not.toMatch(/overscroll-behavior\s*:/);
});
it('keeps the original reverse input and independently asserts internal, boundary and horizontal native scrolling', () => {
  const tokens = [
    'scrollTo(0, 2860)',
    'elementFromPoint(700, 550)',
    'page.mouse.move(700, 550)',
    'i < 14',
    'page.mouse.wheel(0, -220)',
    'before.scrollY - 500',
    'before.scrollHeight).toBe(before.clientHeight)',
    'before.scrollHeight - before.clientHeight).toBeGreaterThan(internalDelta)',
    'const internalDelta = 80',
    'inside.scrollTop).toBeLessThan(inside.scrollHeight - inside.clientHeight)',
    "entry.outcome = 'not-reproduced'",
    "if (entry.outcome !== 'not-reproduced') entry.passed = true",
    'entry.acceptance = false',
    'expect(hit.belongsToSelectedPre).toBe(true)',
    'item.documentTop > 1000',
    'expect(before.scrollY).toBeGreaterThan(500)',
    'inside.scrollY).toBe(before.scrollY)',
    'boundary.scrollHeight - boundary.clientHeight',
    'toBeGreaterThan(boundary.scrollY)',
    'page.mouse.wheel(80, 0)',
    'after.scrollX).toBe(horizontal.scrollX)',
    'entry.failure = String(error)',
    'throw error',
    'primaryFailure = error',
    'if (primaryFailure === undefined) throw new Error',
    'entry.evidenceErrors = evidenceErrors',
    "sha256: createHash('sha256').update(image).digest('hex')",
    'await save()',
    'page.screenshot',
  ];
  const check = (s: string) => {
    for (const token of tokens) expect(s).toContain(token);
  };
  check(browser);
  for (const token of tokens) expect(() => check(browser.replaceAll(token, ''))).toThrow();
  const plan = readFileSync('scripts/test/runtime-test-plan.mjs', 'utf8');
  expect(
    plan.match(/'apps\/www\/src\/content\/docs\/zh-cn\/code-scroll-chain.browser.test.ts'/g)
  ).toHaveLength(1);
});

it('keeps exact-head, read-only and bounded independent evidence preparation', () => {
  const workflow = readFileSync('.github/workflows/code-scroll-chain-evidence.yml', 'utf8');
  for (const token of [
    'persist-credentials: false',
    'contents: read',
    'github.event.pull_request.head.sha || github.sha',
    'timeout --signal=TERM --kill-after=10s 560s',
    'if: always()',
    'set -euo pipefail',
    'prepare-homepage-composition-fonts.sh',
  ])
    expect(workflow).toContain(token);
  expect(browser).toContain('trusted: event.isTrusted');
});

it('retains dispatch-time identity snapshots without replacing the original wheel oracle', () => {
  const required = [
    'const eventIds = new WeakMap<Event, number>()',
    'eventId: eventIds.get(event)',
    'eventTimeStamp: event.timeStamp',
    'observedAt: performance.now()',
    "trace(event, 'capture')",
    "trace(event, 'bubble')",
    'event.composedPath()',
    'selectedInPath:',
    'selectedContainsTarget:',
    'selectedConnected:',
    'selectedScrollTop:',
    'entry.inputReadings.push',
    'document.elementFromPoint(args.point.x, args.point.y)',
    'wheel.preScrollTop === 0',
    'entry.eventTrace = await page.evaluate',
  ];
  const check = (source: string) => {
    for (const token of required) expect(source).toContain(token);
  };
  check(browser);
  for (const token of required) expect(() => check(browser.replaceAll(token, ''))).toThrow();
});
it('keeps retargeted and missing targets distinct from the selected PRE in the actual observer', () => {
  const syntax = ts.createSourceFile('probe.ts', browser, ts.ScriptTarget.Latest, true);
  const binds = (statement: ts.Statement, name: string) =>
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
      )) ||
    (ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  let statements: readonly ts.Statement[] | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isBlock(node)) {
      const start = node.statements.findIndex((statement) => binds(statement, 'eventIds'));
      const end = node.statements.findIndex((statement) => binds(statement, 'trace'));
      if (start >= 0 && end >= start) {
        if (statements) throw new Error('Ambiguous actual wheel observer scope');
        statements = node.statements.slice(start, end + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  if (!statements) throw new Error('Missing actual wheel observer scope');
  const source = ts.transpileModule(
    statements.map((statement) => statement.getText(syntax)).join('\n') +
      '\n globalThis.recordWheel = trace;',
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }
  ).outputText;
  class ElementFixture {
    tagName: string;
    isConnected = true;
    scrollTop = 0;
    children: ElementFixture[] = [];
    constructor(tag: string) {
      this.tagName = tag;
    }
    getAttribute() {
      return 'fixture';
    }
    getBoundingClientRect() {
      return { toJSON: () => ({ top: 12 }) };
    }
    contains(node: unknown) {
      return node === this || this.children.includes(node as ElementFixture);
    }
  }
  const selected = new ElementFixture('PRE');
  const inner = new ElementFixture('SPAN');
  selected.children.push(inner);
  const retarget = new ElementFixture('WC-TEXT-ROOT');
  const window = {
    __selectedScrollPre: selected,
    __codeScrollEventTrace: [] as any[],
    __scrollInputSequence: 0,
  };
  const state: any = {
    window,
    document: { elementFromPoint: () => inner },
    Element: ElementFixture,
    Node: ElementFixture,
    scrollY: 777,
    performance: { now: () => 40 },
  };
  vm.runInNewContext(source, state);
  const nativePath = [inner, selected, window];
  const event = {
    target: retarget,
    composedPath: () => nativePath,
    timeStamp: 30,
    isTrusted: false,
    clientX: 4,
    clientY: 5,
    deltaX: 0,
    deltaY: -220,
    defaultPrevented: false,
  };
  state.recordWheel(event, 'capture');
  state.scrollY = 557;
  state.recordWheel(event, 'bubble');
  const first = window.__codeScrollEventTrace[0];
  const second = window.__codeScrollEventTrace[1];
  expect(first.target.tag).toBe('WC-TEXT-ROOT');
  expect(first.selectedContainsTarget).toBe(false);
  expect(first.selectedInPath).toBe(true);
  expect(first.trusted).toBe(false);
  expect(first.scrollY).toBe(777);
  expect(second.scrollY).toBe(557);
  expect(first.eventId).toBe(second.eventId);
  expect(first.eventTimeStamp).toBe(second.eventTimeStamp);
  nativePath.length = 0;
  expect(first.composedPath).toHaveLength(3);
  state.recordWheel({ ...event, target: null, composedPath: () => [] }, 'capture');
  const missing = window.__codeScrollEventTrace[2];
  expect(missing.selectedContainsTarget).toBe(false);
  expect(missing.selectedInPath).toBe(false);
  expect(missing.eventId).toBeGreaterThan(first.eventId);
});

it('correlates actual stage capture logic without assuming one DOM event per wheel command', () => {
  const source = ts.createSourceFile('probe.ts', browser, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'captureStageWheelEvents'
  );
  expect(declaration).toBeDefined();
  const js = ts.transpileModule(declaration!.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({});
  vm.runInContext(js + ';globalThis.collect = captureStageWheelEvents;', context);
  const collect = context.collect as (trace: any[], start: number, end: number) => any[];
  for (const [count, deltaY] of [
    [14, -220],
    [7, -440],
  ]) {
    const trace = Array.from({ length: count }, (_, i) => ({
      phase: 'capture',
      eventTimeStamp: 110 + i,
      deltaY,
    }));
    trace.push({ phase: 'bubble', eventTimeStamp: 110, deltaY: -220 });
    trace.push({ phase: 'capture', eventTimeStamp: 99, deltaY: -220 });
    trace.push({ phase: 'capture', eventTimeStamp: 201, deltaY: -220 });
    const rows = collect(trace, 100, 200);
    expect(rows).toHaveLength(count);
    expect(rows.reduce((sum, row) => sum + row.deltaY, 0)).toBe(-3080);
    expect(collect(trace.slice(1), 100, 200).reduce((sum, row) => sum + row.deltaY, 0)).not.toBe(
      -3080
    );
  }
  expect(collect([{ phase: 'bubble', eventTimeStamp: 150, deltaY: -3080 }], 100, 200)).toHaveLength(
    0
  );
});

it('isolates every causal policy boundary with observed quiet, preserving final restoration on timeout', () => {
  const required = [
    'receipt.browserVersion = browser.version()',
    'requiredQuietMs: 750',
    "await waitForWheelQuiet(page, entry, 'before-' + stageName)",
    "await waitForWheelQuiet(page, entry, 'before-final-restore')",
    'lastCaptureObservedAt: last?.observedAt',
    'lastNativeTimeStamp: last?.eventTimeStamp',
    'captureCount: captures.length',
    'record.samples.push(sample)',
    'expect(stable[key]).toBe(initial[key])',
  ];
  const check = (input: string) => {
    for (const token of required) expect(input).toContain(token);
  };
  check(browser);
  for (const token of required) expect(() => check(browser.replaceAll(token, ''))).toThrow();
  const source = ts.createSourceFile('probe.ts', browser, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'wheelQuietElapsed'
  );
  expect(declaration).toBeDefined();
  const js = ts.transpileModule(declaration!.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({});
  vm.runInContext(js + ';globalThis.elapsed = wheelQuietElapsed;', context);
  const elapsed = context.elapsed as (sample: any, start: number) => number;
  expect(
    elapsed({ observedAt: 850, lastCaptureObservedAt: 50, lastNativeTimeStamp: 40 }, 100)
  ).toBe(750);
  expect(
    elapsed({ observedAt: 850, lastCaptureObservedAt: 840, lastNativeTimeStamp: 830 }, 100)
  ).toBe(10);
  for (let t = 100; t <= 2000; t += 50)
    expect(
      elapsed({ observedAt: t + 20, lastCaptureObservedAt: t, lastNativeTimeStamp: t - 2 }, 100)
    ).toBeLessThan(750);
  expect(
    elapsed({ observedAt: 850, lastCaptureObservedAt: null, lastNativeTimeStamp: null }, 100)
  ).toBe(750);
});

it('bounds the fresh static pair separately while preserving the original causal call', () => {
  const source = ts.createSourceFile('probe.ts', browser, ts.ScriptTarget.Latest, true);
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'verifyPassiveCausality')
      calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(calls).toHaveLength(2);
  expect(calls[0].arguments.map((arg) => arg.getText(source))).toEqual(['page', 'pre', 'entry']);
  expect(calls[1].arguments).toHaveLength(4);
  expect(calls[1].arguments.slice(0, 3).map((arg) => arg.getText(source))).toEqual([
    'page',
    'pre',
    'entry',
  ]);
  expect(ts.isObjectLiteralExpression(calls[1].arguments[3])).toBe(true);
  const option = calls[1].arguments[3] as ts.ObjectLiteralExpression;
  expect(option.properties.map((property) => property.getText(source))).toEqual([
    'name: policy',
    'expectedInitial: pair.initial',
  ]);
  const required = [
    "(freshPolicy ? [freshPolicy.name] : ['contain-negative', 'product-auto']).entries()",
    'entry.causality.acceptance = freshPolicy === undefined',
    "for (const policy of ['contain-negative', 'product-auto'] as const)",
    "await run('short-code-fresh-' + policy, 1440",
    'productAcceptance: false',
    'fullIssueAcceptance: false',
    'entry.acceptance = false',
    'expect(priorWheels).toHaveLength(0)',
    "textSha256: createHash('sha256').update((await pre.textContent()) ?? '').digest('hex')",
    'documentTop: selected!.documentTop',
    'expect(entry.pairInitial).toEqual(freshPolicy.expectedInitial)',
    'expect(entry.causality.stages).toHaveLength(1)',
    'entry.asyncTargetObservation = { acceptance: false',
    "entry.outcome = 'diagnostic-incomplete'",
    "entry.outcome = 'diagnostic-observed'",
    'pair.productAcceptance = true',
    '}, 24_000);',
  ];
  const compact = (input: string) => input.replace(/\s+/g, '');
  const check = (input: string) => {
    for (const token of required) expect(compact(input)).toContain(compact(token));
  };
  check(browser);
  for (const token of required)
    expect(() => check(compact(browser).replaceAll(compact(token), ''))).toThrow();
  const pair = browser.slice(browser.indexOf("it('compares fresh static auto"));
  expect(pair).not.toMatch(
    /fullIssueAcceptance = true|entry(?:\.causality)?\.acceptance = true|preventDefault\(|stopPropagation\(/
  );
  expect(pair.indexOf('pair.productAcceptance = true')).toBeGreaterThan(
    pair.indexOf("expect(entry.meetsProductDisplacement).toBe(policy === 'product-auto')")
  );
  expect(browser).toContain('const context = await browser.newContext(');
  expect(browser).toContain('await context.close()');
  expect(300 + 5 * 45 + 24 + 10).toBeLessThanOrEqual(560); // nominal budget, not execution guarantee
});
