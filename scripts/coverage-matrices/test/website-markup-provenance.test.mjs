import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeMarkupObservation,
  highlightedFragmentIssues,
  markupComparison,
  markupDigest,
  originalCodePanels,
  originalInstallCommands,
} from '../website-markup-provenance.mjs';

// Supplied fixtures exercise receipt discrimination. Real Shiki, actual Website
// controls and native template parsing are exercised by the separate browser suite.
const escapeAttribute = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('\r', '&#13;').replaceAll('\n', '&#10;');

function capture() {
  const raw = '<example label="<&>">中文</example>\r\n';
  const fragment = `<pre class="proto-previewer__code shiki" tabindex="0"><code data-raw-code="${escapeAttribute(raw)}"><span class="line">&lt;example&gt;中文&lt;/example&gt;</span></code></pre>`;
  const highlightsAttribute = JSON.stringify({ wc: fragment, react: fragment });
  const codeMapAttribute = JSON.stringify({ wc: raw, react: raw });
  const html = `<!doctype html><main><div data-previewer-id="p1" data-initial-runtime="wc" data-code-map="${escapeAttribute(codeMapAttribute)}" data-code-highlights="${escapeAttribute(highlightsAttribute)}"><div data-code-content>${fragment}</div></div></main>`;
  const sources = [{ path: 'supplied-producer.ts', sha256: markupDigest('supplied source') }];
  return {
    profile: { revision: 'a'.repeat(40), sources },
    binding: { revision: 'b'.repeat(40), sources: structuredClone(sources) },
    response: { kind: 'navigation-response', navigationId: 'supplied-navigation-1', status: 200, contentType: 'text/html; charset=utf-8', html },
    observation: {
      responseDigest: markupDigest(html), navigationId: 'supplied-navigation-1', previewerId: 'p1', ownerPreviewerId: 'p1',
      runtime: 'react', connected: true, receiverTag: 'div', receiverCount: 1,
      highlightsAttribute, codeMapAttribute, contentHtml: fragment,
    },
  };
}

test('834 separates an original response match, a native sample and unobservable served source', () => {
  const input = capture();
  const report = analyzeMarkupObservation(input);
  assert.equal(report.matchesRecordedProducer, true);
  assert.equal(report.matchesExpectedNativeOutput, true);
  assert.equal(report.nativeRuntime.comparison.transformation, null);
  assert.equal(report.sourceAdmission, 'unverified');
  assert.equal(report.servedSource, 'unobservable');
  assert.equal(report.nativeRuntime.kind, 'native-runtime-output');
  const [start, end] = report.originalHTML.receiver.sourceRange;
  assert.ok(input.response.html.slice(start, end).startsWith('<div data-previewer-id="p1"'));
  assert.equal(report.originalHTML.receiver.contentCount, 1);
  assert.deepEqual(report.issues, []);
});

function enhancedCapture(tabindex = '0') {
  const input = capture();
  for (const path of [
    'apps/www/src/components/PrototypePreviewer/CodeScrollArea.astro',
    'apps/www/src/components/PrototypePreviewer/code-scroll-area-client.ts',
    'apps/www/src/components/PrototypePreviewer/code-panel-client.ts',
  ]) {
    input.profile.sources.push({ path, sha256: markupDigest(`supplied source for ${path}`) });
  }
  input.binding.sources = structuredClone(input.profile.sources);
  input.observation.contentHtml = input.observation.contentHtml.replace(' tabindex="0"', '');
  // Supplied relationship facts exercise the receipt model. The browser suite
  // samples these independently from actual public ScrollArea DOM/exposes.
  input.observation.codeScrollFocus = {
    kind: 'public-scroll-area-viewport', ready: true,
    anatomyCount: 1, anatomyTag: 'wc-site-code-scroll-root',
    viewportCount: 1, viewportTag: 'wc-site-code-scroll-viewport',
    anatomyIsContainerChild: true, viewportIsAnatomyChild: true, receiverIsViewportChild: true,
    connected: true, ownerPreviewerId: 'p1', tabindex, role: 'region', label: 'Example source',
    projection: 'composed',
  };
  return input;
}

