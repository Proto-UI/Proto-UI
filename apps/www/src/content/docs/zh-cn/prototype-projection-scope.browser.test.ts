// @vitest-environment node

import type { Browser, ElementHandle, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  startServer,
  stopServer,
} from './browser-harness';

const HOME_ROUTE = '/zh-cn/';
const PROJECTION_FAMILIES = ['shadcn', 'brutalist'] as const;
// The approved homepage displays directly usable prototype compositions in one
// coordinated content slot. Every declared gallery part must survive each
// Runtime/family transaction. The wrapper marker cannot substitute for the
// actual controls or for projected portal content.
const TASK_ID = 'website-component-gallery';
const EXPECTED_TASK_PROTOTYPES = {
  shadcn: {
    select: 'shadcn-select-root',
    trigger: 'shadcn-select-trigger',
    value: 'shadcn-select-value',
    content: 'shadcn-select-content',
    item: 'shadcn-select-item',
    switch: 'shadcn-switch-root',
    thumb: 'shadcn-switch-thumb',
    textarea: 'shadcn-textarea-root',
    button: 'shadcn-button',
  },
  brutalist: {
    select: 'brutalist-select-root',
    trigger: 'brutalist-select-trigger',
    value: 'brutalist-select-value',
    content: 'brutalist-select-content',
    item: 'brutalist-select-item',
    switch: 'brutalist-switch-root',
    thumb: 'brutalist-switch-thumb',
    textarea: 'brutalist-textarea-root',
    button: 'brutalist-button',
  },
} as const;
const GALLERY_PART_COUNTS = {
  'button': 11,
  'separator-root': 2,
  'toggle': 4,
  'checkbox-root': 4,
  'checkbox-indicator': 4,
  'switch-root': 2,
  'switch-thumb': 2,
  'hover-card-root': 1,
  'hover-card-trigger': 1,
  'hover-card-content': 1,
  'select-root': 1,
  'select-trigger': 1,
  'select-value': 1,
  'select-content': 1,
  'select-item': 3,
  'textarea-root': 2,
  'tabs-root': 1,
  'tabs-list': 1,
  'tabs-trigger': 2,
  'tabs-content': 2,
  'dialog-root': 1,
  'dialog-trigger': 1,
  'dialog-mask': 1,
  'dialog-content': 1,
  'dialog-header': 1,
  'dialog-title': 1,
  'dialog-description': 1,
  'dialog-footer': 1,
  'dialog-close': 2,
  'dialog-close-icon': 1,
  'dropdown-root': 1,
  'dropdown-trigger': 1,
  'dropdown-content': 1,
  'dropdown-item': 2,
} as const;
const TASK_PART_REFS = {
  'settings-view': 'select',
  'settings-view-trigger': 'trigger',
  'settings-summary': 'switch',
  'settings-note': 'textarea',
  'settings-save': 'button',
  'settings-reset': 'button',
} as const;
const THEME_TOKEN_NAMES = [
  '--pui-background',
  '--pui-foreground',
  '--pui-border',
  '--pui-popover',
  '--pui-popover-foreground',
] as const;
const CONTROL_OPTION_LABELS = {
  runtime: {
    wc: 'Web Components',
    react: 'React',
    vue: 'Vue',
    vue2: 'Vue 2',
  },
  family: {
    shadcn: 'Shadcn',
    brutalist: 'Brutalist',
  },
} as const;

type ProjectionFamilyId = (typeof PROJECTION_FAMILIES)[number];

type ProjectionCoordinate = Readonly<{
  runtimeId: string;
  projectionFamilyId: string;
  generation: string;
  state: string;
}>;

type PortalSealSample = Readonly<{
  connected: boolean;
  inert: boolean;
  ariaHidden: string | null;
  visibility: string;
  pointerEvents: string;
}>;

type ProgrammaticProjectionSwitch =
  | Readonly<{ control: 'family'; value: ProjectionFamilyId }>
  | Readonly<{ control: 'runtime'; value: string }>;

