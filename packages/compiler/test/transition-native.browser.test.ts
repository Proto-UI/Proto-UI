// @vitest-environment node
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from '../../../apps/www/node_modules/playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildTransitionNativeFixture } from './transition-native-browser-fixture';
import type {
  createTransitionBrowserFixture,
  TransitionTarget,
  TransitionExecution,
} from './transition-browser-consumer';

declare global {
  interface Window {
    transitionNative: { fixture: ReturnType<typeof createTransitionBrowserFixture> };
  }
}

let browser: Browser;
const targets = ['react', 'vue', 'vue2', 'wc'] as const;
const fixtures = new Map<
  TransitionTarget,
  Awaited<ReturnType<typeof buildTransitionNativeFixture>>
>();
// Each target has its own canonical compiler prerequisite. Serializing all
// eight compilations inside one browser-launch hook hid which input exceeded
// that preparation budget and left every lifecycle case unexecuted.
for (const target of targets) {
  beforeAll(async () => {
    const start = performance.now();
    console.log(`Preparing Transition native ${target}: ordinary + prepared`);
    const built = await buildTransitionNativeFixture(target);
    fixtures.set(target, built);
    const elapsedMs = performance.now() - start;
    await writeFile(
      path.join(built.evidenceDir, 'preparation.json'),
      JSON.stringify(
        {
          target,
          head: built.head,
          elapsedMs,
          outcome: 'PASS',
          scope: 'Canonical compile and bundle prerequisite, not a lifecycle latency measurement.',
        },
        null,
        2
      ) + '\n'
    );
    console.log(
      `Prepared Transition native ${target} in ${Math.round(elapsedMs)}ms: ${built.evidenceDir}`
    );
  }, 60_000);
}
beforeAll(async () => {
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
  for (const built of fixtures.values())
    await writeFile(path.join(built.evidenceDir, 'browser-version.txt'), browser.version());
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

const cases = targets.flatMap((target) =>
  (['runtime', 'compiled'] as const).map((execution) => ({ target, execution }))
);
type Scenario = { target: TransitionTarget; execution: TransitionExecution };
type Snapshot = ReturnType<ReturnType<typeof createTransitionBrowserFixture>['read']>;

async function run(
  scenario: Scenario,
  name: string,
  exercise: (context: {
    page: Page;
    mount(
      id: string,
      props?: Record<string, unknown>,
      variant?: 'ordinary' | 'prepared'
    ): Promise<void>;
    read(id: string, stage: string): Promise<Snapshot>;
    operate(id: string, method: 'enter' | 'leave' | 'complete'): Promise<void>;
    phase(id: string, phase: string): Promise<void>;
  }) => Promise<void>,
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference'
) {
  const built = fixtures.get(scenario.target);
  if (!built) throw new Error(`Missing prepared native target ${scenario.target}`);
  const page = await browser.newPage({ viewport: { width: 800, height: 500 }, reducedMotion });
  page.setDefaultTimeout(5_000);
  const errors: string[] = [];
  const snapshots: unknown[] = [];
  let failure: string | null = null;
  const key = `${scenario.target}-${scenario.execution}-${name}`;
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.route('**/*', (route) => route.abort());
    await page.setContent(
      '<!doctype html><html lang="en"><head><title>Transition native consumer</title></head><body><h1>Transition lifecycle</h1></body></html>'
    );
    await page.addStyleTag({
      content:
        'body{font:18px system-ui;padding:24px}section{display:block;border:2px solid #64748b;padding:24px;background:#eef2ff}',
    });
    await page.addScriptTag({ content: built.bundle });
    await exercise({
      page,
      mount: async (id, props = {}, variant = 'ordinary') => {
        await page.evaluate(
          async ({ id, props, variant, scenario }) => {
            await window.transitionNative.fixture.mount(
              id,
              scenario.target,
              scenario.execution,
              variant,
              props
            );
          },
          { id, props, variant, scenario }
        );
      },
      read: async (id, stage) => {
        const result = await page.evaluate((id) => window.transitionNative.fixture.read(id), id);
        snapshots.push({ id, stage, ...result });
        return result;
      },
      operate: async (id, method) => {
        await page.evaluate(
          ({ id, method }) => window.transitionNative.fixture.operate(id, method),
          { id, method }
        );
      },
      phase: async (id, phase) => {
        await page.waitForFunction(
          ({ id, phase }) => window.transitionNative.fixture.read(id).phase === phase,
          { id, phase }
        );
      },
    });
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(built.evidenceDir, `${key}.png`) });
  } catch (error) {
    failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw error;
  } finally {
    try {
      await writeFile(
        path.join(built.evidenceDir, `${key}.json`),
        JSON.stringify(
          {
            head: built.head,
            bundleSha256: built.bundleSha256,
            scenario,
            name,
            reducedMotion,
            outcome: failure ? 'FAIL' : 'PASS',
            failure,
            errors,
            snapshots,
          },
          null,
          2
        ) + '\n'
      );
    } finally {
      await page.close();
    }
  }
}

