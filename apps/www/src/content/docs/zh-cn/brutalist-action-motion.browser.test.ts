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
          // A preference change can move the containing surface, so every
          // preference measures its own rest frame instead of reusing the
          // previous one. Geometry and the returned shadow stay relative to
          // this stage's rest.
          let rest: MotionFrame | undefined;
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

// Additional WC Item evidence. Preserve the complete published motion and
// ancestor-diagnostic prefix. Other runtimes require separate native evidence.
type ItemPaint = {
  background: number[];
  foreground: number[];
  border: string;
  contrast: number;
  highlighted: boolean;
  connected: boolean;
  hit: boolean;
  rect: number[];
  transitions: string[];
};
type ItemPairFrame = {
  at: number;
  reducedMotion: boolean;
  items: ItemPaint[];
  geometry?: unknown;
};
type ItemPairProbe = {
  frames: ItemPairFrame[];
  events: Array<{ index: number; type: string; at: number }>;
  error: string | null;
  started: number;
  done: Promise<void>;
  cancel: () => void;
  cleanup: { raf: number; deadline: number; listeners: number };
};
declare global {
  interface Window {
    __brutalistItemPair?: ItemPairProbe;
  }
}
async function itemBounded<T>(label: string, work: Promise<T>, milliseconds = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}: ${milliseconds}ms exceeded; completion unconfirmed`)),
          milliseconds
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
async function captureItemPair(
  page: Page,
  items: Locator,
  originalRects: number[][] | null,
  action: () => Promise<void>
) {
  await itemBounded(
    'Item observer installation',
    items.evaluateAll((all, fixedRects) => {
      if (window.__brutalistItemPair) throw new Error('Existing Item observer');
      const nodes = all.slice(0, 2);
      if (nodes.length !== 2) throw new Error('Two real WC Item instances are required');
      const points = nodes.map((node, index) => {
        const rect = node.getBoundingClientRect();
        const original = fixedRects?.[index] ?? [rect.x, rect.y, rect.width, rect.height];
        return [original[0] + original[2] / 2, original[1] + original[3] / 2];
      });
      // Diagnostic IDs are local to this unchanged capture, not cross-runtime identities.
      const geometryIds = new Map<Element, number>();
      const geometryId = (node: Element) => {
        if (!geometryIds.has(node)) geometryIds.set(node, geometryIds.size + 1);
        return geometryIds.get(node)!;
      };
      const composedParent = (node: Element): Element | null => {
        const root = node.getRootNode();
        return node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
      };
      const captureGeometry = () => {
        const observed = new Set<Element>();
        const chain = (node: Element | null) => {
          const ids: number[] = [];
          let current = node;
          while (current && ids.length < 64) {
            observed.add(current);
            ids.push(geometryId(current));
            current = composedParent(current);
          }
          return { ids, truncated: current !== null };
        };
        const itemChains = nodes.map((node) => chain(node));
        const closestListbox = (node: Element) => {
          for (let current: Element | null = node; current; current = composedParent(current))
            if (current.getAttribute('role') === 'listbox') return current;
          return null;
        };
        const listboxes = [...new Set(nodes.map(closestListbox).filter((node) => node !== null))];
        const listboxIds = listboxes.map((node) => node.id).filter(Boolean);
        const triggers = [...document.querySelectorAll('[aria-controls]')].filter((node) =>
          (node.getAttribute('aria-controls') ?? '')
            .split(/\s+/)
            .some((id) => listboxIds.includes(id))
        );
        const owners = {
          items: itemChains,
          listboxes: listboxes.map((node) => ({ id: geometryId(node), chain: chain(node) })),
          triggers: triggers.map((node) => ({ id: geometryId(node), chain: chain(node) })),
        };
        const triggerPaint = triggers.map((node) => {
          const children = [...node.querySelectorAll('*')];
          for (const child of children.slice(0, 64)) observed.add(child);
          return {
            owner: geometryId(node),
            descendants: children.slice(0, 64).map(geometryId),
            truncated: children.length > 64,
          };
        });
        return {
          at: performance.now() - probe.started,
          viewport: [innerWidth, innerHeight, scrollX, scrollY],
          visualViewport: visualViewport
            ? [
                visualViewport.offsetLeft,
                visualViewport.offsetTop,
                visualViewport.width,
                visualViewport.height,
                visualViewport.scale,
              ]
            : null,
          owners,
          triggerPaint,
          elements: [...observed].map((node) => {
            const rect = node.getBoundingClientRect();
            const css = getComputedStyle(node);
            return {
              id: geometryId(node),
              tag: node.localName,
              parent: composedParent(node) ? geometryId(composedParent(node)!) : null,
              root: node.getRootNode() instanceof ShadowRoot ? 'shadow' : 'document',
              attributes: Object.fromEntries(
                [
                  'id',
                  'role',
                  'aria-controls',
                  'aria-expanded',
                  'data-demo-ref',
                  'data-pui-style',
                  'data-pui-part',
                  'data-overlay-part',
                  'data-state',
                ].map((name) => [name, node.getAttribute(name)])
              ),
              connected: node.isConnected,
              rect: [rect.x, rect.y, rect.width, rect.height],
              transform: css.transform,
              translate: css.translate,
              scale: css.scale,
              transformOrigin: css.transformOrigin,
              position: css.position,
              transitionProperty: css.transitionProperty,
              transitionDuration: css.transitionDuration,
              transitionDelay: css.transitionDelay,
              animations: node.getAnimations().map((animation) => ({
                type: animation.constructor.name,
                property: animation instanceof CSSTransition ? animation.transitionProperty : null,
                currentTime:
                  typeof animation.currentTime === 'number'
                    ? animation.currentTime
                    : String(animation.currentTime),
                playState: animation.playState,
              })),
            };
          }),
        };
      };
      const rgba = (css: string): number[] => {
        const match = css.match(/^rgba?\(([^)]+)\)$/);
        if (!match || match[1].includes('%')) throw new Error(`Unsupported measured color ${css}`);
        const values = match[1].replace(/[,/]/g, ' ').trim().split(/\s+/).map(Number);
        if (values.length === 3) values.push(1);
        if (
          values.length !== 4 ||
          values.some((value) => !Number.isFinite(value)) ||
          values.slice(0, 3).some((value) => value < 0 || value > 255) ||
          values[3] < 0 ||
          values[3] > 1
        )
          throw new Error(`Invalid measured color ${css}`);
        return values;
      };
      const over = (front: number[], back: number[]): number[] => {
        const alpha = front[3] + back[3] * (1 - front[3]);
        if (alpha <= 0) return [0, 0, 0, 0];
        return [0, 1, 2]
          .map(
            (index) => (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha
          )
          .concat(alpha);
      };
      const background = (node: Element) => {
        const layers: number[][] = [];
        let opaqueBackingFound = false;
        for (let current: Element | null = node; current; ) {
          const css = getComputedStyle(current);
          if (
            css.backgroundImage !== 'none' ||
            css.filter !== 'none' ||
            css.backdropFilter !== 'none' ||
            css.mixBlendMode !== 'normal' ||
            Number(css.opacity) !== 1
          )
            throw new Error(
              'Unsupported actual ancestor paint/effect; contrast cannot be certified'
            );
          // An opaque child does not make ancestor effects irrelevant.
          if (!opaqueBackingFound) {
            const color = rgba(css.backgroundColor);
            layers.push(color);
            opaqueBackingFound = color[3] === 1;
          }
          const root = current.getRootNode();
          current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        if (!opaqueBackingFound) throw new Error('No actual opaque backing found');
        return layers.reverse().reduce((back, front) => over(front, back), [0, 0, 0, 0]);
      };
      const luminance = (color: number[]) =>
        color
          .slice(0, 3)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      let finish: () => void = () => {};
      let active = true;
      let raf = 0;
      let deadline = 0;
      const listeners: Array<{ node: Element; kind: string; listener: EventListener }> = [];
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const probe: ItemPairProbe = {
        frames: [],
        events: [],
        error: null,
        started: performance.now(),
        done,
        cleanup: { raf: 0, deadline: 0, listeners: 0 },
        cancel: () => {
          active = false;
          cancelAnimationFrame(raf);
          clearTimeout(deadline);
          raf = 0;
          deadline = 0;
          for (const { node, kind, listener } of listeners)
            node.removeEventListener(kind, listener);
          listeners.length = 0;
          probe.cleanup = { raf, deadline, listeners: listeners.length };
          finish();
        },
      };
      // Publish owned cleanup before installing any listener or scheduling work.
      window.__brutalistItemPair = probe;
      const sample = () => {
        raf = 0;
        if (!active) return;
        try {
          if (probe.frames.length >= 180) throw new Error('Item frame limit reached');
          probe.frames.push({
            at: performance.now() - probe.started,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            items: nodes.map((node, index) => {
              const css = getComputedStyle(node);
              const bg = background(node);
              const fg = over(rgba(css.color), bg);
              const first = luminance(fg),
                second = luminance(bg);
              const rect = node.getBoundingClientRect();
              const hit = document.elementFromPoint(points[index][0], points[index][1]);
              return {
                background: bg,
                foreground: fg,
                border: css.borderTopColor,
                contrast: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
                highlighted: (node.getAttribute('data-pui-style') ?? '')
                  .split(/\s+/)
                  .includes('bg-main'),
                connected: node.isConnected,
                hit: hit === node || (hit !== null && node.contains(hit)),
                rect: [rect.x, rect.y, rect.width, rect.height],
                transitions: node
                  .getAnimations()
                  .filter((animation) => animation instanceof CSSTransition)
                  .map((animation) => (animation as CSSTransition).transitionProperty),
              };
            }),
          });
          // Read after the original Item frame on the same clock. Diagnostic failure
          // is retained as data and must not replace the original sampling/assertion error.
          try {
            probe.frames[probe.frames.length - 1].geometry = captureGeometry();
          } catch (error) {
            probe.frames[probe.frames.length - 1].geometry = { error: String(error) };
          }
          if (!nodes.every((node) => node.isConnected))
            throw new Error('Observed Item disconnected');
          if (performance.now() - probe.started < 650) raf = requestAnimationFrame(sample);
          else probe.cancel();
        } catch (error) {
          probe.error = String(error);
          probe.cancel();
        }
      };
      try {
        nodes.forEach((node, index) => {
          for (const kind of [
            'pointerenter',
            'pointerleave',
            'transitionrun',
            'transitionend',
            'transitioncancel',
          ]) {
            const listener: EventListener = () =>
              probe.events.push({ index, type: kind, at: performance.now() - probe.started });
            node.addEventListener(kind, listener);
            listeners.push({ node, kind, listener });
          }
        });
        // Independent wall deadline: a paused rAF cannot masquerade as completion.
        deadline = window.setTimeout(() => {
          probe.error = 'Item wall deadline reached';
          probe.cancel();
        }, 2_000);
        sample();
      } catch (error) {
        probe.error = String(error);
        probe.cancel();
        delete window.__brutalistItemPair;
        throw error;
      }
    }, originalRects)
  );
  let actionError: string | null = null;
  const cleanupErrors: string[] = [];
  try {
    const actionAt = await itemBounded(
      'Item action timestamp',
      page.evaluate(() => performance.now() - window.__brutalistItemPair!.started)
    );
    try {
      await itemBounded('Item native input', action());
    } catch (error) {
      actionError = String(error);
    }
    const captured = await itemBounded(
      'Item measured frames',
      page.evaluate(
        async ({ actionAt, actionError }) => {
          const probe = window.__brutalistItemPair!;
          await probe.done;
          return {
            frames: probe.frames,
            events: probe.events,
            measurementError: probe.error,
            actionAt,
            actionError,
            cleanup: probe.cleanup,
          };
        },
        { actionAt, actionError }
      )
    );
    return { ...captured, cleanupErrors };
  } finally {
    try {
      await itemBounded(
        'Item observer cleanup',
        page.evaluate(() => {
          window.__brutalistItemPair?.cancel();
          delete window.__brutalistItemPair;
        })
      );
    } catch (error) {
      // Retain measured frames and the primary input/read failure.
      cleanupErrors.push(String(error));
    }
  }
}

for (const theme of ['light', 'dark'] as const) {
  it(`measures real WC ${theme} Item border handoff and fixed geometry through live preferences`, async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: theme,
      reducedMotion: 'no-preference',
    });
    context.setDefaultTimeout(5_000);
    context.setDefaultNavigationTimeout(15_000);
    let contextClosed = false;
    context.on('close', () => {
      contextClosed = true;
    });
    let page: Page | undefined;
    const external: string[] = [];
    const traces: unknown[] = [];
    const secondaryErrors: string[] = [];
    let failed: string | null = null;
    let native: unknown = null;
    let opener: unknown = null;
    const handles: Array<Awaited<ReturnType<Locator['elementHandle']>>> = [];
    try {
      await itemBounded(
        'Item route installation',
        context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          if (
            url.origin === new URL(baseUrl).origin ||
            url.protocol === 'data:' ||
            url.protocol === 'blob:'
          )
            return route.continue();
          external.push(url.origin);
          return route.abort();
        })
      );
      page = await itemBounded('Item page creation', context.newPage());
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/components/button/`, {
        waitUntil: 'networkidle',
      });
      await itemBounded('Item preferences reveal', revealHeaderPreferences(page), 10_000);
      if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== theme) {
        await page
          .locator(
            '.site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
          )
          .click();
        await page.waitForFunction(
          (expected) => document.documentElement.dataset.theme === expected,
          theme
        );
      }
      const trigger = page.locator(
        '[data-adapter-select] wc-brutalist-select-trigger[data-appearance="elevated"]:visible'
      );
      expect(await trigger.count()).toBe(1);
      await trigger.click();
      const contentId = await trigger.getAttribute('aria-controls');
      if (!contentId) throw new Error('Missing owned native listbox id');
      const content = page
        .locator('[role="listbox"]:visible')
        .filter({ has: page.locator('wc-brutalist-select-item') });
      expect(await content.count()).toBe(1);
      expect(await content.getAttribute('id')).toBe(contentId);
      const items = content.locator('wc-brutalist-select-item[role="option"]:visible');
      await expect.poll(() => items.count()).toBeGreaterThanOrEqual(2);
      for (const index of [0, 1]) {
        const handle = await items.nth(index).elementHandle();
        if (!handle) throw new Error('Missing WC Item identity');
        handles.push(handle);
      }
      native = await itemBounded(
        'Item native identity read',
        items.evaluateAll((all) =>
          all.slice(0, 2).map((node) => ({
            tag: node.localName,
            role: node.getAttribute('role'),
            id: node.id,
            selected: node.getAttribute('aria-selected'),
            disabled: node.getAttribute('aria-disabled'),
            root: node.getRootNode() instanceof ShadowRoot ? 'shadow' : 'document',
          }))
        )
      );
      const activePage = page;
      let releaseCompletedAt: number | null = null;
      // Trigger owns elevated release motion; the anchored Content follows it.
      // Retain that phase separately before measuring the Item-only geometry
      // invariant in P-BRUTALIST-SELECT-ITEM-INCOMING-MOTION.
      const released = await captureItemPair(activePage, items, null, async () => {
        await activePage.mouse.move(1400, 950);
        await expect
          .poll(() =>
            trigger.evaluate(
              (node) =>
                !node.matches(':hover, :active') &&
                node.getAnimations({ subtree: true }).every(
                  (animation) =>
                    !animation.pending &&
                    (animation.playState === 'finished' || animation.playState === 'idle')
                )
            )
          )
          .toBe(true);
        await expect
          .poll(() =>
            content.evaluate((node) =>
              node.getAnimations({ subtree: true }).every(
                (animation) =>
                  !animation.pending &&
                  (animation.playState === 'finished' || animation.playState === 'idle')
              )
            )
          )
          .toBe(true);
        releaseCompletedAt = await activePage.evaluate(
          () => performance.now() - window.__brutalistItemPair!.started
        );
      });
      opener = { phase: 'opener-release', ...released, releaseCompletedAt };
      await itemBounded(
        'Item opener raw trace write',
        writeFile(
          path.join(output, `items-${theme}.json`),
          JSON.stringify({ source, native, opener, traces, external }, null, 2)
        )
      );
      if (released.actionError || released.measurementError)
        throw new Error(released.actionError ?? released.measurementError!);
      expect(released.cleanupErrors).toEqual([]);
      expect(released.cleanup).toEqual({ raf: 0, deadline: 0, listeners: 0 });
      expect(releaseCompletedAt).not.toBeNull();
      expect(await trigger.getAttribute('aria-expanded')).toBe('true');
      let originalRects: number[][] | null = null;
      let expectedRest: ItemPaint | undefined;
      let expectedHighlighted: ItemPaint | undefined;
      const paintKey = (paint: ItemPaint) => JSON.stringify([paint.background, paint.foreground]);
      for (const preference of ['no-preference', 'reduce', 'no-preference'] as const) {
        for (const incoming of [1, 0]) {
          const captured = await captureItemPair(activePage, items, originalRects, async () => {
            await activePage.emulateMedia({ reducedMotion: preference });
            await items.nth(incoming).hover();
          });
          traces.push({ theme, preference, incoming, ...captured });
          await itemBounded(
            'Item raw trace write',
            writeFile(
              path.join(output, `items-${theme}.json`),
              JSON.stringify({ source, native, opener, traces, external }, null, 2)
            )
          );
          if (captured.actionError || captured.measurementError)
            throw new Error(captured.actionError ?? captured.measurementError!);
          expect(captured.cleanupErrors).toEqual([]);
          expect(captured.cleanup).toEqual({ raf: 0, deadline: 0, listeners: 0 });
          const frames = captured.frames;
          expect(frames.length).toBeGreaterThan(3);
          // Bootstrap from the pre-input frame only, never from a successful tail.
          if (originalRects === null) {
            const first = frames[0].items;
            expect(first.filter((item) => item.highlighted)).toHaveLength(1);
            expectedRest = first.find((item) => !item.highlighted)!;
            expectedHighlighted = first.find((item) => item.highlighted)!;
            originalRects = first.map((item) => [...item.rect]);
          }
          const rest = expectedRest!;
          const highlight = expectedHighlighted!;
          const allowedPaint = [paintKey(rest), paintKey(highlight)];
          expect(allowedPaint[0]).not.toBe(allowedPaint[1]);
          expect(highlight.border).toBe('rgb(0, 0, 0)');
          expect(rest.border).toBe('rgba(0, 0, 0, 0)');
          const outgoing = 1 - incoming;
          for (const frame of frames) {
            expect(frame.items.filter((item) => item.highlighted).length).toBeLessThanOrEqual(1);
            for (const [index, item] of frame.items.entries()) {
              expect(item.connected && item.hit).toBe(true);
              expect(item.contrast).toBeGreaterThanOrEqual(4.5);
              expect(allowedPaint).toContain(paintKey(item));
              expect(paintKey(item)).toBe(item.highlighted ? allowedPaint[1] : allowedPaint[0]);
              item.rect.forEach((value, axis) =>
                expect(Math.abs(value - originalRects![index][axis])).toBeLessThanOrEqual(0.05)
              );
              expect(
                item.transitions.every((name) =>
                  /^border-(top|right|bottom|left)-color$/.test(name)
                )
              ).toBe(true);
            }
            if (frame.items[incoming].highlighted) {
              expect(frame.items[outgoing].border).toBe(rest.border);
              expect(frame.items[outgoing].transitions).toEqual([]);
              if (preference === 'reduce') expect(frame.items[incoming].transitions).toEqual([]);
            }
          }
          const tail = frames.at(-1)!;
          expect(tail.reducedMotion).toBe(preference === 'reduce');
          expect(tail.items[incoming].highlighted).toBe(true);
          expect(tail.items[outgoing].highlighted).toBe(false);
          expect(tail.items[incoming].border).toBe(highlight.border);
          expect(tail.items[outgoing].border).toBe(rest.border);
          expect(
            frames
              .slice(-3)
              .every((frame) => frame.items[incoming].border === tail.items[incoming].border)
          ).toBe(true);
          if (preference === 'reduce')
            expect(
              frames.flatMap((frame) => frame.items.flatMap((item) => item.transitions))
            ).toEqual([]);
          if (preference !== 'reduce') {
            expect(
              new Set(frames.map((frame) => frame.items[incoming].border)).size
            ).toBeGreaterThan(2);
            expect(frames.some((frame) => frame.items[incoming].transitions.length > 0)).toBe(true);
          }
          expect(
            captured.events.some(
              (event) => event.index === incoming && event.type === 'pointerenter'
            )
          ).toBe(true);
          for (const index of [0, 1])
            expect(
              await items.nth(index).evaluate((node, original) => node === original, handles[index])
            ).toBe(true);
          expect(external).toEqual([]);
        }
      }
      expect(traces).toHaveLength(6);
      await page.screenshot({
        path: path.join(output, `items-${theme}-open-highlight.png`),
        timeout: 5_000,
      });
      await page.keyboard.press('Escape');
      await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
      expect(context.pages()).toHaveLength(1);
      expect(external).toEqual([]);
    } catch (error) {
      failed = String(error);
      throw error;
    } finally {
      if (page) {
        try {
          await itemBounded(
            'Item final observer cleanup',
            page.evaluate(() => {
              window.__brutalistItemPair?.cancel();
              delete window.__brutalistItemPair;
            })
          );
        } catch (error) {
          secondaryErrors.push(`observer cleanup: ${String(error)}`);
        }
        try {
          await page.screenshot({
            path: path.join(output, `items-${theme}-final.png`),
            timeout: 5_000,
          });
        } catch (error) {
          secondaryErrors.push(`screenshot: ${String(error)}`);
        }
      }
      for (const handle of handles) {
        try {
          await itemBounded('Item identity dispose', handle!.dispose());
        } catch (error) {
          secondaryErrors.push(`identity cleanup: ${String(error)}`);
        }
      }
      try {
        await itemBounded('Item context close', context.close());
      } catch (error) {
        secondaryErrors.push(`context cleanup: ${String(error)}`);
      }
      if (!contextClosed)
        secondaryErrors.push('Context close event not observed; teardown incomplete');
      try {
        await itemBounded(
          'Item final raw write',
          writeFile(
            path.join(output, `items-${theme}-final.json`),
            JSON.stringify(
              { source, theme, native, opener, traces, external, failed, secondaryErrors, contextClosed },
              null,
              2
            )
          )
        );
      } catch (error) {
        secondaryErrors.push(`raw output: ${String(error)}`);
      }
      if (!failed && secondaryErrors.length) throw new Error(secondaryErrors.join('\n'));
    }
  }, 90_000);
}
