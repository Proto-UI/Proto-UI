// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Page, type Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromeExecutable, startServer, stopServer, type RuntimeId } from './browser-harness';

// Each case gets a fresh context and a terminal receipt, including failed states.
// This is official sandboxed browser evidence, not native/packed/full Finf admission.
const FAMILIES = ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const;
type Family = (typeof FAMILIES)[number];
const CALENDAR_STATES = [
  'rest',
  'month-menu',
  'year-scroll',
  'focus-only',
  'selected-focused',
] as const;
type CalendarState = (typeof CALENDAR_STATES)[number];
const RUNTIME_LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
const HOST_CLOCK = '2026-10-10T12:00:00Z';
const RECORDS = {
  form: 'internal/records/2026-10-10-finf-form-upstream-paint.md',
  calendar: 'internal/records/2026-10-10-calendar-five-state-reference-correction.md',
  overlay: 'internal/records/2026-10-10-finf-overlay-passive-paint-repair.md',
  tabs: 'internal/records/2026-10-10-runtime-box-tabs.md',
  accordion: 'internal/records/2026-10-06-finf-accordion-family-source-stage.zh-CN.md',
  drawer: 'internal/records/2026-10-10-finf-b-drawer-scrollport-source.md',
} as const;
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-finf-feature-evidence');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const requestedGroup = process.env.PUI_FINF_FEATURE_GROUP;
let browser: Browser;
let baseUrl = '';

type Screenshot = { state: string; file: string; sha256: string; observation: unknown };
type Journey = {
  page: Page;
  previewer: Locator;
  family: Family;
  capture: (state: string, observation?: unknown, crop?: Locator) => Promise<void>;
};
type Case = {
  id: string;
  group: string;
  family: Family;
  component: string;
  run: (journey: Journey) => Promise<void>;
};

function routeFor(family: Family, component: string): string {
  const nested =
    family === 'brutalist' && ['popover', 'alert-dialog'].includes(component) ? 'components/' : '';
  return `/en/ui-libraries/${family}/${nested}${component}/`;
}

function references(family: Family, component: string) {
  const record =
    component === 'calendar'
      ? RECORDS.calendar
      : component === 'runtime-tabs'
        ? RECORDS.tabs
        : component === 'accordion'
          ? RECORDS.accordion
          : component === 'drawer'
            ? RECORDS.drawer
            : ['form', 'fieldset', 'checkbox-group'].includes(component)
              ? RECORDS.form
              : RECORDS.overlay;
  // Only references already inspected and named in the records are carried here.
  // A same-named upstream implementation is not invented for adapted families.
  const upstream =
    component === 'drawer'
      ? []
      : family === 'shadcn'
        ? component === 'runtime-tabs' || component === 'calendar'
          ? [
              'https://ui.shadcn.com/docs/components/base/calendar',
              'https://ui.shadcn.com/r/styles/base-nova/calendar.json',
            ]
          : ['form', 'fieldset', 'checkbox-group'].includes(component)
            ? [
                'https://ui.shadcn.com/docs/components/base/field',
                'https://ui.shadcn.com/docs/components/base/input',
              ]
            : component === 'accordion'
              ? ['https://ui.shadcn.com/docs/components/base/accordion']
              : [`https://ui.shadcn.com/r/styles/base-nova/${component}.json`]
        : family === 'brutalist'
          ? [
              'https://github.com/ekmas/neobrutalism-components/tree/3306a802724874a85f93079702b2795370a279d4/src/components/ui',
            ]
          : family === 'bootstrap-2-3-2'
            ? [
                'https://github.com/twbs/bootstrap/tree/v2.3.2/less',
                'https://getbootstrap.com/2.3.2/base-css.html#forms',
              ]
            : [];
  return {
    record,
    upstream,
    comparison:
      'Source references only. Same-state upstream pixel comparison remains pending independent review.',
    limitations:
      family === 'liquid-glass'
        ? [
            'Independently authored Web material/fallback; no matching public Apple component source.',
            'Web output never substitutes for native GPUI/Qt/Rust evidence.',
          ]
        : component === 'calendar'
          ? [
              'Family Select popup differs from the official native select; no native popup equivalence.',
            ]
          : component === 'drawer'
            ? [
                'Own regression record supplies the geometry/Close oracle; no newly verified upstream source or image comparison.',
              ]
            : family === 'bootstrap-2-3-2'
              ? [
                  'Adapted family presentation; no same-named upstream AlertDialog or custom-checkbox equivalence.',
                ]
              : [],
  };
}

async function paint(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const textRect = range.getBoundingClientRect();
    return {
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      },
      textWidth: textRect.width,
      display: style.display,
      visibility: style.visibility,
      color: style.color,
      background: style.backgroundColor,
      shadow: style.boxShadow,
      border: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ],
      borderColor: style.borderBottomColor,
      radius: style.borderRadius,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      font: style.font,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      outline: style.outline,
      opacity: style.opacity,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
      overflowX: style.overflowX,
      ariaSelected: element.getAttribute('aria-selected'),
      ariaChecked: element.getAttribute('aria-checked'),
    };
  });
}

