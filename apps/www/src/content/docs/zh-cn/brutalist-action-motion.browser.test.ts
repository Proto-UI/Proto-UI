// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';

let browser: Browser;
let baseUrl: string;
const output = path.join(
  process.env.RUNNER_TEMP ?? os.tmpdir(),
  'homepage-evidence',
  'brutalist-action-motion'
);
const source = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    encoding: 'utf8',
  }).trim(),
};
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  if (process.env.CANDIDATE_SHA) expect(source.sha).toBe(process.env.CANDIDATE_SHA);
  expect(source.dirty).toBe(false);
  baseUrl = await startServer('/zh-cn/ui-libraries/brutalist/components/button/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

type MotionFrame = {
  at: number;
  x: number;
  y: number;
  width: number;
  height: number;
  translate: string;
  transform: string;
  shadow: string;
  duration: string;
  connected: boolean;
  hit: boolean;
  transitions: Array<{ property: string; time: number | string | null }>;
};
declare global {
  interface Window {
    __brutalistMotion?: {
      frames: MotionFrame[];
      done: Promise<void>;
      cancel: () => void;
      events: Array<{ type: string; at: number }>;
      started: number;
    };
  }
}
async function capture(page: Page, paint: Locator, action: () => Promise<void>) {
  // The awaited install records the resting frame before any native input.
  await paint.evaluate((node) => {
    if (window.__brutalistMotion) throw new Error('Motion observer already active');
    const owner = node.closest('a') ?? node;
    const box = owner.getBoundingClientRect();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const frames: MotionFrame[] = [];
    const events: Array<{ type: string; at: number }> = [];
    const started = performance.now();
    let finish: () => void = () => {};
    let raf = 0;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const observeEvent = (event: Event) =>
      events.push({ type: event.type, at: performance.now() - started });
    const kinds = ['pointerenter', 'pointerleave', 'pointerdown', 'pointerup'];
    for (const kind of kinds) owner.addEventListener(kind, observeEvent);
    const cancel = () => {
      cancelAnimationFrame(raf);
      for (const kind of kinds) owner.removeEventListener(kind, observeEvent);
      finish();
    };
    const sample = () => {
      const rect = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      const hit = document.elementFromPoint(point.x, point.y);
      frames.push({
        at: performance.now() - started,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        translate: css.translate,
        transform: css.transform,
        shadow: css.boxShadow,
        duration: css.transitionDuration,
        connected: node.isConnected,
        hit: hit === owner || (hit !== null && owner.contains(hit)),
        transitions: node
          .getAnimations()
          .filter((a) => a instanceof CSSTransition)
          .map((a) => ({
            property: (a as CSSTransition).transitionProperty,
            time:
              typeof a.currentTime === 'number'
                ? a.currentTime
                : (a.currentTime?.toString() ?? null),
          })),
      });
      if (node.isConnected && performance.now() - started < 500)
        raf = requestAnimationFrame(sample);
      else cancel();
    };
    window.__brutalistMotion = { frames, events, started, done, cancel };
    sample();
  });
  let actionError: string | null = null;
  const actionAt = await page.evaluate(() => performance.now() - window.__brutalistMotion!.started);
  try {
    try {
      await action();
    } catch (error) {
      actionError = String(error);
    }
    return await page.evaluate(
      async ({ actionError, actionAt }) => {
        const probe = window.__brutalistMotion!;
        await probe.done;
        return { frames: probe.frames, events: probe.events, actionAt, actionError };
      },
      { actionError, actionAt }
    );
  } finally {
    await page.evaluate(() => {
      window.__brutalistMotion?.cancel();
      delete window.__brutalistMotion;
    });
  }
}

for (const subject of ['community-anchor', 'elevated-select'] as const) {
  it(`measures real ${subject} hover entry, hover exit and interrupted motion through a live preference round trip`, async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'no-preference',
    });
    const external: string[] = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (
        url.origin === new URL(baseUrl).origin ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:'
      )
        return route.continue();
      external.push(url.origin); // Never retain query strings or outside content.
      return route.abort();
    });
    const page = await context.newPage();
    const traces: unknown[] = [];
    let failed: string | null = null;
    try {
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/components/button/`, {
        waitUntil: 'networkidle',
      });
      await revealHeaderPreferences(page);
      if (subject === 'community-anchor') {
        const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
        if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
      }
      const control =
        subject === 'community-anchor'
          ? page.locator('.site-social-links a[data-site-native-link][aria-label="GitHub"]:visible')
          : page.locator(
              '[data-adapter-select] wc-brutalist-select-trigger[data-appearance="elevated"]:visible'
            );
      expect(await control.count()).toBe(1);
      const paint =
        subject === 'community-anchor'
          ? control.locator('wc-site-brutalist-surface[data-pui-root]')
          : control;
      await paint.waitFor({ state: 'visible' });
      expect(await paint.count()).toBe(1);
      await control.scrollIntoViewIfNeeded();
      const original = await control.elementHandle();
      if (!original) throw new Error('Missing control identity');
      const native = await control.evaluate((node) => ({
        tag: node.localName,
        href: node.getAttribute('href'),
        role: node.getAttribute('role'),
      }));
      if (subject === 'community-anchor') {
        expect(native.tag).toBe('a');
        expect(native.href).toMatch(/^https:\/\//);
        expect(native.role).toBeNull();
      } else expect(native.role).toBe('combobox');
      const expectedEnds = new Map<string, string>();
      let rest: MotionFrame | undefined;
      const step = await page.evaluate(
        () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 4
      );
      try {
        for (const preference of ['no-preference', 'reduce', 'no-preference'] as const) {
          await page.mouse.move(1400, 950);
          await page.emulateMedia({ reducedMotion: preference });
          expect(await control.evaluate((node, first) => node === first, original)).toBe(true);
          await expect
            .poll(() => paint.evaluate((node) => getComputedStyle(node).transitionDuration))
            .toBe(preference === 'reduce' ? '0s' : '0.15s');
          const box = await control.boundingBox();
          if (!box) throw new Error('No native hit box');
          const enter = () => page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          const leave = () => page.mouse.move(1400, 950);
          for (const phase of ['entry', 'exit', 'interrupted'] as const) {
            const captured = await capture(page, paint, async () => {
              if (phase === 'exit') await leave();
              else {
                await enter();
                if (phase === 'interrupted') {
                  await page.waitForTimeout(40); // The measured interruption, not an acceptance wait.
                  await leave();
                }
              }
            });
            const frames = captured.frames;
            const sameNode = await control.evaluate((node, first) => node === first, original);
            const hitInsideOriginalBox = await control.evaluate((node, box) => {
              const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
              return hit === node || (hit !== null && node.contains(hit));
            }, box);
            traces.push({ preference, phase, ...captured, sameNode, hitInsideOriginalBox });
            // Persist raw data before an assertion can fail; retain failed frames.
            await writeFile(
              path.join(output, `${subject}.json`),
              JSON.stringify({ source, native, traces, external }, null, 2)
            );
            if (captured.actionError) throw new Error(captured.actionError);
            expect(sameNode).toBe(true);
            expect(hitInsideOriginalBox).toBe(true);
            expect(frames.length).toBeGreaterThan(3);
            rest ??= frames[0];
            expect(rest.shadow).toMatch(/rgb\(0, 0, 0\) 4px 4px 0px 0px/);
            const last = frames.at(-1)!;
            const endpoint = `${last.translate}|${last.transform}|${last.shadow}`;
            if (phase === 'entry') {
              const colors = last.shadow.match(/rgba?\([^)]+\)/g) ?? [];
              expect(
                last.shadow === 'none' ||
                  (colors.length > 0 &&
                    colors.every(
                      (color) =>
                        color.startsWith('rgba(') && parseFloat(color.split(',').at(-1)!) === 0
                    ))
              ).toBe(true);
            } else expect(last.shadow).toBe(rest.shadow);
            const offset = phase === 'entry' ? step : 0;
            expect(last.x).toBeCloseTo(rest.x + offset, 1);
            expect(last.y).toBeCloseTo(rest.y + offset, 1);
            for (const frame of frames) {
              expect(frame.connected && frame.hit).toBe(true);
              expect(frame.width).toBeCloseTo(rest.width, 2);
              expect(frame.height).toBeCloseTo(rest.height, 2);
            }
            expect(
              frames
                .slice(-3)
                .every(
                  (frame) => `${frame.translate}|${frame.transform}|${frame.shadow}` === endpoint
                )
            ).toBe(true);
            if (!expectedEnds.has(phase)) expectedEnds.set(phase, endpoint);
            else expect(endpoint).toBe(expectedEnds.get(phase));
            if (phase === 'exit') expect(endpoint).not.toBe(expectedEnds.get('entry'));
            const transitions = frames.flatMap((frame) => frame.transitions);
            if (preference === 'reduce') expect(transitions).toEqual([]);
            else {
              expect(
                transitions.some((t) =>
                  ['translate', 'transform', 'box-shadow'].includes(t.property)
                )
              ).toBe(true);
              expect(
                new Set(frames.map((f) => `${f.translate}|${f.transform}|${f.shadow}`)).size
              ).toBeGreaterThan(2);
            }
          }
        }
        expect(
          await control.evaluate((node) => ({
            tag: node.localName,
            href: node.getAttribute('href'),
            role: node.getAttribute('role'),
          }))
        ).toEqual(native);
        // Follow actual keyboard focus, without programmatically assigning focus.
        for (
          let step = 0;
          step < 80 && !(await control.evaluate((node) => node.matches(':focus')));
          step++
        )
          await page.keyboard.press('Tab');
        expect(await control.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
        expect(context.pages()).toHaveLength(1); // No external link navigation performed.
        if (subject === 'elevated-select') {
          // Existing authored disabled Button is a negative control; do not
          // mutate a live Select's props merely to fabricate a disabled case.
          const disabled = page
            .locator('[data-previewer-id] [data-demo-ref="disabledSolid"]')
            .first();
          await disabled.scrollIntoViewIfNeeded();
          expect(await disabled.getAttribute('aria-disabled')).toBe('true');
          const box = await disabled.boundingBox();
          if (!box) throw new Error('Existing disabled negative missing geometry');
          const captured = await capture(page, disabled, () =>
            page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          );
          const frames = captured.frames;
          traces.push({ control: 'existing-disabled-Button', ...captured });
          await writeFile(
            path.join(output, `${subject}.json`),
            JSON.stringify({ source, native, traces, external }, null, 2)
          );
          if (captured.actionError) throw new Error(captured.actionError);
          expect(frames.length).toBeGreaterThan(3);
          expect(frames.every((frame) => frame.connected)).toBe(true);
          expect(new Set(frames.map((f) => `${f.translate}|${f.transform}|${f.shadow}`)).size).toBe(
            1
          );
          expect(frames.flatMap((f) => f.transitions)).toEqual([]);
          expect(await disabled.getAttribute('aria-disabled')).toBe('true');
        }
      } finally {
        await original.dispose();
      }
    } catch (error) {
      failed = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await writeFile(
        path.join(output, `${subject}-final.json`),
        JSON.stringify({ source, subject, traces, external, failed }, null, 2)
      );
      try {
        await page.screenshot({ path: path.join(output, `${subject}.png`) });
      } catch (captureError) {
        await writeFile(path.join(output, `${subject}-capture-error.txt`), String(captureError));
        if (!failed) throw captureError;
      } finally {
        await context.close();
      }
    }
  }, 90_000);
}

// Read-only diagnostic for the preserved community absolute-coordinate failure.
// This independent case does not replace either original motion assertion or
// redefine rest. Its sampler can affect scheduling; results are new evidence.
it('records community and Header anchor geometry through the unchanged native motion journey', async () => {
  const boundedWait = async <T>(
    label: string,
    work: Promise<T>,
    milliseconds = 5_000
  ): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`${label} wait exceeded ${milliseconds}ms; completion unconfirmed`)),
            milliseconds
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  let contextClosed = false;
  context.on('close', () => {
    contextClosed = true;
  });
  const external: string[] = [];
  let page: Page;
  try {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (
        url.origin === new URL(baseUrl).origin ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:'
      )
        return route.continue();
      external.push(url.origin);
      return route.abort();
    });
    page = await context.newPage();
  } catch (error) {
    try {
      await boundedWait('setup context close', context.close());
    } catch (cleanupError) {
      await writeFile(
        path.join(output, 'community-anchor-geometry-setup-failure.json'),
        JSON.stringify(
          { source, failed: String(error), cleanupError: String(cleanupError), contextClosed },
          null,
          2
        )
      ).catch(() => {});
    }
    throw error;
  }
  const traces: unknown[] = [];
  const secondaryErrors: string[] = [];
  let failed: string | null = null;
  let diagnostic: unknown = null;
  let installed = false;
  const key = '__brutalistAnchorDiagnostic';
  const stopDiagnostic = () =>
    page.evaluate((key) => {
      const host = window as unknown as Record<string, { stop(): unknown }>;
      const result = host[key].stop();
      delete host[key];
      return result;
    }, key);
  try {
    await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/components/button/`, {
      waitUntil: 'networkidle',
    });
    await revealHeaderPreferences(page);
    const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
    const control = page.locator(
      '.site-social-links a[data-site-native-link][aria-label="GitHub"]'
    );
    const paint = control.locator('wc-site-brutalist-surface[data-pui-root]');
    expect(await menu.count()).toBe(1);
    expect(await control.count()).toBe(1);
    await paint.waitFor({ state: 'attached' });
    expect(await paint.count()).toBe(1);
    expect(await menu.getAttribute('aria-expanded')).toBe('false');
    // Install before the real menu click. Do not settle geometry or change
    // application styles/state to make the initial position convenient.
    await page.evaluate((key) => {
      const host = window as unknown as Record<string, unknown>;
      if (host[key]) throw new Error('Anchor diagnostic already installed');
      const selectors = {
        header: '[data-docs-site-header]',
        menu: '[data-docs-site-header] [data-site-menu-button]',
        panel: '[data-docs-site-header] [data-site-header-panel]',
        control: '.site-social-links a[data-site-native-link][aria-label="GitHub"]',
        paint:
          '.site-social-links a[data-site-native-link][aria-label="GitHub"] wc-site-brutalist-surface[data-pui-root]',
      };
      const identities = new WeakMap<Element, number>();
      let serial = 0;
      const id = (node: Element) => {
        let value = identities.get(node);
        if (value === undefined) {
          value = ++serial;
          identities.set(node, value);
        }
        return value;
      };
      const started = performance.now();
      const frames: unknown[] = [];
      const events: unknown[] = [];
      let stage = 'before-menu-click';
      let raf = 0;
      let deadlineTimer = 0;
      let active = true;
      let limit: string | null = null;
      const maxFrames = 1800;
      const maxEvents = 4000;
      const deadlineMs = 20_000;
      const listeners: Array<() => void> = [];
      let observer: MutationObserver | undefined;
      const stamp = () => performance.now() - started;
      const mark = (kind: string, data: unknown = null) => {
        if (!active) return;
        if (events.length >= maxEvents) {
          limit = 'event-limit';
          stop();
          return;
        }
        events.push({ at: stamp(), stage, kind, data });
      };
      const parent = (node: Element): Element | null => {
        if (node.parentElement) return node.parentElement;
        const root = node.getRootNode();
        return root instanceof ShadowRoot ? root.host : null;
      };
      const snapshot = (node: Element) => {
        const box = node.getBoundingClientRect();
        const css = getComputedStyle(node);
        const html = node instanceof HTMLElement ? node : null;
        return {
          id: id(node),
          tag: node.localName,
          parent: parent(node) ? id(parent(node)!) : null,
          connected: node.isConnected,
          rect: [box.x, box.y, box.width, box.height],
          offset: html
            ? [html.offsetLeft, html.offsetTop, html.offsetWidth, html.offsetHeight]
            : null,
          offsetParent: html?.offsetParent ? id(html.offsetParent) : null,
          scroll: [node.scrollLeft, node.scrollTop],
          transform: css.transform,
          translate: css.translate,
          scale: css.scale,
          transformOrigin: css.transformOrigin,
          zoom: css.zoom,
          position: css.position,
          display: css.display,
          visibility: css.visibility,
          fontSize: css.fontSize,
          lineHeight: css.lineHeight,
          transitionProperty: css.transitionProperty,
          transitionDuration: css.transitionDuration,
          transitionDelay: css.transitionDelay,
          transitionTimingFunction: css.transitionTimingFunction,
          animations: node.getAnimations().map((animation) => ({
            kind: animation.constructor.name,
            property: animation instanceof CSSTransition ? animation.transitionProperty : null,
            currentTime:
              typeof animation.currentTime === 'number'
                ? animation.currentTime
                : (animation.currentTime?.toString() ?? null),
            playState: animation.playState,
          })),
          panelOffsets: node.matches('[data-site-header-panel]')
            ? ['left', 'top', 'max-width', 'max-height'].map((name) => {
                const property = `--site-header-panel-${name}`;
                return [
                  property,
                  html?.style.getPropertyValue(property) ?? '',
                  html?.style.getPropertyPriority(property) ?? '',
                  css.getPropertyValue(property),
                ];
              })
            : null,
        };
      };
      const sample = (schedule = true) => {
        if (!active) return;
        if (frames.length >= maxFrames || stamp() >= deadlineMs) {
          limit = frames.length >= maxFrames ? 'frame-limit' : 'deadline';
          stop();
          return;
        }
        try {
          const elements = new Map<number, Element>();
          const subjects = Object.fromEntries(
            Object.entries(selectors).map(([name, selector]) => {
              const matches = [...document.querySelectorAll(selector)];
              const node = matches.length === 1 ? matches[0] : null;
              const chain: number[] = [];
              for (let current = node; current; current = parent(current)) {
                const identity = id(current);
                if (chain.includes(identity) || chain.length >= 64) {
                  limit = 'ancestor-cycle-or-limit';
                  stop();
                  break;
                }
                chain.push(identity);
                elements.set(identity, current);
              }
              return [name, { count: matches.length, id: node ? id(node) : null, chain }];
            })
          );
          frames.push({
            at: stamp(),
            stage,
            reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
            fonts: document.fonts.status,
            scroll: [scrollX, scrollY],
            viewport: visualViewport
              ? [
                  visualViewport.offsetLeft,
                  visualViewport.offsetTop,
                  visualViewport.width,
                  visualViewport.height,
                  visualViewport.scale,
                ]
              : null,
            subjects,
            elements: [...elements.values()].map(snapshot),
          });
          if (active && schedule) raf = requestAnimationFrame(() => sample());
        } catch (error) {
          limit = `sampler-error: ${String(error)}`;
          stop();
        }
      };
      const listen = (
        target: EventTarget,
        kind: string,
        handler: EventListener,
        capture = false
      ) => {
        target.addEventListener(kind, handler, capture);
        listeners.push(() => target.removeEventListener(kind, handler, capture));
      };
      const stop = () => {
        if (!active) return;
        active = false;
        cancelAnimationFrame(raf);
        raf = 0;
        clearTimeout(deadlineTimer);
        deadlineTimer = 0;
        for (const release of listeners) release();
        listeners.length = 0;
        observer?.disconnect();
        observer = undefined;
      };
      const onEvent: EventListener = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const header = document.querySelector(selectors.header);
        if (target && header && !header.contains(target) && event.type !== 'scroll') return;
        mark(event.type, {
          target: target ? id(target) : null,
          property: event instanceof TransitionEvent ? event.propertyName : null,
          elapsedTime: event instanceof TransitionEvent ? event.elapsedTime : null,
          trusted: event.isTrusted,
        });
      };
      try {
        const header = document.querySelector(selectors.header);
        if (!header) throw new Error('Missing Header diagnostic owner');
        for (const kind of [
          'pointerenter',
          'pointerleave',
          'pointerdown',
          'pointerup',
          'transitionrun',
          'transitionstart',
          'transitionend',
          'transitioncancel',
          'scroll',
        ])
          listen(document, kind, onEvent, true);
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        listen(media, 'change', () => mark('media-change', media.matches));
        if (visualViewport) {
          listen(visualViewport, 'resize', () => mark('viewport-resize'));
          listen(visualViewport, 'scroll', () => mark('viewport-scroll'));
        }
        listen(document.fonts, 'loadingdone', () => mark('fonts-loadingdone'));
        observer = new MutationObserver((records) => {
          for (const record of records) {
            const node = record.target as Element;
            mark('attribute', { target: id(node), name: record.attributeName });
          }
        });
        observer.observe(header, {
          subtree: true,
          attributes: true,
          attributeFilter: [
            'style',
            'class',
            'data-pui-style',
            'data-hovered',
            'data-pressed',
            'data-focused',
            'data-focus-visible',
            'aria-expanded',
            'hidden',
          ],
        });
        host[key] = {
          mark(next: string) {
            stage = next;
            mark('checkpoint');
            sample(false);
          },
          stop() {
            mark('terminal');
            stop();
            return {
              started,
              frames,
              events,
              limit,
              active,
              maxFrames,
              maxEvents,
              deadlineMs,
              cleanup: {
                raf,
                deadlineTimer,
                listenersRemaining: listeners.length,
                observerActive: !!observer,
              },
            };
          },
        };
        // Timer also ends sampling when rAF is suspended. Browser scheduling and
        // the outer90s test limit remain separate from this20s observation cap.
        deadlineTimer = window.setTimeout(() => {
          limit = 'deadline-timer';
          stop();
        }, deadlineMs);
        mark('checkpoint');
        sample();
      } catch (error) {
        stop();
        delete host[key];
        throw error;
      }
    }, key);
    installed = true;
    const mark = (stage: string) =>
      page.evaluate(
        ({ key, stage }) => {
          const host = window as unknown as Record<string, { mark(stage: string): void }>;
          host[key].mark(stage);
        },
        { key, stage }
      );
    await menu.click();
    await mark('after-menu-click');
    await paint.waitFor({ state: 'visible' });
    await control.scrollIntoViewIfNeeded();
    await mark('after-scroll-into-view');
    const original = await control.elementHandle();
    if (!original) throw new Error('Missing diagnostic control');
    try {
      for (const preference of ['no-preference', 'reduce', 'no-preference'] as const) {
        await mark(`before-leave:${preference}`);
        await page.mouse.move(1400, 950);
        await mark(`before-preference:${preference}`);
        await page.emulateMedia({ reducedMotion: preference });
        await mark(`after-preference:${preference}`);
        await expect
          .poll(() => paint.evaluate((node) => getComputedStyle(node).transitionDuration))
          .toBe(preference === 'reduce' ? '0s' : '0.15s');
        const box = await control.boundingBox();
        if (!box) throw new Error('Missing diagnostic hit box');
        for (const phase of ['entry', 'exit', 'interrupted'] as const) {
          await mark(`before-input:${preference}:${phase}`);
          const captured = await capture(page, paint, async () => {
            if (phase === 'exit') await page.mouse.move(1400, 950);
            else {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              if (phase === 'interrupted') {
                await page.waitForTimeout(40);
                await page.mouse.move(1400, 950);
              }
            }
          });
          traces.push({ preference, phase, inputBox: box, ...captured });
          await mark(`after-input:${preference}:${phase}`);
          if (captured.actionError) throw new Error(captured.actionError);
          expect(await control.evaluate((node, first) => node === first, original)).toBe(true);
        }
      }
    } finally {
      try {
        await boundedWait('identity handle dispose', original.dispose());
      } catch (error) {
        secondaryErrors.push(`identity cleanup: ${String(error)}`);
      }
    }
    expect(context.pages()).toHaveLength(1);
    expect(external).toEqual([]);
    diagnostic = await boundedWait('diagnostic stop', stopDiagnostic());
    installed = false;
    const result = diagnostic as {
      frames: Array<{
        stage: string;
        subjects: Record<string, { count: number; id: number | null; chain: number[] }>;
      }>;
      limit: string | null;
      active: boolean;
      cleanup: {
        raf: number;
        deadlineTimer: number;
        listenersRemaining: number;
        observerActive: boolean;
      };
    };
    expect(result).not.toBeNull();
    expect(result.limit).toBeNull();
    expect(result.active).toBe(false);
    expect(result.cleanup).toEqual({
      raf: 0,
      deadlineTimer: 0,
      listenersRemaining: 0,
      observerActive: false,
    });
    expect(result.frames.length).toBeGreaterThan(3);
    expect(result.frames[0].stage).toBe('before-menu-click');
    expect(result.frames.at(-1)?.stage).toBe('after-input:no-preference:interrupted');
    expect(
      result.frames.every(
        (frame) =>
          Object.keys(frame.subjects).length === 5 &&
          Object.values(frame.subjects).every(
            (subject) => subject.count === 1 && subject.id !== null && subject.chain.length > 0
          )
      )
    ).toBe(true);
    expect(traces).toHaveLength(9);
  } catch (error) {
    failed = String(error);
    throw error;
  } finally {
    if (installed) {
      try {
        diagnostic = await boundedWait('diagnostic cleanup', stopDiagnostic());
      } catch (error) {
        secondaryErrors.push(`diagnostic cleanup: ${String(error)}`);
      }
    }
    try {
      await page.screenshot({
        path: path.join(output, 'community-anchor-geometry-diagnostic.png'),
        timeout: 5_000,
      });
    } catch (error) {
      secondaryErrors.push(`screenshot: ${String(error)}`);
    }
    try {
      await boundedWait('context close', context.close());
    } catch (error) {
      secondaryErrors.push(`context cleanup: ${String(error)}`);
    }
    if (!contextClosed)
      secondaryErrors.push('context close event not observed; teardown incomplete');
    try {
      await writeFile(
        path.join(output, 'community-anchor-geometry-diagnostic.json'),
        JSON.stringify(
          { source, traces, diagnostic, external, failed, secondaryErrors, contextClosed },
          null,
          2
        )
      );
    } catch (error) {
      secondaryErrors.push(`raw output: ${String(error)}`);
    }
    // Do not mask the original assertion/action error with later cleanup debt.
    if (!failed && secondaryErrors.length) throw new Error(secondaryErrors.join('\n'));
  }
}, 90_000);