function attributeEquals(name: string, value: string): string {
  return `[${name}=${JSON.stringify(value)}]`;
}

async function projectionScope(page: Page): Promise<Locator> {
  const scopes = page.locator(
    '[data-home-demo-host] [data-projection-generation-state="active"] [data-projection-scope]'
  );
  await scopes.first().waitFor({ state: 'attached', timeout: 15_000 });
  expect(await scopes.count(), 'one active live-example participant scope').toBe(1);

  const scope = scopes.first();
  expect(
    await scope.getAttribute('data-projection-scope'),
    'stable projection-scope owner id'
  ).toBeTruthy();
  return scope;
}

async function readCoordinate(surface: Locator, label: string): Promise<ProjectionCoordinate> {
  const coordinate = await surface.evaluate((element) => ({
    runtimeId: element.getAttribute('data-projection-runtime') ?? '',
    projectionFamilyId: element.getAttribute('data-projection-family') ?? '',
    generation: element.getAttribute('data-projection-generation') ?? '',
    state: element.getAttribute('data-projection-state') ?? '',
  }));

  expect(coordinate.runtimeId, `${label} runtime`).not.toBe('');
  expect(coordinate.projectionFamilyId, `${label} projection family`).not.toBe('');
  expect(coordinate.generation, `${label} generation`).not.toBe('');
  return coordinate;
}

async function waitForAnyReady(scope: Locator): Promise<ProjectionCoordinate> {
  await expect
    .poll(
      async () => {
        const coordinate = await readCoordinate(scope, 'projection scope');
        return coordinate.state;
      },
      { timeout: 30_000 }
    )
    .toBe('ready');
  return readCoordinate(scope, 'projection scope');
}

async function waitForReady(
  scope: Locator,
  runtimeId: string,
  projectionFamilyId: ProjectionFamilyId
): Promise<ProjectionCoordinate> {
  await expect
    .poll(
      async () => {
        const coordinate = await readCoordinate(scope, 'projection scope');
        return {
          runtimeId: coordinate.runtimeId,
          projectionFamilyId: coordinate.projectionFamilyId,
          state: coordinate.state,
        };
      },
      { timeout: 30_000 }
    )
    .toEqual({ runtimeId, projectionFamilyId, state: 'ready' });
  return readCoordinate(scope, 'projection scope');
}

async function portalControlledBy(page: Page, trigger: Locator): Promise<Locator> {
  const controlledId = await trigger.getAttribute('aria-controls');
  expect(controlledId, 'combobox aria-controls').toBeTruthy();

  const portal = page.locator(attributeEquals('id', controlledId!));
  await portal.waitFor({ state: 'visible', timeout: 10_000 });
  expect(await portal.count(), `one portal controlled by #${controlledId}`).toBe(1);
  return portal;
}

async function startPortalSealProbe(
  portal: Locator,
  action: ProgrammaticProjectionSwitch
): Promise<Readonly<{ handle: ElementHandle<HTMLElement>; immediate: PortalSealSample }>> {
  const candidateHandle = await portal.elementHandle();
  if (!candidateHandle) throw new Error('Projection portal handle is missing.');
  const isHtmlElement = await candidateHandle.evaluate((element) => element instanceof HTMLElement);
  if (!isHtmlElement) throw new Error('Projection portal root must be an HTMLElement.');
  const handle = candidateHandle as ElementHandle<HTMLElement>;
  const immediate = await handle.evaluate((element, switchAction) => {
    type Probe = { running: boolean; samples: PortalSealSample[] };
    type ProbeWindow = Window & { __puiProjectionPortalProbe?: Probe };
    const view = element.ownerDocument.defaultView as ProbeWindow | null;
    if (!view) throw new Error('Projection portal document has no window.');
    const read = (): PortalSealSample => {
      const style = view.getComputedStyle(element);
      return {
        connected: element.isConnected,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden'),
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
      };
    };

    if (switchAction.control === 'family') {
      const familyRoot = element.ownerDocument.querySelector<HTMLElement>(
        '[data-projection-control="family"] [data-demo-ref="__pui_projection__family_root"]'
      );
      if (!familyRoot) throw new Error('Projection family control root is missing.');
      familyRoot.dispatchEvent(
        new CustomEvent('valueChange', { detail: { value: switchAction.value } })
      );
    } else {
      element.ownerDocument.dispatchEvent(
        new CustomEvent('proto-adapter:change', {
          detail: { adapter: switchAction.value },
        })
      );
    }

    const probe: Probe = { running: true, samples: [read()] };
    view.__puiProjectionPortalProbe = probe;
    const sampleFrame = () => {
      if (!probe.running) return;
      probe.samples.push(read());
      view.requestAnimationFrame(sampleFrame);
    };
    view.requestAnimationFrame(sampleFrame);
    return probe.samples[0]!;
  }, action);
  return { handle, immediate };
}