async function hasFocus(locator: Locator) {
  return locator.evaluate((element) => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    while (active) {
      if (element === active || element.contains(active)) return true;
      const root = active.getRootNode();
      active = root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  });
}

// Suite-local: fixed projections and generic embeds own different real Tabs shells.
// Do not fall back to the obsolete Select control or change the shared harness.
async function runtimeControls(previewer: Locator) {
  const fixed = (await previewer.getAttribute('data-projection-mode')) === 'fixed-family';
  return previewer.locator(
    fixed
      ? '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs]'
      : '[data-runtime-tabs-mount] [data-runtime-tabs-root]'
  );
}

async function runtimeTab(previewer: Locator, runtime: RuntimeId) {
  return (await runtimeControls(previewer)).getByRole('tab', {
    name: RUNTIME_LABELS[runtime],
    exact: true,
  });
}

// This function is serialized into the page; keep every dependency inside it.
function inspectRuntime(
  root: HTMLElement,
  request: { runtime: RuntimeId; label: string; readySelector: string; count: number }
) {
  const { runtime, label, readySelector, count } = request;
  const fixed = root.dataset.projectionMode === 'fixed-family';
  const scopes = root.querySelectorAll<HTMLElement>('[data-projection-scope]');
  const scope = scopes.length === 1 ? scopes[0] : null;
  const hosts = root.querySelectorAll<HTMLElement>('.host');
  const host = hosts.length === 1 ? hosts[0] : null;
  const controls = root.querySelectorAll<HTMLElement>(
    fixed
      ? '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs]'
      : '[data-runtime-tabs-mount] [data-runtime-tabs-root]'
  );
  const control = controls.length === 1 ? controls[0] : null;
  const selected = control?.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]');
  const tab = selected?.length === 1 ? selected[0] : null;
  const content = fixed ? scope?.querySelector<HTMLElement>('[data-projection-content]') : host;
  const committed = fixed
    ? scope?.dataset.projectionRuntime
    : (
        root as HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } }
      ).__previewer__?.getCurrentRuntime();
  const surfaces = content?.querySelectorAll<HTMLElement>(
    '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
  );
  const surface = surfaces?.length === 1 ? surfaces[0] : null;
  const firstRoot = surface?.querySelector<HTMLElement>('[data-pui-root]');
  const unavailable = (element: HTMLElement | null | undefined) => {
    if (!element?.isConnected) return true;
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      if (
        current.inert ||
        current.matches(
          '[inert], [hidden], [aria-hidden="true"], [aria-busy="true"], [aria-disabled="true"], [data-previewer-startup-pending], [data-previewer-startup-shell]'
        )
      )
        return true;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
    }
    return false;
  };
  const framework = !firstRoot
    ? null
    : firstRoot.tagName.startsWith('WC-')
      ? 'wc'
      : (firstRoot as HTMLElement & { __vue__?: unknown }).__vue__
        ? 'vue2'
        : host?.hasAttribute('data-v-app') || firstRoot.closest('[data-v-app]')
          ? 'vue'
          : Object.keys(surface!).some((key) => key.startsWith('__reactFiber$'))
            ? 'react'
            : null;
  const targetCount = surface?.querySelectorAll(readySelector).length ?? 0;
  const problems: string[] = [];
  if (!host || !content || controls.length !== 1) problems.push('missing-or-ambiguous-shell');
  if (fixed && (scopes.length !== 1 || scope?.dataset.projectionState !== 'ready'))
    problems.push('projection-not-ready');
  if (!fixed && scopes.length) problems.push('unexpected-fixed-scope');
  if (committed !== runtime) problems.push('runtime-not-committed');
  if (!tab || tab.textContent?.trim() !== label || (!fixed && tab.dataset.runtimeTab !== runtime))
    problems.push('runtime-tab-not-selected');
  if (unavailable(host) || unavailable(control) || unavailable(tab) || unavailable(surface))
    problems.push('shell-not-interactive');
  if (
    root.querySelector(
      '[data-previewer-startup-pending], [data-previewer-startup-shell], .proto-previewer__skeleton'
    )
  )
    problems.push('startup-pending');
  if (
    !surface?.hasAttribute('data-pui-root') ||
    Array.from(content?.querySelectorAll('[data-pui-root]') ?? []).some(
      (element) => element !== surface && !surface?.contains(element)
    )
  )
    problems.push('missing-or-extra-demo-surface');
  if (framework !== runtime) problems.push('wrong-framework');
  if (!firstRoot || targetCount !== count) problems.push('target-controls-not-ready');
  return {
    ready: problems.length === 0,
    shell: fixed ? 'fixed-family' : 'generic',
    committedRuntime: committed ?? null,
    selectedLabel: tab?.textContent?.trim() ?? null,
    surfaceCount: surfaces?.length ?? 0,
    framework,
    targetCount,
    problems,
  };
}

