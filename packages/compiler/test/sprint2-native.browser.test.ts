// @vitest-environment node
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '../../../apps/www/node_modules/playwright-core';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildSprint2NativeFixture } from './sprint2-native-browser-fixture';
import type { createSprint2BrowserConsumer } from './sprint2-browser-consumer';

declare global {
  interface Window {
    sprint2Native: { fixture: ReturnType<typeof createSprint2BrowserConsumer> };
    sprint2Inputs: {
      type: string;
      trusted: boolean;
      value: string | null;
      selection: number | null;
    }[];
    sprint2MediaListeners: () => number;
  }
}
let browser: Browser, fixture: Awaited<ReturnType<typeof buildSprint2NativeFixture>>;
beforeAll(async () => {
  fixture = await buildSprint2NativeFixture();
  console.log('SPRINT2_NATIVE_EVIDENCE', fixture.evidenceDir);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
  await writeFile(path.join(fixture.evidenceDir, 'browser-version.txt'), browser.version());
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

async function withPage(
  name: string,
  run: (page: Page, record: (step: string) => Promise<void>) => Promise<void>
) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
    reducedMotion: 'no-preference',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage(),
    errors: string[] = [],
    blocked: string[] = [],
    snapshots: unknown[] = [],
    captureErrors: string[] = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });
  let failure: unknown;
  const record = async (step: string) =>
    snapshots.push({
      step,
      state: await page.evaluate(() => window.sprint2Native.fixture.read()),
      mediaListeners: await page.evaluate(() => window.sprint2MediaListeners()),
    });
  try {
    await page.setContent(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sprint 2 generated consumers</title></head><body><h1>Generated native consumers</h1><main id="mount"></main></body></html>'
    );
    await page.addStyleTag({
      content:
        'body{font:18px system-ui;padding:32px}#mount>div{display:contents}[data-sprint2-target]{display:inline-flex;min-width:100px;min-height:44px;border:2px solid #64748b;padding:10px}[data-sprint2-target]:focus{outline:3px solid #2563eb}input{font:20px monospace;width:260px}',
    });
    await page.evaluate(() => {
      const original = window.matchMedia.bind(window),
        queries: Set<EventListenerOrEventListenerObject>[] = [];
      window.matchMedia = (query) => {
        const native = original(query),
          listeners = new Set<EventListenerOrEventListenerObject>();
        queries.push(listeners);
        const add = native.addEventListener.bind(native),
          remove = native.removeEventListener.bind(native);
        native.addEventListener = ((
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions
        ) => {
          if (type === 'change') listeners.add(listener);
          add(type, listener, options);
        }) as typeof native.addEventListener;
        native.removeEventListener = ((
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | EventListenerOptions
        ) => {
          if (type === 'change') listeners.delete(listener);
          remove(type, listener, options);
        }) as typeof native.removeEventListener;
        return native;
      };
      window.sprint2MediaListeners = () => queries.reduce((total, query) => total + query.size, 0);
      window.sprint2Inputs = [];
      for (const type of ['pointerdown', 'click', 'keydown', 'input'])
        document.addEventListener(
          type,
          (event) =>
            window.sprint2Inputs.push({
              type,
              trusted: event.isTrusted,
              value: event.target instanceof HTMLInputElement ? event.target.value : null,
              selection:
                event.target instanceof HTMLInputElement ? event.target.selectionStart : null,
            }),
          true
        );
    });
    await page.addScriptTag({ content: fixture.bundle });
    await run(page, async (step) => {
      await record(step);
    });
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    for (const action of [
      () =>
        page.screenshot({
          path: path.join(fixture.evidenceDir, name + (failure ? '-FAIL' : '-PASS') + '.png'),
        }),
      () => context.tracing.stop({ path: path.join(fixture.evidenceDir, name + '.trace.zip') }),
    ])
      try {
        await action();
      } catch (error) {
        captureErrors.push(String(error));
      }
    let nativeInput: unknown;
    try {
      nativeInput = await page.evaluate(() => window.sprint2Inputs);
    } catch (error) {
      captureErrors.push(String(error));
    }
    await writeFile(
      path.join(fixture.evidenceDir, name + '.json'),
      JSON.stringify(
        {
          head: fixture.head,
          buildSha256: fixture.buildSha256,
          status: failure ? 'FAIL' : 'PASS',
          snapshots,
          errors,
          blocked,
          nativeInput,
          captureErrors,
          failure:
            failure instanceof Error
              ? { message: failure.message, stack: failure.stack }
              : (failure ?? null),
        },
        null,
        2
      ) + '\n'
    );
    await context.close();
  }
}

