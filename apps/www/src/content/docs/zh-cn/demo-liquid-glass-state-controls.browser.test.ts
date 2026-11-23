// @vitest-environment node
// Browser execution is deliberately opt-in, GitHub Actions-only and exact-head bound.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, CDPSession, Locator, Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { assertNativeValueChangeSequence, type NativeEditorInput } from './native-editor-evidence';
import {
  assertNativeCompositionSequence,
  installCompositionDispatchObservation,
  observeNativeComposition,
  readNativeComposition,
  type NativeCompositionEvent,
} from './native-composition-evidence';
import { hasNoVisibleBoxShadow } from './finf-box-shadow-observation';
import { THEME } from '../../../../../../packages/prototypes/liquid-glass/src/theme';
import {
  LIQUID_STATE_CONTROL_CASES,
  assessLiquidStateControls,
  type LiquidControlCaseResult,
} from './liquid-state-controls-evidence';

const ROUTE = '/en/test/liquid-glass-state-controls/';
const VIEWPORT = { width: 1440, height: 1100 };
const enabled =
  process.env.PROTO_UI_LIQUID_CONTROLS_BROWSER_EVIDENCE === '1' &&
  process.env.PUI_LIQUID_GLASS_INCLUDE_WIP === '1';
const evidence = process.env.PROTO_UI_LIQUID_CONTROLS_EVIDENCE_DIR;
const expectedSha = process.env.PROTO_UI_EXPECTED_HEAD_SHA;
const observations: unknown[] = [];
const results: LiquidControlCaseResult[] = [];
const screenshots: string[] = [];
const pageErrors: string[] = [];
const allPageErrors: string[] = [];
const consoleMessages: Array<{ case: string; type: string; text: string }> = [];
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page;
let baseUrl = '';
let sourceSha = '';
let startupError: string | undefined;

type Fixture = {
  setProps(runtime: string, ref: string, props: Record<string, unknown>): void;
  state(runtime: string, ref: string, key: string): unknown;
  events(runtime: string, ref: string, event: string): Array<{ detail: unknown }>;
  dispose(): Promise<void>;
};
type FixtureWindow = Window & { liquidStateControlsFixture: Fixture };

const paletteColor = (theme: 'light' | 'dark', token: keyof typeof THEME.light) => {
  const value = THEME[theme][token];
  if (!/^#[a-f0-9]{6}$/i.test(value)) throw new Error(`Not an sRGB fixture color: ${token}`);
  return `rgb(${[1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(', ')})`;
};

async function manifest(status: string, terminal?: ReturnType<typeof assessLiquidStateControls>) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await writeFile(
    path.join(evidence, 'manifest.json'),
    JSON.stringify(
      {
        sourceSha,
        expectedSha,
        status,
        startupError,
        route: ROUTE,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        node: process.version,
        browser: browser?.version(),
        viewport: VIEWPORT,
        runtimes: RUNTIMES,
        runtimeModuleOrigin: 'https://esm.sh',
        themes: ['light', 'dark'],
        expectedCases: LIQUID_STATE_CONTROL_CASES,
        parts: [
          'checkboxRoot',
          'checkboxIndicator',
          'switchRoot',
          'switchThumb',
          'liquidGlassToggle',
          'inputRoot',
          'textareaRoot',
          'separatorRoot',
        ],
        provider: 'absent; source-owned ordinary fallback, not optical material acceptance',
        screenshots,
        results: terminal?.results ?? results,
        terminal,
        observations,
        pageErrors: allPageErrors,
        consoleMessages,
        scope:
          'Eight actual Liquid Glass Base-inheriting parts in WC/React/Vue 3/Vue 2 only. Provider-free ordinary fallback. Native browser input and CDP composition only; no physical OS IME, optical, Apple, non-Web, Compiler or form-submission conformance claim.',
      },
      null,
      2
    )
  );
}
function observePage(target: Page) {
  target.setDefaultTimeout(10_000);
  target.on('pageerror', (error) => {
    pageErrors.push(error.message);
    allPageErrors.push(error.message);
  });
  target.on('console', (message) => {
    consoleMessages.push({
      case: expect.getState().currentTestName ?? 'startup',
      type: message.type(),
      text: message.text().slice(0, 8000),
    });
  });
}
async function capture(name: string, target?: Locator) {
  if (!evidence) return;
  const filename = `${name}.png`;
  const options = { path: path.join(evidence, filename), animations: 'disabled' as const };
  if (target) await target.screenshot(options);
  else await page.screenshot({ ...options, fullPage: true });
  screenshots.push(filename);
}
async function open(theme: 'light' | 'dark') {
  if (!page || page.isClosed()) {
    page = await context!.newPage();
    observePage(page);
  }
  pageErrors.length = 0;
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.documentElement.dataset.liquidControlsFixtureReady,
    undefined,
    { timeout: 60_000 }
  );
  const error = await page.locator('html').getAttribute('data-liquid-controls-fixture-error');
  if (error) throw new Error(error);
  expect(await page.locator('html').getAttribute('data-liquid-controls-fixture-ready')).toBe(
    'true'
  );
  await page.mouse.move(0, 0);
}
function host(runtime: string) {
  return page.locator(`[data-runtime-host="${runtime}"]`);
}
function part(runtime: string, ref: string) {
  return host(runtime).locator(`[data-demo-ref="${ref}"]`);
}
async function setProps(runtime: string, ref: string, props: Record<string, unknown>) {
  await page.evaluate(
    ({ runtime, ref, props }) =>
      (window as unknown as FixtureWindow).liquidStateControlsFixture.setProps(runtime, ref, props),
    { runtime, ref, props }
  );
}
async function state(runtime: string, ref: string, key: string) {
  return page.evaluate(
    ({ runtime, ref, key }) =>
      (window as unknown as FixtureWindow).liquidStateControlsFixture.state(runtime, ref, key),
    { runtime, ref, key }
  );
}
async function requests(runtime: string, ref: string, event: string) {
  return page.evaluate(
    ({ runtime, ref, event }) =>
      (window as unknown as FixtureWindow).liquidStateControlsFixture.events(runtime, ref, event),
    { runtime, ref, event }
  );
}
async function paint(control: Locator) {
  return control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      image: style.backgroundImage,
      color: style.color,
      radius: style.borderRadius,
      border: style.borderTopWidth,
      padding: style.padding,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      weight: style.fontWeight,
      opacity: style.opacity,
      cursor: style.cursor,
      pointerEvents: style.pointerEvents,
      shadow: style.boxShadow,
      display: style.display,
      width: style.width,
      height: style.height,
      ring: style.getPropertyValue('--pui-ring-width').trim(),
    };
  });
}

