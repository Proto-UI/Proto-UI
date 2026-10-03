// @vitest-environment node
import { revealHeaderPreferences } from './site-header-browser';
import type { Browser, Locator, Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
import { nativeLinkEvidenceIssues } from './site-native-link-evidence';
import socialDestinations from '../../../../../../shared/links.json';

let browser: Browser;
let baseUrl: string;
const evidenceDirectory = path.join(
  process.env.RUNNER_TEMP ?? os.tmpdir(),
  'homepage-evidence',
  'native-links'
);
let evidenceSource: { sha: string; dirty: boolean };
async function captureLinks(
  page: Page,
  id: string,
  family: string,
  runtime: string,
  state: string,
  paintEvidence?: unknown
) {
  await mkdir(evidenceDirectory, { recursive: true });
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(evidenceDirectory, file) });
  const observed = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    documentFamily: document.documentElement.dataset.siteLibraryFamily,
    homepageRuntime:
      document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtime ?? null,
    menuExpanded: document
      .querySelector('[data-site-menu-button], [data-homepage-menu-label] [role="button"]')
      ?.getAttribute('aria-expanded'),
    focusedName: document.activeElement?.getAttribute('aria-label'),
    focusedRole: document.activeElement?.tagName,
  }));
  await writeFile(
    path.join(evidenceDirectory, `${id}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: evidenceSource,
        capturedAt: new Date().toISOString(),
        screenshot: file,
        url: page.url(),
        viewport: page.viewportSize(),
        family,
        runtime,
        state,
        observed,
        paintEvidence,
        renderer: 'Real Chromium via existing repository browser harness',
      },
      null,
      2
    )
  );
}
const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
beforeAll(async () => {
  evidenceSource = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
async function choose(page: Page, selector: string, label: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(`${selector} [role="combobox"]`);
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  const portal = page.locator(`[id=${JSON.stringify(id)}]`);
  await portal.getByRole('option', { name: label, exact: true }).click();
  // Selecting the already-current value need not remount the page. Its real
  // Select closing transition must finish before unrelated native hit samples.
  await portal.waitFor({ state: 'hidden' });
}
async function ready(page: Page, runtime: string, family: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return (
        root?.dataset.runtimeState === 'ready' &&
        root.dataset.runtime === runtime &&
        root.dataset.family === family
      );
    },
    { runtime, family }
  );
}
async function openSettings(page: Page) {
  const button = page.locator(
    '[data-homepage-menu-label] [role="button"], [data-site-menu-button]'
  );
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

async function installNativeTrace(page: Page, currentDocument = false) {
  const initialize = () => {
    const state = {
      action: 'initial',
      events: [] as Array<{
        event: Event;
        target: Node;
        anchor: HTMLAnchorElement;
        at: number;
        action: string;
        targetTag: string;
        hitIsAnchor: boolean;
        connectedAtCapture: boolean;
        x: number;
        y: number;
      }>,
    };
    (window as Window & { __siteNativeTrace?: typeof state }).__siteNativeTrace = state;
    for (const type of [
      'pointerenter',
      'pointerleave',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'auxclick',
      'focus',
      'blur',
      'keydown',
      'keyup',
    ]) {
      document.addEventListener(
        type,
        (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const anchor = target.closest('a');
          if (!anchor) return;
          const { clientX: x = 0, clientY: y = 0 } = event as MouseEvent;
          state.events.push({
            event,
            target,
            anchor,
            at: performance.now(),
            action: state.action,
            targetTag: target.tagName,
            hitIsAnchor: document.elementFromPoint(x, y) === anchor,
            connectedAtCapture: target.isConnected,
            x,
            y,
          });
          if (state.events.length > 150) state.events.shift();
        },
        { capture: true }
      );
    }
  };
  await page.addInitScript(initialize);
  if (currentDocument) await page.evaluate(initialize);
}
async function nativeActionLabel(page: Page, action: string) {
  await page.evaluate((action) => {
    const state = (window as Window & { __siteNativeTrace?: { action: string } }).__siteNativeTrace;
    if (state) state.action = action;
  }, action);
}
async function saveNativeTrace(page: Page, id: string, detail: unknown = null) {
  const events = await page.evaluate(() => {
    const state = (
      window as Window & {
        __siteNativeTrace?: {
          events: Array<{
            event: Event;
            target: Node;
            anchor: HTMLAnchorElement;
            at: number;
            action: string;
            targetTag: string;
            hitIsAnchor: boolean;
            connectedAtCapture: boolean;
            x: number;
            y: number;
          }>;
        };
      }
    ).__siteNativeTrace;
    return (state?.events ?? []).map(({ event, target, anchor, ...entry }) => ({
      ...entry,
      type: event.type,
      trusted: event.isTrusted,
      preventedAfterDispatch: event.defaultPrevented,
      button: (event as MouseEvent).button,
      buttons: (event as MouseEvent).buttons,
      key: (event as KeyboardEvent).key,
      ctrl: (event as MouseEvent).ctrlKey,
      meta: (event as MouseEvent).metaKey,
      targetConnectedAfterDispatch: target.isConnected,
      anchorConnected: anchor.isConnected,
      targetWasAnchor: target === anchor,
      href: anchor.getAttribute('href'),
      name: anchor.getAttribute('aria-label'),
    }));
  });
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, `${id}-events.json`),
    JSON.stringify(
      { source: evidenceSource, url: page.url(), viewport: page.viewportSize(), detail, events },
      null,
      2
    )
  );
  return events;
}

async function nativePopup(
  page: Page,
  link: Locator,
  action: 'modifier' | 'middle' | 'enter',
  owner: string
) {
  const label = `${owner}:${action}`;
  const href = await link.getAttribute('href');
  console.info(`[native-link] ${label} begin href=${href}`);
  await nativeActionLabel(page, label);
  const outcome = page
    .context()
    .waitForEvent('page')
    .then(
      (popup) => ({ popup }),
      (error: unknown) => ({ error })
    );
  try {
    if (action === 'modifier') await link.click({ modifiers: ['Control'] });
    else if (action === 'middle') await link.click({ button: 'middle' });
    else {
      await link.focus();
      await page.keyboard.press('Enter');
    }
    const result = await outcome;
    if ('error' in result) throw result.error;
    // A popup can first report the initial empty document as loaded. Wait
    // for this activation's exact routed destination before accepting it.
    if (!href) throw new Error('Native navigation destination is missing');
    await result.popup.waitForURL(href, { waitUntil: 'domcontentloaded' });
    expect(result.popup.url(), label).toBe(href);
    await result.popup.close();
    console.info(`[native-link] ${label} passed`);
  } catch (error) {
    await saveNativeTrace(page, `${owner}-${action}-failure`, {
      action,
      owner,
      href,
      error: String(error),
    });
    throw new Error(`[native-link] ${label} failed for ${href}`, { cause: error });
  }
}

async function linkPaint(link: Locator) {
  return link.evaluate((anchor) => {
    const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
    const style = getComputedStyle(surface);
    const box = surface.getBoundingClientRect();
    const nativeBox = anchor.getBoundingClientRect();
    // Observe the painted body's edge midpoints, not its decorative shadow or
    // rounded corner. The passive child may move; the native a remains the only
    // activation owner and must still cover the visible target at that endpoint.
    const edgeHits = [
      { edge: 'right', x: box.right - 1, y: box.top + box.height / 2 },
      { edge: 'bottom', x: box.left + box.width / 2, y: box.bottom - 1 },
    ].map((point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        ...point,
        hitIsAnchor: hit === anchor,
        hitTag: hit?.tagName ?? null,
        hitHref: hit?.closest('a')?.getAttribute('href') ?? null,
      };
    });
    const ringExtent = 4;
    let unclipped =
      box.left >= ringExtent &&
      box.top >= ringExtent &&
      box.right + ringExtent <= innerWidth &&
      box.bottom + ringExtent <= innerHeight;
    for (let parent = surface.parentElement; parent; parent = parent.parentElement) {
      const clip = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (['hidden', 'clip', 'scroll', 'auto'].includes(clip.overflowX))
        unclipped &&=
          box.left - ringExtent >= bounds.left && box.right + ringExtent <= bounds.right;
      if (['hidden', 'clip', 'scroll', 'auto'].includes(clip.overflowY))
        unclipped &&=
          box.top - ringExtent >= bounds.top && box.bottom + ringExtent <= bounds.bottom;
    }
    return {
      tokens: (surface.getAttribute('data-pui-style') ?? '').split(/\s+/),
      background: style.backgroundColor,
      shadow: style.boxShadow,
      transform: style.transform,
      weight: style.fontWeight,
      font: style.fontFamily,
      decoration: style.textDecorationLine,
      whiteSpace: style.whiteSpace,
      ringWidth: style.getPropertyValue('--pui-ring-width').trim(),
      ringOffset: style.getPropertyValue('--pui-ring-offset-width').trim(),
      ringColor: style.getPropertyValue('--pui-ring-color').trim(),
      focused: anchor === document.activeElement && anchor.matches(':focus-visible'),
      nativePressed: anchor.matches(':active'),
      nativeRect: {
        x: nativeBox.x,
        y: nativeBox.y,
        width: nativeBox.width,
        height: nativeBox.height,
      },
      surfaceRect: { x: box.x, y: box.y, width: box.width, height: box.height },
      edgeHits,
      visibleTarget:
        box.width > 0 &&
        box.height > 0 &&
        anchor === document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2),
      unclipped,
      // Record the native root outline too: the Prototype ring alone does not
      // prove that a browser focus outline is absent or visually acceptable.
      nativeOutline: getComputedStyle(anchor).outline,
    };
  });
}

async function assertSocialPaint(
  page: Page,
  links: Locator,
  family: string,
  capture: (state: string, evidence: unknown) => Promise<void>
) {
  const first = links.first();
  await page.mouse.move(1400, 950);
  const hoverToken = family === 'brutalist' ? 'translate-x-1' : 'bg-muted';
  const pressToken = family === 'brutalist' ? 'translate-y-1' : 'translate-y-px';
  await expect.poll(async () => (await linkPaint(first)).tokens).not.toContain(hoverToken);
  const baseline = await linkPaint(first);
  await capture('baseline', { observed: baseline });
  await first.hover();
  await expect.poll(async () => (await linkPaint(first)).tokens).toContain(hoverToken);
  if (family === 'shadcn')
    await expect
      .poll(async () => (await linkPaint(first)).background)
      .not.toBe(baseline.background);
  const hovered = await linkPaint(first);
  if (family === 'brutalist') {
    // Accepted #800 Button-like role: settle +4/+4 into its 4px shadow.
    expect(baseline.shadow).toContain('4px 4px 0px');
    expect(baseline.font).toContain('DM Sans');
    expect(baseline.weight).toBe('500');
    expect(hovered.transform).toBe('matrix(1, 0, 0, 1, 4, 4)');
    expect(hovered.tokens).toContain('shadow-none');
    expect(hovered.shadow).not.toBe(baseline.shadow);
    expect(hovered.background).toBe(baseline.background);
  }
  await capture('hover', { baseline, observed: hovered });
  for (const hit of hovered.edgeHits)
    expect(hit.hitIsAnchor, `${family} hovered ${hit.edge} paint must hit its native anchor`).toBe(
      true
    );

  await nativeActionLabel(page, `social-${family}-primary-down`);
  await page.mouse.down();
  try {
    await expect.poll(async () => (await linkPaint(first)).nativePressed).toBe(true);
    await expect.poll(async () => (await linkPaint(first)).tokens).toContain(pressToken);
  } catch (error) {
    await saveNativeTrace(page, `social-${family}-press-failure`, {
      family,
      observed: await linkPaint(first),
    });
    throw error;
  }
  const pressed = await linkPaint(first);
  expect(pressed.tokens).toContain('shadow-none');
  if (family === 'brutalist') {
    expect(pressed.transform).toBe(hovered.transform);
    expect(pressed.shadow).toBe(hovered.shadow);
  } else expect(pressed.transform).not.toBe(hovered.transform);
  await capture('pressed', { baseline: hovered, observed: pressed });
  for (const hit of pressed.edgeHits)
    expect(hit.hitIsAnchor, `${family} pressed ${hit.edge} paint must hit its native anchor`).toBe(
      true
    );
  // Release off the link: observe real pointer facts without navigating.
  await page.mouse.move(1400, 950);
  await page.mouse.up();
  await expect.poll(async () => (await linkPaint(first)).tokens).not.toContain(pressToken);
  await expect.poll(async () => (await linkPaint(first)).background).toBe(baseline.background);

  await first.focus();
  await page.keyboard.press('Tab');
  expect(await links.nth(1).evaluate((anchor) => anchor === document.activeElement)).toBe(true);
  const unfocused = await linkPaint(first);
  expect(unfocused.tokens).not.toContain('ring-2');
  await page.keyboard.press('Shift+Tab');
  await expect.poll(async () => (await linkPaint(first)).tokens).toContain('ring-2');
  const focused = await linkPaint(first);
  expect(focused.focused).toBe(true);
  expect(focused.tokens).toEqual(
    expect.arrayContaining(['ring-ring', 'ring-offset-2', 'ring-offset-background'])
  );
  expect(focused.ringWidth).toBe('2px');
  expect(focused.ringOffset).toBe('2px');
  expect(focused.ringColor).not.toMatch(/^(?:|transparent|rgba\(0, 0, 0, 0\))$/);
  expect(focused.shadow).not.toBe(unfocused.shadow);
  expect(focused.visibleTarget).toBe(true);
  expect(focused.unclipped).toBe(true);
  await capture('focus', { baseline: unfocused, observed: focused });
}

async function assertHostCurrentProjection(link: Locator, family: string) {
  const baseline = await linkPaint(link);
  if (family === 'brutalist') {
    expect(baseline.tokens).toContain('font-sans');
    expect(baseline.font).toContain('DM Sans');
  }
  const original = await link.getAttribute('aria-current');
  // Explicit host fixture, not a claim that route selection changed itself.
  await link.evaluate((anchor) => anchor.setAttribute('aria-current', 'page'));
  try {
    await expect.poll(async () => (await linkPaint(link)).tokens).toContain('underline');
    const current = await linkPaint(link);
    expect(current.tokens).toContain('font-semibold');
    expect(current.decoration).toContain('underline');
    expect(current.decoration).not.toBe(baseline.decoration);
    expect(Number(current.weight)).toBeGreaterThan(Number(baseline.weight));
  } finally {
    await link.evaluate((anchor, original) => {
      if (original === null) anchor.removeAttribute('aria-current');
      else anchor.setAttribute('aria-current', original);
    }, original);
  }
  await expect.poll(async () => (await linkPaint(link)).decoration).toBe(baseline.decoration);
  await expect.poll(async () => (await linkPaint(link)).weight).toBe(baseline.weight);
}

async function assertNavigationFocus(page: Page, link: Locator) {
  await link.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await link.focus();
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await linkPaint(link)).tokens).not.toContain('ring-2');
  const baseline = await linkPaint(link);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(async () => (await linkPaint(link)).tokens).toContain('ring-2');
  const observed = await linkPaint(link);
  expect(observed.focused).toBe(true);
  expect(observed.tokens).toEqual(
    expect.arrayContaining(['ring-ring', 'ring-offset-2', 'ring-offset-background'])
  );
  expect(observed.ringWidth).toBe('2px');
  expect(observed.ringOffset).toBe('2px');
  expect(observed.ringColor).not.toMatch(/^(?:|transparent|rgba\(0, 0, 0, 0\))$/);
  expect(observed.shadow).not.toBe(baseline.shadow);
  expect(observed.visibleTarget).toBe(true);
  expect(observed.unclipped).toBe(true);
  return { baseline, observed };
}

async function assertHeaderPopupSurface(
  page: Page,
  family: 'shadcn' | 'brutalist',
  runtime: string,
  homepage: boolean
) {
  const panel = page.locator('[data-site-header-panel]');
  await expect
    .poll(() => panel.getAttribute('data-header-surface-runtime'), { timeout: 10000 })
    .toBe(runtime);
  expect(await panel.locator('.site-header-popup-surface').count()).toBe(1);
  const paint = await panel.evaluate((panel) => {
    const surface = panel.querySelector<HTMLElement>('.site-header-popup-surface')!;
    const content = panel.querySelector('[data-site-header-panel-content]')!;
    const style = getComputedStyle(surface);
    const outer = getComputedStyle(panel);
    const bounds = surface.getBoundingClientRect();
    const value = document.createElement('span');
    value.style.cssText = 'position:absolute;visibility:hidden;width:var(--pui-radius-xl);height:0';
    value.style.setProperty('--pui-radius', style.getPropertyValue('--pui-radius'));
    value.style.setProperty('--pui-radius-xl', style.getPropertyValue('--pui-radius-xl'));
    document.body.append(value);
    const declaredShadcnRadius = parseFloat(getComputedStyle(value).width);
    value.remove();
    return {
      role: surface.getAttribute('role'),
      tabindex: surface.getAttribute('tabindex'),
      contentInside: surface.contains(content),
      prototype: surface.getAttribute('data-projection-prototype'),
      tokens: surface.getAttribute('data-pui-style'),
      runtime: (panel as HTMLElement).dataset.headerSurfaceRuntime,
      family: (panel as HTMLElement).dataset.headerSurfaceFamily,
      generation: (panel as HTMLElement).dataset.headerSurfaceGeneration,
      pageGeneration:
        document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtimeGeneration,
      width: bounds.width,
      height: bounds.height,
      right: bounds.right,
      left: bounds.left,
      radius: parseFloat(style.borderTopLeftRadius),
      declaredShadcnRadius,
      border: parseFloat(style.borderTopWidth),
      shadow: style.boxShadow,
      outerBorder: parseFloat(outer.borderTopWidth),
      outerShadow: outer.boxShadow,
      outerBackground: outer.backgroundColor,
      nestedNativeMenus: panel.querySelectorAll('[role="menu"], [role="dialog"]').length,
    };
  });
  await captureLinks(
    page,
    `${homepage ? 'home' : 'docs'}-${family}-${runtime}-menu-surface`,
    family,
    runtime,
    'open-native-disclosure; one-real-family-surface',
    paint
  );
  expect(paint.family).toBe(family);
  expect(paint.runtime).toBe(runtime);
  if (homepage) expect(paint.generation).toBe(paint.pageGeneration);
  expect(paint.prototype).toBe('site-preview-surface');
  expect(paint.contentInside).toBe(true);
  expect(paint.role).toBeNull();
  expect(paint.tabindex).toBeNull();
  expect(paint.nestedNativeMenus).toBe(0);
  expect(paint.width).toBeGreaterThan(200);
  expect(paint.height).toBeGreaterThan(44);
  expect(paint.left).toBeGreaterThanOrEqual(0);
  expect(paint.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(paint.outerBorder).toBe(0);
  expect(paint.outerShadow).toBe('none');
  expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(paint.outerBackground);
  expect(paint.border).toBe(family === 'brutalist' ? 2 : 1);
  // Popup role is flat in both app families; #800 Brutalist uses the 5px base radius.
  expect(paint.radius).toBe(family === 'brutalist' ? 5 : paint.declaredShadcnRadius);
  expect(paint.shadow).toBe('none');
}

describe.sequential('native links with app-owned Proto visual surfaces', () => {
  it('preserves real link targets and uniform social visuals through all runtime/family transitions', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await installNativeTrace(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc', 'shadcn');
      for (const family of ['brutalist', 'shadcn'] as const) {
        await choose(
          page,
          '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"]',
          family === 'brutalist' ? 'Brutalist' : 'Shadcn'
        );
        await page.waitForFunction((family) => {
          const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
          return root?.dataset.runtimeState === 'ready' && root.dataset.family === family;
        }, family);
        for (const runtime of RUNTIMES) {
          await choose(
            page,
            '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="runtime"]',
            labels[runtime]
          );
          await ready(page, runtime, family);
          await openSettings(page);
          // Each journey measures viewport hit targets. Earlier keyboard/focus
          // actions may scroll the document while the Header remains sticky.
          await page.evaluate(() => scrollTo(0, 0));
          const links = page.locator('#home-social [data-projection-generation-state="active"] a');
          await expect.poll(() => links.count()).toBe(4);
          const facts = await links.evaluateAll((anchors) =>
            anchors.map((anchor) => {
              const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
              const box = anchor.getBoundingClientRect();
              const visual = surface.getBoundingClientRect();
              const style = getComputedStyle(surface);
              return {
                name: anchor.getAttribute('aria-label'),
                href: anchor.getAttribute('href'),
                target: anchor.getAttribute('target'),
                rel: anchor.getAttribute('rel'),
                role: anchor.getAttribute('role'),
                tag: anchor.tagName,
                tabStops: anchor.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')
                  .length,
                anchorRect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                surfaceRect: {
                  left: visual.left,
                  top: visual.top,
                  right: visual.right,
                  bottom: visual.bottom,
                },
                width: visual.width,
                height: visual.height,
                border: style.borderTopWidth,
                radius: style.borderTopLeftRadius,
                shadow: style.boxShadow,
                nativeCoversSurface:
                  box.left <= visual.left + 0.5 &&
                  box.top <= visual.top + 0.5 &&
                  box.right >= visual.right - 0.5 &&
                  box.bottom >= visual.bottom - 0.5,
                topLeftHitInside:
                  anchor === document.elementFromPoint(visual.left + 3, visual.top + 3),
                centerHitIsAnchor:
                  anchor ===
                  document.elementFromPoint(
                    visual.left + visual.width / 2,
                    visual.top + visual.height / 2
                  ),
              };
            })
          );
          expect(facts.map((fact) => fact.name)).toEqual(['GitHub', 'Discord', 'X', 'Bluesky']);
          expect(
            new Set(
              facts.map((fact) => `${fact.width}/${fact.height}/${fact.border}/${fact.radius}`)
            ).size
          ).toBe(1);
          const expectedSocial = [
            { name: 'GitHub', href: socialDestinations.github },
            { name: 'Discord', href: socialDestinations.discord },
            { name: 'X', href: socialDestinations.x },
            { name: 'Bluesky', href: socialDestinations.bluesky },
          ];
          for (const [index, fact] of facts.entries()) {
            expect(
              nativeLinkEvidenceIssues(
                { ...fact, nestedFocus: fact.tabStops, cornerHitIsAnchor: fact.topLeftHitInside },
                { ...expectedSocial[index]!, target: '_blank', rel: 'noreferrer' }
              )
            ).toEqual([]);
            expect(fact.tag).toBe('A');
            expect(fact.role).toBeNull();
            expect(fact.target).toBe('_blank');
            expect(fact.rel).toBe('noreferrer');
            expect(fact.href).toMatch(/^https:\/\//);
            expect(fact.tabStops).toBe(0);
            expect(fact.width).toBeGreaterThanOrEqual(44);
            expect(fact.height).toBeGreaterThanOrEqual(44);
            expect(fact.nativeCoversSurface).toBe(true);
            expect(fact.topLeftHitInside).toBe(true);
            expect(fact.centerHitIsAnchor).toBe(true);
            if (family === 'brutalist') {
              expect(fact.border).toBe('2px');
              expect(fact.radius).toBe('5px');
              expect(fact.shadow).toContain('4px 4px 0px');
            }
          }
          const footprints = await page
            .locator(
              '[data-homepage-actions] [data-projection-generation-state="active"] a:visible'
            )
            .evaluateAll((anchors) =>
              anchors.map((anchor) => {
                const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
                const visual = surface.getBoundingClientRect();
                const native = anchor.getBoundingClientRect();
                const group = anchor.closest('[data-homepage-actions]')!;
                // owner-bounded-start: use direct generation children, not an ancestor selector.
                const mount = Array.from(group.children).find((node) =>
                  node.hasAttribute('data-homepage-mount')
                );
                if (!mount) throw new Error('Native action group mount is missing');
                const generations = Array.from(mount.children).filter(
                  (node) => node.getAttribute('data-projection-generation-state') === 'active'
                );
                if (generations.length !== 1)
                  throw new Error('Native action group requires exactly one active generation');
                if (!(anchor instanceof HTMLAnchorElement))
                  throw new Error('Expected a native anchor in its navigation owner');
                const index = Array.from(generations[0].querySelectorAll('a')).indexOf(anchor);
                const source = group
                  .querySelector('[data-homepage-fallback]')
                  ?.querySelectorAll('a')[index];
                if (index < 0 || !source)
                  throw new Error('Native anchor has no source in its own action group');
                // owner-bounded-end
                const identity = (link: Element) => ({
                  href: link.getAttribute('href'),
                  name: link.getAttribute('aria-label') ?? link.textContent?.trim() ?? null,
                  target: link.getAttribute('target'),
                  rel: link.getAttribute('rel'),
                });
                const describe = (element: Element | null) => {
                  if (!element) return null;
                  const rect = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  return {
                    tag: element.tagName,
                    id: element.id,
                    class: element.getAttribute('class'),
                    html: element.outerHTML.slice(0, 800),
                    rect: {
                      left: rect.left,
                      top: rect.top,
                      right: rect.right,
                      bottom: rect.bottom,
                    },
                    pointerEvents: style.pointerEvents,
                    position: style.position,
                    zIndex: style.zIndex,
                    transform: style.transform,
                    visibility: style.visibility,
                  };
                };
                const hit = (x: number, y: number) => {
                  const target = document.elementFromPoint(x, y);
                  return {
                    x,
                    y,
                    isAnchor: target === anchor,
                    insideViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
                    target: describe(target),
                    stack: document.elementsFromPoint(x, y).slice(0, 6).map(describe),
                  };
                };
                const centerHit = hit(
                  visual.left + visual.width / 2,
                  visual.top + visual.height / 2
                );
                const cornerHit = hit(visual.left + 3, visual.top + 3);
                return {
                  ...identity(anchor),
                  expected: identity(source),
                  tag: anchor.tagName,
                  role: anchor.getAttribute('role'),
                  centerHitIsAnchor: centerHit.isAnchor,
                  cornerHitIsAnchor: cornerHit.isAnchor,
                  hitDiagnostics: {
                    centerHit,
                    cornerHit,
                    anchor: describe(anchor),
                    surface: describe(surface),
                    documentX: scrollX,
                    documentY: scrollY,
                    viewport: { width: innerWidth, height: innerHeight },
                  },
                  anchorRect: {
                    left: native.left,
                    top: native.top,
                    right: native.right,
                    bottom: native.bottom,
                  },
                  surfaceRect: {
                    left: visual.left,
                    top: visual.top,
                    right: visual.right,
                    bottom: visual.bottom,
                  },
                  nestedFocus: anchor.querySelectorAll(
                    'a[href],button,input,select,textarea,[tabindex]'
                  ).length,
                };
              })
            );
          // Persist the actual hit node/stack and both rectangles before a
          // strict assertion can fail; descendant or overlaid hits remain red.
          await captureLinks(
            page,
            `homepage-${family}-${runtime}-native-hit-targets`,
            family,
            runtime,
            'menu-open; exact-native-anchor-hit-samples',
            { social: facts, footprints }
          );
          expect(footprints.length).toBeGreaterThan(4);
          for (const footprint of footprints)
            expect(
              nativeLinkEvidenceIssues(footprint, footprint.expected),
              String(footprint.name)
            ).toEqual([]);
          await assertHeaderPopupSurface(page, family, runtime, true);
          for (const direction of ['ltr', 'rtl'] as const) {
            await page.evaluate((direction) => {
              document.documentElement.dir = direction;
            }, direction);
            // Reopen from the actual command so its anchor is measured after
            // host direction changes; do not inject panel geometry in evidence.
            const menu = page.locator(
              '[data-homepage-menu-label] [role="button"], [data-site-menu-button]'
            );
            if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
            await openSettings(page);
            await assertSocialPaint(page, links, family, async (state, evidence) => {
              await captureLinks(
                page,
                `homepage-${family}-${runtime}-${direction}-${state}`,
                family,
                runtime,
                `menu-open; actual-${direction}-social-${state}`,
                evidence
              );
            });
          }
          await page.evaluate(() => {
            document.documentElement.dir = 'ltr';
          });
          await assertHostCurrentProjection(
            page
              .locator('#home-navigation-desktop [data-projection-generation-state="active"] a')
              .first(),
            family
          );
          expect(
            (
              await linkPaint(
                page
                  .locator('#homepage-whitepaper [data-projection-generation-state="active"] a')
                  .first()
              )
            ).whiteSpace
          ).toBe('normal');
          await page.keyboard.press('Escape');
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await saveNativeTrace(page, 'homepage-native-paint-final');
      await context.close();
    }
  }, 150_000);

  it('keeps Enter/new-tab/modifier/middle/context-menu semantics native and does not activate on Space', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    // Isolate browser navigation semantics from availability of the external site.
    await context.route('https://github.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>External link fixture</title>' })
    );
    const page = await context.newPage();
    await installNativeTrace(page);
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc', 'shadcn');
      await openSettings(page);
      const link = page.locator(
        '#home-social [data-projection-generation-state="active"] a[aria-label="GitHub"]'
      );
      const href = (await link.getAttribute('href'))!;
      // Plain-native controls distinguish a broken browser/popup fixture from
      // the application bridge. This page is not claimed as product UI.
      const controlPage = await context.newPage();
      await controlPage.setContent(
        '<a id="native-control" target="_blank" rel="noreferrer">Native navigation control</a>'
      );
      await installNativeTrace(controlPage, true);
      const control = controlPage.locator('#native-control');
      await control.evaluate((anchor, href) => anchor.setAttribute('href', href), href);
      try {
        await nativeActionLabel(controlPage, 'plain-native:cancel-negative-control');
        await control.evaluate((anchor) =>
          anchor.addEventListener('click', (event) => event.preventDefault(), { once: true })
        );
        const count = context.pages().length;
        await control.click({ modifiers: ['Control'] });
        const cancelled = await saveNativeTrace(controlPage, 'plain-native-negative-control');
        expect(cancelled.filter((event) => event.type === 'click').at(-1)).toMatchObject({
          trusted: true,
          preventedAfterDispatch: true,
        });
        expect(context.pages()).toHaveLength(count);
        for (const action of ['modifier', 'middle', 'enter'] as const)
          await nativePopup(controlPage, control, action, 'plain-native');
        await saveNativeTrace(controlPage, 'plain-native-positive-controls');
      } finally {
        await controlPage.close();
      }
      await page.bringToFront();
      await openSettings(page);
      for (const action of ['modifier', 'middle', 'enter'] as const) {
        // Successful native navigation intentionally dismisses its parent menu.
        await page.bringToFront();
        await openSettings(page);
        await nativePopup(page, link, action, 'homepage-social');
      }
      await page.bringToFront();
      await openSettings(page);
      const location = page.url();
      await link.focus();
      await page.keyboard.press('Space');
      // Store the actual Event during capture, then inspect it in a new
      // evaluate task after right-click dispatch has returned. A capture-phase
      // microtask can run before native target/bubble handlers finish.
      for (const cancelAtTarget of [true, false]) {
        await link.evaluate((anchor, cancelAtTarget) => {
          const observed = anchor as HTMLElement & { __testContextMenuEvent?: Event };
          delete observed.__testContextMenuEvent;
          document.addEventListener(
            'contextmenu',
            (event) => {
              observed.__testContextMenuEvent = event;
            },
            { capture: true, once: true }
          );
          if (cancelAtTarget)
            anchor.addEventListener('contextmenu', (event) => event.preventDefault(), {
              once: true,
            });
        }, cancelAtTarget);
        await link.click({ button: 'right' });
        const observed = await link.evaluate((anchor) => {
          const event = (anchor as HTMLElement & { __testContextMenuEvent?: Event })
            .__testContextMenuEvent;
          return { prevented: event?.defaultPrevented, trusted: event?.isTrusted };
        });
        // The negative control must catch a later target listener's cancel.
        expect(observed.prevented).toBe(cancelAtTarget);
        expect(observed.trusted).toBe(true);
      }
      expect(page.url()).toBe(location);
      expect(context.pages()).toHaveLength(1);
      expect(await link.getAttribute('role')).toBeNull();
    } finally {
      await saveNativeTrace(page, 'homepage-native-navigation-final');
      await context.close();
    }
  }, 90_000);

  it('records the documentation menu with four same-family social links and native focus', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/button/'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: family === 'brutalist' ? 'dark' : 'light',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        await page
          .locator('a[data-site-native-link][aria-label="GitHub"] wc-site-link-surface')
          .waitFor({ state: 'attached' });
        await openSettings(page);
        await assertHeaderPopupSurface(page, family, 'wc', false);
        const links = page.locator('.site-social-links a[data-site-native-link]');
        expect(await links.count()).toBe(4);
        await assertSocialPaint(page, links, family, async (state, evidence) => {
          await captureLinks(
            page,
            `docs-${family}-${state}`,
            family,
            'wc',
            `menu-open; four-social-group; first-social-${state}`,
            evidence
          );
        });
        await assertHostCurrentProjection(
          page.locator('[data-site-header-desktop-navigation] a').first(),
          family
        );
      } finally {
        await context.close();
      }
    }
  }, 90_000);

  it('keeps all social destinations available without JavaScript', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      const links = page.locator('#home-social a');
      expect(await links.count()).toBe(4);
      for (let index = 0; index < 4; index++) {
        expect(await links.nth(index).isVisible()).toBe(true);
        expect(await links.nth(index).getAttribute('href')).toMatch(/^https:\/\//);
      }
    } finally {
      await context.close();
    }
  }, 60_000);

  it('renders docs navigation through the same Prototype while preserving native targets and caption projection', async () => {
    for (const [family, route, colorScheme] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/', 'light'],
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/', 'dark'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/', 'light'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/', 'dark'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme,
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const selected = page
          .locator('.sidebar-pane a[aria-current="page"][data-site-link-enhanced]')
          .first();
        await selected.waitFor({ state: 'visible' });
        expect((await linkPaint(selected)).tokens).toContain(
          family === 'brutalist' ? 'bg-main' : 'bg-accent'
        );
        const sidebar = page
          .locator('.sidebar-pane a[data-site-link-enhanced]:not([aria-current="page"]):visible')
          .first();
        const baseline = await linkPaint(sidebar);
        await sidebar.hover();
        await expect
          .poll(async () => (await linkPaint(sidebar)).background)
          .not.toBe(baseline.background);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-sidebar-hover`,
          family,
          'wc',
          'native-sidebar-hover; real-current-route',
          { baseline, observed: await linkPaint(sidebar) }
        );
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-sidebar-focus`,
          family,
          'wc',
          'native-sidebar-keyboard-focus',
          await assertNavigationFocus(page, sidebar)
        );

        const brand = page.locator('.site-header a[data-site-link-appearance="brand"]').first();
        expect(await brand.getAttribute('role')).toBeNull();
        expect(await brand.locator('[data-pui-root]').count()).toBe(1);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-brand-focus`,
          family,
          'wc',
          'native-brand-keyboard-focus',
          await assertNavigationFocus(page, brand)
        );
        const toc = page.locator('sl-toc a[data-site-link-appearance="toc"]').nth(1);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-toc-focus`,
          family,
          'wc',
          'native-toc-keyboard-focus',
          await assertNavigationFocus(page, toc)
        );
        const hash = await toc.getAttribute('href');
        await toc.click();
        expect(new URL(page.url()).hash).toBe(new URL(hash!, page.url()).hash);
        await expect.poll(() => toc.getAttribute('in-view')).not.toBeNull();
        await expect
          .poll(async () => (await linkPaint(toc)).tokens)
          .toContain(family === 'brutalist' ? 'bg-main' : 'bg-accent');
        expect(await page.locator('sl-toc > div[aria-hidden]').count()).toBe(0);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-toc-current`,
          family,
          'wc',
          'native-toc-anchor-navigation; observed-in-view',
          { observed: await linkPaint(toc) }
        );

        const pagination = page
          .locator('.pagination-links a[data-site-link-appearance="pagination"]')
          .first();
        await pagination.scrollIntoViewIfNeeded();
        const caption = (await pagination
          .locator('[data-site-pagination-caption]')
          .textContent())!.trim();
        const title = (await pagination.locator('.link-title').textContent())!.trim();
        const accessible = await pagination.ariaSnapshot();
        expect(accessible).toContain(caption);
        expect(accessible).toContain(title);
        const geometry = await pagination.evaluate((anchor) => {
          const root = getComputedStyle(anchor);
          const title = anchor.querySelector<HTMLElement>('.link-title')!;
          const caption = anchor.querySelector<HTMLElement>('[data-site-pagination-caption]')!;
          const rect = title.getBoundingClientRect();
          return {
            titleFont: parseFloat(getComputedStyle(title).fontSize),
            titleWidth: rect.width,
            titleHeight: rect.height,
            captionWidth: caption.getBoundingClientRect().width,
            background: root.backgroundColor,
            border: root.borderTopWidth,
            shadow: root.boxShadow,
            directChild: title.parentElement?.parentElement === anchor.firstElementChild,
            nativeNameOnly:
              anchor.getAttribute('role') === null && !anchor.querySelector('a,button,[tabindex]'),
          };
        });
        expect(geometry.titleFont).toBeGreaterThan(0);
        expect(geometry.titleWidth).toBeGreaterThan(0);
        expect(geometry.titleHeight).toBeGreaterThan(0);
        expect(geometry.captionWidth).toBe(1);
        expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
        expect(geometry.border).toBe('0px');
        expect(geometry.shadow).toBe('none');
        expect(geometry.directChild).toBe(true);
        expect(geometry.nativeNameOnly).toBe(true);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-pagination`,
          family,
          'wc',
          'native-pagination-visible-title-preserved-name',
          { geometry, observed: await linkPaint(pagination) }
        );
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-pagination-focus`,
          family,
          'wc',
          'native-pagination-keyboard-focus',
          await assertNavigationFocus(page, pagination)
        );
        const destination = new URL((await pagination.getAttribute('href'))!, page.url()).href;
        await Promise.all([page.waitForURL(destination), pagination.click()]);
        expect(page.url()).toBe(destination);
      } finally {
        await context.close();
      }
    }
  }, 240_000);

  it('opens the actual narrow-screen contents drawer and keeps long pagination labels within the page', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const contents = page.locator(
          '.site-header-docs-navigation [data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
        );
        const pane = page.locator('#starlight__sidebar');
        expect(await pane.isVisible()).toBe(false);
        await contents.click();
        await expect.poll(() => contents.getAttribute('aria-expanded')).toBe('true');
        await pane.waitFor({ state: 'visible' });
        const sidebar = pane
          .locator('a[data-site-link-enhanced]:not([aria-current="page"]):visible')
          .first();
        const focus = await assertNavigationFocus(page, sidebar);
        expect(
          await sidebar
            .locator('[data-pui-root]')
            .evaluate((surface) => surface.getBoundingClientRect().height)
        ).toBeGreaterThanOrEqual(44);
        await captureLinks(
          page,
          `nav-${family}-narrow-sidebar-focus`,
          family,
          'wc',
          '390px; actual-contents-drawer-open; keyboard-focus',
          focus
        );
        const beforeHover = await linkPaint(sidebar);
        await sidebar.hover();
        await expect
          .poll(async () => (await linkPaint(sidebar)).background)
          .not.toBe(beforeHover.background);
        await captureLinks(
          page,
          `nav-${family}-narrow-sidebar-hover`,
          family,
          'wc',
          '390px; actual-contents-drawer-open; native-pointer-hover',
          { baseline: beforeHover, observed: await linkPaint(sidebar) }
        );
        await page.keyboard.press('Escape');
        await expect.poll(() => contents.getAttribute('aria-expanded')).toBe('false');
        expect(await pane.isVisible()).toBe(false);
        // This site has a desktop-only TOC; do not force it visible or claim a
        // nonexistent mobile TOC interaction. The heading targets still exist.
        expect(await page.locator('sl-toc').count()).toBeGreaterThan(0);
        expect(await page.locator('sl-toc:visible').count()).toBe(0);
        const tocTarget = await page.locator('sl-toc a').nth(1).getAttribute('href');
        expect(
          await page
            .locator(`[id=${JSON.stringify(decodeURIComponent(tocTarget!.slice(1)))}]`)
            .count()
        ).toBe(1);

        const pagination = page.locator('.pagination-links a[data-site-link-enhanced]').first();
        const title = pagination.locator('.link-title');
        const originalTitle = await title.textContent();
        const fixtureTitle =
          '窄屏长标题换行检查 / A long public navigation title with multiple words '.repeat(4);
        // Deliberate content stress fixture; captures identify it as injected,
        // not as the page's real editorial title.
        await title.evaluate((node, text) => {
          node.textContent = text;
        }, fixtureTitle);
        await pagination.scrollIntoViewIfNeeded();
        const layout = await pagination.evaluate((anchor) => {
          const title = anchor.querySelector('.link-title')!.getBoundingClientRect();
          const link = anchor.getBoundingClientRect();
          return {
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            titleLeft: title.left,
            titleRight: title.right,
            linkLeft: link.left,
            linkRight: link.right,
            titleHeight: title.height,
            caption: anchor.querySelector('[data-site-pagination-caption]')?.textContent,
          };
        });
        expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.titleLeft).toBeGreaterThanOrEqual(layout.linkLeft - 0.5);
        expect(layout.titleRight).toBeLessThanOrEqual(layout.linkRight + 0.5);
        expect(layout.titleHeight).toBeGreaterThan(20);
        expect(await pagination.ariaSnapshot()).toContain(layout.caption!.trim());
        await captureLinks(
          page,
          `nav-${family}-narrow-long-pagination`,
          family,
          'wc',
          '390px; injected-long-title-stress-fixture',
          { layout, originalTitle, fixtureTitle }
        );
        await title.evaluate((node, text) => {
          node.textContent = text;
        }, originalTitle);
        await captureLinks(
          page,
          `nav-${family}-narrow-pagination-focus`,
          family,
          'wc',
          '390px; original-title-restored; keyboard-focus',
          await assertNavigationFocus(page, pagination)
        );
      } finally {
        await context.close();
      }
    }
  }, 150_000);

  it('keeps docs native destinations, current truth, heading navigation and keyboard focus without JavaScript', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
    ] as const) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const targets = [
          ['brand', '.site-header a[data-site-link-appearance="brand"]'],
          ['sidebar', '.sidebar-pane a[aria-current="page"]'],
          ['toc', 'sl-toc a'],
          ['pagination', '.pagination-links a'],
        ] as const;
        for (const [role, selector] of targets) {
          const link = page.locator(selector).first();
          expect(await link.getAttribute('href')).toBeTruthy();
          expect(await link.getAttribute('data-site-link-enhanced')).toBeNull();
          expect(await link.getAttribute('role')).toBeNull();
          expect(await link.locator('[data-pui-root],button,[tabindex]').count()).toBe(0);
          await link.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await link.focus();
          await page.keyboard.press('Tab');
          const read = () =>
            link.evaluate((anchor) => {
              const style = getComputedStyle(anchor);
              const box = anchor.getBoundingClientRect();
              return {
                outline: style.outline,
                outlineOffset: style.outlineOffset,
                shadow: style.boxShadow,
                current: anchor.getAttribute('aria-current'),
                rect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                focused: anchor === document.activeElement && anchor.matches(':focus-visible'),
                nativePressed: anchor.matches(':active'),
                visible: anchor.contains(
                  document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
                ),
              };
            });
          await expect.poll(async () => (await read()).focused).toBe(false);
          const baseline = await read();
          await page.keyboard.press('Shift+Tab');
          let focusPassed = false;
          try {
            await expect
              .poll(
                async () => {
                  const observed = await read();
                  return (
                    observed.focused &&
                    observed.visible &&
                    (observed.outline !== baseline.outline || observed.shadow !== baseline.shadow)
                  );
                },
                { timeout: 10_000 }
              )
              .toBe(true);
            focusPassed = true;
          } finally {
            await captureLinks(
              page,
              `nav-${family}-no-js-${role}-focus${focusPassed ? '' : '-failure'}`,
              family,
              'native-no-js',
              `no-JavaScript; native-${role}-keyboard-focus; ${focusPassed ? 'passed' : 'failed'}`,
              { baseline, observed: await read() }
            );
          }
        }
        const current = page.locator('.sidebar-pane a[aria-current="page"]').first();
        expect(new URL((await current.getAttribute('href'))!, page.url()).pathname).toBe(
          new URL(page.url()).pathname
        );
        const toc = page.locator('sl-toc a').nth(1);
        const href = (await toc.getAttribute('href'))!;
        const heading = page.locator(`[id=${JSON.stringify(decodeURIComponent(href.slice(1)))}]`);
        expect(await heading.count()).toBe(1);
        await toc.click();
        expect(new URL(page.url()).hash).toBe(new URL(href, page.url()).hash);
        await expect
          .poll(() =>
            heading.evaluate((node) => {
              const box = node.getBoundingClientRect();
              return box.top < innerHeight && box.bottom > 0;
            })
          )
          .toBe(true);
        expect(await toc.getAttribute('in-view')).toBeNull();
        const pagination = page.locator('.pagination-links a').first();
        expect(['prev', 'next']).toContain(await pagination.getAttribute('rel'));
        const destination = new URL((await pagination.getAttribute('href'))!, page.url()).href;
        await Promise.all([page.waitForURL(destination), pagination.click()]);
        expect(page.url()).toBe(destination);
      } finally {
        await context.close();
      }
    }
  }, 150_000);
  it('reveals the current article in only the sidebar scroll owner and yields to manual scrolling', async () => {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/zh-cn/contribute/automation/`, { waitUntil: 'networkidle' });
        const sidebar = page.locator('.docs-sidebar');
        const current = sidebar.locator('.top-level a[aria-current="page"]');
        expect(await current.count()).toBe(1);
        expect(await current.getAttribute('href')).toContain('/contribute/automation/');
        if (width < 1024)
          await page
            .locator(
              '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
            )
            .click();
        const facts = () =>
          current.evaluate((link) => {
            const boundary = link.closest<HTMLElement>('.docs-sidebar')!;
            let owner: HTMLElement | null = null;
            for (
              let node = link.parentElement;
              node && boundary.contains(node);
              node = node.parentElement
            ) {
              if (
                node.clientHeight > 0 &&
                node.scrollHeight > node.clientHeight &&
                /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)
              ) {
                owner = node;
                break;
              }
              if (node === boundary) break;
            }
            if (!owner) return { visible: false, reason: 'missing sidebar owner' };
            const row = link.getBoundingClientRect(),
              box = owner.getBoundingClientRect();
            const top = box.top + owner.clientTop;
            return {
              visible:
                row.width > 0 &&
                row.height > 0 &&
                row.top >= top - 1 &&
                row.bottom <= top + owner.clientHeight + 1,
              owner: owner.className,
              scrollTop: owner.scrollTop,
              documentY: scrollY,
              linkTop: row.top,
              linkBottom: row.bottom,
              viewportTop: top,
              viewportHeight: owner.clientHeight,
              ownerBottom: box.bottom,
              documentViewportHeight: innerHeight,
              documentScrollHeight: document.documentElement.scrollHeight,
              projected: link.getAttribute('data-site-link-enhanced'),
              focus: document.activeElement?.outerHTML.slice(0, 300),
            };
          });
        await expect.poll(async () => (await facts()).visible, { timeout: 10_000 }).toBe(true);
        expect((await facts()).documentY).toBe(0);
        const before = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}`,
          'shadcn',
          'wc',
          'current-article-revealed',
          before
        );
        expect(
          before.ownerBottom,
          'sidebar owner must fit inside the document viewport'
        ).toBeLessThanOrEqual(before.documentViewportHeight!);
        const pointer = await current.evaluate((link) => {
          const row = link.getBoundingClientRect();
          const left = Math.max(0, row.left),
            right = Math.min(innerWidth, row.right);
          const top = Math.max(0, row.top),
            bottom = Math.min(innerHeight, row.bottom);
          if (right <= left || bottom <= top)
            throw new Error('Current article has no visible pointer target');
          const x = (left + right) / 2,
            y = (top + bottom) / 2;
          const target = document.elementFromPoint(x, y);
          return {
            x,
            y,
            hitIsCurrent: target === link,
            hit: target?.outerHTML.slice(0, 500) ?? null,
          };
        });
        expect(pointer.hitIsCurrent, 'actual visible native current-article target').toBe(true);
        // locator.hover() first scrolls all ancestors to expose the entire row.
        // Use a measured visible point so this test's wheel is the only scroll request.
        await page.mouse.move(pointer.x, pointer.y);
        const beforeWheel = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-pointer`,
          'shadcn',
          'wc',
          'native-pointer-move; no-scrollIntoView',
          { before, pointer, beforeWheel }
        );
        expect(beforeWheel.documentY, 'pointer must not move document scroll').toBe(
          before.documentY
        );
        expect(beforeWheel.scrollTop, 'pointer must not move sidebar scroll').toBe(
          before.scrollTop
        );
        await page.mouse.wheel(0, -400);
        // Observe the actual scroll event rather than guessing a fixed delay.
        await expect
          .poll(async () => (await facts()).scrollTop)
          .toBeLessThan(beforeWheel.scrollTop!);
        await current.evaluate(async (link) => {
          const boundary = link.closest<HTMLElement>('.docs-sidebar')!;
          let owner = link.parentElement!;
          while (
            boundary.contains(owner) &&
            !(
              owner.clientHeight > 0 &&
              owner.scrollHeight > owner.clientHeight &&
              /^(auto|scroll|overlay)$/.test(getComputedStyle(owner).overflowY)
            )
          ) {
            if (owner === boundary || !owner.parentElement)
              throw new Error('Missing actual scroll owner');
            owner = owner.parentElement;
          }
          let previous = owner.scrollTop,
            stable = 0;
          for (let frame = 0; frame < 60; frame++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const next = owner.scrollTop;
            stable = next === previous ? stable + 1 : 0;
            previous = next;
            if (stable >= 2) return;
          }
          throw new Error('Manual scrolling did not settle');
        });
        const manuallyScrolled = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-wheel`,
          'shadcn',
          'wc',
          'native-wheel-settled; owner-and-document-deltas',
          { beforeWheel, manuallyScrolled }
        );
        expect(manuallyScrolled.owner, 'wheel preserves the actual sidebar scroll owner').toBe(
          beforeWheel.owner
        );
        expect(manuallyScrolled.documentY, 'sidebar wheel must not scroll the document').toBe(
          beforeWheel.documentY
        );
        await current.evaluate((link) => {
          // A delayed projection/font-sized geometry mutation must not revoke manual ownership.
          link.style.paddingBlock = '16px';
          link.setAttribute('data-site-link-enhanced', 'true');
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        const afterMutation = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-mutation`,
          'shadcn',
          'wc',
          'injected-late-geometry; manual-scroll-ownership-retained',
          { manuallyScrolled, afterMutation }
        );
        expect(afterMutation.owner, 'late geometry retains the sidebar scroll owner').toBe(
          manuallyScrolled.owner
        );
        expect(afterMutation.scrollTop, 'late geometry must not recenter the sidebar').toBe(
          manuallyScrolled.scrollTop
        );
        expect(afterMutation.documentY, 'late geometry must not scroll the document').toBe(
          manuallyScrolled.documentY
        );
        await page.reload({ waitUntil: 'networkidle' });
        if (width < 1024)
          await page
            .locator(
              '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
            )
            .click();
        await expect.poll(async () => (await facts()).visible, { timeout: 10_000 }).toBe(true);
        await captureLinks(
          page,
          `sidebar-current-${width}-reload`,
          'shadcn',
          'wc',
          'current-article-after-reload',
          await facts()
        );
      } finally {
        await context.close();
      }
    }
  }, 180_000);
});