async function waitForRealRuntime(
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  count: number
) {
  await expect
    .poll(
      () =>
        previewer.evaluate(inspectRuntime, {
          runtime,
          label: RUNTIME_LABELS[runtime],
          readySelector,
          count,
        }),
      { timeout: 20_000 }
    )
    .toMatchObject({ ready: true });
}

async function selectRealRuntime(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  count: number
) {
  const tab = await runtimeTab(previewer, runtime);
  await tab.waitFor({ state: 'visible' });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await waitForRealRuntime(previewer, runtime, readySelector, count);
  await expect
    .poll(async () => (await runtimeTab(previewer, runtime)).getAttribute('aria-selected'))
    .toBe('true');
}

async function keyboardReach(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await hasFocus(target)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Target was not reached by 30 real Tab key presses.');
}

async function writeJson(file: string, value: unknown) {
  await writeFile(path.join(output, file), JSON.stringify(value, null, 2));
}

async function captureFailureDiagnostics(page: Page, id: string, capture: Journey['capture']) {
  const previewer = page.locator('[data-previewer-id]').first();
  if ((await previewer.count()) !== 1) return { unavailable: 'No previewer mounted.' };
  const files: Record<string, string> = {};
  const errors: string[] = [];
  for (const [kind, collect] of [
    ['dom', () => previewer.evaluate((root) => root.outerHTML)],
    ['aria', () => previewer.ariaSnapshot()],
  ] as const) {
    try {
      const file = `${id}-failed-${kind}.txt`;
      await writeFile(path.join(output, file), await collect());
      files[kind] = file;
    } catch (error) {
      errors.push(`${kind}: ${String(error)}`);
    }
  }
  try {
    await capture('failed-previewer', { diagnostic: 'Exact failed previewer region' }, previewer);
  } catch (error) {
    errors.push(`region: ${String(error)}`);
  }
  return { files, errors };
}

async function runCase(testCase: Case) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1000 },
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'UTC',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const screenshots: Screenshot[] = [];
  const pageErrors: string[] = [];
  const captureErrors: string[] = [];
  const blockedRequests: string[] = [];
  let failure: unknown;
  const route = routeFor(
    testCase.family,
    testCase.component === 'runtime-tabs' ? 'form' : testCase.component
  );
  const capture: Journey['capture'] = async (state, observation = {}, crop) => {
    const file = `${testCase.id}-${state}.png`;
    await page.evaluate(() => document.fonts.ready);
    if (crop)
      await crop.screenshot({
        path: path.join(output, file),
        animations: 'disabled',
        timeout: 10_000,
      });
    else
      await page.screenshot({
        path: path.join(output, file),
        animations: 'disabled',
        timeout: 10_000,
      });
    screenshots.push({
      state,
      file,
      sha256: createHash('sha256')
        .update(await readFile(path.join(output, file)))
        .digest('hex'),
      observation,
    });
  };
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await context.route('**/*', (request) => {
    const url = new URL(request.request().url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseUrl).origin) {
      blockedRequests.push(`${url.origin}${url.pathname}`);
      return request.abort();
    }
    return request.continue();
  });
  try {
    // Locale and fixed clock belong to this host fixture, never to the prototype.
    await page.clock.setFixedTime(HOST_CLOCK);
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    const previewer = page.locator('[data-previewer-id]').first();
    await previewer.waitFor({ state: 'visible' });
    await testCase.run({ page, previewer, family: testCase.family, capture });
    expect(pageErrors).toEqual([]);
  } catch (error) {
    failure = error;
  } finally {
    // A failed assertion cannot suppress either the current pixels or the receipt.
    await capture(failure ? 'failed' : 'final').catch((error) => captureErrors.push(String(error)));
    const failureDiagnostics = failure
      ? await captureFailureDiagnostics(page, testCase.id, capture).catch((error) => ({
          error: String(error),
        }))
      : null;
    const environment = await page
      .evaluate(() => ({
        locale: navigator.language,
        resolvedLocale: new Intl.DateTimeFormat().resolvedOptions().locale,
        today: new Date().toISOString(),
        devicePixelRatio,
        theme: document.documentElement.dataset.theme,
        font: getComputedStyle(document.body).font,
      }))
      .catch(() => null);
    await writeJson(`${testCase.id}.json`, {
      revision,
      tree,
      case: testCase.id,
      group: testCase.group,
      family: testCase.family,
      component: testCase.component,
      route,
      viewport: page.viewportSize(),
      hostClock: HOST_CLOCK,
      environment,
      runtime: testCase.component === 'runtime-tabs' ? Object.keys(RUNTIME_LABELS) : 'react',
      presetCheck: process.env.PUI_FINF_PRESET_CHECK ?? 'unknown',
      browser: browser.version(),
      references: references(testCase.family, testCase.component),
      result: failure ? 'failed' : captureErrors.length ? 'capture-failed' : 'passed',
      error:
        failure instanceof Error
          ? { name: failure.name, message: failure.message, stack: failure.stack }
          : failure
            ? String(failure)
            : null,
      screenshots,
      captureErrors,
      failureDiagnostics,
      pageErrors,
      blockedRequests,
      acceptance:
        'Real current-source observations only; no full-delivery, upstream visual-equivalence or native admission.',
    });
    await context.close();
  }
  if (failure) throw failure;
  expect(captureErrors).toEqual([]);
}

