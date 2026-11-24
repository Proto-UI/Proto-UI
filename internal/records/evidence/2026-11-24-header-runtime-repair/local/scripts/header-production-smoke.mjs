import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const root = path.resolve(process.argv[2] ?? process.cwd());
const evidence = path.resolve(process.argv[3] ?? path.join(root, '..', 'header-production-smoke'));
const dist = path.resolve(process.env.PROTO_UI_HEADER_DIST ?? path.join(root, 'apps/www/dist'));
const wwwRequire = createRequire(path.join(root, 'apps/www/package.json'));
const { chromium } = wwwRequire('playwright-core');
const graphBytes = await fs.readFile(path.join(dist, 'proto-ui-bundle-graph.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const graphSha256 = hash(graphBytes);
if (process.env.PROTO_UI_HEADER_GRAPH_SHA)
  assert.equal(graphSha256, process.env.PROTO_UI_HEADER_GRAPH_SHA);
await fs.mkdir(evidence, { recursive: true });
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm',
};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(dist, `.${pathname}`);
    if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) throw new Error('outside dist');
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
    const bytes = await fs.readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Proto-UI-Graph-SHA': graphSha256,
      'X-Proto-UI-Content-SHA': hash(bytes),
    });
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
const result = {
  observedAt: new Date().toISOString(), node: process.version,
  executable: process.env.CHROME_PATH ?? '/usr/bin/chromium',
  graphSha256, browser: null, cases: [],
};
let browser;
try {
  browser = await chromium.launch({
    executablePath: result.executable, headless: true, chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
  result.browser = browser.version();
  for (const [family, route] of [
    ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
    ['brutalist', '/zh-cn/ui-libraries/brutalist/components/button/'],
    ['bootstrap', '/zh-cn/ui-libraries/bootstrap-2-3-2/button/'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      window.__headerWebglCalls = [];
      for (const prototype of [
        HTMLCanvasElement.prototype,
        typeof OffscreenCanvas === 'function' ? OffscreenCanvas.prototype : null,
      ]) {
        if (!prototype) continue;
        const original = prototype.getContext;
        prototype.getContext = function (kind, ...args) {
          if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind))
            window.__headerWebglCalls.push({ kind, at: performance.now() });
          return Reflect.apply(original, this, [kind, ...args]);
        };
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const item = { family, route, stages: [], pageErrors: [], consoleErrors: [],
      resourceErrors: [], loadedScripts: [], webglCalls: [], passed: false };
    let observing = true;
    page.on('pageerror', (error) => { if (observing) item.pageErrors.push(String(error)); });
    page.on('console', (message) => {
      if (observing && message.type() === 'error') item.consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      const request = response.request();
      if (!observing || !response.url().startsWith(`${base}/`)) return;
      const url = new URL(response.url()).pathname;
      if (['document', 'script', 'stylesheet'].includes(request.resourceType()) && response.status() >= 400)
        item.resourceErrors.push({ url, type: request.resourceType(), status: response.status() });
      if (request.resourceType() === 'script')
        item.loadedScripts.push({ url, sha256: response.headers()['x-proto-ui-content-sha'] ?? null });
    });
    page.on('requestfailed', (request) => {
      if (observing && request.url().startsWith(`${base}/`) && ['document', 'script', 'stylesheet'].includes(request.resourceType()))
        item.resourceErrors.push({ url: new URL(request.url()).pathname, type: request.resourceType(),
          failure: request.failure()?.errorText ?? 'unknown' });
    });
    try {
      // Readiness is the real Header projection below. Unrelated optional
      // requests do not define whether the requested controls have mounted.
      const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.equal(response.headers()['x-proto-ui-graph-sha'], result.graphSha256);
      await page.waitForFunction(() =>
        document.querySelector('[data-docs-site-header][data-site-menu-ready]') &&
        document.querySelector('[data-site-header-panel][data-header-surface-runtime="wc"]'));
      item.stages.push('mobile-header-wc-ready');
      const header = page.locator('[data-docs-site-header]');
      const menu = header.locator('[data-site-menu-button]');
      await menu.click();
      await page.waitForFunction(() =>
        document.querySelector('[data-docs-site-header] [data-site-menu-button]')
          ?.getAttribute('aria-expanded') === 'true');
      await page.screenshot({ path: path.join(evidence, `${family}-mobile-menu.png`) });
      item.stages.push('mobile-menu-open');
      const select = header.locator('[data-adapter-select-root] [data-site-select-trigger]');
      const choose = async (label) => {
        await select.click();
        const popupId = await select.getAttribute('aria-controls');
        assert.ok(popupId && !/\s/.test(popupId), 'The actual trigger must own exactly one popup');
        const popup = page.locator(`[id=${JSON.stringify(popupId)}]`);
        await popup.getByRole('option', { name: label, exact: true }).click();
        await popup.waitFor({ state: 'hidden' });
        await page.waitForFunction((id) =>
          document.activeElement?.getAttribute('aria-controls') === id, popupId);
        assert.equal(await select.getAttribute('aria-expanded'), 'false');
      };
      await choose('React');
      await page.waitForFunction(() =>
        document.querySelector('[data-site-header-panel][data-header-surface-runtime="react"]'));
      assert.match(await select.innerText(), /React/);
      assert.equal(await header.locator('[data-adapter-select-root]').evaluate((element) =>
        element.getExposes().value.get()), 'react');
      item.stages.push('header-react-lazy-runtime-ready');
      await page.screenshot({ path: path.join(evidence, `${family}-react-menu.png`) });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() =>
        document.querySelector('[data-docs-site-header] [data-site-menu-button]')
          ?.getAttribute('aria-expanded') === 'false');
      item.stages.push('mobile-menu-closed');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() =>
        document.querySelector('[data-docs-site-header] [data-site-header-preferences]')
          ?.parentElement?.matches('[data-site-header-context]'));
      assert.ok(await select.isVisible());
      await choose('Web Components');
      await page.waitForFunction(() =>
        document.querySelector('[data-site-header-panel][data-header-surface-runtime="wc"]'));
      assert.match(await select.innerText(), /Web Components/);
      assert.equal(await header.locator('[data-adapter-select-root]').evaluate((element) =>
        element.getExposes().value.get()), 'wc');
      item.stages.push('desktop-dock-and-wc-return');
      await page.screenshot({ path: path.join(evidence, `${family}-desktop.png`) });
      item.webglCalls = await page.evaluate(() => window.__headerWebglCalls);
      assert.deepEqual(item.webglCalls, [], 'Ordinary Header controls must not acquire a GPU context');
      assert.deepEqual(item.pageErrors, [], 'Production chunks must initialize without JavaScript errors');
      assert.deepEqual(item.resourceErrors, [], 'Production document/scripts/styles must load successfully');
      assert.deepEqual(item.consoleErrors.filter((message) =>
        /Failed to fetch dynamically imported module|error loading dynamically imported module|Failed to load module script|MIME type|ChunkLoadError|Cannot access .+ before initialization|\[SiteHeader\]/i.test(message)), [],
      'Header or module initialization must not silently fall back after a loading error');
      item.passed = true;
    } catch (error) {
      item.error = String(error.stack ?? error);
      item.webglCalls = await page.evaluate(() => window.__headerWebglCalls).catch(() => []);
      await page.screenshot({ path: path.join(evidence, `${family}-failure.png`) }).catch(() => {});
    } finally {
      result.cases.push(item);
      observing = false;
      await context.close();
      await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(item));
    }
  }
} catch (error) {
  result.launchError = String(error.stack ?? error);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(hash(await fs.readFile(path.join(dist, 'proto-ui-bundle-graph.json'))), result.graphSha256);
  await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n');
}
if (result.launchError || result.cases.length !== 3 || result.cases.some((item) => !item.passed))
  process.exitCode = 1;
