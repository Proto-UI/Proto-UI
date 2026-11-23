import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import ts from 'typescript';
import path from 'node:path';
import {
  BROWSER_SUITES,
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  READY_ROUTES,
  browserShards,
  createRuntimeTestPlan,
} from './runtime-test-plan.mjs';
import {
  BOOTSTRAP_BROWSER_CASES,
  BOOTSTRAP_EVIDENCE_SUITES,
  assertBootstrapEvidence,
} from './bootstrap-state-controls-receipt.mjs';

const fixturePath = 'apps/www/src/pages/en/test/bootstrap-state-controls.astro';
const browserPath = 'apps/www/src/content/docs/zh-cn/demo-bootstrap-state-controls.browser.test.ts';
const fixture = readFileSync(fixturePath, 'utf8');
const browser = readFileSync(browserPath, 'utf8');
const navbarPath = 'apps/www/src/content/docs/zh-cn/bootstrap-navbar.browser.test.ts';
const navbar = readFileSync(navbarPath, 'utf8');
const motionPath = 'apps/www/src/content/docs/zh-cn/bootstrap-button-motion.browser.test.ts';
const motion = readFileSync(motionPath, 'utf8');
const workflow = parse(
  readFileSync('.github/workflows/bootstrap-state-controls-evidence.yml', 'utf8')
);

function assertDedicatedOwner(suite) {
  assert.ok(!BROWSER_SUITES.includes(suite));
  assert.equal(PRODUCTION_BROWSER_SUITES.filter((entry) => entry === suite).length, 1);
  assert.equal(
    PRODUCTION_BROWSER_OWNERS[suite],
    '.github/workflows/bootstrap-state-controls-evidence.yml'
  );
  assert.ok(!createRuntimeTestPlan([])[1].args.includes(suite));
}

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
    [motionPath, motion],
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

test('isolated Bootstrap producer stays out of both generic phases and every shared shard', () => {
  assert.equal(BROWSER_SUITES.filter((suite) => suite === browserPath).length, 0);
  assert.equal(PRODUCTION_BROWSER_SUITES.filter((suite) => suite === browserPath).length, 1);
  assert.equal(
    PRODUCTION_BROWSER_OWNERS[browserPath],
    '.github/workflows/bootstrap-state-controls-evidence.yml'
  );
  const phases = createRuntimeTestPlan([]);
  const excluded = phases[0].args.indexOf(browserPath);
  assert.ok(excluded > 0);
  assert.equal(phases[0].args[excluded - 1], '--exclude');
  assert.ok(!phases[1].args.includes(browserPath));
  assert.ok(!browserShards().flat().includes(browserPath));
  assert.equal(
    READY_ROUTES.filter((route) => route === '/en/test/bootstrap-state-controls/').length,
    0
  );
  assert.match(
    readFileSync('scripts/test/run-runtime-tests.mjs', 'utf8'),
    /import \{[^}]*READY_ROUTES[^}]*\} from '\.\/runtime-test-plan\.mjs'/
  );
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
  assertDedicatedOwner(navbarPath);
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

test('Button motion uses actual native trajectories in an independently guarded sequential lane', () => {
  const beforeStart = motion.slice(0, motion.indexOf('baseUrl = await startServer(ROUTE)'));
  assert.match(beforeStart, /GITHUB_ACTIONS !== 'true'/);
  assert.match(beforeStart, /sourceSha !== expectedSha/);
  assert.match(beforeStart, /PROTO_UI_BROWSER_BASE_URL/);
  assert.match(motion, /describe\.skipIf\(!enabled\)/);
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /getAnimations\(\)/);
  assert.match(motion, /transitioncancel/);
  assert.match(motion, /bootstrapReduceMotion/);
  assert.match(motion, /assertBootstrapButtonEntryMotion/);
  assert.match(motion, /assertBootstrapButtonImmediateExit/);
  assert.match(motion, /seenCells\.has\(name\)/);
  assert.match(motion, /!expectedCases\.includes\(name\)/);
  assert.match(motion, /cleanupErrors\.length === 0/);
  const final = motion.slice(motion.indexOf('afterAll(async'));
  assert.ok(final.indexOf("attemptCleanup('source server'") < final.indexOf('await manifest('));
  assert.doesNotMatch(motion, /dispatchEvent|addStyleTag|clock\.install|clock\.pauseAt/);
  assertDedicatedOwner(motionPath);
  const phase = createRuntimeTestPlan([])[0];
  assert.equal(phase.args[phase.args.indexOf(motionPath) - 1], '--exclude');
  const step = workflow.jobs['browser-evidence'].steps.find((step) => step.id === 'button-motion');
  assert.equal(step.if, '${{ !cancelled() }}');
  assert.equal(step.env.PROTO_UI_BOOTSTRAP_BUTTON_MOTION_EVIDENCE, '1');
  assert.ok(step.run.includes(motionPath));
  assert.ok(step.run.includes('bootstrap-button-motion-evidence.test.ts'));
  assert.ok(
    workflow.jobs['browser-evidence'].steps.some(
      (step) =>
        step.if === 'always()' &&
        step.with?.path === '${{ runner.temp }}/bootstrap-button-motion-evidence'
    )
  );
});