async function formJourney({ page, previewer, family, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="form"]', 1);
  const form = previewer.locator('[data-demo-ref="form"]');
  const editor = form.locator('input').first();
  await capture('rest', { editor: await paint(editor) }, previewer);
  await editor.fill('Finf sample');
  expect(await editor.inputValue()).toBe('Finf sample');
  await form.getByRole('button', { name: /Reset values/ }).click();
  await expect.poll(() => editor.inputValue()).toBe('');
  await capture('reset', { value: await editor.inputValue() }, previewer);
  await editor.fill('Finf sample');
  const email = form.getByRole('checkbox', { name: 'Email · 邮件', exact: true });
  const sms = form.getByRole('checkbox', { name: 'SMS · 短信', exact: true });
  await sms.click();
  await expect.poll(() => sms.getAttribute('aria-checked')).toBe('true');
  const rows = { email: await paint(email), sms: await paint(sms) };
  await capture(
    'edited',
    { editedValue: await editor.inputValue(), resetObserved: true, rows },
    previewer
  );
  if (family !== 'liquid-glass')
    for (const row of Object.values(rows)) expect(row.border).toEqual(['0px', '0px', '0px', '0px']);
}

async function fieldsetJourney({ page, previewer, family, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="group"]', 1);
  const group = previewer.locator('[data-demo-ref="group"]');
  const editor = group.locator('input').first();
  const rest = await paint(group);
  await capture('rest', { group: rest }, previewer);
  await keyboardReach(page, editor);
  await editor.fill('Finf keyboard entry');
  await capture(
    'keyboard-focus',
    { group: await paint(group), editor: await paint(editor), focused: await hasFocus(editor) },
    previewer
  );
  expect(await hasFocus(editor)).toBe(true);
  expect(await group.getAttribute('aria-labelledby')).toBeTruthy();
  expect(await group.getAttribute('aria-describedby')).toBeTruthy();
  // Liquid's independently authored material card is intentionally not homogenized.
  if (family !== 'liquid-glass') {
    expect(rest.border).toEqual(['0px', '0px', '0px', '0px']);
    expect(rest.padding).toEqual(['0px', '0px', '0px', '0px']);
    expect(rest.shadow).toBe('none');
  }
}