// Observe the disabled surface itself, never the earlier enabled shadow delta.
// The shared bounded computed-shadow grammar rejects unsupported serializations.
async function captureDisabledTogglePaint(
  runtime: string,
  theme: 'light' | 'dark',
  ref: string,
  phase: string
) {
  const control = part(runtime, ref);
  let disabledPaint: Awaited<ReturnType<typeof paint>>;
  try {
    await expect
      .poll(async () => {
        const current = await paint(control);
        return {
          image: current.image,
          unpaintedShadow: hasNoVisibleBoxShadow(current.shadow),
        };
      })
      .toEqual({ image: 'none', unpaintedShadow: true });
  } finally {
    // Preserve the raw computed values and this still-disabled frame on failure too.
    disabledPaint = await paint(control);
    observations.push({ runtime, theme, ref, phase, disabledPaint });
    await capture(
      `${runtime}-${theme}-${ref}-${phase}`,
      page.locator(`[data-runtime-card="${runtime}"]`)
    );
  }
  // The persisted observation must satisfy the same oracle as the successful poll.
  expect(disabledPaint.image).toBe('none');
  expect(hasNoVisibleBoxShadow(disabledPaint.shadow)).toBe(true);
  expect(disabledPaint.opacity).toBe('1');
  expect(disabledPaint.pointerEvents).toBe('none');
  expect(disabledPaint.background).toBe(
    paletteColor(
      theme,
      (await control.getAttribute('aria-pressed')) === 'true' ? 'primary' : 'secondary'
    )
  );
}

// Capture at the physical editor before its runtime restores a controlled owner value.
// Read-only listener: neither synthetic events nor direct value writes are evidence.
async function observeNativeInputs(editor: Locator) {
  await editor.evaluate((element) => {
    const trace: NativeEditorInput[] = [];
    (
      element as HTMLElement & { __liquidNativeInputTrace: NativeEditorInput[] }
    ).__liquidNativeInputTrace = trace;
    element.addEventListener(
      'input',
      (event) => {
        const input = event as InputEvent;
        trace.push({
          type: input.type,
          inputType: input.inputType,
          data: input.data,
          composing: input.isComposing,
          isTrusted: input.isTrusted,
          value: (element as HTMLInputElement | HTMLTextAreaElement).value,
        });
      },
      { capture: true }
    );
  });
  return () =>
    editor.evaluate(
      (element) =>
        (element as HTMLElement & { __liquidNativeInputTrace: NativeEditorInput[] })
          .__liquidNativeInputTrace
    );
}

const compositionEvents = (editor: Locator) => editor.evaluate(readNativeComposition);

async function nativeCompositionControl(
  client: CDPSession,
  runtime: string,
  ref: string,
  kind: 'input' | 'textarea',
  initial: string
) {
  // An independent, plain native editor has no Proto, Adapter, owner callback
  // or framework listener. Only fixture initialization writes its initial value.
  await page.evaluate(
    ({ kind, initial }) => {
      const editor = document.createElement(kind);
      editor.setAttribute('data-native-composition-control', '');
      editor.setAttribute('aria-label', 'Independent native composition control');
      editor.value = initial;
      document.body.append(editor);
    },
    { kind, initial }
  );
  const control = page.locator('[data-native-composition-control]');
  const inputs = await observeNativeInputs(control);
  await control.evaluate(observeNativeComposition);
  const record: {
    runtime: string;
    ref: string;
    stage: string;
    kind: 'input' | 'textarea';
    initial: string;
    inputs: NativeEditorInput[];
    composition: NativeCompositionEvent[];
    syntheticEnd?: NativeCompositionEvent;
    syntheticEndRejected?: boolean;
    cleanupErrors?: string[];
  } = {
    runtime,
    ref,
    stage: 'independent-native-composition-control',
    kind,
    initial,
    inputs: [],
    composition: [],
  };
  observations.push(record);
  try {
    await control.click();
    await control.press('Control+A');
    for (const text of ['ni', '你好']) {
      await client.send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
      await expect.poll(() => control.inputValue()).toBe(text);
    }
    await client.send('Input.insertText', { text: '你好' });
    await expect.poll(() => control.inputValue()).toBe('你好');
    record.inputs = await inputs();
    record.composition = await compositionEvents(control);
    expect(record.inputs.map(({ value }) => value)).toEqual(['ni', '你好', '你好']);
    expect(record.inputs.every((event) => event.type === 'input' && event.isTrusted)).toBe(true);
    const expected = { kind, initial, candidates: ['ni', '你好'], committed: '你好' };
    assertNativeCompositionSequence(record.composition, record.composition, expected);

    // Real JS dispatch is a negative control, separate from the retained native
    // sequence. Even when a native engine reports end.isTrusted=false, replacing
    // that end with this actual synthetic event must still be rejected.
    await control.evaluate((element, end) => {
      element.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: end.bubbles,
          composed: end.composed,
          cancelable: end.cancelable,
          data: end.data ?? '',
        })
      );
    }, record.composition.at(-1)!);
    const afterSynthetic = await compositionEvents(control);
    expect(afterSynthetic).toHaveLength(record.composition.length + 1);
    expect(afterSynthetic.slice(0, -1)).toEqual(record.composition);
    record.syntheticEnd = afterSynthetic.at(-1)!;
    expect(record.syntheticEnd.isTrusted).toBe(false);
    expect(record.syntheticEnd.scriptDispatched).toBe(true);
    expect(() =>
      assertNativeCompositionSequence(
        [...record.composition.slice(0, -1), record.syntheticEnd!],
        record.composition,
        expected
      )
    ).toThrow('script dispatch is not native evidence');
    record.syntheticEndRejected = true;
    return { inputs: record.inputs, composition: record.composition };
  } finally {
    const errors: unknown[] = [];
    for (const cleanup of [
      async () => {
        if (!record.inputs.length) record.inputs = await inputs();
      },
      async () => {
        if (!record.composition.length) record.composition = await compositionEvents(control);
      },
      () => control.evaluate((element) => element.remove()),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      record.cleanupErrors = errors.map(String);
      throw new AggregateError(errors, 'Native composition control cleanup failed');
    }
  }
}

