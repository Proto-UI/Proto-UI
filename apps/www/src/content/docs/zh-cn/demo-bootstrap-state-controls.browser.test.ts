// @vitest-environment node
// Browser execution is deliberately opt-in, GitHub Actions-only and exact-head bound.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { assertNativeValueChangeSequence, type NativeEditorInput } from './native-editor-evidence';

const ROUTE = '/en/test/bootstrap-state-controls/';
const VIEWPORT = { width: 1440, height: 1100 };
const enabled = process.env.PROTO_UI_BOOTSTRAP_BROWSER_EVIDENCE === '1';
const evidence = process.env.PROTO_UI_BOOTSTRAP_EVIDENCE_DIR;
const expectedSha = process.env.PROTO_UI_EXPECTED_HEAD_SHA;
const observations: unknown[] = [];
const results: Array<{ name: string; status: string; errors: unknown }> = [];
const screenshots: string[] = [];
const pageErrors: string[] = [];
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
type FixtureWindow = Window & { bootstrapStateControlsFixture: Fixture };

async function manifest(status: string) {
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
        screenshots,
        results,
        observations,
        pageErrors,
        scope:
          'Eight draft Bootstrap Base-inheriting parts in WC/React/Vue 3/Vue 2 only. No native, Compiler, upstream plugin, form-submission or IME conformance claim.',
      },
      null,
      2
    )
  );
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
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => pageErrors.push(error.message));
  }
  pageErrors.length = 0;
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.documentElement.dataset.bootstrapFixtureReady,
    undefined,
    { timeout: 60_000 }
  );
  const error = await page.locator('html').getAttribute('data-bootstrap-fixture-error');
  if (error) throw new Error(error);
  expect(await page.locator('html').getAttribute('data-bootstrap-fixture-ready')).toBe('true');
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
      (window as unknown as FixtureWindow).bootstrapStateControlsFixture.setProps(
        runtime,
        ref,
        props
      ),
    { runtime, ref, props }
  );
}
async function state(runtime: string, ref: string, key: string) {
  return page.evaluate(
    ({ runtime, ref, key }) =>
      (window as unknown as FixtureWindow).bootstrapStateControlsFixture.state(runtime, ref, key),
    { runtime, ref, key }
  );
}
async function requests(runtime: string, ref: string, event: string) {
  return page.evaluate(
    ({ runtime, ref, event }) =>
      (window as unknown as FixtureWindow).bootstrapStateControlsFixture.events(
        runtime,
        ref,
        event
      ),
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
      shadow: style.boxShadow,
      display: style.display,
      width: style.width,
      height: style.height,
      ring: style.getPropertyValue('--pui-ring-width').trim(),
    };
  });
}

