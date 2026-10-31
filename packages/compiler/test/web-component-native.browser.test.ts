// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from '../../../apps/www/node_modules/playwright-core/types/types';
import { nativeTags, startNativeWcFixture } from './web-component-native-browser-fixture';
interface NativeHost extends HTMLElement {
  logicalOwner: symbol | null;
  update(): void;
  getExposes(): { bump(value: number): void };
  dispose(): void;
}
declare global {
  interface Window {
    nativeWcReady: boolean;
    nativeProbe: {
      host: NativeHost;
      child: HTMLButtonElement;
      section: Element;
      owner: symbol | null;
      clicks: number;
      oldExposes?: { bump(value: number): void };
    };
  }
}
let fixture: Awaited<ReturnType<typeof startNativeWcFixture>>;
beforeAll(async () => {
  fixture = await startNativeWcFixture();
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);
async function withPage(
  name: string,
  shadow: boolean,
  run: (page: Page) => Promise<void>,
  expectedErrors: string[] = []
) {
  const context = await fixture.browser.newContext({
    viewport: { width: 900, height: 600 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const blocked: string[] = [];
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== fixture.baseUrl) {
      blocked.push(u.origin + u.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors: string[] = [];
  const messages: { type: string; text: string }[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => messages.push({ type: message.type(), text: message.text() }));
  let failure: unknown;
  let screenshotError: unknown;
  try {
    const response = await page.goto(fixture.baseUrl);
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => window.nativeWcReady === true);
    await page.evaluate(
      (tag) => {
        const host = document.createElement(tag) as NativeHost;
        const child = document.createElement('button');
        child.textContent = 'native consumer';
        window.nativeProbe = {
          host,
          child,
          section: document.createElement('section'),
          owner: null,
          clicks: 0,
        };
        child.addEventListener('click', () => window.nativeProbe.clicks++);
        host.append(child);
        document.querySelector('#mount')!.append(host);
        window.nativeProbe.section = (host.shadowRoot ?? host).querySelector('section')!;
        window.nativeProbe.owner = host.logicalOwner;
      },
      shadow ? nativeTags.shadow : nativeTags.light
    );
    expect(
      await page.evaluate(
        () => window.nativeProbe.owner !== null && window.nativeProbe.section !== null
      )
    ).toBe(true);
    await run(page);
    expect(errors).toEqual(expectedErrors);
    expect(blocked).toEqual([]);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await page.screenshot({
        path: path.join(fixture.evidenceDir, name + (failure ? '-FAIL' : '-PASS') + '.png'),
        fullPage: true,
      });
    } catch (error) {
      screenshotError = error;
    }
    await writeFile(
      path.join(fixture.evidenceDir, name + '-result.json'),
      JSON.stringify(
        {
          head: fixture.head,
          name,
          shadow,
          outcome: failure || screenshotError ? 'FAIL' : 'PASS',
          errors,
          expectedErrors,
          blocked,
          messages,
          failure: failure ? String(failure) : null,
          screenshotError: screenshotError ? String(screenshotError) : null,
        },
        null,
        2
      )
    );
    try {
      await context.tracing.stop({ path: path.join(fixture.evidenceDir, name + '-trace.zip') });
    } finally {
      await context.close();
    }
    if (screenshotError && !failure) throw screenshotError;
  }
}
async function bump(page: Page, value: number) {
  await page.evaluate((n) => {
    window.nativeProbe.host.getExposes().bump(n);
    window.nativeProbe.host.update();
  }, value);
}
async function spanTexts(page: Page) {
  return page.evaluate(() =>
    Array.from(
      (window.nativeProbe.host.shadowRoot ?? window.nativeProbe.host).querySelectorAll(
        'section > span'
      ),
      (e) => e.textContent
    )
  );
}
for (const shadow of [false, true])
  describe('ordinary native WC browser ' + (shadow ? 'shadow' : 'light'), () => {
    it('constructs empty/style/aliased nodes and updates a mixed helper', async () =>
      withPage('construct-' + shadow, shadow, async (page) => {
        expect(await spanTexts(page)).toEqual(['1', '1']);
        expect(
          await page.evaluate(() => {
            const root = window.nativeProbe.host.shadowRoot ?? window.nativeProbe.host;
            const spans = root.querySelectorAll('span');
            const divs = root.querySelectorAll('section > div');
            return {
              distinct: spans[0] !== spans[1],
              empty: divs[0]?.childNodes.length,
              style: divs[1]?.getAttribute('data-pui-style'),
            };
          })
        ).toEqual({ distinct: true, empty: 0, style: 'bg-white' });
        await bump(page, -1);
        await expect.poll(() => spanTexts(page)).toEqual(['-1', '-1']);
        expect(
          await page.evaluate(() => {
            const root = window.nativeProbe.host.shadowRoot ?? window.nativeProbe.host;
            return {
              b: root.querySelector('b') === null,
              text: root.querySelector('section')?.textContent?.includes('negative'),
            };
          })
        ).toEqual({ b: true, text: true });
      }));
    it('retains native child identity/listeners and real slot projection on updates', async () =>
      withPage('slot-' + shadow, shadow, async (page) => {
        await page.evaluate(() => window.nativeProbe.child.click());
        await bump(page, 2);
        await expect.poll(() => spanTexts(page)).toEqual(['2', '2']);
        expect(
          await page.evaluate(() => {
            const p = window.nativeProbe;
            const slot = p.host.shadowRoot?.querySelector('slot');
            p.child.click();
            return {
              connected: p.child.isConnected,
              clicks: p.clicks,
              owner: p.host.logicalOwner === p.owner,
              projection: slot
                ? slot.assignedElements().includes(p.child)
                : p.child.closest('section') !== null,
            };
          })
        ).toEqual({ connected: true, clicks: 2, owner: true, projection: true });
      }));
    it('does not steal a consumer-transferred native slot child', async () =>
      withPage('transfer-' + shadow, shadow, async (page) => {
        await page.evaluate(() =>
          document.querySelector('#outside')!.append(window.nativeProbe.child)
        );
        await bump(page, 3);
        await expect.poll(() => spanTexts(page)).toEqual(['3', '3']);
        expect(
          await page.evaluate(() => {
            const p = window.nativeProbe;
            p.host.dispose();
            p.child.click();
            return { outside: p.child.parentElement?.id, clicks: p.clicks };
          })
        ).toEqual({ outside: 'outside', clicks: 1 });
      }));
    it('retains same-turn owner, but disconnect/reconnect and dispose clean up', async () =>
      withPage('lifecycle-' + shadow, shadow, async (page) => {
        await page.evaluate(() =>
          document.querySelector('#outside')!.append(window.nativeProbe.host)
        );
        expect(
          await page.evaluate(
            () => window.nativeProbe.host.logicalOwner === window.nativeProbe.owner
          )
        ).toBe(true);
        await page.evaluate(() => {
          const p = window.nativeProbe;
          p.oldExposes = p.host.getExposes();
          p.host.remove();
        });
        await expect
          .poll(() => page.evaluate(() => window.nativeProbe.host.logicalOwner === null))
          .toBe(true);
        expect(
          await page.evaluate(() => {
            try {
              window.nativeProbe.oldExposes!.bump(9);
              return false;
            } catch {
              return true;
            }
          })
        ).toBe(true);
        await page.evaluate(() =>
          document.querySelector('#mount')!.append(window.nativeProbe.host)
        );
        expect(
          await page.evaluate(() => {
            const p = window.nativeProbe;
            return p.host.logicalOwner !== null && p.host.logicalOwner !== p.owner;
          })
        ).toBe(true);
        await page.evaluate(() => window.nativeProbe.host.dispose());
        expect(
          await page.evaluate(() => {
            const p = window.nativeProbe;
            p.child.click();
            return {
              owner: p.host.logicalOwner,
              childParent: p.child.parentNode === p.host,
              clicks: p.clicks,
            };
          })
        ).toEqual({ owner: null, childParent: true, clicks: 1 });
      }));
    for (const [phase, value] of [
      ['evaluation', 99],
      ['construction', 98],
    ] as const) {
      it(`preserves live DOM after ${phase} failure and recovers`, async () =>
        withPage(
          'rollback-' + phase + '-' + shadow,
          shadow,
          async (page) => {
            await page.evaluate(() => {
              window.nativeProbe.child.focus();
              window.nativeProbe.child.click();
            });
            const error = page.waitForEvent('pageerror');
            await bump(page, value);
            expect((await error).message).toBe('Multiple slots are unsupported');
            expect(
              await page.evaluate(() => {
                const p = window.nativeProbe;
                const root = p.host.shadowRoot ?? p.host;
                p.child.click();
                return {
                  sameTree: root.querySelector('section') === p.section,
                  sameOwner: p.host.logicalOwner === p.owner,
                  childConnected: p.child.isConnected,
                  focused: document.activeElement === p.child,
                  clicks: p.clicks,
                  partial: root.textContent?.includes('partial') ?? false,
                };
              })
            ).toEqual({
              sameTree: true,
              sameOwner: true,
              childConnected: true,
              focused: true,
              clicks: 2,
              partial: false,
            });
            await bump(page, 4);
            await expect.poll(() => spanTexts(page)).toEqual(['4', '4']);
          },
          ['Multiple slots are unsupported']
        ));
    }
  });
