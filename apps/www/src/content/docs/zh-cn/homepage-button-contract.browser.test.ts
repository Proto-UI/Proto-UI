// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Browser, Locator, Page } from 'playwright-core';
import { recordButtonMotion, buttonMotionIssues } from './button-motion-evidence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import { copySourceBindingIssues, type CopySourceBinding } from './copy-command-evidence';

let browser: Browser, baseUrl: string, source: CopySourceBinding;
const directory = join(
  process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ||
    join(process.env.RUNNER_TEMP || tmpdir(), 'homepage-evidence'),
  'homepage-button-contract'
);
beforeAll(async () => {
  source = {
    exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
    eventSHA: process.env.GITHUB_SHA ?? null,
  };
  expect(copySourceBindingIssues(source, Boolean(process.env.CI))).toEqual([]);
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
}, 300_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function ready(page: Page, runtime: string, family: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const showcase = document.querySelector<HTMLElement>('[data-home-showcase]');
      return (
        root?.dataset.runtimeState === 'ready' &&
        root.dataset.runtime === runtime &&
        root.dataset.family === family &&
        showcase?.dataset.runnerState === 'ready' &&
        showcase.dataset.runnerRuntime === runtime
      );
    },
    { runtime, family }
  );
}
async function facts(button: Locator) {
  return button.evaluate((element) => {
    const style = getComputedStyle(element),
      bounds = element.getBoundingClientRect();
    return {
      height: bounds.height,
      width: bounds.width,
      fontSize: style.fontSize,
      computedFontFamily: style.fontFamily,
      lineHeight: style.lineHeight,
      userSelect: style.userSelect,
      webkitUserSelect: style.getPropertyValue('-webkit-user-select'),
      boxSizing: style.boxSizing,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      borderRadius: style.borderRadius,
      background: style.backgroundColor,
      color: style.color,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      borderTop: style.borderTopWidth,
      borderBottom: style.borderBottomWidth,
      minHeight: style.minHeight,
      whiteSpace: style.whiteSpace,
      inlineHeight: (element as HTMLElement).style.height,
      inlineMinHeight: (element as HTMLElement).style.minHeight,
      tokens: element.getAttribute('data-pui-style'),
      text: element.textContent,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });
}
async function selectionPaint(element: Locator, backgroundRole: string, foregroundRole: string) {
  return element.evaluate(
    (element, roles) => {
      const selection = getComputedStyle(element, '::selection');
      const probe = document.createElement('span');
      probe.style.backgroundColor = `var(--pui-${roles.backgroundRole})`;
      probe.style.color = `var(--pui-${roles.foregroundRole})`;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      element.parentElement!.append(probe);
      try {
        const expected = getComputedStyle(probe);
        return {
          background: selection.backgroundColor,
          foreground: selection.color,
          expectedBackground: expected.backgroundColor,
          expectedForeground: expected.color,
          userSelect: getComputedStyle(element).userSelect,
          shadowRoot: element.getRootNode() instanceof ShadowRoot,
          familyScope:
            element
              .closest('[data-site-control-family]')
              ?.getAttribute('data-site-control-family') ?? null,
          backgroundRoleValue: getComputedStyle(element)
            .getPropertyValue(`--pui-${roles.backgroundRole}`)
            .trim(),
          foregroundRoleValue: getComputedStyle(element)
            .getPropertyValue(`--pui-${roles.foregroundRole}`)
            .trim(),
        };
      } finally {
        probe.remove();
      }
    },
    { backgroundRole, foregroundRole }
  );
}

async function chooseTheme(page: Page, theme: 'light' | 'dark') {
  if (
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme === 'dark') === (theme === 'dark'),
      theme
    )
  )
    return;
  await revealHeaderPreferences(page);
  await page
    .locator(
      '.site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
    )
    .click();
  await page.waitForFunction(
    (theme) => (document.documentElement.dataset.theme === 'dark') === (theme === 'dark'),
    theme
  );
}