async function stopPortalSealProbe(page: Page): Promise<PortalSealSample[]> {
  return page.evaluate(() => {
    type Probe = { running: boolean; samples: PortalSealSample[] };
    type ProbeWindow = Window & { __puiProjectionPortalProbe?: Probe };
    const view = window as ProbeWindow;
    const probe = view.__puiProjectionPortalProbe;
    if (!probe) throw new Error('Projection portal probe is missing.');
    probe.running = false;
    delete view.__puiProjectionPortalProbe;
    return probe.samples;
  });
}

function expectPortalSealed(sample: PortalSealSample, label: string): void {
  if (!sample.connected) return;
  expect(sample.inert, `${label} inert`).toBe(true);
  expect(sample.ariaHidden, `${label} aria-hidden`).toBe('true');
  expect(sample.visibility, `${label} visibility`).toBe('hidden');
  expect(sample.pointerEvents, `${label} pointer-events`).toBe('none');
}

async function chooseControl(
  page: Page,
  _scope: Locator,
  control: 'runtime' | 'family',
  value: string
) {
  const controlOwner = page.locator(
    '[data-homepage-runtime] [data-projection-generation-state="active"]'
  );
  const controlSurface = controlOwner.locator(`[data-projection-control="${control}"]`);
  expect(await controlSurface.count(), `${control} projection control`).toBe(1);

  const trigger = controlSurface.locator('[role="combobox"]');
  expect(await trigger.count(), `${control} projection combobox`).toBe(1);
  await trigger.click();

  const portal = await portalControlledBy(page, trigger);
  const oldPortal = await portal.elementHandle();
  const optionLabel = (CONTROL_OPTION_LABELS[control] as Readonly<Record<string, string>>)[value];
  if (!optionLabel) throw new Error(`Unknown ${control} projection option ${value}.`);
  const option = portal.getByRole('option', { name: optionLabel, exact: true });
  expect(await option.count(), `${control} option ${value}`).toBe(1);
  await option.click();

  return { oldPortal };
}

async function setCoordinates(
  page: Page,
  scope: Locator,
  targetRuntimeId: string,
  targetProjectionFamilyId: ProjectionFamilyId
): Promise<ProjectionCoordinate> {
  let current = await waitForAnyReady(scope);
  if (current.runtimeId !== targetRuntimeId) {
    await chooseControl(page, scope, 'runtime', targetRuntimeId);
    current = await waitForReady(
      scope,
      targetRuntimeId,
      current.projectionFamilyId as ProjectionFamilyId
    );
  }
  if (current.projectionFamilyId !== targetProjectionFamilyId) {
    await chooseControl(page, scope, 'family', targetProjectionFamilyId);
    current = await waitForReady(scope, targetRuntimeId, targetProjectionFamilyId);
  }
  return current;
}

async function assertSurfacesShareCoordinate(
  surfaces: Locator,
  expected: ProjectionCoordinate,
  label: string
): Promise<void> {
  const coordinates = await surfaces.evaluateAll((elements) =>
    elements.map((element) => ({
      runtimeId: element.getAttribute('data-projection-runtime'),
      projectionFamilyId: element.getAttribute('data-projection-family'),
      generation: element.getAttribute('data-projection-generation'),
    }))
  );

  expect(coordinates.length, `${label} surfaces`).toBeGreaterThan(0);
  for (const coordinate of coordinates) {
    expect(coordinate, label).toEqual({
      runtimeId: expected.runtimeId,
      projectionFamilyId: expected.projectionFamilyId,
      generation: expected.generation,
    });
  }
}

