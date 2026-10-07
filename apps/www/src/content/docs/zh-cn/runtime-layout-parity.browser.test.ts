// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  choosePreviewRuntime,
  launchBrowser,
  startServer,
  stopServer,
  type RuntimeId,
} from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';

// Same recipe, locale, family, theme, font readiness and viewport. Pairwise
// geometry is deliberately separate from Happy DOM's display-input evidence.
const sequence = ['wc', 'react', 'vue', 'vue2', 'wc'] as const;
const runtimeLabels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
const directory =
  process.env.PUI_RUNTIME_LAYOUT_EVIDENCE_DIR ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence', 'runtime-layout');
let browser: Browser;
let baseUrl: string;
let source: { sha: string; dirty: boolean };

beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

async function settledFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function chooseHome(page: Page, control: 'runtime' | 'family', value: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${control}"] [role="combobox"]`
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: value, exact: true })
    .click();
}

async function homeReady(page: Page, runtime: RuntimeId, family: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const header = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const home = document.querySelector<HTMLElement>('[data-home-showcase]');
      return (
        header?.dataset.runtimeState === 'ready' &&
        header.dataset.runtime === runtime &&
        header.dataset.family === family &&
        home?.dataset.runnerState === 'ready' &&
        home.dataset.runnerRuntime === runtime &&
        home.dataset.projectionFamily === family &&
        home.querySelectorAll('[data-home-gallery]').length === 1 &&
        home.querySelector('[data-home-demo-host]')?.getAttribute('aria-busy') === 'false'
      );
    },
    { runtime, family },
    { timeout: 45_000 }
  );
  const menu = page.locator(
    '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
  );
  if ((await menu.count()) && (await menu.getAttribute('aria-expanded')) === 'true')
    await menu.click();
  await settledFonts(page);
}