async function textPoint(element: Locator, last = false) {
  return element.evaluate((element, last) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let next = walker.nextNode(); next; next = walker.nextNode())
      if (next.textContent?.trim()) texts.push(next as Text);
    const text = last ? texts.at(-1)! : texts[0]!;
    const range = document.createRange();
    range.setStart(text, last ? Math.max(0, text.length - 1) : 0);
    range.setEnd(text, last ? text.length : 1);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, last);
}

describe.sequential('Base Button selection and family-owned homepage geometry', () => {
  for (const runtime of RUNTIMES)
    for (const family of ['shadcn', 'brutalist'] as const) {
      it(`${runtime}/${family} preserves local selection policy, public height and editing`, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage();
        const errors: string[] = [],
          record: Record<string, unknown> = {
            ...source,
            runtime,
            family,
            browser: browser.version(),
          };
        page.on('pageerror', (error) => errors.push(error.message));
        const prefix = `${runtime}-${family}`;
        const capture = async (name: string) => {
          await page.screenshot({ path: join(directory, `${prefix}-${name}.png`) });
          await writeFile(join(directory, `${prefix}.json`), JSON.stringify(record, null, 2));
        };
        try {
          await page.addInitScript(
            (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
            runtime
          );
          await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
          await ready(page, runtime, 'shadcn');
          if (family === 'brutalist') {
            await revealHeaderPreferences(page);
            const choice = page.locator(
              '#home-preferences [data-projection-control="family"] [role="combobox"]'
            );
            await choice.click();
            const id = await choice.getAttribute('aria-controls');
            expect(id).toBeTruthy();
            await page
              .locator(`[id=${JSON.stringify(id)}]`)
              .getByRole('option', { name: 'Brutalist', exact: true })
              .click();
            await ready(page, runtime, family);
          }
          const actions = page.locator(
            '#homepage-hero-actions [data-projection-generation-state="active"] a[data-site-link-enhanced]'
          );
          expect(await actions.count()).toBe(2);
          const actionRecords: Array<Record<string, unknown>> = [];
          record.nativeActions = actionRecords;
          for (let index = 0; index < 2; index++) {
            const anchor = actions.nth(index);
            await anchor.scrollIntoViewIfNeeded();
            await page.mouse.move(0, 0);
            const body = anchor.locator(`[data-projection-prototype="${family}-surface-root"]`);
            const painted = await facts(body);
            const native = await anchor.evaluate((node) => ({
              tag: node.tagName,
              href: node.getAttribute('href'),
              role: node.getAttribute('role'),
              target: node.getAttribute('target'),
              rel: node.getAttribute('rel'),
            }));
            const action: Record<string, unknown> = { native, painted };
            actionRecords.push(action);
            expect(native.tag).toBe('A');
            expect(native.href).toBeTruthy();
            expect(native.role).toBeNull();
            expect(painted.height).toBe(family === 'shadcn' ? 36 : 40);
            expect(painted.userSelect).toBe('none');
            if (family === 'shadcn') {
              expect(painted.borderRadius).toBe('26px');
              expect(painted.paddingLeft).toBe('12px');
              expect(painted.paddingRight).toBe('12px');
              const text = await facts(
                anchor.locator('[data-projection-prototype="shadcn-text-root"]')
              );
              action.text = text;
              expect(text.fontSize).toBe('14px');
              expect(text.lineHeight).toBe('20px');
              const expectedPaint = await body.evaluate(
                (node, emphasis) => {
                  const probe = document.createElement('span');
                  probe.style.backgroundColor = `var(--pui-${emphasis})`;
                  probe.style.color = `var(--pui-${emphasis}-foreground)`;
                  node.append(probe);
                  const style = getComputedStyle(probe);
                  const expected = { background: style.backgroundColor, color: style.color };
                  probe.remove();
                  return expected;
                },
                index === 0 ? 'primary' : 'secondary'
              );
              action.expectedPaint = expectedPaint;
              await expect
                .poll(async () => (await facts(body)).background, { timeout: 2000 })
                .toBe(expectedPaint.background);
              await expect
                .poll(
                  async () =>
                    (await facts(anchor.locator('[data-projection-prototype="shadcn-text-root"]')))
                      .color,
                  { timeout: 2000 }
                )
                .toBe(expectedPaint.color);
              action.settledPaint = await facts(body);
              action.settledText = await facts(
                anchor.locator('[data-projection-prototype="shadcn-text-root"]')
              );
              expect(await anchor.locator('svg').count()).toBe(0);
            }
            await anchor.scrollIntoViewIfNeeded();
            await page.evaluate(() => getSelection()?.removeAllRanges());
            const start = await textPoint(anchor),
              end = await textPoint(anchor, true);
            const hit = await anchor.evaluate(
              (node, points) => {
                const describe = (target: Element | null) => ({
                  tag: target?.tagName ?? null,
                  ref: target?.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
                  href: target?.closest('a')?.getAttribute('href') ?? null,
                });
                const startHit = document.elementFromPoint(points.start.x, points.start.y);
                const endHit = document.elementFromPoint(points.end.x, points.end.y);
                const rect = node.getBoundingClientRect();
                return {
                  points,
                  scrollX,
                  scrollY,
                  bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  startInside: !!startHit && node.contains(startHit),
                  endInside: !!endHit && node.contains(endHit),
                  startHit: describe(startHit),
                  endHit: describe(endHit),
                };
              },
              { start, end }
            );
            action.dragHit = hit;
            expect(hit.startInside).toBe(true);
            expect(hit.endInside).toBe(true);
            const pointerProbe = await anchor.evaluateHandle((node) => {
              const events: Array<{
                trusted: boolean;
                inside: boolean;
                x: number;
                y: number;
                tag: string | null;
              }> = [];
              const listener = (event: PointerEvent) =>
                events.push({
                  trusted: event.isTrusted,
                  inside: event.target instanceof Node && node.contains(event.target),
                  x: event.clientX,
                  y: event.clientY,
                  tag: event.target instanceof Element ? event.target.tagName : null,
                });
              document.addEventListener('pointerdown', listener, true);
              return {
                events,
                stop: () => document.removeEventListener('pointerdown', listener, true),
              };
            });
            try {
              await page.mouse.move(start.x, start.y);
              await page.mouse.down();
              await page.mouse.move(end.x, end.y, { steps: 12 });
              await page.mouse.up();
              const pointerEvents = await pointerProbe.evaluate((probe) => probe.events);
              action.dragPointerEvents = pointerEvents;
              expect(pointerEvents).toHaveLength(1);
              expect(pointerEvents[0]?.trusted).toBe(true);
              expect(pointerEvents[0]?.inside).toBe(true);
              action.dragSelection = await page.evaluate(() => getSelection()?.toString() ?? '');
              expect(action.dragSelection).toBe('');
            } finally {
              await pointerProbe.evaluate((probe) => probe.stop());
              await pointerProbe.dispose();
            }
          }
          await capture('native-actions');
          // The authored in-page Demo destination keeps native Enter activation.
          const demoAction = actions.filter({ hasText: 'Demo' });
          expect(await demoAction.count()).toBe(1);
          const demoHref = await demoAction.getAttribute('href');
          expect(demoHref).toBe('#home-demo-previewer');
          const expectedDemoUrl = new URL(demoHref!, page.url()).href;
          await demoAction.focus();
          await page.keyboard.press('Enter');
          await expect.poll(() => page.url()).toBe(expectedDemoUrl);
          record.nativeDemoEnterUrl = new URL(page.url()).pathname + new URL(page.url()).hash;
          const reset = page.locator(
            '[data-home-showcase] [data-projection-generation-state="active"] [data-demo-ref="editor-reset"]'
          );
          await reset.waitFor({ state: 'visible' });
          await reset.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          const normal = await facts(reset);
          record.normal = normal;
          // Record the actual glyph provider, not just the CSS fallback stack.
          try {
            const fontSession = await context.newCDPSession(page);
            try {
              await fontSession.send('DOM.enable');
              await fontSession.send('CSS.enable');
              const { root } = await fontSession.send('DOM.getDocument');
              const { nodeId } = await fontSession.send('DOM.querySelector', {
                nodeId: root.nodeId,
                selector:
                  '[data-home-showcase] [data-projection-generation-state="active"] [data-demo-ref="editor-reset"]',
              });
              record.platformFonts = await fontSession.send('CSS.getPlatformFontsForNode', {
                nodeId,
              });
            } finally {
              await fontSession.detach();
            }
          } catch (error) {
            record.platformFontObservationError = String(error);
          }
          await capture('normal');
          expect(normal.userSelect).toBe('none');
          expect(normal.inlineHeight).toBe('');
          expect(normal.inlineMinHeight).toBe('');
          expect(normal.minHeight).toBe(family === 'shadcn' ? '32px' : '40px');
          expect(normal.height).toBe(family === 'shadcn' ? 32 : 40);
          if (family === 'shadcn') {
            expect(normal.borderRadius).toBe('18px');
            expect(normal.paddingLeft).toBe('12px');
            expect(normal.paddingRight).toBe('12px');
            expect(normal.fontSize).toBe('14px');
            expect(normal.lineHeight).toBe('20px');
          }
          expect(normal.whiteSpace).toBe('normal');
          // Actual native drag initiated inside the command label, not a scripted Range.
          await page.evaluate(() => getSelection()?.removeAllRanges());
          const start = await textPoint(reset),
            end = await textPoint(reset, true);
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          await page.mouse.move(end.x, end.y, { steps: 12 });
          await page.mouse.up();
          record.commandDrag = await page.evaluate(() => getSelection()?.toString() ?? '');
          await capture('command-drag');
          expect(record.commandDrag).toBe('');
          // Neighboring document text remains selectable. Ctrl+A is recorded separately:
          // range containment is NOT evidence of copy protection or a failed select-none.
          const heading = page.locator('h1').first();
          await heading.scrollIntoViewIfNeeded();
          const headingPoint = await textPoint(heading);
          await page.mouse.click(headingPoint.x, headingPoint.y, { clickCount: 3 });
          const prose = await page.evaluate(() => getSelection()?.toString().trim() ?? '');
          record.proseSelection = prose;
          expect(prose.length).toBeGreaterThan(0);
          await page.keyboard.press('Control+a');
          record.documentSelectAll = await page.evaluate(() => ({
            text: getSelection()?.toString(),
            ranges: getSelection()?.rangeCount,
          }));
          await capture('document-select-all');
          expect((record.documentSelectAll as { ranges: number }).ranges).toBeGreaterThan(0);
          await page.evaluate(() => getSelection()?.removeAllRanges());
          const editor = page.getByRole('textbox', { name: '编辑示例文本', exact: true });
          const sample = '用同一份原型，组合你的界面。';
          expect(await editor.inputValue()).toBe(sample);
          await editor.fill('Selectable editing remains available');
          await editor.press('Control+a');
          expect(
            await editor.evaluate((node) => {
              const input = node as HTMLTextAreaElement;
              return input.value.slice(input.selectionStart, input.selectionEnd);
            })
          ).toBe('Selectable editing remains available');
          const probe = await reset.evaluateHandle((original) => {
            const selector =
              '[data-home-showcase] [data-projection-generation-state="active"] [data-demo-ref="editor-reset"]';
            const identities = new WeakMap<Node, number>();
            let nextId = 0;
            const id = (node: Node | null) => {
              if (!node) return null;
              if (!identities.has(node)) identities.set(node, ++nextId);
              return identities.get(node)!;
            };
            const snapshot = () => {
              const button = document.querySelector(selector);
              const input = document.querySelector(
                '[data-home-showcase] [data-projection-generation-state="active"] [data-demo-ref="editor-text"]'
              );
              return {
                originalButtonId: id(original),
                originalConnected: original.isConnected,
                currentButtonId: id(button),
                editorId: id(input),
                focusedId: id(document.activeElement),
                focusedWithinButton: Boolean(button?.contains(document.activeElement)),
              };
            };
            const events: Array<Record<string, unknown>> = [];
            const observe = (event: Event) => {
              const keyboard = event instanceof KeyboardEvent ? event : null;
              events.push({
                type: event.type,
                key: keyboard?.key ?? null,
                code: keyboard?.code ?? null,
                repeat: keyboard?.repeat ?? null,
                trusted: event.isTrusted,
                targetId: id(event.target instanceof Node ? event.target : null),
                targetWithinButton: Boolean(
                  event.target instanceof Node &&
                  document.querySelector(selector)?.contains(event.target)
                ),
                ...snapshot(),
              });
            };
            for (const type of ['keydown', 'keyup', 'click'])
              document.addEventListener(type, observe, true);
            return {
              snapshot,
              events,
              clear: () => events.splice(0),
              stop: () => {
                for (const type of ['keydown', 'keyup', 'click'])
                  document.removeEventListener(type, observe, true);
              },
            };
          });
          try {
            for (const key of ['Space', 'Enter'] as const) {
              if (key === 'Enter') await editor.fill('Second edit');
              await reset.focus();
              await probe.evaluate((probe) => probe.clear());
              const before = await probe.evaluate((probe) => probe.snapshot());
              const activation: Record<string, unknown> = { key, before, expectedValue: sample };
              record[`keyboard${key}`] = activation;
              try {
                expect(before.focusedWithinButton).toBe(true);
                // One native key sequence only. The void setProps API does not
                // promise that a framework's visible DOM commit is synchronous.
                await page.keyboard.press(key);
                activation.immediateValue = await editor.inputValue();
                activation.immediateIdentity = await probe.evaluate((probe) => probe.snapshot());
                await expect
                  .poll(() => editor.inputValue(), { timeout: 2_000, interval: 20 })
                  .toBe(sample);
                activation.settledValue = await editor.inputValue();
                const events = await probe.evaluate((probe) => probe.events);
                for (const type of ['keydown', 'keyup']) {
                  const matching = events.filter(
                    (event) => event.type === type && event.code === key
                  );
                  expect(matching).toHaveLength(1);
                  expect(matching[0]!.targetWithinButton).toBe(true);
                  expect(matching[0]!.trusted).toBe(true);
                  expect(matching[0]!.repeat).toBe(false);
                }
              } finally {
                activation.finalIdentity = await probe.evaluate((probe) => probe.snapshot());
                activation.finalValue = await editor.inputValue();
                // Native click observations are not equated with semantic callback counts.
                activation.nativeEvents = await probe.evaluate((probe) => probe.events);
                await capture(`keyboard-${key.toLowerCase()}`);
              }
            }
          } finally {
            await probe.evaluate((probe) => probe.stop());
            await probe.dispose();
          }
          // Font enlargement is not browser zoom. Do not rewrite any button dimensions.
          const selectionModes: Array<Record<string, unknown>> = [];
          record.themeSelection = selectionModes;
          for (const theme of ['light', 'dark'] as const) {
            await chooseTheme(page, theme);
            await ready(page, runtime, family);
            await heading.scrollIntoViewIfNeeded();
            const point = await textPoint(heading);
            await page.mouse.click(point.x, point.y, { clickCount: 3 });
            const selectedProse = await page.evaluate(
              () => getSelection()?.toString().trim() ?? ''
            );
            expect(selectedProse.length).toBeGreaterThan(0);
            const prosePaint = await selectionPaint(heading, 'selection', 'selection-foreground');
            const observation: Record<string, unknown> = { theme, prosePaint, selectedProse };
            selectionModes.push(observation);
            await capture(`selection-${theme}-prose`);
            // The website h1 keeps the global Shadcn palette; the family switch
            // changes only its explicit projection boundaries.
            expect(prosePaint.familyScope).not.toBe('brutalist');
            expect(prosePaint.backgroundRoleValue).not.toBe('');
            expect(prosePaint.foregroundRoleValue).not.toBe('');
            expect(prosePaint.background).toBe(prosePaint.expectedBackground);
            expect(prosePaint.foreground).toBe(prosePaint.expectedForeground);
            expect(prosePaint.userSelect).not.toBe('none');
            await editor.scrollIntoViewIfNeeded();
            await editor.press('Control+a');
            observation.selectedEditor = await editor.evaluate((node) => {
              const input = node as HTMLTextAreaElement;
              return {
                value: input.value,
                selected: input.value.slice(input.selectionStart, input.selectionEnd),
              };
            });
            const editorPaint = await selectionPaint(
              editor,
              family === 'brutalist' ? 'main' : 'selection',
              family === 'brutalist' ? 'main-foreground' : 'selection-foreground'
            );
            observation.editorPaint = editorPaint;
            await capture(`selection-${theme}-editor`);
            expect((observation.selectedEditor as { selected: string }).selected).toBe(sample);
            expect(editorPaint.backgroundRoleValue).not.toBe('');
            expect(editorPaint.foregroundRoleValue).not.toBe('');
            expect(editorPaint.background).toBe(editorPaint.expectedBackground);
            expect(editorPaint.foreground).toBe(editorPaint.expectedForeground);
            expect(editorPaint.userSelect).not.toBe('none');
            // Website WC is light DOM, not evidence of separate Shadow installation.
            expect(editorPaint.shadowRoot).toBe(false);
          }
          expect((selectionModes[0].prosePaint as { background: string }).background).not.toBe(
            (selectionModes[1].prosePaint as { background: string }).background
          );
          await chooseTheme(page, 'light');
          await ready(page, runtime, family);
          const motionRecords: Array<Record<string, unknown>> = [];
          record.motion = motionRecords;
          const observeMotion = async (font: number) => {
            if (family !== 'brutalist') return;
            await reset.scrollIntoViewIfNeeded();
            await page.mouse.move(0, 0);
            const original = await reset.elementHandle();
            if (!original) throw new Error('Missing mounted motion subject');
            try {
              for (const reduced of [false, true]) {
                await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
                await expect
                  .poll(() => reset.evaluate((node) => getComputedStyle(node).transitionProperty))
                  .toBe(reduced ? 'none' : 'all');
                for (const direction of ['enter', 'release'] as const) {
                  const { frames, error } = await recordButtonMotion(page, reset, direction);
                  motionRecords.push({ font, reduced, direction, frames, error });
                  // Preserve the actual trace and screenshot even if a curve assertion fails.
                  await capture(`motion-${font}-${reduced ? 'reduce' : 'normal'}-${direction}`);
                  expect(error).toBeNull();
                  expect(buttonMotionIssues(frames, direction, font / 4, reduced)).toEqual([]);
                  expect(frames.at(-1)!.pressed).toBe(direction === 'enter');
                }
              }
              await page.emulateMedia({ reducedMotion: 'no-preference' });
              await expect
                .poll(() => reset.evaluate((node) => getComputedStyle(node).transitionProperty))
                .toBe('all');
              expect(await original.evaluate((node) => node.isConnected)).toBe(true);
            } finally {
              await page.mouse.up();
              await original.dispose();
            }
          };
          await observeMotion(16);
          await page.setViewportSize({ width: 390, height: 1000 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          const enlargedActions: Array<
            Awaited<ReturnType<typeof facts>> & {
              initial: Awaited<ReturnType<typeof facts>>;
              animations: Array<{
                property: string | null;
                currentTime: Animation['currentTime'];
                playState: Animation['playState'];
                timing?: ReturnType<AnimationEffect['getComputedTiming']>;
              }>;
              settled: boolean;
            }
          > = [];
          record.nativeActionsEnlarged = {
            textScale: 200,
            browserZoomVerified: false,
            bodies: enlargedActions,
          };
          for (let index = 0; index < 2; index++) {
            const anchor = actions.nth(index);
            const body = anchor.locator(`[data-projection-prototype="${family}-surface-root"]`);
            const initial = await facts(body);
            const animations = await body.evaluate((node) =>
              node.getAnimations().map((animation) => ({
                property: animation instanceof CSSTransition ? animation.transitionProperty : null,
                currentTime: animation.currentTime,
                playState: animation.playState,
                timing: animation.effect?.getComputedTiming(),
              }))
            );
            const observation = { ...initial, initial, animations, settled: false };
            enlargedActions.push(observation);
            await capture(`native-actions-text200-${index}-before-assert`);
            // Public transition-all also interpolates layout after font enlargement.
            // Keep the immediate observation, then require the exact source endpoint.
            await expect
              .poll(async () => (await facts(body)).minHeight, { timeout: 2_000 })
              .toBe(family === 'shadcn' ? '72px' : '80px');
            const geometry = await facts(body);
            Object.assign(observation, geometry, { settled: true });
            expect(geometry.minHeight).toBe(family === 'shadcn' ? '72px' : '80px');
            expect(geometry.height).toBeGreaterThanOrEqual(family === 'shadcn' ? 72 : 80);
            expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
          }
          await reset.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          record.enlargedImmediate = await facts(reset);
          await expect
            .poll(async () => (await facts(reset)).height, { timeout: 2_000 })
            .toBe(family === 'shadcn' ? 64 : 80);
          const enlarged = await facts(reset);
          record.enlarged = { ...enlarged, textScale: 200, browserZoomVerified: false };
          await capture('text200');
          expect(enlarged.height).toBe(family === 'shadcn' ? 64 : 80);
          expect(enlarged.height).toBeGreaterThan(normal.height);
          expect(enlarged.height).toBeGreaterThanOrEqual(parseFloat(enlarged.lineHeight));
          expect(enlarged.scrollWidth).toBeLessThanOrEqual(enlarged.clientWidth + 1);
          expect(enlarged.inlineHeight).toBe('');
          expect(enlarged.inlineMinHeight).toBe('');
          // Independent trigger owners are not converted to Base Button. Removing
          // the old page-wide geometry regex must not clip their labels at 200%.
          const triggerFacts = await page
            .locator('[data-home-gallery] [data-projection-prototype]')
            .evaluateAll((nodes) =>
              nodes
                .filter((node) =>
                  /-(?:dialog-trigger|dropdown(?:-menu)?-trigger)$/.test(
                    node.getAttribute('data-projection-prototype') ?? ''
                  )
                )
                .map((node) => {
                  // The unstyled DialogTrigger delegates its painted action to its authored Button.
                  const subject =
                    node.querySelector<HTMLElement>(
                      '[data-projection-prototype="shadcn-button"]'
                    ) ?? node;
                  const style = getComputedStyle(subject),
                    bounds = subject.getBoundingClientRect();
                  const range = document.createRange();
                  range.selectNodeContents(subject);
                  const text = range.getBoundingClientRect();
                  return {
                    prototype: node.getAttribute('data-projection-prototype'),
                    display: style.display,
                    height: bounds.height,
                    width: bounds.width,
                    clientWidth: subject.clientWidth,
                    scrollWidth: subject.scrollWidth,
                    textHeight: text.height,
                    textWidth: text.width,
                    inlineHeight: (node as HTMLElement).style.height,
                    inlineMinHeight: (node as HTMLElement).style.minHeight,
                  };
                })
            );
          record.independentTriggers = triggerFacts;
          expect(triggerFacts.length).toBeGreaterThanOrEqual(2);
          for (const trigger of triggerFacts) {
            expect(trigger.inlineHeight).toBe('');
            expect(trigger.inlineMinHeight).toBe('');
            // display:contents is an ownership wrapper, not a painted hit area.
            if (trigger.display !== 'contents') {
              expect(trigger.height).toBeGreaterThanOrEqual(trigger.textHeight - 1);
              expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth + 1);
            }
          }
          await observeMotion(32);
          // Native Space may scroll. Test it after pointer evidence so normal browser
          // scrolling cannot move a previously sampled drag origin to ordinary prose.
          expect(await actions.count()).toBe(2);
          for (let index = 0; index < 2; index++) {
            const anchor = actions.nth(index);
            // A native anchor is not a Button: Space must not synthesize click/navigation.
            const clicks = await anchor.evaluateHandle((node) => {
              const state = { count: 0 };
              const listener = () => state.count++;
              node.addEventListener('click', listener);
              return { state, stop: () => node.removeEventListener('click', listener) };
            });
            try {
              const beforeUrl = page.url();
              await anchor.focus();
              await page.keyboard.press('Space');
              expect(await clicks.evaluate((probe) => probe.state.count)).toBe(0);
              expect(page.url()).toBe(beforeUrl);
            } finally {
              await clicks.evaluate((probe) => probe.stop());
              await clicks.dispose();
            }
          }
          expect(errors).toEqual([]);
        } finally {
          record.errors = errors;
          await capture('final').catch(() => {});
          await context.close();
        }
      }, 120_000);
    }
});