async function assertCoherentGeneration(
  page: Page,
  scope: Locator,
  expected: ProjectionCoordinate
): Promise<void> {
  const ownerId = await scope.getAttribute('data-projection-scope');
  expect(ownerId, 'projection owner id').toBeTruthy();

  const ownedSurfaces = page.locator(
    `${attributeEquals('data-projection-owner', ownerId!)}[data-projection-generation]`
  );
  await expect
    .poll(
      () =>
        ownedSurfaces.evaluateAll(
          (elements, coordinate) =>
            elements.filter(
              (element) =>
                element.getAttribute('data-projection-runtime') !== coordinate.runtimeId ||
                element.getAttribute('data-projection-family') !== coordinate.projectionFamilyId ||
                element.getAttribute('data-projection-generation') !== coordinate.generation
            ).length,
          expected
        ),
      { timeout: 10_000 }
    )
    .toBe(0);
  expect(await ownedSurfaces.count(), 'scope-owned projection surfaces').toBeGreaterThanOrEqual(4);
  await assertSurfacesShareCoordinate(ownedSurfaces, expected, 'scope-owned coordinate');

  for (const control of ['runtime', 'family'] as const) {
    const controlOwner = page.locator(
      '[data-homepage-runtime] [data-projection-generation-state="active"]'
    );
    const surface = controlOwner.locator(`[data-projection-control="${control}"]`);
    expect(await surface.count(), `${control} control surface`).toBe(1);
    await assertSurfacesShareCoordinate(surface, expected, `${control} control coordinate`);
  }

  // Each Website participant has independent ownership, but the page transaction
  // must commit identical runtime/family/generation coordinates everywhere.
  const participants = page.locator(
    '[data-homepage-mount] [data-projection-generation-state="active"] [data-projection-scope], [data-home-demo-host] [data-projection-generation-state="active"] [data-projection-scope]'
  );
  expect(await participants.count()).toBe(
    (await page.locator('[data-homepage-actions]').count()) + 1
  );
  await assertSurfacesShareCoordinate(participants, expected, 'page participant coordinate');

  await workspaceTask(scope, expected);
}

async function workspaceTask(
  scope: Locator,
  expected: ProjectionCoordinate
): Promise<{ content: Locator; selectRoot: Locator }> {
  const content = scope.locator('[data-projection-content]');
  expect(await content.count(), 'one active projection content slot').toBe(1);
  expect(await content.getAttribute('data-projection-id'), 'active task identity').toBe(TASK_ID);
  await assertSurfacesShareCoordinate(content, expected, 'active task coordinate');
  await assertSurfacesShareCoordinate(
    content.locator('.pui-projection-prototype'),
    expected,
    'all instantiated task part coordinates'
  );
  expect(
    await scope.locator('[data-projection-control="component"]').count(),
    'the approved homepage has no component picker'
  ).toBe(0);
  expect(
    await content.locator('[data-home-settings]').count(),
    'one real notification composition'
  ).toBe(1);

  const family = expected.projectionFamilyId as ProjectionFamilyId;
  const prototypes = EXPECTED_TASK_PROTOTYPES[family];
  expect(prototypes, 'declared task projection family').toBeTruthy();
  for (const [ref, part] of Object.entries(TASK_PART_REFS)) {
    const refSelector = attributeEquals('data-demo-ref', ref);
    const surface = content.locator(
      part === 'textarea'
        ? `textarea${refSelector}.pui-projection-prototype, ${refSelector} > textarea.pui-projection-prototype`
        : refSelector
    );
    expect(await surface.count(), `actual task part ${ref}`).toBe(1);
    expect(await surface.getAttribute('data-projection-prototype'), `${ref} Prototype`).toBe(
      prototypes[part]
    );
    await assertSurfacesShareCoordinate(surface, expected, `${ref} coordinate`);
  }
  return { content, selectRoot: content.locator('[data-demo-ref="settings-view"]') };
}

