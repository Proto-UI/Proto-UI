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

// Inspect syntax from the real browser source; whitespace, comments, and optional
// grouping do not define the observer contract. Identifier/literal values and
// the expression tree still do. These helpers never import the browser module.
function parseBrowser(input: string) {
  return ts.createSourceFile('probe.ts', input, ts.ScriptTarget.Latest, true);
}
function shape(node: ts.Node): unknown {
  if (ts.isParenthesizedExpression(node)) return shape(node.expression);
  const children: unknown[] = [];
  ts.forEachChild(node, (child) => {
    children.push(shape(child));
  });
  return [
    node.kind,
    ts.isIdentifier(node) || ts.isLiteralExpression(node) ? node.text : null,
    ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node) ? node.operator : null,
    children,
  ];
}
function expressionShape(input: string) {
  const statement = parseBrowser(input).statements[0];
  if (!statement || !ts.isExpressionStatement(statement)) throw new Error('Expected expression');
  return JSON.stringify(shape(statement.expression));
}
function matchingNodes(input: string, predicate: (node: ts.Node) => boolean) {
  const source = parseBrowser(input);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, nodes };
}
function expressions(input: string, expected: string) {
  const signature = expressionShape(expected);
  return matchingNodes(input, (node) => JSON.stringify(shape(node)) === signature);
}
function expectExpression(input: string, expected: string) {
  expect(expressions(input, expected).nodes.length, expected).toBeGreaterThan(0);
}
function replaceNodes(input: string, nodes: readonly ts.Node[], replacement: string) {
  for (const node of [...nodes].sort((a, b) => b.getStart() - a.getStart()))
    input = input.slice(0, node.getStart()) + replacement + input.slice(node.end);
  return input;
}
function expectFields(input: string, fields: Record<string, string>) {
  const matches = matchingNodes(
    input,
    (node) =>
      ts.isObjectLiteralExpression(node) &&
      Object.entries(fields).every(([name, value]) =>
        node.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === name &&
            JSON.stringify(shape(property.initializer)) === expressionShape(value)
        )
      )
  );
  expect(matches.nodes.length, JSON.stringify(fields)).toBeGreaterThan(0);
  return matches.nodes as ts.ObjectLiteralExpression[];
}
function removeField(input: string, object: ts.ObjectLiteralExpression, name: string) {
  const property = object.properties.find(
    (entry) =>
      ts.isPropertyAssignment(entry) && ts.isIdentifier(entry.name) && entry.name.text === name
  );
  if (!property) throw new Error('Missing negative-control field ' + name);
  const end = input[property.end] === ',' ? property.end + 1 : property.end;
  return input.slice(0, property.getStart()) + input.slice(end);
}
function reformatted(input: string) {
  return ts.createPrinter({ removeComments: false }).printFile(parseBrowser(input));
}

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
  const check = (input: string) => {
    const calls = matchingNodes(
      input,
      (node) =>
        ts.isCallExpression(node) &&
        JSON.stringify(shape(node.expression)) === expressionShape('page.addInitScript')
    );
    expect(calls.nodes).toHaveLength(1);
    const callback = (calls.nodes[0] as ts.CallExpression).arguments[0];
    expect(ts.isArrowFunction(callback)).toBe(true);
    const body = (callback as ts.ArrowFunction).body;
    expect(ts.isBlock(body)).toBe(true);
    const source = ts.transpileModule(
      (body as ts.Block).statements.map((node) => node.getText()).join('\n'),
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
      closest() {
        return null;
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
    const registrations: {
      name: string;
      callback: (event: unknown) => void;
      options: { passive?: boolean; capture?: boolean };
    }[] = [];
    const state: any = {
      window,
      addEventListener: (
        name: string,
        callback: (event: unknown) => void,
        options: { passive?: boolean; capture?: boolean }
      ) => registrations.push({ name, callback, options }),
      document: { elementFromPoint: () => inner },
      Element: ElementFixture,
      Node: ElementFixture,
      scrollY: 777,
      performance: { now: () => 40 },
    };
    vm.runInNewContext(source, state);
    const capture = registrations.filter(
      (entry) => entry.name === 'wheel' && entry.options.capture === true
    );
    const bubble = registrations.filter(
      (entry) => entry.name === 'wheel' && entry.options.capture !== true
    );
    expect(capture).toHaveLength(1);
    expect(bubble).toHaveLength(2); // trace plus the retained original wheel recorder
    expect(capture[0].options.passive).toBe(true);
    for (const listener of bubble) expect(listener.options.passive).toBe(true);
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
    capture[0].callback(event);
    state.scrollY = 557;
    for (const listener of bubble) listener.callback(event);
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
    capture[0].callback({ ...event, target: null, composedPath: () => [] });
    const missing = window.__codeScrollEventTrace[2];
    expect(missing.selectedContainsTarget).toBe(false);
    expect(missing.selectedInPath).toBe(false);
    expect(missing.eventId).toBeGreaterThan(first.eventId);
  };
  check(browser);
  check(reformatted(browser));
  const init = matchingNodes(
    browser,
    (node) =>
      ts.isCallExpression(node) &&
      JSON.stringify(shape(node.expression)) === expressionShape('page.addInitScript')
  ).nodes;
  expect(() => check(replaceNodes(browser, init, 'Promise.resolve()'))).toThrow();
  const target = expectFields(browser, {
    target: 'describe(event.target)',
    eventId: 'eventIds.get(event)',
  })[0];
  expect(() => check(removeField(browser, target, 'target'))).toThrow();
  const captureOptions = expectFields(browser, { passive: 'true', capture: 'true' })[0];
  expect(() => check(removeField(browser, captureOptions, 'capture'))).toThrow();
  const traceDeclaration = matchingNodes(
    browser,
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'trace' &&
      !!node.initializer &&
      ts.isArrowFunction(node.initializer)
  ).nodes;
  expect(traceDeclaration).toHaveLength(1);
  const trace = traceDeclaration[0] as ts.VariableDeclaration;
  expect(() => check(replaceNodes(browser, [trace.initializer!], '() => {}'))).toThrow();
});

