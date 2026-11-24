// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  chromeExecutable,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const route = '/zh-cn/ui-libraries/shadcn/carousel/';
const output = process.env.PROTO_UI_CAROUSEL_EVIDENCE;
const viewports = [
  { name: 'desktop', width: 1100, height: 850 },
  { name: 'mobile', width: 375, height: 812 },
] as const;
const cases = [
  ...RUNTIMES.flatMap((runtime) =>
    viewports.map((viewport) => ({ runtime, viewport, colorScheme: 'light' as const }))
  ),
  {
    runtime: 'react' as const,
    viewport: { name: 'small-mobile', width: 320, height: 740 },
    colorScheme: 'light' as const,
  },
  { runtime: 'react' as const, viewport: viewports[0], colorScheme: 'dark' as const },
];

let browser: Browser;
let baseUrl: string;

beforeAll(async () => {
  // Bind page evidence to the server this suite starts from its own checkout.
  // An arbitrary shared deployment cannot be certified by our local source SHA.
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error(
      'Carousel documentation evidence requires its own source-bound server; PROTO_UI_BROWSER_BASE_URL is unsupported.'
    );
  if (output) {
    await mkdir(output, { recursive: true });
    const files = [
      'apps/www/src/content/docs/zh-cn/demo-shadcn-carousel.demo.ts',
      'apps/www/src/content/docs/zh-cn/demo-shadcn-carousel.browser.test.ts',
      'packages/prototypes/shadcn/src/carousel/carousel.proto.ts',
      'packages/prototypes/shadcn/src/carousel/visual.ts',
      'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    ];
    await writeFile(
      path.join(output, 'source.json'),
      JSON.stringify(
        {
          revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          worktreeStatus: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }),
          files: await Promise.all(
            files.map(async (file) => ({
              file,
              sha256: createHash('sha256')
                .update(await readFile(file))
                .digest('hex'),
            }))
          ),
          route,
          boundary:
            "Real documentation demo and four Web adapters on this checkout's own server; Chromium geometry, computed styles, pointer and keyboard. No OS screen-reader or non-Web acceptance.",
        },
        null,
        2
      ) + '\n'
    );
  }
  baseUrl = await startServer([route]);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
    // Playwright normally suppresses native chrome in headless mode. Keep it
    // available so the component, not the browser launch flags, hides the bar.
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
}, 150_000);

afterAll(async () => {
  const errors: unknown[] = [];
  try {
    await browser?.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await stopServer();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, 'Carousel browser/server cleanup failed');
}, 60_000);

const part = (previewer: Locator, ref: string) =>
  previewer.locator(`.host [data-demo-ref="${ref}"]`);
const offset = (viewport: Locator) => viewport.evaluate((element) => element.scrollLeft);
const disabled = (control: Locator) =>
  control.evaluate((element) => element.matches(':disabled, [aria-disabled="true"]'));

async function geometry(previewer: Locator) {
  // Playwright CSS locators cross open ShadowRoots. DOM querySelector does not,
  // so measure the actual SVG here rather than assuming an icon's host policy.
  const icons = await Promise.all(
    ['previous', 'next'].map((ref) =>
      part(previewer, ref)
        .locator('svg')
        .evaluate((svg) => {
          const rect = svg.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        })
    )
  );
  return previewer.evaluate((element, icons) => {
    const find = (ref: string) => {
      const matches = element.querySelectorAll<HTMLElement>(`.host [data-demo-ref="${ref}"]`);
      if (matches.length !== 1)
        throw new Error(`Expected one Carousel ${ref}, got ${matches.length}`);
      return matches[0]!;
    };
    const box = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const preview = element.querySelector('.proto-previewer__preview');
    if (!preview) throw new Error('The real documentation preview surface is missing');
    const viewport = find('viewport');
    const css = getComputedStyle(viewport);
    // wc-registry uses the direct WC profile. These non-native-control refs
    // identify the actual visual/Scroll surface, just as in React/Vue/Vue 2.
    const controls = ['previous', 'next'].map((ref, index) => {
      const node = find(ref);
      return {
        ref,
        rect: box(node),
        icon: icons[index]!,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      };
    });
    const cards = [0, 1, 2].map((index) => {
      const node = find(`card-${index}`);
      const style = getComputedStyle(node);
      return {
        rect: box(node),
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
      };
    });
    return {
      preview: box(preview),
      root: box(find('carousel')),
      viewport: {
        rect: box(viewport),
        scrollbarWidth: css.scrollbarWidth,
        overflowX: css.overflowX,
        clientWidth: viewport.clientWidth,
        scrollWidth: viewport.scrollWidth,
        scrollLeft: viewport.scrollLeft,
        horizontalScrollbarHeight:
          viewport.offsetHeight -
          viewport.clientHeight -
          parseFloat(css.borderTopWidth) -
          parseFloat(css.borderBottomWidth),
      },
      controls,
      cards,
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      windowWidth: innerWidth,
      theme: document.documentElement.dataset.theme,
    };
  }, icons);
}

