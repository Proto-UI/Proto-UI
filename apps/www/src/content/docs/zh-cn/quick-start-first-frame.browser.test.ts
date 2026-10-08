// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changedFirstFrameGeometry } from './quick-start-first-frame-geometry';
import { PREFERRED_ADAPTER_KEY } from '../../../components/adapter-preference-key';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';

const route = '/zh-cn/start-here/quick-start/#_top';
const directory =
  process.env.PUI_QUICK_START_EVIDENCE_DIR ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'quick-start-first-frame');
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
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

const targets = {
  title: 'h1[data-site-typography="h1"]',
  description: '[data-site-typography="tagline"]',
  release: '.doc-stage-notice',
  releaseTitle: '.doc-stage-notice__title',
  releaseBody: '.doc-stage-notice__body',
  note: '.starlight-aside--note',
  noteTitle: '.starlight-aside--note .starlight-aside__title',
  noteBody: '.starlight-aside--note .starlight-aside__content p',
  following: '[data-doc-flow] > p',
};
function readPageFrame({
  selectors,
  observe = false,
}: {
  selectors: typeof targets;
  observe?: boolean;
}) {
  const read = () => {
    const anchor = document.querySelector(selectors.title)!.getBoundingClientRect();
    const values = Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => {
        const owner = document.querySelector<HTMLElement>(selector)!;
        const leaf = owner.querySelector<HTMLElement>('[data-typography-prototype]') ?? owner;
        const rect = owner.getBoundingClientRect();
        const css = getComputedStyle(leaf);
        return [
          key,
          {
            text: owner.textContent?.trim(),
            x: rect.x - anchor.x,
            y: rect.y - anchor.y,
            width: rect.width,
            height: rect.height,
            fontSize: css.fontSize,
            fontWeight: css.fontWeight,
            fontFamily: css.fontFamily,
            lineHeight: css.lineHeight,
            color: css.color,
            fontFaceReady: document.fonts.check(
              `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
              owner.textContent ?? ''
            ),
            visible:
              !!rect.width && !!rect.height && getComputedStyle(owner).visibility === 'visible',
          },
        ];
      })
    );
    const note = document.querySelector<HTMLElement>(selectors.note)!;
    const plane = ['ready', 'retained'].includes(note.dataset.noteSurfaceView ?? '')
      ? note.querySelector<HTMLElement>('.site-note-surface-paint')
      : null;
    const paint = plane ? getComputedStyle(plane) : getComputedStyle(note, '::before');
    const header = document
      .querySelector<HTMLElement>('[data-docs-site-header]')!
      .getBoundingClientRect();
    const pageOverflow =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const overflowing =
      pageOverflow > 1
        ? [...document.querySelectorAll<HTMLElement>('body *')].flatMap((element) => {
            const rect = element.getBoundingClientRect();
            if (
              !rect.width ||
              (rect.right <= document.documentElement.clientWidth + 1 &&
                rect.left >= -1 &&
                element.scrollWidth <= element.clientWidth + 1)
            )
              return [];
            const css = getComputedStyle(element);
            return [
              {
                tag: element.tagName,
                id: element.id,
                className: element.getAttribute('class'),
                text: element.textContent?.slice(0, 70),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                right: rect.right,
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                position: css.position,
                display: css.display,
                visibility: css.visibility,
                opacity: css.opacity,
                overflowX: css.overflowX,
                inertOwner: element.closest('[inert]')?.outerHTML.slice(0, 500),
                generation: element
                  .closest('[data-projection-generation-state]')
                  ?.getAttribute('data-projection-generation-state'),
              },
            ];
          })
        : [];
    // Read the actually painted owner at each publication boundary, rather
    // than comparing hidden candidates or the header's outer box alone.
    const sample = (node: Element | null, pseudo?: string) => {
      if (!node) return null;
      const css = getComputedStyle(node, pseudo);
      const rect = node.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        background: css.backgroundColor,
        color: css.color,
        borders: [
          css.borderTopWidth,
          css.borderRightWidth,
          css.borderBottomWidth,
          css.borderLeftWidth,
        ],
        borderColors: [
          css.borderTopColor,
          css.borderRightColor,
          css.borderBottomColor,
          css.borderLeftColor,
        ],
        radius: css.borderTopLeftRadius,
        shadow: css.boxShadow,
        fontFamily: css.fontFamily,
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        lineHeight: css.lineHeight,
        fontReady: document.fonts.check(
          `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
          node.textContent ?? ''
        ),
        opacity: css.opacity,
        stroke: css.stroke,
        strokeWidth: css.strokeWidth,
        fill: css.fill,
        shapes:
          node.localName === 'svg'
            ? [...node.querySelectorAll('path,circle,line,rect,polyline,ellipse,polygon')].map(
                (shape) => ({
                  tag: shape.localName,
                  attrs: Object.fromEntries(
                    ['d', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points'].flatMap((key) =>
                      shape.hasAttribute(key) ? [[key, shape.getAttribute(key)]] : []
                    )
                  ),
                })
              )
            : null,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          css.visibility === 'visible' &&
          css.display !== 'none',
      };
    };
    const headerRoot = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
    const menu = headerRoot.hasAttribute('data-site-menu-ready')
      ? headerRoot.querySelector('[data-site-menu-button]')
      : headerRoot.querySelector('[data-site-header-fallback-summary]');
    const searchRoot = headerRoot.querySelector<HTMLElement>('site-search')!;
    const searchReady = ['ready', 'retained'].includes(searchRoot.dataset.searchView ?? '');
    const search = searchReady
      ? searchRoot.querySelector('[data-projection-generation-state="active"] [data-open-modal]')
      : searchRoot.querySelector('[data-search-startup-button]');
    const code = document.querySelector<HTMLElement>('[data-site-code-surface="frame"]')!;
    const toolbar = code.querySelector<HTMLElement>('[data-site-code-surface="toolbar"]')!;
    const surface = (owner: HTMLElement) => {
      const live = ['ready', 'retained'].includes(owner.dataset.codeSurfaceView ?? '');
      const plane = live
        ? owner.querySelector(':scope > .site-code-surface-mount .site-code-surface-paint')
        : owner;
      return sample(plane, live ? undefined : '::before');
    };
    const identityHost = window as typeof window & { __startupNativeNodes?: Element[] };
    const nativeNodes = [
      code,
      code.querySelector('pre')!,
      code.querySelector('code')!,
      headerRoot.querySelector('[data-site-header-desktop-navigation] a')!,
    ];
    identityHost.__startupNativeNodes ??= nativeNodes;
    const chrome = {
      nativeNodesPreserved: nativeNodes.every(
        (node, index) => node === identityHost.__startupNativeNodes![index] && node.isConnected
      ),
      menu: sample(menu),
      menuGlyph: sample(menu?.querySelector('.site-header-menu-icon') ?? null),
      search: sample(search),
      searchLabel: sample(search?.querySelector('.site-search-label') ?? null),
      searchShortcut: sample(search?.querySelector('.site-search-shortcut') ?? null),
      searchShortcutText: search?.querySelector('.site-search-shortcut')?.textContent?.trim(),
      searchOverflow: search ? search.scrollWidth - search.clientWidth : null,
      searchGlyph: sample(search?.querySelector('svg') ?? null),
      code: surface(code),
      codeToolbar: surface(toolbar),
      codeText: sample(code.querySelector('pre')),
      searchReady,
      searchDisabled:
        search?.getAttribute('aria-disabled') === 'true' ||
        search?.hasAttribute('disabled') === true,
      // Copy and stored Runtime availability are separate command-state
      // transitions; the passive code frame must never wait for either.
      copyReady: !!code.querySelector('[data-copy-command]'),
    };
    return {
      chrome,
      geometry: {
        header: { x: header.x, y: header.y, width: header.width, height: header.height },
        title: {
          viewportX: anchor.x,
          viewportY: anchor.y,
          documentX: anchor.x + scrollX,
          documentY: anchor.y + scrollY,
        },
        scroll: { x: scrollX, y: scrollY },
      },
      overflowing,
      values,
      paint: {
        background: paint.backgroundColor,
        borderColor: paint.borderTopColor,
        borderWidth: paint.borderTopWidth,
        borderRadius: paint.borderTopLeftRadius,
      },
      ready: note.dataset.noteSurfaceView,
      runtime: note.dataset.noteSurfaceRuntime,
      fontStatus: document.fonts.status,
      theme: document.documentElement.dataset.theme,
      pageOverflow,
    };
  };
  if (observe) {
    const state = { running: true, frames: [] as ReturnType<typeof read>[] };
    const host = window as typeof window & { __quickStartFrames?: typeof state };
    host.__quickStartFrames = state;
    let previous = '';
    const frame = () => {
      if (!state.running) return;
      const value = read();
      const serialized = JSON.stringify(value);
      if (serialized !== previous) {
        state.frames.push(value);
        previous = serialized;
      }
      requestAnimationFrame(frame);
    };
    frame();
  }
  return read();
}
async function measure(page: Page) {
  return page.evaluate(readPageFrame, { selectors: targets });
}
async function beforeReleaseDeadline<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Pre-module ${label} did not settle within 15s`)),
          15_000
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function captureViewport(page: Page, file: string) {
  // Playwright's screenshot convenience method also awaits document.fonts.ready.
  // Chromium's public captureScreenshot captures the real current surface
  // without waiting for the intentionally paused deferred-module document load.
  const session = await page.context().newCDPSession(page);
  try {
    const screenshot = await beforeReleaseDeadline(
      session.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      }),
      'viewport capture'
    );
    await writeFile(file, Buffer.from(screenshot.data, 'base64'));
  } finally {
    await session.detach();
  }
}
async function waitForCapturedFonts(page: Page) {
  // FontFaceSet.ready also waits for document loading. Deferred module requests
  // are intentionally paused here, so that whole-document promise would await
  // this test's own release gate. Load only the already-painted target faces.
  // CSS Font Loading §3: https://drafts.csswg.org/css-font-loading/#fontfaceset-interface
  await beforeReleaseDeadline(
    page.evaluate(async (selectors) => {
      await Promise.all(
        [
          ...Object.values(selectors),
          '[data-search-startup-button]',
          '[data-site-header-fallback-summary]',
          '[data-site-code-surface="frame"] pre',
        ].map((selector) => {
          const owner = document.querySelector<HTMLElement>(selector)!;
          const leaf = owner.querySelector<HTMLElement>('[data-typography-prototype]') ?? owner;
          const css = getComputedStyle(leaf);
          return document.fonts.load(
            `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
            owner.textContent ?? ''
          );
        })
      );
    }, targets),
    'required fonts'
  );
}
async function checkpoint(page: Page, name: string, phase: string) {
  await writeFile(
    path.join(directory, `${name}-progress.json`),
    JSON.stringify({ source, url: page.url(), phase, checkedAt: new Date().toISOString() }, null, 2)
  );
}
async function captureFailure(page: Page, name: string, failure: unknown) {
  const detail: { source: typeof source; failure: string; captureError?: string } = {
    source,
    failure: failure instanceof Error ? (failure.stack ?? failure.message) : String(failure),
  };
  // This cannot depend on the selectors or font/ready conditions that failed.
  try {
    await captureViewport(page, path.join(directory, `${name}-failure.png`));
  } catch (error) {
    detail.captureError = String(error);
  }
  await writeFile(path.join(directory, `${name}-failure.json`), JSON.stringify(detail, null, 2));
}
async function record(page: Page, name: string) {
  const result = await measure(page);
  // The whole document viewport stays visible, including content outside the
  // note; a hidden-page/skeleton workaround cannot satisfy these artifacts.
  await captureViewport(page, path.join(directory, `${name}.png`));
  await writeFile(
    path.join(directory, `${name}.json`),
    JSON.stringify(
      {
        source,
        browser: browser.version(),
        url: page.url(),
        viewport: page.viewportSize(),
        kind: 'same-source stylesheet-ready pre-module versus hydrated',
        result,
      },
      null,
      2
    )
  );
  return result;
}
async function stopFrameTrace(page: Page, name: string) {
  const frames = await page.evaluate(() => {
    const host = window as typeof window & {
      __quickStartFrames?: { running: boolean; frames: ReturnType<typeof readPageFrame>[] };
    };
    const state = host.__quickStartFrames;
    if (!state) return [];
    state.running = false;
    return state.frames;
  });
  await writeFile(
    path.join(directory, `${name}-frame-transitions.json`),
    JSON.stringify({ source, frames }, null, 2)
  );
  return frames;
}
function compare(
  before: Awaited<ReturnType<typeof measure>>,
  after: Awaited<ReturnType<typeof measure>>
) {
  for (const key of Object.keys(targets)) {
    const initial = before.values[key]!;
    const final = after.values[key]!;
    expect(initial.visible, `${key} readable before modules`).toBe(true);
    expect(initial.fontFaceReady, `${key} required font faces ready before modules`).toBe(true);
    expect(final.fontFaceReady, `${key} required font faces ready after modules`).toBe(true);
    expect(final.visible, `${key} readable after modules`).toBe(true);
    expect(final.text, `${key} authored text preserved`).toBe(initial.text);
    for (const coordinate of ['x', 'y', 'width', 'height'] as const)
      expect(
        Math.abs(final[coordinate] - initial[coordinate]),
        `${key}.${coordinate}`
      ).toBeLessThanOrEqual(1);
    if (!['release', 'note'].includes(key)) {
      for (const property of [
        'fontSize',
        'fontWeight',
        'fontFamily',
        'lineHeight',
        'color',
      ] as const)
        expect(final[property], `${key}.${property}`).toBe(initial[property]);
    }
  }
  expect(
    changedFirstFrameGeometry(before.geometry, after.geometry),
    'header and complete page position remain stable in every frame'
  ).toEqual([]);
  expect(after.chrome.searchShortcutText).toBe(before.chrome.searchShortcutText);
  expect(after.chrome.searchOverflow).toBeLessThanOrEqual(1);
  expect(
    after.chrome.nativeNodesPreserved,
    'native code and navigation nodes survive every frame'
  ).toBe(true);
  for (const key of [
    'menu',
    'menuGlyph',
    'search',
    'searchGlyph',
    'searchLabel',
    'searchShortcut',
    'code',
    'codeToolbar',
    'codeText',
  ] as const) {
    const initial = before.chrome[key];
    const next = after.chrome[key];
    expect(initial, `${key} SSR owner exists`).not.toBeNull();
    expect(next, `${key} every-frame painted owner exists`).not.toBeNull();
    if (!initial || !next) continue;
    // Existing compact layout omits textual labels in both states. Keep its
    // policy stable; the command and glyph must remain visible.
    if (key === 'searchLabel' || key === 'searchShortcut')
      expect(next.visible, `${key} responsive visibility`).toBe(initial.visible);
    else {
      expect(initial.visible, `${key} SSR paint visible`).toBe(true);
      expect(next.visible, `${key} remains visible`).toBe(true);
    }
    for (const dimension of ['x', 'y', 'width', 'height'] as const)
      expect(
        Math.abs(next[dimension] - initial[dimension]),
        `${key}.${dimension}`
      ).toBeLessThanOrEqual(1);
    for (const property of [
      'background',
      'color',
      'borders',
      'borderColors',
      'radius',
      'shadow',
    ] as const)
      expect(next[property], `${key}.${property}`).toEqual(initial[property]);
    if (key === 'searchGlyph')
      for (const property of ['stroke', 'strokeWidth', 'fill', 'shapes'] as const)
        expect(next[property], `${key}.${property}`).toEqual(initial[property]);
    // Passive planes contain no text. Compare fonts only for actual labels/code.
    if (['search', 'searchLabel', 'searchShortcut', 'codeText'].includes(key)) {
      for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'] as const)
        expect(next[property], `${key}.${property}`).toEqual(initial[property]);
      expect(initial.fontReady, `${key} initial actual font`).toBe(true);
      expect(next.fontReady, `${key} every-frame actual font`).toBe(true);
    }
    if (key === 'search') {
      expect(before.chrome.searchDisabled, 'SSR Search honestly unavailable').toBe(true);
      expect(initial.opacity, 'public disabled Button recipe').toBe('0.5');
      expect(next.opacity, 'only public disabled-to-ready opacity exception').toBe(
        after.chrome.searchDisabled ? '0.5' : '1'
      );
    } else expect(next.opacity, `${key}.opacity`).toBe(initial.opacity);
  }
  expect(after.paint).toEqual(before.paint);
  expect(before.pageOverflow).toBeLessThanOrEqual(1);
  expect(after.pageOverflow, JSON.stringify(after.overflowing)).toBeLessThanOrEqual(1);
}