// The observer is also reachable only through one unambiguous statement scope
// that binds the identity map and the recorder together. Drive that scope
// directly so a scope split or a duplicated observer is rejected.
it('locates the actual wheel observer through its unique binding scope', () => {
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

it('keeps the non-passive scheduling control separate from passive product acceptance', () => {
  const start = browser.indexOf("it('chains reverse wheel");
  const split = browser.indexOf("it('diagnoses wheel scheduling", start);
  const end = browser.indexOf('for (const width of [1440, 320])', split);
  expect(start).toBeGreaterThan(0);
  expect(split).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(split);
  const original = browser.slice(start, split),
    control = browser.slice(split, end);
  expect(original).not.toContain('passive: false');
  for (const body of [original, control])
    for (const token of [
      'i < 14',
      'page.mouse.wheel(0, -220)',
      'before.scrollY - 500',
      'wheel.preScrollTop === 0',
      'expect(hit.belongsToSelectedPre).toBe(true)',
      'requestedClientX: args.point.x',
      'requestedClientY: args.point.y',
      'selectedIsObservedPre:',
      'selectedPreIndex:',
    ])
      expect(body).toContain(token);
  const required = [
    "entry.kind = 'non-passive-scheduling-control'",
    'entry.acceptance = false',
    '{ passive: false }',
  ];
  const check = (source: string) => {
    for (const token of required) expect(source).toContain(token);
  };
  check(control);
  for (const token of required) expect(() => check(control.replaceAll(token, ''))).toThrow();
  const fields = {
    requestedDeltaX: '0',
    requestedDeltaY: '-220',
    requestedClientX: 'args.point.x',
    requestedClientY: 'args.point.y',
  };
  for (const body of [original, control]) {
    expectFields(body, fields);
    expectFields(reformatted(body), fields);
    const reversedDelta = matchingNodes(
      body,
      (node) =>
        ts.isPrefixUnaryExpression(node) &&
        node.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(node.operand) &&
        node.operand.text === '220'
    ).nodes;
    expect(reversedDelta.length).toBeGreaterThan(0);
    expect(() => expectFields(replaceNodes(body, reversedDelta, '+220'), fields)).toThrow();
    for (const name of Object.keys(fields)) {
      const object = expectFields(body, fields)[0];
      expect(() => expectFields(removeField(body, object, name), fields)).toThrow();
    }
  }
  const dispatch =
    'entry.controlDispatch.some((row: any) => row.trusted && row.deltaY === -220 && row.selectedInPath && row.targetInsideSelected && row.scrollY === before.scrollY && row.preScrollTop === 0 && row.defaultPrevented === false)';
  expectExpression(control, dispatch);
  expectExpression(reformatted(control), dispatch);
  const reversedObservedDelta = matchingNodes(
    control,
    (node) =>
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand) &&
      node.operand.text === '220'
  ).nodes;
  expect(() =>
    expectExpression(replaceNodes(control, reversedObservedDelta, '+220'), dispatch)
  ).toThrow();
  expect(() =>
    expectExpression(replaceNodes(control, expressions(control, dispatch).nodes, 'false'), dispatch)
  ).toThrow();
  const checkListener = (input: string) => {
    const listeners = matchingNodes(
      input,
      (node) =>
        ts.isCallExpression(node) &&
        JSON.stringify(shape(node.expression)) === expressionShape('element.addEventListener') &&
        node.arguments.length === 3 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === 'wheel'
    );
    expect(listeners.nodes).toHaveLength(1);
    const call = listeners.nodes[0] as ts.CallExpression;
    expect(ts.isArrowFunction(call.arguments[1])).toBe(true);
    expectFields('(' + call.arguments[2].getText() + ')', { passive: 'false' });
  };
  checkListener(control);
  checkListener(reformatted(control));
  const listeners = matchingNodes(
    control,
    (node) =>
      ts.isCallExpression(node) &&
      JSON.stringify(shape(node.expression)) === expressionShape('element.addEventListener')
  ).nodes;
  expect(() => checkListener(replaceNodes(control, listeners, 'void 0'))).toThrow();
  expect(control).not.toMatch(/\.(?:preventDefault|stopPropagation|stopImmediatePropagation)\s*\(/);
  expect(300 + 5 * 45 + 10).toBeLessThan(560);
});

it('replaces no product behavior while retaining the late-target mismatch as an explicit diagnostic', () => {
  const required = [
    'entry.lateTargetDiagnostic.failure = String(error)',
    'short-passive-observer-diagnostic.png',
    'await verifyPassiveCausality(page, pre, entry)',
  ];
  const check = (source: string) => {
    for (const token of required) expect(source).toContain(token);
  };
  const diagnosticFields = {
    kind: "'observer-diagnostic'",
    acceptance: 'false',
    expected: 'true',
    actual:
      'entry.wheels.some((wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0)',
  };
  const checkDiagnostic = (input: string) => {
    const assignments = matchingNodes(
      input,
      (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        JSON.stringify(shape(node.left)) === expressionShape('entry.lateTargetDiagnostic')
    );
    expect(assignments.nodes).toHaveLength(1);
    const assignment = assignments.nodes[0] as ts.BinaryExpression;
    expectFields('(' + assignment.right.getText() + ')', diagnosticFields);
    expectExpression(
      input,
      'expect(entry.wheels.some((wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0)).toBe(true)'
    );
  };
  checkDiagnostic(browser);
  checkDiagnostic(reformatted(browser));
  for (const name of Object.keys(diagnosticFields)) {
    const object = expectFields(browser, diagnosticFields)[0];
    expect(() => checkDiagnostic(removeField(browser, object, name))).toThrow();
  }
  const observedAssertion =
    'expect(entry.wheels.some((wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0)).toBe(true)';
  expect(() =>
    checkDiagnostic(replaceNodes(browser, expressions(browser, observedAssertion).nodes, 'void 0'))
  ).toThrow();
  check(browser);
  for (const token of required) expect(() => check(browser.replaceAll(token, ''))).toThrow();
});
it('requires contain negative control, restored product auto, exact input identity and independent zero-vs-positive movement', () => {
  const start = browser.indexOf('async function verifyPassiveCausality(');
  const end = browser.indexOf("it('chains reverse wheel", start);
  const helper = browser.slice(start, end);
  const required = [
    "['contain-negative', 'product-auto']",
    'else await restore()',
    'expect(original.samePre).toBe(true)',
    'expect(input.samePre && input.connected).toBe(true)',
    "if (i === 0 || stageName === 'contain-negative') expect(input.hitInsidePre).toBe(true)",
    "expect(input.computedY).toBe(stageName === 'contain-negative' ? 'contain' : 'auto')",
    'initial.scrollHeight).toBe(initial.clientHeight)',
    'expect(input.preScrollTop).toBe(0)',
    "if (stageName === 'contain-negative') expect(measured.scrollY).toBe(initial.scrollY)",
    "if (stageName === 'contain-negative') expect(final.scrollY).toBe(initial.scrollY)",
    '.toBeLessThan(initial.scrollY - 500)',
    'expect(stage.inputs).toHaveLength(14)',
    'stage.preDeliveryFinal = await observe',
    'stage.deliveryEndAt = await page.evaluate',
    '\${stageName}-post-delivery-final',
    'stage.final = final',
    'else expect(final.scrollY).toBeLessThan(initial.scrollY - 500)',
    'expect(stage.events.length).toBeGreaterThan(0)',
    'expect(event.trusted).toBe(true)',
    'expect(event.deltaX).toBe(0)',
    'expect(event.deltaY).toBeLessThan(0)',
    'expect(event.deltaMode).toBe(0)',
    'expect(event.clientX).toBe(Math.floor(firstInput.requestedClientX))',
    'expect(event.clientY).toBe(Math.floor(firstInput.requestedClientY))',
    'expect(event.eventTimeStamp).toBeGreaterThanOrEqual(firstInput.observedAt)',
    'expect(event.eventTimeStamp).toBeLessThanOrEqual(stage.inputEndAt)',
    'expect(event.observedAt).toBeLessThanOrEqual(stage.deliveryEndAt)',
    'sum + event.deltaY, 0)',
    '.toBe(-220 * 14)',
    'expect(event.defaultPreventedAtObservation).toBe(false)',
    'expect(event.selectedInPath && event.selectedContainsTarget).toBe(true)',
    'expect(event.scrollY).toBe(initial.scrollY)',
    'expect(initial[key]).toBe(negative[key])',
    'expect(entry.causality.restored).toEqual(original)',
    'if (primary) throw primary',
  ];
  const check = (source: string) => {
    for (const token of required) expect(source).toContain(token);
  };
  const contain =
    "(element as HTMLElement).style.setProperty('overscroll-behavior-y', 'contain', 'important')";
  expectExpression(helper, contain);
  expectExpression(reformatted(helper), contain);
  expect(() =>
    expectExpression(replaceNodes(helper, expressions(helper, contain).nodes, 'void 0'), contain)
  ).toThrow();
  check(helper);
  for (const token of required) expect(() => check(helper.replaceAll(token, ''))).toThrow();
  expect(helper.indexOf('entry.causality.acceptance = freshPolicy === undefined')).toBeGreaterThan(
    helper.indexOf('if (primary) throw primary')
  );
  const measuredLoop = helper.slice(
    helper.indexOf('for (let i = 0; i < 14; i++)'),
    helper.indexOf('stage.passed = true')
  );
  expect(measuredLoop).not.toMatch(
    /scrollIntoView|scrollTo\(|scrollBy\(|scrollTop\s*=|dispatchEvent|preventDefault|stopPropagation/
  );
  expect(browser.match(/}, 45_000\);/g)).toHaveLength(4); // three explicit cases and one two-width loop
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

it('reads actual computed Thumb Lab alpha without treating unknown or transparent paint as opaque', () => {
  const native = readFileSync(
    'apps/www/src/content/docs/zh-cn/scroll-area-corner.browser.test.ts',
    'utf8'
  );
  const rgb = readFileSync('apps/www/src/content/docs/zh-cn/scroll-area-corner-color.ts', 'utf8');
  const declaration = (input: string, name: string) => {
    const source = parseBrowser(input);
    const nodes = source.statements.filter(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
    );
    expect(nodes).toHaveLength(1);
    return nodes[0].getText(source).replace(/^export\s+/, '');
  };
  const actual = declaration(native, 'computedThumbFillAlpha');
  const load = (body: string) => {
    const js = ts.transpileModule(declaration(rgb, 'computedRgbAlpha') + '\n' + body, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = vm.createContext({});
    vm.runInContext(js + ';globalThis.parse = computedThumbFillAlpha;', context);
    return context.parse as (color: string) => number | null;
  };
  const check = (parse: (color: string) => number | null) => {
    // Exact 96ff / Chrome 156 native artifact's ordinary Thumb background.
    expect(parse('lab(90.952 0 -0.0000119209)')).toBe(1);
    expect(parse('lab(90.952 0 -0.0000119209 / 0)')).toBe(0);
    expect(parse('lab(90.952 0 -0.0000119209 / 0%)')).toBe(0);
    expect(parse('lab(90.952 0 -0.0000119209 / .25)')).toBe(0.25);
    expect(parse('lab(90.952 0 -0.0000119209 / 25%)')).toBe(0.25);
    expect(parse('lab(90.952% +0 -1.19209e-5 / 100%)')).toBe(1);
    expect(parse('rgba(1, 2, 3, 0)')).toBe(0);
    expect(parse('rgb(1 2 3 / 50%)')).toBe(0.5);
    expect(parse('transparent')).toBe(0);
    for (const value of [
      'oklch(0.8 0.1 20)',
      'currentColor',
      'lab(90.952 0)',
      'lab(90.952 0 0 1)',
      'lab(90.952, 0, 0)',
      'lab(none 0 0)',
      'lab(90.952 0 0 /)',
      'lab(90.952 0 0 / 1 / 1)',
      'lab(90.952 0 0 / -0.1)',
      'lab(90.952 0 0 / 101%)',
      'lab(90.952 0 0 / NaN)',
      'lab(1e999 0 0)',
    ])
      expect(parse(value), value).toBeNull();
  };
  check(load(actual));
  // Actual function mutations must be rejected, not just a parallel parser oracle.
  for (const [before, after] of [
    ['if (value === undefined) return 1;', 'if (value === undefined) return 0;'],
    ['? alpha : null', '? 1 : null'],
    ['if (!match) return null;', 'if (!match) return 1;'],
  ]) {
    expect(actual).toContain(before);
    expect(() => check(load(actual.replace(before, after)))).toThrow();
  }
});
