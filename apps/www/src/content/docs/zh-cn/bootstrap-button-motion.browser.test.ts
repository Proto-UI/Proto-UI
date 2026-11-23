// @vitest-environment node
// Only the exact-head Actions lane opts in; ordinary test collection opens no sockets.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import {
  assertBootstrapButtonEntryMotion,
  assertBootstrapButtonImmediateExit,
  isBackgroundPosition,
  type BootstrapMotionTrace,
} from './bootstrap-button-motion-evidence';

const enabled = process.env.PROTO_UI_BOOTSTRAP_BUTTON_MOTION_EVIDENCE === '1';
const directory = process.env.PROTO_UI_BOOTSTRAP_BUTTON_MOTION_EVIDENCE_DIR;
const expectedSha = process.env.PROTO_UI_EXPECTED_HEAD_SHA;
const ROUTE = '/en/test/new-projection-families/';
const THEMES = ['light', 'dark'] as const;
const VARIANTS = ['default', 'primary', 'warning', 'danger', 'success', 'info', 'inverse'] as const;
const INTERRUPTIONS = ['disabled', 'navbar', 'reduced', 'dispose'] as const;
type Interruption = (typeof INTERRUPTIONS)[number];
const expectedCases = RUNTIMES.flatMap((runtime) =>
  THEMES.flatMap((theme) =>
    [...VARIANTS.map((variant) => `entry-${variant}`), 'focus', ...INTERRUPTIONS].map(
      (phase) => `${runtime}-${theme}-${phase}`
    )
  )
);
const terminals = new Map<string, { status: string; error?: string }>();
const seenCells = new Set<string>();
const protocolErrors: string[] = [];
const cleanupErrors: Array<{ phase: string; error: string }> = [];
const results: Array<{ name: string; status: string }> = [];
const observations: unknown[] = [];
const pageErrors: string[] = [];
const screenshots: string[] = [];
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;
let baseUrl = '';
let sourceSha = '';
let startupError: string | undefined;