test('registered browser suite stays with its dedicated owner, outside both generic phases', () => {
  assertDedicatedOwner(browserPath);
  const phases = createRuntimeTestPlan([]);
  const excluded = phases[0].args.indexOf(browserPath);
  assert.ok(excluded > 0);
  assert.equal(phases[0].args[excluded - 1], '--exclude');
  assert.ok(!phases[1].args.includes(browserPath));
  assert.ok(!browserShards().flat().includes(browserPath));
  assert.equal(
    READY_ROUTES.filter((route) => route === '/en/test/bootstrap-state-controls/').length,
    0
  );
  assert.match(
    readFileSync('scripts/test/run-runtime-tests.mjs', 'utf8'),
    /import \{[^}]*READY_ROUTES[^}]*\} from '\.\/runtime-test-plan\.mjs'/
  );
});

test('the full CI cycle requires the same-commit independent Bootstrap producer and receipt', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const cycle = parse(readFileSync('.github/workflows/ci-production-suites.yml', 'utf8'));
  assert.equal(ci.jobs['production-suites'].uses, './.github/workflows/ci-production-suites.yml');
  assert.equal(ci.jobs['production-suites'].if, "${{ github.event_name != 'pull_request' }}");
  assert.ok(ci.jobs['cycle-report'].needs.includes('production-suites'));
  const calls = Object.values(cycle.jobs).filter(
    (job) => job.uses === './.github/workflows/bootstrap-state-controls-evidence.yml'
  );
  assert.equal(
    calls.length,
    1,
    'Exactly one required Bootstrap producer must enter each full cycle'
  );
  assert.ok(cycle.jobs[calls[0].needs], 'Reuse one existing bounded evidence chain');
  assert.equal(calls[0].if, '${{ !cancelled() }}');
  assert.equal(calls[0]['continue-on-error'], undefined);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const job = workflow.jobs['browser-evidence'];
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, job.env.PROTO_UI_EXPECTED_HEAD_SHA);
  assert.equal(checkout.with.ref, '${{ github.event.pull_request.head.sha || github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const execution = job.steps.find((step) => step.env?.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE);
  assert.equal(execution.env.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE, '1');
  for (const suite of BOOTSTRAP_EVIDENCE_SUITES) assert.ok(execution.run.includes(suite));
  assert.match(execution.run, /--reporter=json/);
  assert.match(execution.run, /--outputFile="\$PROTO_UI_BOOTSTRAP_EVIDENCE_DIR\/vitest\.json"/);
  const gateIndex = job.steps.findIndex((step) =>
    step.run?.includes('node scripts/test/bootstrap-state-controls-receipt.mjs')
  );
  assert.ok(gateIndex > job.steps.indexOf(execution));
  assert.equal(job.steps[gateIndex].if, 'always()');
  assert.equal(job.steps[gateIndex]['continue-on-error'], undefined);
  assert.equal(
    job.steps[gateIndex].env.PROTO_UI_BOOTSTRAP_EVIDENCE_DIR,
    '${{ runner.temp }}/bootstrap-state-controls-evidence'
  );
  const uploadIndex = job.steps.findIndex(
    (step) =>
      step.uses?.startsWith('actions/upload-artifact@') &&
      step.with?.path === job.steps[gateIndex].env.PROTO_UI_BOOTSTRAP_EVIDENCE_DIR
  );
  assert.ok(uploadIndex > gateIndex);
  assert.equal(job.steps[uploadIndex].if, 'always()');
  for (const environment of [job.env, ...job.steps.map((step) => step.env ?? {})]) {
    assert.ok(
      !Object.hasOwn(environment, 'GITHUB_ACTIONS'),
      'Do not manufacture the Actions owner'
    );
    assert.ok(
      !Object.hasOwn(environment, 'PROTO_UI_BROWSER_BASE_URL'),
      'Keep the fresh server owner'
    );
  }
});

