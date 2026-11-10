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
  assert.equal(report.sourceAdmission, 'unverified');
  assert.equal(report.servedSource, 'unobservable');
  assert.equal(report.nativeRuntime.kind, 'native-runtime-output');
  const [start, end] = report.originalHTML.receiver.sourceRange;
  assert.ok(input.response.html.slice(start, end).startsWith('<div data-previewer-id="p1"'));
  assert.equal(report.originalHTML.receiver.contentCount, 1);
  assert.deepEqual(report.issues, []);
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
