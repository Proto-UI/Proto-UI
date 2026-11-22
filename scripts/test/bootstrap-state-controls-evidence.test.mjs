import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import ts from 'typescript';
import { BROWSER_SUITES, READY_ROUTES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

const fixturePath = 'apps/www/src/pages/en/test/bootstrap-state-controls.astro';
const browserPath = 'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts';
const fixture = readFileSync(fixturePath, 'utf8');
const browser = readFileSync(browserPath, 'utf8');
const navbarPath = 'apps/www/src/content/docs/zh-cn/bootstrap-navbar.browser.test.ts';
const navbar = readFileSync(navbarPath, 'utf8');
const workflow = parse(
  readFileSync('.github/workflows/bootstrap-state-controls-evidence.yml', 'utf8')
);

test('fixture uses all eight actual Bootstrap exports and only source-derived component paint', () => {
  const script = fixture.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const source = ts.createSourceFile(fixturePath + '.ts', script, ts.ScriptTarget.Latest, true);
  const imported = source.statements.find(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.text === '@proto.ui/prototypes-bootstrap-2-3-2'
  );
  assert.ok(imported);
  const names = imported.importClause.namedBindings.elements.map((element) => element.name.text);
  assert.deepEqual(names, [
    'checkboxRoot',
    'checkboxIndicator',
    'switchRoot',
    'switchThumb',
    'toggle',
    'inputRoot',
    'textareaRoot',
    'separatorRoot',
  ]);
  assert.match(fixture, /renderProtoStyleTokenCss\(tokens\)/);
  assert.match(fixture, /renderThemeCss/);
  assert.match(fixture, /DRAFT_FAMILY_STYLE_TOKENS/);
  assert.match(fixture, /renderDemo\(\{ runtime, demo, host \}\)/);
  assert.doesNotMatch(
    fixture,
    /surfaceStyle|surfaceClassName|prototypes-(?:shadcn|brutalist)|https?:\/\//
  );
  const prototypeCalls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'proto')
      prototypeCalls.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual([...new Set(prototypeCalls)].sort(), [...names].sort());
  const css = [...fixture.matchAll(/<style is:global>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join('\n');
  assert.doesNotMatch(
    css,
    /\[role|\[data-pui|\[data-demo-ref|\b(?:input|textarea|button|svg)\s*[{,.>:+~]/
  );
});

test('browser suite is Actions-only and exact-head guarded before starting any server', () => {
  assert.match(browser, /describe\.skipIf\(!enabled\)/);
  const beforeStart = browser.slice(0, browser.indexOf('baseUrl = await startServer'));
  assert.match(beforeStart, /GITHUB_ACTIONS !== 'true'/);
  assert.match(beforeStart, /sourceSha !== expectedSha/);
  assert.match(beforeStart, /PROTO_UI_BROWSER_BASE_URL/);
  assert.match(browser, /startup-failed/);
  assert.match(browser, /failure-\$\{results.length\}/);
  assert.match(browser, /afterEach/);
  assert.match(browser, /afterAll/);
  assert.match(browser, /state-recovery/);
  assert.match(browser, /editors-recovery/);
  assert.match(browser, /getAttribute\('aria-orientation'\)/);
  assert.match(browser, /bootstrapStateControlsFixture\.dispose\(\)/);
});

test('browser test and fixture script have no TypeScript syntax diagnostics', () => {
  for (const [fileName, source] of [
    [browserPath, browser],
    [navbarPath, navbar],
    [fixturePath + '.ts', fixture.match(/<script>([\s\S]*?)<\/script>/)?.[1]],
  ]) {
    const result = ts.transpileModule(source, {
      fileName,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true,
    });
    assert.deepEqual(
      result.diagnostics?.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      ),
      []
    );
  }
});

test('navbar evidence is independently guarded, scheduled and terminal after another suite fails', () => {
  const beforeStart = navbar.slice(0, navbar.indexOf("baseUrl = await startServer('/en/')"));
  assert.match(beforeStart, /GITHUB_ACTIONS !== 'true'/);
  assert.match(beforeStart, /sourceSha !== expectedSha/);
  assert.match(beforeStart, /PROTO_UI_BROWSER_BASE_URL/);
  assert.match(navbar, /describe\.skipIf\(!enabled\)/);
  assert.match(navbar, /expectedCases\.every/);
  assert.match(navbar, /\? 'pending' : 'blocked'/);
  assert.match(navbar, /expect\(complete,/);
  assert.equal(BROWSER_SUITES.filter((suite) => suite === navbarPath).length, 1);
  const phase = createRuntimeTestPlan([])[0];
  assert.equal(phase.args[phase.args.indexOf(navbarPath) - 1], '--exclude');
  const step = workflow.jobs['browser-evidence'].steps.find((step) => step.id === 'navbar');
  assert.equal(step.if, '${{ !cancelled() }}');
  assert.equal(step.env.PROTO_UI_BOOTSTRAP_NAVBAR_EVIDENCE, '1');
  assert.ok(step.run.includes(navbarPath));
  assert.ok(
    workflow.jobs['browser-evidence'].steps.some(
      (step) =>
        step.if === 'always()' && step.with?.path === '${{ runner.temp }}/bootstrap-navbar-evidence'
    )
  );
});

test('historical navbar capture keeps candidate instrumentation outside the pinned measured tree', () => {
  const script = readFileSync('scripts/analysis/bootstrap-navbar-baseline.mjs', 'utf8');
  const beforeImports = script
    .slice(0, script.indexOf('harness = await import('))
    .replace(/\s+/g, ' ');
  assert.match(beforeImports, /GITHUB_ACTIONS, 'true'/);
  assert.match(beforeImports, /measuredSha, BASELINE_SHA/);
  assert.match(beforeImports, /scriptSourceSha, process\.env\.PROTO_UI_EXPECTED_HEAD_SHA/);
  assert.match(beforeImports, /measuredRoot, scriptRoot/);
  assert.match(beforeImports, /status', '--porcelain'/);
  assert.match(
    script,
    /path\.join\(measuredRoot, 'apps\/www\/src\/content\/docs\/zh-cn\/browser-harness\.ts'\)/
  );
  assert.match(script, /scriptSha256/);
  assert.match(script, /status: 'captured'/);
  assert.doesNotMatch(script, /toBeLessThanOrEqual\(42\)|height.*=== 40|height.*== 40/);
  const step = workflow.jobs['browser-evidence'].steps.find((step) => step.id === 'baseline');
  assert.equal(step.env.PROTO_UI_BASELINE_SHA, 'dc3b184ba10b0de53e40359c52d012b204b2cd01');
  assert.match(step.run, /git worktree add --detach/);
  assert.match(step.run, /cd "\$PROTO_UI_BASELINE_WORKTREE"/);
  assert.match(
    step.run,
    /node --import tsx "\$GITHUB_WORKSPACE\/scripts\/analysis\/bootstrap-navbar-baseline\.mjs"/
  );
  assert.doesNotMatch(step.run, /\bcp\b|\bcopy\b|git (?:cherry-pick|apply)/);
});

test('registered browser suite stays out of the no-server phase', () => {
  assert.equal(BROWSER_SUITES.filter((suite) => suite === browserPath).length, 1);
  const phases = createRuntimeTestPlan([]);
  const excluded = phases[0].args.indexOf(browserPath);
  assert.ok(excluded > 0);
  assert.equal(phases[0].args[excluded - 1], '--exclude');
  assert.equal(
    READY_ROUTES.filter((route) => route === '/en/test/bootstrap-state-controls/').length,
    1
  );
  assert.match(
    readFileSync('scripts/test/run-runtime-tests.mjs', 'utf8'),
    /import \{[^}]*READY_ROUTES[^}]*\} from '\.\/runtime-test-plan\.mjs'/
  );
});

test('runner-dependent evidence paths are evaluated only in supported step env contexts', () => {
  // GitHub context availability: jobs.<job_id>.env does not admit runner;
  // jobs.<job_id>.steps.env does. YAML parsing alone cannot establish this.
  // https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability
  const job = workflow.jobs['browser-evidence'];
  assert.doesNotMatch(JSON.stringify(job.env), /\$\{\{\s*runner\./);
  const consumers = [
    'Bind evidence to the exact PR head before setup',
    'Collect real four-runtime evidence',
    'Preserve terminal status even when setup or browser launch fails',
  ];
  for (const name of consumers) {
    const step = job.steps.find((step) => step.name === name);
    assert.equal(
      step?.env?.PROTO_UI_BOOTSTRAP_EVIDENCE_DIR,
      '${{ runner.temp }}/bootstrap-state-controls-evidence',
      `${name} must resolve its own path even when an earlier step failed`
    );
  }
});

test('native-sequence oracle remains discriminating and runs with the browser evidence', () => {
  const helper = 'apps/www/src/content/docs/zh-cn/native-editor-evidence.ts';
  const tests = 'apps/www/src/content/docs/zh-cn/native-editor-evidence.test.ts';
  const execution = workflow.jobs['browser-evidence'].steps.find(
    (step) => step.env?.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE
  );
  assert.ok(execution.run.includes(tests));
  assert.match(browser, /await editor\.fill\('Changed'\)/);
  assert.match(browser, /requests\(runtime, ref, 'valueChange'\)\)\.length\)\.toBe\(1\)/);
  assert.match(browser, /await editor\.fill\('Changed\\nSecond line'\)/);
  assert.match(browser, /assertNativeValueChangeSequence\(native, emitted\)/);
  assert.match(browser, /await page\.locator\('h1'\)\.click\(\)/);
  assert.match(browser, /expect\(await nativeInputs\(\)\)\.toEqual\(recoveredNativeInputs\)/);
  assert.match(browser, /toEqual\(recoveredRequests\)/);
  assert.match(readFileSync(helper, 'utf8'), /assert\.deepEqual/);
});

test('disabled-paint oracle and its negative controls run in exact-head browser evidence', () => {
  const helper = 'apps/www/src/content/docs/zh-cn/bootstrap-disabled-paint.ts';
  const tests = 'apps/www/src/content/docs/zh-cn/bootstrap-disabled-paint.test.ts';
  const execution = workflow.jobs['browser-evidence'].steps.find(
    (step) => step.env?.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE
  );
  assert.ok(
    execution.run.includes(tests),
    'the exact-head job must execute no-paint negative controls'
  );
  assert.match(browser, /captureDisabledTogglePaint/);
  assert.match(browser, /isUnpaintedBootstrapBoxShadow/);
  assert.match(browser, /disabled-inactive-\$\{\+\+disabledCycle\}/);
  assert.match(browser, /'toggleControlled', 'disabled-active'/);
  assert.match(browser, /observations\.push\(\{ runtime, theme, ref, phase, disabledPaint \}\)/);
});
