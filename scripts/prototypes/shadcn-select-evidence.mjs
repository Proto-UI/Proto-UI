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
const out = resolve(process.argv[2] ?? '/tmp/pui-shadcn-select-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = [
  ...(await (await import('node:fs/promises')).readdir('packages/prototypes/shadcn/src/select'))
    .filter((p) => p.endsWith('.ts'))
    .map((p) => 'packages/prototypes/shadcn/src/select/' + p),
  ...['root', 'label', 'description', 'error', 'select-trigger'].map(
    (p) => 'packages/prototypes/shadcn/src/field/' + p + '.proto.ts'
  ),
];
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles);
const css = renderProtoStyleTokenCss(tokens);
assert(!css.includes('Unsupported Proto UI style tokens'));
await writeFile(join(out, 'tokens.css'), css);
await build({
  entryPoints: ['scripts/prototypes/shadcn-select-evidence-app.mjs'],
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
  ':root{--radius:0.625rem;--background:#fff;--popover:#fff;--popover-foreground:#171717;--accent:#f5f5f5;--accent-foreground:#171717;--foreground:#171717;--muted-foreground:#737373;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5;--destructive:#dc2626}[data-theme=dark]{--background:#0a0a0a;--popover:#171717;--popover-foreground:#fafafa;--accent:#262626;--accent-foreground:#fafafa;--foreground:#fafafa;--muted-foreground:#a3a3a3;--input:#525252;--ring:#737373;--border:#404040;--destructive:#f87171}'
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><style>${palette}body{font:14px system-ui;margin:24px;background:var(--pui-background);color:var(--pui-foreground)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section{min-width:0}h1{font-size:22px}h2{font-size:16px}</style></head><body><h1>Production Select · New York / Rhea</h1><p>Shared scope · Field invalid · complete public popup anatomy</p><main></main><script type="module" src="app.js"></script></body></html>`
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
  const context = await browser.newContext({ viewport: { width: 1180, height: 900 } });
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
      window.selectEvidence.records.every((r) => r.trigger())
  );
  const enterKeyboardFocus = async (kind) => {
    const kinds = ['wc', 'react', 'vue', 'vue2'],
      index = kinds.indexOf(kind);
    await page.locator('[data-runtime=' + kind + '] [role=combobox]').focus();
    const targetIndex = () =>
      page.evaluate(() =>
        window.selectEvidence.records.map((r) => r.trigger()).indexOf(document.activeElement)
      );
    assert.equal(await targetIndex(), index);
    await page.keyboard.press(index === 3 ? 'Shift+Tab' : 'Tab');
    const neighbor = await targetIndex();
    observations.push({ focusNavigation: { kind, phase: 'neighbor', index: neighbor } });
    assert.equal(neighbor, index === 3 ? 2 : index + 1);
    await page.keyboard.press(index === 3 ? 'Tab' : 'Shift+Tab');
    const restored = await targetIndex();
    observations.push({ focusNavigation: { kind, phase: 'return', index: restored } });
    assert.equal(restored, index);
  };
  const snapshot = async (kind) =>
    page.evaluate((kind) => {
      const record = window.selectEvidence.records.find((r) => r.kind === kind),
        trigger = record.trigger(),
        c = getComputedStyle(trigger);
      const popup = document.getElementById(trigger.getAttribute('aria-controls'));
      const leaf = popup?.querySelector('[data-pui-owned-decoration]'),
        surface = leaf?.parentElement;
      const ref = (color) => {
        const el = document.createElement('span');
        el.style.color = color;
        document.body.append(el);
        const value = getComputedStyle(el).color;
        el.remove();
        return value;
      };
      return {
        kind,
        trigger: {
          height: trigger.getBoundingClientRect().height,
          radius: c.borderRadius,
          font: c.fontSize,
          line: c.lineHeight,
          padding: c.padding,
          border: c.borderColor,
          background: c.backgroundColor,
          shadow: c.boxShadow,
          ring: ref(c.getPropertyValue('--pui-ring-color').trim() || 'transparent'),
          ringWidth: c.getPropertyValue('--pui-ring-width').trim(),
          nativeFocus: trigger.matches(':focus-visible'),
          invalid: trigger.getAttribute('aria-invalid'),
          disabled: trigger.getAttribute('aria-disabled'),
          readonly: trigger.getAttribute('aria-readonly'),
          expanded: trigger.getAttribute('aria-expanded'),
          value: trigger.textContent.trim(),
          glyphOpacity: trigger.querySelector('svg')?.parentElement
            ? getComputedStyle(trigger.querySelector('svg').parentElement).opacity
            : null,
        },
        popup: surface
          ? {
              radius: getComputedStyle(surface).borderRadius,
              minWidth: getComputedStyle(surface).minWidth,
              fill: getComputedStyle(surface).backgroundColor,
              ring: ref(
                getComputedStyle(surface).getPropertyValue('--pui-ring-color').trim() ||
                  'transparent'
              ),
              ringWidth: getComputedStyle(surface).getPropertyValue('--pui-ring-width').trim(),
              shadow: getComputedStyle(surface).boxShadow,
              filter: getComputedStyle(leaf).backdropFilter,
              leafHidden: leaf.getAttribute('aria-hidden'),
              leafChildren: leaf.childNodes.length,
              items: [...popup.querySelectorAll('[role=option]')].map((el) => ({
                text: el.textContent,
                radius: getComputedStyle(el).borderRadius,
                minHeight: getComputedStyle(el).minHeight,
                disabled: el.getAttribute('aria-disabled'),
                selected: el.getAttribute('aria-selected'),
                active: el.hasAttribute('data-active') || el.hasAttribute('data-focused'),
                fill: getComputedStyle(el).backgroundColor,
                opacity: getComputedStyle(el).opacity,
                indicator: !!el.querySelector('svg'),
              })),
            }
          : null,
        expected: {
          accent: ref('var(--pui-accent)'),
          focus30: ref('color-mix(in oklab,var(--pui-ring) 30%,transparent)'),
          focus50: ref('color-mix(in oklab,var(--pui-ring) 50%,transparent)'),
          ring: ref('var(--pui-ring)'),
          destructive: ref('var(--pui-destructive)'),
          destructive50: ref('color-mix(in oklab,var(--pui-destructive) 50%,transparent)'),
          invalid20: ref('color-mix(in oklab,var(--pui-destructive) 20%,transparent)'),
          invalid40: ref('color-mix(in oklab,var(--pui-destructive) 40%,transparent)'),
          popover70: ref('color-mix(in oklab,var(--pui-popover) 70%,transparent)'),
          foreground5: ref('color-mix(in oklab,var(--pui-foreground) 5%,transparent)'),
          foreground10: ref('color-mix(in oklab,var(--pui-foreground) 10%,transparent)'),
        },
      };
    }, kind);
  const observe = async (kind, label, predicate) => {
    const end = Date.now() + 2000;
    let last;
    do {
      last = await snapshot(kind);
      receipt.lastAttempt = { label, ...last };
      if (predicate(last)) {
        observations.push({ label, ...last });
        return last;
      }
      await page.evaluate(() => new Promise(requestAnimationFrame));
    } while (Date.now() < end);
    throw new Error('Exact Select endpoint not reached: ' + kind + ' / ' + label);
  };
  const save = async (name) => {
    const file = join(out, name);
    await page.screenshot({ path: file, fullPage: true });
    receipt.artifacts.push({ path: name, sha256: hash(await readFile(file)) });
  };
  for (const theme of ['light', 'dark'])
    for (const style of ['new-york-v4', 'rhea'])
      for (const size of ['default', 'sm']) {
        await page.evaluate(
          ({ theme, style, size }) => {
            document.documentElement.dataset.theme = theme;
            window.selectEvidence.set(style, false, 'normal', size);
          },
          { theme, style, size }
        );
        for (const kind of ['wc', 'react', 'vue', 'vue2']) {
          const label = [theme, style, size, kind].join('-'),
            locator = page.locator('[data-runtime=' + kind + '] [role=combobox]');
          await observe(
            kind,
            label + '-default',
            (o) =>
              o.trigger.height ===
                (style === 'rhea' ? (size === 'sm' ? 28 : 32) : size === 'sm' ? 32 : 36) &&
              o.trigger.radius === (style === 'rhea' ? '18px' : '8px') &&
              o.trigger.font === '14px' &&
              o.trigger.line === '20px' &&
              o.trigger.glyphOpacity === (style === 'rhea' ? '1' : '0.5') &&
              o.trigger.invalid !== 'true' &&
              o.trigger.expanded === 'false'
          );
          await enterKeyboardFocus(kind);
          await observe(
            kind,
            label + '-focus',
            (o) =>
              o.trigger.nativeFocus &&
              o.trigger.ringWidth === '3px' &&
              o.trigger.ring === (style === 'rhea' ? o.expected.focus30 : o.expected.focus50) &&
              o.trigger.border === o.expected.ring &&
              o.trigger.shadow.includes(o.trigger.ring)
          );
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, true, 'normal', size),
            { kind, style, size }
          );
          await observe(
            kind,
            label + '-invalid-focus',
            (o) =>
              o.trigger.invalid === 'true' &&
              o.trigger.nativeFocus &&
              o.trigger.ringWidth === '3px' &&
              o.trigger.ring === (theme === 'dark' ? o.expected.invalid40 : o.expected.invalid20) &&
              o.trigger.border ===
                (theme === 'dark' && style === 'rhea'
                  ? o.expected.destructive50
                  : o.expected.destructive) &&
              o.trigger.shadow.includes(o.trigger.ring)
          );
          await locator.evaluate((el) => el.blur());
          await observe(
            kind,
            label + '-invalid-blur',
            (o) =>
              !o.trigger.nativeFocus &&
              o.trigger.invalid === 'true' &&
              o.trigger.border ===
                (theme === 'dark' && style === 'rhea'
                  ? o.expected.destructive50
                  : o.expected.destructive) &&
              (style === 'rhea'
                ? o.trigger.ringWidth === '3px' && o.trigger.shadow.includes(o.trigger.ring)
                : o.trigger.ringWidth !== '3px')
          );
          await enterKeyboardFocus(kind);
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, false, 'normal', size),
            { kind, style, size }
          );
          await observe(
            kind,
            label + '-cleared',
            (o) =>
              o.trigger.invalid !== 'true' &&
              o.trigger.nativeFocus &&
              o.trigger.ringWidth === '3px' &&
              o.trigger.ring === (style === 'rhea' ? o.expected.focus30 : o.expected.focus50) &&
              o.trigger.shadow.includes(o.trigger.ring)
          );
          await page.keyboard.press('ArrowDown');
          const opened = await observe(
            kind,
            label + '-popup',
            (o) =>
              o.trigger.expanded === 'true' &&
              !!o.popup &&
              o.popup.radius === (style === 'rhea' ? '18px' : '8px') &&
              (style !== 'rhea' ||
                (o.popup.filter === 'blur(40px) saturate(1.5)' &&
                  o.popup.fill === o.expected.popover70 &&
                  o.popup.ring ===
                    (theme === 'dark' ? o.expected.foreground10 : o.expected.foreground5)))
          );
          assert.equal(opened.popup.leafHidden, 'true');
          assert.equal(opened.popup.leafChildren, 0);
          assert.equal(opened.popup.items.length, 3);
          assert(opened.popup.items.every((i) => i.radius === (style === 'rhea' ? '14px' : '6px')));
          assert.equal(opened.popup.items[2].disabled, 'true');
          assert.equal(opened.popup.items[2].opacity, '0.5');
          assert.equal(opened.popup.items[0].selected, 'true');
          assert.equal(opened.popup.items[0].indicator, true);
          if (style === 'rhea') assert(opened.popup.items.every((i) => i.minHeight === '28px'));
          await observe(kind, label + '-active-item', (o) =>
            o.popup.items.some(
              (i) =>
                i.active &&
                i.fill === (style === 'rhea' ? o.expected.foreground10 : o.expected.accent)
            )
          );
          assert.equal(opened.trigger.value, 'alpha');
          await page.evaluate((kind) => {
            const record = window.selectEvidence.records.find((r) => r.kind === kind);
            const trigger = record.trigger(),
              popup = document.getElementById(trigger.getAttribute('aria-controls'));
            record.identity = {
              trigger,
              leaf: popup.querySelector('[data-pui-owned-decoration]'),
              options: [...popup.querySelectorAll('[role=option]')],
              focus: document.activeElement,
            };
            if (record.identity.options.length !== 3)
              throw new Error('Open Select must retain all three caller options');
            if (record.identity.focus === document.body)
              throw new Error('Open Select has no real focused node');
          }, kind);
          for (const nextStyle of [style === 'rhea' ? 'new-york-v4' : 'rhea', style]) {
            await page.evaluate(
              ({ kind, nextStyle, size }) =>
                window.selectEvidence.records
                  .find((r) => r.kind === kind)
                  .set(nextStyle, false, 'normal', size),
              { kind, nextStyle, size }
            );
            await observe(
              kind,
              label + '-live-' + nextStyle,
              (o) =>
                o.trigger.expanded === 'true' &&
                o.trigger.value === 'alpha' &&
                o.popup?.radius === (nextStyle === 'rhea' ? '18px' : '8px') &&
                (nextStyle === 'rhea'
                  ? o.popup.filter === 'blur(40px) saturate(1.5)'
                  : o.popup.filter === 'none')
            );
            const stable = await page.evaluate((kind) => {
              const record = window.selectEvidence.records.find((r) => r.kind === kind),
                old = record.identity,
                trigger = record.trigger(),
                popup = document.getElementById(trigger.getAttribute('aria-controls'));
              return {
                trigger: trigger === old.trigger,
                leaf: popup.querySelector('[data-pui-owned-decoration]') === old.leaf,
                options:
                  old.options.length === 3 &&
                  popup.querySelectorAll('[role=option]').length === old.options.length &&
                  [...popup.querySelectorAll('[role=option]')].every(
                    (el, i) => el === old.options[i]
                  ),
                focus: document.activeElement === old.focus,
              };
            }, kind);
            assert.deepEqual(stable, { trigger: true, leaf: true, options: true, focus: true });
          }
          // Exercise the public Surface prop on the default adapters, not only inherited scope.
          // An unchanged decoration blueprint must retain its bound leaf and caller-owned options.
          for (const surfaceStyle of ['new-york', 'rhea', 'inherit']) {
            await page.evaluate(
              ({ kind, surfaceStyle }) => {
                window.selectEvidence.records
                  .find((r) => r.kind === kind)
                  .setSurfaceStyle(surfaceStyle);
              },
              { kind, surfaceStyle }
            );
            const projectedStyle = surfaceStyle === 'inherit' ? style : surfaceStyle;
            await observe(
              kind,
              label + '-surface-prop-' + surfaceStyle,
              (o) =>
                o.trigger.expanded === 'true' &&
                o.trigger.value === 'alpha' &&
                o.popup?.radius === (projectedStyle === 'rhea' ? '18px' : '8px') &&
                o.popup.filter === (projectedStyle === 'rhea' ? 'blur(40px) saturate(1.5)' : 'none')
            );
            const stable = await page.evaluate((kind) => {
              const record = window.selectEvidence.records.find((r) => r.kind === kind),
                old = record.identity,
                trigger = record.trigger(),
                popup = document.getElementById(trigger.getAttribute('aria-controls'));
              return {
                trigger: trigger === old.trigger,
                leaf: popup.querySelector('[data-pui-owned-decoration]') === old.leaf,
                options:
                  old.options.length === 3 &&
                  popup.querySelectorAll('[role=option]').length === old.options.length &&
                  [...popup.querySelectorAll('[role=option]')].every(
                    (el, i) => el === old.options[i]
                  ),
                focus: document.activeElement === old.focus,
              };
            }, kind);
            assert.deepEqual(stable, { trigger: true, leaf: true, options: true, focus: true });
          }
          await save(label + '-popup.png');
          await page.keyboard.press('ArrowDown');
          await observe(kind, label + '-active-beta', (o) =>
            o.popup?.items.some((i) => i.text.trim() === 'beta' && i.active)
          );
          await page.keyboard.press('Enter');
          await observe(
            kind,
            label + '-selected-beta',
            (o) => o.trigger.expanded === 'false' && o.trigger.value === 'beta'
          );
          await page.keyboard.press('ArrowDown');
          await observe(kind, label + '-reopen-beta', (o) => o.trigger.expanded === 'true');
          await page.keyboard.press('Home');
          await observe(kind, label + '-active-alpha', (o) =>
            o.popup?.items.some((i) => i.text.trim() === 'alpha' && i.active)
          );
          await page.keyboard.press('Enter');
          await observe(
            kind,
            label + '-restore-alpha',
            (o) => o.trigger.expanded === 'false' && o.trigger.value === 'alpha'
          );
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, false, 'disabled', size),
            { kind, style, size }
          );
          await observe(kind, label + '-disabled', (o) => o.trigger.disabled === 'true');
          await locator.press('ArrowDown');
          await observe(
            kind,
            label + '-disabled-stays-closed',
            (o) => o.trigger.expanded === 'false' && o.trigger.disabled === 'true'
          );
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, false, 'normal', size),
            { kind, style, size }
          );
          await observe(kind, label + '-restored', (o) => o.trigger.disabled === 'false');
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, false, 'readonly', size),
            { kind, style, size }
          );
          const readonly = await observe(
            kind,
            label + '-readonly',
            (o) => o.trigger.readonly === 'true' && o.trigger.disabled === 'false'
          );
          await locator.focus();
          await page.keyboard.press('ArrowDown');
          await observe(
            kind,
            label + '-readonly-inspection',
            (o) => o.trigger.expanded === 'true' && o.trigger.readonly === 'true'
          );
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          await observe(
            kind,
            label + '-readonly-keeps-value',
            (o) => o.trigger.value === readonly.trigger.value && o.trigger.readonly === 'true'
          );
          await page.keyboard.press('Escape');
          await observe(kind, label + '-readonly-closed', (o) => o.trigger.expanded === 'false');
          await page.evaluate(
            ({ kind, style, size }) =>
              window.selectEvidence.records
                .find((r) => r.kind === kind)
                .set(style, false, 'normal', size),
            { kind, style, size }
          );
        }
        await save([theme, style, size, 'all.png'].join('-'));
      }
  assert.deepEqual(errors, []);
  receipt.observations = observations;
  receipt.pageErrors = errors;
  receipt.consoleErrors = consoleErrors;
  receipt.failedRequests = failedRequests;
  await writeFile(join(out, 'metrics.json'), JSON.stringify(receipt, null, 2));
} catch (error) {
  if (page)
    try {
      await page.screenshot({ path: join(out, 'failure.png'), fullPage: true });
      receipt.artifacts.push({
        path: 'failure.png',
        sha256: hash(await readFile(join(out, 'failure.png'))),
      });
    } catch {}
  await writeFile(
    join(out, 'failure.json'),
    JSON.stringify(
      {
        ...receipt,
        observations,
        pageErrors: errors,
        consoleErrors,
        failedRequests,
        error: String(error),
      },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser?.close();
  server.close();
}
