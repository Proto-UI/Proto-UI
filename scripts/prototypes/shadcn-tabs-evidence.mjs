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
const out = resolve(process.argv[2] ?? '/tmp/pui-shadcn-tabs-evidence');
await mkdir(out, { recursive: true });
const sourceFiles = [
  'root.proto.ts',
  'list.proto.ts',
  'trigger.proto.ts',
  'content.proto.ts',
  'visual.ts',
].map((x) => resolve('packages/prototypes/shadcn/src/tabs', x));
const tokens = await collectProtoStyleTokensFromFiles(sourceFiles);
const css = renderProtoStyleTokenCss(tokens);
assert(!css.includes('Unsupported Proto UI style tokens'));
await writeFile(join(out, 'tokens.css'), css);
await build({
  entryPoints: ['scripts/prototypes/shadcn-tabs-evidence-app.ts'],
  outfile: join(out, 'app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
});
const palette = renderPrefixedThemeCss(
  `:root{--radius:0.5rem;--background:#fff;--foreground:#171717;--muted:#f5f5f5;--muted-foreground:#737373;--input:#e5e5e5;--ring:#a3a3a3;--border:#e5e5e5}[data-theme=dark]{--background:#0a0a0a;--foreground:#fafafa;--muted:#262626;--muted-foreground:#a3a3a3;--input:#525252;--ring:#737373;--border:#404040}`
);
await writeFile(
  join(out, 'index.html'),
  `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><title>Source-bound production Tabs</title><style>${palette}body{font:14px system-ui;margin:32px;color:var(--pui-foreground);background:var(--pui-background)}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}section{border:1px solid var(--pui-border);border-radius:12px;padding:20px}h1{font-size:24px}h2{font-size:18px}h3{font-size:12px;text-transform:uppercase;margin-top:32px;color:var(--pui-muted-foreground)}p{color:var(--pui-muted-foreground)}</style></head><body><h1>Production Tabs · shared style scope</h1><p>Text/default only · New York retained · Nova and Rhea · neutral consumer palette</p><main></main><p>Upstream line and SVG/icon surfaces remain unsupported. This is not full Tabs or all-style parity.</p><script type="module" src="app.js"></script></body></html>`
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// These assertions bind the color oracle to static upstream declarations, not an
// execution of React/Base UI or the upstream CSS. The palette is a consumer input.
const coverage = JSON.parse(
  await readFile('internal/fixtures/shadcn-tabs-style/coverage.json', 'utf8')
);
const oracleSources = [];
for (const filename of ['base-tabs.tsx.txt', 'new-york-v4-tabs.tsx.txt']) {
  const source = await readFile(`internal/fixtures/shadcn-tabs-style/${filename}`, 'utf8');
  const expected = coverage.sources.find((x) => x.storagePath === filename);
  assert.equal(hash(source), expected.sha256);
  const active = filename.startsWith('base') ? 'data-active' : 'data-[state=active]';
  const required = [
    'text-foreground/60',
    'hover:text-foreground',
    'dark:text-muted-foreground',
    'focus-visible:border-ring',
    'focus-visible:ring-ring/50',
    'focus-visible:outline-1',
    'focus-visible:outline-ring',
    'disabled:pointer-events-none',
    'disabled:opacity-50',
    `${active}:bg-background`,
    `${active}:text-foreground`,
    `dark:${active}:border-input`,
    `dark:${active}:bg-input/30`,
  ];
  for (const token of required)
    assert(source.includes(token), `Missing source color/state token: ${token}`);
  oracleSources.push({ storagePath: filename, sha256: hash(source), requiredTokens: required });
}
const rheaSource = await readFile(
  'internal/fixtures/shadcn-style-source/upstream/apps/v4/registry/styles/style-rhea.css',
  'utf8'
);
assert(
  rheaSource.split('/* MARK: Tabs */')[1].split('/* MARK:')[0].includes('border-transparent!')
);
const receipt = {
  revision:
    process.env.EVIDENCE_HEAD_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceFiles: await Promise.all(
    sourceFiles.map(async (p) => ({
      path: p.slice(process.cwd().length + 1),
      sha256: hash(await readFile(p)),
    }))
  ),
  oracleSources,
  rheaCssSha256: hash(rheaSource),
  colorOracle:
    'Fixed-source semantic tokens under the same neutral consumer palette; independent CSS color resolution, not upstream runtime parity',
  bundleSha256: hash(await readFile(join(out, 'app.js'))),
  cssSha256: hash(css),
  paletteSha256: hash(palette),
  htmlSha256: hash(await readFile(join(out, 'index.html'))),
  scope:
    'text/default; Web Components; neutral consumer palette; not full upstream/browser-family parity',
};
if (!process.argv.includes('--build-only'))
  assert.equal(
    receipt.revision,
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    'Evidence revision must equal the checkout'
  );
await writeFile(join(out, 'source.json'), JSON.stringify(receipt, null, 2) + '\n');
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
let browser;
let page;
const observations = [];
const progress = [];
let pendingExpectation = null;
try {
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 820 } });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  );
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const theme of ['light', 'dark']) {
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    // Observe actual transition completion instead of sampling an interpolated
    // radius after a fixed number of frames. Keep the exact geometry oracle.
    const waitGeometry = () =>
      page.waitForFunction(() =>
        window.tabsEvidence.records.every(
          (r) =>
            getComputedStyle(r.triggers[0]).borderRadius ===
              (r.style === 'rhea' ? '16px' : '6px') &&
            (r.orientation !== 'horizontal' ||
              r.list.getBoundingClientRect().height === (r.style === 'new-york-v4' ? 36 : 32))
        )
      );
    await waitGeometry();
    const matrix = await page.evaluate(() =>
      window.tabsEvidence.records.map((r) => ({
        style: r.style,
        orientation: r.orientation,
        height: r.list.getBoundingClientRect().height,
        radius: getComputedStyle(r.triggers[0]).borderRadius,
        selected: r.triggers[0].getExposes().selected.get(),
        color: getComputedStyle(r.triggers[0]).backgroundColor,
      }))
    );
    for (const row of matrix) {
      assert.equal(row.selected, true);
      assert.equal(row.radius, row.style === 'rhea' ? '16px' : '6px');
      if (row.orientation === 'horizontal')
        assert.equal(row.height, row.style === 'new-york-v4' ? 36 : 32);
    }
    const oracle = await page.evaluate(() => {
      const resolveColor = (value) => {
        const node = document.createElement('span');
        node.style.color = value;
        document.body.append(node);
        const result = getComputedStyle(node).color;
        node.remove();
        return result;
      };
      return Object.fromEntries(
        Object.entries({
          background: 'var(--pui-background)',
          foreground: 'var(--pui-foreground)',
          inactive: 'color-mix(in oklab, var(--pui-foreground) 60%, transparent)',
          muted: 'var(--pui-muted)',
          mutedForeground: 'var(--pui-muted-foreground)',
          input: 'var(--pui-input)',
          input30: 'color-mix(in oklab, var(--pui-input) 30%, transparent)',
          ring: 'var(--pui-ring)',
          ring50: 'color-mix(in oklab, var(--pui-ring) 50%, transparent)',
          transparent: 'transparent',
        }).map(([key, value]) => [key, resolveColor(value)])
      );
    });
    const interaction = [];
    const settle = async (i, trigger, property, expected) => {
      pendingExpectation = { theme, i, trigger, property, expected };
      await page.waitForFunction(
        ({ i, trigger, property, expected }) =>
          getComputedStyle(window.tabsEvidence.records[i].triggers[trigger])[property] === expected,
        { i, trigger, property, expected }
      );
      progress.push(pendingExpectation);
      pendingExpectation = null;
    };
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i],
        first = page.locator('shadcn-tabs-trigger').nth(i * 3),
        second = page.locator('shadcn-tabs-trigger').nth(i * 3 + 1),
        disabled = page.locator('shadcn-tabs-trigger').nth(i * 3 + 2);
      await page.mouse.move(8, 8);
      await settle(i, 0, 'backgroundColor', theme === 'dark' ? oracle.input30 : oracle.background);
      await settle(i, 0, 'color', oracle.foreground);
      await settle(i, 1, 'color', theme === 'dark' ? oracle.mutedForeground : oracle.inactive);
      await settle(
        i,
        0,
        'borderTopColor',
        theme === 'dark' && row.style !== 'rhea' ? oracle.input : oracle.transparent
      );
      const listColor = await page.evaluate(
        (i) => getComputedStyle(window.tabsEvidence.records[i].list).backgroundColor,
        i
      );
      assert.equal(listColor, oracle.muted);
      await second.hover();
      await settle(i, 1, 'color', oracle.foreground);
      await page.mouse.move(8, 8);
      await first.click();
      await page.keyboard.press(row.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight');
      await page.waitForFunction(
        (i) => document.activeElement === window.tabsEvidence.records[i].triggers[1],
        i
      );
      assert.equal(
        await page.evaluate((i) => window.tabsEvidence.records[i].root.getExposes().value.get(), i),
        'account',
        'Manual arrow navigation must not activate'
      );
      await settle(i, 1, 'outlineWidth', '1px');
      await settle(i, 1, 'outlineColor', oracle.ring);
      await settle(i, 1, 'borderTopColor', row.style === 'rhea' ? oracle.transparent : oracle.ring);
      const focus = await second.evaluate((node) => ({
        native: node.matches(':focus-visible'),
        shadow: getComputedStyle(node).boxShadow,
      }));
      assert.equal(focus.native, true);
      assert(focus.shadow.includes('3px'));
      assert(focus.shadow.includes(oracle.ring50));
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        (i) => window.tabsEvidence.records[i].root.getExposes().value.get() === 'password',
        i
      );
      await settle(i, 1, 'backgroundColor', theme === 'dark' ? oracle.input30 : oracle.background);
      const box = await disabled.boundingBox();
      assert(box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const disabledState = await disabled.evaluate((node) => ({
        opacity: getComputedStyle(node).opacity,
        pointerEvents: getComputedStyle(node).pointerEvents,
        focused: document.activeElement === node,
      }));
      assert.deepEqual(disabledState, { opacity: '0.5', pointerEvents: 'none', focused: false });
      assert.equal(
        await page.evaluate((i) => window.tabsEvidence.records[i].root.getExposes().value.get(), i),
        'password'
      );
      await first.click();
      await page.waitForFunction(
        (i) => window.tabsEvidence.records[i].root.getExposes().value.get() === 'account',
        i
      );
      await first.evaluate((node) => node.blur());
      await page.mouse.move(8, 8);
      interaction.push({
        style: row.style,
        orientation: row.orientation,
        hoverColor: oracle.foreground,
        selectedBackground: theme === 'dark' ? oracle.input30 : oracle.background,
        manualArrowNoActivation: true,
        enterActivation: true,
        pointerActivation: true,
        disabledSuppressed: true,
        nativeFocus: focus,
      });
    }
    const stable = await page.evaluate(async () => {
      const { records, setElementProps } = window.tabsEvidence;
      const r = records[0],
        a = r.triggers[0],
        text = a.firstChild,
        handle = r.root.getExposes().value,
        selected = a.getExposes().selected;
      a.focus();
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, 1);
      range.setEnd(text, 4);
      selection.removeAllRanges();
      selection.addRange(range);
      for (const style of ['nova', 'rhea', 'new-york-v4']) {
        setElementProps(r.scope, { styleProfile: style });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (
          document.activeElement !== a ||
          a.firstChild !== text ||
          r.root.getExposes().value !== handle ||
          a.getExposes().selected !== selected ||
          handle.get() !== 'account' ||
          selection.getRangeAt(0).startOffset !== 1 ||
          selection.getRangeAt(0).endOffset !== 4
        )
          return false;
      }
      selection.removeAllRanges();
      a.blur();
      return true;
    });
    assert.equal(stable, true);
    await waitGeometry();
    await page.screenshot({ path: join(out, `${theme}-tabs.png`), fullPage: true });
    observations.push({ theme, matrix, oracle, interaction, noReset: stable });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, 'browser.json'),
    JSON.stringify({ revision: receipt.revision, observations, pageErrors: errors }, null, 2) + '\n'
  );
} catch (error) {
  await page?.screenshot({ path: join(out, 'failed-tabs.png'), fullPage: true }).catch(() => {});
  await writeFile(
    join(out, 'browser-failure.json'),
    JSON.stringify({ revision: receipt.revision, error: String(error), observations, progress, pendingExpectation,
      current: await page?.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        records: window.tabsEvidence?.records.map((r) => ({
          style: r.style, orientation: r.orientation, value: r.root.getExposes().value.get(),
          triggers: r.triggers.map((node) => {
            const css = getComputedStyle(node);
            return { text: node.textContent, attributes: Object.fromEntries([...node.attributes].map((a) => [a.name, a.value])),
              focused: document.activeElement === node, focusVisible: node.matches(':focus-visible'),
              selected: node.getExposes().selected.get(),
              css: Object.fromEntries(['outlineWidth','outlineStyle','outlineColor','outlineOffset','borderTopColor','backgroundColor','color','boxShadow','borderRadius','opacity','pointerEvents'].map((p) => [p, css[p]])) };
          }),
        })),
      })).catch(() => null),
    }, null, 2) +
      '\n'
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(`Tabs browser evidence passed: ${out}`);