// Expected values come from C-AS-TRANSITION-0001 C–K and the cold-preparation
// extension. Runtime and every generated target satisfy those expectations
// independently; neither implementation is used as the other's oracle.
it.each(cases)(
  '$target $execution cold start retains an owner without a view',
  async (scenario) => {
    await run(scenario, 'cold', async ({ mount, read }) => {
      await mount('cold');
      expect(await read('cold', 'created without view')).toMatchObject({
        phase: 'closed',
        present: false,
        rendered: false,
        connected: true,
        disposed: false,
        events: [],
      });
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution cold preparation reveals without animation events',
  async (scenario) => {
    await run(scenario, 'preparation', async ({ page, mount, read }) => {
      await mount('prepared', { defaultOpen: true }, 'prepared');
      expect(await read('prepared', 'retained preparation view')).toMatchObject({
        phase: 'preparing',
        present: true,
        rendered: true,
        events: [],
        nativeChildren: 1,
      });
      expect(
        await page.evaluate(() => window.transitionNative.fixture.capturePreparation('prepared'))
      ).toBe('function');
      await page.evaluate(() => window.transitionNative.fixture.releasePreparation('prepared'));
      expect(await read('prepared', 'released')).toMatchObject({
        phase: 'entered',
        present: true,
        rendered: true,
        events: [],
      });
      await page.evaluate(() => window.transitionNative.fixture.releasePreparation('prepared'));
      expect(await read('prepared', 'duplicate release')).toMatchObject({
        phase: 'entered',
        events: [],
      });
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution afterLeave reentry preserves the new phase and physical view',
  async (scenario) => {
    await run(scenario, 'reentrant-leave', async ({ page, mount, read, operate }) => {
      await mount('reopen', { enterDuration: 5000, leaveDuration: 5000 });
      await operate('reopen', 'enter');
      expect(await read('reopen', 'entry')).toMatchObject({
        phase: 'entering',
        rendered: true,
        present: true,
      });
      await operate('reopen', 'complete');
      await page.evaluate(() => {
        window.transitionNative.fixture.rememberView('reopen');
        window.transitionNative.fixture.reenterAfterLeave('reopen', true);
      });
      await operate('reopen', 'leave');
      expect(await read('reopen', 'leaving retains view')).toMatchObject({
        phase: 'leaving',
        sameView: true,
        rendered: true,
      });
      await operate('reopen', 'complete');
      const reopened = await read('reopen', 'synchronous afterLeave enter');
      expect(reopened).toMatchObject({
        phase: 'entering',
        present: true,
        rendered: true,
        sameView: true,
        nativeChildren: 1,
      });
      expect(reopened.events.map((event) => event.name)).toEqual([
        'beforeEnter',
        'afterEnter',
        'beforeLeave',
        'afterLeave',
        'beforeEnter',
      ]);
      await operate('reopen', 'complete');
      expect(await read('reopen', 'new entry complete')).toMatchObject({
        phase: 'entered',
        present: true,
        rendered: true,
      });
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution superseded entry delay cannot finish the later leave',
  async (scenario) => {
    await run(scenario, 'superseded-delay', async ({ mount, read, operate, phase }) => {
      await mount('reverse', { enterDuration: 300, leaveDuration: 900 });
      await operate('reverse', 'enter');
      await operate('reverse', 'leave');
      expect(await read('reverse', 'reversed before entry deadline')).toMatchObject({
        phase: 'leaving',
        rendered: true,
      });
      await phase('reverse', 'closed');
      const closed = await read('reverse', 'own leave deadline');
      expect(closed).toMatchObject({ present: false, rendered: false });
      expect(closed.events.map((event) => event.name)).toEqual([
        'beforeEnter',
        'beforeLeave',
        'afterLeave',
      ]);
      const start = closed.events.find((event) => event.name === 'beforeLeave')!.at;
      const end = closed.events.find((event) => event.name === 'afterLeave')!.at;
      // Real monotonic timestamps discriminate the cancelled 300ms callback from
      // the leave's own 900ms completion. 5ms is clock precision, not a grace wait.
      expect(end - start).toBeGreaterThanOrEqual(895);
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution duplicate complete emits one completion',
  async (scenario) => {
    await run(scenario, 'duplicate-complete', async ({ page, mount, read, operate }) => {
      await mount('duplicate', { enterDuration: 120 });
      await operate('duplicate', 'enter');
      await operate('duplicate', 'complete');
      await operate('duplicate', 'complete');
      // Cross the original timer's deadline to observe absence of a late duplicate.
      await page.waitForTimeout(180);
      const completed = await read('duplicate', 'after original deadline');
      expect(completed).toMatchObject({ phase: 'entered', present: true, rendered: true });
      expect(completed.events.map((event) => event.name)).toEqual(['beforeEnter', 'afterEnter']);
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution terminal disposal invalidates completion and stale control',
  async (scenario) => {
    await run(scenario, 'dispose', async ({ page, mount, read, operate }) => {
      await mount('old', { enterDuration: 200 });
      await operate('old', 'enter');
      expect(await read('old', 'before dispose')).toMatchObject({
        phase: 'entering',
        rendered: true,
      });
      await page.evaluate(() => window.transitionNative.fixture.dispose('old'));
      await page.waitForTimeout(250);
      const retired = await page.evaluate(() =>
        window.transitionNative.fixture.retiredEnter('old')
      );
      expect(retired.connected).toBe(false);
      const disposed = await read('old', 'past retired deadline');
      expect(disposed.disposed).toBe(true);
      expect(disposed.events.map((event) => event.name)).toEqual(['beforeEnter']);
      expect(await page.locator('[data-transition-owner="old"]').count()).toBe(0);
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution retired owner cannot complete its replacement',
  async (scenario) => {
    await run(scenario, 'replacement', async ({ page, mount, read, operate, phase }) => {
      await mount('retired', { enterDuration: 200 });
      await operate('retired', 'enter');
      await page.evaluate(() => window.transitionNative.fixture.dispose('retired'));
      await mount('replacement', { enterDuration: 500 });
      await operate('replacement', 'enter');
      expect(await read('replacement', 'fresh owner')).toMatchObject({
        phase: 'entering',
        rendered: true,
      });
      await phase('replacement', 'entered');
      const replacement = await read('replacement', 'replacement deadline');
      expect(replacement.events.map((event) => event.name)).toEqual(['beforeEnter', 'afterEnter']);
      expect(replacement.events[1].at - replacement.events[0].at).toBeGreaterThanOrEqual(495);
      expect((await read('retired', 'no late event')).events.map((event) => event.name)).toEqual([
        'beforeEnter',
      ]);
    });
  },
  30_000
);

it.each(cases)(
  '$target $execution reduced motion preserves phase events without the normal wait',
  async (scenario) => {
    await run(
      scenario,
      'reduced-motion',
      async ({ mount, read, operate, phase }) => {
        await mount('reduced', { enterDuration: 60000, leaveDuration: 60000 });
        await operate('reduced', 'enter');
        await phase('reduced', 'entered');
        expect(await read('reduced', 'reduced entry')).toMatchObject({
          present: true,
          rendered: true,
        });
        await operate('reduced', 'leave');
        await phase('reduced', 'closed');
        const closed = await read('reduced', 'reduced leave');
        expect(closed).toMatchObject({ present: false, rendered: false });
        expect(closed.events.map((event) => event.name)).toEqual([
          'beforeEnter',
          'afterEnter',
          'beforeLeave',
          'afterLeave',
        ]);
      },
      'reduce'
    );
  },
  30_000
);