async function checkboxGroupJourney({ page, previewer, family, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[role="checkbox"]', 4);
  const all = previewer.getByRole('checkbox', { name: 'All channels · 全选', exact: true });
  const email = previewer.getByRole('checkbox', { name: 'Email · 邮件', exact: true });
  const sms = previewer.getByRole('checkbox', { name: 'SMS · 短信', exact: true });
  const disabled = previewer.getByRole('checkbox', {
    name: 'Push disabled · 推送已禁用',
    exact: true,
  });
  const rest = await paint(sms);
  await capture(
    'mixed',
    {
      all: await paint(all),
      email: await paint(email),
      sms: rest,
      disabled: await paint(disabled),
    },
    previewer
  );
  expect(await all.getAttribute('aria-checked')).toBe('mixed');
  await all.click();
  await expect.poll(() => sms.getAttribute('aria-checked')).toBe('true');
  const checked = await paint(sms);
  await capture(
    'checked',
    { all: await paint(all), email: await paint(email), sms: checked },
    previewer
  );
  expect(await email.getAttribute('aria-checked')).toBe('true');
  expect(await disabled.getAttribute('aria-checked')).toBe('false');
  await all.click();
  await expect.poll(() => sms.getAttribute('aria-checked')).toBe('false');
  await keyboardReach(page, sms);
  await page.keyboard.press('Space');
  await expect.poll(() => sms.getAttribute('aria-checked')).toBe('true');
  await capture(
    'keyboard-toggle',
    { all: await paint(all), sms: await paint(sms), focused: await hasFocus(sms) },
    previewer
  );
  if (family !== 'liquid-glass') {
    expect(checked.border).toEqual(['0px', '0px', '0px', '0px']);
    expect(checked.background).toBe(rest.background);
  }
}

async function calendarJourney(journey: Journey, state: CalendarState) {
  const { page, previewer, capture } = journey;
  await selectRealRuntime(page, previewer, 'react', '[role="gridcell"]', 42);
  const month = previewer.getByRole('combobox', { name: /Month/ });
  const year = previewer.getByRole('combobox', { name: /Year/ });
  await month.waitFor({ state: 'visible' });
  await year.waitFor({ state: 'visible' });
  if (state === 'month-menu') {
    await month.click();
    const options = page.getByRole('option');
    await options.first().waitFor({ state: 'visible' });
    await capture(state, {
      labels: await options.allTextContents(),
      month: await month.textContent(),
    });
    expect(await options.count()).toBe(12);
    expect(await options.allTextContents()).toContain('10月');
    await page.keyboard.press('Escape');
    await expect.poll(() => month.getAttribute('aria-expanded')).toBe('false');
  } else if (state === 'year-scroll') {
    await year.click();
    const options = page.getByRole('option');
    await options.first().waitFor({ state: 'attached' });
    const current = page.getByRole('option', { name: '2026', exact: true });
    const scroll = () =>
      current.evaluate((element) => {
        let ancestor = element.parentElement;
        while (ancestor && ancestor.scrollHeight <= ancestor.clientHeight + 1)
          ancestor = ancestor.parentElement;
        if (!ancestor) return null;
        const item = element.getBoundingClientRect(),
          box = ancestor.getBoundingClientRect();
        return {
          scrollTop: ancestor.scrollTop,
          scrollHeight: ancestor.scrollHeight,
          clientHeight: ancestor.clientHeight,
          currentVisible: item.top >= box.top && item.bottom <= box.bottom + 1,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      });
    const initial = await scroll();
    await capture('year-current', { optionCount: await options.count(), initial });
    expect(initial).not.toBeNull();
    await page.mouse.move(
      initial!.box.x + initial!.box.width / 2,
      initial!.box.y + initial!.box.height / 2
    );
    const wheelDelta = initial!.scrollTop > 0 ? -560 : 560;
    await page.mouse.wheel(0, wheelDelta);
    await expect.poll(async () => (await scroll())?.scrollTop).not.toBe(initial!.scrollTop);
    await capture('year-wheel-scrolled', {
      before: initial,
      after: await scroll(),
      input: 'Playwright mouse wheel, no scrollTop writes',
      wheelDelta,
    });
    expect(await options.count()).toBe(101);
    expect(initial!.currentVisible).toBe(true);
    await page.keyboard.press('Escape');
  } else if (state === 'focus-only' || state === 'selected-focused') {
    const initial = previewer.getByRole('gridcell', {
      name: 'Saturday, October 10, 2026',
      exact: true,
    });
    await keyboardReach(page, initial);
    await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    const target = previewer.getByRole('gridcell', {
      name: 'Saturday, November 7, 2026',
      exact: true,
    });
    await expect.poll(() => hasFocus(target)).toBe(true);
    const focusOnly = await paint(target);
    if (state === 'selected-focused') await target.click();
    const actual = await paint(target);
    await capture(
      state,
      {
        target: actual,
        focusOnly,
        selectedDate: state === 'selected-focused' ? '2026-11-07' : '2026-10-10',
        focusedDate: '2026-11-07',
        input:
          state === 'selected-focused'
            ? 'keyboard navigation followed by real pointer click'
            : 'Tab, PageDown, ArrowLeft × 3',
      },
      previewer
    );
    expect(actual.ariaSelected).toBe(state === 'selected-focused' ? 'true' : 'false');
    expect(actual.shadow).not.toBe('none');
    expect(actual.shadow).toContain('3px');
    if (state === 'selected-focused') expect(actual.background).not.toBe(focusOnly.background);
  } else {
    await capture(
      'october-rest',
      {
        month: await month.textContent(),
        year: await year.textContent(),
        days: await previewer.locator('[role="gridcell"]:visible').count(),
      },
      previewer
    );
    // Preserve the original explicit October 15 selection assertion in addition to five reference states.
    const day = previewer.getByRole('gridcell', {
      name: 'Thursday, October 15, 2026',
      exact: true,
    });
    await day.click();
    await expect.poll(() => day.getAttribute('aria-selected')).toBe('true');
    await capture(
      'october-15-selected',
      { selectedDate: '2026-10-15', cell: await paint(day) },
      previewer
    );
    const box = await day.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  }
  // Count actual painted cells, separately from the retained 42-cell capacity.
  // Hidden-selector failures remain red and have already produced state captures.
  expect(await previewer.getByRole('columnheader').count()).toBe(7);
  expect(await previewer.locator('[role="gridcell"]:visible').count()).toBe(35);
  expect(await month.textContent()).toContain(state.includes('focus') ? '11月' : '10月');
  const visibleDay = previewer.locator('[role="gridcell"]:visible').first();
  const dimensions = await visibleDay.boundingBox();
  expect(Math.abs(dimensions!.width - 28)).toBeLessThanOrEqual(1);
  expect(Math.abs(dimensions!.height - 28)).toBeLessThanOrEqual(1);
}

async function drawerJourney({ page, previewer, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="root"]', 1);
  const trigger = previewer.getByRole('button', { name: 'Open Drawer', exact: true });
  await trigger.click();
  const panel = page.locator('[data-demo-ref="panel"][role="dialog"]');
  await panel.waitFor({ state: 'visible' });
  const handle = panel.getByRole('separator', { name: 'Resize drawer', exact: true });
  await handle.focus();
  await page.keyboard.press('Home');
  await expect
    .poll(() =>
      panel.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--pui-offset-percentage').trim()
      )
    )
    .toBe('50');
  const geometry = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect(),
      style = getComputedStyle(element);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      availableHeight:
        Number.parseFloat(style.getPropertyValue('--proto-ui-available-region-height')) ||
        window.visualViewport?.height ||
        window.innerHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  });
  await capture('half-open', { snapPoint: 0.5, offsetPercentage: 50, panel: geometry });
  expect(geometry.height).toBeGreaterThan(0);
  expect(Math.abs(geometry.height - geometry.availableHeight * 0.85 * 0.5)).toBeLessThanOrEqual(2);
  expect(geometry.x).toBeGreaterThanOrEqual(-1);
  expect(geometry.y).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  const close = panel.getByRole('button', { name: 'Close', exact: true });
  await close.scrollIntoViewIfNeeded();
  const closeRect = await close.boundingBox(),
    panelRect = await panel.boundingBox();
  expect(closeRect).not.toBeNull();
  expect(panelRect).not.toBeNull();
  const centerX = closeRect!.x + closeRect!.width / 2,
    centerY = closeRect!.y + closeRect!.height / 2;
  expect(centerX).toBeGreaterThanOrEqual(Math.max(0, panelRect!.x));
  expect(centerX).toBeLessThanOrEqual(
    Math.min(geometry.viewportWidth, panelRect!.x + panelRect!.width)
  );
  expect(centerY).toBeGreaterThanOrEqual(Math.max(0, panelRect!.y));
  expect(centerY).toBeLessThanOrEqual(
    Math.min(geometry.viewportHeight, panelRect!.y + panelRect!.height)
  );
  await capture('close-reachable', { close: closeRect });
  await close.click();
  await expect.poll(() => panel.isVisible()).toBe(false);
  await capture(
    'actually-closed',
    { panelVisible: await panel.isVisible(), triggerFocused: await hasFocus(trigger) },
    previewer
  );
  await expect.poll(() => hasFocus(trigger)).toBe(true);
  await trigger.click();
  await panel.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await expect.poll(() => panel.isVisible()).toBe(false);
  await capture('reopen-escape-closed', { panelVisible: await panel.isVisible() }, previewer);
}

