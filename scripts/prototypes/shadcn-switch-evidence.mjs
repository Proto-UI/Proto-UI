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
const out = resolve(process.argv[2] ?? '/tmp/pui-shadcn-switch-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = [
  ...(await (await import('node:fs/promises')).readdir('packages/prototypes/shadcn/src/switch'))
    .filter((p) => p.endsWith('.ts'))
    .map((p) => 'packages/prototypes/shadcn/src/switch/' + p),
  ...['root', 'label', 'switch'].map(
    (p) => 'packages/prototypes/shadcn/src/field/' + p + '.proto.ts'
  ),
];
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles);
const css = renderProtoStyleTokenCss(tokens);
assert(!css.includes('Unsupported Proto UI style tokens'));
await writeFile(join(out, 'tokens.css'), css);
await build({
  entryPoints: ['scripts/prototypes/shadcn-switch-evidence-app.mjs'],
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
  ':root{--radius:0.625rem;--primary:#171717;--primary-foreground:#fafafa;--background:#fff;--popover:#fff;--popover-foreground:#171717;--accent:#f5f5f5;--accent-foreground:#171717;--foreground:#171717;--muted-foreground:#737373;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5;--destructive:#dc2626}[data-theme=dark]{--primary:#fafafa;--primary-foreground:#171717;--background:#0a0a0a;--popover:#171717;--popover-foreground:#fafafa;--accent:#262626;--accent-foreground:#fafafa;--foreground:#fafafa;--muted-foreground:#a3a3a3;--input:#525252;--ring:#737373;--border:#404040;--destructive:#f87171}'
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><style>${palette}body{font:14px system-ui;margin:24px;background:var(--pui-background);color:var(--pui-foreground)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section{min-width:0}h1{font-size:22px}h2{font-size:16px}</style></head><body><h1>Production Switch · New York / Rhea</h1><p>Shared scope · Field invalid · ordinary sibling FieldLabel anatomy</p><main></main><script type="module" src="app.js"></script></body></html>`
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
      window.switchEvidence.records.length === 4 &&
      window.switchEvidence.records.every((r) => r.controls().length === 2)
  );
  const snapshot = (kind, index = 0) =>
    page.evaluate(
      ({ kind, index }) => {
        const record = window.switchEvidence.records.find((r) => r.kind === kind),
          root = record.controls()[index],
          thumb = root.firstElementChild;
        const c = getComputedStyle(root),
          t = getComputedStyle(thumb),
          box = root.getBoundingClientRect();
        const probe = document.createElement('span');
        document.body.append(probe);
        const color = (value) => {
          probe.style.color = value;
          return getComputedStyle(probe).color;
        };
        const ringShadow = (value) => {
          probe.style.boxShadow = '0 0 0 3px ' + value;
          return getComputedStyle(probe).boxShadow;
        };
        const result = {
          kind,
          index,
          requestedProps: record.requestedProps(),
          wcRawProps: record.rawProps(root),
          nativeDraggable: root.draggable,
          draggableAttribute: root.getAttribute('draggable'),
          rootTokens: root.getAttribute('data-pui-style'),
          thumbTokens: thumb.getAttribute('data-pui-style'),
          nativeTrace: window.nativeDragTrace ?? [],
          contactStart: window.nativeDragStart ?? null,
          width: box.width,
          height: box.height,
          radius: c.borderRadius,
          borderWidth: c.borderTopWidth,
          border: c.borderTopColor,
          bg: c.backgroundColor,
          shadow: c.boxShadow,
          percentage: Number.parseFloat(t.getPropertyValue('--pui-percentage')),
          dragging: thumb.hasAttribute('data-dragging'),
          thumbWidth: thumb.getBoundingClientRect().width,
          thumbOffset: thumb.getBoundingClientRect().left - box.left,
          thumbShadow: t.boxShadow,
          thumbClip: t.backgroundClip,
          thumbRadius: t.borderRadius,
          thumbBg: t.backgroundColor,
          translate: t.translate,
          transition: t.transitionProperty,
          duration: t.transitionDuration,
          checked: root.getAttribute('aria-checked'),
          invalid: root.getAttribute('aria-invalid'),
          disabled: root.getAttribute('aria-disabled'),
          readOnly: root.getAttribute('aria-readonly'),
          focused: document.activeElement === root,
          nativeFocus: root.matches(':focus-visible'),
          hit: root.hasAttribute('data-pui-static-hit'),
          expected: {
            ring30: ringShadow('color-mix(in oklab,var(--pui-ring) 30%,transparent)'),
            ring50: ringShadow('color-mix(in oklab,var(--pui-ring) 50%,transparent)'),
            invalid20: ringShadow('color-mix(in oklab,var(--pui-destructive) 20%,transparent)'),
            invalid40: ringShadow('color-mix(in oklab,var(--pui-destructive) 40%,transparent)'),
            primary: color('var(--pui-primary)'),
            foreground: color('var(--pui-foreground)'),
            background: color('var(--pui-background)'),
            primaryForeground: color('var(--pui-primary-foreground)'),
            input: color('var(--pui-input)'),
            input80: color('color-mix(in oklab,var(--pui-input) 80%,transparent)'),
            input90: color('color-mix(in oklab,var(--pui-input) 90%,transparent)'),
            ring: color('var(--pui-ring)'),
            destructive: color('var(--pui-destructive)'),
            destructive50: color('color-mix(in oklab,var(--pui-destructive) 50%,transparent)'),
          },
        };
        probe.remove();
        return result;
      },
      { kind, index }
    );
  const hasRing = (shadow, expected) => {
    let depth = 0,
      start = 0;
    const layers = [];
    for (let i = 0; i < shadow.length; i++) {
      if (shadow[i] === '(') depth++;
      else if (shadow[i] === ')') {
        depth--;
        if (depth < 0) return false;
      } else if (shadow[i] === ',' && depth === 0) {
        layers.push(shadow.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (depth !== 0) return false;
    layers.push(shadow.slice(start).trim());
    return layers.includes(expected);
  };
  const observe = async (kind, label, predicate, index = 0) => {
    const deadline = Date.now() + 2000;
    do {
      const o = await snapshot(kind, index);
      receipt.lastAttempt = { label, observed: o };
      if (predicate(o)) {
        observations.push(receipt.lastAttempt);
        return o;
      }
      await page.waitForTimeout(20);
    } while (Date.now() < deadline);
    throw new Error(
      'Switch endpoint not reached: ' + label + '\n' + JSON.stringify(receipt.lastAttempt)
    );
  };
  const focus = async (kind) => {
    const control = page.locator(`[data-runtime=${kind}] [role=switch]`).nth(0);
    await control.focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate((kind) => {
        const r = window.switchEvidence.records.find((r) => r.kind === kind);
        return document.activeElement === r.controls()[1];
      }, kind),
      true
    );
    await page.keyboard.press('Shift+Tab');
    await observe(kind, 'keyboard-focus', (o) => o.focused && o.nativeFocus);
  };
  const save = async (name) => {
    await page.screenshot({ path: join(out, name), fullPage: true });
    receipt.artifacts.push({ path: name, sha256: hash(await readFile(join(out, name))) });
  };
  for (const theme of ['light', 'dark'])
    for (const profile of ['new-york-v4', 'rhea'])
      for (const size of ['default', 'sm']) {
        await page.evaluate(
          ({ theme, profile, size }) => {
            document.documentElement.dataset.theme = theme;
            window.switchEvidence.set({
              profile,
              size,
              own: 'inherit',
              invalid: false,
              disabled: false,
              readOnly: false,
            });
          },
          { theme, profile, size }
        );
        for (const kind of ['wc', 'react', 'vue', 'vue2']) {
          const prefix = [theme, profile, size, kind].join('/');
          const height = profile === 'rhea' ? (size === 'sm' ? 16 : 20) : size === 'sm' ? 14 : 18.4,
            width = size === 'sm' ? 24 : 32;
          await observe(
            kind,
            prefix + '/geometry',
            (o) =>
              Math.abs(o.height - height) < 0.01 &&
              o.width === width &&
              o.radius === (profile === 'rhea' ? '18px' : '9999px') &&
              o.thumbWidth === (size === 'sm' ? 12 : 16) &&
              o.borderWidth === (profile === 'rhea' ? '2px' : '1px') &&
              (profile !== 'rhea' || o.shadow === 'none') &&
              o.thumbRadius === (profile === 'rhea' ? '18px' : '9999px') &&
              o.hit === (profile === 'rhea')
          );
          // Native input outside the plain control's border box distinguishes actual
          // Rhea acquisition from a token/marker-only assertion.
          const plainBefore = await snapshot(kind, 1);
          const plainBox = await page
            .locator(`[data-runtime=${kind}] [role=switch]`)
            .nth(1)
            .boundingBox();
          await page.mouse.click(plainBox.x + plainBox.width + 6, plainBox.y + plainBox.height / 2);
          if (profile === 'rhea')
            await observe(
              kind,
              prefix + '/expanded-hit',
              (o) => o.checked !== plainBefore.checked,
              1
            );
          else {
            await page.waitForTimeout(240);
            assert.equal((await snapshot(kind, 1)).checked, plainBefore.checked);
          }
          await focus(kind);
          await page.evaluate((kind) => {
            const r = window.switchEvidence.records.find((r) => r.kind === kind);
            r.saved = { root: r.controls()[0], thumb: r.controls()[0].firstElementChild };
          }, kind);
          for (let toggle = 0; toggle < 2; toggle++) {
            const before = await snapshot(kind);
            await page.keyboard.press('Space');
            await observe(
              kind,
              prefix + '/trusted-space-' + toggle,
              (o) =>
                o.checked !== before.checked &&
                o.focused &&
                o.nativeFocus &&
                Math.abs(
                  o.thumbOffset -
                    (o.checked === 'true'
                      ? width - (profile === 'rhea' ? 2 : 1) - o.thumbWidth
                      : profile === 'rhea'
                        ? 2
                        : 1)
                ) < 0.1
            );
          }
          for (const invalid of [true, false]) {
            await page.evaluate(
              ({ kind, invalid }) =>
                window.switchEvidence.records.find((r) => r.kind === kind).set({ invalid }),
              { kind, invalid }
            );
            await page.waitForTimeout(240);
            await observe(
              kind,
              prefix + '/invalid-' + invalid,
              (o) =>
                o.invalid === String(invalid) &&
                hasRing(
                  o.shadow,
                  invalid && profile === 'rhea'
                    ? theme === 'dark'
                      ? o.expected.invalid40
                      : o.expected.invalid20
                    : profile === 'rhea'
                      ? o.expected.ring30
                      : o.expected.ring50
                ) &&
                o.focused &&
                o.nativeFocus &&
                o.border ===
                  (invalid && profile === 'rhea'
                    ? theme === 'dark'
                      ? o.expected.destructive50
                      : o.expected.destructive
                    : o.expected.ring)
            );
          }
          for (const mode of ['readOnly', 'disabled']) {
            const before = await snapshot(kind);
            await page.evaluate(
              ({ kind, mode }) =>
                window.switchEvidence.records.find((r) => r.kind === kind).set({ [mode]: true }),
              { kind, mode }
            );
            await observe(
              kind,
              prefix + '/' + mode + '-committed',
              (o) =>
                (mode === 'readOnly'
                  ? o.readOnly === 'true' && o.focused
                  : o.disabled === 'true') && o.hit === (profile === 'rhea')
            );
            if (mode === 'readOnly') await page.keyboard.press('Space');
            else {
              const box = await page
                .locator(`[data-runtime=${kind}] [role=switch]`)
                .nth(0)
                .boundingBox();
              await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              if (profile === 'rhea')
                await page.mouse.click(box.x + box.width + 6, box.y + box.height / 2);
            }
            // Do not accept the already-equal initial value before press delivery.
            await page.waitForTimeout(240);
            await observe(
              kind,
              prefix + '/' + mode + '-gate',
              (o) =>
                o.checked === before.checked &&
                o.hit === (profile === 'rhea') &&
                (mode === 'readOnly' ? o.readOnly === 'true' && o.focused : o.disabled === 'true')
            );
            assert.equal(
              await page.evaluate((kind) => {
                const r = window.switchEvidence.records.find((r) => r.kind === kind);
                return (
                  r.controls()[0] === r.saved.root &&
                  r.controls()[0].firstElementChild === r.saved.thumb
                );
              }, kind),
              true
            );
            await page.evaluate(
              ({ kind, mode }) =>
                window.switchEvidence.records.find((r) => r.kind === kind).set({ [mode]: false }),
              { kind, mode }
            );
            await observe(kind, prefix + '/' + mode + '-released', (o) =>
              mode === 'readOnly' ? o.readOnly === 'false' : o.disabled === 'false'
            );
          }
          await focus(kind);
          await page.evaluate(
            (kind) =>
              window.switchEvidence.records
                .find((r) => r.kind === kind)
                .set({ own: 'new-york-v4' }),
            kind
          );
          await observe(
            kind,
            prefix + '/explicit-NY',
            (o) => o.radius === '9999px' && !o.hit && o.focused && o.nativeFocus
          );
          await page.evaluate(
            (kind) =>
              window.switchEvidence.records.find((r) => r.kind === kind).set({ own: 'inherit' }),
            kind
          );
          await observe(
            kind,
            prefix + '/inherit-restored',
            (o) => o.hit === (profile === 'rhea') && o.focused && o.nativeFocus
          );
          assert.equal(
            await page.evaluate((kind) => {
              const r = window.switchEvidence.records.find((r) => r.kind === kind);
              return (
                r.controls()[0] === r.saved.root &&
                r.controls()[0].firstElementChild === r.saved.thumb
              );
            }, kind),
            true
          );
          await observe(
            kind,
            prefix + '/final-background',
            (painted) =>
              painted.thumbBg ===
                (theme === 'dark'
                  ? painted.checked === 'true'
                    ? painted.expected.primaryForeground
                    : painted.expected.foreground
                  : painted.expected.background) &&
              (profile !== 'rhea' ||
                (painted.thumbShadow !== 'none' &&
                  (theme === 'dark' || painted.thumbClip === 'padding-box'))) &&
              painted.bg ===
                (painted.checked === 'true'
                  ? painted.expected.primary
                  : profile === 'rhea'
                    ? painted.expected.input90
                    : theme === 'dark'
                      ? painted.expected.input80
                      : painted.expected.input)
          );
        }
        await save(`${theme}-${profile}-${size}.png`);
      }
  // Native mouse displacement and capture, not injected percentage/state.
  // The existing endpoint matrix above remains default draggable=false.
  for (const font of [16, 32])
    for (const profile of ['new-york-v4', 'rhea'])
      for (const size of ['default', 'sm'])
        for (const direction of ['ltr', 'rtl']) {
          await page.evaluate(
            ({ font, profile, size, direction }) => {
              document.documentElement.style.fontSize = font + 'px';
              document.documentElement.dataset.theme = 'light';
              window.switchEvidence.set({
                profile,
                size,
                direction,
                draggable: true,
                own: 'inherit',
                invalid: false,
                disabled: false,
                readOnly: false,
              });
            },
            { font, profile, size, direction }
          );
          for (const kind of ['wc', 'react', 'vue', 'vue2']) {
            const control = page.locator(`[data-runtime=${kind}] [role=switch]`).nth(1);
            if ((await control.getAttribute('aria-checked')) === 'true') await control.click();
            const label = `native-drag/${font}/${profile}/${size}/${direction}/${kind}`;
            const start = await observe(
              kind,
              label + '/settled',
              (o) => {
                const border = Number.parseFloat(o.borderWidth);
                const origin = direction === 'rtl' ? o.width - o.thumbWidth - border : border;
                return (
                  o.checked === 'false' &&
                  o.percentage === 0 &&
                  !o.dragging &&
                  o.width === ((size === 'sm' ? 24 : 32) * font) / 16 &&
                  o.thumbWidth === ((size === 'sm' ? 12 : 16) * font) / 16 &&
                  border === (profile === 'rhea' ? 2 : 1) &&
                  o.thumbOffset === origin
                );
              },
              1
            );
            const travel =
              start.width - start.thumbWidth - 2 * Number.parseFloat(start.borderWidth);
            assert(travel > 0, 'native layout must provide positive thumb travel');
            const box = await control.boundingBox();
            assert(box);
            const x = box.x + start.thumbOffset + start.thumbWidth / 2;
            const y = box.y + box.height / 2;
            const sign = direction === 'rtl' ? -1 : 1;
            const before = await page.evaluate((kind) => {
              const r = window.switchEvidence.records.find((r) => r.kind === kind);
              const root = r.controls()[1];
              window.nativeDragDispose?.();
              window.nativeDragTrace = [];
              const handlers = [];
              for (const type of [
                'pointerdown',
                'pointermove',
                'pointerup',
                'pointercancel',
                'gotpointercapture',
                'lostpointercapture',
                'dragstart',
                'dragend',
              ]) {
                const listener = (e) => {
                  const thumb = root.firstElementChild;
                  window.nativeDragTrace.push({
                    type,
                    trusted: e.isTrusted,
                    pointerId: e.pointerId,
                    pointerType: e.pointerType,
                    primary: e.isPrimary,
                    button: e.button,
                    buttons: e.buttons,
                    x: e.clientX,
                    y: e.clientY,
                    prevented: e.defaultPrevented,
                    capture: e.pointerId !== undefined && root.hasPointerCapture(e.pointerId),
                    target: e.target.tagName,
                    path: e
                      .composedPath()
                      .slice(0, 5)
                      .map((n) => n.tagName ?? n.nodeName),
                    percentage: getComputedStyle(thumb).getPropertyValue('--pui-percentage'),
                    dragging: thumb.hasAttribute('data-dragging'),
                    rootWidth: root.getBoundingClientRect().width,
                    thumbWidth: thumb.getBoundingClientRect().width,
                  });
                };
                root.addEventListener(type, listener);
                handlers.push([type, listener]);
              }
              window.nativeDragDispose = () =>
                handlers.forEach(([type, fn]) => root.removeEventListener(type, fn));
              return r.events.length;
            }, kind);
            await page.evaluate(
              ({ x, y, travel, kind }) => {
                const target = document.elementFromPoint(x, y);
                window.nativeDragStart = {
                  x,
                  y,
                  travel,
                  kind,
                  target: target?.tagName,
                  targetRole: target?.getAttribute('role'),
                  targetDraggable: target?.draggable,
                };
              },
              { x, y, travel, kind }
            );
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + (sign * travel) / 2, y, { steps: 4 });
            const middle = await observe(
              kind,
              label + '/interior',
              (o) =>
                o.dragging &&
                o.checked === 'false' &&
                Math.abs(o.percentage - 50) < 1 &&
                o.transition === 'none' &&
                Math.abs(o.thumbOffset - start.thumbOffset - (sign * travel) / 2) < 0.75,
              1
            );
            assert(middle.dragging);
            const capture = await page.evaluate((kind) => {
              const r = window.switchEvidence.records.find((r) => r.kind === kind);
              const down = window.nativeDragTrace.find((e) => e.type === 'pointerdown');
              return {
                captured: !!down && r.controls()[1].hasPointerCapture(down.pointerId),
                changes: r.events.length,
                trace: window.nativeDragTrace,
              };
            }, kind);
            assert.equal(capture.captured, true, label + ' native pointer capture');
            assert.equal(capture.changes, before, label + ' preview is not truth');
            assert(
              capture.trace.every((e) => e.trusted),
              label + ' trusted native events'
            );
            // Release outside the Root: actual pointer capture must preserve ownership.
            await page.mouse.move(x + sign * (travel + box.width), y, { steps: 4 });
            await page.mouse.up();
            await observe(
              kind,
              label + '/committed',
              (o) =>
                o.checked === 'true' &&
                !o.dragging &&
                o.percentage === 100 &&
                Math.abs(o.thumbOffset - start.thumbOffset - sign * travel) < 0.75,
              1
            );
            const after = await page.evaluate(
              (kind) => window.switchEvidence.records.find((r) => r.kind === kind).events.length,
              kind
            );
            assert.equal(after, before + 1, label + ' exactly one change including native click');
          }
          await save(`drag-${font}-${profile}-${size}-${direction}.png`);
        }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '16px';
    window.switchEvidence.set({ draggable: false, direction: 'ltr' });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const kind of ['wc', 'react', 'vue', 'vue2'])
    await observe(kind, 'reduced-motion', (o) => o.transition === 'none');
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
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