async function manifest(status: string) {
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'manifest.json'),
    JSON.stringify(
      {
        status,
        sourceSha,
        expectedSha,
        startupError,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        node: process.version,
        browser: browser?.version(),
        viewport: { width: 1440, height: 1000 },
        themes: THEMES,
        runtimes: RUNTIMES,
        upstream: {
          revision: 'b4c4072679943773a7582daa63f545ba818fa627',
          path: 'less/buttons.less',
          blob: '4cd4d862b3813ad9b758e3e631bb5a03480b98a6',
          contract: 'background-position .1s linear on hover/focus entry only; immediate exit',
        },
        cases: expectedCases.map((name) => ({
          name,
          ...(terminals.get(name) ?? {
            status: ['starting', 'running'].includes(status) ? 'pending' : 'blocked',
            error: 'This expected cell did not reach a terminal result.',
          }),
        })),
        results,
        observations,
        pageErrors,
        protocolErrors,
        cleanupErrors,
        screenshots,
        scope:
          'Actual native pointer/keyboard entry, browser CSS transition events and rAF paint on the public four-Web Button fixture. Disabled/navbar/dispose interrupt via the public fixture prop/lifecycle API on the first measured moving frame; preference changes use Chromium media emulation after native transitionrun. No synthetic input events, CSS injection, clock freezing, physical-device, Compiler, non-Web or full-family claim.',
      },
      null,
      2
    )
  );
}
async function capture(name: string, button?: Locator) {
  if (!directory || !page) return;
  const filename = `${name}.png`;
  // Capture only settled endpoints; screenshots never replace trajectory observations.
  if (button) await button.screenshot({ path: path.join(directory, filename) });
  else await page.screenshot({ path: path.join(directory, filename) });
  screenshots.push(filename);
}
async function cell(name: string, run: () => Promise<void>) {
  if (!expectedCases.includes(name) || seenCells.has(name)) {
    const error = `Unexpected or duplicate evidence cell: ${name}`;
    protocolErrors.push(error);
    throw new Error(error);
  }
  seenCells.add(name);
  try {
    await run();
    terminals.set(name, { status: 'passed' });
  } catch (error) {
    terminals.set(name, { status: 'failed', error: String(error) });
    try {
      const partial = await page?.evaluate(() =>
        (
          window as unknown as { bootstrapMotionProbe?: { stop(): BootstrapMotionTrace } }
        ).bootstrapMotionProbe?.stop()
      );
      if (partial) observations.push({ name, phase: 'failed-partial', trace: partial });
      await capture(`${name}-failure`);
    } catch {
      /* The original terminal failure remains authoritative. */
    }
  } finally {
    await manifest('running');
  }
}
async function attemptCleanup(phase: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    cleanupErrors.push({ phase, error: String(error) });
  }
}
async function setProps(runtime: string, props: Record<string, unknown>) {
  await page!.evaluate(
    ({ runtime, props }) => {
      (
        window as unknown as {
          projectionFamilyFixture: { setProps(key: string, ref: string, props: unknown): void };
        }
      ).projectionFamilyFixture.setProps(`bootstrap-2-3-2-${runtime}`, 'default', props);
    },
    { runtime, props }
  );
}
async function settle(button: Locator, y: number) {
  await expect
    .poll(() =>
      button.evaluate((element) => {
        const position = parseFloat(getComputedStyle(element).backgroundPositionY) || 0;
        return element.getAnimations().length === 0 ? position : null;
      })
    )
    .toBe(y);
  await button.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function reset(button: Locator, runtime: string, variant = 'default') {
  await page!.emulateMedia({ reducedMotion: 'no-preference' });
  await page!.mouse.move(0, 0);
  await button.evaluate((element) => (element as HTMLElement).blur());
  await setProps(runtime, { variant, colorContext: 'default', disabled: false, size: 'default' });
  await settle(button, 0);
  expect(await button.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe(
    'none'
  );
}

/** Read-only instrumentation; the optional interrupt calls only the fixture's public owner API. */
async function startProbe(button: Locator, runtime: string, interrupt?: Interruption) {
  await button.evaluate(
    (element, options) => {
      type Trace = BootstrapMotionTrace;
      const target = element as HTMLElement & { __bootstrapProbe?: { stop(): Trace } };
      target.__bootstrapProbe?.stop();
      const fixture = window as unknown as {
        projectionFamilyFixture: {
          setProps(key: string, ref: string, props: Record<string, unknown>): void;
          dispose(): Promise<void>;
        };
        bootstrapReduceMotion(): Promise<void>;
        bootstrapMotionProbe?: { stop(): Trace };
      };
      const trace: Trace = { frames: [], events: [], native: [] };
      let raf = 0;
      let stopped = false;
      const snapshot = () => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          time: performance.now(),
          y: parseFloat(style.backgroundPositionY) || 0,
          property: style.transitionProperty,
          duration: style.transitionDuration,
          easing: style.transitionTimingFunction,
          width: rect.width,
          height: rect.height,
          animations: element.getAnimations().map((animation) => {
            const duration = animation.effect?.getComputedTiming().duration;
            return {
              property: animation instanceof CSSTransition ? animation.transitionProperty : 'other',
              // CSSNumericValue is not a JSON duration. Retain its text so an
              // unexpected timeline still fails the exact numeric 100ms oracle.
              duration: typeof duration === 'number' ? duration : String(duration ?? 'missing'),
              playState: animation.playState,
            };
          }),
        };
      };
      const applyInterruption = (frame: ReturnType<typeof snapshot>) => {
        if (!options.interrupt || trace.interruption) return;
        trace.interruption = {
          kind: options.interrupt,
          time: frame.time,
          y: frame.y,
          active: frame.animations.length > 0,
        };
        if (options.interrupt === 'reduced') void fixture.bootstrapReduceMotion();
        else if (options.interrupt === 'dispose') void fixture.projectionFamilyFixture.dispose();
        else
          fixture.projectionFamilyFixture.setProps(
            `bootstrap-2-3-2-${options.runtime}`,
            'default',
            options.interrupt === 'disabled' ? { disabled: true } : { colorContext: 'navbar' }
          );
      };
      const tick = () => {
        if (stopped) return;
        const frame = snapshot();
        trace.frames.push(frame);
        if (
          options.interrupt !== 'reduced' &&
          frame.animations.length &&
          frame.y < -0.05 &&
          frame.y > -14.95
        )
          applyInterruption(frame);
        raf = requestAnimationFrame(tick);
      };
      const transition = (event: Event) => {
        const transition = event as TransitionEvent;
        trace.events.push({
          type: event.type,
          property: transition.propertyName,
          elapsedTime: transition.elapsedTime,
          trusted: event.isTrusted,
        });
        if (options.interrupt === 'reduced' && event.type === 'transitionrun')
          applyInterruption(snapshot());
      };
      const native = (event: Event) =>
        trace.native.push({ type: event.type, trusted: event.isTrusted });
      const transitions = ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel'];
      const inputs = ['pointerenter', 'pointerleave', 'focus', 'blur'];
      transitions.forEach((name) => target.addEventListener(name, transition));
      inputs.forEach((name) => target.addEventListener(name, native));
      target.__bootstrapProbe = {
        stop() {
          if (stopped) return trace;
          stopped = true;
          cancelAnimationFrame(raf);
          transitions.forEach((name) => target.removeEventListener(name, transition));
          inputs.forEach((name) => target.removeEventListener(name, native));
          trace.frames.push(snapshot());
          delete target.__bootstrapProbe;
          delete fixture.bootstrapMotionProbe;
          return trace;
        },
      };
      fixture.bootstrapMotionProbe = target.__bootstrapProbe;
      tick();
    },
    { runtime, interrupt }
  );
}
async function stopProbe(button: Locator): Promise<BootstrapMotionTrace> {
  return button.evaluate((element) =>
    (
      element as HTMLElement & { __bootstrapProbe: { stop(): BootstrapMotionTrace } }
    ).__bootstrapProbe.stop()
  );
}
async function entryAndExit(button: Locator, runtime: string, name: string, keyboard = false) {
  await startProbe(button, runtime);
  if (keyboard) {
    for (let index = 0; index < 32; index += 1) {
      await page!.keyboard.press('Tab');
      if (await button.evaluate((element) => document.activeElement === element)) break;
    }
    expect(await button.evaluate((element) => document.activeElement === element)).toBe(true);
  } else await button.hover();
  await settle(button, -15);
  const entry = await stopProbe(button);
  observations.push({ name, phase: 'entry', trace: entry });
  assertBootstrapButtonEntryMotion(entry, keyboard ? 'focus' : 'pointerenter');
  await capture(`${name}-entered`, button);
  await startProbe(button, runtime);
  if (keyboard) await page!.keyboard.press('Tab');
  else await page!.mouse.move(0, 0);
  await settle(button, 0);
  const exit = await stopProbe(button);
  observations.push({ name, phase: 'exit', trace: exit });
  assertBootstrapButtonImmediateExit(exit);
}

