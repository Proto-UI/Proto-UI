import assert from 'node:assert/strict';
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
const out = resolve(process.argv[2] ?? '/tmp/pui-shadcn-card-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = [
  'packages/prototypes/shadcn/src/card/root.proto.ts',
  'packages/prototypes/shadcn/src/card/header.proto.ts',
  'packages/prototypes/shadcn/src/card/content.proto.ts',
  'packages/prototypes/shadcn/src/card/footer.proto.ts',
  'packages/prototypes/shadcn/src/card/visual.ts',
  'packages/prototypes/shadcn/src/text/root.proto.ts',
  'packages/prototypes/base/src/text/root.proto.ts',
  'packages/prototypes/shadcn/src/textarea/visual.ts',
];
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles);
const css = renderProtoStyleTokenCss(tokens);
assert(!css.includes('Unsupported Proto UI style tokens'));
await writeFile(join(out, 'tokens.css'), css);
await build({
  entryPoints: ['scripts/prototypes/shadcn-card-evidence-app.mjs'],
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
  ':root{--radius:0.625rem;--card:#fff;--card-foreground:#171717;--background:#fff;--foreground:#171717;--muted-foreground:#737373;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5;--destructive:#dc2626}[data-theme=dark]{--card:#171717;--card-foreground:#fafafa;--background:#0a0a0a;--foreground:#fafafa;--muted-foreground:#a3a3a3;--input:#525252;--ring:#737373;--border:#404040;--destructive:#f87171}'
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><style>${palette}body{font:14px system-ui;margin:24px;background:var(--pui-background);color:var(--pui-foreground)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section{min-width:0}h1{font-size:22px}h2{font-size:16px}h3{margin:0}</style></head><body><h1>Public Card · New York / Rhea</h1><p>Inherited scope · Passive parts · Native child ownership</p><main></main><script type="module" src="app.js"></script></body></html>`
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
  const context = await browser.newContext({ viewport: { width: 1180, height: 850 } });
  await context.route('**/*', (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort()
  );
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), failure: r.failure() }));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.ready === 'true' &&
      window.cardEvidence.records.every((r) => r.editor())
  );
  async function snapshot() {
    return page.evaluate(() =>
      window.cardEvidence.records.map((r) => {
        const card = r.host.querySelector('[data-pui-style~="bg-card"]'),
          header = r.host.querySelector('[data-pui-style~="grid"]'),
          anchor = r.host.querySelector('a'),
          editor = r.editor(),
          parts = [...r.host.querySelectorAll('[data-pui-style]')],
          footer = parts.find(
            (e) =>
              e.getAttribute('data-pui-style').split(/\s+/).includes('items-center') &&
              e.contains(anchor)
          ),
          content = parts.find(
            (e) => e.contains(editor) && /\bpx-[456]\b/.test(e.getAttribute('data-pui-style'))
          );
        const root = getComputedStyle(card),
          head = getComputedStyle(header),
          body = getComputedStyle(content),
          foot = getComputedStyle(footer);
        const oracle = document.createElement('div');
        oracle.style.color = `color-mix(in oklab, var(--pui-foreground) ${document.documentElement.dataset.theme === 'dark' ? 10 : 5}%, transparent)`;
        document.body.append(oracle);
        const ringExpected = getComputedStyle(oracle).color;
        oracle.style.color = root.getPropertyValue('--pui-ring-color');
        const ringActual = getComputedStyle(oracle).color;
        oracle.remove();
        return {
          kind: r.kind,
          radius: root.borderRadius,
          py: root.paddingTop,
          gap: root.rowGap,
          border: root.borderTopWidth,
          shadow: root.boxShadow,
          ringWidth: root.getPropertyValue('--pui-ring-width').trim(),
          ringActual,
          ringExpected,
          font: root.fontSize,
          color: root.color,
          background: root.backgroundColor,
          header: {
            px: head.paddingLeft,
            gap: head.rowGap,
            pb: head.paddingBottom,
            border: head.borderBottomWidth,
            radius: head.borderTopLeftRadius,
          },
          content: { px: body.paddingLeft },
          footer: {
            px: foot.paddingLeft,
            pt: foot.paddingTop,
            border: foot.borderTopWidth,
            radius: foot.borderBottomLeftRadius,
          },
          role: card.getAttribute('role'),
          tabIndex: card.tabIndex,
          anchor: anchor.getAttribute('href'),
          editorRadius: getComputedStyle(editor).borderRadius,
        };
      })
    );
  }
  async function observeExact(observation, verify) {
    const deadline = Date.now() + 3000;
    for (;;) {
      observation.values = await snapshot();
      try {
        verify(observation.values);
        return;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await page.waitForTimeout(20);
      }
    }
  }
  for (const theme of ['light', 'dark'])
    for (const style of ['new-york', 'rhea'])
      for (const size of style === 'rhea' ? ['default', 'sm'] : ['default'])
        for (const divider of [false, true]) {
          await page.evaluate(
            ({ theme, style, size, divider }) => {
              document.documentElement.dataset.theme = theme;
              window.cardEvidence.set(style, undefined, size, divider);
            },
            { theme, style, size, divider }
          );
          const observation = { theme, style, size, divider, values: [] };
          observations.push(observation);
          await observeExact(observation, (values) => {
            const space = style === 'new-york' ? '24px' : size === 'sm' ? '16px' : '20px';
            for (const v of values) {
              assert.equal(v.radius, style === 'rhea' ? '24px' : '14px');
              assert.equal(
                v.background,
                theme === 'dark' ? 'rgb(23, 23, 23)' : 'rgb(255, 255, 255)'
              );
              assert.equal(v.color, theme === 'dark' ? 'rgb(250, 250, 250)' : 'rgb(23, 23, 23)');
              assert.equal(v.py, space);
              assert.equal(v.gap, space);
              for (const p of [v.header, v.content, v.footer]) assert.equal(p.px, space);
              assert.equal(v.header.gap, style === 'rhea' ? '6px' : '8px');
              assert.equal(v.header.pb, divider ? space : '0px');
              assert.equal(v.footer.pt, divider ? space : '0px');
              assert.equal(v.header.border, divider ? '1px' : '0px');
              assert.equal(v.footer.border, divider ? '1px' : '0px');
              assert.equal(v.border, style === 'rhea' ? '0px' : '1px');
              assert.equal(v.role, null);
              assert.equal(v.tabIndex, -1);
              assert.equal(v.anchor, '#native-action');
              assert.notEqual(v.shadow, 'none');
              if (style === 'rhea') {
                assert.equal(v.ringWidth, '1px');
                assert.equal(v.ringActual, v.ringExpected);
                assert(v.shadow.includes(v.ringActual));
                assert.equal(v.font, '14px');
                assert.equal(v.header.radius, '24px');
                assert.equal(v.footer.radius, '24px');
                assert.equal(v.editorRadius, '18px');
              } else {
                assert.notEqual(v.ringWidth, '1px');
                assert.equal(v.editorRadius, '8px');
              }
            }
          });
          await page.screenshot({
            path: join(out, `${theme}-${style}-${size}-${divider ? 'dividers' : 'plain'}.png`),
            fullPage: true,
          });
          if (style === 'rhea' && size === 'sm' && divider) {
            // Scope and child props are separate public updates. Do not briefly ask a
            // New York Card to keep Rhea-only sm while transitioning to the next theme.
            await page.evaluate(() => window.cardEvidence.set('rhea', undefined, 'default', true));
            const transition = { theme, style, step: 'restore-common-density', values: [] };
            observations.push(transition);
            await observeExact(transition, (values) => {
              for (const v of values) {
                assert.equal(v.radius, '24px');
                assert.equal(v.py, '20px');
                assert.equal(v.gap, '20px');
                for (const part of [v.header, v.content, v.footer]) assert.equal(part.px, '20px');
                assert.equal(v.header.pb, '20px');
                assert.equal(v.footer.pt, '20px');
              }
            });
          }
        }
  for (const base of [2, 10, 32]) {
    await page.evaluate((base) => {
      document.documentElement.style.setProperty('--pui-radius', `${base}px`);
      window.cardEvidence.set('rhea', undefined);
    }, base);
    const observation = { base, values: [] };
    observations.push(observation);
    await observeExact(observation, (values) => {
      for (const v of values) {
        const expected = `${Math.min(base + 16, 24)}px`;
        assert.equal(v.radius, expected);
        assert.equal(v.header.radius, expected);
        assert.equal(v.footer.radius, expected);
      }
    });
  }
  await page.evaluate(() => document.documentElement.style.removeProperty('--pui-radius'));
  for (const kind of ['wc', 'react', 'vue', 'vue2']) {
    const editor = page.locator(`section[data-runtime="${kind}"] textarea`);
    await editor.fill('kept value');
    await editor.focus();
    await editor.evaluate((e) => {
      window.keptEditor = e;
      e.setSelectionRange(1, 4);
    });
    await page.evaluate(() => window.cardEvidence.set('new-york', undefined));
    await page.waitForFunction(() =>
      window.cardEvidence.records.every(
        (r) =>
          getComputedStyle(r.host.querySelector('[data-pui-style~="bg-card"]')).borderRadius ===
          '14px'
      )
    );
    const continuity = await editor.evaluate((e) => ({
      same: e === window.keptEditor,
      value: e.value,
      start: e.selectionStart,
      end: e.selectionEnd,
      focused: document.activeElement === e,
    }));
    observations.push({ kind, continuity });
    assert(continuity.same && continuity.focused);
    assert.equal(continuity.value, 'kept value');
    assert.equal(continuity.start, 1);
    assert.equal(continuity.end, 4);
    await page.evaluate(() => window.cardEvidence.set('new-york', 'rhea'));
    await page.waitForFunction(() =>
      window.cardEvidence.records.every(
        (r) =>
          getComputedStyle(r.host.querySelector('[data-pui-style~="bg-card"]')).borderRadius ===
          '24px'
      )
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, 'observations.json'),
    JSON.stringify({ revision: receipt.revision, observations, errors }, null, 2)
  );
} catch (error) {
  let screenshot;
  let readiness;
  if (page) {
    try {
      readiness = await page.evaluate(() => ({
        ready: document.documentElement.dataset.ready,
        records: window.cardEvidence?.records.map((r) => ({
          kind: r.kind,
          editor: !!r.editor(),
          html: r.host.innerHTML,
        })),
        sections: [...document.querySelectorAll('section')].map((s) => ({
          runtime: s.dataset.runtime,
          html: s.innerHTML,
        })),
      }));
      const b = await page.screenshot({ path: join(out, 'failure.png'), fullPage: true });
      screenshot = { path: 'failure.png', sha256: hash(b) };
    } catch (e) {
      screenshot = { error: String(e) };
    }
  }
  await writeFile(
    join(out, 'failure.json'),
    JSON.stringify(
      {
        revision: receipt.revision,
        error: String(error),
        screenshot,
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
  await new Promise((r) => server.close(r));
}