for (const target of ['react', 'vue', 'vue2', 'wc'] as const) {
  for (const family of ['base', 'shadcn', 'brutalist'] as const)
    it(
      `${target}/${family}: native Button activation, preferences and terminal cleanup`,
      async () =>
        withPage(target + '-' + family, async (page, record) => {
          const mounted = await page.evaluate(
            (args) => window.sprint2Native.fixture.mount(args.target, args.family),
            { target, family }
          );
          expect(mounted).toMatchObject({
            rootIdentity: true,
            ownerIdentity: true,
            childIdentity: true,
            role: 'button',
          });
          const button = page.locator('[data-sprint2-target]');
          await expect
            .poll(() => page.evaluate(() => window.sprint2Native.fixture.read()?.role))
            .toBe('button');
          expect(
            await page.evaluate(() => window.sprint2Native.fixture.read()?.childText)
          ).toContain('Ordinary child');
          await record('mounted');
          await button.click();
          await expect
            .poll(() => page.evaluate(() => window.sprint2Native.fixture.read()?.clicks))
            .toBe(1);
          expect(await page.evaluate(() => window.sprint2Native.fixture.read()?.focused)).toBe(
            true
          );
          await button.press('Enter');
          await expect
            .poll(() => page.evaluate(() => window.sprint2Native.fixture.read()?.clicks))
            .toBe(2);
          if (family === 'shadcn') {
            // The trusted click leaves the pointer hovering the button. Its authored
            // dark hover rule overrides the ordinary dark background contribution.
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('bg-input/30')
                )
              )
              .toBe(false);
            await page.emulateMedia({ colorScheme: 'dark' });
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('bg-input/50')
                )
              )
              .toBe(true);
            expect(
              await page.evaluate(() =>
                window.sprint2Native.fixture.read()?.style.includes('bg-input/30')
              )
            ).toBe(false);
            await record('dark-hover');
            await page.mouse.move(0, 0);
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('bg-input/30')
                )
              )
              .toBe(true);
            expect(
              await page.evaluate(() =>
                window.sprint2Native.fixture.read()?.style.includes('bg-input/50')
              )
            ).toBe(false);
            await record('dark-unhovered');
            await page.evaluate(() => {
              document.documentElement.dataset.theme = 'light';
            });
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('bg-input/30')
                )
              )
              .toBe(false);
            await record('explicit-light');
          }
          if (family === 'brutalist') {
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('transition-all')
                )
              )
              .toBe(true);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await expect
              .poll(() =>
                page.evaluate(() =>
                  window.sprint2Native.fixture.read()?.style.includes('transition-none')
                )
              )
              .toBe(true);
            expect(
              await page.evaluate(() =>
                window.sprint2Native.fixture.read()?.style.includes('transition-all')
              )
            ).toBe(false);
          }
          const changed = await page.evaluate(() => window.sprint2Native.fixture.setDisabled(true));
          expect(changed).toMatchObject({
            rootIdentity: true,
            ownerIdentity: true,
            childIdentity: true,
            disabled: true,
            ariaDisabled: 'true',
          });
          const bounds = await button.boundingBox();
          expect(bounds).not.toBeNull();
          await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
          expect(await page.evaluate(() => window.sprint2Native.fixture.read()?.clicks)).toBe(2);
          await record('disabled-and-preference-updated');
          const events = await page.evaluate(() => window.sprint2Inputs);
          expect(events.some((event) => event.type === 'click' && event.trusted)).toBe(true);
          expect(events.some((event) => event.type === 'keydown' && event.trusted)).toBe(true);
          expect(await page.evaluate(() => window.sprint2Native.fixture.dispose())).toEqual({
            heldRejected: true,
            remainingHosts: 0,
          });
          expect(await page.evaluate(() => window.sprint2MediaListeners())).toBe(0);
          await record('disposed');
        }),
      45_000
    );

  for (const mode of ['sync', 'queued'] as const)
    it(
      `${target}/${mode}: trusted controlled typing preserves caret through candidate refresh`,
      async () =>
        withPage(target + '-text-' + mode, async (page, record) => {
          const mounted = await page.evaluate(
            (args) => window.sprint2Native.fixture.mount(args.target, 'text', args.mode),
            { target, mode }
          );
          expect(mounted).toMatchObject({ ownerIdentity: true, physicalValue: '5' });
          await record('mounted');
          const input = page.locator('input[data-sprint2-target]');
          await input.click();
          await input.press('End');
          await input.pressSequentially('678');
          await expect
            .poll(() => page.evaluate(() => window.sprint2Native.fixture.read()?.text?.value))
            .toBe('5678');
          const nativeSelection = await input.evaluate((target: HTMLInputElement) => ({
            start: target.selectionStart,
            end: target.selectionEnd,
            direction: target.selectionDirection,
          }));
          expect(nativeSelection).toMatchObject({ start: 4, end: 4 });
          expect(['forward', 'backward', 'none']).toContain(nativeSelection.direction);
          expect(await page.evaluate(() => window.sprint2Native.fixture.read()?.text)).toEqual({
            value: '5678',
            composing: false,
            selection: nativeSelection,
          });
          expect(await input.inputValue()).toBe('5678');
          expect(
            await page.evaluate(() => window.sprint2Native.fixture.read()?.physicalSelection)
          ).toBe(4);
          await record('trusted-accepted-5678');
          await page.evaluate(() => window.sprint2Native.fixture.reject());
          await input.pressSequentially('9');
          await expect.poll(() => input.inputValue()).toBe('5678');
          expect(
            await page.evaluate(() => window.sprint2Native.fixture.read()?.physicalSelection)
          ).toBe(4);
          await record('rejected-native-candidate');
          const detached = await page.evaluate(() =>
            window.sprint2Native.fixture.setPresent(false)
          );
          expect(detached?.text?.selection).toBeNull();
          expect(
            (await page.evaluate(() => window.sprint2Native.fixture.staleInput()))?.text?.value
          ).toBe('5678');
          const reconnected = await page.evaluate(() =>
            window.sprint2Native.fixture.setPresent(true)
          );
          expect(reconnected).toMatchObject({ ownerIdentity: true, physicalValue: '5678' });
          await record('reconnected-owner');
          const inputEvents = (await page.evaluate(() => window.sprint2Inputs)).filter(
            (event) => event.type === 'input'
          );
          expect(inputEvents.length).toBeGreaterThanOrEqual(4);
          expect(inputEvents.every((event) => event.trusted)).toBe(true);
          expect(await page.evaluate(() => window.sprint2Native.fixture.dispose())).toEqual({
            heldRejected: true,
            remainingHosts: 0,
          });
          expect(await page.evaluate(() => window.sprint2MediaListeners())).toBe(0);
          await record('disposed');
        }),
      45_000
    );
}
