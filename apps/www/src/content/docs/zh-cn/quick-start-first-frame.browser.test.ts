// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    return {
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
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
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
async function record(page: Page, name: string) {
  const result = await measure(page);
  // The whole document viewport stays visible, including content outside the
  // note; a hidden-page/skeleton workaround cannot satisfy these artifacts.
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: false });
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
  expect(after.paint).toEqual(before.paint);
  expect(before.pageOverflow).toBeLessThanOrEqual(1);
  expect(after.pageOverflow).toBeLessThanOrEqual(1);
}

const conditions = [
  { width: 1280, height: 1000, colorScheme: 'light' as const },
  { width: 390, height: 1000, colorScheme: 'dark' as const },
];
describe('quick-start first-frame continuity', () => {
  for (const runtime of RUNTIMES)
    for (const condition of conditions) {
      it(`${runtime} ${condition.width} ${condition.colorScheme}: readable first paint, cold hydration and refresh`, async () => {
        const context = await browser.newContext({
          viewport: condition,
          colorScheme: condition.colorScheme,
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
                ? page.goto(`${baseUrl}${route}`, { waitUntil: 'commit' })
                : page.reload({ waitUntil: 'commit' });
            await loading;
            const prefix = `${runtime}-${condition.width}-${condition.colorScheme}-${navigation}`;
            try {
              await page.locator(targets.noteBody).waitFor({ state: 'visible' });
              await page.waitForFunction(() => {
                const title = document.querySelector('h1[data-site-typography="h1"]');
                return (
                  title &&
                  getComputedStyle(title).fontSize === '30px' &&
                  document.styleSheets.length > 0
                );
              });
              await page.evaluate(() => document.fonts.ready.then(() => undefined));
              const before = await record(page, `${prefix}-first-frame`);
              expect(before.ready).toBeUndefined();
              await page.evaluate(readPageFrame, { selectors: targets, observe: true });
              release();
              await page.waitForFunction(
                (runtime) => {
                  const note = document.querySelector<HTMLElement>('.starlight-aside--note');
                  return (
                    note?.dataset.noteSurfaceView === 'ready' &&
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
        expect(result.ready).toBeUndefined();
        expect(result.pageOverflow).toBeLessThanOrEqual(1);
      } finally {
        await context.close();
      }
    }, 60_000);
});
