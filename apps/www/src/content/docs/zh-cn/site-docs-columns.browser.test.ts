// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright-core';
import { launchBrowser, startServer, stopServer } from './browser-harness';
let browser: Browser;
let baseUrl: string;
let source: {
  sha: string;
  headTree: string;
  dirty: boolean;
  trackedDiffSha256: string;
  untrackedFiles: Array<{ path: string; sha256: string }>;
  candidateFiles: Array<{ path: string; sha256: string }>;
};
const candidatePaths = [
  'apps/www/src/components/override/PageFrame.astro',
  'apps/www/src/components/override/TwoColumnContent.astro',
  'apps/www/src/components/site-docs-columns.test.ts',
  'apps/www/src/components/site-header-layout.test.ts',
  'apps/www/src/content/docs/zh-cn/site-docs-columns.browser.test.ts',
  'scripts/test/runtime-test-plan.mjs',
];
const evidence = path.join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
    path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence'),
  'docs-columns'
);
beforeAll(async () => {
  const digestFile = (file: string) => ({
    path: file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  });
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    headTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    // HEAD alone is not a dirty worktree's identity. Retain the actual tracked
    // diff and untracked-content digests plus every scoped candidate file.
    trackedDiffSha256: createHash('sha256')
      .update(execFileSync('git', ['diff', '--binary', 'HEAD', '--']))
      .digest('hex'),
    untrackedFiles: execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean)
      .sort()
      .map(digestFile),
    candidateFiles: candidatePaths.map(digestFile),
  };
  if (process.env.PROTO_UI_EXPECTED_HEAD)
    expect(source.sha).toBe(process.env.PROTO_UI_EXPECTED_HEAD);
  if (process.env.CI) expect(source.dirty).toBe(false);
  await mkdir(evidence, { recursive: true });
  baseUrl = await startServer('/en/ui-libraries/shadcn/card/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
async function measure(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.docs-shell')!;
    const columns = document.querySelector<HTMLElement>('.docs-reading-columns')!;
    const left = document.querySelector<HTMLElement>('.docs-sidebar')!;
    const main = columns.querySelector<HTMLElement>('.main-pane')!;
    const right = columns.querySelector<HTMLElement>('.right-sidebar-container')!;
    const innerRight = right.querySelector<HTMLElement>('.right-sidebar')!;
    const paragraph = main.querySelector<HTMLElement>('[data-doc-flow] > p');
    const style = getComputedStyle(shell);
    const box = (element: HTMLElement) => {
      const r = element.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    return {
      cssViewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      visualViewport: window.visualViewport
        ? {
            width: window.visualViewport.width,
            height: window.visualViewport.height,
            scale: window.visualViewport.scale,
          }
        : null,
      xlMediaMatches: matchMedia('(min-width: 80rem)').matches,
      textSizing: 'explicit inline html font-size; not browser zoom or default-font preference',
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      viewport: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shell: box(shell),
      left: box(left),
      leftOwner: {
        position: getComputedStyle(left).position,
        overflowY: getComputedStyle(left).overflowY,
        scrollTop: left.scrollTop,
        clientHeight: left.clientHeight,
        scrollHeight: left.scrollHeight,
      },
      main: box(main),
      paragraph: paragraph ? box(paragraph) : null,
      right: box(right),
      rightOwner: {
        position: getComputedStyle(right).position,
        overflowY: getComputedStyle(right).overflowY,
        top: parseFloat(getComputedStyle(right).top),
        scrollTop: right.scrollTop,
        clientHeight: right.clientHeight,
        scrollHeight: right.scrollHeight,
        innerPosition: getComputedStyle(innerRight).position,
        innerOverflowY: getComputedStyle(innerRight).overflowY,
        innerPaddingTop: parseFloat(getComputedStyle(innerRight).paddingTop),
      },
      gutter: parseFloat(style.paddingLeft),
      canvas: shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      mode: getComputedStyle(columns).display,
      rightVisible:
        getComputedStyle(right).display !== 'none' && right.getBoundingClientRect().width > 0,
      tocLinkWidths: [...right.querySelectorAll<HTMLElement>('a[href]')].map(
        (link) => link.getBoundingClientRect().width
      ),
      tocCount: columns.querySelectorAll('sl-toc').length,
      currentCount: left.querySelectorAll('a[aria-current="page"]').length,
      focused: document.activeElement?.tagName,
      scrollY,
    };
  });
}
async function settleNativeScroll(page: Page) {
  await page.evaluate(async () => {
    const left = document.querySelector<HTMLElement>('.docs-sidebar')!;
    const right = document.querySelector<HTMLElement>('.right-sidebar-container')!;
    let previous = '',
      stable = 0;
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const current = `${scrollY}:${left.scrollTop}:${right.scrollTop}`;
      stable = current === previous ? stable + 1 : 0;
      if (stable >= 3) return;
      previous = current;
    }
    throw new Error('Native rail/document scrolling did not settle within 120 frames');
  });
}
// Expected user-visible behavior comes from the upstream viewport policy and
// readable article requirements, not a reimplementation of the CSS66rem guard.
// Inline font tests must not be described as browser zoom or default-font tests.
const scenarios = [
  { width: 320, root: 16, toc: 'hidden', locale: 'en' },
  { width: 390, root: 24, toc: 'hidden', locale: 'en' },
  { width: 1188, root: 16, toc: 'hidden', locale: 'en' },
  { width: 1279, root: 16, toc: 'hidden', locale: 'en' },
  { width: 1280, root: 16, toc: 'right', locale: 'en' },
  { width: 1440, root: 16, toc: 'right', locale: 'en' },
  { width: 1440, root: 20, toc: 'right', locale: 'en' },
  { width: 1440, root: 24, toc: 'hidden', locale: 'en' },
  { width: 1440, root: 32, toc: 'hidden', locale: 'en' },
  { width: 1920, root: 16, toc: 'right', locale: 'en' },
  { width: 1920, root: 24, toc: 'right', locale: 'en' },
  { width: 1440, root: 16, toc: 'right', locale: 'zh-cn' },
  { width: 1440, root: 20, toc: 'right', locale: 'zh-cn' },
] as const;
for (const family of ['shadcn', 'brutalist'] as const)
  for (const theme of ['light', 'dark'] as const)
    it(`${family}/${theme} keeps the TOC on the right or hidden, never above readable prose`, async () => {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1000 },
        colorScheme: theme,
        deviceScaleFactor: 1,
      });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(baseUrl).origin
          ? route.continue()
          : route.abort()
      );
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      try {
        const article = family === 'shadcn' ? 'card/' : 'components/card/';
        const response = await page.goto(`${baseUrl}/en/ui-libraries/${family}/${article}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.status()).toBe(200);
        for (const { width, root, toc, locale } of scenarios) {
          const route = `/${locale}/ui-libraries/${family}/${article}`;
          if (new URL(page.url()).pathname !== route) {
            const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
            expect(response?.status()).toBe(200);
          }
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate((root) => {
            document.documentElement.style.fontSize = `${root}px`;
          }, root);
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
          });
          const metrics = await measure(page);
          const id = `${locale}-${family}-${theme}-${width}-root${root}`;
          await writeFile(
            path.join(evidence, `${id}.json`),
            JSON.stringify(
              { source, route: new URL(page.url()).pathname, metrics, pageErrors },
              null,
              2
            )
          );
          await page.screenshot({ path: path.join(evidence, `${id}.png`) });
          expect(metrics.overflow).toBeLessThanOrEqual(1);
          expect(metrics.main.width).toBeLessThanOrEqual(42 * root + 1);
          expect(metrics.main.width).toBeGreaterThan(0);
          expect(metrics.currentCount).toBe(1);
          expect(metrics.cssViewport.width).toBe(width);
          expect(metrics.root).toBe(root);
          expect(metrics.devicePixelRatio).toBe(1);
          expect(metrics.visualViewport?.scale).toBe(1);
          if (toc === 'right') {
            expect(metrics.xlMediaMatches).toBe(true);
            expect(metrics.mode).toBe('grid');
            expect(metrics.main.width / root).toBeGreaterThanOrEqual(28);
            expect(metrics.paragraph, 'the real article must expose readable prose').not.toBeNull();
            expect(metrics.paragraph!.width / root).toBeGreaterThanOrEqual(24);
            if (width === 1440 && root === 20)
              expect(metrics.main.width / root).toBeGreaterThanOrEqual(30);
            expect(metrics.right.bottom).toBeGreaterThan(metrics.main.top);
            expect(metrics.right.top).toBeLessThan(metrics.main.bottom);
            expect(metrics.tocLinkWidths.length).toBeGreaterThan(0);
            for (const width of metrics.tocLinkWidths)
              expect(width / root).toBeGreaterThanOrEqual(12);
            expect(metrics.left.left).toBeCloseTo(metrics.gutter, 0);
            expect(metrics.right.right).toBeCloseTo(metrics.viewport - metrics.gutter, 0);
            expect(metrics.left.right).toBeLessThan(metrics.main.left);
            expect(metrics.main.right).toBeLessThan(metrics.right.left);
            expect(metrics.right.width).toBeCloseTo(18 * root, 0);
            expect(metrics.rightVisible).toBe(true);
            expect(metrics.rightOwner.position).toBe('sticky');
            expect(metrics.rightOwner.overflowY).toBe('auto');
            expect(metrics.rightOwner.innerPosition).toBe('static');
            expect(metrics.rightOwner.innerOverflowY).toBe('visible');
            expect(metrics.rightOwner.innerPaddingTop).toBe(0);
          } else {
            expect(metrics.rightVisible).toBe(false);
            expect(metrics.right.width).toBe(0);
            if (width >= 1280) {
              // Even at200% inline text size the article must retain a usable
              // reading width. Passing merely because it has nonzero width is
              // not sufficient; the hidden TOC must also relinquish its track.
              expect(metrics.mode).toBe('grid');
              expect(metrics.main.width / root).toBeGreaterThanOrEqual(24);
              expect(metrics.paragraph, 'enlargement must not crush actual prose').not.toBeNull();
              expect(metrics.paragraph!.width / root).toBeGreaterThanOrEqual(24);
              expect(metrics.leftOwner.position).toBe('sticky');
              expect(metrics.left.right).toBeLessThan(metrics.main.left);
            }
            if (width < 1024) {
              expect(metrics.main.left).toBeGreaterThanOrEqual(metrics.gutter - 1);
              expect(metrics.main.right).toBeLessThanOrEqual(metrics.viewport - metrics.gutter + 1);
            }
          }
          expect(metrics.tocCount).toBe(1);
        }
        expect(pageErrors).toEqual([]);
      } catch (error) {
        await writeFile(
          path.join(evidence, `${family}-${theme}-failure.json`),
          JSON.stringify({ source, url: page.url(), error: String(error), pageErrors }, null, 2)
        ).catch((captureError) =>
          console.error('Column failure metadata capture failed', String(captureError))
        );
        await page
          .screenshot({ path: path.join(evidence, `${family}-${theme}-failure.png`) })
          .catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }, 180_000);

for (const locale of ['en', 'zh-cn'])
  it(`${locale} keeps actual long-TOC and left-rail wheel scrolling independent from the document`, async () => {
    // Existing authored prose supplies real heading/link geometry. A short
    // viewport produces natural overflow; no fake rows, CSS or scroll offsets.
    const context = await browser.newContext({
      viewport: { width: 1920, height: 360 },
      colorScheme: 'light',
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(baseUrl).origin
        ? route.continue()
        : route.abort()
    );
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    const id = `${locale}-native-rail-scroll`;
    const samples: Array<{ stage: string; metrics: Awaited<ReturnType<typeof measure>> }> = [];
    const capture = async (stage: string) => {
      samples.push({ stage, metrics: await measure(page) });
      await writeFile(
        path.join(evidence, `${id}.json`),
        JSON.stringify(
          { source, url: page.url(), input: 'native mouse wheel', samples, pageErrors },
          null,
          2
        )
      );
      await page.screenshot({ path: path.join(evidence, `${id}-${stage}.png`) });
      return samples[samples.length - 1]!.metrics;
    };
    try {
      const response = await page.goto(`${baseUrl}/${locale}/build/contracts-and-tests/`, {
        waitUntil: 'networkidle',
      });
      expect(response?.status()).toBe(200);
      await page.locator('.right-sidebar a[data-site-link-enhanced]').first().waitFor();
      const before = await capture('before');
      expect(before.rightOwner.overflowY).toBe('auto');
      expect(before.rightOwner.scrollHeight).toBeGreaterThan(before.rightOwner.clientHeight);
      await page.mouse.move(before.right.left + before.right.width / 2, before.right.top + 80);
      await page.mouse.wheel(0, 80);
      await expect.poll(async () => (await measure(page)).rightOwner.scrollTop).toBeGreaterThan(0);
      await settleNativeScroll(page);
      const afterRight = await capture('right-wheel');
      expect(afterRight.scrollY).toBe(before.scrollY);

      const left = page.locator('.docs-sidebar');
      const leftBefore = await left.evaluate((element) => ({
        top: element.scrollTop,
        max: element.scrollHeight - element.clientHeight,
      }));
      expect(leftBefore.max).toBeGreaterThan(0);
      const delta = leftBefore.top > 40 ? -40 : 40;
      await page.mouse.move(
        afterRight.left.left + afterRight.left.width / 2,
        afterRight.left.top + 80
      );
      await page.mouse.wheel(0, delta);
      await expect
        .poll(() => left.evaluate((element) => element.scrollTop))
        .not.toBe(leftBefore.top);
      await settleNativeScroll(page);
      const afterLeft = await capture('left-wheel');
      expect(afterLeft.scrollY).toBe(before.scrollY);
      expect(afterLeft.rightOwner.scrollTop).toBe(afterRight.rightOwner.scrollTop);

      // Scrolling the prose is a separate native stimulus. Both rails remain
      // at their measured sticky offsets while the document actually moves.
      await page.mouse.move(
        afterLeft.main.left + afterLeft.main.width / 2,
        afterLeft.right.top + 100
      );
      await page.mouse.wheel(0, 240);
      await expect.poll(async () => (await measure(page)).scrollY).toBeGreaterThan(before.scrollY);
      await settleNativeScroll(page);
      const afterDocument = await capture('document-wheel');
      expect(afterDocument.right.top).toBeCloseTo(afterDocument.rightOwner.top, 0);
      expect(afterDocument.left.top).toBeCloseTo(afterDocument.right.top, 0);
      expect(afterDocument.rightOwner.innerPaddingTop).toBe(0);
      expect(afterDocument.overflow).toBeLessThanOrEqual(1);
      expect(pageErrors).toEqual([]);
    } catch (error) {
      await writeFile(
        path.join(evidence, `${id}-failure.json`),
        JSON.stringify(
          { source, url: page.url(), samples, pageErrors, error: String(error) },
          null,
          2
        )
      );
      await page.screenshot({ path: path.join(evidence, `${id}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }, 90_000);

