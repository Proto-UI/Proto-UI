// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type TaskContext,
} from 'vitest';
import type {
  BrowserContext,
  Page,
} from '../../../apps/www/node_modules/playwright-core/types/types';
import { nativeTags, startNativeWcFixture } from './web-component-native-browser-fixture';
import { createNativeCaseOwner, withinNativePhase } from './web-component-native-case-owner';
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
type CaseState = {
  owner: ReturnType<typeof createNativeCaseOwner>;
  name: string;
  shadow: boolean | null;
  context?: BrowserContext;
  page?: Page;
  tracing: boolean;
  errors: string[];
  expectedErrors: string[];
  blocked: string[];
  messages: { type: string; text: string }[];
  failure?: unknown;
};
const cases = new WeakMap<TaskContext['task'], CaseState>();
beforeAll(async () => {
  fixture = await startNativeWcFixture();
}, 120_000);
afterAll(async () => {
  await fixture?.close();
}, 60_000);

// Keep the original 5s test-body budget for native product assertions. The
// existing Playwright navigation/readiness limit was 30s per operation; setup
// now has one shared 30s bound instead of consuming the first product case.
beforeEach(async (test) => {
  const owner = createNativeCaseOwner();
  const state: CaseState = {
    owner,
    name: 'setup-' + test.task.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
    shadow: null,
    tracing: false,
    errors: [],
    expectedErrors: [],
    blocked: [],
    messages: [],
  };
  cases.set(test.task, state);
  await withinNativePhase(
    'page setup',
    30_000,
    async () => {
      const context = (state.context = await owner.acquire(
        fixture.browser.newContext({
          viewport: { width: 900, height: 600 },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        })
      ));
      owner.assertActive();
      await context.route('**/*', (route) => {
        const u = new URL(route.request().url());
        if (u.origin !== fixture.baseUrl) {
          state.blocked.push(u.origin + u.pathname);
          return route.abort();
        }
        return route.continue();
      });
      owner.assertActive();
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      state.tracing = true;
      owner.assertActive();
      const page = (state.page = await context.newPage());
      owner.assertActive();
      page.on('pageerror', (error) => state.errors.push(error.message));
      page.on('console', (message) =>
        state.messages.push({ type: message.type(), text: message.text() })
      );
      const response = await page.goto(fixture.baseUrl);
      owner.assertActive();
      expect(response?.status()).toBe(200);
      await page.waitForFunction(() => window.nativeWcReady === true);
      owner.assertActive();
    },
    () => {
      owner.retire();
      void owner.close().catch(() => {});
    }
  );
}, 30_000);

// Vitest 2.1.9 runs afterEach after it has recorded a body failure/timeout. Its
// Promise.race timeout does not cancel that body, so retire its owner first.
// Per-case files are observations; only browser-vitest.json accepts a case.
afterEach(async (test) => {
  const state = cases.get(test.task);
  if (!state) return;
  cases.delete(test.task);
  state.owner.retire();
  const cleanupErrors: string[] = [];
  const cancel = () => void state.owner.close().catch(() => {});
  const capture = async (phase: string, milliseconds: number, run: () => Promise<unknown>) => {
    try {
      await withinNativePhase(phase, milliseconds, run, cancel);
    } catch (error) {
      cleanupErrors.push(`${phase}: ${String(error)}`);
    }
  };
  const suffix = test.task.result?.state === 'fail' ? '-FAIL' : '-OBSERVED';
  if (state.page && !state.page.isClosed()) {
    await capture('screenshot', 5_000, () =>
      state.page!.screenshot({
        path: path.join(fixture.evidenceDir, state.name + suffix + '.png'),
        fullPage: true,
        timeout: 5_000,
      })
    );
  }
  if (state.context && state.tracing) {
    await capture('trace export', 10_000, () =>
      state.context!.tracing.stop({
        path: path.join(fixture.evidenceDir, state.name + '-trace.zip'),
      })
    );
  }
  await capture('context cleanup', 10_000, () => state.owner.close());
  await withinNativePhase('evidence record', 5_000, () =>
    writeFile(
      path.join(fixture.evidenceDir, state.name + '-result.json'),
      JSON.stringify(
        {
          head: fixture.head,
          name: state.name,
          shadow: state.shadow,
          ...state.owner.observation(test.task.result?.state, cleanupErrors),
          errors: state.errors,
          expectedErrors: state.expectedErrors,
          blocked: state.blocked,
          messages: state.messages,
          failure: state.failure ? String(state.failure) : null,
          runnerErrors: test.task.result?.errors?.map((error) => error.message) ?? [],
          cleanupErrors,
        },
        null,
        2
      ),
      { signal: AbortSignal.timeout(5_000) }
    )
  );
  if (cleanupErrors.length) throw new Error(cleanupErrors.join('\n'));
}, 60_000);

async function withPage(
  test: TaskContext,
  name: string,
  shadow: boolean,
  run: (page: Page) => Promise<void>,
  expectedErrors: string[] = []
) {
  const state = cases.get(test.task);
  if (!state?.page) throw new Error('Native browser case setup did not complete');
  const { owner, page, errors, blocked } = state;
  owner.assertActive();
  state.name = name;
  state.shadow = shadow;
  state.expectedErrors = expectedErrors;
  try {
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
    owner.assertActive();
    expect(
      await page.evaluate(
        () => window.nativeProbe.owner !== null && window.nativeProbe.section !== null
      )
    ).toBe(true);
    await run(page);
    owner.assertActive();
    expect(errors).toEqual(expectedErrors);
    expect(blocked).toEqual([]);
    owner.complete();
  } catch (error) {
    state.failure = error;
    throw error;
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
    it('constructs empty/style/aliased nodes and updates a mixed helper', async (test) =>
      withPage(test, 'construct-' + shadow, shadow, async (page) => {
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
    it('retains native child identity/listeners and real slot projection on updates', async (test) =>
      withPage(test, 'slot-' + shadow, shadow, async (page) => {
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
    it('does not steal a consumer-transferred native slot child', async (test) =>
      withPage(test, 'transfer-' + shadow, shadow, async (page) => {
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
    it('retains same-turn owner, but disconnect/reconnect and dispose clean up', async (test) =>
      withPage(test, 'lifecycle-' + shadow, shadow, async (page) => {
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
      it(`preserves live DOM after ${phase} failure and recovers`, async (test) =>
        withPage(
          test,
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