for (const tabindex of ['0', '-1']) {
  test(`834 records the exact focus handover separately from producer equality at viewport tabindex ${tabindex}`, () => {
    const input = enhancedCapture(tabindex);
    const report = analyzeMarkupObservation(input);
    assert.deepEqual(report.issues, []);
    assert.equal(report.matchesRecordedProducer, false);
    assert.equal(report.matchesExpectedNativeOutput, true);
    assert.equal(report.sourceAdmission, 'unverified');
    assert.equal(report.servedSource, 'unobservable');
    assert.equal(report.nativeRuntime.comparison.transformation, 'code-scroll-viewport-focus-handover');
    assert.equal(report.nativeRuntime.comparison.producer.matches, false);
    assert.equal(report.nativeRuntime.comparison.expected.matches, true);
    assert.notEqual(report.nativeRuntime.comparison.producer.expectedDigest,
      report.nativeRuntime.comparison.expected.expectedDigest);
    assert.equal(report.nativeRuntime.observation.contentHtml, input.observation.contentHtml);
    assert.equal(report.originalHTML.receiver.contentHtml.includes('tabindex="0"'), true);
  });
}

test('834 keeps a public viewport system fallback explicit without changing producer markup', () => {
  const input = enhancedCapture();
  input.observation.codeScrollFocus.projection = 'system';
  const report = analyzeMarkupObservation(input);
  assert.deepEqual(report.issues, []);
  assert.equal(report.matchesRecordedProducer, false);
  assert.equal(report.matchesExpectedNativeOutput, true);
});

for (const [name, alter, expected] of [
  ['missing handover observation', (input) => { delete input.observation.codeScrollFocus; }, /native output differs/],
  ['an unbound transformer', (input) => {
    input.profile.sources = input.profile.sources.filter((source) => !source.path.endsWith('code-scroll-area-client.ts'));
    input.binding.sources = structuredClone(input.profile.sources);
  }, /transformation source is unbound/],
  ['a different transformation', (input) => { input.observation.codeScrollFocus.kind = 'arbitrary-tabindex-removal'; }, /ownership is unproven/],
  ['an unready container', (input) => { input.observation.codeScrollFocus.ready = false; }, /ownership is unproven/],
  ['ambiguous anatomy roots', (input) => { input.observation.codeScrollFocus.anatomyCount = 2; }, /ownership is unproven/],
  ['a foreign root', (input) => { input.observation.codeScrollFocus.anatomyTag = 'div'; }, /ownership is unproven/],
  ['ambiguous viewports', (input) => { input.observation.codeScrollFocus.viewportCount = 2; }, /ownership is unproven/],
  ['a foreign viewport', (input) => { input.observation.codeScrollFocus.viewportTag = 'div'; }, /ownership is unproven/],
  ['an unrelated root', (input) => { input.observation.codeScrollFocus.anatomyIsContainerChild = false; }, /ownership is unproven/],
  ['an unrelated viewport', (input) => { input.observation.codeScrollFocus.viewportIsAnatomyChild = false; }, /ownership is unproven/],
  ['a receiver outside the viewport', (input) => { input.observation.codeScrollFocus.receiverIsViewportChild = false; }, /ownership is unproven/],
  ['a detached viewport', (input) => { input.observation.codeScrollFocus.connected = false; }, /ownership is unproven/],
  ['a different previewer owner', (input) => { input.observation.codeScrollFocus.ownerPreviewerId = 'p2'; }, /ownership is unproven/],
  ['a nonfocusable viewport', (input) => { input.observation.codeScrollFocus.tabindex = null; }, /ownership is unproven/],
  ['an unexpected viewport tab order', (input) => { input.observation.codeScrollFocus.tabindex = '1'; }, /ownership is unproven/],
  ['a missing region role', (input) => { input.observation.codeScrollFocus.role = null; }, /ownership is unproven/],
  ['an unnamed viewport', (input) => { input.observation.codeScrollFocus.label = ' '; }, /ownership is unproven/],
  ['an unresolved host projection', (input) => { input.observation.codeScrollFocus.projection = null; }, /ownership is unproven/],
  ['a changed pre tabindex', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('<pre ', '<pre tabindex="-1" '); }, /native output differs/],
  ['a second native tab stop', (input) => { input.observation.contentHtml = JSON.parse(input.observation.highlightsAttribute).react; }, /native output differs/],
  ['an arbitrary attribute', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('<pre ', '<pre data-extra="changed" '); }, /native output differs/],
  ['changed highlighted classes', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('class="line"', 'class="other"'); }, /native output differs/],
  ['changed highlighted style', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('<span ', '<span style="color:#000" '); }, /native output differs/],
  ['changed example text', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('中文&lt;', 'changed&lt;'); }, /native output differs/],
  ['changed raw source bytes', (input) => { input.observation.contentHtml = input.observation.contentHtml.replace('data-raw-code="', 'data-raw-code="changed'); }, /native output differs/],
  ['an introduced executable entry', (input) => { input.observation.contentHtml += '<script>changed()</script>'; }, /native output differs/],
  ['focus withdrawal in the original response', (input) => {
    const original = JSON.parse(input.observation.highlightsAttribute).wc;
    input.response.html = input.response.html.replace(`<div data-code-content>${original}</div>`, `<div data-code-content>${input.observation.contentHtml}</div>`);
    input.observation.responseDigest = markupDigest(input.response.html);
  }, /original SSR output differs/],
]) {
  test(`834 does not hide ${name} behind the focus handover`, () => {
    const input = enhancedCapture();
    alter(input);
    const report = analyzeMarkupObservation(input);
    assert.equal(report.matchesRecordedProducer, false);
    assert.equal(report.matchesExpectedNativeOutput, false);
    assert.equal(report.sourceAdmission, 'unverified');
    assert.match(report.issues.join('\n'), expected);
  });
}

