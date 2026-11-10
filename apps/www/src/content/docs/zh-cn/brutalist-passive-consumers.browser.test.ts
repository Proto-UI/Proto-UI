// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTES = {
  image: '/en/ui-libraries/brutalist/components/image/',
  separator: '/en/ui-libraries/brutalist/components/separator/',
  surface: '/en/ui-libraries/brutalist/components/surface/',
} as const;
const PROFILES = [
  { id: 'desktop', width: 1280, fontSize: 16 },
  { id: 'compact', width: 390, fontSize: 16 },
  { id: 'compact-font-200', width: 390, fontSize: 32 },
] as const;
const directory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'brutalist-passive-consumers')
  : undefined;
// These selected authored inputs identify this evidence. Main's complete source
// admission and exact-head CI remain separate; this is not a dependency freeze.
const sourcePaths = [
  'apps/www/src/content/docs/zh-cn/brutalist-passive-consumers.browser.test.ts',
  'apps/www/src/content/docs/zh-cn/browser-harness.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-image.demo.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-separator.demo.ts',
  'apps/www/src/content/docs/zh-cn/demo-brutalist-surface.demo.ts',
  'apps/www/src/components/PrototypePreviewer/surface-atom-demo.ts',
  'packages/prototypes/brutalist/src/image/root.proto.ts',
  'packages/prototypes/brutalist/src/separator/root.proto.ts',
  'packages/prototypes/brutalist/src/surface/root.proto.ts',
  'packages/prototypes/base/src/image/root.proto.ts',
  'packages/prototypes/base/src/separator/root.proto.ts',
  'packages/prototypes/base/src/surface/root.proto.ts',
  'packages/modules/image-view/src/web.ts',
  'spec/tests/T-BRUTALIST-PASSIVE-CONSUMERS-0001.yaml',
];
type Runtime = (typeof RUNTIMES)[number];
type Scheme = (typeof COLOR_SCHEMES)[number];
type Profile = (typeof PROFILES)[number];
type Component = keyof typeof ROUTES;
type Observation = {
  component: Component;
  runtime: Runtime;
  scheme: Scheme;
  profile: string;
  state: string;
  observedAt: string;
  url: string;
  viewport: { width: number; height: number } | null;
  facts: unknown;
  image?: { file: string; sha256: string };
};
let browser: Browser;
let baseUrl = '';
let sourceBinding: unknown;
const observations: Observation[] = [];
const DEMO_ROOTS =
  '.host .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"] [data-pui-root]';

async function paint(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
    const translation =
      style.translate === 'none' ? [0, 0] : style.translate.split(/\s+/).map(parseFloat);
    return {
      width: rect.width,
      height: rect.height,
      parentWidth: parent?.width ?? 0,
      parentHeight: parent?.height ?? 0,
      role: element.getAttribute('role'),
      tabIndex: (element as HTMLElement).tabIndex,
      ariaHidden: element.getAttribute('aria-hidden'),
      ariaOrientation: element.getAttribute('aria-orientation'),
      ariaPressed: element.getAttribute('aria-pressed'),
      orientation: element.getAttribute('data-orientation'),
      childElements: element.childElementCount,
      text: element.textContent,
      color: style.color,
      background: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      borderColors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
      radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius],
      shadow: style.boxShadow,
      offset: [matrix.m41 + translation[0]!, matrix.m42 + (translation[1] ?? 0)],
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
      animationName: style.animationName,
      opacity: style.opacity,
    };
  });
}

function hasPhotoDepth(shadow: string): boolean {
  return /rgb\(0, 0, 0\) 4px 4px 0px 0px/.test(shadow);
}

async function profile(page: Page, value: Profile): Promise<void> {
  await page.setViewportSize({ width: value.width, height: 1000 });
  // Deliberate author root-font pressure, not a claim of browser zoom.
  await page.evaluate((fontSize) => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    document.getSelection()?.removeAllRanges();
  }, value.fontSize);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe(`${value.fontSize}px`);
}

async function capture(
  previewer: Locator,
  component: Component,
  runtime: Runtime,
  scheme: Scheme,
  value: Profile,
  state: string,
  facts: unknown,
  screenshot = true
): Promise<void> {
  const page = previewer.page();
  const row: Observation = {
    component, runtime, scheme, profile: value.id, state,
    observedAt: new Date().toISOString(), url: page.url(), viewport: page.viewportSize(), facts,
  };
  observations.push(row);
  if (directory && screenshot) {
    const file = `${component}-${runtime}-${scheme}-${value.id}-${state}.png`;
    const bytes = await previewer.screenshot({ path: path.join(directory, file) });
    row.image = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}

beforeAll(async () => {
  if (directory) {
    await mkdir(directory, { recursive: true });
    sourceBinding = {
      headSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      workingTreeChanges: execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }),
      selectedAuthoredInputs: await Promise.all(sourcePaths.map(async (file) => ({
        path: file, sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
      }))),
      qualification: 'Selected current input bytes; no complete dependency/source admission, historical recalibration, CI or acceptance claim.',
    };
  }
  baseUrl = await startServer(Object.values(ROUTES));
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  try {
    if (directory) {
      await writeFile(path.join(directory, 'observations.json'), JSON.stringify({
        schemaVersion: 1, sourceBinding, browser: browser?.version(), observations,
        qualification: 'Partial current public Web evidence. Runner results and visual review are separate. Computed colors are not rendered-adjacency contrast or assistive-technology proof. Separator orientation changes below use the existing injected demo event.',
      }, null, 2));
    }
  } finally {
    try { await browser?.close(); } finally { await stopServer(); }
  }
}, 60_000);