async function assertTaskPartInventory(
  scope: Locator,
  _content: Locator,
  portal: Locator,
  expected: ProjectionCoordinate
): Promise<void> {
  // These are the renderer's actual Prototype marker surfaces, not the content
  // wrapper (which also carries the recipe root identity). The union deduplicates
  // any still-in-tree portal and includes the content root after it is portaled.
  const ownerId = await scope.getAttribute('data-projection-scope');
  const parts = scope
    .page()
    .locator(
      `${attributeEquals('data-projection-owner', ownerId!)}${attributeEquals('data-projection-generation', expected.generation)}.pui-projection-prototype`
    );
  const family = expected.projectionFamilyId;
  const expectedIds = [
    ...Object.entries(GALLERY_PART_COUNTS).flatMap(([suffix, count]) =>
      Array(suffix === 'button' && family === 'brutalist' ? count - 1 : count).fill(
        `${family}-${suffix}`
      )
    ),
    ...Array(6).fill('site-preview-surface'),
  ].sort();
  const actualIds = await parts.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-projection-prototype')).sort()
  );
  expect(actualIds, 'all declared gallery instances, including closed/portaled parts').toEqual(
    expectedIds
  );
  expect(new Set(actualIds).size, 'complete declared task recipe').toBe(35);
  await assertSurfacesShareCoordinate(parts, expected, 'every actual task part coordinate');
  const owners = await parts.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-projection-owner'))
  );
  expect(owners, 'every task part retains scope ownership').toEqual(expectedIds.map(() => ownerId));
  expect(
    await portal.evaluate((element) => element.closest('[data-projection-content]') === null),
    'task Select content actually escapes the content DOM through its portal'
  ).toBe(true);
}

async function assertOpenTaskProjection(
  page: Page,
  scope: Locator,
  expected: ProjectionCoordinate
): Promise<void> {
  const { content, selectRoot } = await workspaceTask(scope, expected);
  const trigger = selectRoot.locator('[data-demo-ref="settings-view-trigger"][role="combobox"]');
  expect(await trigger.count(), 'actual task Select trigger').toBe(1);
  await trigger.click();
  try {
    const portal = await portalControlledBy(page, trigger);
    await assertTaskPartInventory(scope, content, portal, expected);
  } finally {
    await page.keyboard.press('Escape');
  }
}

async function dataPuiStyleTokens(surface: Locator): Promise<string[]> {
  return ((await surface.getAttribute('data-pui-style')) ?? '').split(/\s+/).filter(Boolean);
}

