// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type JSHandle, type Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  installSizingMotionTrace,
  installSizingPublicOwner,
  type SizingMotionTrigger,
  sizingMotionIssues,
  sizingItemSizeIssues,
  type SizingMotionHandle,
  type SizingMotionResult,
  type SizingMotionSelection,
} from './demo-select-item-sizing-motion';
import {
  RUNTIMES,
  chromeExecutable,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

let source: string;
let sourceTree: string;
const output = process.env.PROTO_UI_SELECT_ITEM_SIZING_EVIDENCE;
const route = (locale: string) => `/${locale}/ui-libraries/shadcn/select/`;
const demoId = 'demo-shadcn-select-disabled';
const expectedItemCount = 5;
let browser: Browser;
let baseUrl: string;
const environments = [
  { id: 'default', direction: 'ltr', reducedMotion: 'no-preference' },
  { id: 'rtl', direction: 'rtl', reducedMotion: 'no-preference' },
  { id: 'reduced-motion', direction: 'ltr', reducedMotion: 'reduce' },
] as const;
type Environment = (typeof environments)[number];
beforeAll(async () => {
  // This carrier binds its source to its own checkout/server, not a caller's
  // unsupported claim that an arbitrary external deployment has the same SHA.
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error(
      'External deployment SHA needs independent verification; this carrier requires its own source-bound server.'
    );
  source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  baseUrl = await startServer([route('en'), route('zh-cn')]);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    chromiumSandbox: true,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  if (output) {
    await mkdir(output, { recursive: true });
    const files = [
      'apps/www/src/content/docs/demo_components/select/demo-shadcn-select-disabled.demo.ts',
      'apps/www/src/content/docs/zh-cn/demo-select-item-sizing.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-select-item-sizing-motion.ts',
    ];
    await writeFile(
      path.join(output, 'source.json'),
      JSON.stringify(
        {
          source,
          sourceTree,
          files: await Promise.all(
            files.map(async (file) => ({
              file,
              sha256: createHash('sha256')
                .update(await readFile(file))
                .digest('hex'),
            }))
          ),
          claim:
            'Styled public demo, actual chosen runtime, own checkout server; not compiled/AT acceptance',
        },
        null,
        2
      )
    );
  }
}, 150_000);
afterAll(async () => {
  const errors: unknown[] = [];
  try {
    await browser?.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await stopServer();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, 'Browser/server cleanup failed');
}, 60_000);

async function facts(trigger: Locator) {
  return trigger.evaluate((node, itemCount) => {
    const trigger = node as SizingMotionTrigger;
    const doc = trigger.ownerDocument;
    const binding = trigger.__puiSizingOwner;
    if (!binding || binding.itemCount !== itemCount)
      throw new Error('Expected the retained public Select owner binding');
    const { content, surface, viewport, items } = binding.read();
    const box = (element: HTMLElement) => {
      const css = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        prototype: element.dataset.projectionPrototype ?? element.localName,
        rect: {
          x: rect.x,
          y: rect.y,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        border: [
          css.borderTopWidth,
          css.borderRightWidth,
          css.borderBottomWidth,
          css.borderLeftWidth,
        ].map(parseFloat),
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft].map(
          parseFloat
        ),
        boxSizing: css.boxSizing,
        outlineWidth: css.outlineWidth,
        outlineOffset: css.outlineOffset,
        boxShadow: css.boxShadow,
        position: css.position,
        direction: css.direction,
        transform: css.transform,
        overflowX: css.overflowX,
        overflowY: css.overflowY,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        focused: doc.activeElement === element,
        selected: element.getAttribute('aria-selected'),
        disabled: element.getAttribute('aria-disabled'),
        text: element.textContent?.trim(),
      };
    };
    return {
      at: performance.now(),
      runtime: binding.runtime,
      expanded: trigger.getAttribute('aria-expanded'),
      trigger: box(trigger),
      content: box(content),
      surface: box(surface),
      viewport: box(viewport),
      items: items.map(box),
      browser: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      rootFontSize: getComputedStyle(doc.documentElement).fontSize,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'reduce'
        : 'no-preference',
    };
  }, expectedItemCount);
}
type Facts = Awaited<ReturnType<typeof facts>>;
function assertGeometryFacts(
  value: Facts,
  runtime: string,
  environment: Environment,
  selection: SizingMotionSelection
) {
  expect(value.runtime).toBe(runtime);
  expect(value.expanded).toBe('true');
  expect(value.reducedMotion).toBe(environment.reducedMotion);
  for (const box of [value.trigger, value.content, value.surface, value.viewport, ...value.items])
    expect(box.direction, `${box.prototype} actual direction`).toBe(environment.direction);
  expect(value.trigger.rect.height).toBeGreaterThan(0);
  const selected = value.items.filter((item) => item.selected === 'true');
  expect(selected).toHaveLength(selection === 'unset' ? 0 : 1);
  // Initial unset value aligns the first enabled record without selecting it.
  const aligned =
    selection === 'unset' ? value.items.find((item) => item.disabled === 'false') : selected[0];
  expect(aligned?.disabled, 'alignment row is enabled').toBe('false');
  // All five registered owned rows, including disabled siblings, share size.
  // Placement is checked separately for exact alignment and viewport collision.
  expect(
    sizingItemSizeIssues(
      value.trigger.rect,
      value.items.map((item) => item.rect)
    ),
    'every current same-list row matches Trigger width and height'
  ).toEqual([]);
  for (const item of value.items) {
    expect(
      item.scrollWidth - item.clientWidth,
      `${item.text} horizontal text overflow`
    ).toBeLessThanOrEqual(1);
    expect(
      item.scrollHeight - item.clientHeight,
      `${item.text} vertical text overflow`
    ).toBeLessThanOrEqual(1);
  }
  for (const [label, box] of [
    ['Surface', value.surface],
    ['Viewport', value.viewport],
  ] as const)
    expect(box.scrollWidth - box.clientWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(
      1
    );
  // Chrome is outside the matched row; still forbid viewport clipping.
  expect(value.surface.rect.left).toBeGreaterThanOrEqual(-0.5);
  expect(value.surface.rect.right).toBeLessThanOrEqual(value.browser.width + 0.5);
  const focused = value.items.filter((item) => item.focused);
  expect(focused).toHaveLength(1);
  const item = focused[0].rect;
  const clip = value.viewport.rect;
  expect(item.left).toBeGreaterThanOrEqual(clip.left + value.viewport.border[3] - 0.5);
  expect(item.right).toBeLessThanOrEqual(clip.right - value.viewport.border[1] + 0.5);
  expect(item.top).toBeGreaterThanOrEqual(clip.top + value.viewport.border[0] - 0.5);
  expect(item.bottom).toBeLessThanOrEqual(clip.bottom - value.viewport.border[2] + 0.5);
  expect(value.items[3].disabled).toBe('true');
  return aligned!;
}
function assertGeometry(
  value: Facts,
  runtime: string,
  environment: Environment,
  selection: SizingMotionSelection
) {
  const aligned = assertGeometryFacts(value, runtime, environment, selection);
  for (const edge of ['left', 'right', 'top', 'bottom'] as const)
    expect(
      Math.abs(aligned!.rect[edge] - value.trigger.rect[edge]),
      `aligned row ${edge} replaces trigger`
    ).toBeLessThanOrEqual(0.5);
}
async function positionClosedTrigger(trigger: Locator, placement: 'center' | 'bottom-collision') {
  return trigger.evaluate((node, placement) => {
    const view = node.ownerDocument.defaultView;
    if (!view) throw new Error('Expected the current Trigger document window');
    const read = () => {
      const rect = node.getBoundingClientRect();
      return {
        rect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        scroll: { x: view.scrollX, y: view.scrollY },
      };
    };
    const before = read();
    // Native document scrolling establishes this carrier's input. It does not
    // alter the popup, its scrollTop, selection, dimensions or positioning policy.
    node.scrollIntoView({
      block: placement === 'center' ? 'center' : 'end',
      inline: 'nearest',
      behavior: 'instant',
    });
    if (placement === 'bottom-collision')
      view.scrollBy({
        top: node.getBoundingClientRect().bottom - (view.innerHeight - 2),
        behavior: 'instant',
      });
    return {
      placement,
      method: 'native document scrolling' as const,
      before,
      after: read(),
      expanded: node.getAttribute('aria-expanded'),
      browser: { width: view.innerWidth, height: view.innerHeight },
    };
  }, placement);
}
type GeometryInput = Awaited<ReturnType<typeof positionClosedTrigger>>;
function assertGeometryInput(input: GeometryInput) {
  expect(input.expanded, 'fixture scroll occurs while Select is closed').toBe('false');
  expect(input.browser).toEqual({ width: 390, height: 900 });
  const actual =
    input.placement === 'center'
      ? input.after.rect.top + input.after.rect.height / 2
      : input.after.rect.bottom;
  const expected =
    input.placement === 'center' ? input.browser.height / 2 : input.browser.height - 2;
  expect(Math.abs(actual - expected), `${input.placement} measured input`).toBeLessThanOrEqual(0.5);
}
function assertBottomCollision(
  value: Facts,
  runtime: string,
  environment: Environment,
  input: GeometryInput
) {
  const aligned = assertGeometryFacts(value, runtime, environment, 'selected');
  expect(input.placement).toBe('bottom-collision');
  expect(aligned.text).toBe('Pineapple');
  expect(aligned.focused).toBe(true);
  expect(value.items.map((item) => item.selected)).toEqual([
    'false',
    'false',
    'false',
    'false',
    'true',
  ]);
  for (const edge of ['left', 'right', 'top', 'bottom'] as const)
    expect(
      Math.abs(value.trigger.rect[edge] - input.after.rect[edge]),
      `opening preserves the prepared Trigger ${edge}`
    ).toBeLessThanOrEqual(0.5);
  for (const edge of ['left', 'right'] as const)
    expect(
      Math.abs(aligned.rect[edge] - value.trigger.rect[edge]),
      `collision row ${edge}`
    ).toBeLessThanOrEqual(0.5);
  // P-BASE-SELECT-CONTENT-CURRENT-ALIGNMENT-INTENT gives viewport collisions
  // priority. The declared Select layout-viewport margin is 10px; this selected
  // final row must clamp there, not be reported as replacing the Trigger.
  const bottom = value.browser.height - 10;
  expect(
    value.trigger.rect.bottom - bottom,
    'actual input requires bottom collision'
  ).toBeGreaterThan(0.5);
  for (const [name, box] of [
    ['Content', value.content],
    ['Surface', value.surface],
    ['Viewport', value.viewport],
    ['selected row', aligned],
  ] as const)
    expect(
      Math.abs(box.rect.bottom - bottom),
      `${name} preserves the 10px bottom gutter`
    ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(aligned.rect.top - (bottom - value.trigger.rect.height)),
    'clamped row top'
  ).toBeLessThanOrEqual(0.5);
  expect(value.surface.rect.top).toBeGreaterThanOrEqual(10 - 0.5);
}
async function ready(previewer: Locator, runtime: (typeof RUNTIMES)[number]) {
  // A toolbar scope can publish the new selection while the previous demo is
  // still mounted. Observe the controller's commit and the actual demo root.
  await selectRuntime(
    previewer.page(),
    previewer,
    runtime,
    '[role="combobox"][aria-label="Fruit selector with disabled item"]',
    1
  );
}

interface PointerPoint {
  x: number;
  y: number;
  option: string;
  pointerEvents: string;
  hit: { prototype: string | null; role: string | null; owner: string | null };
}
async function optionPoint(trigger: Locator, index: number): Promise<PointerPoint> {
  return trigger.evaluate((node, index) => {
    const doc = node.ownerDocument;
    const binding = (node as SizingMotionTrigger).__puiSizingOwner;
    if (!binding) throw new Error('Pointer input requires the retained public owner binding');
    const { content, items } = binding.read();
    const option = items[index];
    if (!option) throw new Error('Pointer option is not registered in the current list');
    const rect = option.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = doc.elementFromPoint(x, y);
    // Disabled items legitimately use pointer-events:none. The native hit must
    // still be inside this popup, rather than on an occluding page control.
    if (!(rect.width > 0 && rect.height > 0) || !hit || !content.contains(hit))
      throw new Error('Option center is not exposed inside the current popup');
    if (index !== 3 && hit.closest('[role="option"]') !== option)
      throw new Error('Enabled option is occluded at the intended pointer point');
    return {
      x,
      y,
      option: option.textContent?.trim() ?? '',
      pointerEvents: getComputedStyle(option).pointerEvents,
      hit: {
        prototype: (hit as HTMLElement).dataset.projectionPrototype ?? hit.localName,
        role: hit.getAttribute('role'),
        owner: binding.owns(hit as HTMLElement) ? binding.owner : null,
      },
    };
  }, index);
}

for (const environment of environments)
  for (const locale of ['en', 'zh-cn'])
    describe.sequential(
      `${locale} actual styled Select consumer${environment.id === 'default' ? '' : ` (${environment.id})`}`,
      () => {
        for (const runtime of RUNTIMES)
          it(`${runtime}: first entry, selection, reopen and narrow geometry`, async () => {
            const { context, page } = await openRoute(browser, baseUrl, route(locale), {
              width: 1180,
              height: 900,
            });
            const previewer = page.locator(`[data-demo-id="${demoId}"]`);
            const observations: Array<{ phase: string; value: Facts }> = [];
            const motion: Array<{ phase: string; value: SizingMotionResult }> = [];
            const pointerInputs: Array<{ phase: string; value: PointerPoint }> = [];
            const geometryInputs: Array<{ phase: string; value: GeometryInput }> = [];
            const activeMotion: { handle: JSHandle<SizingMotionHandle> | null } = { handle: null };
            const startMotion = async (trigger: Locator, selection: SizingMotionSelection) => {
              if (activeMotion.handle) throw new Error('Previous motion trace was not released');
              // Begin the open-cycle trace from an established keyboard focus state.
              // Otherwise the opening key also changes input modality, starts the
              // focus ring and immediately reverses it as focus moves to an option.
              await expect
                .poll(
                  () =>
                    trigger.evaluate(
                      (node) =>
                        node.ownerDocument.activeElement === node &&
                        node
                          .getAnimations()
                          .every(
                            (animation) => !animation.pending && animation.playState === 'finished'
                          )
                    ),
                  { timeout: 1200 }
                )
                .toBe(true);
              activeMotion.handle = await trigger.evaluateHandle(installSizingMotionTrace, {
                selection,
                itemCount: expectedItemCount,
              });
            };
            const finishMotion = async (phase: string) => {
              if (!activeMotion.handle)
                throw new Error('Motion trace was not installed before action');
              // Do not resolve the Locator again: its DOM owner may have changed.
              // Keep the original trace and its invalid-owner/interrupted result.
              const value = await activeMotion.handle.evaluate((handle) => handle.done);
              motion.push({ phase, value });
              await activeMotion.handle.dispose();
              activeMotion.handle = null;
              expect(
                sizingMotionIssues(value, runtime, expectedItemCount),
                `${phase} full motion trajectory`
              ).toEqual([]);
            };
            const name = `${locale}-${runtime}${environment.id === 'default' ? '' : `-${environment.id}`}`;
            let testFailed = false;
            let testError: unknown;
            let directionInput:
              | { documentBefore: string; articleBefore: string | null; trigger?: string }
              | undefined;
            const secondaryErrors: Array<{ phase: string; error: unknown }> = [];
            try {
              await page.emulateMedia({ reducedMotion: environment.reducedMotion });
              directionInput = await previewer.evaluate((node, direction) => {
                const article = node.closest('main[dir]');
                if (!article)
                  throw new Error('Expected the Select preview inside its authored article');
                const documentElement = node.ownerDocument.documentElement;
                const documentBefore = documentElement.dir;
                const articleBefore = article.getAttribute('dir');
                // Starlight authors direction separately on the article and document.
                documentElement.dir = direction;
                article.setAttribute('dir', direction);
                return { documentBefore, articleBefore };
              }, environment.direction);
              await previewer.scrollIntoViewIfNeeded();
              await ready(previewer, runtime);
              const trigger = previewer.getByRole('combobox', {
                name: 'Fruit selector with disabled item',
                exact: true,
              });
              const ownerBinding = await trigger.evaluate(installSizingPublicOwner, {
                demoId,
                itemCount: expectedItemCount,
              });
              expect(ownerBinding.runtime, 'actual committed public demo controller').toBe(runtime);
              directionInput.trigger = await trigger.evaluate(
                (node) => getComputedStyle(node).direction
              );
              expect(directionInput.trigger, 'native trigger direction before input').toBe(
                environment.direction
              );
              expect(await trigger.getAttribute('aria-expanded')).toBe('false');
              expect(await trigger.innerText()).toBe('Disabled item inside');
              await page.keyboard.press('Tab');
              await startMotion(trigger, 'unset');
              await trigger.press('ArrowDown');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Apple']);
              await finishMotion('first-entry');
              const first = await facts(trigger);
              observations.push({ phase: 'first-entry', value: first });
              assertGeometry(first, runtime, environment, 'unset');
              expect(first.items.map((item) => item.selected)).toEqual([
                'false',
                'false',
                'false',
                'false',
                'false',
              ]);
              expect(first.trigger.text).toBe('Disabled item inside');
              if (output) await page.screenshot({ path: path.join(output, `${name}-first.png`) });
              await page.keyboard.press('End');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              const navigated = await facts(trigger);
              expect(navigated.items.map((item) => item.selected)).toEqual([
                'false',
                'false',
                'false',
                'false',
                'false',
              ]);
              expect(navigated.trigger.text).toBe('Disabled item inside');
              await page.keyboard.press('Enter');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await expect.poll(() => trigger.innerText()).toContain('Pineapple');
              await startMotion(trigger, 'selected');
              await trigger.press('Enter');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              await finishMotion('selected-reopen');
              const reopen = await facts(trigger);
              observations.push({ phase: 'selected-reopen', value: reopen });
              assertGeometry(reopen, runtime, environment, 'selected');
              expect(reopen.items.map((item) => item.selected)).toEqual([
                'false',
                'false',
                'false',
                'false',
                'true',
              ]);
              await page.keyboard.press('Escape');
              await expect
                .poll(() =>
                  trigger.evaluate((element) => element.ownerDocument.activeElement === element)
                )
                .toBe(true);
              await page.setViewportSize({ width: 390, height: 900 });
              // Exact four-edge alignment needs a non-colliding reference. A
              // merely visible Trigger can still lie inside the 10px gutter.
              const narrowInput = await positionClosedTrigger(trigger, 'center');
              geometryInputs.push({ phase: 'narrow-reopen', value: narrowInput });
              assertGeometryInput(narrowInput);
              await startMotion(trigger, 'selected');
              await trigger.press('ArrowDown');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              await finishMotion('narrow-reopen');
              const narrow = await facts(trigger);
              observations.push({ phase: 'narrow-reopen', value: narrow });
              assertGeometry(narrow, runtime, environment, 'selected');
              if (output) await page.screenshot({ path: path.join(output, `${name}-narrow.png`) });
              await page.keyboard.press('Escape');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');

              // Preserve the newly observed edge case separately from exact
              // alignment. Keep the real opening key and full motion trajectory.
              const collisionInput = await positionClosedTrigger(trigger, 'bottom-collision');
              geometryInputs.push({ phase: 'narrow-bottom-collision', value: collisionInput });
              assertGeometryInput(collisionInput);
              await startMotion(trigger, 'selected');
              await trigger.press('ArrowDown');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              await finishMotion('narrow-bottom-collision');
              const collision = await facts(trigger);
              observations.push({ phase: 'narrow-bottom-collision', value: collision });
              assertBottomCollision(collision, runtime, environment, collisionInput);
              if (output)
                await page.screenshot({ path: path.join(output, `${name}-bottom-collision.png`) });
              await page.keyboard.press('Escape');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              const pointerInput = await positionClosedTrigger(trigger, 'center');
              geometryInputs.push({ phase: 'disabled-probe-entry', value: pointerInput });
              assertGeometryInput(pointerInput);

              // The original journey above only inspected aria-disabled. Exercise
              // the actual disabled option through trusted input, then prove the
              // same pointer can focus and commit an enabled sibling.
              await startMotion(trigger, 'selected');
              await trigger.press('ArrowDown');
              await finishMotion('disabled-probe-entry');
              await page.keyboard.press('Home');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Apple']);
              await page.keyboard.press('End');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              // The public recipe puts its disabled row before Pineapple.
              // Exercise both directions through that gap, not only Home/End.
              await page.keyboard.press('ArrowUp');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Blueberry']);
              await page.keyboard.press('ArrowDown');
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Pineapple']);
              const navigation = await facts(trigger);
              observations.push({ phase: 'disabled-keyboard-skip', value: navigation });
              assertGeometry(navigation, runtime, environment, 'selected');

              const assertDisabledDidNotCommit = async (phase: string) => {
                // Retain a later observation without calling two frames a React
                // commit barrier. The following enabled handoff must also reach
                // its changed DOM invariant while selection remains unchanged.
                await page.evaluate(() => {
                  const { promise, resolve } = Promise.withResolvers<void>();
                  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                  return promise;
                });
                const value = await facts(trigger);
                observations.push({ phase, value });
                expect(value.runtime).toBe(runtime);
                expect(value.expanded).toBe('true');
                expect(value.items[3].disabled).toBe('true');
                expect(value.items[3].focused).toBe(false);
                expect(value.items.map((item) => item.selected)).toEqual([
                  'false',
                  'false',
                  'false',
                  'false',
                  'true',
                ]);
                expect(await trigger.innerText()).toContain('Pineapple');
                return value;
              };
              const disabledMove = await optionPoint(trigger, 3);
              pointerInputs.push({ phase: 'disabled-pointer-move', value: disabledMove });
              await page.mouse.move(disabledMove.x, disabledMove.y);
              await assertDisabledDidNotCommit('disabled-pointer-move');
              const disabledClick = await optionPoint(trigger, 3);
              pointerInputs.push({ phase: 'disabled-pointer-click', value: disabledClick });
              await page.mouse.click(disabledClick.x, disabledClick.y);
              await assertDisabledDidNotCommit('disabled-pointer-click');
              if (output)
                await page.screenshot({ path: path.join(output, `${name}-disabled.png`) });

              const enabledMove = await optionPoint(trigger, 1);
              pointerInputs.push({ phase: 'enabled-pointer-move', value: enabledMove });
              await page.mouse.move(enabledMove.x, enabledMove.y);
              await expect
                .poll(async () =>
                  (await facts(trigger)).items
                    .filter((item) => item.focused)
                    .map((item) => item.text)
                )
                .toEqual(['Banana']);
              const hover = await facts(trigger);
              observations.push({ phase: 'enabled-pointer-move', value: hover });
              expect(hover.items.map((item) => item.selected)).toEqual([
                'false',
                'false',
                'false',
                'false',
                'true',
              ]);
              const enabledClick = await optionPoint(trigger, 1);
              pointerInputs.push({ phase: 'enabled-pointer-click', value: enabledClick });
              await page.mouse.click(enabledClick.x, enabledClick.y);
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await expect.poll(async () => (await trigger.innerText()).trim()).toBe('Banana');
              // Re-enter keyboard modality through actual sequential navigation
              // before installing the trace, as for the original first entry.
              await page.keyboard.press('Tab');
              await page.keyboard.press('Shift+Tab');
              await startMotion(trigger, 'selected');
              await trigger.press('ArrowDown');
              await finishMotion('pointer-selected-reopen');
              const pointerReopen = await facts(trigger);
              observations.push({ phase: 'pointer-selected-reopen', value: pointerReopen });
              assertGeometry(pointerReopen, runtime, environment, 'selected');
              expect(pointerReopen.items.map((item) => item.selected)).toEqual([
                'false',
                'true',
                'false',
                'false',
                'false',
              ]);
              expect(
                pointerReopen.items.filter((item) => item.focused).map((item) => item.text)
              ).toEqual(['Banana']);
              if (output)
                await page.screenshot({ path: path.join(output, `${name}-pointer-reopen.png`) });
              await page.keyboard.press('Escape');
              await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
              await expect
                .poll(() => trigger.evaluate((node) => node.ownerDocument.activeElement === node))
                .toBe(true);
            } catch (error) {
              testFailed = true;
              testError = error;
              if (output) {
                try {
                  await page.screenshot({ path: path.join(output, `${name}-failure.png`) });
                } catch (error) {
                  secondaryErrors.push({ phase: 'failure-screenshot', error });
                }
                try {
                  const trigger = previewer.getByRole('combobox', {
                    name: 'Fruit selector with disabled item',
                    exact: true,
                  });
                  observations.push({ phase: 'failure', value: await facts(trigger) });
                } catch (error) {
                  secondaryErrors.push({ phase: 'failure-facts', error });
                }
              }
            } finally {
              try {
                const unfinished = await activeMotion.handle?.evaluate((handle) => {
                  handle.stop();
                  return handle.done;
                });
                if (
                  unfinished &&
                  !motion.some((entry) => entry.value.startedAt === unfinished.startedAt)
                )
                  motion.push({ phase: 'interrupted', value: unfinished });
              } catch (error) {
                secondaryErrors.push({ phase: 'motion-cleanup', error });
              } finally {
                try {
                  await activeMotion.handle?.dispose();
                } catch (error) {
                  secondaryErrors.push({ phase: 'motion-handle-dispose', error });
                }
                activeMotion.handle = null;
              }
              try {
                if (output)
                  await writeFile(
                    path.join(output, `${name}.json`),
                    JSON.stringify(
                      {
                        source,
                        sourceTree,
                        runtime,
                        locale,
                        environment,
                        directionInput,
                        observations,
                        motion,
                        pointerInputs,
                        geometryInputs,
                        failure: testFailed ? String(testError) : null,
                        secondaryErrors: secondaryErrors.map(({ phase, error }) => ({
                          phase,
                          error: String(error),
                        })),
                        firstVisibleFrames:
                          'pre-action bounded rAF trace; early frames retained separately from settled assertions',
                        remaining: [
                          'first-visible frame capture',
                          '200% text/long content',
                          'animation cancellation/interruption',
                          'Root disabled and live Item disabled updates',
                          'compiled/AT',
                          'other environment cases require their own results',
                          'other website controls',
                        ],
                      },
                      null,
                      2
                    )
                  );
              } catch (error) {
                secondaryErrors.push({ phase: 'evidence-write', error });
              }
              try {
                await context.close();
              } catch (error) {
                secondaryErrors.push({ phase: 'context-close', error });
              }
            }
            if (testFailed || secondaryErrors.length)
              throw new AggregateError(
                [
                  ...(testFailed ? [testError] : []),
                  ...secondaryErrors.map(({ phase, error }) => new Error(phase, { cause: error })),
                ],
                `${name}: assertion/evidence/cleanup failure`
              );
          }, 120_000);
      }
    );
