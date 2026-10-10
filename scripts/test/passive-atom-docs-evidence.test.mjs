import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import ts from 'typescript';
import YAML from 'yaml';

const suitePath = 'apps/www/src/content/docs/zh-cn/demo-passive-atoms.browser.test.ts';
function collect(window) {
  const cases = [];
  const hooks = [];
  const blocked = () => {
    throw new Error('Socket-free evidence contract must not start a browser or server');
  };
  const nativeRequire = createRequire(import.meta.url);
  const output = ts.transpileModule(readFileSync(suitePath, 'utf8'), {
    fileName: suitePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const context = {
    exports: {},
    process,
    window,
    document: window.document,
    MutationObserver: window.MutationObserver,
    Node: window.Node,
    getComputedStyle: window.getComputedStyle.bind(window),
    performance: window.performance,
    require(id) {
      if (id.endsWith('/document-font-probe')) {
        const helper = ts.transpileModule(
          readFileSync('apps/www/src/components/PrototypePreviewer/document-font-probe.ts', 'utf8'),
          { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
        ).outputText;
        const helperContext = { exports: {}, document: window.document, Node: window.Node };
        runInNewContext(helper, helperContext);
        return helperContext.exports;
      }
      if (id === 'vitest')
        return {
          beforeAll: (action) => hooks.push(action),
          afterAll: (action) => hooks.push(action),
          describe: { sequential: (_name, register) => register() },
          it: {
            each: (values) => (_name, action, timeout) =>
              cases.push(...values.map((value) => ({ value, action, timeout }))),
          },
          expect: blocked,
        };
      if (id === './browser-harness')
        return {
          RUNTIMES: ['wc', 'react', 'vue', 'vue2'],
          launchBrowser: blocked,
          selectRuntime: blocked,
          startServer: blocked,
          stopServer: blocked,
        };
      if (id.startsWith('node:')) return nativeRequire(id);
      throw new Error(`Unexpected import ${id}`);
    },
  };
  runInNewContext(
    `${output}\nglobalThis.installRecorder = installShellRecorder; globalThis.matchesReadyOwner = readyEventHasExpectedOwner; globalThis.documentTypographySelector = DOCUMENT_TYPOGRAPHY_SELECTOR; globalThis.findFontSample = document_font_probe_1.findDocumentFontSample;`,
    context
  );
  return {
    cases,
    hooks,
    install: context.installRecorder,
    matchesReadyOwner: context.matchesReadyOwner,
    documentTypographySelector: context.documentTypographySelector,
    findFontSample: context.findFontSample,
  };
}
function shell({ hidden = false, inert = false, borrowed = true, generation = 1, display } = {}) {
  return `<div ${hidden ? 'hidden' : ''} ${inert ? 'inert' : ''} ${display ? `style="display:${display}"` : ''}><div class="pui-runtime-preview-surface" data-projection-generation="${generation}" data-projection-runtime="react"><div data-passive-shell-slot>${borrowed ? '<div data-demo-ref="__website_runtime_preview_surface__-content"><span data-pui-root>real source</span></div>' : ''}</div></div></div>`;
}
function probe(markup) {
  const window = new Window();
  window.document.body.innerHTML = `<div data-previewer-id="fixture">${markup}</div>`;
  const suite = collect(window);
  suite.install();
  window.document.dispatchEvent(
    new window.CustomEvent('runtime:changed', { detail: { id: 'react' } })
  );
  return { ...suite, state: window.__passiveAtomEvidence };
}

test('collects the original 64 cases plus exactly 16 Bootstrap and Liquid Glass Text cases', () => {
  const { cases, hooks } = collect(new Window());
  assert.equal(cases.length, 80);
  assert.equal(hooks.length, 2);
  assert.equal(
    new Set(
      cases.map(({ value }) => `${value.locale}/${value.family}/${value.atom}/${value.runtime}`)
    ).size,
    80
  );
  // Retain every existing family/atom/runtime/locale identity. Only the two
  // already-public Text pages add cases; no prior case may be traded away.
  const originalSubjects = [
    ...['base', 'shadcn', 'brutalist'].map((family) => ({ family, atom: 'text' })),
    ...['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'].map((family) => ({
      family,
      atom: 'surface',
    })),
  ];
  const addedSubjects = ['bootstrap-2-3-2', 'liquid-glass'].map((family) => ({
    family,
    atom: 'text',
  }));
  const identities = (subjects) =>
    subjects.flatMap(({ family, atom }) =>
      ['en', 'zh-cn'].flatMap((locale) =>
        ['wc', 'react', 'vue', 'vue2'].map((runtime) => `${locale}/${family}/${atom}/${runtime}`)
      )
    );
  const original = identities(originalSubjects);
  const added = identities(addedSubjects);
  assert.equal(original.length, 64);
  assert.equal(added.length, 16);
  assert.deepEqual(
    cases
      .map(({ value }) => `${value.locale}/${value.family}/${value.atom}/${value.runtime}`)
      .sort(),
    [...original, ...added].sort()
  );
  assert.ok(cases.every(({ timeout }) => timeout === 90_000));
});
test('keeps hidden, inert and empty candidates in evidence without counting them as content owners', () => {
  const { state } = probe(
    shell() +
      shell({ hidden: true, generation: 2 }) +
      shell({ inert: true, generation: 3 }) +
      shell({ borrowed: false, generation: 4 }) +
      shell({ display: 'none', generation: 5 })
  );
  const slots = state.traces.at(-1).slots;
  assert.equal(slots.length, 5);
  assert.equal(slots.filter((slot) => slot.active).length, 1);
  assert.equal(slots[1].hostHidden, true);
  assert.equal(slots[2].hostInert, true);
  assert.equal(slots[3].borrowedContent, false);
  assert.equal(slots[4].hostDisplay, 'none');
  assert.ok(slots.every((slot) => slot.phase === null));
  assert.equal(state.events[0].slots.length, 5);
  assert.equal(state.events[0].name, 'runtime:changed');
});
test('two visible borrowed owners remain a detectable violation, never filtered to the first', () => {
  const { state } = probe(shell() + shell({ generation: 2 }));
  assert.equal(state.traces.at(-1).slots.filter((slot) => slot.active).length, 2);
  assert.equal(state.events[0].slots.filter((slot) => slot.active).length, 2);
});
test('a ready event naming the new runtime cannot be satisfied by the old runtime owner', () => {
  const { state, matchesReadyOwner } = probe(shell());
  const event = state.events[0];
  assert.equal(matchesReadyOwner(event), true);
  assert.equal(matchesReadyOwner({ ...event, detail: { id: 'vue' } }), false);
  assert.equal(
    matchesReadyOwner({ ...event, name: 'previewer:mounted', detail: { runtime: 'vue' } }),
    false
  );
  assert.equal(matchesReadyOwner({ ...event, detail: {} }), false);
});
test('hosted evidence retains exact head and read-only permissions', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/passive-atom-docs-evidence.yml', 'utf8')
  );
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const steps = workflow.jobs['public-atom-previews'].steps;
  assert.equal(
    steps.find((step) => step.uses === 'actions/checkout@v4').with.ref,
    '${{ env.CANDIDATE_SHA }}'
  );
  assert.equal(
    steps.find((step) => step.uses === 'actions/checkout@v4').with['persist-credentials'],
    false
  );
  assert.ok(steps.some((step) => step.run?.includes(suitePath)));
  assert.ok(
    steps.some((step) => step.uses === 'actions/upload-artifact@v4' && step.if === 'always()')
  );
});

// Functional preview assertions alone cannot detect missing CJK glyphs in prose.
test('bilingual evidence installs real CJK fonts and retains font provenance', () => {
  const workflow = YAML.parse(
    readFileSync('.github/workflows/passive-atom-docs-evidence.yml', 'utf8')
  );
  const steps = workflow.jobs['public-atom-previews'].steps;
  const fonts = steps.findIndex((step) => step.run?.includes('fonts-noto-cjk'));
  const browser = steps.findIndex((step) => step.run?.includes(suitePath));
  assert.ok(fonts >= 0 && fonts < browser);
  assert.match(steps[fonts].run, /dpkg-query/);
  assert.match(steps[fonts].run, /fc-list ':lang=zh-cn'/);
  assert.match(steps[fonts].run, /font-environment\.txt/);
  assert.match(steps[fonts].run, /test -n/);
});

test('document font probe matches the actual MarkdownContent override, not an upstream wrapper', () => {
  const source = readFileSync('apps/www/src/components/override/MarkdownContent.astro', 'utf8');
  const opening = source.match(/<div[^>]*\bdata-doc-flow[^>]*>/)?.[0];
  assert.ok(opening, 'The probe must stay bound to the actual document-flow owner');
  const window = new Window();
  window.document.body.innerHTML = `${opening}<p><code>shadcn-surface-root</code> 中文内容</p><p>Second paragraph</p></div>`;
  const { documentTypographySelector } = collect(window);
  const nodes = window.document.querySelectorAll(documentTypographySelector);
  assert.equal(nodes.length, 1);
  assert.match(nodes[0].textContent, /中文内容/);
  assert.equal(window.document.querySelector('.sl-markdown-content > p'), null);
});

test('font probe reaches authored text inside the real Text carrier and distinguishes CJK from code', () => {
  const window = new Window();
  window.document.body.innerHTML =
    '<div data-doc-flow><p><span data-typography-carrier><span data-pui-root><span data-slot><code>shadcn-surface-root</code><span id="actual-text"> 是通用 Surface 原子。</span></span></span></span></p></div>';
  const { findFontSample, documentTypographySelector } = collect(window);
  assert.equal(findFontSample(documentTypographySelector, true).id, 'actual-text');
  assert.equal(findFontSample(documentTypographySelector, false).localName, 'code');
  window.document.getElementById('actual-text').textContent = 'English only';
  assert.equal(findFontSample(documentTypographySelector, true), null);
  assert.equal(findFontSample('[data-missing]', false), null);
});
