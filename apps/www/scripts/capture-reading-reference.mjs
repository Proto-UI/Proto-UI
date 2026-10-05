import { createHash } from 'node:crypto';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectReadingReference } from './reading-reference-collector.mjs';
import {
  collectReadingBreakpoint,
  readingBreakpointFailures,
  READING_BREAKPOINT_CASES,
} from './reading-reference-breakpoints.mjs';
import { readReadingReflow } from '../src/content/docs/zh-cn/reading-reflow-evidence.ts';
import {
  allowOwnRequest,
  hashReadingObservation,
  observationFailures,
  pngDimensions,
  readSourceBinding,
  routeOwnResponse,
  safeEvidenceURL,
  sanitizeDiagnostic,
  READING_CASES,
  READING_VIEWPORT,
} from './reading-reference-contract.mjs';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness.ts';
import { startReadingPreview, verifyReadingBuild } from './reading-reference-production.mjs';

const breakpointMode = process.argv.includes('--breakpoints');
if (process.argv.slice(2).some((argument) => argument !== '--breakpoints'))
  throw new Error('Only the optional --breakpoints profile is supported.');
const requestedCases = breakpointMode ? READING_BREAKPOINT_CASES : READING_CASES;
const reportFilename = breakpointMode ? 'reading-breakpoints.json' : 'reading-reference.json';

