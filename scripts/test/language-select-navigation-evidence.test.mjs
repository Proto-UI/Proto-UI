import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import ts from 'typescript';
import YAML from 'yaml';
import {
  BROWSER_SUITES,
  PRODUCTION_BROWSER_SUITES,
  PRODUCTION_BROWSER_OWNERS,
  assertBrowserInventory,
  createRuntimeTestPlan,
} from './runtime-test-plan.mjs';

const suitePath = 'apps/www/src/content/docs/zh-cn/language-select-navigation.browser.test.ts';
const workflowPath = '.github/workflows/language-select-navigation-evidence.yml';
const contractPath = 'scripts/test/language-select-navigation-evidence.test.mjs';
const componentPath = 'apps/www/src/components/override/LanguageSelect.astro';
const suite = readFileSync(suitePath, 'utf8');
const workflow = YAML.parse(readFileSync(workflowPath, 'utf8'));
const expectedHead = '${{ github.event.pull_request.head.sha || github.sha }}';
const compact = (text) => text.replace(/\s+/g, ' ').trim();

function sourceTokens(source) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source
  );
  const tokens = [];
  const templateDepths = [];
  let depth = 0;
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind === ts.SyntaxKind.OpenBraceToken) depth++;
    if (kind === ts.SyntaxKind.CloseBraceToken) {
      if (templateDepths.at(-1) === depth) {
        kind = scanner.reScanTemplateToken(false);
        if (kind === ts.SyntaxKind.TemplateTail) templateDepths.pop();
      } else depth--;
    }
    if (kind === ts.SyntaxKind.TemplateHead) templateDepths.push(depth);
    tokens.push({
      text: scanner.getTokenText(),
      start: scanner.getTokenPos(),
      end: scanner.getTextPos(),
    });
  }
  // Formatting may parenthesize an untyped single arrow argument. Treat that
  // spelling as equivalent while retaining original offsets for mutations.
  for (let index = tokens.length - 4; index >= 0; index--)
    if (
      tokens[index].text === '(' &&
      /^[A-Za-z_$][\w$]*$/.test(tokens[index + 1].text) &&
      tokens[index + 2].text === ')' &&
      tokens[index + 3].text === '=>'
    ) {
      tokens.splice(index + 2, 1);
      tokens.splice(index, 1);
    }
  // Only normalize a parser-confirmed array literal's optional final comma.
  // Separators and array elisions are significant: [value,,] must not become
  // [value]. Original token offsets remain intact for exact-source mutations.
  const ast = ts.createSourceFile('contract-fragment.ts', source, ts.ScriptTarget.Latest, true);
  const optionalCommas = new Set();
  const visit = (node) => {
    if (ts.isArrayLiteralExpression(node) && node.elements.hasTrailingComma) {
      const last = node.elements.at(-1);
      if (last && !ts.isOmittedExpression(last)) {
        const closing = tokens.findLastIndex(
          (token) => token.text === ']' && token.end === node.end
        );
        const comma = tokens[closing - 1];
        if (comma?.text === ',' && comma.start >= last.end) optionalCommas.add(comma.start);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (let index = tokens.length - 1; index >= 0; index--)
    if (optionalCommas.has(tokens[index].start)) tokens.splice(index, 1);
  return tokens;
}

function fragmentLocation(source, required) {
  const actual = sourceTokens(source),
    wanted = sourceTokens(required);
  assert.ok(wanted.length);
  const index = actual.findIndex((_, offset) =>
    wanted.every((token, position) => actual[offset + position]?.text === token.text)
  );
  return index < 0
    ? null
    : { start: actual[index].start, end: actual[index + wanted.length - 1].end };
}

function includes(source, required) {
  assert.ok(fragmentLocation(source, required), `Missing contract: ${required}`);
}

function mutateSource(source, before, after) {
  const location = fragmentLocation(source, before);
  assert.ok(location, `Missing mutation target: ${before}`);
  return source.slice(0, location.start) + after + source.slice(location.end);
}

function functionSource(source, name) {
  const ast = ts.createSourceFile(suitePath, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  assert.ok(declaration?.body, `Missing production probe function ${name}`);
  return declaration.getText(ast);
}

function assertNativeSource(source) {
  const ast = ts.createSourceFile(suitePath, source, ts.ScriptTarget.Latest, true);
  for (const [name, expected] of [
    ['FAMILIES', ['shadcn', 'brutalist']],
    ['CONTROLS', ['header', 'sidebar']],
  ]) {
    const declaration = ast.statements
      .filter(ts.isVariableStatement)
      .flatMap((node) => [...node.declarationList.declarations])
      .find((node) => node.name.getText(ast) === name);
    let initializer = declaration?.initializer;
    while (initializer && ts.isAsExpression(initializer)) initializer = initializer.expression;
    assert.ok(
      initializer && ts.isArrayLiteralExpression(initializer),
      `${name} must stay explicit`
    );
    assert.deepEqual(
      initializer.elements.map((element) => element.text),
      expected
    );
  }
  // These are source-contract checks, not a replacement for real browser evidence.
  for (const required of [
    'chromiumSandbox: true',
    "serviceWorkers: 'block'",
    "context.route('**/*',",
    'if (url.origin === base.origin) return route.continue();',
    "route.abort('blockedbyclient')",
    "if (!required) throw new Error('Built production PROTO_UI_BROWSER_BASE_URL is required')",
    "base.hostname !== '127.0.0.1' || base.protocol !== 'http:'",
    "if (process.env.PROTO_UI_EXPECTED_HEAD !== revision) throw new Error('Exact source revision mismatch')",
    "if (dirty) throw new Error('Dirty source tree is not exact-head evidence')",
    "await page.locator('[data-language-select-root]').count()).toBe(2)",
    'page.locator(\'[data-language-select-root][data-language-select-initialized="true"]\').count()).toBe(2)',
    "[['zh-cn', 'pointer'], ['en', 'keyboard']]",
    "writes.filter(row => row.kind === 'storage').map(row => row.value)).toEqual([locale])",
    "writes.filter(row => row.kind === 'cookie')).toHaveLength(1)",
    "writes.find(row => row.kind === 'cookie')!.value).toContain('SameSite=Lax')",
    'expect(new URL(page.url()).pathname).toBe(expectedPath)',
    "localStorage.getItem('preferred-locale'))).toBe(locale)",
    'expect(cookie[0].value).toBe(locale)',
    "expect(cookie[0].path).toBe('/')",
    "expect(cookie[0].sameSite).toBe('Lax')",
    '.toEqual([locale, locale])',
    'const before = await readWrites(page)',
    'const writes = (await readWrites(page)).slice(before.length)',
    'const expectedPath = `/${locale}/ui-libraries/${suffix}`',
    'await chooseLocale(page, control, locale, input, expectedPath)',
    'expect(navigations.slice(navigationCount)).toEqual([`${base.origin}${expectedPath}`])',
    'await repeatPageLoad(page)',
    'await installWriteProbe(context)',
    'primaryFailure = error',
    'finally {',
    'await saveEvidence(page, report, `${family}-${control}`)',
    'report.evidenceErrors = evidenceErrors',
    'report.acceptance = report.passed === true && evidenceErrors.length === 0',
    "'startup-failure.json'",
    'failure: String(error), acceptance: false',
    'if (primaryFailure) throw primaryFailure',
    "if (evidenceErrors.length) throw new Error(evidenceErrors.join('\\n'))",
  ])
    includes(source, required);
  assert.ok(source.indexOf('if (!required)') < source.indexOf('await startServer('));
  assert.ok(
    source.indexOf('PROTO_UI_EXPECTED_HEAD !== revision') < source.indexOf('await startServer(')
  );
  assert.doesNotMatch(source, /--no-sandbox|--disable-setuid-sandbox|chromiumSandbox:\s*false/);
  assert.doesNotMatch(source, /\b(?:it|test|describe)\.(?:skip|skipIf|only)\b/);
  assert.doesNotMatch(source, /(?:CustomEvent|Event)\(['"]valueChange['"]/);
  assert.doesNotMatch(source, /dispatchEvent\(['"]valueChange['"]/);
  assert.doesNotMatch(source, /force:\s*true|addStyleTag\(|setContent\(/);

  const probe = functionSource(source, 'installWriteProbe');
  for (const required of [
    'context.addInitScript(',
    "const key = '__localeNativeWrites'",
    'const original = Storage.prototype.setItem',
    "this === localStorage && name === 'preferred-locale'",
    'return original.call(this, name, value)',
    'original.call(sessionStorage, key, JSON.stringify(entries))',
    "Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')",
    'get: () => descriptor.get!.call(document)',
    'descriptor.set!.call(document, value)',
  ])
    includes(probe, required);
  includes(functionSource(source, 'readWrites'), "sessionStorage.getItem('__localeNativeWrites')");
  includes(
    functionSource(source, 'repeatPageLoad'),
    "document.dispatchEvent(new Event('astro:page-load'))"
  );
  assert.doesNotMatch(functionSource(source, 'repeatPageLoad'), /valueChange/);

  const choose = functionSource(source, 'chooseLocale');
  for (const required of [
    "control === 'header' ? 'header' : '.sidebar-pane'",
    'await trigger.click()',
    'await option.click()',
    "await page.keyboard.press('ArrowDown')",
    "await page.keyboard.press('Home')",
    "await page.keyboard.press('Enter')",
    "await trigger.getAttribute('aria-controls')",
    'expect(paths[locale]).toBe(expectedPath)',
    'await page.waitForURL(url => url.origin === base.origin && url.pathname === expectedPath)',
  ])
    includes(choose, required);

  for (const required of [
    'await languageTrigger.isVisible()',
    'await menu.click()',
    "menu.getAttribute('aria-expanded')).toBe('true')",
    "await languageTrigger.waitFor({ state: 'visible' })",
  ])
    includes(choose, required);
  const ready = functionSource(source, 'waitForLocaleReady');
  for (const required of [
    'timeout: 45_000, interval: 100',
    'root.dataset.languageSelectInitialized',
    'root.dataset.currentLocale',
    'root.querySelectorAll(\'[role="combobox"]\').length',
    '.getExposes?.().value?.get?.()',
    "{ initialized: 'true', locale, triggerCount: 1, value: locale }",
    '(report.samples as unknown[]).push({ stage, state, time: Date.now() })',
  ])
    includes(ready, required);
  const observer = functionSource(source, 'installEventProbe');
  for (const required of [
    'const ids = new WeakMap<Event, number>()',
    'event.composedPath()',
    'timeStamp: event.timeStamp',
    'timeOrigin: performance.timeOrigin',
    'now: performance.now()',
    "observe(event, 'capture')",
    "observe(event, 'bubble')",
    'popup.contains(node)',
    "document.body.hasAttribute('data-mobile-menu-expanded')",
    'write.call(sessionStorage, key, JSON.stringify(entries))',
  ])
    includes(observer, required);
  assert.doesNotMatch(
    observer,
    /preventDefault|stopPropagation|stopImmediatePropagation|dispatchEvent/
  );
  includes(source, 'await installEventProbe(context)');
  includes(
    source,
    "report.events = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__localeNativeEvents') ?? '[]'))"
  );
  const save = functionSource(source, 'saveEvidence');
  for (const required of [
    'JSON.stringify(report, null, 2)',
    'await page.content()',
    'await page.screenshot({ fullPage: true })',
    "createHash('sha256').update(png).digest('hex')",
    '`${name}.html`',
    '`${name}.png`',
    '`${name}.json`',
  ])
    includes(save, required);
}

function collectSuite(source) {
  const cases = [];
  const setup = [];
  const teardown = [];
  const blocked = () => {
    throw new Error('Contract collection must not perform I/O or browser work');
  };
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(source, {
    fileName: suitePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics ?? [], []);
  runInNewContext(
    compiled.outputText,
    {
      exports: {},
      process: { env: {} },
      URL,
      require(id) {
        if (id === 'vitest')
          return {
            describe: { sequential: (_name, register) => register() },
            it: (name, action, timeout) => cases.push({ name, action, timeout }),
            beforeAll: (action, timeout) => setup.push({ action, timeout }),
            afterAll: (action, timeout) => teardown.push({ action, timeout }),
            expect: blocked,
          };
        if (id === 'playwright-core') return { chromium: { launch: blocked } };
        if (id === './browser-harness')
          return {
            chromeExecutable: blocked,
            startServer: blocked,
            stopServer: blocked,
          };
        if (id === './site-header-browser') return { revealHeaderPreferences: blocked };
        if (id === 'node:child_process') return { execFileSync: blocked };
        if (id === 'node:fs/promises')
          return { mkdir: blocked, readFile: blocked, writeFile: blocked };
        if (['node:path', 'node:crypto', 'node:os'].includes(id)) return require(id);
        throw new Error(`Unexpected executable import ${id}`);
      },
    },
    { filename: suitePath, timeout: 1_000 }
  );
  assert.equal(cases.length, 4);
  assert.equal(new Set(cases.map(({ name }) => name)).size, 4);
  for (const family of ['shadcn', 'brutalist'])
    for (const control of ['header', 'sidebar'])
      assert.equal(cases.filter(({ name }) => name.startsWith(`${family} ${control}:`)).length, 1);
  assert.ok(
    cases.every(({ action, timeout }) => typeof action === 'function' && timeout === 90_000)
  );
  assert.equal(setup.length, 1);
  assert.equal(teardown.length, 1);
  assert.equal(setup[0].timeout, 150_000);
  assert.equal(teardown[0].timeout, 30_000);
  const total =
    setup[0].timeout + teardown[0].timeout + cases.reduce((sum, entry) => sum + entry.timeout, 0);
  assert.equal(total, 540_000);
  assert.ok(total < 560_000);
}

function assertWorkflow(candidate) {
  assert.equal(candidate.name, 'Language selector navigation evidence');
  assert.deepEqual(Object.keys(candidate.on).sort(), ['pull_request', 'workflow_dispatch']);
  assert.deepEqual(candidate.permissions, { contents: 'read' });
  for (const file of [
    componentPath,
    suitePath,
    contractPath,
    workflowPath,
    'scripts/test/runtime-test-plan.mjs',
  ])
    assert.ok(candidate.on.pull_request.paths.includes(file), `Missing PR path ${file}`);
  const job = candidate.jobs['native-language-navigation'];
  assert.ok(job);
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.equal(job['timeout-minutes'], 20);
  assert.equal(job.env.PROTO_UI_EXPECTED_HEAD, expectedHead);
  assert.doesNotMatch(
    JSON.stringify(job.env),
    /\$\{\{[^}]*\brunner\s*\./,
    'runner context is unavailable in job.env'
  );
  for (const step of job.steps.filter((step) =>
    step.run?.includes('$PROTO_UI_LANGUAGE_EVIDENCE_DIR')
  )) {
    assert.equal(
      step.env?.PROTO_UI_LANGUAGE_EVIDENCE_DIR,
      '${{ runner.temp }}/language-navigation'
    );
  }
  if (job.permissions) assert.deepEqual(job.permissions, { contents: 'read' });
  const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, expectedHead);
  assert.equal(checkout.with['persist-credentials'], false);
  const install = job.steps.find((step) => step.run?.includes('install --frozen-lockfile'));
  assert.ok(install.run.includes('--ignore-scripts'));
  assert.equal(install['timeout-minutes'], 5);
  const buildIndex = job.steps.findIndex((step) => step.run?.includes('docs:build'));
  const executeIndex = job.steps.findIndex(
    (step) => step.run?.includes(`exec vitest run`) && step.run.includes(suitePath)
  );
  assert.ok(
    buildIndex >= 0 && executeIndex > buildIndex,
    'Build must precede the dedicated production suite'
  );
  assert.equal(job.steps[buildIndex]['timeout-minutes'], 5);
  const execute = job.steps[executeIndex];
  assert.equal(execute['timeout-minutes'], 10);
  assert.match(execute.env.PROTO_UI_BROWSER_BASE_URL, /^http:\/\/127\.0\.0\.1:\d+\/?$/);
  for (const required of [
    'set -euo pipefail',
    '--bind 127.0.0.1 --directory apps/www/dist',
    `node --test ${contractPath}`,
    'timeout --signal=TERM --kill-after=10s 560s',
    '--no-file-parallelism',
    '--maxWorkers=1 --minWorkers=1',
    '--reporter=default --reporter=json',
    'vitest.json',
  ])
    assert.ok(
      compact(execute.run).includes(compact(required)),
      `Missing workflow step: ${required}`
    );
  for (const [field, count] of [
    ['numTotalTests', 4],
    ['numPassedTests', 4],
    ['numFailedTests', 0],
    ['numPendingTests', 0],
  ])
    assert.match(
      execute.run,
      new RegExp(`assert\\.equal\\(\\s*[A-Za-z_$][\\w$]*\\.${field}\\s*,\\s*${count}\\s*\\)`)
    );
  assert.ok(job.steps.every((step) => !step['continue-on-error']));
  const upload = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(upload.if, 'always()');
  assert.ok(upload.with.name.includes(expectedHead));
  assert.equal(upload.with.path, '${{ runner.temp }}/language-navigation');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.doesNotMatch(
    JSON.stringify(candidate),
    /pull_request_target|secrets\.|sysctl|--no-sandbox|--disable-setuid-sandbox/
  );
}

describe('production language navigation evidence contract', () => {
  it('ignores optional array trailing commas but retains separators and holes', () => {
    const texts = (source) => sourceTokens(source).map((token) => token.text);
    assert.deepEqual(
      texts('expect(values).toEqual([locale,])'),
      texts('expect(values).toEqual([locale])')
    );
    assert.deepEqual(
      texts("[['zh-cn', 'pointer'], ['en', 'keyboard'],]"),
      texts("[['zh-cn', 'pointer'], ['en', 'keyboard']]")
    );
    assert.notDeepEqual(texts('[locale,,]'), texts('[locale]'));
    assert.notDeepEqual(texts('[one, two]'), texts('[oneTwo]'));
    assert.notDeepEqual(texts('(one, two)'), texts('(oneTwo)'));
    const changed = mutateSource(
      'expect(values).toEqual([locale,])',
      '.toEqual([locale])',
      '.toContain(locale)'
    );
    assert.equal(changed, 'expect(values).toContain(locale)');
  });
  it('collects exactly four native journeys without executing hooks or I/O', () =>
    collectSuite(suite));
  it('preserves native input, write transparency, origin isolation and failure evidence', () =>
    assertNativeSource(suite));
  it('owns one exact-head built-site workflow without weakening existing execution limits', () =>
    assertWorkflow(workflow));
  it('runs only through the dedicated owner, not unit or shared-dev browser phases', () => {
    assertBrowserInventory();
    assert.equal(PRODUCTION_BROWSER_SUITES.filter((file) => file === suitePath).length, 1);
    assert.ok(!BROWSER_SUITES.includes(suitePath));
    assert.equal(PRODUCTION_BROWSER_OWNERS[suitePath], workflowPath);
    const [general, browser] = createRuntimeTestPlan([]);
    assert.equal(general.args.filter((file) => file === suitePath).length, 1);
    assert.equal(general.args[general.args.indexOf(suitePath) - 1], '--exclude');
    assert.ok(!browser.args.includes(suitePath));
    assert.throws(
      () =>
        assertBrowserInventory(
          [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES],
          [...BROWSER_SUITES, suitePath],
          PRODUCTION_BROWSER_SUITES
        ),
      /Duplicate browser suite registration/
    );
    assert.throws(
      () =>
        assertBrowserInventory(
          [...BROWSER_SUITES, ...PRODUCTION_BROWSER_SUITES],
          BROWSER_SUITES,
          PRODUCTION_BROWSER_SUITES.filter((file) => file !== suitePath)
        ),
      /Browser inventory mismatch/
    );
  });
});

for (const [name, before, after] of [
  ['sandbox disabled', 'chromiumSandbox: true', 'chromiumSandbox: false'],
  ['service-worker interception allowed', "serviceWorkers: 'block'", "serviceWorkers: 'allow'"],
  [
    'cross-origin requests admitted',
    'if (url.origin === base.origin) return route.continue();',
    'if (true) return route.continue();',
  ],
  [
    'actual-derived expected path',
    'const expectedPath = `/${locale}/ui-libraries/${suffix}`',
    'const expectedPath = page.url()',
  ],
  [
    'mapping not checked against independent path',
    'expect(paths[locale]).toBe(expectedPath)',
    'void paths',
  ],
  [
    'navigation derived from the mapping under test',
    'url.pathname === expectedPath',
    'url.pathname === paths[locale]',
  ],
  ['blocked request continued', "route.abort('blockedbyclient')", 'route.continue()'],
  ['missing native pointer option', 'await option.click()', 'void option'],
  ['missing native keyboard commit', "await page.keyboard.press('Enter')", 'void page'],
  ['lost storage write cardinality', '.toEqual([locale])', '.toContain(locale)'],
  [
    'lost cookie write cardinality',
    "writes.filter(row => row.kind === 'cookie')).toHaveLength(1)",
    "writes.filter(row => row.kind === 'cookie')).toBeTruthy()",
  ],
  ['cookie getter shadowed', 'get: () => descriptor.get!.call(document)', 'get: () => undefined'],
  ['storage write not forwarded', 'return original.call(this, name, value)', 'return undefined'],
  ['cookie write not forwarded', 'descriptor.set!.call(document, value)', 'void value'],
  ['repeated lifecycle removed', 'await repeatPageLoad(page)', 'void page'],
  [
    'second root no longer required',
    "await page.locator('[data-language-select-root]').count()).toBe(2)",
    "await page.locator('[data-language-select-root]').count()).toBe(1)",
  ],
  ['target visibility bypassed', 'await languageTrigger.isVisible()', 'true'],
  ['menu opening removed', 'await menu.click()', 'void menu'],
  ['capture phase missing', "observe(event, 'capture')", 'void event'],
  ['bubble phase missing', "observe(event, 'bubble')", 'void event'],
  ['dispatch path missing', 'event.composedPath()', '[]'],
  ['popup ownership missing', 'popup.contains(node)', 'false'],
  ['document identity missing', 'timeOrigin: performance.timeOrigin', 'timeOrigin: 0'],
  ['event timing missing', 'timeStamp: event.timeStamp', 'timeStamp: 0'],
  ['hydration readiness omitted', 'root.dataset.languageSelectInitialized', 'undefined'],
  ['missing failure screenshot', 'await page.screenshot({ fullPage: true })', 'new Uint8Array()'],
  ['failure hidden', 'if (primaryFailure) throw primaryFailure', 'void primaryFailure'],
])
  it(`rejects source mutation: ${name}`, () => {
    const changed = mutateSource(suite, before, after);
    assert.notEqual(changed, suite);
    assert.throws(() => assertNativeSource(changed));
  });

for (const [name, mutate] of [
  [
    'synthetic merge checkout',
    (job) => {
      job.steps.find((s) => s.uses?.startsWith('actions/checkout@')).with.ref = '${{ github.sha }}';
    },
  ],
  [
    'job budget expansion',
    (job) => {
      job['timeout-minutes'] = 21;
    },
  ],
  [
    'runner context in job env',
    (job) => {
      job.env.PROTO_UI_LANGUAGE_EVIDENCE_DIR = '${{ runner.temp }}/language-navigation';
    },
  ],
  [
    'missing step artifact binding',
    (job) => {
      delete job.steps.find((step) => step.run?.includes('docs:build')).env
        .PROTO_UI_LANGUAGE_EVIDENCE_DIR;
    },
  ],
  [
    'missing production build',
    (job) => {
      job.steps.find((s) => s.run?.includes('docs:build')).run = 'echo build skipped';
    },
  ],
  [
    'remote production target',
    (job) => {
      job.steps.find((s) => s.env?.PROTO_UI_BROWSER_BASE_URL).env.PROTO_UI_BROWSER_BASE_URL =
        'https://example.com';
    },
  ],
  [
    'lane budget expansion',
    (job) => {
      const step = job.steps.find((s) => s.run?.includes('560s'));
      step.run = step.run.replace('560s', '600s');
    },
  ],
  [
    'failed suite ignored',
    (job) => {
      job.steps.find((s) => s.run?.includes('exec vitest run'))['continue-on-error'] = true;
    },
  ],
  [
    'missing failed-state upload',
    (job) => {
      job.steps.find((s) => s.uses?.startsWith('actions/upload-artifact@')).if = 'success()';
    },
  ],
])
  it(`rejects workflow mutation: ${name}`, () => {
    const changed = structuredClone(workflow);
    mutate(changed.jobs['native-language-navigation']);
    assert.throws(() => assertWorkflow(changed));
  });

it('rejects unbounded or incomplete case registration without opening a browser', () => {
  for (const [before, after] of [
    ["['header', 'sidebar']", "['header']"],
    ['}, 90_000)', '}, 120_000)'],
    ['}, 150_000)', '}, 180_000)'],
  ]) {
    const changed = mutateSource(suite, before, after);
    assert.notEqual(changed, suite);
    assert.throws(() => collectSuite(changed));
  }
});
