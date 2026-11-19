// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

const route = '/en/ui-libraries/shadcn/dialog/';
const out = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR!;
let browser: Browser;
let baseUrl: string;

async function arm(page: Page, panel: string, mask: string, trigger: string | null) {
  await page.evaluate(({ panel, mask, trigger }) => {
    const selector = `${panel},${mask}`;
    const ids = new WeakMap<object, number>();
    let nextId = 0;
    const id = (value: object | null) => {
      if (!value) return null;
      if (!ids.has(value)) ids.set(value, ++nextId);
      return ids.get(value);
    };
    const t0 = performance.now();
    const frames: unknown[] = [];
    const events: unknown[] = [];
    const mutations: unknown[] = [];
    const inputs: unknown[] = [];
    const start = () => Math.round((performance.now() - t0) * 10) / 10;
    let previous = '';
    let request: number;
    const sample = () => {
      const record = Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
        const css = getComputedStyle(element);
        return {
          id: id(element), parent: id(element.parentElement),
          part: element.matches(panel) ? 'panel' : 'mask',
          runtime: element.dataset.projectionRuntime, state: element.dataset.transitionState,
          visible: css.display !== 'none' && css.visibility !== 'hidden' && element.getClientRects().length > 0,
          opacity: Number(Number(css.opacity).toFixed(3)), transform: css.transform,
          animations: element.getAnimations().map((animation) => ({
            id: id(animation), state: animation.playState,
            name: 'animationName' in animation ? animation.animationName :
              'transitionProperty' in animation ? animation.transitionProperty : null,
          })),
        };
      });
      const snapshot = JSON.stringify(record);
      if (snapshot !== previous && frames.length < 240) frames.push({ t: start(), record });
      previous = snapshot;
      request = requestAnimationFrame(sample);
    };
    const attributes = ['data-transition-state', 'data-state', 'aria-hidden', 'aria-expanded', 'data-pui-view-detached'];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (mutations.length >= 240) break;
        if (record.type === 'attributes' && record.target instanceof Element &&
            (record.target.matches(selector) || (trigger && record.target.matches(trigger)))) {
          mutations.push({ t: start(), id: id(record.target), attribute: record.attributeName,
            from: record.oldValue, to: record.target.getAttribute(record.attributeName!) });
        } else if (record.type === 'childList') {
          for (const [action, nodes] of [['add', record.addedNodes], ['remove', record.removedNodes]] as const) {
            for (const node of nodes) {
              if (!(node instanceof Element)) continue;
              const found = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
              for (const element of found) {
                if (mutations.length >= 240) break;
                mutations.push({ t: start(), action, id: id(element), parent: id(record.target), part: element.matches(panel) ? 'panel' : 'mask' });
              }
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: attributes, attributeOldValue: true });
    const motion = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.matches(selector) || events.length >= 100) return;
      const name = 'animationName' in event ? event.animationName : 'propertyName' in event ? event.propertyName : null;
      events.push({ t: start(), name, type: event.type, id: id(event.target), part: event.target.matches(panel) ? 'panel' : 'mask', pseudo: 'pseudoElement' in event ? event.pseudoElement : null });
    };
    const types = ['transitionrun', 'transitionstart', 'transitioncancel', 'transitionend', 'animationstart', 'animationcancel', 'animationend'];
    for (const type of types) document.addEventListener(type, motion, true);
    const input = (event: Event) => {
      if (inputs.length < 16 && event.target instanceof Element)
        inputs.push({ type: event.type, t: start(), trusted: event.isTrusted, id: id(event.target), label: event.target.getAttribute('aria-label') });
    };
    document.addEventListener('click', input, true);
    sample();
    Object.assign(window, { __overlayObserved: () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      for (const type of types) document.removeEventListener(type, motion, true);
      document.removeEventListener('click', input, true);
      return { frames, events, mutations, inputs, elapsed: start() };
    } });
  }, { panel, mask, trigger });
}

async function finish(page: Page) {
  return page.evaluate(() => (window as typeof window & { __overlayObserved: () => unknown }).__overlayObserved());
}

beforeAll(async () => {
  await mkdir(out, { recursive: true });
  browser = await launchBrowser();
  baseUrl = await startServer(route);
}, 240_000);

afterAll(async () => {
  try { await browser?.close(); } finally { await stopServer(); }
});

describe.sequential('actual Dialog and Search opening motion observation', () => {
  for (const runtime of ['react', 'vue', 'wc'] as const) {
    for (const part of ['dialog', 'search'] as const) {
      it(`${runtime} ${part} observes one trusted input per open`, async () => {
        const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
        const errors: string[] = [];
        const attempts: unknown[] = [];
        try {
          if (part === 'search') {
            await context.addInitScript((value) => localStorage.setItem('preferred-prototypes-adapter', value), runtime);
          }
          const page = await context.newPage();
          page.on('pageerror', (error) => errors.push(error.message));
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          let trigger: Locator;
          let panel: string;
          let mask: string;
          let triggerSelector: string | null = null;
          const runtimeSelector = `[data-projection-runtime="${runtime}"]`;
          if (part === 'dialog') {
            const previewer = page.locator('[data-previewer-id]').first();
            await selectRuntime(page, previewer, runtime, '[aria-haspopup="dialog"]', 1);
            trigger = previewer.locator('[aria-haspopup="dialog"]');
            const contentId = await trigger.getAttribute('aria-controls');
            expect(contentId).toBeTruthy();
            panel = `[role="dialog"][id=${JSON.stringify(contentId)}]`;
            mask = `${runtimeSelector}[data-projection-prototype="shadcn-dialog-mask"]`;
            triggerSelector = `[aria-controls=${JSON.stringify(contentId)}]`;
          } else {
            const root = page.locator(`site-search[data-search-runtime="${runtime}"][data-search-view="ready"]`);
            await root.waitFor({ state: 'visible', timeout: 30_000 });
            trigger = root.locator('[data-open-modal]');
            panel = `[role="dialog"]${runtimeSelector}[data-projection-prototype="shadcn-command-dialog-content"]`;
            mask = `${runtimeSelector}[data-projection-prototype="shadcn-command-dialog-mask"]`;
            triggerSelector = 'site-search [data-open-modal]';
          }
          for (const attempt of ['first', 'reopen']) {
            await arm(page, panel, mask, triggerSelector);
            try {
              await trigger.click();
              await page.locator(panel).waitFor({ state: 'visible', timeout: 15_000 });
              await expect.poll(() => page.locator(panel).getAttribute('data-transition-state')).toBe('entered');
              // Keep observing settled frames to detect a late replacement or replay after visible entry.
              await page.evaluate(() => new Promise<void>((done) => window.setTimeout(done, 800)));
              await expect.poll(() => page.locator(panel).count()).toBe(1);
              expect(await page.locator(panel).getAttribute('data-projection-runtime')).toBe(runtime);
            } finally {
              attempts.push({ attempt, trace: await finish(page) });
            }
            await page.screenshot({ path: path.join(out, `${runtime}-${part}-${attempt}.png`) });
            await page.keyboard.press('Escape');
            await page.locator(panel).waitFor({ state: 'hidden', timeout: 15_000 });
          }
        } finally {
          await writeFile(path.join(out, `${runtime}-${part}.json`), JSON.stringify({ runtime, part, route, errors, attempts }, null, 2));
          await context.close();
        }
      }, 100_000);
    }
  }
});