describe.skipIf(!enabled).sequential('Bootstrap Button real entry motion evidence', () => {
  beforeAll(async () => {
    try {
      sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      await manifest('starting');
      if (
        process.env.GITHUB_ACTIONS !== 'true' ||
        !expectedSha?.match(/^[a-f0-9]{40}$/) ||
        sourceSha !== expectedSha
      )
        throw new Error('Button motion requires GitHub Actions and the exact source checkout.');
      if (!directory || process.env.PROTO_UI_BROWSER_BASE_URL)
        throw new Error(
          'Button motion requires a fresh local source server and evidence directory.'
        );
      if (new Set(expectedCases).size !== expectedCases.length)
        throw new Error('Expected motion cells must be unique.');
      execFileSync('git', ['diff', '--exit-code', 'HEAD'], { stdio: 'pipe' });
      if (
        execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
          encoding: 'utf8',
        }).trim()
      )
        throw new Error('Motion evidence rejects untracked or modified source inputs.');
      baseUrl = await startServer(ROUTE);
      browser = await launchBrowser();
    } catch (error) {
      startupError = String(error);
      await manifest('startup-failed');
      throw error;
    }
  }, 150_000);
  afterEach(async ({ task }) => {
    const result = { name: task.name, status: task.result?.state ?? 'unknown' };
    results.push(result);
    const previousCleanupErrors = cleanupErrors.length;
    await attemptCleanup(`${task.name}: probe`, async () => {
      if (page && !page.isClosed())
        await page.evaluate(() =>
          (
            window as unknown as { bootstrapMotionProbe?: { stop(): unknown } }
          ).bootstrapMotionProbe?.stop()
        );
    });
    await attemptCleanup(`${task.name}: fixture`, async () => {
      if (page && !page.isClosed())
        await page.evaluate(async () => {
          const fixture = (
            window as unknown as { projectionFamilyFixture?: { dispose(): Promise<void> } }
          ).projectionFamilyFixture;
          await fixture?.dispose();
        });
    });
    await attemptCleanup(`${task.name}: context`, async () => context?.close());
    if (cleanupErrors.length !== previousCleanupErrors) result.status = 'fail';
    context = undefined;
    page = undefined;
    await manifest('running');
  });
  afterAll(async () => {
    // Every cleanup is attempted before deciding the terminal receipt. A red
    // cleanup result must never leave an artifact claiming the lane passed.
    await attemptCleanup('final context', async () => context?.close());
    await attemptCleanup('browser', async () => browser?.close());
    await attemptCleanup('source server', stopServer);
    const complete = expectedCases.every((name) => terminals.get(name)?.status === 'passed');
    await manifest(
      !startupError &&
        complete &&
        results.length === 8 &&
        results.every((result) => result.status === 'pass') &&
        pageErrors.length === 0 &&
        protocolErrors.length === 0 &&
        cleanupErrors.length === 0
        ? 'passed'
        : 'failed'
    );
    expect(cleanupErrors).toEqual([]);
    expect(protocolErrors).toEqual([]);
    expect(complete, 'Every expected runtime/theme/motion cell must terminate successfully.').toBe(
      true
    );
    expect(results).toHaveLength(8);
    expect(results.every((result) => result.status === 'pass')).toBe(true);
    expect(pageErrors).toEqual([]);
  }, 60_000);

  for (const runtime of RUNTIMES)
    for (const theme of THEMES)
      it(`${runtime} ${theme} observes real 100ms entry, immediate exit and bounded cancellation`, async () => {
        context = await browser!.newContext({
          viewport: { width: 1440, height: 1000 },
          colorScheme: theme,
          reducedMotion: 'no-preference',
        });
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          const allowed =
            url.origin === baseUrl ||
            url.origin === 'https://esm.sh' ||
            ['data:', 'blob:'].includes(url.protocol);
          return ['GET', 'HEAD'].includes(route.request().method()) && allowed
            ? route.continue()
            : route.abort();
        });
        page = await context.newPage();
        page.setDefaultTimeout(10_000);
        page.on('pageerror', (error) => pageErrors.push(error.message));
        const current = page;
        await current.exposeFunction('bootstrapReduceMotion', () =>
          current.emulateMedia({ reducedMotion: 'reduce' })
        );
        await current.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
        await current.waitForFunction(
          () => document.documentElement.dataset.familyFixtureReady === 'true',
          undefined,
          { timeout: 60_000 }
        );
        expect(await current.locator('html').getAttribute('data-family-fixture-error')).toBeNull();
        const button = current
          .locator(`[data-runtime-host="bootstrap-2-3-2-${runtime}"]`)
          .getByRole('button', { name: 'Back', exact: true });
        const identity = await button.elementHandle();
        for (const variant of VARIANTS)
          await cell(`${runtime}-${theme}-entry-${variant}`, async () => {
            await reset(button, runtime, variant);
            await entryAndExit(button, runtime, `${runtime}-${theme}-entry-${variant}`);
            expect(
              await button.evaluate((element, original) => element === original, identity)
            ).toBe(true);
          });
        await cell(`${runtime}-${theme}-focus`, async () => {
          await reset(button, runtime);
          await entryAndExit(button, runtime, `${runtime}-${theme}-focus`, true);
        });
        for (const interrupt of INTERRUPTIONS)
          await cell(`${runtime}-${theme}-${interrupt}`, async () => {
            await reset(button, runtime);
            await startProbe(button, runtime, interrupt);
            await button.hover();
            if (interrupt === 'dispose') {
              await expect
                .poll(() => identity!.evaluate((element) => element.isConnected))
                .toBe(false);
              const trace = await identity!.evaluate((element) =>
                (
                  element as HTMLElement & { __bootstrapProbe: { stop(): BootstrapMotionTrace } }
                ).__bootstrapProbe.stop()
              );
              observations.push({ name: `${runtime}-${theme}-${interrupt}`, trace });
              expect(trace.interruption?.active).toBe(true);
              expect(await identity!.evaluate((element) => element.getAnimations().length)).toBe(0);
              expect(await current.locator('[data-runtime-host] [role="button"]').count()).toBe(0);
              await setProps(runtime, { disabled: false });
              expect(await current.locator('[data-runtime-host] [role="button"]').count()).toBe(0);
              return;
            }
            await expect
              .poll(() =>
                button.evaluate((element) => getComputedStyle(element).transitionProperty)
              )
              .toBe('none');
            await settle(button, interrupt === 'reduced' ? -15 : 0);
            const trace = await stopProbe(button);
            observations.push({ name: `${runtime}-${theme}-${interrupt}`, trace });
            expect(trace.interruption?.active).toBe(true);
            expect(
              trace.events.some(
                (event) =>
                  event.type === 'transitioncancel' &&
                  event.trusted &&
                  isBackgroundPosition(event.property) &&
                  event.elapsedTime < 0.1
              )
            ).toBe(true);
            expect(
              trace.events.some(
                (event) => event.type === 'transitionend' && isBackgroundPosition(event.property)
              )
            ).toBe(false);
            if (interrupt === 'reduced') {
              expect(
                await current.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
              ).toBe(true);
              await current.mouse.move(0, 0);
              await settle(button, 0);
              await startProbe(button, runtime);
              await button.hover();
              await settle(button, -15);
              const reduced = await stopProbe(button);
              observations.push({
                name: `${runtime}-${theme}-${interrupt}`,
                phase: 'preference-retained',
                trace: reduced,
              });
              expect(
                reduced.frames.every(
                  (frame) => frame.animations.length === 0 && frame.property === 'none'
                )
              ).toBe(true);
              expect(
                reduced.events.filter((event) => isBackgroundPosition(event.property))
              ).toEqual([]);
            } else if (interrupt === 'disabled') {
              expect(await button.getAttribute('aria-disabled')).toBe('true');
              expect(
                await button.evaluate((element) => getComputedStyle(element).backgroundImage)
              ).toBe('none');
            } else
              expect(
                await button.evaluate((element) => getComputedStyle(element).backgroundImage)
              ).toBe('none');
            await capture(`${runtime}-${theme}-${interrupt}-settled`, button);
            await reset(button, runtime);
            await entryAndExit(button, runtime, `${runtime}-${theme}-${interrupt}-recovered`);
            expect(
              await button.evaluate((element, original) => element === original, identity)
            ).toBe(true);
          });
        await identity?.dispose();
        expect(
          expectedCases.filter(
            (name) =>
              name.startsWith(`${runtime}-${theme}-`) && terminals.get(name)?.status !== 'passed'
          )
        ).toEqual([]);
      }, 120_000);
});
