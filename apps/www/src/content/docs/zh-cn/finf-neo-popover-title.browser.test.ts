// @vitest-environment node
// Official real-input Web evidence. This does not claim GPUI or upstream pixel parity.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  RUNTIMES,
  COLOR_SCHEMES,
  chromeExecutable,
  startServer,
  stopServer,
  selectRuntime,
  applyColorScheme,
} from './browser-harness';

const route = '/en/ui-libraries/brutalist/components/popover/';
const demoId = 'demo-brutalist-popover';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-neo-popover-title');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const trackedChanges = execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim();
const untrackedChanges = execFileSync('git', ['ls-files', '--others', '--exclude-standard'])
  .toString()
  .trim();
const candidate = {
  revision,
  tree,
  cleanExactCommit: !trackedChanges && !untrackedChanges,
  trackedChanges: trackedChanges ? trackedChanges.split('\n') : [],
  untrackedChanges: untrackedChanges ? untrackedChanges.split('\n') : [],
  trackedPatchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
const references = {
  proposal: 'internal/contracts/overlay/brutalist-popover-title.presentation.v0.md',
  upstream: '3306a802724874a85f93079702b2795370a279d4',
  titleBlob: 'f313943b5ee811a6bf9ff5b57de4fee25da3b739',
  cssBlob: '0db21814a42d75973b09ca8de9cad69c6475d115',
  url: 'https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/popover.tsx#L65-L75',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeJson('neo-popover-title-source.json', {
    candidate,
    revision,
    tree,
    references,
    demoId,
    route,
    expectedCases: RUNTIMES.length * COLOR_SCHEMES.length + RUNTIMES.length,
    typographyCases: RUNTIMES.length * COLOR_SCHEMES.length,
    interactionDiagnosticCases: RUNTIMES.length,
    phase: 'Planned. Only terminal case receipts establish executed results.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'Official GitHub Actions only; local source tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim()).toBe('');
    expect(
      execFileSync('git', ['ls-files', '--others', '--exclude-standard']).toString().trim()
    ).toBe('');
    const requestedBase = process.env.PROTO_UI_BROWSER_BASE_URL;
    if (
      requestedBase &&
      !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(requestedBase).hostname)
    )
      throw new Error('An external evidence server is not allowed.');
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence requires this job’s own loopback documentation server.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('neo-popover-title-setup.json', {
      candidate,
      revision,
      tree,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
      unexecuted: [
        'all eight runtime/theme typography cases',
        'all four independent light-theme interaction diagnostics',
        'custom inheritance',
        'real input and lifecycle',
        '320px and 200% root text',
      ],
    });
    throw error;
  }
}, 180_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

async function focused(locator: Locator) {
  return locator.evaluate((element) => element.matches(':focus'));
}

async function focusSnapshot(page: Page) {
  return page.evaluate(() => {
    const activeChain = [];
    let active = document.activeElement;
    while (active) {
      activeChain.push({
        tag: active.tagName.toLowerCase(),
        id: active.id,
        role: active.getAttribute('role'),
        tabIndex: (active as HTMLElement).tabIndex,
        text: active.textContent?.trim().slice(0, 120),
      });
      active = active.shadowRoot?.activeElement ?? null;
    }
    return { documentHasFocus: document.hasFocus(), activeChain };
  });
}

async function open(page: Page, trigger: Locator) {
  await trigger.click();
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Popover trigger must identify its content.');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  await panel.waitFor({ state: 'visible' });
  return panel;
}

async function titleFor(page: Page, panel: Locator) {
  const id = await panel.getAttribute('aria-labelledby');
  if (!id) throw new Error('The live Title must name Content.');
  const title = page.locator(`[id=${JSON.stringify(id)}]`);
  expect(await title.count()).toBe(1);
  return title;
}