test('834 does not normalize a changed producer or arbitrary focusable pre as a code viewport', () => {
  for (const replace of [
    (fragment) => fragment.replace('proto-previewer__code', 'unrelated-pre'),
    (fragment) => fragment.replace('</pre>', '</pre><script>changed()</script>'),
  ]) {
    const input = enhancedCapture();
    const old = JSON.parse(input.observation.highlightsAttribute).wc;
    const changed = replace(old);
    const highlights = JSON.stringify({ wc: changed, react: changed });
    input.response.html = input.response.html.replace(escapeAttribute(input.observation.highlightsAttribute), escapeAttribute(highlights))
      .replace(`<div data-code-content>${old}</div>`, `<div data-code-content>${changed}</div>`);
    input.observation.highlightsAttribute = highlights;
    input.observation.contentHtml = changed.replace(' tabindex="0"', '');
    input.observation.responseDigest = markupDigest(input.response.html);
    const report = analyzeMarkupObservation(input);
    assert.equal(report.matchesExpectedNativeOutput, false);
    assert.match(report.issues.join('\n'), /unrecognized/);
    assert.equal(report.sourceAdmission, 'unverified');
  }
});

for (const [name, alter, expected] of [
  ['changed producer source', (input) => { input.binding.sources[0].sha256 = markupDigest('changed'); }, /source bytes/],
  ['missing source member', (input) => { input.binding.sources = []; }, /source bytes/],
  ['opaque source inventory', (input) => { input.binding.sources = {}; }, /source inventory/],
  ['unrecognized source member', (input) => { input.binding.sources.push({ path: 'unknown.ts', sha256: markupDigest('unknown') }); }, /unrecognized source/],
  ['duplicate source member', (input) => { input.binding.sources.push(input.binding.sources[0]); }, /duplicated/],
  ['missing capture revision', (input) => { delete input.binding.revision; }, /capture revision/],
  ['missing reference revision', (input) => { delete input.profile.revision; }, /reference revision/],
  ['page.content masquerading as original', (input) => { input.response.kind = 'live-dom-snapshot'; }, /original HTML/],
  ['failed navigation response', (input) => { input.response.status = 500; }, /original HTML/],
  ['non-HTML response', (input) => { input.response.contentType = 'application/json'; }, /original HTML/],
  ['different document lifetime', (input) => { input.observation.responseDigest = markupDigest('old document'); }, /not bound/],
  ['different navigation with identical response bytes', (input) => { input.observation.navigationId = 'supplied-navigation-2'; }, /not bound/],
  ['foreign receiver', (input) => { input.observation.ownerPreviewerId = 'p2'; }, /ownership/],
  ['non-DOM receiver descriptor', (input) => { input.observation.receiverTag = 'business-object'; }, /ownership/],
  ['removed receiver', (input) => { input.observation.connected = false; }, /ownership/],
  ['ambiguous live receivers', (input) => { input.observation.receiverCount = 2; }, /ownership/],
  ['raw-text insertion context', (input) => { input.observation.receiverTag = 'textarea'; }, /insertion context/],
  ['opaque runtime entry', (input) => { input.observation.runtime = 'unknown'; }, /producer output is unavailable/],
  ['mutated snapshot', (input) => { input.observation.contentHtml += '<span>changed</span>'; }, /native output differs/],
  ['mutated producer attribute', (input) => { input.observation.highlightsAttribute = '{}'; }, /producer attributes changed/],
  ['changed raw source map', (input) => { input.observation.codeMapAttribute = '{}'; }, /producer attributes changed/],
  ['opaque runtime markup', (input) => { input.observation.contentHtml = undefined; }, /native output differs/],
  ['foreign response receiver', (input) => { input.observation.previewerId = 'absent'; }, /receiver identity/],
]) {
  test(`834 leaves ${name} unverified`, () => {
    const input = capture();
    alter(input);
    const report = analyzeMarkupObservation(input);
    assert.equal(report.matchesRecordedProducer, false);
    assert.equal(report.sourceAdmission, 'unverified');
    assert.match(report.issues.join('\n'), expected);
  });
}

