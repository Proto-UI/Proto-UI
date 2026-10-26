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
  BROWSER_SHARD_COUNT,
  assertBrowserInventory,
  browserShards,
  createRuntimeTestPlan,
} from './runtime-test-plan.mjs';

const suitePath = 'apps/www/src/content/docs/zh-cn/site-typography.browser.test.ts';
const suite = readFileSync(suitePath, 'utf8');
const compact = suite.replace(/\s+/g, ' ');
const fixture = readFileSync('apps/www/src/pages/en/test/site-typography.astro', 'utf8');
const compactFixture = fixture.replace(/\s+/g, ' ');
const workflow = YAML.parse(readFileSync('.github/workflows/site-typography-evidence.yml', 'utf8'));
const ci = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8'));

function collectSuite() {
  const cases = [];
  const hooks = [];
  const blocked = () => {
    throw new Error(
      'This socket-free contract must never invoke a browser, server, selection or navigation'
    );
  };
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(suite, {
    fileName: suitePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  assert.deepEqual(
    compiled.diagnostics.filter((entry) => entry.category === ts.DiagnosticCategory.Error),
    []
  );
  runInNewContext(compiled.outputText, {
    exports: {},
    process,
    require(id) {
      if (id === 'vitest')
        return {
          describe: { sequential: (_name, register) => register() },
          it: (name, action, timeout) => cases.push({ name, action, timeout }),
          beforeAll: (action) => hooks.push(action),
          afterAll: (action) => hooks.push(action),
          expect: blocked,
        };
      if (id === './browser-harness')
        return {
          RUNTIMES: ['wc', 'react', 'vue', 'vue2'],
          startServer: blocked,
          stopServer: blocked,
          launchBrowser: blocked,
          choosePreviewRuntime: blocked,
        };
      if (id === './site-header-browser') return { revealHeaderPreferences: blocked };
      if (id.startsWith('node:')) return require(id);
      throw new Error(`Unexpected executable import ${id}`);
    },
  });
  return { cases, hooks };
}

describe('native typography browser ownership and bounded registration', () => {
  it('collects every configured journey without running a browser or hook', () => {
    const { cases, hooks } = collectSuite();
    assert.equal(cases.length, 33);
    assert.equal(new Set(cases.map((entry) => entry.name)).size, 33);
    assert.equal(hooks.length, 2);
    for (const family of ['shadcn', 'brutalist', 'homepage'])
      assert.equal(
        cases.filter(
          ({ name }) => name === `${family}: retains its own no-JavaScript heading scale`
        ).length,
        1
      );
    assert.ok(
      cases.every(
        (entry) =>
          typeof entry.action === 'function' && entry.timeout >= 60_000 && entry.timeout <= 180_000
      )
    );
    for (const runtime of ['wc', 'react', 'vue', 'vue2'])
      for (const family of ['shadcn', 'brutalist']) {
        assert.equal(
          cases.filter(({ name }) => name.startsWith(`${runtime}/${family}:`)).length,
          1
        );
        for (const locale of ['zh-cn', 'en'])
          assert.equal(
            cases.filter(({ name }) => name.startsWith(`${locale}/${runtime}/${family}:`)).length,
            1
          );
      }
    for (const mode of ['no-js', 'initial-module-failure'])
      for (const target of ['homepage', 'native-fixture'])
        assert.equal(cases.filter(({ name }) => name.startsWith(`${target}/${mode}:`)).length, 1);
    assert.match(
      compact,
      /for \(const width of \[320, 390\]\) for \(const textPercent of \[100, 200\]\)/
    );
    assert.match(compact, /failures\.push/);
    assert.match(
      compact,
      /finally \{ await capture\( page, record|finally \{ await capture\(page, record/
    );
  });
  it('is excluded from unit tests and admitted exactly once across all eight browser shards', () => {
    assertBrowserInventory();
    assert.equal(BROWSER_SHARD_COUNT, 8);
    assert.equal(BROWSER_SUITES.filter((path) => path === suitePath).length, 1);
    assert.equal(PRODUCTION_BROWSER_SUITES.includes(suitePath), false);
    assert.equal(
      browserShards()
        .flat()
        .filter((path) => path === suitePath).length,
      1
    );
    const [general] = createRuntimeTestPlan([], { phase: 'general' });
    assert.equal(general.args[general.args.indexOf(suitePath) - 1], '--exclude');
  });
  it('uses the actual original native source and existing typography owner without a test Prototype', () => {
    assert.match(compactFixture, /initDocumentationTypography\(document\)/);
    assert.match(
      compactFixture,
      /applySiteLibraryFamily\(document, requireSiteLibraryFamily\(family\.value\)\)/
    );
    assert.match(compactFixture, /PREFERRED_ADAPTER_EVENT/);
    assert.match(compactFixture, /createTreeWalker\(native, NodeFilter\.SHOW_TEXT\)/);
    assert.ok(
      fixture.indexOf('window.__nativeTypographySources') <
        fixture.indexOf('initDocumentationTypography(document)')
    );
    assert.match(
      compactFixture,
      /<label id="native-label" for="native-input">Your name 姓名<\/label>/
    );
    assert.match(compactFixture, /<legend id="native-legend">Options 选项<\/legend>/);
    assert.doesNotMatch(
      fixture,
      /definePrototype|renderDemo\(|data-typography-runtime=|data-typography-prototype=|font-family\s*:|font-size\s*:/
    );
    assert.match(compactFixture, /noindex, nofollow/);
    assert.match(compact, /originalSources: texts\.every/);
    assert.match(compact, /node\.textNodeCount\)\.toBe\(node\.originalTextNodeCount\)/);
    assert.match(compact, /node\.surfaceCount\)\.toBe\(1\)/);
  });
  it('requires rendered glyph observations and browser accessibility, selection and copy', () => {
    for (const required of [
      'CSS.getPlatformFontsForNode',
      'Accessibility.getPartialAXTree',
      'page.mouse.click',
      'clickCount: 3',
      "page.keyboard.press('ControlOrMeta+C')",
      'navigator.clipboard.readText()',
      'setBaseAndExtent',
      'anchorIsLastSource',
      'focusIsFirstSource',
    ])
      assert.ok(suite.includes(required), required);
    assert.match(compact, /font\.glyphCount > 0 && font\.isCustomFont/);
    assert.match(compact, /cjk\.some\([\s\S]+?DM Sans[\s\S]+?\)\.toBe\(false\)/);
    assert.match(compact, /200% is root text resize, not browser-UI zoom/);
    assert.match(compact, /permissions: \['clipboard-read', 'clipboard-write'\]/);
  });
  it('records actual Git HEAD, expected head and event SHA separately and keeps failures', () => {
    assert.match(compact, /actualGitHead: execFileSync\('git', \['rev-parse', 'HEAD'\]/);
    assert.match(compact, /expectedHead: process\.env\.PROTO_UI_EXPECTED_HEAD \?\? null/);
    assert.match(compact, /eventSha: process\.env\.GITHUB_SHA \?\? null/);
    assert.match(compact, /source\.actualGitHead[\s\S]+?toBe\(source\.expectedHead\)/);
    assert.match(compact, /record\.outcome = 'failed'/);
    assert.match(compact, /record\.error = String\(error\)/);
    assert.match(compact, /context\.tracing\.stop/);
    assert.match(compact, /await writeManifest\(\); await context\.close\(\)/);
    assert.doesNotMatch(suite, /test\.skip|it\.skip|describe\.skip/);
  });
  it('uses read-only exact-head Actions, explicit deadline and separate always-uploaded frames/traces', () => {
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.equal(
      workflow.env.CANDIDATE_SHA,
      '${{ github.event.pull_request.head.sha || github.sha }}'
    );
    const job = workflow.jobs['native-typography'];
    const checkout = job.steps.find((step) => step.uses === 'actions/checkout@v4');
    assert.equal(checkout.with.ref, '${{ env.CANDIDATE_SHA }}');
    assert.equal(checkout.with['persist-credentials'], false);
    const run = job.steps.find(
      (step) => step.name === 'Exercise native source with actual adapters and Chromium'
    );
    assert.equal(run.env.PROTO_UI_EXPECTED_HEAD, '${{ env.CANDIDATE_SHA }}');
    assert.match(run.run, /timeout --signal=TERM --kill-after=10s 840s/);
    assert.ok(run.run.includes(suitePath));
    const uploads = job.steps.filter((step) => step.uses === 'actions/upload-artifact@v4');
    assert.equal(uploads.length, 2);
    assert.ok(uploads.every((step) => step.if === 'always()'));
    assert.match(uploads[0].with.path, /\*\.png/);
    assert.doesNotMatch(uploads[0].with.path, /trace\.zip/);
    assert.match(uploads[1].with.path, /\*-trace\.zip/);
    assert.ok(job.steps.some((step) => step.run?.includes('fonts-noto-cjk')));
    assert.ok(ci.jobs['test-browser'].steps.some((step) => step.run?.includes('fonts-noto-cjk')));
    assert.ok(
      ci.jobs['test-browser'].steps.some((step) =>
        step.run?.includes(
          'PROTO_UI_TYPOGRAPHY_EVIDENCE_DIR="$PROTO_UI_RUNTIME_EVIDENCE_DIR/typography"'
        )
      )
    );
  });
});

function assertTypographyFontPreparation(value) {
  const job = value.jobs['native-typography'];
  assert.equal(job['timeout-minutes'], 22);
  const restore = job.steps.filter((step) => step.uses === 'actions/cache@v4');
  assert.equal(restore.length, 1);
  assert.equal(restore[0]['timeout-minutes'], 1);
  assert.deepEqual(restore[0].with, {
    path: '${{ runner.temp }}/homepage-font-cache/fonts-noto-cjk_20230817+repack1-3_all.deb',
    key: 'ubuntu24-fonts-noto-cjk-7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c',
  });
  const prep = job.steps.find(
    (step) => step.name === 'Install locked dependencies and real CJK font resources'
  );
  assert.equal(prep['timeout-minutes'], 5);
  assert.equal(prep.env.FONT_EVIDENCE_DIR, '${{ runner.temp }}/typography-evidence');
  assert.ok(prep.run.includes('corepack pnpm@10.32.1 install --frozen-lockfile --ignore-scripts'));
  assert.ok(
    prep.run.includes(
      'timeout --signal=TERM --kill-after=5s 220s bash apps/www/scripts/prepare-homepage-composition-fonts.sh'
    )
  );
  assert.ok(
    prep.run.includes("dpkg-query -W -f='${Package} ${Version}\\n' fonts-noto-cjk fontconfig")
  );
  assert.ok(prep.run.includes("fc-match -f '%{family}\\n%{file}\\n' 'sans-serif:lang=zh-cn'"));
  assert.ok(prep.run.includes('tee -a "$RUNNER_TEMP/typography-evidence/font-environment.txt"'));
  assert.doesNotMatch(prep.run, /apt-get|\|\| true|continue-on-error|skip/i);
  assert.ok(job.steps.indexOf(restore[0]) < job.steps.indexOf(prep));
}
it('reuses the exact verified font package without extending typography budgets or skipping font validation', () => {
  assertTypographyFontPreparation(workflow);
});
for (const [name, mutate] of [
  [
    'truncated font provenance',
    (w) => {
      const prep = w.jobs['native-typography'].steps.find(
        (s) => s.name === 'Install locked dependencies and real CJK font resources'
      );
      prep.run = prep.run.replace('tee -a', 'tee');
    },
  ],
  [
    'wide cache',
    (w) => {
      w.jobs['native-typography'].steps.find((s) => s.uses === 'actions/cache@v4').with.path =
        '${{ runner.temp }}';
    },
  ],
  [
    'unverified cache identity',
    (w) => {
      w.jobs['native-typography'].steps.find((s) => s.uses === 'actions/cache@v4').with.key =
        'fonts-latest';
    },
  ],
  [
    'preparation budget expansion',
    (w) => {
      w.jobs['native-typography'].steps.find(
        (s) => s.name === 'Install locked dependencies and real CJK font resources'
      )['timeout-minutes'] = 6;
    },
  ],
  [
    'missing font helper',
    (w) => {
      w.jobs['native-typography'].steps.find(
        (s) => s.name === 'Install locked dependencies and real CJK font resources'
      ).run = 'echo prepared';
    },
  ],
  [
    'swallowed font failure',
    (w) => {
      w.jobs['native-typography'].steps.find(
        (s) => s.name === 'Install locked dependencies and real CJK font resources'
      ).run += '\ntrue || true';
    },
  ],
  [
    'wrong evidence destination',
    (w) => {
      w.jobs['native-typography'].steps.find(
        (s) => s.name === 'Install locked dependencies and real CJK font resources'
      ).env.FONT_EVIDENCE_DIR = '/tmp/other';
    },
  ],
])
  it(`rejects typography font preparation with ${name}`, () => {
    const changed = structuredClone(workflow);
    mutate(changed);
    assert.throws(() => assertTypographyFontPreparation(changed));
  });

it('keeps exact family-separated narrow Hero paint at both text scales', () => {
  const ast = ts.createSourceFile(suitePath, suite, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'narrowHomepageHeading'
  );
  assert.ok(node);
  const js = ts.transpileModule(node.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const expected = runInNewContext(js + '; narrowHomepageHeading');
  for (const [family, percent, token, size, lineHeight] of [
    ['shadcn', 100, 'text-3xl', 30, '33px'],
    ['shadcn', 200, 'text-3xl', 60, '66px'],
    ['brutalist', 100, 'text-2xl', 24, '30px'],
    ['brutalist', 200, 'text-2xl', 48, '60px'],
  ])
    assert.deepEqual(JSON.parse(JSON.stringify(expected(family, percent))), {
      token,
      size,
      lineHeight,
    });
  const required = [
    'state.headingSamples = headingSamples',
    'headingSamples.push(sample)',
    'size: expectedHeading.size',
    'lineHeight: expectedHeading.lineHeight',
    'timeout: 15_000',
    "['homepage', '/zh-cn/', '30px', '33px']",
    'geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1)',
    'geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewport + 1)',
  ];
  const verify = (source) => {
    for (const item of required) assert.ok(source.includes(item), item);
  };
  verify(suite);
  for (const item of required) assert.throws(() => verify(suite.replaceAll(item, '')));
});