async function typography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const headingRole =
      style.getPropertyValue('--pui-font-heading').trim() || 'ui-sans-serif, system-ui, sans-serif';
    // Independent browser-normalized oracle; never overwrite the Title under test.
    const probe = document.createElement('span');
    probe.style.fontFamily = headingRole;
    document.body.append(probe);
    const expectedHeadingFamily = getComputedStyle(probe).fontFamily;
    probe.remove();
    return {
      expectedHeadingFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      resolvedHeadingFamily: style.getPropertyValue('--pui-font-heading').trim(),
      resolvedBodyFamily: style.getPropertyValue('--pui-font-sans').trim(),
      background: style.backgroundColor,
      foreground: style.color,
      borderColor: style.borderColor,
      fonts: {
        status: document.fonts.status,
        dmSansCheck: document.fonts.check('700 16px "DM Sans"'),
        // These are font availability receipts, not proof of each rendered glyph.
        faces: Array.from(document.fonts).map((face) => ({
          family: face.family,
          weight: face.weight,
          status: face.status,
        })),
      },
      ancestry: (() => {
        const entries = [];
        let ancestor = element.parentElement;
        while (ancestor && entries.length < 12) {
          const computed = getComputedStyle(ancestor);
          entries.push({
            tag: ancestor.tagName.toLowerCase(),
            theme: ancestor.getAttribute('data-theme'),
            className: ancestor.className,
            headingFamily: computed.getPropertyValue('--pui-font-heading').trim(),
            bodyFamily: computed.getPropertyValue('--pui-font-sans').trim(),
            background: computed.getPropertyValue('--pui-background').trim(),
            fontSize: computed.fontSize,
          });
          ancestor = ancestor.parentElement;
        }
        return entries;
      })(),
      text: element.textContent,
      id: element.id,
      rootSize: getComputedStyle(document.documentElement).fontSize,
      titleTokens: element.getAttribute('data-pui-style'),
      bounds: { x: box.x, right: box.right, width: box.width, height: box.height },
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
}

async function defaultTypography(title: Locator, panel: Locator) {
  const actual = await typography(title);
  const container = await typography(panel);
  const rem = Number.parseFloat(actual.rootSize);
  expect(Number.parseFloat(actual.fontSize)).toBeCloseTo(rem, 5);
  expect(Number.parseFloat(actual.lineHeight)).toBeCloseTo(Number.parseFloat(actual.fontSize), 5);
  expect(actual.fontWeight).toBe('700');
  expect(actual.fontFamily).toBe(actual.expectedHeadingFamily);
  expect(actual.fontSize).toBe(container.fontSize);
  return { title: actual, content: container };
}