// These are deliberately synthetic receipts testing the gate, not browser evidence.
const expectedReceipt = {
  root: process.cwd(),
  sha: 'a'.repeat(40),
  runId: '123',
  runAttempt: '2',
};
function receiptControl() {
  const testResults = BOOTSTRAP_EVIDENCE_SUITES.map((suite) => ({
    name: path.join(expectedReceipt.root, suite),
    status: 'passed',
    assertionResults: (suite === browserPath ? BOOTSTRAP_BROWSER_CASES : ['unit control']).map(
      (title) => ({ title, fullName: `Synthetic receipt control ${title}`, status: 'passed' })
    ),
  }));
  const count = testResults.reduce((total, result) => total + result.assertionResults.length, 0);
  return {
    manifest: {
      sourceSha: expectedReceipt.sha,
      expectedSha: expectedReceipt.sha,
      runId: expectedReceipt.runId,
      runAttempt: expectedReceipt.runAttempt,
      status: 'passed',
      workflowStatus: 'success',
      route: '/en/test/bootstrap-state-controls/',
      runtimes: ['wc', 'react', 'vue', 'vue2'],
      themes: ['light', 'dark'],
      pageErrors: [],
      results: BOOTSTRAP_BROWSER_CASES.map((name) => ({ name, status: 'pass', errors: [] })),
    },
    report: {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numPassedTests: count,
      numTotalTests: count,
      testResults,
    },
  };
}

test('receipt gate admits exactly fifteen original journeys plus all supporting suites', () => {
  assert.equal(BOOTSTRAP_BROWSER_CASES.length, 15);
  assert.deepEqual(assertBootstrapEvidence(receiptControl(), expectedReceipt), {
    browserCases: 15,
    selectedSuites: 4,
  });
});
for (const [name, mutate] of [
  [
    'missing source receipt',
    (data) => {
      delete data.manifest.sourceSha;
    },
  ],
  [
    'stale source',
    (data) => {
      data.manifest.sourceSha = 'b'.repeat(40);
    },
  ],
  [
    'wrong expected source',
    (data) => {
      data.manifest.expectedSha = 'b'.repeat(40);
    },
  ],
  [
    'other run',
    (data) => {
      data.manifest.runId = '124';
    },
  ],
  [
    'other attempt',
    (data) => {
      data.manifest.runAttempt = '1';
    },
  ],
  [
    'pending manifest',
    (data) => {
      data.manifest.status = 'setup-pending';
    },
  ],
  [
    'failed cleanup',
    (data) => {
      data.manifest.workflowStatus = 'failure';
    },
  ],
  [
    'startup failure',
    (data) => {
      data.manifest.startupError = 'launch failed';
    },
  ],
  [
    'zero browser results',
    (data) => {
      data.manifest.results = [];
    },
  ],
  [
    'partial browser results',
    (data) => {
      data.manifest.results.pop();
    },
  ],
  [
    'duplicate browser results',
    (data) => {
      data.manifest.results[14] = data.manifest.results[0];
    },
  ],
  [
    'skipped manifest result',
    (data) => {
      data.manifest.results[0].status = 'skip';
    },
  ],
  [
    'browser errors',
    (data) => {
      data.manifest.pageErrors.push('uncaught');
    },
  ],
  [
    'missing browser suite',
    (data) => {
      data.report.testResults.pop();
    },
  ],
  [
    'missing supporting suite',
    (data) => {
      data.report.testResults.shift();
    },
  ],
  [
    'skipped browser assertion',
    (data) => {
      data.report.testResults[3].assertionResults[0].status = 'skipped';
    },
  ],
  [
    'todo supporting assertion',
    (data) => {
      data.report.testResults[0].assertionResults[0].status = 'todo';
    },
  ],
  [
    'partial Vitest browser results',
    (data) => {
      data.report.testResults[3].assertionResults.pop();
    },
  ],
  [
    'duplicate Vitest browser results',
    (data) => {
      data.report.testResults[3].assertionResults[14] =
        data.report.testResults[3].assertionResults[0];
    },
  ],
  [
    'false total count',
    (data) => {
      data.report.numTotalTests += 1;
    },
  ],
]) {
  test(`receipt gate rejects ${name}`, () => {
    const data = receiptControl();
    mutate(data);
    assert.throws(() => assertBootstrapEvidence(data, expectedReceipt));
  });
}

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