type Geometry = Awaited<ReturnType<typeof geometry>>;

function assertLayout(facts: Geometry) {
  expect(facts.documentWidth, 'the page stays within the viewport').toBeLessThanOrEqual(
    facts.windowWidth + 1
  );
  expect(facts.root.width).toBeGreaterThan(0);
  expect(facts.viewport.clientWidth).toBeGreaterThan(0);
  expect(facts.viewport.scrollWidth, 'the strip still has a native scroll range').toBeGreaterThan(
    facts.viewport.clientWidth + 1
  );
  expect(['auto', 'scroll']).toContain(facts.viewport.overflowX);
  expect(facts.viewport.scrollbarWidth, 'composed chrome hides the native scrollbar').toBe('none');
  expect(facts.viewport.horizontalScrollbarHeight).toBeLessThanOrEqual(1);

  for (const control of facts.controls) {
    expect(control.rect.width, `${control.ref} target`).toBeGreaterThanOrEqual(24);
    expect(control.rect.height, `${control.ref} target`).toBeGreaterThanOrEqual(24);
    expect(control.rect.left, `${control.ref} stays inside the preview`).toBeGreaterThanOrEqual(
      facts.preview.left - 1
    );
    expect(control.rect.right, `${control.ref} stays inside the preview`).toBeLessThanOrEqual(
      facts.preview.right + 1
    );
    expect(control.rect.top).toBeGreaterThanOrEqual(facts.preview.top - 1);
    expect(control.rect.bottom).toBeLessThanOrEqual(facts.preview.bottom + 1);
    expect(control.scrollWidth, `${control.ref} label does not overflow`).toBeLessThanOrEqual(
      control.clientWidth + 1
    );
    expect(control.scrollHeight).toBeLessThanOrEqual(control.clientHeight + 1);
    expect(control.icon, `${control.ref} displays an SVG arrow`).not.toBeNull();
    expect(control.icon!.width).toBeGreaterThan(0);
    expect(control.icon!.height).toBeGreaterThan(0);
    expect(control.icon!.left).toBeGreaterThanOrEqual(control.rect.left);
    expect(control.icon!.right).toBeLessThanOrEqual(control.rect.right);
    expect(control.icon!.top).toBeGreaterThanOrEqual(control.rect.top);
    expect(control.icon!.bottom).toBeLessThanOrEqual(control.rect.bottom);
  }
  expect(facts.controls[0]!.rect.right).toBeLessThanOrEqual(facts.viewport.rect.left);
  expect(facts.controls[1]!.rect.left).toBeGreaterThanOrEqual(facts.viewport.rect.right);
  for (const card of facts.cards) {
    expect(card.rect.width, 'each real Card has a visible extent').toBeGreaterThan(0);
    expect(card.rect.height).toBeGreaterThanOrEqual(96);
    expect(card.rect.width).toBeLessThanOrEqual(facts.viewport.rect.width + 1);
    expect(card.boxShadow, 'Rhea Card retains its ring/shadow').not.toBe('none');
    expect(card.boxShadow).not.toBe('');
    expect(parseFloat(card.borderRadius)).toBeGreaterThan(0);
    expect(card.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  }
  expect(
    facts.cards[1]!.rect.left - facts.cards[0]!.rect.right,
    'separate cards have a gap'
  ).toBeGreaterThan(0);
}

// P-SHADCN-CAROUSEL-PRESENTATION: actual rendered composition and retained input.
describe('Shadcn Carousel documentation layout and navigation', () => {
  it.each(cases)(
    '$runtime $viewport.name $colorScheme keeps fitted controls, Cards and native navigation',
    async ({ runtime, viewport: size, colorScheme }) => {
      const id = `${runtime}-${size.name}-${colorScheme}`;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        colorScheme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const record: Record<string, unknown> = {
        id,
        runtime,
        viewport: size,
        colorScheme,
        browser: browser.version(),
        pageErrors,
      };
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const previewer = page.locator('[data-demo-id="demo-shadcn-carousel"]');
        await selectRuntime(page, previewer, runtime, '[data-demo-ref="carousel"]', 1);
        await previewer.scrollIntoViewIfNeeded();
        const viewport = part(previewer, 'viewport');
        const previous = part(previewer, 'previous');
        const next = part(previewer, 'next');
        await expect.poll(() => disabled(previous)).toBe(true);
        await expect.poll(() => disabled(next)).toBe(false);
        await expect.poll(() => offset(viewport)).toBe(0);
        expect(
          await previewer.getByRole('button', { name: 'Previous slide', exact: true }).count()
        ).toBe(1);
        expect(
          await previewer.getByRole('button', { name: 'Next slide', exact: true }).count()
        ).toBe(1);
        expect(await previous.locator('svg').isVisible()).toBe(true);
        expect(await next.locator('svg').isVisible()).toBe(true);
        expect(await part(previewer, 'card-0').isVisible()).toBe(true);

        const initial = await geometry(previewer);
        record.initial = initial;
        expect(initial.theme).toBe(colorScheme);
        assertLayout(initial);
        if (output) await previewer.screenshot({ path: path.join(output, `${id}-initial.png`) });

        await next.click();
        await expect.poll(() => offset(viewport)).toBeGreaterThan(1);
        await expect.poll(() => disabled(previous)).toBe(false);
        const afterNext = await geometry(previewer);
        record.afterNext = afterNext;
        expect(afterNext.cards[0]!.rect.left, 'Next actually moves the cards').toBeLessThan(
          initial.cards[0]!.rect.left - 1
        );
        await previous.click();
        await expect.poll(() => offset(viewport)).toBeLessThanOrEqual(1);
        await expect.poll(() => disabled(previous)).toBe(true);

        await viewport.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => offset(viewport)).toBeGreaterThan(1);
        await page.keyboard.press('Home');
        await expect.poll(() => offset(viewport)).toBeLessThanOrEqual(1);
        await page.keyboard.press('End');
        await expect.poll(() => disabled(next)).toBe(true);
        await expect
          .poll(() =>
            viewport.evaluate((node) =>
              Math.abs(node.scrollWidth - node.clientWidth - node.scrollLeft)
            )
          )
          .toBeLessThanOrEqual(1);
        record.atEnd = await geometry(previewer);
        if (output) await previewer.screenshot({ path: path.join(output, `${id}-end.png`) });
        await page.keyboard.press('Home');
        await expect.poll(() => disabled(previous)).toBe(true);
        await expect.poll(() => offset(viewport)).toBeLessThanOrEqual(1);
        expect(pageErrors).toEqual([]);
        record.status = 'passed';
      } catch (error) {
        record.status = 'failed';
        record.error = String(error);
        if (output)
          await page.screenshot({ path: path.join(output, `${id}-failure.png`) }).catch(() => {});
        throw error;
      } finally {
        try {
          if (output)
            await writeFile(
              path.join(output, `${id}.json`),
              JSON.stringify(record, null, 2) + '\n'
            );
        } finally {
          await context.close();
        }
      }
    },
    60_000
  );
});
