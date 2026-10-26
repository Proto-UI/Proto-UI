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
const out = resolve(process.argv[2] ?? '/tmp/pui-command-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = ['root', 'input', 'input-wrapper', 'content', 'item', 'empty']
  .map((x) => `packages/prototypes/shadcn/src/command/${x}.proto.ts`)
  .concat([
    'packages/prototypes/shadcn/src/command/visual.ts',
    'packages/prototypes/shadcn/src/input-shell/root.proto.ts',
    'packages/prototypes/shadcn/src/input-shell/control.proto.ts',
    'packages/prototypes/shadcn/src/input-shell/context.ts',
    'packages/prototypes/shadcn/src/input-shell/bind-control.ts',
    'packages/prototypes/base/src/search-primitives/family.ts',
  ]);
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles),
  css = renderProtoStyleTokenCss(tokens);
await writeFile(join(out, 'tokens.css'), css);
assert(
  !css.includes('Unsupported Proto UI style tokens'),
  css.match(/[^\n]*Unsupported[^\n]*/g)?.join('\n')
);
await build({
  entryPoints: ['scripts/prototypes/shadcn-command-evidence-app.mjs'],
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
  ':root{--radius:0.625rem;--background:#fff;--foreground:#171717;--popover:#fff;--popover-foreground:#171717;--muted:#f5f5f5;--muted-foreground:#737373;--primary:#171717;--primary-foreground:#fafafa;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5}[data-theme=dark]{--background:#0a0a0a;--foreground:#fafafa;--popover:#171717;--popover-foreground:#fafafa;--muted:#262626;--muted-foreground:#a3a3a3;--primary:#fafafa;--primary-foreground:#171717;--input:#525252;--ring:#737373;--border:#404040}'
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><style>${palette}body{font:14px system-ui;margin:20px;background:var(--pui-background);color:var(--pui-foreground)}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}section{min-width:0}h1{font-size:22px}h2{font-size:16px}@media(max-width:600px){main{grid-template-columns:1fr}}</style></head><body><h1>Public Command and single-control input shell</h1><p>NY compatibility / Rhea · Real adapters · Shared family scope</p><main></main><script type="module" src="app.js"></script></body></html>`
);
const hash = (x) => createHash('sha256').update(x).digest('hex');
const receipt = {
  revision: process.env.EVIDENCE_HEAD_SHA ?? 'local-unpublished',
  upstream: '3d98900e9b73c45f035f8109e9d41ba6a51685e7',
  limitations: [
    'single inline control; no addon/invalid aggregation/block control',
    'text-resize is not browser UI zoom',
    'New York standalone Command compatibility retained, not full upstream anatomy',
  ],
  files: await Promise.all(
    sourceFiles.map(async (path) => ({ path, sha256: hash(await readFile(path)) }))
  ),
  artifacts: await Promise.all(
    ['app.js', 'index.html', 'tokens.css'].map(async (path) => ({
      path,
      sha256: hash(await readFile(join(out, path))),
    }))
  ),
};
if (!process.argv.includes('--build-only')) {
  assert.equal(
    receipt.revision,
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  );
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
}
await writeFile(join(out, 'source.json'), JSON.stringify(receipt, null, 2));
if (process.argv.includes('--build-only')) {
  console.log('Command evidence bundle built');
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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
const observations = [],
  errors = [],
  blockedRequests = [],
  screenshots = [];
const save = () =>
  writeFile(
    join(out, 'observations.json'),
    JSON.stringify(
      { revision: receipt.revision, observations, errors, blockedRequests, screenshots },
      null,
      2
    )
  );
try {
  browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1180, height: 900 },
    serviceWorkers: 'block',
  });
  await context.route('**/*', (r) => {
    if (new URL(r.request().url()).origin === origin) return r.continue();
    blockedRequests.push(r.request().url());
    return r.abort();
  });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const snapshot = () =>
    page.evaluate(() =>
      window.commandEvidence.records.map((r) => {
        const input = r.editor(),
          shell = r.host.querySelector('[data-pui-style~="transition-[color,box-shadow]"]'),
          activeId = input.getAttribute('aria-activedescendant'),
          active = activeId ? document.getElementById(activeId) : null;
        const cs = getComputedStyle(input),
          ss = getComputedStyle(shell);
        return {
          kind: r.kind,
          type: r.type,
          theme: {
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            rootRadiusToken: ss.getPropertyValue('--pui-radius').trim(),
            mdRadiusToken: ss.getPropertyValue('--pui-radius-md').trim(),
          },
          input: {
            width: input.getBoundingClientRect().width,
            font: cs.fontSize,
            radius: cs.borderRadius,
            border: cs.borderTopWidth,
            background: cs.backgroundColor,
            opacity: cs.opacity,
            value: input.value,
            disabled: input.disabled,
            readOnly: input.readOnly,
          },
          shell: {
            radius: ss.borderRadius,
            height: shell.getBoundingClientRect().height,
            border: ss.borderTopWidth,
            shadow: ss.boxShadow,
            ring: ss.getPropertyValue('--pui-ring-width').trim() || '0px',
          },
          active: active
            ? {
                id: activeId,
                text: active.textContent,
                background: getComputedStyle(active).backgroundColor,
                selected: active.getAttribute('aria-selected'),
              }
            : null,
          html: r.host.outerHTML,
        };
      })
    );
  const capture = async (name) => {
    const path = `${name}.png`,
      bytes = await page.screenshot({ path: join(out, path), fullPage: true });
    screenshots.push({ path, sha256: hash(bytes), revision: receipt.revision });
    await save();
  };
  const endpoint = async (test) => {
    const deadline = Date.now() + 2000;
    let facts;
    for (;;) {
      facts = await snapshot();
      try {
        test(facts);
        return facts;
      } catch (error) {
        if (Date.now() >= deadline) {
          observations.push({ stage: 'endpoint-failure', facts });
          await save();
          throw error;
        }
        await page.waitForTimeout(25);
      }
    }
  };
  for (const theme of ['light', 'dark'])
    for (const style of ['new-york-v4', 'rhea']) {
      await page.evaluate(
        ({ theme, style }) => {
          document.documentElement.dataset.theme = theme;
          window.commandEvidence.set({ style, disabled: false, readOnly: false });
        },
        { theme, style }
      );
      const facts = await endpoint((rows) => {
        assert.equal(rows.length, 8);
        for (const r of rows) {
          assert.equal(r.theme.rootFontSize, '16px');
          assert.equal(r.theme.rootRadiusToken, '0.625rem');
          assert.equal(r.theme.mdRadiusToken, 'max(calc(0.625rem - 2px), 0px)');
          assert.equal(r.input.border, '0px');
          assert.equal(r.input.radius, '0px');
          assert.equal(r.shell.radius, style === 'rhea' ? '18px' : '8px');
          assert.equal(r.shell.height, style === 'rhea' ? 32 : 36);
          assert.equal(r.input.font, r.type === 'command' ? '14px' : '14px');
        }
      });
      observations.push({ theme, style, facts });
      await capture(`${theme}-${style}`);
      for (const kind of ['wc', 'react', 'vue', 'vue2']) {
        const section = page.locator(`section[data-runtime="${kind}"][data-consumer="command"]`),
          input = section.locator('input');
        await input.fill('alpha');
        await page.waitForFunction(
          ({ kind }) =>
            window.commandEvidence.records
              .find((r) => r.kind === kind && r.type === 'command')
              .refs.root.getExposes()
              .visibleCount.get() === 1,
          { kind }
        );
        assert.equal(await section.getByRole('option', { name: 'Alpha', exact: true }).count(), 1);
        await input.fill('zzzz');
        await page.waitForFunction(
          ({ kind }) =>
            window.commandEvidence.records
              .find((r) => r.kind === kind && r.type === 'command')
              .refs.root.getExposes()
              .visibleCount.get() === 0,
          { kind }
        );
        assert.equal(await section.getByRole('option').count(), 0);
        assert(await section.getByText('No matching commands', { exact: true }).isVisible());
        await input.fill('');
        await input.press('Home');
        await input.press('ArrowDown');
        const activeFacts = await endpoint((rows) => {
          const r = rows.find((r) => r.kind === kind && r.type === 'command');
          assert.equal(r.active?.text, 'Beta');
          assert.equal(
            r.active.background,
            style === 'rhea'
              ? theme === 'light'
                ? 'rgb(245, 245, 245)'
                : 'rgb(38, 38, 38)'
              : theme === 'light'
                ? 'rgb(23, 23, 23)'
                : 'rgb(250, 250, 250)'
          );
        });
        observations.push({ theme, style, kind, activeFacts });
        const count = await page.evaluate(
          (kind) =>
            window.commandEvidence.records.find((r) => r.kind === kind && r.type === 'command')
              .executions.length,
          kind
        );
        await input.press('Enter');
        await page.waitForFunction(
          ({ kind, count }) =>
            window.commandEvidence.records.find((r) => r.kind === kind && r.type === 'command')
              .executions.length ===
            count + 1,
          { kind, count }
        );
        let result = await page.evaluate(
          ({ kind }) => {
            const r = window.commandEvidence.records.find(
              (r) => r.kind === kind && r.type === 'command'
            );
            return { executions: r.executions, focused: document.activeElement === r.editor() };
          },
          { kind }
        );
        observations.push({ theme, style, kind, keyboard: result });
        await save();
        assert(result.focused);
        assert.equal(result.executions.at(-1).value, 'beta');
        await section.getByRole('option', { name: 'Alpha', exact: true }).click();
        await page.waitForFunction(
          ({ kind, count }) =>
            window.commandEvidence.records.find((r) => r.kind === kind && r.type === 'command')
              .executions.length ===
            count + 2,
          { kind, count }
        );
        result = await page.evaluate(
          (kind) =>
            window.commandEvidence.records.find((r) => r.kind === kind && r.type === 'command')
              .executions,
          kind
        );
        observations.push({ theme, style, kind, pointer: result });
        await save();
        assert.equal(result.at(-1).value, 'alpha');
        assert(result.every((e) => e.value !== 'blocked'));
        await input.focus();
        await input.press('End');
        const disabledSkip = await snapshot();
        observations.push({ theme, style, kind, disabledSkip });
        await save();
        assert.equal(
          disabledSkip.find((r) => r.kind === kind && r.type === 'command').active?.text,
          'Beta'
        );
      }
    }
  // Keyboard navigation uses actual Tab events, not synthetic focusVisible props.
  for (const kind of ['wc', 'react', 'vue', 'vue2'])
    for (const type of ['command', 'input']) {
      const target = page.locator(`section[data-runtime="${kind}"][data-consumer="${type}"] input`);
      for (let i = 0; i < 20 && !(await target.evaluate((e) => document.activeElement === e)); i++)
        await page.keyboard.press('Tab');
      assert(await target.evaluate((e) => document.activeElement === e));
      const focusFacts = await endpoint((rows) => {
        const row = rows.find((r) => r.kind === kind && r.type === type);
        assert.equal(row.shell.ring, type === 'input' ? '3px' : '0px');
      });
      observations.push({ kind, type, keyboardFocus: focusFacts });
      await save();
    }
  for (const kind of ['wc', 'react', 'vue', 'vue2'])
    for (const type of ['command', 'input']) {
      const input = page.locator(`section[data-runtime="${kind}"][data-consumer="${type}"] input`);
      await input.fill('kept');
      await input.evaluate((e) => {
        e.focus();
        e.setSelectionRange(1, 3);
        window.retainedEditor = e;
      });
      await page.evaluate(() => window.commandEvidence.set({ style: 'new-york-v4' }));
      await endpoint((rows) => rows.forEach((r) => assert.equal(r.shell.radius, '8px')));
      const continuity = await input.evaluate((e) => ({
        same: e === window.retainedEditor,
        value: e.value,
        start: e.selectionStart,
        end: e.selectionEnd,
        focused: document.activeElement === e,
      }));
      observations.push({ kind, type, continuity });
      await save();
      assert.deepEqual(continuity, { same: true, value: 'kept', start: 1, end: 3, focused: true });
      await page.evaluate(() => window.commandEvidence.set({ readOnly: true }));
      await page.waitForFunction(() =>
        window.commandEvidence.records.every((r) => r.editor().readOnly)
      );
      await input.press('End');
      await input.press('x');
      assert.equal(await input.inputValue(), 'kept');
      await page.evaluate(() => window.commandEvidence.set({ readOnly: false }));
      await page.waitForFunction(() =>
        window.commandEvidence.records.every((r) => !r.editor().readOnly)
      );
      await page.evaluate(() => window.commandEvidence.set({ disabled: true }));
      await page.waitForFunction(() =>
        window.commandEvidence.records.every((r) => r.editor().disabled)
      );
      await endpoint((rows) => rows.forEach((r) => assert.equal(r.input.opacity, '0.5')));
      await page.evaluate(() => window.commandEvidence.set({ disabled: false, style: 'rhea' }));
      await page.waitForFunction(() =>
        window.commandEvidence.records.every((r) => !r.editor().disabled)
      );
    }
  for (const width of [320, 1180]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await endpoint((rows) => rows.forEach((r) => assert(r.input.width > 0)));
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      rows: window.commandEvidence.records.map((r) => {
        const editor = r.editor(),
          rect = editor.getBoundingClientRect(),
          host = r.host.getBoundingClientRect();
        return {
          kind: r.kind,
          type: r.type,
          left: rect.left,
          right: rect.right,
          parentLeft: host.left,
          parentRight: host.right,
        };
      }),
    }));
    observations.push({ width, textPercent: 200, geometry });
    await capture(`width-${width}-text200`);
    assert(geometry.width <= width + 1);
    for (const r of geometry.rows) {
      assert(r.left >= r.parentLeft - 1);
      assert(r.right <= r.parentRight + 1);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  await save();
} catch (error) {
  let failureScreenshot;
  try {
    if (page) {
      const bytes = await page.screenshot({ path: join(out, 'failure.png'), fullPage: true });
      failureScreenshot = { path: 'failure.png', sha256: hash(bytes) };
    }
  } catch (cause) {
    failureScreenshot = { error: String(cause) };
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
        blockedRequests,
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
