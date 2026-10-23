import assert from 'node:assert/strict';
import { containsExpectedRingShadow } from './shadcn-textarea-shadow-oracle.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { build } from 'esbuild';
import { collectProtoStyleTokensFromFiles } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import {
  renderProtoStyleTokenCss,
  renderPrefixedThemeCss,
} from '../../packages/cli/src/services/proto-style-css.ts';
const out = resolve(process.argv[2] ?? '/tmp/pui-shadcn-textarea-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = [
  'packages/prototypes/shadcn/src/textarea/visual.ts',
  'packages/prototypes/shadcn/src/field/root.proto.ts',
  'packages/prototypes/shadcn/src/field/label.proto.ts',
  'packages/prototypes/shadcn/src/field/description.proto.ts',
  'packages/prototypes/shadcn/src/field/error.proto.ts',
];
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles);
const css = renderProtoStyleTokenCss(tokens);
assert(!css.includes('Unsupported Proto UI style tokens'));
await writeFile(join(out, 'tokens.css'), css);
await build({
  entryPoints: ['scripts/prototypes/shadcn-textarea-evidence-app.mjs'],
  outfile: join(out, 'app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  define: {
    'process.env.NODE_ENV': '"production"',
    '__VUE_OPTIONS_API__': 'true',
    '__VUE_PROD_DEVTOOLS__': 'false',
    '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
  },
});
const palette = renderPrefixedThemeCss(
  ':root{--radius:0.625rem;--background:#fff;--foreground:#171717;--muted-foreground:#737373;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5;--destructive:#dc2626}[data-theme=dark]{--background:#0a0a0a;--foreground:#fafafa;--muted-foreground:#a3a3a3;--input:#525252;--ring:#737373;--border:#404040;--destructive:#f87171}'
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><style>${palette}body{font:14px system-ui;margin:24px;background:var(--pui-background);color:var(--pui-foreground)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section{min-width:0}h1{font-size:22px}h2{font-size:16px}</style></head><body><h1>Production Textarea · New York / Rhea</h1><p>Shared scope · Field-owned invalid · native intrinsic sizing</p><main></main><script type="module" src="app.js"></script></body></html>`
);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const receipt = {
  revision: process.env.EVIDENCE_HEAD_SHA ?? 'local-unpublished',
  upstream: '3d98900e9b73c45f035f8109e9d41ba6a51685e7',
  cssSha256: hash(css),
  paletteSha256: hash(palette),
  artifacts: await Promise.all(
    ['app.js', 'index.html'].map(async (path) => ({
      path,
      sha256: hash(await readFile(join(out, path))),
    }))
  ),
  files: await Promise.all(
    sourceFiles.map(async (path) => ({ path, sha256: hash(await readFile(path)) }))
  ),
  tokens,
};
if (!process.argv.includes('--build-only'))
  assert.equal(
    receipt.revision,
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  );
await writeFile(join(out, 'source.json'), JSON.stringify(receipt, null, 2));
if (process.argv.includes('--build-only')) {
  console.log(JSON.stringify(receipt));
  process.exit(0);
}
const { launchBrowser } = await import('../../apps/www/src/content/docs/zh-cn/browser-harness.ts');
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = resolve(out, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(out + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'content-type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ??
        'application/octet-stream'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
const observations = [];
const errors = [];
const consoleErrors = [];
const failedRequests = [];
try {
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 767, height: 1000 } });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  );
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) =>
    failedRequests.push({ url: request.url(), failure: request.failure() })
  );
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.ready === 'true' &&
      window.textareaEvidence.records.every((r) => r.editor())
  );
  for (const theme of ['light', 'dark'])
    for (const style of ['new-york', 'rhea'])
      for (const width of [767, 768]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          ({ theme, style }) => {
            document.documentElement.dataset.theme = theme;
            window.textareaEvidence.set(style, false);
          },
          { theme, style }
        );
        await page.waitForFunction(
          ({ style, width }) =>
            window.textareaEvidence.records.every((r) => {
              const c = getComputedStyle(r.editor());
              return (
                c.fontSize === (width >= 768 ? '14px' : '16px') &&
                c.borderRadius === (style === 'rhea' ? '18px' : '8px')
              );
            }),
          { style, width }
        );
        await page.waitForTimeout(240);
        const values = await page.evaluate(() =>
          window.textareaEvidence.records.map((r) => {
            const e = r.editor(),
              c = getComputedStyle(e);
            return {
              kind: r.kind,
              font: c.fontSize,
              line: c.lineHeight,
              radius: c.borderRadius,
              px: c.paddingLeft,
              resize: c.resize,
              fieldSizing: c.fieldSizing,
              shadow: c.boxShadow,
              placeholder: getComputedStyle(e, '::placeholder').color,
              value: e.value,
              invalid: e.getAttribute('aria-invalid'),
            };
          })
        );
        for (const v of values) {
          assert.equal(v.font, width >= 768 ? '14px' : '16px');
          assert.equal(v.px, style === 'rhea' ? '10px' : '12px');
          assert.equal(v.resize, style === 'rhea' ? 'none' : 'vertical');
          assert.equal(v.fieldSizing, 'content');
          if (style === 'rhea') assert.equal(v.shadow, 'none');
          assert.equal(
            v.placeholder,
            theme === 'dark' ? 'rgb(163, 163, 163)' : 'rgb(115, 115, 115)'
          );
        }
        observations.push({ theme, style, width, values });
        await page.screenshot({
          path: join(out, `${theme}-${style}-${width}.png`),
          fullPage: true,
        });
      }
  // Verify the original native tab order and keep the focus-visible entry inside
  // the document. The last control has no next in-document focus target.
  const focusTrace = async (kind, phase) => {
    const trace = await page.evaluate(
      ({ kind, phase }) => {
        const editors = window.textareaEvidence.records.map((r) => r.editor());
        const active = document.activeElement;
        return {
          kind,
          phase,
          documentFocused: document.hasFocus(),
          activeIndex: editors.indexOf(active),
          activeTag: active?.tagName,
          activeRole: active?.getAttribute('role'),
          activeTabIndex: active?.tabIndex,
          editors: editors.map((e) => ({
            kind: e.closest('section')?.dataset.runtime,
            tabIndex: e.tabIndex,
            disabled: e.disabled,
            connected: e.isConnected,
          })),
        };
      },
      { kind, phase }
    );
    observations.push({ focusNavigation: trace });
    return trace;
  };
  const enterKeyboardFocus = async (kind) => {
    const kinds = ['wc', 'react', 'vue', 'vue2'],
      index = kinds.indexOf(kind);
    const editor = page.locator(`section[data-runtime="${kind}"] textarea`);
    await editor.focus();
    const before = await focusTrace(kind, 'before-in-document-entry');
    assert.equal(before.activeIndex, index);
    assert(before.editors.every((e) => e.connected && !e.disabled && e.tabIndex === 0));
    await page.keyboard.press(index === 3 ? 'Shift+Tab' : 'Tab');
    const neighbor = await focusTrace(kind, 'keyboard-neighbor');
    assert.equal(
      neighbor.activeIndex,
      index === 3 ? 2 : index + 1,
      'native DOM tab neighbor must match the original editor order'
    );
    await page.keyboard.press(index === 3 ? 'Tab' : 'Shift+Tab');
    const restored = await focusTrace(kind, 'keyboard-return');
    assert.equal(restored.activeIndex, index, 'native keyboard return must target the same editor');
  };
  // Resolve the actually applied ring variable through the browser's color parser,
  // Compare painted geometry/color against an independent box-shadow oracle.
  // Color and shadow serialization can differ in their final decimal places;
  // both sides of the paint comparison must use the same CSS property.
  async function observeState(kind, expectedBorder, expectedRing, wanted) {
    const attempt = { kind, wanted, expectedBorder, expectedRing };
    observations.push({ paintAttempt: attempt });
    const deadline = Date.now() + 240;
    do {
      const sampled = await page.locator(`section[data-runtime="${kind}"] textarea`).evaluate(
        (e, expected) => {
          const c = getComputedStyle(e),
            actual = document.createElement('div'),
            oracle = document.createElement('div');
          actual.style.color = c.getPropertyValue('--pui-ring-color');
          oracle.style.color = expected.ring || 'transparent';
          oracle.style.borderColor = expected.border;
          oracle.style.boxShadow = `0 0 0 3px ${expected.ring || 'transparent'}`;
          document.body.append(actual, oracle);
          const result = {
            kind: expected.kind,
            focused: document.activeElement === e,
            nativeFocus: e.matches(':focus-visible'),
            invalid: e.getAttribute('aria-invalid'),
            disabled: e.disabled,
            readOnly: e.readOnly,
            border: c.borderColor,
            expectedBorder: getComputedStyle(oracle).borderColor,
            ringColor: getComputedStyle(actual).color,
            expectedRing: getComputedStyle(oracle).color,
            expectedRingShadow: getComputedStyle(oracle).boxShadow,
            ringWidth: c.getPropertyValue('--pui-ring-width').trim(),
            shadow: c.boxShadow,
            opacity: c.opacity,
          };
          actual.remove();
          oracle.remove();
          return result;
        },
        { kind, border: expectedBorder, ring: expectedRing }
      );
      attempt.observed = sampled;
      if (
        sampled.border === sampled.expectedBorder &&
        (!expectedRing || sampled.ringColor === sampled.expectedRing) &&
        sampled.focused === wanted.focused &&
        (!wanted.focused || sampled.nativeFocus) &&
        (sampled.invalid === 'true') === wanted.invalid &&
        sampled.disabled === (wanted.mode === 'disabled') &&
        sampled.readOnly === (wanted.mode === 'readonly') &&
        (wanted.ringVisible
          ? sampled.ringWidth === '3px' &&
            containsExpectedRingShadow(sampled.shadow, sampled.expectedRingShadow)
          : sampled.ringWidth !== '3px') &&
        (wanted.mode !== 'disabled' || sampled.opacity === '0.5')
      )
        return sampled;
      if (Date.now() < deadline) await page.waitForTimeout(Math.min(16, deadline - Date.now()));
    } while (Date.now() < deadline);
    throw new Error(
      `${kind}: complete paint/state endpoint not reached within 240ms; see recorded paintAttempt`
    );
  }
  for (const theme of ['light', 'dark'])
    for (const style of ['new-york', 'rhea'])
      for (const mode of ['normal', 'readonly', 'disabled'])
        for (const invalid of [false, true]) {
          await page.evaluate(
            ({ theme, style, mode, invalid }) => {
              document.documentElement.dataset.theme = theme;
              window.textareaEvidence.records.forEach((r) => r.editor().blur());
              window.textareaEvidence.set(style, invalid, mode);
            },
            { theme, style, mode, invalid }
          );
          await page.waitForFunction(
            ({ mode, invalid }) =>
              window.textareaEvidence.records.every(
                (r) =>
                  r.editor().disabled === (mode === 'disabled') &&
                  r.editor().readOnly === (mode === 'readonly') &&
                  (r.editor().getAttribute('aria-invalid') === 'true') === invalid
              ),
            { mode, invalid },
            { timeout: 240 }
          );
          for (const kind of ['wc', 'react', 'vue', 'vue2'])
            for (const focused of mode === 'disabled' ? [false] : [false, true]) {
              const editor = page.locator(`section[data-runtime="${kind}"] textarea`);
              if (focused) {
                await enterKeyboardFocus(kind);
              } else await editor.evaluate((e) => e.blur());

              const border = invalid
                ? theme === 'dark' && style === 'rhea'
                  ? 'color-mix(in oklab, var(--pui-destructive) 50%, transparent)'
                  : 'var(--pui-destructive)'
                : focused
                  ? 'var(--pui-ring)'
                  : style === 'rhea'
                    ? 'transparent'
                    : 'var(--pui-input)';
              const ring = invalid
                ? `color-mix(in oklab, var(--pui-destructive) ${theme === 'dark' ? 40 : 20}%, transparent)`
                : focused
                  ? `color-mix(in oklab, var(--pui-ring) ${style === 'rhea' ? 30 : 50}%, transparent)`
                  : null;
              const observed = await observeState(kind, border, ring, {
                focused,
                mode,
                invalid,
                ringVisible: focused || (invalid && style === 'rhea'),
              });
              assert.equal(observed.focused, focused);
              if (focused) assert.equal(observed.nativeFocus, true);
              assert.equal(observed.disabled, mode === 'disabled');
              assert.equal(observed.readOnly, mode === 'readonly');
              assert.equal(observed.border, observed.expectedBorder);
              if (ring) assert.equal(observed.ringColor, observed.expectedRing);
              if (focused || (invalid && style === 'rhea')) {
                assert.equal(observed.ringWidth, '3px');
                assert(
                  containsExpectedRingShadow(observed.shadow, observed.expectedRingShadow),
                  `${kind}: actual painted ring color`
                );
              } else assert.notEqual(observed.ringWidth, '3px');
              if (mode === 'disabled') assert.equal(observed.opacity, '0.5');
              observations.push({ theme, style, mode, invalid, focused, observed });
              if (theme === 'dark' && style === 'rhea' && mode === 'normal' && invalid && focused)
                await page.screenshot({
                  path: join(out, `dark-rhea-${kind}-focused-invalid.png`),
                  fullPage: true,
                });
              if (invalid && focused) {
                await page.evaluate(
                  ({ style, mode }) => window.textareaEvidence.set(style, false, mode),
                  { style, mode }
                );

                const cleared = await observeState(
                  kind,
                  'var(--pui-ring)',
                  `color-mix(in oklab, var(--pui-ring) ${style === 'rhea' ? 30 : 50}%, transparent)`,
                  { focused: true, mode, invalid: false, ringVisible: true }
                );
                assert.equal(cleared.ringColor, cleared.expectedRing);
                assert.equal(cleared.border, cleared.expectedBorder);
                assert.equal(cleared.focused, true);
                assert.equal(cleared.nativeFocus, true);
                assert.equal(cleared.ringWidth, '3px');
                assert(
                  containsExpectedRingShadow(cleared.shadow, cleared.expectedRingShadow),
                  `${kind}: restored painted focus ring`
                );
                observations.push({ cleared });
                await page.evaluate(
                  ({ style, mode }) => window.textareaEvidence.set(style, true, mode),
                  { style, mode }
                );
              }
            }
        }
  await page.evaluate(() => {
    window.textareaEvidence.records.forEach((r) => r.editor().blur());
    document.documentElement.dataset.theme = 'dark';
    window.textareaEvidence.set('rhea', true);
  });

  await page.waitForFunction(() =>
    window.textareaEvidence.records.every((r) => r.editor().getAttribute('aria-invalid') === 'true')
  );
  await page.waitForTimeout(240);
  const invalid = await page.evaluate(() => {
    const oracle = document.createElement('div');
    oracle.style.borderColor = 'color-mix(in oklab, var(--pui-destructive) 50%, transparent)';
    document.body.append(oracle);
    const expected = getComputedStyle(oracle).borderColor;
    oracle.remove();
    return window.textareaEvidence.records.map((r) => ({
      kind: r.kind,
      border: getComputedStyle(r.editor()).borderColor,
      shadow: getComputedStyle(r.editor()).boxShadow,
      expected,
    }));
  });
  for (const v of invalid) {
    assert.equal(v.border, v.expected);
    assert.notEqual(v.shadow, 'none');
  }
  observations.push({ invalid });
  await page.screenshot({ path: join(out, 'dark-rhea-field-invalid.png'), fullPage: true });
  await page.evaluate(() => window.textareaEvidence.set('rhea', false));
  await page.waitForTimeout(240);
  for (const kind of ['wc', 'react', 'vue', 'vue2']) {
    const editor = page.locator(`section[data-runtime="${kind}"] textarea`);
    await editor.fill('one');
    const before = await editor.evaluate((e) => e.getBoundingClientRect().height);
    await editor.fill(Array.from({ length: 12 }, (_, i) => `Line ${i}`).join('\n'));
    const after = await editor.evaluate((e) => e.getBoundingClientRect().height);
    assert(after > before, `${kind}: native intrinsic content growth`);
    await enterKeyboardFocus(kind);
    assert(
      await editor.evaluate((e) => document.activeElement === e && e.matches(':focus-visible')),
      `${kind}: real keyboard focus-visible entry`
    );
    await editor.evaluate((e) => {
      window.keptEditor = e;
      e.setSelectionRange(2, 6);
    });
    await page.evaluate(() => window.textareaEvidence.set('new-york', false));
    await page.waitForTimeout(240);
    const stable = await editor.evaluate((e) => ({
      same: e === window.keptEditor,
      value: e.value,
      start: e.selectionStart,
      end: e.selectionEnd,
      focused: document.activeElement === e,
      nativeFocus: e.matches(':focus-visible'),
      ring: getComputedStyle(e).getPropertyValue('--pui-ring-shadow').trim(),
      shadow: getComputedStyle(e).boxShadow,
    }));
    assert(stable.same && stable.focused);
    assert.equal(stable.start, 2);
    assert.equal(stable.end, 6);
    assert(stable.value.includes('Line 11'));
    assert.equal(stable.nativeFocus, true);
    assert.notEqual(stable.shadow, 'none');
    assert(
      stable.ring.includes('3px'),
      `${kind}: visible focus ring is not merely the New York base shadow`
    );
    observations.push({ kind, before, after, stable });
    await page.evaluate(() => window.textareaEvidence.set('rhea', false));
    await page.waitForTimeout(240);
  }
  // Preserve the original last-control navigation as diagnostics after the
  // acceptance matrix, so leaving the page cannot poison later input routing.
  const lastEditor = page.locator('section[data-runtime="vue2"] textarea');
  await lastEditor.focus();
  await focusTrace('vue2', 'original-last-before');
  await page.keyboard.press('Tab');
  await focusTrace('vue2', 'original-last-after-Tab');
  await page.keyboard.press('Shift+Tab');
  await focusTrace('vue2', 'original-last-after-ShiftTab');
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, 'observations.json'),
    JSON.stringify({ revision: receipt.revision, observations, errors }, null, 2)
  );
} catch (error) {
  let failureScreenshot;
  let readiness;
  if (page) {
    try {
      readiness = await page.evaluate(() => ({
        ready: document.documentElement.dataset.ready,
        documentFocused: document.hasFocus(),
        activeElement: document.activeElement?.outerHTML,
        records: window.textareaEvidence?.records.map((r) => ({
          kind: r.kind,
          editor: !!r.editor(),
          html: r.host.innerHTML,
        })),
        sections: [...document.querySelectorAll('section')].map((s) => ({
          runtime: s.dataset.runtime,
          html: s.innerHTML,
        })),
      }));
      const bytes = await page.screenshot({ path: join(out, 'failure.png'), fullPage: true });
      failureScreenshot = { path: 'failure.png', sha256: hash(bytes) };
    } catch (captureError) {
      failureScreenshot = { error: String(captureError) };
    }
  }
  await writeFile(
    join(out, 'failure.json'),
    JSON.stringify(
      {
        revision: receipt.revision,
        error: String(error),
        failureScreenshot,
        observations,
        errors,
        consoleErrors,
        failedRequests,
        readiness,
      },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