for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES) {
    const id = `neo-popover-title-${runtime}-${scheme}`;
    it(
      id,
      async () => {
        let context: BrowserContext | undefined;
        let page: Page | undefined;
        let stage = 'created';
        let result = 'failed';
        let failure: string | undefined;
        const screenshots: unknown[] = [];
        const errors: string[] = [];
        const deniedRequests: string[] = [];
        const observations: Record<string, unknown> = {};
        try {
          context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
            locale: 'en-US',
            timezoneId: 'UTC',
          });
          page = await context.newPage();
          page.setDefaultTimeout(15_000);
          page.setDefaultNavigationTimeout(30_000);
          page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
          await context.route('**/*', (request) => {
            const url = new URL(request.request().url());
            if (url.origin === new URL(baseUrl).origin) return request.continue();
            deniedRequests.push(url.origin);
            return request.abort();
          });
          stage = 'navigate';
          const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          expect(response?.status()).toBe(200);
          const previewer = page.locator('[data-previewer-id]').first();
          await previewer.scrollIntoViewIfNeeded();
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
          await applyColorScheme(page, scheme);
          await page.evaluate(() => document.fonts.ready);
          const trigger = previewer.getByRole('button', { name: 'Open Popover', exact: true });
          const capture = async (state: string, observation: unknown) => {
            const file = `${id}-${state}.png`;
            const bytes = await page!.screenshot({ path: path.join(output, file) });
            screenshots.push({
              revision,
              tree,
              demoId,
              state,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              observation,
              environment: await page!.evaluate(() => ({
                viewport: { width: innerWidth, height: innerHeight },
                dpr: devicePixelRatio,
                fonts: document.fonts.status,
                rootSize: getComputedStyle(document.documentElement).fontSize,
              })),
            });
          };
          stage = 'default-title';
          let panel = await open(page, trigger);
          let title = await titleFor(page, panel);
          expect(await panel.getAttribute('aria-modal')).toBe('false');
          expect(await title.getAttribute('tabindex')).toBeNull();
          // Preserve the independent typography and theme-scope observations
          // before assertions so a portal/theme defect cannot erase the evidence.
          observations.default = {
            title: await typography(title),
            content: await typography(panel),
          };
          observations.themeScope = {
            boundary:
              'Portal theme/family propagation is observed separately, not repaired by this Title recipe.',
            titleHeadingVariablePresent: Boolean(
              (observations.default as { title: { resolvedHeadingFamily: string } }).title
                .resolvedHeadingFamily
            ),
            glyphLimit:
              'CSS family and font availability do not prove the font used by every glyph.',
            debt: (observations.default as { title: { resolvedHeadingFamily: string } }).title
              .resolvedHeadingFamily
              ? null
              : 'The Title heading variable is absent in the portal; fallback typography is observed. Neo theme propagation remains separate debt.',
          };
          await capture('default', observations.default);
          await defaultTypography(title, panel);

          stage = 'explicit-ancestor-inheritance';
          const original = await panel.evaluate((element) => {
            const node = element as HTMLElement;
            const previous = { fontSize: node.style.fontSize, lineHeight: node.style.lineHeight };
            // Explicit test fixture only: style the existing ancestor, never Title.
            node.style.fontSize = '19px';
            node.style.lineHeight = '31px';
            return previous;
          });
          const inherited = await typography(title);
          expect(inherited).toMatchObject({
            fontSize: '19px',
            lineHeight: '19px',
            fontWeight: '700',
          });
          observations.inherited = inherited;
          await capture('inherited', inherited);
          await panel.evaluate((element, previous) => {
            const node = element as HTMLElement;
            node.style.fontSize = previous.fontSize;
            node.style.lineHeight = previous.lineHeight;
          }, original);
          await defaultTypography(title, panel);

          stage = 'close-and-pointer-reopen';
          await panel.getByRole('button', { name: 'Close', exact: true }).click();
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          panel = await open(page, trigger);
          title = await titleFor(page, panel);
          observations.reopened = await defaultTypography(title, panel);
          await capture('reopened', observations.reopened);
          await panel.getByRole('button', { name: 'Close', exact: true }).click();
          await panel.waitFor({ state: 'hidden' });

          stage = 'narrow-200-percent-root-text';
          await page.setViewportSize({ width: 320, height: 1000 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          await trigger.scrollIntoViewIfNeeded();
          panel = await open(page, trigger);
          title = await titleFor(page, panel);
          await title.evaluate((element) => {
            element.textContent = 'Long Popover settings title for readable narrow screen layout';
          });
          observations.narrowText = await defaultTypography(title, panel);
          const narrow = await typography(title);
          const bounds = await typography(panel);
          expect(bounds.bounds.x).toBeGreaterThanOrEqual(-1);
          expect(bounds.bounds.right).toBeLessThanOrEqual(321);
          expect(narrow.bounds.x).toBeGreaterThanOrEqual(bounds.bounds.x - 1);
          expect(narrow.bounds.right).toBeLessThanOrEqual(bounds.bounds.right + 1);
          expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
          await capture('320px-200-percent-root-text', {
            ...(observations.narrowText as object),
            limit:
              '200% root text-size fixture, not physical browser zoom or upstream pixel parity.',
          });
          await panel.getByRole('button', { name: 'Close', exact: true }).click();
          await panel.waitFor({ state: 'hidden' });
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          if (page) {
            try {
              observations.failureFocus = await focusSnapshot(page);
              const file = `${id}-failure.png`;
              const bytes = await page.screenshot({
                path: path.join(output, file),
                timeout: 5_000,
              });
              screenshots.push({
                revision,
                tree,
                stage,
                file,
                sha256: createHash('sha256').update(bytes).digest('hex'),
              });
            } catch (captureError) {
              errors.push(`failure capture: ${String(captureError)}`);
            }
          }
          throw error;
        } finally {
          try {
            await writeJson(`${id}.json`, {
              revision,
              tree,
              references,
              demoId,
              runtime,
              scheme,
              stage,
              result,
              failure,
              errors,
              deniedRequests,
              observations,
              screenshots,
              browser: browser.version(),
            });
          } finally {
            await context?.close();
          }
        }
      },
      120_000
    );
  }

