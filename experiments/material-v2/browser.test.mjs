// Runs only repository-owned localhost content. No accounts, screenshots of
// third-party pages, captures of arbitrary DOM, external requests or deployment.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { launchBrowser } from '../../apps/www/src/content/docs/zh-cn/browser-harness.ts';
import { installCarrierStyleDiagnostics } from './carrier-diagnostics.mjs';
const root = resolve(process.argv[2] ?? '/tmp/pui-material-v2');
const output = resolve(process.argv[3] ?? '/tmp/pui-material-v2-evidence');
await mkdir(output, { recursive: true });
const source = JSON.parse(await readFile(join(root, 'source.json'), 'utf8'));
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    response.setHeader(
      'content-type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ??
        'application/octet-stream'
    );
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, context, page;
const observations = [];
let failure = null;
try {
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(installCarrierStyleDiagnostics);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  );
  page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const quality = (value) =>
    page.waitForFunction(
      (expected) => {
        const all = [...document.querySelectorAll('[data-demo-ref="regular"]')];
        return all.length === 4 && all.every((el) => el.dataset.materialQuality === expected);
      },
      value,
      { timeout: 30000 }
    );
  for (const theme of ['light', 'dark']) {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'no-preference' },
        { name: 'prefers-reduced-transparency', value: 'no-preference' },
        { name: 'prefers-contrast', value: 'no-preference' },
        { name: 'forced-colors', value: 'none' },
        { name: 'prefers-color-scheme', value: theme },
      ],
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.documentElement.dataset.ready || document.documentElement.dataset.error,
      undefined,
      { timeout: 30000 }
    );
    assert.equal(await page.locator('html').getAttribute('data-error'), null);
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    await quality('self-optical');
    await page.evaluate(() => window.v2Material.pause());
    await quality('self-optical');
    await page.screenshot({ path: join(output, `${theme}-four-web.png`), fullPage: true });
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      const button = page.locator(`[data-runtime="${runtime}"] [data-demo-ref="regular"]`);
      const before = await button.evaluate((el) =>
        getComputedStyle(el, '::before').backgroundImage !== 'none'
          ? getComputedStyle(el, '::before').backgroundImage
          : getComputedStyle(el).backgroundImage
      );
      assert.match(before, /^url\("data:image\/png;base64,/);
      await button.hover();
      await page.mouse.down();
      await page.waitForFunction(
        (runtime) =>
          document.querySelector(`[data-runtime="${runtime}"] [data-demo-ref="regular"]`).dataset
            .materialPhase === 'pressed',
        runtime
      );
      const pressed = await button.evaluate((el) =>
        getComputedStyle(el, '::before').backgroundImage !== 'none'
          ? getComputedStyle(el, '::before').backgroundImage
          : getComputedStyle(el).backgroundImage
      );
      assert.notEqual(pressed, before);
      await page.screenshot({
        path: join(output, `${theme}-${runtime}-pressed.png`),
        fullPage: true,
      });
      await page.mouse.up();
      await button.focus();
      await page.keyboard.press('Space');
      assert.ok(Number(await page.locator(`[data-count="${runtime}"]`).textContent()) >= 1);
    }
    await page.evaluate(() => window.v2Material.source(false));
    await quality('opaque-fallback');
    await page.screenshot({ path: join(output, `${theme}-source-revoked.png`), fullPage: true });
    await page.evaluate(() => window.v2Material.source(true));
    await quality('self-optical');
    const metrics = await page.evaluate(() => window.v2Material.metrics());
    assert.equal(metrics.contexts, 1);
    observations.push({
      theme,
      quality: 'self-optical',
      sourceRevokeRecover: true,
      fourRuntimeBaseActivation: true,
      metrics,
    });
    await page.evaluate(() => window.v2Material.dispose());
    assert.equal((await page.evaluate(() => window.v2Material.metrics())).contexts, 0);
  }
} catch (error) {
  failure = String(error?.stack ?? error);
  if (page) {
    await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(
      join(output, 'failure-state.json'),
      JSON.stringify(
        await page
          .evaluate(() => ({
            error: document.documentElement.dataset.error,
            controls: [...document.querySelectorAll('[data-demo-ref="regular"]')].map((el) => ({
              tokens: el.getAttribute('data-pui-style'),
              style: el.getAttribute('style'),
              diagnostics: { ...el.dataset },
            })),
            metrics: window.v2Material?.metrics(),
            carrierStyleReads: window.__carrierStyleDiagnostics,
          }))
          .catch(() => null),
        null,
        2
      )
    );
  }
} finally {
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        ...source,
        browser: browser?.version(),
        execution: failure ? 'failed' : 'passed',
        observations,
        failure,
      },
      null,
      2
    )
  );
  await context?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
if (failure) throw new Error(failure);
console.log(`V2 four-runtime evidence passed: ${output}`);
