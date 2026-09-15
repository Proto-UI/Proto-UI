// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createServer as createViteServer,
  type ViteDevServer,
} from '../../workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness';

let server: Server;
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-color-scheme-browser-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(new URL('./fixtures/color-scheme/vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Color scheme fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Color scheme browser evidence: ${evidenceDir}`);
}, 60_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      await vite?.close();
    } finally {
      if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}, 60_000);

async function paint(target: Locator) {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      tokens: element.getAttribute('data-pui-style'),
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
      visibility: style.visibility,
      width: element.getBoundingClientRect().width,
    };
  });
}

function alpha(background: string): number {
  const value =
    /\/\s*([\d.]+)\)/.exec(background)?.[1] ?? /rgba\(.*?,\s*([\d.]+)\)/.exec(background)?.[1];
  return value === undefined ? 1 : Number(value);
}

async function theme(page: Page, value: 'light' | 'dark' | 'system') {
  await page.evaluate((next) => (window as any).colorSchemeFixture.setTheme(next), value);
}

async function stats(page: Page) {
  return page.evaluate(() => ({ ...(window as any).colorSchemeFixture.stats }));
}

async function resources(page: Page) {
  return page.evaluate(() => (window as any).colorSchemeFixture.resources());
}

async function activeResources(page: Page) {
  await expect
    .poll(() => resources(page))
    .toMatchObject({ rootObservers: 1, colorSchemeListeners: 1 });
}