// Do not start even a local socket when this file is collected outside the authorized job.
// The workflow's explicit opt-in is not a publication/deployment permission.
describe
  .skipIf(!enabled)
  .sequential('Liquid Glass state-controls exact-head browser evidence', () => {
    beforeAll(async () => {
      try {
        sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        await manifest('starting');
        if (
          process.env.GITHUB_ACTIONS !== 'true' ||
          !expectedSha?.match(/^[a-f0-9]{40}$/) ||
          sourceSha !== expectedSha
        )
          throw new Error(
            'Browser evidence requires GitHub Actions and an exact checked-out PR head SHA.'
          );
        if (!evidence || process.env.PROTO_UI_BROWSER_BASE_URL)
          throw new Error(
            'Use a fresh SHA-bound local fixture with an explicit evidence directory, never an external/stale browser base URL.'
          );
        execFileSync('git', ['diff', '--exit-code', 'HEAD'], { stdio: 'pipe' });
        baseUrl = await startServer(ROUTE);
        browser = await launchBrowser();
        context = await browser.newContext({ viewport: VIEWPORT });
        await context.addInitScript(installCompositionDispatchObservation);
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          // Existing demo loaders fetch the public React/Vue ESM runtimes from esm.sh.
          // Permit only read requests to those loaders and the exact local fixture.
          const readOnly = ['GET', 'HEAD'].includes(route.request().method());
          const allowed =
            url.origin === baseUrl ||
            url.origin === 'https://esm.sh' ||
            ['data:', 'blob:'].includes(url.protocol);
          return readOnly && allowed ? route.continue() : route.abort();
        });
        page = await context.newPage();
        observePage(page);
      } catch (error) {
        startupError = String(error);
        await manifest('startup-failed');
        throw error;
      }
    }, 150_000);

    afterEach(async ({ task }) => {
      const caseErrors: Array<{ message: string; stack?: string }> =
        task.result?.errors?.map((error) => ({ message: error.message, stack: error.stack })) ?? [];
      const result: LiquidControlCaseResult = {
        name: task.name,
        status: task.result?.state ?? 'unknown',
        errors: caseErrors,
      };
      results.push(result);
      if (task.result?.state === 'fail' && page && !page.isClosed()) {
        try {
          await capture(`failure-${results.length}`);
        } catch (error) {
          observations.push({ failureCaptureError: String(error) });
        }
      }
      // Each case gets its own document. Dispose real hosts before closing it;
      // native diagnostic listeners cannot survive into a later case.
      const cleanupErrors: unknown[] = [];
      if (page && !page.isClosed()) {
        for (const [stage, cleanup] of [
          [
            'fixture.dispose',
            () =>
              page.evaluate(() =>
                (window as unknown as Partial<FixtureWindow>).liquidStateControlsFixture?.dispose()
              ),
          ],
          ['page.close', () => page.close()],
        ] as const) {
          try {
            await cleanup();
          } catch (error) {
            cleanupErrors.push(error);
            result.status = 'fail';
            const message = `${stage}: ${String(error)}`;
            caseErrors.push({ message });
            observations.push({ case: task.name, caseCleanupError: message });
          }
        }
      }
      await manifest('running');
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Case cleanup failed');
    });
    afterAll(async () => {
      const cleanupErrors: string[] = [];
      for (const cleanup of [() => context?.close(), () => browser?.close(), () => stopServer()]) {
        try {
          await cleanup();
        } catch (error) {
          cleanupErrors.push(String(error));
        }
      }
      const terminal = assessLiquidStateControls(results, [
        ...(startupError ? [startupError] : []),
        ...allPageErrors,
        ...cleanupErrors,
      ]);
      await manifest(terminal.status, terminal);
      if (terminal.status !== 'passed')
        throw new Error(
          `Incomplete Liquid state-control evidence: ${JSON.stringify({
            status: terminal.status,
            missing: terminal.missing,
            duplicates: terminal.duplicates,
            unexpected: terminal.unexpected,
            failures: terminal.failures,
          })}`
        );
    }, 60_000);

    for (const theme of ['light', 'dark'] as const) {
      it(`renders source-owned paint for all eight parts in ${theme}`, async () => {
        await open(theme);
        const paints = [];
        for (const runtime of RUNTIMES) {
          expect(await host(runtime).getAttribute('data-mounted')).toBe('true');
          const cardForeground = await page
            .locator(`[data-runtime-card="${runtime}"]`)
            .evaluate((element) => getComputedStyle(element).color);
          observations.push({ runtime, theme, cardForeground });
          // Consumer labels use the foreground paired with the actual family page.
          expect(cardForeground).toBe(paletteColor(theme, 'foreground'));
          const checkbox = await paint(part(runtime, 'checkbox'));
          const indicator = await paint(part(runtime, 'indicator'));
          const switchRoot = await paint(part(runtime, 'switch'));
          const thumb = await paint(part(runtime, 'thumb'));
          const toggle = await paint(part(runtime, 'toggle'));
          const input = await paint(
            host(runtime).getByRole('textbox', { name: 'Draft title', exact: true })
          );
          const textarea = await paint(
            host(runtime).getByRole('textbox', { name: 'Draft notes', exact: true })
          );
          const separator = await paint(part(runtime, 'separator'));
          const facts = {
            checkbox,
            indicator,
            switchRoot,
            thumb,
            toggle,
            input,
            textarea,
            separator,
          };
          observations.push({ runtime, theme, paints: facts });
          // All paint comes from the imported Liquid source and generated token
          // renderer. Provider-free controls retain their complete ordinary paint.
          // packages/prototypes/liquid-glass/src/{checkbox,switch,toggle,input,textarea,separator}.
          for (const value of [checkbox, switchRoot, thumb, toggle, input, textarea]) {
            expect(value.border).toBe('1px');
            expect(value.opacity).toBe('1');
            expect(value.image).toBe('none');
          }
          expect(checkbox.radius).toBe('6px');
          expect(checkbox.width).toBe('20px');
          expect(checkbox.height).toBe('20px');
          expect(checkbox.background).toBe(paletteColor(theme, 'background'));
          expect(checkbox.color).toBe(paletteColor(theme, 'foreground'));
          expect(indicator.width).toBe('16px');
          expect(indicator.height).toBe('16px');
          expect(switchRoot.width).toBe('48px');
          expect(switchRoot.height).toBe('28px');
          expect(switchRoot.background).toBe(paletteColor(theme, 'muted'));
          expect(thumb.width).toBe('24px');
          expect(thumb.height).toBe('24px');
          expect(thumb.background).toBe(paletteColor(theme, 'primary-foreground'));
          for (const value of [switchRoot, thumb, toggle]) {
            expect(value.radius).toBe('9999px');
          }
          expect(toggle.padding).toBe('8px');
          expect(toggle.background).toBe(paletteColor(theme, 'secondary'));
          expect(toggle.color).toBe(paletteColor(theme, 'secondary-foreground'));
          expect(toggle.fontSize).toBe('14px');
          expect(toggle.lineHeight).toBe('20px');
          expect(toggle.weight).toBe('500');
          for (const value of [input, textarea]) {
            expect(value.radius).toBe('16px');
            expect(value.fontSize).toBe('16px');
            expect(value.lineHeight).toBe('24px');
            expect(value.background).toBe(paletteColor(theme, 'background'));
            expect(value.color).toBe(paletteColor(theme, 'foreground'));
          }
          expect(input.padding).toBe('8px 16px');
          expect(input.height).toBe('44px');
          expect(textarea.padding).toBe('12px 16px');
          expect(Number.parseFloat(textarea.height)).toBeGreaterThanOrEqual(96);
          expect(separator.height).toBe('1px');
          expect(separator.background).toBe(paletteColor(theme, 'border'));
          expect(separator.border).toBe('0px');
          expect(
            await part(runtime, 'indicatorControlled').locator('svg path').getAttribute('d')
          ).toBe('M5 12h14');
          expect(
            await host(runtime).locator('input,textarea,[contenteditable="true"]').count()
          ).toBe(4);
          paints.push(facts);
        }
        for (const facts of paints.slice(1)) expect(facts).toEqual(paints[0]);
        expect(pageErrors).toEqual([]);
        await capture(`liquid-controls-${theme}`);
      }, 90_000);

      for (const runtime of RUNTIMES) {
        it(`${runtime}/${theme}: real activation, context, controlled requests and disabled recovery`, async () => {
          await open(theme);
          const checkbox = part(runtime, 'checkbox');
          const indicator = part(runtime, 'indicator');
          const beforeCheckbox = await paint(checkbox);
          expect(await checkbox.getAttribute('aria-checked')).toBe('false');
          expect(await indicator.locator('svg').count()).toBe(0);
          await checkbox.click();
          await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('true');
          await expect
            .poll(() => indicator.locator('svg path').getAttribute('d'))
            .toBe('m20 6-11 11-5-5');
          expect(await state(runtime, 'indicator', 'checked')).toBe(true);
          expect((await paint(checkbox)).background).not.toBe(beforeCheckbox.background);
          expect(
            (await requests(runtime, 'checkbox', 'checkedChange')).map((request) => request.detail)
          ).toEqual([{ checked: true, indeterminate: false }]);
          await checkbox.press('Enter'); // P-BASE-CHECKBOX-KEYBOARD-ENTER-NOT-ACTIVATION.
          expect((await requests(runtime, 'checkbox', 'checkedChange')).length).toBe(1);
          await checkbox.press('Space');
          await expect.poll(() => checkbox.getAttribute('aria-checked')).toBe('false');
          await expect.poll(() => indicator.locator('svg').count()).toBe(0);
          expect((await requests(runtime, 'checkbox', 'checkedChange')).length).toBe(2);
          expect((await paint(checkbox)).background).toBe(beforeCheckbox.background);

          const controlled = part(runtime, 'checkboxControlled');
          const noFocus = await paint(controlled);
          expect(noFocus.ring).not.toBe('2px');
          await checkbox.press('Tab');
          await expect.poll(() => state(runtime, 'checkboxControlled', 'focusVisible')).toBe(true);
          const focus = await paint(controlled);
          expect(focus.ring).toBe('2px');
          expect(focus.shadow).not.toBe(noFocus.shadow);
          await capture(
            `${runtime}-${theme}-keyboard-focus`,
            page.locator(`[data-runtime-card="${runtime}"]`)
          );
          await controlled.press('Space');
          expect(await controlled.getAttribute('aria-checked')).toBe('mixed');
          expect(
            (await requests(runtime, 'checkboxControlled', 'checkedChange')).map(
              (request) => request.detail
            )
          ).toEqual([{ checked: true, indeterminate: false }]);
          expect(
            (await requests(runtime, 'checkboxControlled', 'indeterminateChange')).map(
              (request) => request.detail
            )
          ).toEqual([{ indeterminate: false }]);
          await setProps(runtime, 'checkboxControlled', { checked: true, indeterminate: false });
          await expect.poll(() => controlled.getAttribute('aria-checked')).toBe('true');
          await expect
            .poll(() => part(runtime, 'indicatorControlled').locator('svg path').getAttribute('d'))
            .toBe('m20 6-11 11-5-5');

          const switchRoot = part(runtime, 'switch');
          const thumb = part(runtime, 'thumb');
          const initialThumb = await thumb.boundingBox();
          const beforeSwitch = await paint(switchRoot);
          await switchRoot.click();
          await expect.poll(() => switchRoot.getAttribute('aria-checked')).toBe('true');
          await expect.poll(() => state(runtime, 'thumb', 'checked')).toBe(true);
          expect((await thumb.boundingBox())!.x).toBeGreaterThan(initialThumb!.x + 10);
          expect((await paint(switchRoot)).background).not.toBe(beforeSwitch.background);
          await switchRoot.press('Space');
          await expect.poll(() => switchRoot.getAttribute('aria-checked')).toBe('false');
          await expect.poll(() => state(runtime, 'thumb', 'checked')).toBe(false);
          expect((await thumb.boundingBox())!.x).toBeCloseTo(initialThumb!.x, 1);
          expect((await requests(runtime, 'switch', 'checkedChange')).length).toBe(2);
          const controlledSwitch = part(runtime, 'switchControlled');
          await controlledSwitch.click();
          expect(await controlledSwitch.getAttribute('aria-checked')).toBe('false');
          expect(
            (await requests(runtime, 'switchControlled', 'checkedChange')).map(
              (request) => request.detail
            )
          ).toEqual([{ checked: true }]);
          await setProps(runtime, 'switchControlled', { checked: true });
          await expect.poll(() => state(runtime, 'thumbControlled', 'checked')).toBe(true);

          const toggle = part(runtime, 'toggle');
          const raised = await paint(toggle);
          const inactiveBox = await toggle.boundingBox();
          expect(await toggle.locator('svg').getAttribute('opacity')).toBe('0');
          await toggle.click();
          await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('true');
          const activated = await paint(toggle);
          observations.push({
            runtime,
            theme,
            ref: 'toggle',
            stage: 'activation-paint-before-assertion',
            raised,
            activated,
            styleTokens: await toggle.getAttribute('data-pui-style'),
          });
          expect(activated.background).toBe(paletteColor(theme, 'primary'));
          expect(activated.color).toBe(paletteColor(theme, 'primary-foreground'));
          await expect.poll(() => toggle.locator('svg').getAttribute('opacity')).toBe('1');
          expect((await toggle.boundingBox())!.width).toBeCloseTo(inactiveBox!.width, 1);
          expect((await toggle.boundingBox())!.height).toBeCloseTo(inactiveBox!.height, 1);
          expect(activated.image).toBe('none');
          await toggle.press('Enter');
          await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('false');
          expect((await requests(runtime, 'toggle', 'activeChange')).length).toBe(2);
          await part(runtime, 'toggleControlled').click();
          expect(await part(runtime, 'toggleControlled').getAttribute('aria-pressed')).toBe(
            'false'
          );
          expect(
            (await requests(runtime, 'toggleControlled', 'activeChange')).map(
              (request) => request.detail
            )
          ).toEqual([{ active: true }]);
          await setProps(runtime, 'toggleControlled', { active: true });
          await expect
            .poll(() => part(runtime, 'toggleControlled').getAttribute('aria-pressed'))
            .toBe('true');

          // Parts consume their root context but are neither duplicate controls nor tab stops.
          for (const ref of ['indicator', 'indicatorControlled', 'thumb', 'thumbControlled']) {
            expect(await part(runtime, ref).getAttribute('role')).toBeNull();
            expect(await part(runtime, ref).getAttribute('aria-checked')).toBeNull();
            expect(
              await part(runtime, ref).evaluate((element) => (element as HTMLElement).tabIndex)
            ).toBe(-1);
          }
          for (const [ref, event, attribute] of [
            ['checkbox', 'checkedChange', 'aria-checked'],
            ['switch', 'checkedChange', 'aria-checked'],
            ['toggle', 'activeChange', 'aria-pressed'],
          ] as const) {
            const control = part(runtime, ref);
            const before = (await requests(runtime, ref, event)).length;
            let disabledCycle = 0;
            for (const disabled of [true, false, true, false]) {
              await setProps(runtime, ref, { disabled });
              await expect.poll(() => control.getAttribute('aria-disabled')).toBe(String(disabled));
              await expect.poll(async () => (await paint(control)).opacity).toBe('1'); // Liquid never fades the complete fallback pair.
              if (disabled) {
                if (ref === 'toggle')
                  await captureDisabledTogglePaint(
                    runtime,
                    theme,
                    ref,
                    `disabled-inactive-${++disabledCycle}`
                  );
                await control.click({ force: true });
                await control.press('Space');
                expect((await requests(runtime, ref, event)).length).toBe(before);
                expect(await control.getAttribute(attribute)).toBe('false');
              }
            }
            await control.click();
            await expect.poll(() => control.getAttribute(attribute)).toBe('true');
            expect((await requests(runtime, ref, event)).length).toBe(before + 1);
          }
          // Disabled withdraws elevation, retaining the selected opaque pair.
          // Keep controlled ownership and request suppression while capturing it.
          const controlledToggle = part(runtime, 'toggleControlled');
          const controlledRequests = (await requests(runtime, 'toggleControlled', 'activeChange'))
            .length;
          await setProps(runtime, 'toggleControlled', { disabled: true });
          await expect.poll(() => controlledToggle.getAttribute('aria-disabled')).toBe('true');
          await expect.poll(async () => (await paint(controlledToggle)).opacity).toBe('1');
          await captureDisabledTogglePaint(runtime, theme, 'toggleControlled', 'disabled-active');
          await controlledToggle.click({ force: true });
          await controlledToggle.press('Space');
          expect(await controlledToggle.getAttribute('aria-pressed')).toBe('true');
          expect((await requests(runtime, 'toggleControlled', 'activeChange')).length).toBe(
            controlledRequests
          );
          await setProps(runtime, 'toggleControlled', { disabled: false });
          await expect.poll(() => controlledToggle.getAttribute('aria-disabled')).toBe('false');
          await expect.poll(async () => (await paint(controlledToggle)).opacity).toBe('1');
          await expect
            .poll(async () => hasNoVisibleBoxShadow((await paint(controlledToggle)).shadow))
            .toBe(false);
          expect((await paint(controlledToggle)).background).toBe(paletteColor(theme, 'primary'));
          expect(await controlledToggle.locator('svg').getAttribute('opacity')).toBe('1');

          expect(pageErrors).toEqual([]);
          observations.push({
            runtime,
            theme,
            beforeCheckbox,
            beforeSwitch,
            raised,
            focus,
            activationAndContext: 'passed',
          });
          await capture(
            `${runtime}-${theme}-state-recovery`,
            page.locator(`[data-runtime-card="${runtime}"]`)
          );
        }, 90_000);
      }
    }

    for (const runtime of RUNTIMES) {
      it(`${runtime}: native singleton editors, controlled values, readonly and disabled recovery`, async () => {
        await open('light');
        for (const [ref, name, controlledName, initial] of [
          ['input', 'Draft title', 'Controlled title', 'Approved'],
          ['textarea', 'Draft notes', 'Controlled notes', 'Approved notes'],
        ] as const) {
          const editor = host(runtime).getByRole('textbox', { name, exact: true });
          expect(await editor.evaluate((element) => element.localName)).toBe(ref);
          const marker = `${runtime}-${ref}-owner`;
          await editor.evaluate(
            (element, marker) => element.setAttribute('data-editor-identity', marker),
            marker
          );
          const nativeInputs = await observeNativeInputs(editor);
          // Keep the strict single-edit count oracle for BOTH physical editor kinds.
          await editor.fill('Changed');
          await expect.poll(() => state(runtime, ref, 'value')).toBe('Changed');
          expect(await editor.inputValue()).toBe('Changed');
          observations.push({
            runtime,
            ref,
            stage: 'initial-editor-fill-before-count-assertion',
            nativeInputs: await editor.evaluate(
              (element) =>
                (element as HTMLElement & { __liquidNativeInputTrace?: unknown[] })
                  .__liquidNativeInputTrace
            ),
            valueChangeRequests: await requests(runtime, ref, 'valueChange'),
          });
          expect((await requests(runtime, ref, 'valueChange')).length).toBe(1);
          assertNativeValueChangeSequence(
            await nativeInputs(),
            await requests(runtime, ref, 'valueChange')
          );
          if (ref === 'textarea') {
            // A single Playwright fill is not necessarily one native input. Chromium
            // 154 emits three trusted inputs for this multiline text (run 37184204831).
            // C-TEXT-CONTROL-0001-C requires ALL of them, in native order, not coalescing.
            const before = (await nativeInputs()).length;
            await editor.fill('Changed\nSecond line');
            await expect.poll(() => state(runtime, ref, 'value')).toBe('Changed\nSecond line');
            expect(await editor.inputValue()).toBe('Changed\nSecond line');
            const native = await nativeInputs();
            const emitted = await requests(runtime, ref, 'valueChange');
            observations.push({
              runtime,
              ref,
              stage: 'multiline-native-sequence',
              nativeInputs: native,
              valueChangeRequests: emitted,
            });
            expect(native.length).toBeGreaterThan(before);
            assertNativeValueChangeSequence(native, emitted);
            expect(await editor.getAttribute('data-editor-identity')).toBe(marker);
          }

          const initialCount = (await nativeInputs()).length;
          const value = await editor.inputValue();
          for (const disabled of [true, false, true, false]) {
            await setProps(runtime, ref, { disabled });
            await expect.poll(() => editor.isDisabled()).toBe(disabled);
            if (disabled) {
              await editor.press('X');
              expect(await editor.inputValue()).toBe(value);
              expect((await requests(runtime, ref, 'valueChange')).length).toBe(initialCount);
            }
            expect(await editor.getAttribute('data-editor-identity')).toBe(marker);
          }
          await setProps(runtime, ref, { readOnly: true });
          await expect.poll(() => editor.getAttribute('readonly')).not.toBeNull();
          await editor.press('End');
          await editor.press('X');
          expect(await editor.inputValue()).toBe(value);
          expect((await requests(runtime, ref, 'valueChange')).length).toBe(initialCount);
          await setProps(runtime, ref, { readOnly: false });
          await expect.poll(() => editor.getAttribute('readonly')).toBeNull();
          await editor.fill('Restored');
          await expect.poll(() => state(runtime, ref, 'value')).toBe('Restored');
          expect((await requests(runtime, ref, 'valueChange')).length).toBe(initialCount + 1);
          expect(await editor.getAttribute('data-editor-identity')).toBe(marker);

          assertNativeValueChangeSequence(
            await nativeInputs(),
            await requests(runtime, ref, 'valueChange')
          );

          const controlled = host(runtime).getByRole('textbox', {
            name: controlledName,
            exact: true,
          });
          const controlledRef = `${ref}Controlled`;
          const controlledNativeInputs = await observeNativeInputs(controlled);
          const recoveredNativeInputs = await nativeInputs();
          const recoveredRequests = await requests(runtime, ref, 'valueChange');
          for (const blocked of ['disabled', 'readOnly'] as const) {
            await setProps(runtime, controlledRef, { [blocked]: true });
            await expect
              .poll(() =>
                controlled.evaluate(
                  (element, property) =>
                    (element as HTMLInputElement | HTMLTextAreaElement)[property],
                  blocked
                )
              )
              .toBe(true);
            // A disabled target cannot take keyboard focus. Clear the previous
            // editor through a real non-editable click before trying to type;
            // otherwise Locator.press can send X to that still-focused sibling.
            await page.locator('h1').click();
            expect(await editor.evaluate((element) => element.matches(':focus'))).toBe(false);
            await controlled.press('End');
            await controlled.press('X');
            expect(await controlled.inputValue()).toBe(initial);
            expect(await controlledNativeInputs()).toEqual([]);
            expect(await requests(runtime, controlledRef, 'valueChange')).toEqual([]);
            expect(await editor.inputValue()).toBe('Restored');
            expect(await nativeInputs()).toEqual(recoveredNativeInputs);
            expect(await requests(runtime, ref, 'valueChange')).toEqual(recoveredRequests);
            await setProps(runtime, controlledRef, { [blocked]: false });
            await expect
              .poll(() =>
                controlled.evaluate(
                  (element, property) =>
                    (element as HTMLInputElement | HTMLTextAreaElement)[property],
                  blocked
                )
              )
              .toBe(false);
          }
          await controlled.fill('Requested');
          await expect.poll(() => controlled.inputValue()).toBe(initial);
          expect(await state(runtime, controlledRef, 'value')).toBe(initial);
          const emitted = await requests(runtime, controlledRef, 'valueChange');
          expect(emitted).toHaveLength(1);
          expect(emitted[0].detail).toEqual({
            value: 'Requested',
            composing: false,
            data: 'Requested',
            inputType: 'insertText',
          });
          assertNativeValueChangeSequence(await controlledNativeInputs(), emitted);
          await setProps(runtime, controlledRef, { value: 'Accepted' });
          await expect.poll(() => controlled.inputValue()).toBe('Accepted');
          expect(await state(runtime, controlledRef, 'value')).toBe('Accepted');
          expect(await requests(runtime, controlledRef, 'valueChange')).toEqual(emitted);
          const native = await controlledNativeInputs();
          assertNativeValueChangeSequence(native, emitted);
          observations.push({
            runtime,
            ref: controlledRef,
            stage: 'controlled-owner-acceptance',
            nativeInputs: native,
            valueChangeRequests: emitted,
          });
        }
        expect(await host(runtime).locator('input,textarea,[contenteditable="true"]').count()).toBe(
          4
        );
        expect(pageErrors).toEqual([]);
        observations.push({ runtime, editors: 'singleton, controlled and recovery checks passed' });
        await capture(
          `${runtime}-editors-recovery`,
          page.locator(`[data-runtime-card="${runtime}"]`)
        );
      }, 90_000);
    }

    // Separate cases give both owner modes and both physical editors a terminal
    // result even if an earlier composition fails. Chromium's CDP IME path is
    // observed at the real editor; this is not physical operating-system input.
    for (const runtime of RUNTIMES)
      for (const kind of ['input', 'textarea'] as const)
        for (const controlled of [false, true])
          it(`${runtime}/${kind}/${controlled ? 'controlled' : 'uncontrolled'}: native CDP composition preserves editor and owner`, async () => {
            await open('light');
            const ref = `${kind}${controlled ? 'Controlled' : ''}`;
            const name =
              kind === 'input'
                ? controlled
                  ? 'Controlled title'
                  : 'Draft title'
                : controlled
                  ? 'Controlled notes'
                  : 'Draft notes';
            const editor = host(runtime).getByRole('textbox', { name, exact: true });
            const initial = await editor.inputValue();
            const identity = `${runtime}-${ref}-composition-owner`;
            await editor.evaluate(
              (element, identity) => element.setAttribute('data-editor-identity', identity),
              identity
            );
            const nativeInputs = await observeNativeInputs(editor);
            await editor.evaluate(observeNativeComposition);
            const composition = () => compositionEvents(editor);
            const client = await page.context().newCDPSession(page);
            try {
              const nativeControl = await nativeCompositionControl(
                client,
                runtime,
                ref,
                kind,
                initial
              );
              await editor.click();
              await editor.press('Control+A');
              for (const text of ['ni', '你好']) {
                await client.send('Input.imeSetComposition', {
                  text,
                  selectionStart: text.length,
                  selectionEnd: text.length,
                });
                await expect.poll(() => editor.inputValue()).toBe(text);
                await expect.poll(() => state(runtime, ref, 'composing')).toBe(true);
                await expect
                  .poll(() => state(runtime, ref, 'value'))
                  .toBe(controlled ? initial : text);
                expect(await requests(runtime, ref, 'compositionEnd')).toEqual([]);
                assertNativeValueChangeSequence(
                  await nativeInputs(),
                  await requests(runtime, ref, 'valueChange')
                );
                expect(await editor.getAttribute('data-editor-identity')).toBe(identity);
              }
              await client.send('Input.insertText', { text: '你好' });
              await expect.poll(() => state(runtime, ref, 'composing')).toBe(false);
              await expect.poll(() => editor.inputValue()).toBe(controlled ? initial : '你好');
              await expect
                .poll(() => state(runtime, ref, 'value'))
                .toBe(controlled ? initial : '你好');
              const native = await nativeInputs();
              const emitted = await requests(runtime, ref, 'valueChange');
              assertNativeValueChangeSequence(native, emitted);
              expect(native.some((event) => event.composing)).toBe(true);
              const nativeComposition = await composition();
              // Match the independently executed native editor on this exact
              // browser. Keep end's actual flag; do not relabel it trusted.
              assertNativeCompositionSequence(nativeComposition, nativeControl.composition, {
                kind,
                initial,
                candidates: ['ni', '你好'],
                committed: '你好',
              });
              expect(native).toEqual(nativeControl.inputs);
              expect(nativeComposition[0]?.type).toBe('compositionstart');
              expect(nativeComposition.at(-1)?.type).toBe('compositionend');
              for (const [nativeType, exposed] of [
                ['compositionstart', 'compositionStart'],
                ['compositionupdate', 'compositionUpdate'],
                ['compositionend', 'compositionEnd'],
              ]) {
                const expected = nativeComposition.filter((event) => event.type === nativeType);
                expect(expected.length).toBeGreaterThan(0);
                expect(
                  (await requests(runtime, ref, exposed)).map((event) => event.detail)
                ).toEqual(expected.map(({ value, data }) => ({ value, data })));
              }
              if (controlled) {
                await setProps(runtime, ref, { value: 'Accepted composition' });
                await expect.poll(() => editor.inputValue()).toBe('Accepted composition');
                expect(await requests(runtime, ref, 'valueChange')).toEqual(emitted);
                expect(await nativeInputs()).toEqual(native);
              }
              expect(await editor.getAttribute('data-editor-identity')).toBe(identity);
              expect(
                await host(runtime).locator('input,textarea,[contenteditable="true"]').count()
              ).toBe(4);
              expect(pageErrors).toEqual([]);
              await capture(
                `${runtime}-${ref}-composition`,
                page.locator(`[data-runtime-card="${runtime}"]`)
              );
            } finally {
              observations.push({
                runtime,
                ref,
                controlled,
                provenance:
                  'Chromium Input.imeSetComposition + Input.insertText; not physical OS IME',
                nativeInputs: await nativeInputs(),
                nativeComposition: await composition(),
                valueChange: await requests(runtime, ref, 'valueChange'),
                compositionEnd: await requests(runtime, ref, 'compositionEnd'),
              });
              await client.detach();
            }
          }, 90_000);

    it('updates semantic/decorative separators, remains readable on mobile, and disposes every real host', async () => {
      await open('dark');
      for (const runtime of RUNTIMES) {
        const separator = part(runtime, 'separator');
        const decorative = part(runtime, 'separatorDecorative');
        expect(await separator.getAttribute('role')).toBe('separator');
        expect(await separator.getAttribute('aria-orientation')).toBe('horizontal');
        expect(await decorative.getAttribute('role')).toBeNull();
        expect(await decorative.getAttribute('aria-hidden')).toBe('true');
        expect(await decorative.getAttribute('aria-orientation')).toBeNull();
        for (const orientation of ['vertical', 'horizontal', 'vertical', 'horizontal']) {
          await setProps(runtime, 'separator', { orientation });
          await expect.poll(() => separator.getAttribute('aria-orientation')).toBe(orientation);
          observations.push({
            runtime,
            ref: 'separator',
            stage: 'orientation-before-size-assertion',
            orientation,
            paint: await paint(separator),
          });
          await expect
            .poll(
              async () => (await paint(separator))[orientation === 'vertical' ? 'width' : 'height']
            )
            .toBe('1px');
        }
        await setProps(runtime, 'separator', { decorative: true });
        await expect.poll(() => separator.getAttribute('role')).toBeNull();
        expect(await separator.getAttribute('aria-hidden')).toBe('true');
        await setProps(runtime, 'separator', { decorative: false });
        await expect.poll(() => separator.getAttribute('role')).toBe('separator');
        expect(await separator.evaluate((element) => (element as HTMLElement).tabIndex)).toBe(-1);
      }
      await capture('liquid-controls-separators-dark');
      await page.setViewportSize({ width: 390, height: 844 });
      await open('light');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await capture('liquid-controls-mobile');
      const before = await page.locator('[data-runtime-host] [data-pui-root]').count();
      expect(before).toBeGreaterThanOrEqual(64);
      await page.evaluate(() =>
        (window as unknown as FixtureWindow).liquidStateControlsFixture.dispose()
      );
      await expect.poll(() => page.locator('[data-runtime-host] [data-pui-root]').count()).toBe(0);
      await expect
        .poll(() => page.locator('[data-runtime-host] input,[data-runtime-host] textarea').count())
        .toBe(0);
      expect(await page.locator('[data-runtime-host]').getByRole('checkbox').count()).toBe(0);
      expect(await page.locator('[data-runtime-host]').getByRole('switch').count()).toBe(0);
      expect(pageErrors).toEqual([]);
      observations.push({ beforeDispose: before, afterDispose: 0, mobileWidth: 390 });
    }, 90_000);
  });