const conditions = [
  { width: 1280, height: 1000, colorScheme: 'light' as const },
  { width: 390, height: 1000, colorScheme: 'dark' as const },
];
describe('quick-start first-frame continuity', () => {
  const journeys = [
    ...RUNTIMES.flatMap((runtime) =>
      conditions.map((condition) => ({
        runtime,
        condition,
        locale: 'zh-cn',
        platform: 'default',
        userAgent: undefined as string | undefined,
      }))
    ),
    ...['zh-cn', 'en'].flatMap((locale) =>
      [320, 390, 1280].map((width) => ({
        runtime: 'react' as const,
        condition: { width, height: 1000, colorScheme: 'light' as const },
        locale,
        platform: 'apple',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      }))
    ),
  ];
  for (const { runtime, condition, locale, platform, userAgent } of journeys) {
    it(`${runtime} ${locale} ${platform} ${condition.width} ${condition.colorScheme}: readable first paint, cold hydration and refresh`, async () => {
      const context = await browser.newContext({
        viewport: condition,
        colorScheme: condition.colorScheme,
        userAgent,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        ({ runtime, key }) => {
          localStorage.setItem(key, runtime);
        },
        { runtime, key: PREFERRED_ADAPTER_KEY }
      );
      try {
        for (const navigation of ['cold', 'refresh'] as const) {
          let release!: () => void;
          const scripts = new Promise<void>((resolve) => {
            release = resolve;
          });
          // Delay only executable modules, never HTML/CSS/fonts. This exposes
          // the actual shipped SSR surface rather than a reconstructed fixture.
          await page.route('**/*', async (request) => {
            if (request.request().resourceType() === 'script') await scripts;
            await request.continue();
          });
          const loading =
            navigation === 'cold'
              ? page.goto(`${baseUrl}/${locale}/start-here/quick-start/#_top`, {
                  waitUntil: 'commit',
                })
              : page.reload({ waitUntil: 'commit' });
          const prefix = `${runtime}-${condition.width}-${condition.colorScheme}-${navigation}${platform === 'apple' ? `-apple-${locale}` : ''}`;
          try {
            await checkpoint(page, prefix, 'navigation-commit');
            await loading;
            await checkpoint(page, prefix, 'native-content');
            await page.locator(targets.noteBody).waitFor({ state: 'visible' });
            await checkpoint(page, prefix, 'native-styles');
            await page.waitForFunction(() => {
              const title = document.querySelector('h1[data-site-typography="h1"]');
              return (
                title &&
                getComputedStyle(title).fontSize === '30px' &&
                document.styleSheets.length > 0
              );
            });
            await checkpoint(page, prefix, 'target-font-faces');
            await waitForCapturedFonts(page);
            await checkpoint(page, prefix, 'first-frame-capture');
            const before = await record(page, `${prefix}-first-frame`);
            expect(before.ready).toBeUndefined();
            await page.evaluate(readPageFrame, { selectors: targets, observe: true });
            release();
            await checkpoint(page, prefix, 'hydration');
            await page.waitForFunction(
              (runtime) => {
                const note = document.querySelector<HTMLElement>('.starlight-aside--note');
                return (
                  note?.dataset.noteSurfaceView === 'ready' &&
                  document.querySelector('site-search')?.getAttribute('data-search-view') ===
                    'ready' &&
                  [
                    ...document
                      .querySelectorAll('[data-site-code-surface="frame"]')[0]!
                      .querySelectorAll('[data-site-code-surface="toolbar"]'),
                    document.querySelector('[data-site-code-surface="frame"]')!,
                  ].every(
                    (surface) => surface.getAttribute('data-code-surface-view') === 'ready'
                  ) &&
                  note.dataset.noteSurfaceRuntime === runtime &&
                  document
                    .querySelector('.doc-stage-notice__title')
                    ?.getAttribute('data-typography-runtime') === runtime
                );
              },
              runtime,
              { timeout: 45_000 }
            );
            await page.evaluate(async () => {
              await document.fonts.ready;
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              );
            });
            const after = await record(page, `${prefix}-hydrated`);
            const frames = await stopFrameTrace(page, prefix);
            expect(
              frames.length,
              'at least one real pre-release frame was observed'
            ).toBeGreaterThan(0);
            compare(before, after);
            for (const frame of frames) compare(before, frame);
            expect(errors).toEqual([]);
            await checkpoint(page, prefix, 'passed');
          } catch (error) {
            await captureFailure(page, prefix, error);
            throw error;
          } finally {
            release();
            // Preserve collected transitions even when readiness or geometry fails.
            try {
              await stopFrameTrace(page, prefix);
            } finally {
              await page.unrouteAll({ behavior: 'wait' });
            }
          }
        }
      } finally {
        await context.close();
      }
    }, 150_000);
  }
  for (const focusOwner of ['menu', 'content-link'] as const)
    it(`React delayed upgrade preserves ${focusOwner} focus and native code selection`, async () => {
      const context = await browser.newContext({ viewport: conditions[0] });
      const page = await context.newPage();
      await page.addInitScript((key) => localStorage.setItem(key, 'react'), PREFERRED_ADAPTER_KEY);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/*', async (request) => {
        if (request.request().resourceType() === 'script') await gate;
        await request.continue();
      });
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'commit' });
        await page.locator('[data-site-code-surface="frame"] pre').first().waitFor();
        await page.evaluate((focusOwner) => {
          const code = document.querySelector(
            '[data-site-code-surface="frame"] pre'
          ) as HTMLElement;
          const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
          let text = walker.nextNode()!;
          while (text && !text.textContent?.trim()) text = walker.nextNode()!;
          const range = document.createRange();
          range.selectNodeContents(text);
          const selection = getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range);
          const target =
            focusOwner === 'menu'
              ? (document.querySelector('[data-site-header-fallback-summary]') as HTMLElement)
              : (document.querySelector('[data-site-header-desktop-navigation] a') as HTMLElement);
          target.focus({ preventScroll: true });
          const describe = (node: Node | null) => {
            const element = node instanceof Element ? node : node?.parentElement;
            return element
              ? {
                  tag: element.localName,
                  id: element.id,
                  attributes: Object.fromEntries(
                    [...element.attributes]
                      .filter((attribute) =>
                        /^(?:data-site|data-typography|tabindex|href|hidden|inert)/.test(
                          attribute.name
                        )
                      )
                      .map((attribute) => [attribute.name, attribute.value])
                  ),
                }
              : null;
          };
          const trace: unknown[] = [];
          const observe = (kind: string, details: Record<string, unknown> = {}) => {
            if (trace.length < 160)
              trace.push({
                kind,
                at: performance.now(),
                readyState: document.readyState,
                active: describe(document.activeElement),
                ...details,
              });
          };
          for (const kind of ['focusin', 'focusout', 'selectionchange'])
            document.addEventListener(
              kind,
              (event) =>
                observe(kind, {
                  target: describe(event.target as Node),
                }),
              true
            );
          const originalSet = selection.setBaseAndExtent;
          selection.setBaseAndExtent = function (...args) {
            observe('selection-write-before', { stack: new Error().stack });
            try {
              return Reflect.apply(originalSet, this, args);
            } finally {
              observe('selection-write-after');
            }
          };
          observe('before-release');
          (window as any).__startupOwnership = {
            trace,
            describe,
            observe,
            initialFocusCorrect: document.activeElement === target,
            code,
            text,
            focus: document.activeElement,
            anchor: selection.anchorNode,
            offset: selection.anchorOffset,
            selected: selection.toString(),
          };
        }, focusOwner);
        await captureViewport(
          page,
          path.join(directory, `react-${focusOwner}-ownership-before.png`)
        );
        release();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-docs-site-header]')
              ?.hasAttribute('data-site-menu-ready') &&
            document
              .querySelector('[data-site-code-surface="frame"]')
              ?.getAttribute('data-code-surface-view') === 'ready'
        );
        const facts = await page.evaluate((focusOwner) => {
          const saved = (window as any).__startupOwnership;
          const selection = getSelection()!;
          return {
            initialSelectionNonempty: saved.selected.trim().length > 0,
            codeSame: document.querySelector('[data-site-code-surface="frame"] pre') === saved.code,
            textRetained: saved.text.isConnected && saved.code.contains(saved.text),
            selectionSame:
              selection.anchorNode === saved.anchor &&
              selection.anchorOffset === saved.offset &&
              selection.toString() === saved.selected,
            focused:
              focusOwner === 'menu'
                ? document.activeElement?.hasAttribute('data-site-menu-button')
                : document.activeElement === saved.focus,
          };
        }, focusOwner);
        const diagnostics = await page.evaluate(() => {
          const saved = (window as any).__startupOwnership;
          saved.observe('after-upgrade');
          return {
            initialFocusCorrect: saved.initialFocusCorrect,
            originalFocus: saved.describe(saved.focus),
            actualFocus: saved.describe(document.activeElement),
            trace: saved.trace,
          };
        });
        // Persist failures before the strict assertion: identity and retained
        // selection alone cannot establish that no intermediate blur occurred.
        await writeFile(
          path.join(directory, `react-${focusOwner}-ownership.json`),
          JSON.stringify({ source, facts, diagnostics }, null, 2)
        );
        await captureViewport(
          page,
          path.join(directory, `react-${focusOwner}-ownership-after.png`)
        );
        expect(diagnostics.initialFocusCorrect).toBe(true);
        expect(facts).toEqual({
          initialSelectionNonempty: true,
          codeSame: true,
          textRetained: true,
          selectionSame: true,
          focused: true,
        });
      } catch (error) {
        const name = `react-${focusOwner}-ownership`;
        await captureFailure(page, name, error);
        try {
          const trace = await page.evaluate(() => (window as any).__startupOwnership?.trace ?? []);
          await writeFile(
            path.join(directory, `${name}-trace.json`),
            JSON.stringify({ source, trace }, null, 2)
          );
        } catch {
          /* Keep the original test failure if diagnostic collection fails. */
        }
        throw error;
      } finally {
        release();
        await page.unrouteAll({ behavior: 'wait' });
        await context.close();
      }
    }, 90_000);
  for (const condition of conditions)
    it(`no JavaScript ${condition.width}: full note and text remain readable`, async () => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: condition,
        colorScheme: condition.colorScheme,
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`);
        const result = await record(
          page,
          `no-javascript-${condition.width}-${condition.colorScheme}`
        );
        for (const value of Object.values(result.values)) expect(value.visible).toBe(true);
        expect(result.paint.borderWidth).toBe('1px');
        for (const key of [
          'menu',
          'menuGlyph',
          'search',
          'searchGlyph',
          'code',
          'codeToolbar',
          'codeText',
        ] as const)
          expect(result.chrome[key]?.visible, `${key} no-JS visible`).toBe(true);
        expect(result.chrome.searchDisabled).toBe(true);
        expect(result.chrome.code?.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(await page.locator('[data-search-startup-button]').isDisabled()).toBe(true);
        expect(result.ready).toBeUndefined();
        expect(result.pageOverflow).toBeLessThanOrEqual(1);
        const summary = page.locator('[data-site-header-fallback-summary]');
        expect(await summary.isVisible()).toBe(true);
        expect(
          await page.locator('[data-site-header-panel] [data-site-header-preferences]').count()
        ).toBe(1);
        await summary.click();
        expect(await page.locator('[data-site-header-preferences]').isVisible()).toBe(true);
      } finally {
        await context.close();
      }
    }, 60_000);
});