// Capture at the physical editor before its runtime restores a controlled owner value.
// Read-only listener: neither synthetic events nor direct value writes are evidence.
async function observeNativeInputs(editor: Locator) {
  await editor.evaluate((element) => {
    const trace: NativeEditorInput[] = [];
    (
      element as HTMLElement & { __bootstrapNativeInputTrace: NativeEditorInput[] }
    ).__bootstrapNativeInputTrace = trace;
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
        (element as HTMLElement & { __bootstrapNativeInputTrace: NativeEditorInput[] })
          .__bootstrapNativeInputTrace
    );
}

// Do not start even a local socket when this file is collected outside the authorized job.
// The workflow's explicit opt-in is not a publication/deployment permission.
describe.skipIf(!enabled).sequential('Bootstrap state-controls exact-head browser evidence', () => {
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
      page.setDefaultTimeout(10_000);
      page.on('pageerror', (error) => pageErrors.push(error.message));
    } catch (error) {
      startupError = String(error);
      await manifest('startup-failed');
      throw error;
    }
  }, 150_000);

  afterEach(async ({ task }) => {
    results.push({
      name: task.name,
      status: task.result?.state ?? 'unknown',
      errors:
        task.result?.errors?.map((error) => ({ message: error.message, stack: error.stack })) ?? [],
    });
    if (task.result?.state === 'fail' && page && !page.isClosed()) {
      try {
        await capture(`failure-${results.length}`);
      } catch (error) {
        observations.push({ failureCaptureError: String(error) });
      }
    }
    // Each case gets its own document. Dispose real hosts before closing it;
    // native diagnostic listeners cannot survive into a later case.
    if (page && !page.isClosed()) {
      try {
        await page.evaluate(() =>
          (window as unknown as Partial<FixtureWindow>).bootstrapStateControlsFixture?.dispose()
        );
      } catch (error) {
        results[results.length - 1].status = 'fail';
        observations.push({ caseCleanupError: String(error) });
        throw error;
      } finally {
        await page.close();
        await manifest('running');
      }
    } else {
      await manifest('running');
    }
  });
  afterAll(async () => {
    try {
      await manifest(
        startupError || results.some((result) => result.status !== 'pass') ? 'failed' : 'passed'
      );
    } finally {
      try {
        await context?.close();
      } finally {
        try {
          await browser?.close();
        } finally {
          await stopServer();
        }
      }
    }
  }, 60_000);

  for (const theme of ['light', 'dark'] as const) {
    it(`renders source-owned paint for all eight parts in ${theme}`, async () => {
      await open(theme);
      const paints = [];
      for (const runtime of RUNTIMES) {
        expect(await host(runtime).getAttribute('data-mounted')).toBe('true');
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
        // Values are family source feedback, not another family's visual oracle:
        // packages/prototypes/bootstrap-2-3-2/src/{checkbox,switch,toggle,input,textarea,separator}.
        for (const value of [checkbox, switchRoot, thumb, toggle, input, textarea]) {
          expect(value.radius).toBe('4px');
          expect(value.border).toBe('1px');
          expect(value.opacity).toBe('1');
        }
        expect(checkbox.width).toBe('20px');
        expect(checkbox.height).toBe('20px');
        expect(indicator.width).toBe('14px');
        expect(indicator.height).toBe('14px');
        expect(switchRoot.width).toBe('44px');
        expect(switchRoot.height).toBe('24px');
        expect(thumb.width).toBe('20px');
        expect(thumb.height).toBe('20px');
        expect(toggle.image).toContain('linear-gradient');
        expect(toggle.padding).toBe('4px 12px');
        for (const value of [toggle, input, textarea]) {
          expect(value.fontSize).toBe('14px');
          expect(value.lineHeight).toBe('20px');
          expect(value.weight).toBe('400');
        }
        for (const value of [input, textarea]) {
          expect(value.padding).toBe('4px 6px');
          expect(value.background).toBe('rgb(255, 255, 255)');
          expect(value.color).toBe('rgb(51, 51, 51)');
          expect(value.shadow).not.toBe('none');
        }
        expect(Number.parseFloat(textarea.height)).toBeGreaterThanOrEqual(64);
        expect(separator.height).toBe('1px');
        expect(separator.background).toBe('rgb(204, 204, 204)');
        expect(
          await part(runtime, 'indicatorControlled').locator('svg path').getAttribute('d')
        ).toBe('M5 12H19');
        expect(await host(runtime).locator('input,textarea,[contenteditable="true"]').count()).toBe(
          4
        );
        paints.push(facts);
        observations.push({ runtime, theme, paints: facts });
      }
      for (const facts of paints.slice(1)) expect(facts).toEqual(paints[0]);
      expect(pageErrors).toEqual([]);
      await capture(`bootstrap-controls-${theme}`);
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
          .toBe('M5 12L10 17L19 7');
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
          .toBe('M5 12L10 17L19 7');

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
        await toggle.click();
        await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('true');
        expect((await paint(toggle)).shadow).not.toBe(raised.shadow);
        await toggle.press('Enter');
        await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('false');
        expect((await requests(runtime, 'toggle', 'activeChange')).length).toBe(2);
        await part(runtime, 'toggleControlled').click();
        expect(await part(runtime, 'toggleControlled').getAttribute('aria-pressed')).toBe('false');
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
          for (const disabled of [true, false, true, false]) {
            await setProps(runtime, ref, { disabled });
            await expect.poll(() => control.getAttribute('aria-disabled')).toBe(String(disabled));
            await expect
              .poll(async () => (await paint(control)).opacity)
              .toBe(disabled ? '0.65' : '1');
            if (disabled) {
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
              (element as HTMLElement & { __bootstrapNativeInputTrace?: unknown[] })
                .__bootstrapNativeInputTrace
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
    await capture('bootstrap-controls-separators-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await open('light');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await capture('bootstrap-controls-mobile');
    const before = await page.locator('[data-runtime-host] [data-pui-root]').count();
    expect(before).toBeGreaterThanOrEqual(64);
    await page.evaluate(() =>
      (window as unknown as FixtureWindow).bootstrapStateControlsFixture.dispose()
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