it('keeps library overview and long-prose routes bounded in both locales without JavaScript', async () => {
  for (const locale of ['en', 'zh-cn']) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 900 },
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(baseUrl).origin
        ? route.continue()
        : route.abort()
    );
    const page = await context.newPage();
    try {
      for (const route of ['ui-libraries/', 'start-here/why-proto-ui/']) {
        await page.goto(`${baseUrl}/${locale}/${route}`, { waitUntil: 'networkidle' });
        const geometry = await page.evaluate(() => {
          const main = document.querySelector<HTMLElement>('.main-pane')!;
          const nav = document.querySelector<HTMLElement>('.mobile-sidebar-pane')!;
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            mainWidth: main.getBoundingClientRect().width,
            navVisible: getComputedStyle(nav).display !== 'none',
            headerPosition: getComputedStyle(document.querySelector('header')!).position,
            anchors: [...nav.querySelectorAll('a[href]')].length,
          };
        });
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.mainWidth).toBeGreaterThan(0);
        expect(geometry.navVisible).toBe(true);
        expect(geometry.headerPosition).toBe('static');
        expect(geometry.anchors).toBeGreaterThan(0);
      }
    } finally {
      await context.close();
    }
  }
}, 150_000);

it('keeps the existing no-TOC splash measure independent from the prose grid', async () => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(baseUrl).origin
      ? route.continue()
      : route.abort()
  );
  const page = await context.newPage();
  const id = 'nojs-splash-no-toc';
  try {
    await page.goto(`${baseUrl}/en/internal/demo-matrix/`, { waitUntil: 'networkidle' });
    const facts = await page.locator('.docs-reading-columns').evaluate((columns) => {
      const main = columns.querySelector<HTMLElement>('.main-pane')!;
      return {
        layout: columns.getAttribute('data-layout'),
        tocCount: columns.querySelectorAll('.right-sidebar-container').length,
        maxWidth: getComputedStyle(main).maxWidth,
        width: main.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await writeFile(
      path.join(evidence, `${id}.json`),
      JSON.stringify({ source, url: page.url(), facts }, null, 2)
    );
    await page.screenshot({ path: path.join(evidence, `${id}.png`) });
    expect(facts.layout).toBe('splash');
    expect(facts.tocCount).toBe(0);
    expect(parseFloat(facts.maxWidth)).toBe(88 * 16);
    expect(facts.width).toBeGreaterThan(0);
    expect(facts.overflow).toBeLessThanOrEqual(1);
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, `${id}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}, 150_000);