async function accordionJourney({ page, previewer, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="single"]', 1);
  const trigger = previewer.locator('[data-demo-ref="single-lifetime-trigger"]');
  const content = previewer.locator('[data-demo-ref="single-lifetime-content"]');
  await capture('rest', {}, previewer);
  await trigger.click();
  await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('true');
  await content.waitFor({ state: 'visible' });
  await capture(
    'opened',
    { trigger: await paint(trigger), content: await paint(content) },
    previewer
  );
  await trigger.click();
  await expect.poll(() => content.isVisible()).toBe(false);
  await trigger.click();
  await content.waitFor({ state: 'visible' });
  await capture('reopened', { content: await paint(content) }, previewer);
  const controlled = previewer.locator('[data-demo-ref="controlled-a-trigger"]');
  await controlled.click();
  expect(await controlled.getAttribute('aria-expanded')).toBe('false');
  await previewer
    .getByRole('button', { name: 'Accept pending request · 接受请求', exact: true })
    .click();
  await expect.poll(() => controlled.getAttribute('aria-expanded')).toBe('true');
  await capture('controlled-accepted', {}, previewer);
}

async function popoverJourney({ page, previewer, family, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="root"]', 1);
  const trigger = previewer.getByRole('button', { name: 'Open Popover', exact: true });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Popover settings', exact: true });
  await panel.waitFor({ state: 'visible' });
  const actual = await paint(panel);
  await capture('opened', { panel: actual });
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => panel.isVisible()).toBe(false);
  await capture('closed', { triggerFocused: await hasFocus(trigger) }, previewer);
  await trigger.click();
  await panel.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await expect.poll(() => panel.isVisible()).toBe(false);
  if (family === 'shadcn' || family === 'brutalist') {
    const rem = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    );
    expect(Math.abs(actual.rect.width - 18 * rem)).toBeLessThanOrEqual(1);
    if (family === 'brutalist') expect(actual.shadow).toBe('none');
  }
}

