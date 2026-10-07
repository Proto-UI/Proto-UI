import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import ts from 'typescript';
import { BROWSER_SUITES, createRuntimeTestPlan } from './runtime-test-plan.mjs';

const fixturePath = 'apps/www/src/pages/en/test/bootstrap-state-controls.astro';
const browserPath = 'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts';
const fixture = readFileSync(fixturePath, 'utf8');
const browser = readFileSync(browserPath, 'utf8');
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

test('workflow is bounded read-only PR-head evidence with persistent failure metadata', () => {
  assert.deepEqual(Object.keys(workflow.on), ['pull_request']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.ok(workflow.on.pull_request.paths.includes(fixturePath));
  assert.ok(workflow.on.pull_request.paths.includes(browserPath));
  const job = workflow.jobs['browser-evidence'];
  assert.equal(job['timeout-minutes'], 20);
  assert.equal(job.env.PROTO_UI_EXPECTED_HEAD_SHA, '${{ github.event.pull_request.head.sha }}');
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ github.event.pull_request.head.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const execution = job.steps.find((step) => step.env?.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE);
  assert.equal(execution.env.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE, '1');
  assert.match(execution.run, /--maxWorkers=1 --minWorkers=1/);
  const upload = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(upload.if, 'always()');
  assert.match(upload.with.name, /github.event.pull_request.head.sha/);
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.ok(
    job.steps.some((step) => step.if === 'always()' && step.run?.includes('workflowStatus'))
  );
  assert.doesNotMatch(
    JSON.stringify(workflow),
    /pull_request_target|workflow_dispatch|deploy|secrets\./i
  );
});

test('browser test and fixture script have no TypeScript syntax diagnostics', () => {
  for (const [fileName, source] of [
    [browserPath, browser],
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

test('registered browser suite stays out of the no-server phase', () => {
  assert.equal(BROWSER_SUITES.filter((suite) => suite === browserPath).length, 1);
  const phases = createRuntimeTestPlan([]);
  const excluded = phases[0].args.indexOf(browserPath);
  assert.ok(excluded > 0);
  assert.equal(phases[0].args[excluded - 1], '--exclude');
  assert.match(
    readFileSync('scripts/test/run-runtime-tests.mjs', 'utf8'),
    /'\/en\/test\/bootstrap-state-controls\/'/
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
  for (const file of [helper, tests]) assert.ok(workflow.on.pull_request.paths.includes(file));
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

test('opt-in browser evidence follows its shared renderer and execution dependencies', () => {
  const paths = workflow.on.pull_request.paths;
  for (const dependency of [
    'packages/adapters/base/**',
    'packages/adapters/web-component/**',
    'packages/adapters/react/**',
    'packages/adapters/vue/**',
    'packages/adapters/vue2/**',
    'packages/core/**',
    'packages/hooks/**',
    'packages/runtime/**',
    'packages/modules/**',
    'packages/prototypes/base/**',
    'packages/cli/src/services/prototype-style-tokens.ts',
    'apps/www/src/components/PrototypePreviewer/**',
    'apps/www/astro.config.mjs',
    'apps/www/package.json',
    'package.json',
    'pnpm-lock.yaml',
  ]) {
    assert.ok(paths.includes(dependency), `${dependency} must wake the opt-in fixture`);
  }
});