describe.sequential('default-document colorScheme browser contract', () => {
  it.each(['wc', 'react', 'vue', 'vue2'])(
    '%s paints without interaction and preserves the accepted lifetime',
    async (runtime) => {
      const context = await browser.newContext({
        viewport: { width: 1100, height: 1400 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      const observations: Record<string, unknown> = { runtime, browser: browser.version() };
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${baseUrl}/?runtime=${runtime}`);
        try {
          await page.waitForSelector('body[data-ready="true"]', { timeout: 20_000 });
        } catch (error) {
          throw new Error(`${String(error)}\nBrowser errors: ${errors.join('\n')}`);
        }
        const button = page.locator('[data-demo-ref="button"]');
        const outline = page.locator('[data-demo-ref="outline"]');
        const custom = page.locator('[data-demo-ref="custom"]');
        const probe = page.locator('[data-case="probe"] [data-demo-ref="probe"]');
        const textarea = page.locator('[data-case="textarea"] textarea');
        const customEditor = page.locator('[data-case="customTextarea"] textarea');
        const checkbox = page.locator('[data-demo-ref="checkbox"]');
        const switchRoot = page.locator('[data-demo-ref="switch"]');
        observations.initialEditorValues = {
          native: await textarea.inputValue(),
          customNative: await customEditor.inputValue(),
          logical: await page.evaluate(() => (window as any).colorSchemeFixture.editorValues()),
        };
        const draft = 'User draft survives theme changes';
        const customDraft = 'Custom reader sample';
        // Seed through actual editor input and blur before measuring settled color-only changes.
        await textarea.fill(draft);
        await customEditor.fill(customDraft);
        await page.locator('h1').click();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        expect(await textarea.inputValue()).toBe(draft);
        expect(await customEditor.inputValue()).toBe(customDraft);
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.1);
        expect(await probe.textContent()).toBe('Retained Shadcn consumer');
        await activeResources(page);
        observations.initialResources = await resources(page);
        const initialStats = await stats(page);
        const oldButton = await button.elementHandle();
        const oldEditor = await textarea.elementHandle();
        const lightEditor = await paint(textarea);
        const lightCheckbox = await paint(checkbox);
        const lightSwitch = await paint(switchRoot);
        expect(alpha(lightCheckbox.background)).toBe(0);
        expect(alpha(lightSwitch.background)).toBe(0.8);
        expect((await paint(outline)).background).toBe(
          await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
        );
        expect(lightCheckbox.width).toBeGreaterThan(0);
        expect(lightSwitch.width).toBeGreaterThan(0);
        observations.light = {
          button: await paint(button),
          outline: await paint(outline),
          textarea: lightEditor,
          checkbox: lightCheckbox,
          switch: lightSwitch,
          stats: initialStats,
        };

        // P-SHADCN-BUTTON dark destructive recipe is /20, its light recipe is /10.
        // The environment changes without a pointer/key event or Proto update.
        await theme(page, 'dark');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.2);
        await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.2);
        await expect.poll(async () => alpha((await paint(outline)).background)).toBe(0.045);
        await expect.poll(async () => alpha((await paint(checkbox)).background)).toBe(0.045);
        await expect.poll(async () => alpha((await paint(switchRoot)).background)).toBe(0.075);
        expect(await stats(page)).toEqual(initialStats);
        expect(await button.evaluate((node, old) => node === old, oldButton)).toBe(true);
        expect(await textarea.evaluate((node, old) => node === old, oldEditor)).toBe(true);
        expect(await textarea.inputValue()).toBe(draft);
        expect(await customEditor.inputValue()).toBe(customDraft);
        expect(
          await page.evaluate(() => (window as any).colorSchemeFixture.editorValues())
        ).toEqual({ textarea: draft, customTextarea: customDraft });
        expect((await paint(textarea)).background).not.toBe(lightEditor.background);
        expect((await paint(checkbox)).background).not.toBe(lightCheckbox.background);
        expect((await paint(switchRoot)).background).not.toBe(lightSwitch.background);
        expect(await checkbox.getAttribute('aria-checked')).toBe('false');
        expect(await switchRoot.getAttribute('aria-checked')).toBe('false');
        expect(alpha((await paint(custom)).background)).toBe(0.1);
        observations.dark = {
          button: await paint(button),
          outline: await paint(outline),
          textarea: await paint(textarea),
          checkbox: await paint(checkbox),
          switch: await paint(switchRoot),
          custom: await paint(custom),
          stats: await stats(page),
        };
        await page
          .locator('#board')
          .screenshot({ path: path.join(evidenceDir, `${runtime}-dark.png`) });

        await theme(page, 'light');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.1);
        expect(await stats(page)).toEqual(initialStats);
        expect(await textarea.inputValue()).toBe(draft);
        expect(await customEditor.inputValue()).toBe(customDraft);
        observations.lightAgain = await paint(button);
        await page
          .locator('#board')
          .screenshot({ path: path.join(evidenceDir, `${runtime}-light.png`) });

        await checkbox.click();
        await switchRoot.click();
        await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true');
        await expect.poll(() => switchRoot.getAttribute('aria-checked')).toBe('true');
        await page.locator('h1').click();
        await expect
          .poll(async () => (await paint(switchRoot)).background)
          .toBe((await paint(checkbox)).background);
        expect(alpha((await paint(checkbox)).background)).toBe(1);
        expect((await paint(checkbox)).background).toBe((await paint(checkbox)).border);
        const checkedLight = { checkbox: await paint(checkbox), switch: await paint(switchRoot) };
        await theme(page, 'dark');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.2);
        expect(await checkbox.getAttribute('aria-checked')).toBe('true');
        expect(await switchRoot.getAttribute('aria-checked')).toBe('true');
        await expect
          .poll(async () => (await paint(switchRoot)).background)
          .toBe((await paint(checkbox)).background);
        expect(alpha((await paint(checkbox)).background)).toBe(1);
        expect((await paint(checkbox)).background).toBe((await paint(checkbox)).border);
        observations.checked = {
          light: checkedLight,
          dark: { checkbox: await paint(checkbox), switch: await paint(switchRoot) },
        };
        await page
          .locator('#board')
          .screenshot({ path: path.join(evidenceDir, `${runtime}-checked-dark.png`) });
        await theme(page, 'light');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.1);

        await page.emulateMedia({ colorScheme: 'dark' });
        expect(alpha((await paint(button)).background)).toBe(0.1); // Explicit light overrides OS dark.
        await theme(page, 'system');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.2);
        await page.emulateMedia({ colorScheme: 'light' });
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.1);
        expect(await stats(page)).toEqual(initialStats);
        observations.system = await paint(button);

        const oldProbe = await probe.elementHandle();
        await page.evaluate(() => (window as any).colorSchemeFixture.setPresent(false));
        const detachedTokens = oldProbe ? await oldProbe.getAttribute('data-pui-style') : null;
        await theme(page, 'dark');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.2);
        if (oldProbe) expect(await oldProbe.getAttribute('data-pui-style')).toBe(detachedTokens);
        const frames = await page.evaluate(async () => {
          const samples: Array<{ visible: boolean; background: string; pending: boolean }> = [];
          const collect = (remaining: number): Promise<void> =>
            new Promise((resolve) =>
              requestAnimationFrame(async () => {
                const sample = (window as any).colorSchemeFixture.frame('probe');
                if (sample) samples.push(sample);
                if (remaining > 1) await collect(remaining - 1);
                resolve();
              })
            );
          const done = collect(8);
          await (window as any).colorSchemeFixture.setPresent(true);
          await done;
          return samples;
        });
        const visible = frames.filter((frame) => frame.visible);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible[0].pending).toBe(false);
        expect(alpha(visible[0].background)).toBe(0.2);
        expect(visible.every((sample) => alpha(sample.background) === 0.2 && !sample.pending)).toBe(
          true
        );
        expect((await stats(page)).probeSetups).toBe(initialStats.probeSetups);
        await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.2);
        observations.remountFrames = frames;
        await activeResources(page);

        if (runtime === 'vue' || runtime === 'vue2') {
          await page.evaluate(() => (window as any).colorSchemeFixture.setKept(false));
          await theme(page, 'light');
          await page.evaluate(() => (window as any).colorSchemeFixture.setKept(true));
          await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.1);
          expect((await stats(page)).probeSetups).toBe(initialStats.probeSetups);
        } else if (runtime === 'wc') {
          await page.evaluate(() => (window as any).colorSchemeFixture.moveProbe());
          await theme(page, 'light');
          await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.1);
          expect((await stats(page)).probeSetups).toBe(initialStats.probeSetups);
          const beforeReconnect = (await stats(page)).probeSetups;
          await page.evaluate(() => (window as any).colorSchemeFixture.disconnectProbe());
          await theme(page, 'dark');
          await page.evaluate(() => (window as any).colorSchemeFixture.reconnectProbe());
          await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.2);
          expect((await stats(page)).probeSetups).toBe(beforeReconnect + 1);
        }
        await activeResources(page);
        observations.afterReplayResources = await resources(page);

        await theme(page, 'light');
        await expect.poll(async () => alpha((await paint(probe)).background)).toBe(0.1);
        const beforeProps = await stats(page);
        await page.evaluate(async () => {
          const fixture = (window as any).colorSchemeFixture;
          const changed = fixture.setDisabled(true);
          fixture.setTheme('dark');
          await changed;
        });
        // A normal presentation callback may synchronize Props before the explicit update;
        // React may also leave invalidation pending until that sync point.
        const afterHostProps = await stats(page);
        expect([beforeProps.probeWatches, beforeProps.probeWatches + 1]).toContain(
          afterHostProps.probeWatches
        );
        expect((await stats(page)).probeRenders).toBe(beforeProps.probeRenders);
        await page.evaluate(() => (window as any).colorSchemeFixture.updateProbe());
        expect((await stats(page)).probeRenders).toBe(beforeProps.probeRenders + 1);
        expect((await stats(page)).probeWatches).toBe(beforeProps.probeWatches + 1);
        observations.props = {
          before: beforeProps,
          afterHost: afterHostProps,
          afterUpdate: await stats(page),
        };
        await page.evaluate(() => (window as any).colorSchemeFixture.setDisabled(false));

        await theme(page, 'light');
        const portalFrames = await page.evaluate(async () => {
          const samples: Array<{ visible: boolean; background: string; pending: boolean }> = [];
          const collect = (left: number): Promise<void> =>
            new Promise((resolve) =>
              requestAnimationFrame(async () => {
                const sample = (window as any).colorSchemeFixture.frame('portalButton');
                if (sample) samples.push(sample);
                if (left > 1) await collect(left - 1);
                resolve();
              })
            );
          const collected = collect(12);
          await (window as any).colorSchemeFixture.openPortalWithLateTheme();
          await collected;
          return samples;
        });
        const portal = page.locator('[data-demo-ref="portalButton"]');
        const portalVisible = portalFrames.filter((sample) => sample.visible);
        expect(portalVisible.length).toBeGreaterThan(0);
        expect(
          portalVisible.every((sample) => alpha(sample.background) === 0.2 && !sample.pending)
        ).toBe(true);
        expect(
          await page.evaluate(() => (window as any).colorSchemeFixture.portalFlipAt())
        ).not.toBeNull();
        observations.portalFrames = portalFrames;
        expect(
          await portal.evaluate((element) => !document.querySelector('#app')!.contains(element))
        ).toBe(true);
        await theme(page, 'dark');
        await expect.poll(async () => alpha((await paint(portal)).background)).toBe(0.2);
        observations.portal = await paint(portal);
        await page
          .locator('[data-demo-ref="content"]')
          .screenshot({ path: path.join(evidenceDir, `${runtime}-portal.png`) });

        await page.evaluate(() => (window as any).colorSchemeFixture.setDialog(false));
        const leaving = await page
          .locator('[data-demo-ref="content"]')
          .getAttribute('data-transition-state');
        expect(leaving).toBe('leaving');
        await theme(page, 'light');
        observations.leaving = await paint(portal);
        // Tokens update while the existing Transition still owns its leaving view.
        expect((observations.leaving as { tokens: string }).tokens).toContain('bg-destructive/10');
        expect((observations.leaving as { tokens: string }).tokens).not.toContain(
          'bg-destructive/20'
        );

        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const leavingTransition = page.evaluate(() =>
          (window as any).colorSchemeFixture.observeTransition('leave')
        );
        await page.waitForFunction(
          () => (window as any).colorSchemeFixture.transitionPhase() === 'leaving'
        );
        await page.emulateMedia({ reducedMotion: 'reduce' });
        expect(
          await page.evaluate(() => (window as any).colorSchemeFixture.transitionPhase())
        ).toBe('leaving');
        await theme(page, 'dark');
        const completedLeave = await leavingTransition;
        expect(completedLeave.elapsed).toBeGreaterThanOrEqual(150);
        expect(completedLeave.events.map((event: { name: string }) => event.name)).toEqual([
          'beforeLeave',
          'afterLeave',
        ]);
        expect(completedLeave.present).toBe(false);
        const completedEnter = await page.evaluate(() =>
          (window as any).colorSchemeFixture.observeTransition('enter')
        );
        expect(completedEnter.elapsed).toBeLessThan(150);
        expect(completedEnter.events.map((event: { name: string }) => event.name)).toEqual([
          'beforeEnter',
          'afterEnter',
        ]);
        expect(completedEnter.present).toBe(true);
        observations.transition = { completedLeave, completedEnter };

        await theme(page, 'light');
        await expect.poll(async () => alpha((await paint(button)).background)).toBe(0.1);
        expect(alpha((await paint(customEditor)).background)).toBe(0);
        const localTheme = page.locator('[data-case="textarea"] > div');
        await localTheme.evaluate((element) => element.classList.add('dark'));
        await expect.poll(async () => alpha((await paint(textarea)).background)).toBe(0.3);
        const readerSamples = await page.evaluate(() =>
          (window as any).colorSchemeFixture.readerSamples()
        );
        expect(readerSamples).toEqual({ default: 'light', customTextarea: 'dark' });
        observations.exclusions = {
          readerSamples,
          localDark: await paint(textarea),
          customDark: await paint(customEditor),
        };
        await localTheme.evaluate((element) => {
          element.setAttribute('class', 'light');
        });
        await theme(page, 'dark');
        await expect.poll(async () => alpha((await paint(textarea)).background)).toBe(0.045);
        observations.localLightUnderDark = await paint(textarea);
        if (runtime === 'wc') {
          await theme(page, 'light');
          const surface = page.locator('[data-color-scheme-surface="current"]');
          await expect.poll(async () => alpha((await paint(surface)).background)).toBe(0.1);
          const oldSurface = await surface.elementHandle();
          const before = await page.evaluate(() =>
            (window as any).colorSchemeFixture.surfaceState()
          );
          await page.evaluate(() => (window as any).colorSchemeFixture.replaceSurface());
          const after = await page.evaluate(() =>
            (window as any).colorSchemeFixture.surfaceState()
          );
          expect({ epoch: after.epoch, renders: after.renders, commits: after.commits }).toEqual({
            epoch: before.epoch,
            renders: before.renders,
            commits: before.commits,
          });
          expect(await surface.evaluate((element, old) => element === old, oldSurface)).toBe(false);
          const retiredTokens = await oldSurface!.getAttribute('data-pui-style');
          await theme(page, 'dark');
          await expect.poll(async () => alpha((await paint(surface)).background)).toBe(0.2);
          expect(await oldSurface!.getAttribute('data-pui-style')).toBe(retiredTokens);
          observations.surfaceReplacement = {
            before,
            after,
            paint: await paint(surface),
            retiredTokens,
          };
          await page
            .locator('#physical-surface')
            .screenshot({ path: path.join(evidenceDir, 'wc-surface-replacement.png') });
        }
        await page.evaluate(() => (window as any).colorSchemeFixture.dispose());
        await expect
          .poll(() => resources(page))
          .toMatchObject({ rootObservers: 0, colorSchemeListeners: 0 });
        await theme(page, 'light');
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect
          .poll(() => resources(page))
          .toMatchObject({ rootObservers: 0, colorSchemeListeners: 0 });
        observations.disposedResources = await resources(page);
        await page.evaluate(() => (window as any).colorSchemeFixture.restoreInstrumentation());
        expect(errors).toEqual([]);
      } finally {
        await writeFile(
          path.join(evidenceDir, `${runtime}.json`),
          JSON.stringify({ ...observations, errors }, null, 2) + '\n'
        );
        await context.close();
      }
    },
    90_000
  );

  it.each(['wc', 'react', 'vue', 'vue2'])(
    '%s reveals the initial dark recipe',
    async (runtime) => {
      const context = await browser.newContext({
        viewport: { width: 1100, height: 1400 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/?runtime=${runtime}&initial=dark`);
        await page.waitForSelector('body[data-ready="true"]', { timeout: 20_000 });
        const frames = await page.evaluate(() => (window as any).colorSchemeFixture.initialFrames);
        for (const [id, expected] of Object.entries({
          button: 0.2,
          outline: 0.045,
          checkbox: 0.045,
          switch: 0.075,
          textarea: 0.045,
          probe: 0.2,
        })) {
          expect(frames[id].length).toBeGreaterThan(0);
          expect(
            frames[id].every(
              (sample: { background: string; pending: boolean }) =>
                !sample.pending && alpha(sample.background) === expected
            )
          ).toBe(true);
        }
        await activeResources(page);
        await writeFile(
          path.join(evidenceDir, `${runtime}-initial-dark.json`),
          JSON.stringify(frames, null, 2) + '\n'
        );
        await page.evaluate(() => (window as any).colorSchemeFixture.dispose());
        await expect
          .poll(() => resources(page))
          .toMatchObject({ rootObservers: 0, colorSchemeListeners: 0 });
        await page.evaluate(() => (window as any).colorSchemeFixture.restoreInstrumentation());
      } finally {
        await context.close();
      }
    },
    30_000
  );
});
