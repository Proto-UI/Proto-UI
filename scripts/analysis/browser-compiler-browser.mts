import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'apps/www/package.json'));
const { chromium } = require('playwright-core');
const output = path.resolve(
  process.env.PUI_EVIDENCE_DIR ?? path.join(root, '.cache/sprint5/browser')
);
await mkdir(output, { recursive: true });
const report: any = {
  kind: 'canonical-wasm-docs-browser-v1',
  capturedAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceFiles: {},
  browser: '',
  cases: [],
  boundary:
    'Actual Astro documentation pages, actual WASM module Worker, actual generated four-target iframe controls; Chromium native keyboard/pointer. No physical hardware or assistive-technology acceptance is claimed.',
};
const files = execFileSync('git', ['ls-files', '-m', '-o', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);
for (const file of files)
  report.sourceFiles[file] = createHash('sha256')
    .update(await readFile(path.join(root, file)))
    .digest('hex');
let server: ReturnType<typeof spawn> | undefined;
let serverLog = '';
let browser: any;
const port = process.env.PUI_BROWSER_PORT ?? '4325';
const base = process.env.PUI_BROWSER_URL ?? `http://127.0.0.1:${port}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  // Keep the browser's OS sandbox. A host that cannot launch it records an
  // environment failure before spending time preparing the documentation app.
  browser = await chromium.launch({
    executablePath: process.env.PUI_CHROME_EXECUTABLE ?? '/usr/bin/chromium',
    headless: true,
    chromiumSandbox: true,
  });
  report.browser = browser.version();
  if (!process.env.PUI_BROWSER_URL) {
    execFileSync('corepack', ['pnpm@10.32.1', 'run', 'generate:proto-ui-style'], {
      cwd: path.join(root, 'apps/www'),
      stdio: 'pipe',
    });
    server = spawn(
      process.execPath,
      ['node_modules/astro/astro.js', 'dev', '--host', '127.0.0.1', '--port', port],
      { cwd: path.join(root, 'apps/www'), stdio: ['ignore', 'pipe', 'pipe'] }
    );
    server.stdout?.on('data', (chunk) => {
      serverLog += chunk.toString();
    });
    server.stderr?.on('data', (chunk) => {
      serverLog += chunk.toString();
    });
    const deadline = Date.now() + 90_000;
    while (!serverLog.includes('Local') && !serverLog.includes('ready in')) {
      if (server.exitCode !== null) throw new Error(`Astro exited: ${serverLog}`);
      if (Date.now() > deadline)
        throw new Error(`Astro startup timed out: ${serverLog.slice(-6000)}`);
      await sleep(100);
    }
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const requests: { url: string; frame: string }[] = [];
  page.on('request', (request: any) => {
    let frame = '';
    try {
      frame = request.frame().url();
    } catch {}
    requests.push({ url: request.url(), frame });
  });
  await page.goto(`${base}/en/ui-libraries/base/button/`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  const panel = page.locator('pui-browser-compiler[data-prototype-id="base-button"]');
  await panel.waitFor({ timeout: 30_000 });
  const terminal = async () => {
    await page.waitForFunction(
      () =>
        ['ready', 'failed'].includes(
          document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.compilerPhase ?? ''
        ),
      undefined,
      { timeout: 90_000 }
    );
    const phase = await panel.getAttribute('data-compiler-phase');
    assert.equal(phase, 'ready', await panel.locator('[data-compiler-diagnostics]').textContent());
  };
  const one = async (name: string, run: () => Promise<void>) => {
    const started = performance.now();
    try {
      await run();
      report.cases.push({
        name,
        status: 'passed',
        elapsedMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      report.cases.push({
        name,
        status: 'failed',
        elapsedMs: Math.round(performance.now() - started),
        error: String(error),
      });
      await page
        .screenshot({ path: path.join(output, `${report.cases.length}-failure.png`) })
        .catch(() => {});
    }
  };
  await one('ordinary-documentation-preview-before-compiler-load', async () => {
    await page
      .locator('.proto-previewer__preview .host')
      .getByRole('button', { name: 'Run action', exact: true })
      .waitFor();
    assert.equal(
      requests.some((request) => request.url.includes('/_compiler/compiler.js')),
      false
    );
    await panel.locator('[data-compiler-panel] > summary').click();
    await terminal();
    assert.match(await panel.getAttribute('data-compiler-sha256'), /^[a-f0-9]{64}$/);
    assert.ok(
      requests.some((request) => /\.wasm(?:\?|$)/.test(request.url)),
      'actual WASM file was loaded by the worker'
    );
  });
  for (const profile of [
    'web-component-source-v1',
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
  ]) {
    await one(`base-button-${profile}`, async () => {
      await panel.locator('[data-compiler-target]').selectOption(profile);
      await panel.locator('[data-compiler-run]').click();
      await terminal();
      const frame = panel.frameLocator('iframe');
      const enabled = frame.getByRole('button', { name: 'Run action', exact: true });
      const disabled = frame.getByRole('button', { name: 'Disabled', exact: true });
      await enabled.waitFor();
      assert.equal(await disabled.getAttribute('aria-disabled'), 'true');
      await enabled.click();
      await enabled.focus();
      await enabled.press('Space');
      await enabled.press('Enter');
      assert.equal(await enabled.getAttribute('aria-disabled'), 'false');
      assert.match(await panel.getAttribute('data-request-sha256'), /^[a-f0-9]{64}$/);
      const element = panel.locator('iframe');
      assert.equal(await element.getAttribute('sandbox'), 'allow-scripts');
      const facts = await (await element.elementHandle()).contentFrame().then((child: any) =>
        child.evaluate(() => {
          const rejected = (read: () => unknown) => {
            try {
              read();
              return false;
            } catch {
              return true;
            }
          };
          return {
            parent: rejected(() => parent.document),
            storage: rejected(() => localStorage.getItem('probe')),
            cookie: rejected(() => document.cookie),
          };
        })
      );
      assert.deepEqual(facts, { parent: true, storage: true, cookie: true });
      report.cases.push({
        name: `revision-${profile}`,
        status: 'passed',
        revision: await panel.getAttribute('data-compiler-revision'),
        requestSha256: await panel.getAttribute('data-request-sha256'),
      });
    });
  }
  await one('edit-reject-recover-same-revision-source-and-preview', async () => {
    await panel.locator('[data-compiler-target]').selectOption('web-component-source-v1');
    await panel.locator('[data-compiler-run]').click();
    await terminal();
    await panel.locator('[data-source-editor] > summary').click();
    const textarea = panel.locator('[data-source-text]');
    const source = await textarea.inputValue();
    const old = await panel.getAttribute('data-request-sha256');
    await textarea.fill("throw new Error('must-not-evaluate');\n" + source);
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.compilerPhase ===
        'failed',
      undefined,
      { timeout: 45_000 }
    );
    assert.match(await panel.locator('[data-compiler-diagnostics]').textContent(), /PUI1004/);
    assert.equal(await panel.locator('iframe').count(), 0);
    assert.equal(await panel.locator('[data-generated-text]').textContent(), '');
    await textarea.fill(source.replace('disabled: false,', 'disabled: true,'));
    await terminal();
    assert.notEqual(await panel.getAttribute('data-request-sha256'), old);
    assert.equal(
      await panel
        .frameLocator('iframe')
        .getByRole('button', { name: 'Run action', exact: true })
        .getAttribute('aria-disabled'),
      'true'
    );
    await panel.locator('[data-generated-source] > summary').click();
    assert.match(await panel.locator('[data-generated-text]').textContent(), /disabled.*true/s);
    await textarea.fill(source);
    await terminal();
  });
  await one('cancel-running-edit-and-reopen-fresh-owner', async () => {
    await panel.locator('[data-compiler-run]').click();
    await panel.locator('[data-compiler-cancel]').click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.compilerPhase ===
        'disposed'
    );
    assert.equal(await panel.locator('iframe').count(), 0);
    await panel.locator('[data-compiler-run]').click();
    await terminal();
    const before = await panel.getAttribute('data-compiler-revision');
    await panel.locator('[data-compiler-panel] > summary').click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.compilerPhase ===
        'disposed'
    );
    await panel.locator('[data-compiler-panel] > summary').click();
    await terminal();
    assert.notEqual(await panel.getAttribute('data-compiler-revision'), before);
  });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'base-button-en.png'), fullPage: false });
  await one('chinese-documentation-route-and-navigation-cleanup', async () => {
    await page.goto(`${base}/zh-cn/ui-libraries/base/button/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await panel.waitFor();
    await panel.locator('[data-compiler-panel] > summary').click();
    await terminal();
    assert.equal(
      await panel
        .frameLocator('iframe')
        .getByRole('button', { name: '运行动作', exact: true })
        .count(),
      1
    );
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'base-button-zh.png'), fullPage: false });
    await page.goto(`${base}/en/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.equal(await page.locator('pui-browser-compiler iframe').count(), 0);
  });
  report.consoleErrors = errors;
  report.requests = requests;
  report.compilerBuild = JSON.parse(await (await fetch(`${base}/_compiler/build.json`)).text());
} catch (error) {
  report.cases.push({ name: 'setup', status: 'failed', error: String(error) });
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
  await writeFile(path.join(output, 'server.log'), serverLog);
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ output, browser: report.browser, cases: report.cases }, null, 2));
if (report.cases.some((row: any) => row.status !== 'passed')) process.exitCode = 1;