async function galleryGeometry(home: Locator) {
  return home.evaluate((home) => {
    const gallery = home.querySelector<HTMLElement>('[data-home-gallery]')!;
    const origin = gallery.getBoundingClientRect();
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
    };
    const text = [...gallery.querySelectorAll<HTMLElement>('[data-home-text]')].map((owner) => {
      const surface = owner.firstElementChild!;
      const css = getComputedStyle(surface);
      return {
        role: owner.className,
        text: owner.textContent,
        ...box(owner),
        surfaceHeight: surface.getBoundingClientRect().height,
        display: css.display,
        font: css.fontFamily,
        size: css.fontSize,
        leading: css.lineHeight,
      };
    });
    return {
      gallery: box(gallery),
      settings: box(gallery.querySelector('[data-home-settings]')!),
      cards: [...gallery.querySelectorAll<HTMLElement>('[data-gallery-demo]')].map((card) => ({
        id: card.dataset.galleryDemo,
        ...box(card),
      })),
      text,
      theme: document.documentElement.dataset.theme,
      rootFont: getComputedStyle(document.documentElement).fontSize,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}
type GalleryGeometry = Awaited<ReturnType<typeof galleryGeometry>>;

function pairedBox(
  expected: { x: number; y: number; width: number; height: number },
  actual: { x: number; y: number; width: number; height: number },
  label: string
) {
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(actual[key] - expected[key]), `${label}.${key}`).toBeLessThanOrEqual(1);
}

async function capture(page: Page, root: Locator, id: string, facts: unknown) {
  // Persist actual facts before assertions, including any failed geometry pair.
  await writeFile(
    path.join(directory, `${id}.json`),
    JSON.stringify(
      {
        source,
        capturedAt: new Date().toISOString(),
        url: page.url(),
        viewport: page.viewportSize(),
        screenshot: `${id}.png`,
        facts,
      },
      null,
      2
    )
  );
  await root.screenshot({ path: path.join(directory, `${id}.png`) });
}

describe.sequential('Runtime-only vertical layout parity', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const width of [1440, 390]) {
      it(`homepage ${family}/${width}: preserves card and text line boxes through a WC round trip`, async () => {
        const page = await browser.newPage({
          viewport: { width, height: 1000 },
          colorScheme: 'light',
        });
        try {
          await page.addInitScript(() => localStorage.setItem('starlight-theme', 'light'));
          await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
          await homeReady(page, 'wc', 'shadcn');
          if (family !== 'shadcn') {
            await chooseHome(page, 'family', 'Brutalist');
            await homeReady(page, 'wc', family);
          }
          const home = page.locator('[data-home-showcase]');
          let baseline: GalleryGeometry | undefined;
          for (const [index, runtime] of sequence.entries()) {
            if (index > 0) await chooseHome(page, 'runtime', runtimeLabels[runtime]);
            await homeReady(page, runtime, family);
            const facts = await galleryGeometry(home);
            await capture(page, home, `home-${family}-${width}-${index}-${runtime}`, facts);
            expect(facts.theme).toBe('light');
            expect(facts.pageOverflow).toBeLessThanOrEqual(1);
            expect(facts.text.length).toBeGreaterThan(20);
            for (const text of facts.text) expect(text.display, text.role).toBe('block');
            if (!baseline) baseline = facts;
            else {
              expect(facts.rootFont).toBe(baseline.rootFont);
              pairedBox(baseline.gallery, facts.gallery, 'gallery');
              pairedBox(baseline.settings, facts.settings, 'settings');
              expect(facts.cards.map((card) => card.id)).toEqual(
                baseline.cards.map((card) => card.id)
              );
              facts.cards.forEach((card, index) =>
                pairedBox(baseline!.cards[index]!, card, card.id!)
              );
              expect(facts.text.length).toBe(baseline.text.length);
              facts.text.forEach((text, index) => {
                const previous = baseline!.text[index]!;
                expect([text.role, text.text, text.font, text.size, text.leading]).toEqual([
                  previous.role,
                  previous.text,
                  previous.font,
                  previous.size,
                  previous.leading,
                ]);
                pairedBox(previous, text, `${runtime}/${text.role}/${index}`);
                expect(Math.abs(text.surfaceHeight - previous.surfaceHeight)).toBeLessThanOrEqual(
                  1
                );
              });
            }
            if (runtime === 'react') {
              // Narrow negative control: reintroduce only the missing display
              // declaration. A caption's parent-font strut must then enlarge
              // its actual line box. Restore before the next runtime pair.
              const caption = home.locator('.home-gallery__caption').first();
              const before = await caption.boundingBox();
              const original = await caption.evaluate((owner) => {
                const surface = owner.firstElementChild as HTMLElement;
                const previous = surface.getAttribute('style');
                surface.style.display = 'inline';
                return previous;
              });
              try {
                const after = await caption.boundingBox();
                await capture(
                  page,
                  home,
                  `home-${family}-${width}-${index}-${runtime}-inline-negative`,
                  await galleryGeometry(home)
                );
                expect(
                  after!.height - before!.height,
                  'inline caption recreates extra vertical spacing'
                ).toBeGreaterThan(2);
              } finally {
                await caption.evaluate((owner, previous) => {
                  if (previous === null) owner.firstElementChild!.removeAttribute('style');
                  else owner.firstElementChild!.setAttribute('style', previous);
                }, original);
              }
            }
          }
        } finally {
          await page.close();
        }
      }, 180_000);
    }
  }

  for (const [family, route] of [
    ['shadcn', '/zh-cn/ui-libraries/shadcn/toggle/'],
    ['brutalist', '/zh-cn/ui-libraries/brutalist/components/button/'],
  ] as const) {
    it(`docs ${family}: keeps the passive RuntimeBox's canvas and vertical insets`, async () => {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
      });
      try {
        await page.addInitScript(() => localStorage.setItem('starlight-theme', 'light'));
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const root = page.locator('[data-previewer-id]').first();
        const pairs: Array<{ runtime: string; facts: Awaited<ReturnType<typeof docsGeometry>> }> =
          [];
        for (const [index, runtime] of sequence.entries()) {
          if (index > 0) await choosePreviewRuntime(page, root, runtime);
          await root.scrollIntoViewIfNeeded();
          await page.waitForFunction(
            ({ id, runtime }) => {
              const root = document.querySelector<HTMLElement>(`[data-previewer-id="${id}"]`);
              return (
                root?.querySelector<HTMLElement>('.pui-runtime-preview-surface')?.dataset
                  .projectionRuntime === runtime &&
                root.querySelectorAll('.pui-runtime-preview-surface').length === 1 &&
                document.querySelector<HTMLElement>('main h1[data-typography-runtime]')?.dataset
                  .typographyRuntime === runtime
              );
            },
            { id: await root.getAttribute('data-previewer-id'), runtime },
            { timeout: 45_000 }
          );
          await settledFonts(page);
          const facts = await docsGeometry(root);
          pairs.push({ runtime, facts });
          await capture(page, root, `docs-${family}-${index}-${runtime}`, facts);
          const previous = pairs[0]!.facts;
          expect(facts.display).toBe('flex');
          expect(facts.slotDisplay).toBe('contents');
          expect(facts.theme).toBe('light');
          expect(facts.font).toBe(previous.font);
          expect(facts.padding).toEqual(previous.padding);
          expect(facts.typography.length).toBeGreaterThan(0);
          expect(facts.typography.map((text) => text.identity)).toEqual(
            previous.typography.map((text) => text.identity)
          );
          facts.typography.forEach((text, index) => {
            const expected = previous.typography[index]!;
            expect([text.font, text.size, text.leading]).toEqual([
              expected.font,
              expected.size,
              expected.leading,
            ]);
            pairedBox(expected, text, `${runtime}/document/${text.identity}`);
          });
          for (const key of [
            'width',
            'height',
            'contentHeight',
            'topInset',
            'bottomInset',
          ] as const)
            expect(Math.abs(facts[key] - previous[key]), `${runtime}/${key}`).toBeLessThanOrEqual(
              1
            );
        }
      } finally {
        await page.close();
      }
    }, 180_000);
  }
});

