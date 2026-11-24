import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePrototype } from '../../packages/compiler/src/index';
import { readBrowserSource } from '../compiler/browser-assets';
import {
  browserEvidenceRecord,
  captureCurrentBrowserEvidence,
  type BrowserBuildEvidence,
} from '../compiler/browser-evidence.mjs';
import { assertSameBrowserEvidence, digest } from '../compiler/browser-inputs.mjs';
import {
  assertLoopbackPortAvailable,
  childIsAlive,
  localBrowserServiceConfiguration,
  observedAstroLocalURL,
} from '../compiler/browser-service.mjs';

import {
  prepareProductionBrowserService,
  type ProductionBrowserService,
} from '../compiler/browser-production.mjs';

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
let expectedEvidence: BrowserBuildEvidence | undefined;
let production: ProductionBrowserService | undefined;
let server: ReturnType<typeof spawn> | undefined;
let serverLog = '';
let browser: any;
let completedCases = false;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const mode = process.env.PUI_BROWSER_MODE ?? 'development';
  assert.ok(['development', 'production'].includes(mode), 'invalid PUI_BROWSER_MODE');
  let base: string;
  // Keep the browser's OS sandbox. A host that cannot launch it records an
  // environment failure before spending time preparing the documentation app.
  browser = await chromium.launch({
    executablePath: process.env.PUI_CHROME_EXECUTABLE ?? '/usr/bin/chromium',
    headless: true,
    chromiumSandbox: true,
  });
  report.browser = browser.version();
  if (mode === 'production') {
    production = await prepareProductionBrowserService({ root, output, environment: process.env });
    base = production.url;
    report.service = production.receipt;
    expectedEvidence = await captureCurrentBrowserEvidence();
    Object.assign(report, browserEvidenceRecord(expectedEvidence));
  } else {
    const service = localBrowserServiceConfiguration(process.env, root, process.execPath);
    base = service.url;
    execFileSync('corepack', ['pnpm@10.32.1', 'run', 'generate:proto-ui-style'], {
      cwd: service.cwd,
      stdio: 'pipe',
    });
    expectedEvidence = await captureCurrentBrowserEvidence();
    Object.assign(report, browserEvidenceRecord(expectedEvidence));
    await assertLoopbackPortAvailable(service.port);
    server = spawn(service.executable, service.command.slice(1), {
      cwd: service.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let spawnFailure: Error | undefined;
    server.on('error', (error) => {
      spawnFailure = error;
    });
    server.stdout?.on('data', (chunk) => {
      serverLog += chunk.toString();
    });
    server.stderr?.on('data', (chunk) => {
      serverLog += chunk.toString();
    });
    const deadline = Date.now() + 90_000;
    let observedLocalURL: string | undefined;
    while (!(observedLocalURL = observedAstroLocalURL(serverLog, base))) {
      if (spawnFailure) throw spawnFailure;
      if (!childIsAlive(server))
        throw new Error(`Owned Astro exited before binding its URL: ${serverLog}`);
      if (Date.now() > deadline)
        throw new Error(`Astro startup timed out: ${serverLog.slice(-6000)}`);
      await sleep(100);
    }
    assert.ok(childIsAlive(server), 'owned Astro child must still be alive at its ready URL');
    assert.deepEqual(
      server.spawnargs,
      service.command,
      'actual child command must match the source-bound launch'
    );
    report.service = {
      url: base,
      mode: 'local-runner-service',
      owner: {
        status: 'running',
        root: service.root,
        cwd: service.cwd,
        executable: server.spawnfile,
        command: server.spawnargs,
        pid: server.pid,
        parentPid: process.pid,
        port: service.port,
        observedLocalURL,
        portAvailableBeforeSpawn: true,
        aliveAtReady: true,
      },
    };
  }
  const serviceManifest = await fetch(`${base}/compiler-assets/input-manifest.json`);
  assert.equal(
    serviceManifest.ok,
    true,
    'the browser service must expose its build input manifest'
  );
  const serviceManifestText = await serviceManifest.text();
  assertSameBrowserEvidence(JSON.parse(serviceManifestText), expectedEvidence);
  const servedAssets: Record<string, string> = {};
  for (const [asset, expected] of Object.entries(expectedEvidence.assets)) {
    const response = await fetch(`${base}/compiler-assets/${asset}`);
    assert.equal(response.ok, true, `missing bound browser service asset: ${asset}`);
    const actual = digest(await response.text());
    assert.equal(actual, expected, `browser service asset drift: ${asset}`);
    servedAssets[asset] = actual;
  }
  report.compilerBuild = expectedEvidence.compilerBuild;
  report.service.inputManifestSha256 = digest(serviceManifestText);
  report.service.assets = servedAssets;
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('console', (message: any) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const requests: { url: string; frame: string }[] = [];
  const loadedChecks: Promise<void>[] = [],
    assetErrors: string[] = [];
  report.loadedAssets = {};
  report.loadedWasm = [];
  report.loadedProductionAssets = {};
  report.productionWorkers = [];
  page.on('worker', (worker: any) => {
    if (!production) return;
    const entry = { url: worker.url(), closed: false };
    report.productionWorkers.push(entry);
    worker.on('close', () => {
      entry.closed = true;
    });
  });
  const retiredWorkers = async () => {
    if (!production) return;
    const deadline = Date.now() + 5_000;
    while (page.workers().length && Date.now() < deadline) await sleep(20);
    assert.equal(page.workers().length, 0, 'the disposed panel must retire its actual Worker');
  };
  const wasmDigests = new Set(
    Object.entries(expectedEvidence.sourceFiles)
      .filter(([file]) => file.endsWith('.wasm'))
      .map(([, sha256]) => sha256)
  );
  page.on('response', (response: any) => {
    const url = new URL(response.url());
    const asset =
      url.origin === new URL(base).origin && url.pathname.startsWith('/compiler-assets/')
        ? url.pathname.slice('/compiler-assets/'.length)
        : '';
    const expected = expectedEvidence!.assets[asset];
    const productionFile =
      production &&
      url.origin === new URL(base).origin &&
      url.pathname.startsWith('/_astro/') &&
      /\.(?:js|mjs|wasm)$/.test(url.pathname)
        ? url.pathname.slice(1)
        : '';
    const wasm = response.headers()['content-type']?.includes('application/wasm');
    if (!expected && !wasm && !productionFile) return;
    loadedChecks.push(
      (async () => {
        try {
          const sha256 = digest(await response.body());
          if (productionFile) {
            const sealed = production!.files[productionFile];
            assert.ok(sealed, 'actual resource must belong to the owned production build');
            assert.equal(response.status(), 200, 'production module/WASM response must succeed');
            const contentType = response.headers()['content-type'] ?? '';
            assert.match(
              contentType,
              productionFile.endsWith('.wasm') ? /application\/wasm/ : /(?:java|ecma)script/i
            );
            assert.equal(sha256, sealed.sha256, 'loaded production asset drift: ' + productionFile);
            report.loadedProductionAssets[productionFile] = {
              sha256,
              status: response.status(),
              contentType,
            };
          }
          if (expected) {
            assert.equal(sha256, expected, `loaded browser asset drift: ${asset}`);
            report.loadedAssets[asset] = sha256;
          }
          if (wasm) {
            assert.ok(
              wasmDigests.has(sha256),
              'loaded WASM bytes must belong to the current Worker input closure'
            );
            report.loadedWasm.push({ url: response.url(), sha256 });
          }
        } catch (error) {
          // A deliberately cancelled edit may abort a response before any bytes
          // can be executed; retain only completed-resource discrepancies.
          if (!response.request().failure()) assetErrors.push(String(error));
        }
      })()
    );
  });
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
      requests.some((request) => request.url.includes('/compiler-assets/compiler.js')),
      false
    );
    if (production)
      assert.equal(
        report.productionWorkers.length,
        0,
        'ordinary documentation must not start the compiler Worker'
      );
    await panel.locator('[data-compiler-panel] > summary').click();
    await terminal();
    assert.equal(
      await panel.getAttribute('data-compiler-sha256'),
      expectedEvidence!.compilerBuild.compilerSha256
    );
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
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.eventCount === '1'
      );
      await enabled.press('Space');
      await enabled.press('Enter');
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.eventCount === '3'
      );
      await disabled.click({ force: true });
      assert.equal(
        await panel.getAttribute('data-event-count'),
        '3',
        'disabled native pointer cannot emit a command'
      );
      assert.equal(await enabled.getAttribute('aria-disabled'), 'false');
      assert.match(await panel.getAttribute('data-request-sha256'), /^[a-f0-9]{64}$/);
      assert.equal(
        await panel.getAttribute('data-target-sha256'),
        expectedEvidence!.targetModulesSha256[profile]
      );
      const source = await readBrowserSource('base-button');
      const expected = compilePrototype(source.source, {
        fileName: source.entry,
        exportName: source.exportName,
        files: source.files,
      });
      if (!expected.ok) throw new Error(JSON.stringify(expected.diagnostics));
      const expectedCode = expected.value.primary?.react.code ?? '';
      const expectedFiles = new Map<string, string>([['entry.ts', expectedCode]]);
      if ((await panel.locator('[data-generated-source]').getAttribute('open')) === null)
        await panel.locator('[data-generated-source] > summary').click();
      const actualFiles = await panel
        .locator('[data-generated-file] option')
        .evaluateAll((options: HTMLOptionElement[]) => options.map((option) => option.value));
      assert.deepEqual(actualFiles, [...expectedFiles.keys()]);
      for (const [file, contents] of expectedFiles) {
        await panel.locator('[data-generated-file]').selectOption(file);
        assert.equal(
          await panel.locator('[data-generated-text]').textContent(),
          contents,
          `browser/ordinary generated artifact parity: ${file}`
        );
      }
      await panel.locator('[data-generated-file]').selectOption('entry.ts');
      const element = panel.locator('iframe');
      assert.equal(await element.getAttribute('sandbox'), 'allow-scripts');
      const facts = await (await element.elementHandle()).contentFrame().then((child: any) =>
        child.evaluate(() => {
          let parentBlocked = false;
          let storageBlocked = false;
          let cookieBlocked = false;
          try {
            void parent.document;
          } catch {
            parentBlocked = true;
          }
          try {
            localStorage.getItem('probe');
          } catch {
            storageBlocked = true;
          }
          try {
            void document.cookie;
          } catch {
            cookieBlocked = true;
          }
          return { parent: parentBlocked, storage: storageBlocked, cookie: cookieBlocked };
        })
      );
      assert.deepEqual(facts, { parent: true, storage: true, cookie: true });
      report.cases.push({
        name: `revision-${profile}`,
        status: 'passed',
        revision: await panel.getAttribute('data-compiler-revision'),
        requestSha256: await panel.getAttribute('data-request-sha256'),
        targetSha256: await panel.getAttribute('data-target-sha256'),
        generatedEntrySha256: createHash('sha256').update(expectedCode).digest('hex'),
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
    if ((await panel.locator('[data-generated-source]').getAttribute('open')) === null)
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
    await retiredWorkers();
    await panel.locator('[data-compiler-run]').click();
    await terminal();
    const before = await panel.getAttribute('data-compiler-revision');
    await panel.locator('[data-compiler-panel] > summary').click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.compilerPhase ===
        'disposed'
    );
    await retiredWorkers();
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
    for (const profile of [
      'web-component-source-v1',
      'react-dom-source-v1',
      'vue-source-v1',
      'vue2-source-v1',
    ]) {
      await one(`zh-base-button-${profile}`, async () => {
        await panel.locator('[data-compiler-target]').selectOption(profile);
        await panel.locator('[data-compiler-run]').click();
        await terminal();
        const button = panel
          .frameLocator('iframe')
          .getByRole('button', { name: '运行动作', exact: true });
        await button.click();
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('pui-browser-compiler')?.dataset.eventCount === '1'
        );
        assert.equal(
          await panel
            .frameLocator('iframe')
            .getByRole('button', { name: '已禁用', exact: true })
            .getAttribute('aria-disabled'),
          'true'
        );
      });
    }
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'base-button-zh.png'), fullPage: false });
    await page.goto(`${base}/en/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.equal(await page.locator('pui-browser-compiler iframe').count(), 0);
    await retiredWorkers();
  });
  report.consoleErrors = errors;
  report.requests = requests;
  await Promise.all(loadedChecks);
  await one('loaded-compiler-target-and-wasm-bindings', async () => {
    assert.deepEqual(assetErrors, []);
    for (const [asset, sha256] of Object.entries(expectedEvidence!.assets))
      assert.equal(
        report.loadedAssets[asset],
        sha256,
        `browser did not consume bound asset ${asset}`
      );
    assert.ok(report.loadedWasm.length > 0, 'the actual Worker loaded the bound QuickJS binary');
  });
  if (production)
    await one('production-worker-chunks-and-cleanup', async () => {
      assert.deepEqual(errors, [], 'production must have no page/console errors');
      assert.ok(
        report.productionWorkers.length >= 4,
        'initial/cancel/reopen/bilingual journeys must create actual Workers'
      );
      for (const worker of report.productionWorkers) {
        const url = new URL(worker.url);
        assert.equal(url.origin, base);
        assert.match(url.pathname, /^\/_astro\/[^/]+\.js$/);
        assert.equal(worker.closed, true, 'every production Worker must retire on navigation');
        assert.ok(
          report.loadedProductionAssets[url.pathname.slice(1)],
          'the actual Worker entry must match the sealed production bytes'
        );
      }
    });
  completedCases = true;
} catch (error) {
  report.cases.push({ name: 'setup', status: 'failed', error: String(error) });
} finally {
  if (!production && report.service?.owner) {
    const alive = childIsAlive(server);
    report.service.owner.aliveBeforeShutdown = alive;
    report.service.owner.status = completedCases && alive ? 'passed' : 'failed';
    report.cases.push({
      name: 'runner-owned-local-service',
      status: report.service.owner.status,
      ...(!completedCases || !alive
        ? { error: 'The run did not complete against its live owned Astro child.' }
        : {}),
    });
  }
  try {
    await browser?.close();
  } catch (error) {
    report.cases.push({ name: 'browser-cleanup', status: 'failed', error: String(error) });
  } finally {
    if (production) {
      try {
        await production.close(completedCases);
        report.cases.push({
          name: 'runner-owned-local-service',
          status: report.service.owner.status,
        });
      } catch (error) {
        report.cases.push({
          name: 'runner-owned-local-service',
          status: 'failed',
          error: String(error),
        });
      }
    } else server?.kill('SIGTERM');
  }
  if (expectedEvidence) {
    try {
      const finalEvidence = await captureCurrentBrowserEvidence();
      assertSameBrowserEvidence(expectedEvidence, finalEvidence);
      report.sourceStability = {
        status: 'passed',
        beforeSha256: digest(JSON.stringify(expectedEvidence.sourceFiles)),
        afterSha256: digest(JSON.stringify(finalEvidence.sourceFiles)),
        manifestSha256: digest(JSON.stringify(finalEvidence)),
      };
      report.cases.push({ name: 'source-and-asset-stability', status: 'passed' });
    } catch (error) {
      report.sourceStability = { status: 'failed', error: String(error) };
      report.cases.push({
        name: 'source-and-asset-stability',
        status: 'failed',
        error: String(error),
      });
    }
  }
  await writeFile(path.join(output, 'server.log'), serverLog);
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ output, browser: report.browser, cases: report.cases }, null, 2));
if (report.cases.some((row: any) => row.status !== 'passed')) process.exitCode = 1;