describe.sequential('Brutalist passive public consumer evidence', () => {
  for (const runtime of RUNTIMES) {
    // P-BRUTALIST-IMAGE-VISUAL-GRAMMAR and inherited physical fit/a11y facts.
    it(`${runtime}: Image retains its frame, informative names and decorative/error boundaries`, async () => {
      for (const scheme of COLOR_SCHEMES) {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTES.image, { width: 1280, height: 1000 });
        try {
          await applyColorScheme(page, scheme);
          await selectRuntime(page, previewer, runtime, 'img', 5);
          const image = (ref: string) => previewer.locator(`img[data-demo-ref="${ref}"], [data-demo-ref="${ref}"] img`);
          for (const value of PROFILES) {
            await profile(page, value);
            const frames = [];
            for (const fit of ['contain', 'cover', 'fill']) {
              const target = image(`fit-${fit}`);
              await expect.poll(() => target.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(640);
              const native = await target.evaluate((node) => {
                const img = node as HTMLImageElement;
                return { fit: getComputedStyle(img).objectFit, position: getComputedStyle(img).objectPosition, alt: img.alt, complete: img.complete };
              });
              const frame = await paint(target);
              frames.push({ fit, native, frame });
            }
            await expect.poll(() => image('decorative').evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(320);
            const decorative = await image('decorative').getAttribute('alt');
            await expect.poll(() => image('error').evaluate((node) => (node as HTMLImageElement).complete)).toBe(true);
            const broken = await image('error').evaluate((node) => {
              const img = node as HTMLImageElement;
              return { naturalWidth: img.naturalWidth, alt: img.alt };
            });
            const errorFrame = await paint(image('error'));
            await image('fit-cover').hover();
            const hoveredFrame = await paint(image('fit-cover'));
            await capture(previewer, 'image', runtime, scheme, value, 'settled', {
              frames, decorative, broken, errorFrame, hoveredFrame,
            });
            for (const { fit, native, frame } of frames) {
              expect(native).toEqual({ fit, position: '50% 50%', alt: `Mountains and a sun (${fit})`, complete: true });
              expect(frame.height).toBe(112);
              expect(frame.width).toBeGreaterThan(0);
              expect(frame.borders).toEqual(Array(4).fill('2px'));
              expect(frame.borderColors).toEqual(Array(4).fill('rgb(0, 0, 0)'));
              expect(frame.radii).toEqual(Array(4).fill('5px'));
              expect(hasPhotoDepth(frame.shadow)).toBe(true);
              expect(frame.tabIndex).toBe(-1);
              expect(frame.offset).toEqual([0, 0]);
              expect(await previewer.getByRole('img', { name: native.alt, exact: true }).count()).toBe(1);
            }
            const widths = frames.map(({ frame }) => frame.width);
            expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.5);
            expect(decorative).toBe('');
            expect(await previewer.locator('.host').getByRole('img').count()).toBe(4);
            expect(broken.naturalWidth).toBe(0);
            expect(await previewer.getByRole('img', { name: broken.alt, exact: true }).count()).toBe(1);
            expect(errorFrame.borders).toEqual(Array(4).fill('2px'));
            expect(hoveredFrame).toEqual(frames[1]!.frame);
          }
        } finally { await context.close(); }
      }
    }, 120_000);

    // Complements the existing unscaled Separator browser suite. The event is
    // an injected authored-prop update; it is deliberately not native input evidence.
    it(`${runtime}: Separator follows consumer extent under resizing, font pressure and orientation reversal`, async () => {
      for (const scheme of COLOR_SCHEMES) {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTES.separator, { width: 1280, height: 1000 });
        try {
          await applyColorScheme(page, scheme);
          await selectRuntime(page, previewer, runtime, '[data-pui-root]', 2);
          const separators = previewer.locator(DEMO_ROOTS);
          const dynamic = previewer.locator('.host [data-demo-ref="dynamic-separator"]');
          const content = previewer.locator('[data-projection-content]');
          await expect.poll(() => content.getAttribute('data-separator-demo-ready')).toBe('true');
          const originalText = await content.textContent();
          for (const value of PROFILES) {
            await profile(page, value);
            const before = await Promise.all([paint(separators.nth(0)), paint(dynamic)]);
            await capture(previewer, 'separator', runtime, scheme, value, 'vertical', before);
            expect(before.map((item) => item.orientation)).toEqual(['horizontal', 'vertical']);
            expect(before[0]!.height).toBe(2);
            expect(Math.abs(before[0]!.width - before[0]!.parentWidth)).toBeLessThanOrEqual(0.5);
            expect(before[1]!.width).toBe(2);
            expect(before[1]!.parentHeight).toBeGreaterThan(2);
            expect(Math.abs(before[1]!.height - before[1]!.parentHeight)).toBeLessThanOrEqual(0.5);
            for (const item of before) {
              expect(item.childElements).toBe(0);
              expect(item.text).toBe('');
              expect(item.role).toBeNull();
              expect(item.ariaHidden).toBe('true');
              expect(item.ariaOrientation).toBeNull();
              expect(item.tabIndex).toBe(-1);
              expect(item.backgroundImage).toBe('none');
              expect(item.background).not.toBe('rgba(0, 0, 0, 0)');
            }
            for (const orientation of ['horizontal', 'vertical']) {
              await content.evaluate((element, orientation) => element.dispatchEvent(new CustomEvent('proto-ui-test:separator-orientation', { detail: { orientation } })), orientation);
              await expect.poll(() => dynamic.getAttribute('data-orientation')).toBe(orientation);
              await expect.poll(async () => {
                const item = await paint(dynamic);
                return orientation === 'horizontal' ? item.height : item.width;
              }).toBe(2);
              const after = await paint(dynamic);
              await capture(previewer, 'separator', runtime, scheme, value, `returned-${orientation}`, after, value.fontSize === 32);
              expect(Math.abs(orientation === 'horizontal' ? after.width - after.parentWidth : after.height - after.parentHeight)).toBeLessThanOrEqual(0.5);
              expect(await content.textContent()).toBe(originalText);
              expect(await separators.count()).toBe(2);
              expect(await previewer.locator('.host').getByRole('separator').count()).toBe(0);
            }
          }
        } finally { await context.close(); }
      }
    }, 120_000);

    // Surface consumes supplied facts. Real hovering and native word selection
    // must not turn the passive shell into a second interaction owner.
    it(`${runtime}: Surface keeps native text ownership and live raised timing in its existing four public states`, async () => {
      for (const scheme of COLOR_SCHEMES) {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTES.surface, { width: 1280, height: 1000 });
        try {
          await applyColorScheme(page, scheme);
          await selectRuntime(page, previewer, runtime, '[data-pui-root]', 4);
          const surfaces = previewer.locator(DEMO_ROOTS);
          for (const value of PROFILES) {
            await profile(page, value);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await expect.poll(async () => (await paint(surfaces.nth(3))).transitionProperty).toBe('all');
            const before = await Promise.all(Array.from({ length: 4 }, (_, index) => paint(surfaces.nth(index))));
            await capture(previewer, 'surface', runtime, scheme, value, 'supplied-states', before);
            for (const item of before) {
              expect(item.role).toBeNull();
              expect(item.tabIndex).toBe(-1);
              expect(item.ariaPressed).toBeNull();
              expect(item.width).toBeGreaterThan(0);
              expect(item.height).toBeGreaterThan(0);
            }
            expect(before[0]!.borders).toEqual(Array(4).fill('2px'));
            expect(before[1]!.borders).toEqual(Array(4).fill('0px'));
            expect(before[0]!.offset).toEqual([0, 0]);
            expect(before[3]!.offset[0]).toBeGreaterThan(0);
            expect(before[3]!.offset[0]).toBe(before[3]!.offset[1]);
            if (value.fontSize === 16) expect(before[3]!.offset).toEqual([4, 4]);
            expect(hasPhotoDepth(before[3]!.shadow)).toBe(false);
            expect(before[3]!.transitionDuration).toBe('0.15s');

            const label = previewer.getByText('Outline · rest', { exact: true });
            await label.hover();
            expect(await paint(surfaces.nth(0))).toEqual(before[0]);
            await label.scrollIntoViewIfNeeded();
            const point = await label.evaluate((element) => {
              const text = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
              if (!text) throw new Error('The public Surface label has no native text node.');
              const range = document.createRange();
              range.setStart(text, 0);
              range.setEnd(text, 'Outline'.length);
              const rect = range.getBoundingClientRect();
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            });
            await page.mouse.dblclick(point.x, point.y);
            await expect.poll(() => page.evaluate(() => document.getSelection()?.toString().trim())).toBe('Outline');

            await page.emulateMedia({ reducedMotion: 'reduce' });
            await expect.poll(async () => (await paint(surfaces.nth(3))).transitionProperty).toBe('none');
            const reduced = await paint(surfaces.nth(3));
            await capture(previewer, 'surface', runtime, scheme, value, 'reduced-policy', {
              paint: reduced,
              nativeSelection: await page.evaluate(() => document.getSelection()?.toString().trim()),
            }, false);
            expect(reduced.offset).toEqual(before[3]!.offset);
            expect(reduced.shadow).toBe(before[3]!.shadow);
            expect(reduced.transitionDuration).toBe('0s');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await expect.poll(async () => (await paint(surfaces.nth(3))).transitionProperty).toBe('all');
            await capture(previewer, 'surface', runtime, scheme, value, 'restored-policy', await paint(surfaces.nth(3)), false);
          }
        } finally { await context.close(); }
      }
    }, 120_000);
  }
});