for (const [name, markup] of [
  ['static icon', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m4 12 5 5 11-11"></path></svg>'],
  ['empty cleanup', ''],
]) {
  test(`834 retains the ${name} equality control without treating snapshots as source proof`, () => {
    assert.equal(markupComparison(markup, markup).matches, true);
    assert.equal(markupComparison(undefined, markup).matches, false);
    assert.equal(markupComparison(markup, `${markup}<span>foreign mutation</span>`).matches, false);
  });
}

for (const entry of [
  '<script src="/dynamic.js"></script>',
  '<img src="/resource.png">',
  '<iframe srcdoc="&lt;button&gt;dynamic&lt;/button&gt;"></iframe>',
  '<link rel="stylesheet" href="/dynamic.css">',
  '<a href="javascript:alert(1)">execute</a>',
  '<span onclick="alert(1)">handler</span>',
  '<span style="background-image:url(/resource.png)">resource</span>',
]) {
  test(`834 rejects an introduced entry even when response and live output agree: ${entry}`, () => {
    const input = capture();
    const original = originalCodePanels(input.response.html)[0];
    const fragments = JSON.parse(original.highlightsAttribute);
    const changed = `${fragments.wc}${entry}`;
    input.response.html = input.response.html.replaceAll(
      escapeAttribute(original.highlightsAttribute),
      escapeAttribute(JSON.stringify({ wc: changed, react: changed }))
    ).replace(`<div data-code-content>${fragments.wc}</div>`, `<div data-code-content>${changed}</div>`);
    input.observation.highlightsAttribute = JSON.stringify({ wc: changed, react: changed });
    input.observation.contentHtml = changed;
    input.observation.responseDigest = markupDigest(input.response.html);
    const report = analyzeMarkupObservation(input);
    assert.equal(report.matchesRecordedProducer, false);
    assert.match(report.issues.join('\n'), /unrecognized/);
    assert.equal(report.sourceAdmission, 'unverified');
  });
}

test('834 a nested previewer cannot lend its receiver to the outer owner', () => {
  const panels = originalCodePanels('<div data-previewer-id="outer"><div data-previewer-id="inner"><div data-code-content>child</div></div></div>');
  assert.equal(panels.find((panel) => panel.id === 'outer').contentCount, 0);
  assert.equal(panels.find((panel) => panel.id === 'inner').contentCount, 1);
});

test('834 opaque highlighter output and changed raw-code serialization stay unrecognized', () => {
  assert.deepEqual(highlightedFragmentIssues(undefined, 'source'), ['producer value is opaque']);
  assert.ok(highlightedFragmentIssues(capture().observation.contentHtml, 'other source').length > 0);
});

test('834 original install command text is independent of a native Copy glyph snapshot', () => {
  const cards = originalInstallCommands('<figure id="install1" data-install-command-card data-active-manager="npm"><div data-site-copy></div><pre data-command-panel="npm"><code data-command>npx &lt;example&gt;\n中文</code></pre><pre data-command-panel="pnpm"><code data-command>pnpm dlx example</code></pre></figure>');
  assert.deepEqual(cards, [{ id: 'install1', activeManager: 'npm', commands: [
    { manager: 'npm', text: 'npx <example>\n中文' }, { manager: 'pnpm', text: 'pnpm dlx example' },
  ] }]);
});