// This independent runner does not enter or alter the existing browser matrix.
// Run from the repository root using node --import tsx and a clean candidate.
// The matching production-build.json receipt and unchanged dist bytes are required.
const out = path.resolve(
  process.env.PROTO_UI_READING_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'proto-ui-reading-reference')
);
const report = {
  schemaVersion: 1,
  profile: breakpointMode
    ? 'normal-desktop-breakpoints-and-separate-text-stress'
    : 'matched-reference',
  purpose: breakpointMode
    ? 'Normal desktop reading breakpoint regression diagnosis with separately labelled enlarged-text controls; not visual acceptance or browser zoom simulation.'
    : 'Matched candidate reading-reference observation; not design acceptance, production attribution or clicked hit-testing.',
  startedAtUTC: new Date().toISOString(),
  externalProductionReference: {
    kind: 'externally-observed-reference',
    sourceSha: null,
    sourceBinding: 'unknown; collect separately, do not attribute it to the candidate',
  },
  requested: {
    viewport: breakpointMode ? null : READING_VIEWPORT,
    cases: requestedCases,
    deviceScaleFactor: 1,
    browserZoom:
      '100% fresh non-persistent browser context; verify actual DPR, visual viewport scale and CSS zoom',
    siteThemes: ['light', 'dark'],
    browserColorSchemePreference: 'light',
    reducedMotion: 'no-preference',
    routeCount: 2,
  },
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    eventSha: process.env.GITHUB_SHA ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
  cases: [],
  failures: [],
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = () =>
  writeFile(path.join(out, reportFilename), `${JSON.stringify(report, null, 2)}\n`);
let browser;
let preview;
await mkdir(out, { recursive: true });
try {
  // Never use the harness's externally supplied URL escape hatch in this task.
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error(
      'This runner only starts its own production preview; PROTO_UI_BROWSER_BASE_URL is not allowed.'
    );
  report.source = readSourceBinding(process.env.PROTO_UI_EXPECTED_HEAD);
  report.collector = {
    path: 'apps/www/scripts/reading-reference-collector.mjs',
    sha256: sha256(await readFile(new URL('./reading-reference-collector.mjs', import.meta.url))),
  };
  if (breakpointMode)
    report.breakpointCollectors = await Promise.all(
      [
        'apps/www/scripts/reading-reference-breakpoints.mjs',
        'apps/www/src/content/docs/zh-cn/reading-reflow-evidence.ts',
      ].map(async (filename) => ({
        path: filename,
        sha256: sha256(await readFile(filename)),
      }))
    );
  await save();
  report.build = await verifyReadingBuild({
    out,
    expectedHead: process.env.PROTO_UI_EXPECTED_HEAD,
  });
  const ownedPreview = await startReadingPreview();
  preview = ownedPreview.preview;
  const baseUrl = ownedPreview.baseUrl;
  report.server = { mode: ownedPreview.mode, address: ownedPreview.address };
  report.sourceAfterServerStart = readSourceBinding(process.env.PROTO_UI_EXPECTED_HEAD);
  browser = await launchBrowser();
  report.environment.browserVersion = browser.version();
  for (const target of requestedCases) {
    const viewport = target.viewport ?? READING_VIEWPORT;
    const entry = {
      ...target,
      originalURL: `${baseUrl}${target.route}`,
      startedAtUTC: new Date().toISOString(),
      outcome: 'collecting',
      pageErrors: [],
      failedRequests: [],
      blockedExternalRequests: [],
      networkBoundaryFailures: [],
      screenshots: [],
    };
    report.cases.push(entry);
    const context = await browser.newContext({
      viewport,
      screen: viewport,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      locale: 'zh-CN',
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) =>
      routeOwnResponse(route, baseUrl, (failure) => {
        entry.networkBoundaryFailures.push(failure);
        if (failure.kind === 'external-request') entry.blockedExternalRequests.push(failure.url);
      })
    );
    await context.routeWebSocket('**/*', (socket) => {
      if (allowOwnRequest(socket.url(), baseUrl)) socket.connectToServer();
      else {
        entry.blockedExternalRequests.push(safeEvidenceURL(socket.url()));
        socket.close();
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('pageerror', (error) => entry.pageErrors.push(sanitizeDiagnostic(error.message)));
    page.on('requestfailed', (request) =>
      entry.failedRequests.push({
        url: safeEvidenceURL(request.url()),
        error: request.failure()?.errorText
          ? sanitizeDiagnostic(request.failure().errorText)
          : null,
      })
    );
    const screenshot = async (kind, fullPage) => {
      const filename = `${target.id}-${kind}.png`;
      const filenamePath = path.join(out, filename);
      const bytes = await page.screenshot({
        path: filenamePath,
        type: 'png',
        fullPage,
        scale: 'css',
        timeout: 30_000,
      });
      const dimensions = pngDimensions(bytes);
      entry.screenshots.push({
        path: filename,
        kind,
        fullPage,
        format: 'png',
        dimensions,
        sha256: sha256(bytes),
        byteLength: bytes.length,
        mtimeUTC: (await stat(filenamePath)).mtime.toISOString(),
        capturedAtUTC: new Date().toISOString(),
      });
      if (
        !fullPage &&
        (dimensions.width !== viewport.width || dimensions.height !== viewport.height)
      )
        throw new Error(
          `Raw viewport PNG dimensions are ${dimensions.width}x${dimensions.height}, not ${viewport.width}x${viewport.height}.`
        );
    };
    try {
      const response = await page.goto(entry.originalURL, {
        waitUntil: 'networkidle',
        timeout: 60_000,
      });
      entry.httpStatus = response?.status() ?? null;
      entry.finalURL = safeEvidenceURL(page.url());
      if (entry.httpStatus !== 200) throw new Error(`Document HTTP status ${entry.httpStatus}`);
      await page.locator('main[data-pagefind-body]').waitFor({ state: 'visible' });
      // The external reference uses a light OS preference and the site's real
      // theme button for dark mode. Do not silently substitute dark media.
      await page.waitForFunction(
        () =>
          document
            .querySelector('header [data-theme-toggle]')
            ?.getAttribute('data-site-shadcn-initialized') === '1'
      );
      const readThemeState = () =>
        page.evaluate(() => {
          const button = document.querySelector('header [data-theme-toggle]');
          const bounds = button?.getBoundingClientRect();
          return {
            theme: document.documentElement.dataset.theme,
            rootInlineColorScheme: document.documentElement.style.colorScheme,
            rootComputedColorScheme: getComputedStyle(document.documentElement).colorScheme,
            button: button
              ? {
                  selector: 'header [data-theme-toggle]',
                  tag: button.localName,
                  id: button.id || null,
                  ariaLabel: button.getAttribute('aria-label'),
                  ariaPressed: button.getAttribute('aria-pressed'),
                  state: button.getAttribute('data-state'),
                  prototype: button.getAttribute('data-projection-prototype'),
                  targetBox: bounds
                    ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                    : null,
                }
              : null,
          };
        });
      const beforeTheme = await readThemeState();
      if (beforeTheme.theme !== target.colorScheme) {
        await page.locator('header [data-theme-toggle]').click();
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          target.colorScheme
        );
        entry.themeAction = {
          method: 'native pointer click on the Header Theme button',
          before: beforeTheme,
          after: await readThemeState(),
        };
      } else
        entry.themeAction = {
          method: 'initial site theme already matches',
          before: beforeTheme,
          after: beforeTheme,
        };

      await page.waitForFunction(
        (theme) =>
          document.documentElement.dataset.theme === theme &&
          Boolean(document.querySelector('main[data-pagefind-body] [data-typography-runtime]')) &&
          [...document.querySelectorAll('[data-projection-scope]')].every(
            (root) => root.getAttribute('data-projection-state') === 'ready'
          ),
        target.colorScheme
      );
      if (target.stressOnly)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      entry.observation = hashReadingObservation(await page.evaluate(collectReadingReference));
      if (breakpointMode) {
        entry.breakpoint = await page.evaluate(collectReadingBreakpoint);
        entry.reflow = await page.evaluate(readReadingReflow);
      }
      entry.observationFailures = breakpointMode
        ? readingBreakpointFailures(entry.observation, entry.breakpoint, entry.reflow, target)
        : observationFailures(entry.observation, target);
      await screenshot('viewport', false);
      await screenshot('full', true);
      entry.observationFailures.push(
        ...entry.pageErrors.map((error) => `Page error: ${error}`),
        ...entry.networkBoundaryFailures.map(
          (failure) => `Network boundary: ${JSON.stringify(failure)}`
        ),
        ...entry.failedRequests.map(({ url, error }) => `Request failed: ${url}: ${error}`),
        ...entry.blockedExternalRequests.map((url) => `External request blocked: ${url}`)
      );
      if (entry.observationFailures.length) throw new Error(entry.observationFailures.join('\n'));
      entry.outcome = 'observed';
    } catch (error) {
      entry.outcome = 'failed';
      entry.error = sanitizeDiagnostic(error instanceof Error ? error.stack : String(error));
      entry.finalURL = safeEvidenceURL(page.url());
      report.failures.push(`${target.id}: ${sanitizeDiagnostic(error)}`);
      if (!entry.observation)
        entry.observation = await page
          .evaluate(collectReadingReference)
          .then(hashReadingObservation)
          .catch((failure) => ({ collectionError: sanitizeDiagnostic(failure) }));
      await screenshot('failure-viewport', false).catch((failure) => {
        entry.screenshotFailure = sanitizeDiagnostic(failure);
      });
    } finally {
      entry.finishedAtUTC = new Date().toISOString();
      await context.close();
      await save();
    }
  }
  report.sourceAfterCapture = readSourceBinding(process.env.PROTO_UI_EXPECTED_HEAD);
  const finalBuild = await verifyReadingBuild({
    out,
    expectedHead: process.env.PROTO_UI_EXPECTED_HEAD,
  });
  report.buildAfterCapture = {
    verifiedAtUTC: new Date().toISOString(),
    inventorySha256: finalBuild.inventory.sha256,
  };
} catch (error) {
  report.failures.push(sanitizeDiagnostic(error instanceof Error ? error.stack : String(error)));
} finally {
  await browser
    ?.close()
    .catch((error) => report.failures.push(`Browser cleanup: ${sanitizeDiagnostic(error)}`));
  await preview
    ?.stop()
    .catch((error) => report.failures.push(`Preview cleanup: ${sanitizeDiagnostic(error)}`));
  report.finishedAtUTC = new Date().toISOString();
  report.outcome = report.failures.length ? 'failed' : 'observed';
  await save();
}
if (report.failures.length) {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Observed ${report.cases.length} source-bound reading cases. Report: ${path.join(out, reportFilename)}. Visual review remains separate.`
  );