async function assertSelectFingerprint(
  page: Page,
  projectionFamilyId: ProjectionFamilyId,
  scope: Locator,
  content: Locator,
  selectRoot: Locator,
  coordinate: ProjectionCoordinate
): Promise<void> {
  const expected = EXPECTED_TASK_PROTOTYPES[projectionFamilyId];
  expect(await selectRoot.getAttribute('data-projection-prototype'), 'Select root Prototype').toBe(
    expected.select
  );

  const trigger = selectRoot.locator('[data-demo-ref="settings-view-trigger"][role="combobox"]');
  expect(await trigger.count(), 'Select trigger').toBe(1);
  expect(await trigger.getAttribute('data-projection-prototype'), 'Select trigger Prototype').toBe(
    expected.trigger
  );

  const restingTokens = await dataPuiStyleTokens(trigger);
  if (projectionFamilyId === 'brutalist') {
    expect(restingTokens).toEqual(
      expect.arrayContaining([
        'rounded-base',
        'border-2',
        'border-black',
        'bg-main',
        'text-main-foreground',
        'font-sans',
        'font-medium',
        'data-[placeholder]:text-main-foreground',
        'data-[pressed]:border-black',
      ])
    );
    expect(restingTokens.some((token) => /shadow-|translate-[xy]/.test(token))).toBe(false);
    const paint = await trigger.evaluate((element) => {
      const css = getComputedStyle(element);
      return {
        radius: css.borderRadius,
        border: css.borderTopWidth,
        shadow: css.boxShadow,
        font: css.fontFamily,
        weight: css.fontWeight,
      };
    });
    expect(paint).toMatchObject({ radius: '5px', border: '2px', shadow: 'none', weight: '500' });
    expect(paint.font).toContain('DM Sans');
  } else {
    expect(restingTokens).toEqual(
      expect.arrayContaining(['rounded-md', 'border-input', 'data-[pressed]:translate-y-px'])
    );
  }

  await trigger.click();
  const portal = await portalControlledBy(page, trigger);
  await assertTaskPartInventory(scope, content, portal, coordinate);
  await assertSurfacesShareCoordinate(portal, coordinate, 'Select content coordinate');
  expect(await portal.getAttribute('data-projection-prototype'), 'Select content Prototype').toBe(
    expected.content
  );

  const item = portal.locator('[role="option"]').first();
  await item.waitFor({ state: 'visible', timeout: 10_000 });
  expect(await item.getAttribute('data-projection-prototype'), 'Select item Prototype').toBe(
    expected.item
  );
  await page.keyboard.press('Escape');

  // Clear the real hover fact before measuring each family's own press
  // projection: source-aligned Brutalist stays flat, while Shadcn shifts 1px.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => trigger.evaluate((element) => element.hasAttribute('data-hovered')), {
      timeout: 10_000,
    })
    .toBe(false);
  const restingBounds = await trigger.boundingBox();
  if (!restingBounds) throw new Error('Select trigger must expose press geometry.');
  await page.mouse.move(
    restingBounds.x + restingBounds.width / 2,
    restingBounds.y + restingBounds.height / 2
  );
  await page.mouse.down();
  try {
    await expect
      .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')), {
        timeout: 10_000,
      })
      .toBe(true);
    await expect
      .poll(async () => (await trigger.boundingBox())?.y, { timeout: 10_000 })
      .toBeCloseTo(restingBounds.y + (projectionFamilyId === 'brutalist' ? 0 : 1), 3);
    expect((await trigger.boundingBox())?.x).toBeCloseTo(restingBounds.x, 3);
  } finally {
    await page.mouse.up();
  }
  await expect
    .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')), {
      timeout: 10_000,
    })
    .toBe(false);
  await page.keyboard.press('Escape');
}

async function readThemeTokens(surface: Locator): Promise<Record<string, string>> {
  return surface.evaluate(
    (element, names) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
    },
    [...THEME_TOKEN_NAMES]
  );
}

async function readWebsiteThemeTokens(page: Page) {
  return page.evaluate(
    (names) => {
      const read = (element: Element) => {
        const style = getComputedStyle(element);
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
      };
      return {
        root: read(document.documentElement),
        body: read(document.body),
      };
    },
    [...THEME_TOKEN_NAMES]
  );
}

async function expectSemanticFocus(
  page: Page,
  _scope: Locator,
  control: 'runtime' | 'family'
): Promise<void> {
  const owner = page.locator('[data-homepage-runtime] [data-projection-generation-state="active"]');
  await expect
    .poll(
      () =>
        owner
          .locator(`[data-projection-control="${control}"] [role="combobox"]`)
          .evaluate((element) => document.activeElement === element),
      { timeout: 10_000 }
    )
    .toBe(true);
}

function observePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(HOME_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Homepage Prototype projection scope', () => {
  it('commits one coherent generation across four Runtimes and both projection lanes', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = observePageErrors(page);
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });

    try {
      const scope = await projectionScope(page);
      let previous = await waitForAnyReady(scope);

      for (const projectionFamilyId of PROJECTION_FAMILIES) {
        for (const runtimeId of RUNTIMES) {
          const current = await setCoordinates(page, scope, runtimeId, projectionFamilyId);
          if (
            current.runtimeId !== previous.runtimeId ||
            current.projectionFamilyId !== previous.projectionFamilyId
          ) {
            expect(
              current.generation,
              `${runtimeId}/${projectionFamilyId} fresh generation`
            ).not.toBe(previous.generation);
          }
          await assertCoherentGeneration(page, scope, current);
          await assertOpenTaskProjection(page, scope, current);
          previous = current;
        }
      }
    } finally {
      await context.close();
      expect(errors, 'no uncaught page errors, including transaction cleanup').toEqual([]);
    }
  }, 240_000);

  it('projects the WC gallery with every concrete part and exact Select fingerprints', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = observePageErrors(page);
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });

    try {
      const scope = await projectionScope(page);
      await waitForAnyReady(scope);

      for (const projectionFamilyId of PROJECTION_FAMILIES) {
        const coordinate = await setCoordinates(page, scope, 'wc', projectionFamilyId);
        await assertCoherentGeneration(page, scope, coordinate);
        const { content, selectRoot } = await workspaceTask(scope, coordinate);
        await assertSelectFingerprint(
          page,
          projectionFamilyId,
          scope,
          content,
          selectRoot,
          coordinate
        );
      }
    } finally {
      await context.close();
      expect(errors, 'no uncaught page errors, including transaction cleanup').toEqual([]);
    }
  }, 180_000);

  it('closes portaled Select presentation over the lane theme without mutating Website tokens', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      const errors = observePageErrors(page);
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      await applyColorScheme(page, colorScheme);

      try {
        const scope = await projectionScope(page);
        await waitForAnyReady(scope);
        const websiteTokens = await readWebsiteThemeTokens(page);

        for (const projectionFamilyId of PROJECTION_FAMILIES) {
          const current = await setCoordinates(page, scope, 'wc', projectionFamilyId);
          await assertCoherentGeneration(page, scope, current);
          const { content, selectRoot } = await workspaceTask(scope, current);

          const selectTrigger = selectRoot.locator('[role="combobox"]');
          expect(await selectTrigger.count(), 'demo Select combobox').toBe(1);
          await selectTrigger.click();
          const portal = await portalControlledBy(page, selectTrigger);

          await assertTaskPartInventory(scope, content, portal, current);
          await assertSurfacesShareCoordinate(portal, current, 'demo Select portal coordinate');
          expect(await portal.getAttribute('data-projection-owner')).toBe(
            await scope.getAttribute('data-projection-scope')
          );

          const scopeTokens = await readThemeTokens(scope);
          expect(
            Object.values(scopeTokens).every(Boolean),
            `${colorScheme} scope theme closure`
          ).toBe(true);
          expect(await readThemeTokens(portal), `${colorScheme} portal theme closure`).toEqual(
            scopeTokens
          );
          expect(
            await readWebsiteThemeTokens(page),
            `${colorScheme} Website token boundary`
          ).toEqual(websiteTokens);

          await page.keyboard.press('Escape');
        }
      } finally {
        await context.close();
        expect(errors, 'no uncaught page errors, including transaction cleanup').toEqual([]);
      }
    }
  }, 180_000);

  it('restores semantic control focus and disconnects the replaced generation portal', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = observePageErrors(page);
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });

    try {
      const scope = await projectionScope(page);
      let current = await waitForAnyReady(scope);
      const ownerId = await scope.getAttribute('data-projection-scope');
      expect(ownerId, 'projection owner id').toBeTruthy();

      const nextProjectionFamilyId: ProjectionFamilyId =
        current.projectionFamilyId === 'shadcn' ? 'brutalist' : 'shadcn';
      const oldFamilyGeneration = current.generation;
      const familySwitch = await chooseControl(page, scope, 'family', nextProjectionFamilyId);
      current = await waitForReady(scope, current.runtimeId, nextProjectionFamilyId);
      await expectSemanticFocus(page, scope, 'family');
      expect(await familySwitch.oldPortal?.evaluate((element) => element.isConnected)).toBe(false);
      expect(
        await page
          .locator(
            `${attributeEquals('data-projection-owner', ownerId!)}${attributeEquals(
              'data-projection-generation',
              oldFamilyGeneration
            )}`
          )
          .count(),
        'replaced family generation surfaces'
      ).toBe(0);

      const nextRuntimeId = RUNTIMES.find((runtimeId) => runtimeId !== current.runtimeId)!;
      const oldRuntimeGeneration = current.generation;
      const runtimeSwitch = await chooseControl(page, scope, 'runtime', nextRuntimeId);
      current = await waitForReady(scope, nextRuntimeId, nextProjectionFamilyId);
      await expectSemanticFocus(page, scope, 'runtime');
      expect(await runtimeSwitch.oldPortal?.evaluate((element) => element.isConnected)).toBe(false);
      expect(
        await page
          .locator(
            `${attributeEquals('data-projection-owner', ownerId!)}${attributeEquals(
              'data-projection-generation',
              oldRuntimeGeneration
            )}`
          )
          .count(),
        'replaced Runtime generation surfaces'
      ).toBe(0);
      await assertCoherentGeneration(page, scope, current);
    } finally {
      await context.close();
      expect(errors, 'no uncaught page errors, including transaction cleanup').toEqual([]);
    }
  }, 120_000);

  it('atomically seals an open child portal during programmatic lane and Runtime switches', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = observePageErrors(page);
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });

    try {
      const scope = await projectionScope(page);
      await waitForAnyReady(scope);
      const initial = await setCoordinates(page, scope, 'wc', 'shadcn');
      const { content: shadcnContent, selectRoot: shadcnSelect } = await workspaceTask(
        scope,
        initial
      );
      const shadcnTrigger = shadcnSelect.locator('[role="combobox"]');
      await shadcnTrigger.click();
      const shadcnPortal = await portalControlledBy(page, shadcnTrigger);
      await assertTaskPartInventory(scope, shadcnContent, shadcnPortal, initial);
      const familyProbe = await startPortalSealProbe(shadcnPortal, {
        control: 'family',
        value: 'brutalist',
      });
      expectPortalSealed(familyProbe.immediate, 'family switch immediate old portal');

      let current = await waitForReady(scope, 'wc', 'brutalist');
      const familySamples = await stopPortalSealProbe(page);
      expect(familySamples.length, 'family switch portal samples').toBeGreaterThan(0);
      familySamples.forEach((sample, index) =>
        expectPortalSealed(sample, `family switch old portal frame ${index}`)
      );
      await expect
        .poll(() => familyProbe.handle.evaluate((element) => element.isConnected), {
          timeout: 10_000,
        })
        .toBe(false);
      await assertCoherentGeneration(page, scope, current);

      const { content: brutalistContent, selectRoot: brutalistSelect } = await workspaceTask(
        scope,
        current
      );
      const brutalistTrigger = brutalistSelect.locator('[role="combobox"]');
      await brutalistTrigger.click();
      const brutalistPortal = await portalControlledBy(page, brutalistTrigger);
      await assertTaskPartInventory(scope, brutalistContent, brutalistPortal, current);
      const runtimeProbe = await startPortalSealProbe(brutalistPortal, {
        control: 'runtime',
        value: 'react',
      });
      expectPortalSealed(runtimeProbe.immediate, 'Runtime switch immediate old portal');

      current = await waitForReady(scope, 'react', 'brutalist');
      const runtimeSamples = await stopPortalSealProbe(page);
      expect(runtimeSamples.length, 'Runtime switch portal samples').toBeGreaterThan(0);
      runtimeSamples.forEach((sample, index) =>
        expectPortalSealed(sample, `Runtime switch old portal frame ${index}`)
      );
      await expect
        .poll(() => runtimeProbe.handle.evaluate((element) => element.isConnected), {
          timeout: 10_000,
        })
        .toBe(false);
      await assertCoherentGeneration(page, scope, current);
    } finally {
      await context.close();
      expect(errors, 'no uncaught page errors, including transaction cleanup').toEqual([]);
    }
  }, 120_000);
});