async function alertDialogJourney({ page, previewer, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'react', '[data-demo-ref="root"]', 1);
  const trigger = previewer.getByRole('button', { name: 'Open AlertDialog', exact: true });
  await trigger.click();
  const panel = page.getByRole('alertdialog');
  await panel.waitFor({ state: 'visible' });
  const action = panel.getByRole('button', { name: 'Confirm', exact: true });
  const cancel = panel.getByRole('button', { name: 'Cancel', exact: true });
  const initial = { action: await paint(action), cancel: await paint(cancel) };
  await capture('opened', initial);
  await action.hover();
  await capture('action-hover', { action: await paint(action) });
  await cancel.click();
  await expect.poll(() => panel.isVisible()).toBe(false);
  await capture('cancelled', { triggerFocused: await hasFocus(trigger) }, previewer);
  await trigger.click();
  await panel.waitFor({ state: 'visible' });
  await keyboardReach(page, action);
  await capture('action-keyboard-focus', {
    action: await paint(action),
    focused: await hasFocus(action),
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => panel.isVisible()).toBe(false);
  await capture(
    'confirmed-and-closed',
    { panelVisible: await panel.isVisible(), triggerFocused: await hasFocus(trigger) },
    previewer
  );
  expect(initial.action.background).not.toBe(initial.cancel.background);
  await expect.poll(() => hasFocus(trigger)).toBe(true);
}

async function runtimeTabsJourney({ page, previewer, capture }: Journey) {
  await selectRealRuntime(page, previewer, 'wc', '[data-demo-ref="form"]', 1);
  // These Form pages are generic embeds. Observe their real public commit event
  // and DOM ownership, rather than inventing a fixed-family generation counter.
  expect(await previewer.getAttribute('data-projection-mode')).not.toBe('fixed-family');
  const observation = await previewer.evaluateHandle((root) => {
    const events: string[] = [];
    const listener = (event: Event) => {
      if (event.target === root) events.push((event as CustomEvent<{ id: string }>).detail.id);
    };
    root.addEventListener('runtime:changed', listener);
    return { events, stop: () => root.removeEventListener('runtime:changed', listener) };
  });
  const publications = () => observation.evaluate((state) => [...state.events]);
  const labels = async () => (await runtimeControls(previewer)).getByRole('tab').allTextContents();
  const surface = () =>
    previewer
      .locator(
        '.host .pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
      )
      .elementHandle();
  const snapshots = [];
  try {
    await capture('wc-rest', { labels: await labels(), events: await publications() }, previewer);
    expect(await labels()).toEqual(Object.values(RUNTIME_LABELS));
    const expectedEvents: string[] = [];
    for (const [from, to, key] of [
      ['wc', 'react', 'Enter'],
      ['react', 'vue', 'Space'],
      ['vue', 'vue2', 'Enter'],
      ['vue2', 'wc', 'Space'],
    ] as const) {
      const previousSurface = await surface();
      expect(previousSurface).not.toBeNull();
      try {
        await (await runtimeTab(previewer, from)).focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(async () => hasFocus(await runtimeTab(previewer, to))).toBe(true);
        expect(await publications()).toEqual(expectedEvents);
        expect(await previousSurface!.evaluate((element) => element.isConnected)).toBe(true);
        await waitForRealRuntime(previewer, from, '[data-demo-ref="form"]', 1);
        expect(await (await runtimeTab(previewer, from)).getAttribute('aria-selected')).toBe(
          'true'
        );
        await page.keyboard.press(key);
        await waitForRealRuntime(previewer, to, '[data-demo-ref="form"]', 1);
        expectedEvents.push(to);
        await expect.poll(publications).toEqual(expectedEvents);
        expect(await previousSurface!.evaluate((element) => element.isConnected)).toBe(false);
        await expect.poll(async () => hasFocus(await runtimeTab(previewer, to))).toBe(true);
        const selected = await paint(await runtimeTab(previewer, to));
        const inactive = await paint(await runtimeTab(previewer, from));
        snapshots.push({
          from,
          to,
          key,
          events: await publications(),
          oldSurfaceDisconnected: true,
          selected,
          inactive,
        });
        await capture(`${to}-selected`, snapshots.at(-1), previewer);
        expect(await labels()).toEqual(Object.values(RUNTIME_LABELS));
        expect(
          await (await runtimeControls(previewer))
            .locator('[role="tab"][aria-selected="true"]')
            .count()
        ).toBe(1);
      } finally {
        await previousSurface?.dispose();
      }
    }
    const finalSurface = await surface();
    try {
      await page.keyboard.press('End');
      await expect.poll(async () => hasFocus(await runtimeTab(previewer, 'vue2'))).toBe(true);
      await page.keyboard.press('Home');
      await expect.poll(async () => hasFocus(await runtimeTab(previewer, 'wc'))).toBe(true);
      expect(await publications()).toEqual(expectedEvents);
      expect(await finalSurface!.evaluate((element) => element.isConnected)).toBe(true);
      await page.setViewportSize({ width: 320, height: 1000 });
      const list = (await runtimeControls(previewer)).getByRole('tablist');
      await page.keyboard.press('End');
      await expect.poll(async () => hasFocus(await runtimeTab(previewer, 'vue2'))).toBe(true);
      await capture('narrow-keyboard-focus', {
        list: await paint(list),
        last: await paint(await runtimeTab(previewer, 'vue2')),
        viewport: page.viewportSize(),
      });
      const narrowList = await paint(list);
      const lastTab = await paint(await runtimeTab(previewer, 'vue2'));
      expect(narrowList.overflowX).toBe('auto');
      expect(narrowList.scrollWidth).toBeGreaterThan(narrowList.clientWidth);
      expect(lastTab.rect.x).toBeGreaterThanOrEqual(narrowList.rect.x - 1);
      expect(lastTab.rect.right).toBeLessThanOrEqual(narrowList.rect.right + 1);
      expect(await publications()).toEqual(expectedEvents);
      expect(await finalSurface!.evaluate((element) => element.isConnected)).toBe(true);
      await waitForRealRuntime(previewer, 'wc', '[data-demo-ref="form"]', 1);
    } finally {
      await finalSurface?.dispose();
    }
  } finally {
    await observation.evaluate((state) => state.stop());
    await observation.dispose();
  }
  // Geometry follows the inspected underline reference; screenshots still need human inspection.
  for (const { selected, inactive } of snapshots) {
    expect(selected.border[2]).toBe('2px');
    expect(selected.radius).toBe('0px');
    expect(selected.padding[1]).toBe('0px');
    expect(selected.padding[3]).toBe('0px');
    expect(selected.shadow).toBe('none');
    expect(selected.background).toBe('rgba(0, 0, 0, 0)');
    expect(selected.textWidth).toBeGreaterThan(0);
    expect(Math.abs(selected.rect.width - selected.textWidth)).toBeLessThanOrEqual(2);
    expect(selected.color).not.toBe(inactive.color);
  }
}

const cases: Case[] = [
  ...FAMILIES.flatMap((family) => [
    { id: `${family}-form`, group: 'forms', family, component: 'form', run: formJourney },
    {
      id: `${family}-fieldset`,
      group: 'forms',
      family,
      component: 'fieldset',
      run: fieldsetJourney,
    },
    {
      id: `${family}-checkbox-group`,
      group: 'forms',
      family,
      component: 'checkbox-group',
      run: checkboxGroupJourney,
    },
  ]),
  ...CALENDAR_STATES.map((state) => ({
    id: `shadcn-calendar-${state}`,
    group: 'calendar',
    family: 'shadcn' as const,
    component: 'calendar',
    run: (journey: Journey) => calendarJourney(journey, state),
  })),
  {
    id: 'shadcn-drawer',
    group: 'modal-overlays',
    family: 'shadcn',
    component: 'drawer',
    run: drawerJourney,
  },
  ...FAMILIES.flatMap((family) => [
    {
      id: `${family}-accordion`,
      group: 'disclosure-overlays',
      family,
      component: 'accordion',
      run: accordionJourney,
    },
    {
      id: `${family}-popover`,
      group: 'disclosure-overlays',
      family,
      component: 'popover',
      run: popoverJourney,
    },
    {
      id: `${family}-alert-dialog`,
      group: 'modal-overlays',
      family,
      component: 'alert-dialog',
      run: alertDialogJourney,
    },
    {
      id: `${family}-runtime-tabs`,
      group: 'runtime-tabs',
      family,
      component: 'runtime-tabs',
      run: runtimeTabsJourney,
    },
  ]),
];
const selectedCases = cases.filter(
  (testCase) => !requestedGroup || testCase.group === requestedGroup
);
if (!selectedCases.length) throw new Error(`Unknown Finf evidence group: ${requestedGroup}`);

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeJson('source.json', {
    revision,
    tree,
    requestedGroup: requestedGroup ?? 'all',
    cases: selectedCases.map(({ id, group, family, component }) => ({
      id,
      group,
      family,
      component,
      route: routeFor(family, component === 'runtime-tabs' ? 'form' : component),
    })),
    phase: 'Planned at setup; each terminal case receipt is the result authority.',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'This receipt suite runs only in its official GitHub Actions workflow. Local source/type tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim()).toBe('');
    // Readiness of a single component must not prevent unrelated cases from navigating.
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence may visit only this job’s own loopback documentation server.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    for (const testCase of selectedCases)
      await writeJson(`${testCase.id}.json`, {
        revision,
        tree,
        case: testCase.id,
        group: testCase.group,
        result: 'blocked-before-browser',
        error: String(error),
        screenshots: [],
        reason: 'No running page was available; no image is claimed.',
      });
    throw error;
  }
}, 180_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 30_000);

describe('Finf source-bound representative feature screenshots', () => {
  for (const testCase of selectedCases)
    it(
      testCase.id,
      () => runCase(testCase),
      testCase.component === 'runtime-tabs' ? 180_000 : 120_000
    );
});
