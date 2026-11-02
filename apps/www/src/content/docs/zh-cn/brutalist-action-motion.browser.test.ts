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