// Public-demo interaction diagnostics are deliberately separate from typography.
// Existing Shadcn/source regression assertions remain unchanged; this observational
// case does not claim the next native Tab must land on a named outside button.
for (const runtime of RUNTIMES) {
  const id = `neo-popover-title-interaction-diagnostic-${runtime}-light`;
  it(
    id,
    async () => {
      let context: BrowserContext | undefined;
      let page: Page | undefined;
      let stage = 'created';
      let result = 'failed';
      let failure: string | undefined;
      const errors: string[] = [];
      const deniedRequests: string[] = [];
      const observations: Record<string, unknown> = {};
      const screenshots: unknown[] = [];
      try {
        context = await browser.newContext({
          viewport: { width: 1280, height: 1000 },
          colorScheme: 'light',
          reducedMotion: 'reduce',
          locale: 'en-US',
          timezoneId: 'UTC',
        });
        page = await context.newPage();
        page.setDefaultTimeout(15_000);
        page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
        await context.route('**/*', (request) => {
          const url = new URL(request.request().url());
          if (url.origin === new URL(baseUrl).origin) return request.continue();
          deniedRequests.push(url.origin);
          return request.abort();
        });
        stage = 'navigate';
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        const previewer = page.locator('[data-previewer-id]').first();
        await previewer.scrollIntoViewIfNeeded();
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
        await applyColorScheme(page, 'light');
        const trigger = previewer.getByRole('button', { name: 'Open Popover', exact: true });
        const outside = previewer.getByRole('button', {
          name: 'Outside focus target',
          exact: true,
        });
        let panel = await open(page, trigger);
        const capture = async (state: string) => {
          const file = `${id}-${state}.png`;
          const bytes = await page!.screenshot({ path: path.join(output, file) });
          screenshots.push({
            revision,
            tree,
            demoId,
            state,
            file,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
        };

        stage = 'title-name-lifecycle-diagnostic';
        if (runtime === 'wc') {
          let title = await titleFor(page, panel);
          const titleId = await title.getAttribute('id');
          await title.evaluate((element) => {
            element.textContent = 'Updated Popover settings';
          });
          await expect
            .poll(() =>
              page!
                .getByRole('dialog', {
                  name: 'Updated Popover settings',
                  exact: true,
                })
                .count()
            )
            .toBe(1);
          const retainedTitle = await title.elementHandle();
          if (!retainedTitle) throw new Error('Title handle disappeared.');
          await retainedTitle.evaluate((element) => element.remove());
          await expect.poll(() => panel.getAttribute('aria-labelledby')).toBeNull();
          observations.titleAfterRemoval = {
            labelledBy: await panel.getAttribute('aria-labelledby'),
            fallbackLabel: await panel.getAttribute('aria-label'),
            knownDebt:
              'The public demo callback-only setProps may clear a11yLabel. This observed fixture debt is not Title typography acceptance; existing source and Shadcn regression assertions remain unchanged.',
          };
          await capture('title-removed');
          await panel.evaluate((element, child) => element.prepend(child), retainedTitle);
          await retainedTitle.dispose();
          title = await titleFor(page, panel);
          expect(await title.getAttribute('id')).toBe(titleId);
          await title.evaluate((element) => {
            element.textContent = 'Popover settings';
          });
          observations.titleLifecycle =
            'WC native disconnect/reconnect observed; fallback-label fixture debt is reported separately.';
        } else {
          observations.titleLifecycle =
            'Renderer-driven isolated Title removal/remount remains untested.';
        }

        stage = 'native-tab-target-diagnostic';
        observations.beforeTab = await focusSnapshot(page);
        await page.keyboard.press('Tab');
        observations.afterTab = {
          ...(await focusSnapshot(page)),
          outsideFocused: await focused(outside),
          triggerExpanded: await trigger.getAttribute('aria-expanded'),
          panelVisible: await panel.isVisible(),
          limit:
            'Observed native Tab target only; no assumption that one Tab reaches the named Outside button.',
        };
        await capture('native-tab-target');

        stage = 'explicit-outside-click';
        if ((await trigger.getAttribute('aria-expanded')) !== 'true')
          panel = await open(page, trigger);
        await panel.waitFor({ state: 'visible' });
        expect(await trigger.getAttribute('aria-expanded')).toBe('true');
        observations.beforeExplicitOutsideClick = {
          ...(await focusSnapshot(page)),
          triggerExpanded: await trigger.getAttribute('aria-expanded'),
          panelVisible: await panel.isVisible(),
        };
        await outside.click();
        await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
        await panel.waitFor({ state: 'hidden' });
        await expect.poll(() => focused(outside)).toBe(true);
        observations.explicitOutsideClick = {
          ...(await focusSnapshot(page)),
          closed: true,
          outsideFocused: true,
          input:
            'Playwright pointer click on the real public Outside focus target; may dismiss via pointer.outside before focus moves. Not a pure-focus or Tab-order claim.',
        };
        await capture('explicit-outside-click');

        stage = 'escape-and-focus-return';
        panel = await open(page, trigger);
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden' });
        await expect.poll(() => focused(trigger)).toBe(true);
        observations.escape = {
          ...(await focusSnapshot(page)),
          triggerFocused: true,
          closed: true,
        };
        expect(errors).toEqual([]);
        expect(deniedRequests).toEqual([]);
        result = 'observed-and-explicit-interactions-passed-with-recorded-debt';
      } catch (error) {
        failure = String(error);
        if (page) {
          try {
            observations.failureFocus = await focusSnapshot(page);
            const file = `${id}-failure.png`;
            const bytes = await page.screenshot({ path: path.join(output, file), timeout: 5_000 });
            screenshots.push({
              revision,
              tree,
              stage,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            });
          } catch (captureError) {
            errors.push(`failure capture: ${String(captureError)}`);
          }
        }
        throw error;
      } finally {
        try {
          await writeJson(`${id}.json`, {
            candidate,
            revision,
            tree,
            references,
            demoId,
            runtime,
            scheme: 'light',
            coverage:
              'independent public-demo interaction diagnostics, not complete naming or natural Tab-order acceptance',
            stage,
            result,
            failure,
            errors,
            deniedRequests,
            observations,
            screenshots,
            browser: browser.version(),
          });
        } finally {
          await context?.close();
        }
      }
    },
    120_000
  );
}
