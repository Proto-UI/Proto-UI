// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

// Consumer-owned layout (C-HOST-SURFACE-PROJECTION-0001-C/F) must survive
// Runtime-only selection. P-BASE-ACCORDION-CONTENT-PRESENCE still owns hiding.
const route = '/en/ui-libraries/base/accordion/';
const sequence = ['wc', 'react', 'vue', 'vue2', 'wc'] as const;
const directory =
  process.env.PROTO_UI_ACCORDION_LAYOUT_EVIDENCE_DIR ??
  path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? os.tmpdir(), 'base-accordion-layout');
let browser: Browser;
let baseUrl: string;
let source: { sha: string; dirty: boolean };
const ref = (previewer: Locator, name: string) =>
  previewer.locator(`.host [data-demo-ref="${name}"]`);

beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(
      execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
        encoding: 'utf8',
      }).trim()
    ),
  };
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}
async function expanded(trigger: Locator, value: boolean) {
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe(String(value));
}
async function geometry(previewer: Locator) {
  return previewer.locator('.host').evaluate((host) => {
    const get = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`);
    const origin = get('single')!.getBoundingClientRect();
    const names = [
      'single',
      'single-overview-trigger',
      'single-overview-content',
      'nested',
      'nested-overview-trigger',
      'nested-overview-content',
      'single-lifetime-trigger',
      'multiple',
      'multiple-a-trigger',
      'multiple-a-content',
      'multiple-b-trigger',
      'multiple-b-content',
    ];
    return {
      rootFont: getComputedStyle(document.documentElement).fontSize,
      theme: document.documentElement.dataset.theme,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      boxes: names.map((name) => {
        const element = get(name);
        // Physical detach differs by Adapter. Compare paint geometry, keeping
        // the independent keepMounted assertions below for retained content.
        if (!element?.getClientRects().length) return { name, box: null, style: null };
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return {
          name,
          box: {
            x: rect.x - origin.x,
            y: rect.y - origin.y,
            width: rect.width,
            height: rect.height,
          },
          style: {
            display: css.display,
            paddingTop: css.paddingTop,
            paddingBottom: css.paddingBottom,
            paddingLeft: css.paddingLeft,
            paddingRight: css.paddingRight,
            font: css.fontFamily,
            size: css.fontSize,
            lineHeight: css.lineHeight,
          },
        };
      }),
    };
  });
}
type Geometry = Awaited<ReturnType<typeof geometry>>;
function paired(expected: Geometry, actual: Geometry, label: string) {
  expect([actual.rootFont, actual.theme]).toEqual([expected.rootFont, expected.theme]);
  expect(actual.boxes.map((entry) => entry.name)).toEqual(
    expected.boxes.map((entry) => entry.name)
  );
  actual.boxes.forEach((entry, index) => {
    const previous = expected.boxes[index]!;
    expect(entry.style, `${label}/${entry.name}`).toEqual(previous.style);
    if (!previous.box) expect(entry.box, `${label}/${entry.name}`).toBeNull();
    else {
      expect(entry.box, `${label}/${entry.name}`).not.toBeNull();
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(
          Math.abs(entry.box![key] - previous.box[key]),
          `${label}/${entry.name}/${key}`
        ).toBeLessThanOrEqual(1);
    }
  });
}
async function retained(previewer: Locator, value: 'a' | 'b', open: boolean) {
  const panel = ref(previewer, `multiple-${value}-content`);
  expect(await panel.count()).toBe(1);
  await expect.poll(() => panel.getAttribute('aria-hidden')).toBe(String(!open));
  await expect.poll(() => panel.isVisible()).toBe(open);
  expect(await panel.evaluate((el) => getComputedStyle(el).display)).toBe(open ? 'block' : 'none');
}

describe.sequential('Base Accordion paired native content layout', () => {
  for (const width of [1280, 390]) {
    it(`${width}px: keeps nested padding and vertical geometry through four Runtimes and a WC round trip`, async () => {
      const { context, page, previewer } = await openRoute(browser, baseUrl, route, {
        width,
        height: 1000,
      });
      const baselines = new Map<string, Geometry>();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        await applyColorScheme(page, 'light');
        for (const [index, runtime] of sequence.entries()) {
          await selectRuntime(page, previewer, runtime, '[aria-expanded]', 11);
          const first = ref(previewer, 'single-overview-trigger');
          const nested = ref(previewer, 'nested-overview-trigger');
          const capture = async (state: string, subject = 'single') => {
            await settled(page);
            const facts = await geometry(previewer);
            const name = `${source.sha.slice(0, 12)}-${width}-${index}-${runtime}-${state}`;
            await writeFile(
              path.join(directory, `${name}.json`),
              JSON.stringify(
                {
                  source,
                  url: page.url(),
                  viewport: page.viewportSize(),
                  runtime,
                  state,
                  capturedAt: new Date().toISOString(),
                  pageErrors: [...pageErrors],
                  facts,
                },
                null,
                2
              )
            );
            await ref(previewer, subject).screenshot({
              path: path.join(directory, `${name}.png`),
              style: 'astro-dev-toolbar { visibility: hidden; }',
            });
            expect(facts.pageOverflow).toBeLessThanOrEqual(1);
            const baseline = baselines.get(state);
            if (baseline) paired(baseline, facts, `${runtime}/${state}`);
            else baselines.set(state, facts);
            return facts;
          };
          await expanded(first, true);
          const initial = await capture('initial-open');
          const content = initial.boxes.find((entry) => entry.name === 'single-overview-content')!;
          const nestedBox = initial.boxes.find((entry) => entry.name === 'nested')!;
          expect(content.style?.display).toBe('block');
          expect(parseFloat(content.style!.paddingLeft)).toBe(0.75 * parseFloat(initial.rootFont));
          expect(
            Math.abs(nestedBox.box!.x - content.box!.x - parseFloat(content.style!.paddingLeft))
          ).toBeLessThanOrEqual(1);
          await retained(previewer, 'a', true);
          await retained(previewer, 'b', false);
          await nested.click();
          await expanded(nested, true);
          await capture('nested-open');
          expect(
            await ref(previewer, 'nested-overview-content').evaluate(
              (el) => getComputedStyle(el).display
            )
          ).toBe('block');
          await nested.click();
          await expanded(nested, false);
          await first.click();
          await expanded(first, false);
          await capture('parent-closed');
          await first.click();
          await expanded(first, true);
          const reopened = await capture('parent-reopened');
          paired(initial, reopened, `${runtime}/close-reopen`);
          await ref(previewer, 'multiple-b-trigger').click();
          await expanded(ref(previewer, 'multiple-b-trigger'), true);
          await ref(previewer, 'multiple-a-trigger').click();
          await expanded(ref(previewer, 'multiple-a-trigger'), false);
          await capture('retained-b-only', 'multiple');
          await retained(previewer, 'a', false);
          await retained(previewer, 'b', true);
          await ref(previewer, 'multiple-a-trigger').click();
          await expanded(ref(previewer, 'multiple-a-trigger'), true);
          await ref(previewer, 'multiple-b-trigger').click();
          await expanded(ref(previewer, 'multiple-b-trigger'), false);
          await capture('retained-restored', 'multiple');
          await retained(previewer, 'a', true);
          await retained(previewer, 'b', false);
          expect.soft(pageErrors, `${runtime}: no teardown or runtime errors`).toEqual([]);
          pageErrors.length = 0;
        }
      } finally {
        await context.close();
      }
    }, 180_000);
  }
});