async function docsGeometry(root: Locator) {
  return root.evaluate((root) => {
    const surface = root.querySelector<HTMLElement>('.pui-runtime-preview-surface')!;
    const slot = surface.querySelector<HTMLElement>('[data-passive-shell-slot]')!;
    const source = slot.querySelector(
      '[data-demo-ref="__website_runtime_preview_surface__-content"]'
    )!;
    const child = source.firstElementChild!;
    const rect = surface.getBoundingClientRect();
    const content = child.getBoundingClientRect();
    const css = getComputedStyle(surface);
    const main = document.querySelector('main')!;
    const origin = main.getBoundingClientRect();
    const typography = [...main.querySelectorAll<HTMLElement>('[data-typography-owner]')]
      .filter((owner) => !owner.closest('[data-previewer-id]'))
      .slice(0, 20)
      .map((owner) => {
        const rect = owner.getBoundingClientRect();
        const surface = owner.querySelector<HTMLElement>('[data-typography-prototype]')!;
        const css = getComputedStyle(surface);
        return {
          identity: `${owner.localName}/${owner.textContent}`,
          x: rect.x - origin.x,
          y: rect.y - origin.y,
          width: rect.width,
          height: rect.height,
          surfaceDisplay: css.display,
          font: css.fontFamily,
          size: css.fontSize,
          leading: css.lineHeight,
        };
      });
    return {
      width: rect.width,
      height: rect.height,
      contentHeight: content.height,
      topInset: content.top - rect.top,
      bottomInset: rect.bottom - content.bottom,
      display: css.display,
      slotDisplay: getComputedStyle(slot).display,
      padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft],
      font: css.fontFamily,
      theme: document.documentElement.dataset.theme,
      typography,
    };
  });
}
