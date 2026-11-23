/**
 * Capture the actual pre-Sprint-6 navbar without imposing the new density oracle.
 * Invoke this candidate-owned script from the separate baseline worktree:
 *   node --import tsx /candidate/scripts/analysis/bootstrap-navbar-baseline.mjs
 * All server and application imports resolve from cwd (the clean baseline), not
 * from this script's checkout. No candidate source is copied into that worktree.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BASELINE_SHA = 'dc3b184ba10b0de53e40359c52d012b204b2cd01';
const scriptPath = fileURLToPath(import.meta.url);
const scriptRoot = path.resolve(path.dirname(scriptPath), '../..');
const measuredRoot = process.cwd();
const directory = process.env.PROTO_UI_BOOTSTRAP_BASELINE_EVIDENCE_DIR;
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];
const ENTRIES = [
  { name: 'home', route: '/en/' },
  { name: 'docs', route: '/en/ui-libraries/bootstrap-2-3-2/button/' },
];
const expectedCases = ENTRIES.flatMap(({ name }) =>
  THEMES.flatMap((theme) => VIEWPORTS.map(({ width }) => `${name}-wc-${theme}-${width}`))
);
const cells = new Map();
const screenshots = [];
const pageErrors = [];
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
let browser, context, page, harness, headerHelper, baseUrl;
let measuredSha, scriptSourceSha, scriptSha256, startupError;

async function manifest(status) {
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify(
      {
        kind: 'bootstrap-navbar-before-capture',
        status,
        startupError,
        measuredSha,
        expectedBaselineSha: BASELINE_SHA,
        scriptSourceSha,
        expectedScriptSourceSha: process.env.PROTO_UI_EXPECTED_HEAD_SHA,
        scriptSha256,
        scriptPath: path.relative(scriptRoot, scriptPath),
        measuredRoot,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        node: process.version,
        browser: browser?.version(),
        runtime: 'wc',
        viewports: VIEWPORTS,
        themes: THEMES,
        entries: ENTRIES,
        cases: expectedCases.map((name) => ({
          name,
          ...(cells.get(name) ?? {
            status: ['starting', 'running'].includes(status) ? 'pending' : 'blocked',
            error: 'The expected baseline cell was not captured.',
          }),
        })),
        screenshots,
        pageErrors,
        scope:
          'Historical WC www homepage and Docs before captures only. Captured means the observation completed, not that the old page passes the new 40px navbar contract. No physical-device, IME, full-family, Compiler or non-Web claim.',
      },
      null,
      2
    )
  );
}
function menu() {
  return page.locator(
    '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"], [data-docs-site-header] [data-site-menu-button]'
  );
}
async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function observe(name, phase) {
  await settle();
  const geometry = await page.locator('[data-site-header]').evaluate((header) => {
    const read = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        background: css.backgroundColor,
        image: css.backgroundImage,
        color: css.color,
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        weight: css.fontWeight,
        border: css.borderColor,
        shadow: css.boxShadow,
      };
    };
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(element).visibility !== 'hidden' &&
        !element.closest('[hidden],[inert],[data-projection-generation-state="retired"]')
      );
    };
    return {
      theme: document.documentElement.dataset.theme,
      family: document.documentElement.dataset.siteLibraryFamily,
      runtime: header.dataset.runtime || 'wc',
      generation: header.dataset.runtimeGeneration || null,
      header: read(header),
      brand: read(header.querySelector('.site-header-brand a[data-site-link-enhanced]')),
      targets: [...header.querySelectorAll('a,[role="button"],[role="combobox"]')]
        .filter(visible)
        .map((element) => ({
          label: element.getAttribute('aria-label') || element.textContent?.trim(),
          ...read(element),
        })),
      panel: read(header.querySelector('[data-site-header-panel]')),
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  const filename = `before-${name}-${phase}.png`;
  await page.screenshot({
    path: path.join(directory, filename),
    fullPage: false,
    animations: 'disabled',
  });
  screenshots.push(filename);
  return { phase, screenshot: filename, geometry };
}
async function prepare(entry, theme) {
  context = await browser.newContext({ viewport: VIEWPORTS[0], colorScheme: theme });
  await context.addInitScript(() => localStorage.setItem('preferred-prototypes-adapter', 'wc'));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const allowed =
      url.origin === baseUrl ||
      url.origin === 'https://esm.sh' ||
      ['data:', 'blob:'].includes(url.protocol);
    return ['GET', 'HEAD'].includes(route.request().method()) && allowed
      ? route.continue()
      : route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (error) =>
    pageErrors.push({ entry: entry.name, theme, message: error.message })
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${entry.route}`, { waitUntil: 'networkidle' });
  if (entry.name === 'home') {
    await page.waitForFunction(
      () => {
        const root = document.querySelector('[data-homepage-runtime]');
        return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === 'wc';
      },
      undefined,
      { timeout: 30_000 }
    );
    await headerHelper.revealHeaderPreferences(page);
    const family = page.locator(
      '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"]'
    );
    await family.click();
    const controlled = await family.getAttribute('aria-controls');
    assert.ok(controlled, 'The real family Select must identify its popup.');
    await page
      .locator(`[id=${JSON.stringify(controlled)}]`)
      .getByRole('option', {
        name: 'Bootstrap 2.3.2 · WIP',
        exact: true,
      })
      .click();
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-homepage-runtime]');
      return root?.dataset.runtimeState === 'ready' && root.dataset.family === 'bootstrap-2-3-2';
    });
  } else {
    await page.locator('[data-docs-site-header][data-site-menu-ready]').waitFor();
    await page.locator('.site-header-brand [data-site-link-enhanced]').waitFor();
  }
  assert.equal(
    await page.locator('html').getAttribute('data-site-library-family'),
    'bootstrap-2-3-2'
  );
  assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
}

try {
  scriptSha256 = createHash('sha256')
    .update(await readFile(scriptPath))
    .digest('hex');
  measuredSha = git(measuredRoot, 'rev-parse', 'HEAD');
  scriptSourceSha = git(scriptRoot, 'rev-parse', 'HEAD');
  await manifest('starting');
  // These guards run before importing a browser/server module or opening a socket.
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Baseline capture is GitHub Actions-only.');
  assert.equal(
    process.env.PROTO_UI_BOOTSTRAP_BASELINE_CAPTURE,
    '1',
    'Explicit baseline capture opt-in is required.'
  );
  assert.ok(directory, 'An independent evidence directory is required.');
  assert.equal(
    process.env.PROTO_UI_BASELINE_SHA,
    BASELINE_SHA,
    'The original source is pinned, not a moving ref.'
  );
  assert.equal(measuredSha, BASELINE_SHA, 'cwd must be the exact original baseline checkout.');
  assert.match(process.env.PROTO_UI_EXPECTED_HEAD_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(
    scriptSourceSha,
    process.env.PROTO_UI_EXPECTED_HEAD_SHA,
    'The capture script belongs to the exact candidate.'
  );
  assert.notEqual(
    measuredRoot,
    scriptRoot,
    'Baseline and candidate must remain separate source trees.'
  );
  assert.ok(
    !process.env.PROTO_UI_BROWSER_BASE_URL,
    'External or stale browser servers are not allowed.'
  );
  for (const root of [measuredRoot, scriptRoot])
    assert.equal(
      git(root, 'status', '--porcelain', '--untracked-files=normal'),
      '',
      `${root} must be clean.`
    );
  git(scriptRoot, 'ls-files', '--error-unmatch', path.relative(scriptRoot, scriptPath));
  harness = await import(
    pathToFileURL(path.join(measuredRoot, 'apps/www/src/content/docs/zh-cn/browser-harness.ts'))
      .href
  );
  headerHelper = await import(
    pathToFileURL(path.join(measuredRoot, 'apps/www/src/content/docs/zh-cn/site-header-browser.ts'))
      .href
  );
  baseUrl = await harness.startServer('/en/');
  browser = await harness.launchBrowser();
  for (const entry of ENTRIES)
    for (const theme of THEMES) {
      try {
        await prepare(entry, theme);
        for (const viewport of VIEWPORTS) {
          const name = `${entry.name}-wc-${theme}-${viewport.width}`;
          const phases = [];
          try {
            await page.setViewportSize(viewport);
            await headerHelper.revealHeaderPreferences(page);
            if ((await menu().getAttribute('aria-expanded')) === 'true')
              await page.keyboard.press('Escape');
            await page.mouse.move(0, 200);
            phases.push(await observe(name, 'closed'));
            await menu().hover();
            phases.push(await observe(name, 'hover'));
            await menu().click();
            await page.waitForFunction(
              () => document.querySelector('[data-site-header]')?.dataset.siteMenuOpen === 'true'
            );
            phases.push(await observe(name, 'expanded'));
            await page.keyboard.press('Escape');
            cells.set(name, { status: 'captured', phases });
          } catch (error) {
            try {
              phases.push(await observe(name, 'failure'));
            } catch {
              /* Original error remains. */
            }
            cells.set(name, { status: 'failed', error: String(error), phases });
          } finally {
            await manifest('running');
          }
        }
      } catch (error) {
        for (const { width } of VIEWPORTS) {
          const name = `${entry.name}-wc-${theme}-${width}`;
          if (!cells.has(name)) cells.set(name, { status: 'blocked', error: String(error) });
        }
      } finally {
        await context?.close();
        context = undefined;
        page = undefined;
        await manifest('running');
      }
    }
  const complete = expectedCases.every((name) => cells.get(name)?.status === 'captured');
  await manifest(complete ? 'captured' : 'failed');
  if (!complete) process.exitCode = 1;
} catch (error) {
  startupError = String(error);
  await manifest('startup-failed');
  console.error(error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  await harness?.stopServer();
}
