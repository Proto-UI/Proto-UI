// @vitest-environment node
// Official real-browser geometry and input evidence, separate from source-host tests.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

const route = '/en/ui-libraries/shadcn/popover/';
const demoId = 'demo-shadcn-popover';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-popover-command-density');
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
  proposal: 'internal/contracts/overlay/shadcn-popover-command-density.presentation.v0.md',
  upstream: 'c2a67849be260701852b0977ba15eb5f3a0ce2a4',
  cssBlob: '514a3e8e00deac2ef59fee04c57cb10fd277ef39',
  button:
    'https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/styles/style-nova.css#L148-L206',
  example:
    'https://github.com/shadcn-ui/ui/blob/c2a67849be260701852b0977ba15eb5f3a0ce2a4/apps/v4/registry/bases/base/examples/popover-example.tsx',
  limit:
    'Upstream Popover has no Close. Default Nova density for this existing Close is the explicit local presentation choice, not full Button parity.',
};
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const sourceHashes: Record<string, string> = {};
  for (const file of [
    references.proposal,
    'packages/prototypes/shadcn/src/popover/trigger.proto.ts',
    'packages/prototypes/shadcn/src/popover/close.proto.ts',
    'apps/www/src/content/docs/zh-cn/finf-popover-command-density.browser.test.ts',
  ])
    sourceHashes[file] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  await writeJson('popover-command-density-source.json', {
    candidate,
    references,
    sourceHashes,
    demoId,
    route,
    expectedCases: RUNTIMES.length * COLOR_SCHEMES.length,
    phase: 'Planned; only terminal case receipts prove execution.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'Official GitHub Actions only; local source tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(candidate.cleanExactCommit).toBe(true);
    const requested = process.env.PROTO_UI_BROWSER_BASE_URL;
    if (requested && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(requested).hostname))
      throw new Error('External evidence servers are not allowed.');
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
    await writeJson('popover-command-density-setup.json', {
      candidate,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
      unexecuted: [
        'eight runtime/theme cases',
        'actual DOM/computed geometry',
        'ancestor typography and root32',
        'pointer hit samples and activation',
        'Close/reopen/Escape',
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

async function metrics(locator: Locator) {
  return locator.evaluate((element) => {
    const rectOf = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const describe = (node: Element) => {
      const css = getComputedStyle(node),
        html = node as HTMLElement;
      return {
        tag: node.tagName,
        role: node.getAttribute('role'),
        id: node.id,
        tokens: node.getAttribute('data-pui-style'),
        rect: rectOf(node),
        cssHeight: css.height,
        minHeight: css.minHeight,
        maxHeight: css.maxHeight,
        cssWidth: css.width,
        boxSizing: css.boxSizing,
        display: css.display,
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
        border: [
          css.borderTopWidth,
          css.borderRightWidth,
          css.borderBottomWidth,
          css.borderLeftWidth,
        ],
        radii: [
          css.borderTopLeftRadius,
          css.borderTopRightRadius,
          css.borderBottomRightRadius,
          css.borderBottomLeftRadius,
        ],
        radiusToken: css.getPropertyValue('--pui-radius-lg').trim(),
        fontSize: css.fontSize,
        lineHeight: css.lineHeight,
        fontWeight: css.fontWeight,
        fontFamily: css.fontFamily,
        parentFont: node.parentElement
          ? {
              size: getComputedStyle(node.parentElement).fontSize,
              lineHeight: getComputedStyle(node.parentElement).lineHeight,
              family: getComputedStyle(node.parentElement).fontFamily,
            }
          : null,
        offset: { width: html.offsetWidth, height: html.offsetHeight },
        client: { width: html.clientWidth, height: html.clientHeight },
        scroll: { width: html.scrollWidth, height: html.scrollHeight },
      };
    };
    return {
      control: describe(element),
      shadowSurfaces: Array.from(
        element.shadowRoot?.querySelectorAll('[data-pui-split-surface],button,[role="button"]') ??
          []
      ).map(describe),
      rootFont: getComputedStyle(document.documentElement).fontSize,
    };
  });
}
function assertDensity(actual: Awaited<ReturnType<typeof metrics>>) {
  const c = actual.control,
    rem = Number.parseFloat(actual.rootFont);
  expect(c.boxSizing).toBe('border-box');
  expect(c.rect.height).toBeCloseTo(2 * rem, 4);
  expect(Number.parseFloat(c.cssHeight)).toBeCloseTo(2 * rem, 4);
  expect(c.padding.map(Number.parseFloat)).toEqual([0, 0.625 * rem, 0, 0.625 * rem]);
  expect(c.border.map(Number.parseFloat)).toEqual([1, 1, 1, 1]);
  expect(Number.parseFloat(c.fontSize)).toBeCloseTo(0.875 * rem, 4);
  expect(Number.parseFloat(c.lineHeight)).toBeCloseTo(1.25 * rem, 4);
  expect(c.fontWeight).toBe('500');
  expect(c.fontFamily).toBe(c.parentFont?.family);
  const radius = c.radiusToken.match(/^([\d.]+)(px|rem)$/);
  expect(
    radius,
    'Radius must resolve from the existing family token, not a test-invented pixel radius.'
  ).not.toBeNull();
  const radiusPx = Number(radius![1]) * (radius![2] === 'rem' ? rem : 1);
  for (const value of c.radii) expect(Number.parseFloat(value)).toBeCloseTo(radiusPx, 4);
  expect(c.rect.width).toBeGreaterThan(c.padding.map(Number.parseFloat)[1] * 2 + 2);
  expect(c.scroll.width).toBeLessThanOrEqual(c.client.width + 1);
  return actual;
}
async function hitSamples(locator: Locator) {
  return locator.evaluate((control) => {
    const rect = control.getBoundingClientRect();
    const points = [
      ['center', rect.x + rect.width / 2, rect.y + rect.height / 2],
      ['top-inset', rect.x + rect.width / 2, rect.y + 2],
      ['bottom-inset', rect.x + rect.width / 2, rect.bottom - 2],
      ['left-inset', rect.x + 2, rect.y + rect.height / 2],
      ['right-inset', rect.right - 2, rect.y + rect.height / 2],
      ['above', rect.x + rect.width / 2, rect.y - 2],
      ['below', rect.x + rect.width / 2, rect.bottom + 2],
    ] as const;
    const belongs = (node: Element | null) => {
      for (let current = node; current; ) {
        if (current === control) return true;
        current = current.parentElement ?? ((current.getRootNode() as ShadowRoot).host || null);
      }
      return false;
    };
    return points.map(([name, x, y]) => {
      let node = document.elementFromPoint(x, y);
      const chain = [];
      while (node) {
        chain.push({
          tag: node.tagName,
          role: node.getAttribute('role'),
          id: node.id,
          text: node.textContent?.slice(0, 100),
        });
        const deep = node.shadowRoot?.elementFromPoint(x, y);
        if (!deep || deep === node) break;
        node = deep;
      }
      return { name, x, y, belongsToControl: belongs(node), chain };
    });
  });
}
async function clickTopInset(page: Page, locator: Locator, receipts: unknown[], stage: string) {
  await locator.scrollIntoViewIfNeeded();
  const hit = (await hitSamples(locator)).find((sample) => sample.name === 'top-inset');
  const receipt = {
    stage,
    input: 'page.mouse.click',
    x: hit?.x ?? null,
    y: hit?.y ?? null,
    preClickHit: hit ?? null,
    completed: false,
  };
  receipts.push(receipt);
  expect(hit?.belongsToControl, 'Actual border-box inset coordinate must hit this command.').toBe(
    true
  );
  if (!hit) throw new Error('Command has no top-inset sample.');
  // Locator click coordinates use the padding box. Send the measured global
  // border-box point directly so the hit sample and actual input are identical.
  await page.mouse.click(hit.x, hit.y);
  receipt.completed = true;
}
async function panelFor(page: Page, trigger: Locator) {
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Trigger must identify its Content.');
  const panel = page.locator(`[id=${JSON.stringify(id)}][role="dialog"]`);
  await panel.waitFor({ state: 'visible' });
  return panel;
}

for (const runtime of RUNTIMES)
  for (const scheme of COLOR_SCHEMES) {
    const id = `popover-command-density-${runtime}-${scheme}`;
    it(
      id,
      async () => {
        let context: BrowserContext | undefined, page: Page | undefined;
        let stage = 'created',
          result = 'failed',
          failure: string | undefined;
        const observations: Record<string, unknown> = {},
          screenshots: unknown[] = [],
          errors: string[] = [],
          deniedRequests: string[] = [],
          pointerInputs: unknown[] = [];
        try {
          context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
            locale: 'en-US',
            timezoneId: 'UTC',
          });
          await context.route('**/*', (request) => {
            const url = new URL(request.request().url());
            if (url.origin === new URL(baseUrl).origin) return request.continue();
            deniedRequests.push(url.origin);
            return request.abort();
          });
          page = await context.newPage();
          page.setDefaultTimeout(15_000);
          page.setDefaultNavigationTimeout(30_000);
          page.on('pageerror', (error) => errors.push(`${stage}: ${String(error)}`));
          const capture = async (state: string, observation: unknown) => {
            const file = `${id}-${state}.png`,
              bytes = await page!.screenshot({ path: path.join(output, file) });
            screenshots.push({
              candidate,
              demoId,
              state,
              file,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              observation,
              environment: await page!.evaluate(() => ({
                viewport: { width: innerWidth, height: innerHeight },
                dpr: devicePixelRatio,
                fonts: document.fonts.status,
                rootFont: getComputedStyle(document.documentElement).fontSize,
              })),
            });
          };
          stage = 'navigate';
          expect(
            (await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' }))?.status()
          ).toBe(200);
          const previewer = page.locator('[data-previewer-id]').first();
          await previewer.scrollIntoViewIfNeeded();
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="root"]', 1);
          await applyColorScheme(page, scheme);
          await page.evaluate(() => document.fonts.ready);
          const trigger = previewer.getByRole('button', { name: 'Open Popover', exact: true });
          stage = 'default-trigger';
          const defaultTrigger = await metrics(trigger);
          observations.trigger = defaultTrigger;
          expect(defaultTrigger.rootFont).toBe('16px');
          assertDensity(defaultTrigger);
          observations.triggerHits = await hitSamples(trigger);
          for (const hit of observations.triggerHits as Awaited<ReturnType<typeof hitSamples>>)
            if (hit.name.endsWith('inset') || hit.name === 'center')
              expect(hit.belongsToControl).toBe(true);
          await capture('trigger', observations.trigger);
          await clickTopInset(page, trigger, pointerInputs, stage);
          const panel = await panelFor(page, trigger),
            close = panel.getByRole('button', { name: 'Close', exact: true });
          stage = 'default-close';
          const defaultClose = await metrics(close);
          observations.close = defaultClose;
          expect(defaultClose.rootFont).toBe('16px');
          assertDensity(defaultClose);
          observations.closeHits = await hitSamples(close);
          for (const hit of observations.closeHits as Awaited<ReturnType<typeof hitSamples>>)
            if (hit.name.endsWith('inset') || hit.name === 'center')
              expect(hit.belongsToControl).toBe(true);
          observations.hitBoundary =
            'Sampled DOM hit targets only; outside samples are retained, not assumed false. No minimum touch-target or complete hit-region guarantee.';
          await capture('opened', { trigger: observations.trigger, close: observations.close });
          stage = 'ancestor-typography';
          for (const [name, control] of [
            ['trigger', trigger],
            ['close', close],
          ] as const) {
            const previous = await control.evaluate((element) => {
              const parent = element.parentElement!;
              const value = { size: parent.style.fontSize, line: parent.style.lineHeight };
              parent.style.fontSize = '19px';
              parent.style.lineHeight = '31px';
              return value;
            });
            const actual = await metrics(control);
            observations[`${name}AncestorTypography`] = actual;
            expect(actual.rootFont).toBe('16px');
            assertDensity(actual);
            expect(actual.control.parentFont).toMatchObject({ size: '19px', lineHeight: '31px' });
            await control.evaluate((element, value) => {
              element.parentElement!.style.fontSize = value.size;
              element.parentElement!.style.lineHeight = value.line;
            }, previous);
          }
          stage = 'close-reopen-escape';
          await clickTopInset(page, close, pointerInputs, stage);
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          await panel.waitFor({ state: 'hidden' });
          await clickTopInset(page, trigger, pointerInputs, stage);
          await panelFor(page, trigger);
          observations.reopenedClose = await metrics(close);
          assertDensity(observations.reopenedClose as Awaited<ReturnType<typeof metrics>>);
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'hidden' });
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          observations.inputJourney =
            'Native top-inset Trigger and Close pointer activation, reopen and Escape completed. No single-Tab order assumption.';
          stage = 'root32';
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '32px';
          });
          await trigger.scrollIntoViewIfNeeded();
          const scaledTrigger = await metrics(trigger);
          observations.root32Trigger = scaledTrigger;
          assertDensity(scaledTrigger);
          expect(scaledTrigger.rootFont).toBe('32px');
          await clickTopInset(page, trigger, pointerInputs, stage);
          await panelFor(page, trigger);
          const scaledClose = await metrics(close);
          observations.root32Close = scaledClose;
          expect(scaledClose.rootFont).toBe('32px');
          assertDensity(scaledClose);
          observations.root32 = {
            trigger: scaledTrigger,
            close: scaledClose,
            limit: 'Root-text scaling only, not physical browser zoom.',
          };
          await capture('root32', observations.root32);
          await close.click();
          await panel.waitFor({ state: 'hidden' });
          expect(errors).toEqual([]);
          expect(deniedRequests).toEqual([]);
          result = 'passed';
        } catch (error) {
          failure = String(error);
          if (page)
            try {
              const file = `${id}-failure.png`,
                bytes = await page.screenshot({ path: path.join(output, file), timeout: 5_000 });
              screenshots.push({
                candidate,
                stage,
                file,
                sha256: createHash('sha256').update(bytes).digest('hex'),
              });
            } catch (captureError) {
              errors.push(`failure capture: ${String(captureError)}`);
            }
          throw error;
        } finally {
          try {
            await writeJson(`${id}.json`, {
              candidate,
              references,
              demoId,
              runtime,
              scheme,
              stage,
              result,
              failure,
              observations,
              pointerInputs,
              screenshots,
              errors,
              deniedRequests,
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
