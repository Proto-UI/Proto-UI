// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { searchPart, searchInput, readSearchPublicState } from './site-search-public-browser';
import { describe, expect, it } from 'vitest';
import {
  installSearchStartupTrace,
  readSearchReadyWithinBudget,
  searchReadinessWasOnTime,
  traceSearchGetter,
  homepageRollbackWasOnTime,
} from './site-search-evidence';
import path from 'node:path';
import type { CDPSession } from 'playwright-core';
import {
  browser,
  baseUrl,
  source,
  searchRoute,
  evidenceDirectory,
  diagnosticPages,
  stage,
  captureFailure,
  capture,
  installOpenCounter,
  expectSearchOpenerFocus,
  runtimeLabels,
  choosePageControl,
  homeReady,
  installSuccessfulEmptySearchData,
  headerTriggerViewports,
} from './site-search-browser';

// The standard harness serves Astro dev; actual generated-index search is proved
// development warning instead of Pagefind. These cases prove actual command
// projection, responsive layout, modal activation and focus restoration; they
// do not claim a live production index or retry has been exercised.
describe.sequential('Search family Button commands', () => {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      for (const width of [390, 1440]) {
        it(`${family} ${theme} ${width}px preserves activation, dismissal and focus`, async () => {
          const context = await browser.newContext({
            viewport: { width, height: 960 },
            colorScheme: theme,
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.addInitScript(
            (theme) => localStorage.setItem('starlight-theme', theme),
            theme
          );
          await installOpenCounter(page);
          await page.addInitScript(installSearchStartupTrace);
          const id = `${family}-${theme}-${width}`;
          stage(page, id, 'navigate');
          try {
            await installSuccessfulEmptySearchData(page);
            const response = await page.goto(`${baseUrl}${searchRoute(family)}`, {
              waitUntil: 'networkidle',
            });
            expect(response?.ok(), `Expected existing ${family} documentation route`).toBe(true);
            const trigger = page.locator(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            );

            stage(page, id, 'initial-ready');
            try {
              const entry = diagnosticPages.get(page)!;
              // Retain the original stage-start deadline; exclude only the
              // return trip of a browser observation already made on time.
              await traceSearchGetter(entry.initialGetterSamples, async () => {
                const evidence = await page.evaluate(readSearchReadyWithinBudget, {
                  startedAt: entry.stageStartedAt,
                });
                entry.initialReadiness = evidence;
                // Persist successful and failed observations after the browser
                // clock has decided readiness; file I/O cannot move its deadline.
                entry.writes = entry.writes.then(async () => {
                  await mkdir(evidenceDirectory, { recursive: true });
                  await writeFile(
                    path.join(evidenceDirectory, `${id}-readiness.json`),
                    JSON.stringify(
                      { source, id, evidence, onTime: searchReadinessWasOnTime(evidence) },
                      null,
                      2
                    )
                  );
                });
                return evidence.currentDisabled;
              });
              expect(
                searchReadinessWasOnTime(entry.initialReadiness!),
                JSON.stringify(entry.initialReadiness)
              ).toBe(true);
            } catch (error) {
              diagnosticPages.get(page)!.initialPollFailure = {
                at: Date.now(),
                message: String(error),
                cause:
                  error instanceof Error && error.cause ? String(error.cause).slice(0, 400) : null,
              };
              throw error;
            }
            await page.evaluate(() => (window as any).__puiSearchStartup?.stop());
            expect(
              await trigger.evaluate((button) => {
                (window as any).__puiSearchInitialOpener = button;
                return button.localName;
              })
            ).toBe(`wc-${family}-button`);
            expect(await trigger.getAttribute('role')).toBe('button');
            await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe(theme);
            // Each Header consumes its public family Button presentation.
            const triggerTokens = await trigger.getAttribute('data-pui-style');
            expect(triggerTokens).toContain(
              family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary'
            );
            if (family === 'shadcn') {
              expect(triggerTokens).toContain('border-transparent');
              const rest = await trigger.evaluate((node) => ({
                border: getComputedStyle(node).borderTopColor,
                background: getComputedStyle(node).backgroundColor,
              }));
              expect(rest.border).toBe('rgba(0, 0, 0, 0)');
              expect(rest.background).not.toBe('rgba(0, 0, 0, 0)');
            } else {
              expect(triggerTokens).toContain('border-black');
              expect(triggerTokens).toContain('shadow-[4px_4px_0_0_#000]');
            }
            const box = await trigger.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(43);
            if (width < 1100) expect(box!.width).toBeCloseTo(44, 0);
            else expect(box!.width).toBeGreaterThan(150);
            await capture(page, id, 'trigger');
            await trigger.locator('svg').click();
            // The Dialog materializes in its own lazy scope; resolve its close
            // control only after the open intent, so the locator binds the
            // Dialog's own committed generation.
            const close = await searchPart(page, 'close');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(true);
            expect((await page.evaluate(readSearchPublicState)).openCount).toBe(1);
            expect(await close.getAttribute('role')).toBe('button');
            expect(await close.locator('[role=button],button').count()).toBe(0);
            await capture(page, id, 'open');
            await close.click();
            await expectSearchOpenerFocus(page, trigger, id, 'close-click');
            await trigger.press('Enter');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).openCount)
              .toBe(2);
            await page.keyboard.press('Escape');
            await expectSearchOpenerFocus(page, trigger, id, 'escape');
            await trigger.press('Space');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).openCount)
              .toBe(3);
            stage(page, id, 'backdrop');
            await page.mouse.click(2, 2);
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(false);
            await expectSearchOpenerFocus(page, trigger, id, 'backdrop');
            for (const key of ['Control+k', 'Meta+k']) {
              await page.keyboard.press(key);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              await page.keyboard.press(key);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              await expectSearchOpenerFocus(page, trigger, id, `shortcut-${key}`);
            }
            for (const closeKey of ['Enter', 'Space']) {
              await trigger.click();
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              await close.press(closeKey);
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              await expectSearchOpenerFocus(page, trigger, id, `close-${closeKey}`);
            }
            expect((await page.evaluate(readSearchPublicState)).openCount).toBe(7);
            await capture(page, id, 'keyboard-close');
            if (width === 1440) {
              // User-reported bottom Ctrl+K regression: modal semantics may make
              // background inert, but cannot visually remove or relocate the rails.
              await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
              const rails = () =>
                page.evaluate(() => ({
                  scrollY,
                  anchorY: document.querySelector('main')!.getBoundingClientRect().y,
                  nodes: ['#starlight__sidebar', '.right-sidebar'].map((selector) => {
                    const node = document.querySelector<HTMLElement>(selector);
                    if (!node) throw new Error(`Missing required desktop rail: ${selector}`);
                    return {
                      selector,
                      box: node.getBoundingClientRect().toJSON(),
                      visible: node.checkVisibility({
                        checkOpacity: true,
                        checkVisibilityCSS: true,
                      }),
                      display: getComputedStyle(node).display,
                      visibility: getComputedStyle(node).visibility,
                      opacity: getComputedStyle(node).opacity,
                    };
                  }),
                }));
              const before = await rails();
              for (const rail of before.nodes) expect(rail.visible).toBe(true);
              await page.keyboard.press('Control+k');
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(true);
              const opened = await rails();
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened }, null, 2)
              );
              for (const [index, rail] of opened.nodes.entries()) {
                expect(rail.visible).toBe(true);
                for (const key of ['x', 'y', 'width', 'height'] as const)
                  expect(
                    Math.abs(rail.box[key] - before.nodes[index].box[key])
                  ).toBeLessThanOrEqual(1);
              }
              expect(Math.abs(opened.anchorY - before.anchorY)).toBeLessThanOrEqual(1);
              await capture(page, id, 'bottom-open');
              await page.keyboard.press('Escape');
              await expect
                .poll(async () => (await page.evaluate(readSearchPublicState)).open)
                .toBe(false);
              const closed = await rails();
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened, closed }, null, 2)
              );
              expect(Math.abs(closed.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
              for (const rail of closed.nodes) expect(rail.visible).toBe(true);
              await writeFile(
                path.join(evidenceDirectory, `${id}-bottom-rails.json`),
                JSON.stringify({ source, before, opened, closed }, null, 2)
              );
            }
            expect(errors).toEqual([]);
          } catch (error) {
            await captureFailure(page, error);
            throw error;
          } finally {
            await context.close();
          }
        }, 60_000);
      }
    }
  }
});

for (const viewport of headerTriggerViewports) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
      it(`homepage ${family}/${runtime} ${viewport.name} keeps the Search trigger centered through closed/open/reopen`, async () => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const id = `header-trigger-${family}-${runtime}-${viewport.name}`;
        stage(page, id, 'navigate');
        try {
          await installSuccessfulEmptySearchData(page);
          expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
            true
          );
          await homeReady(page, 'shadcn', 'wc');
          if (family === 'brutalist') {
            await choosePageControl(page, 'family', 'Brutalist');
            await homeReady(page, family, 'wc');
          }
          if (runtime !== 'wc') {
            await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
            await homeReady(page, family, runtime);
          }
          // Compact runtime selection uses the real Header menu. Close that
          // disclosure before testing Search; do not force hidden controls.
          const menu = page.locator(
            '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
          );
          if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
          // The geometry oracle compares resting controls. Closing the real
          // compact menu leaves the pointer over its Button; Brutalist's
          // authored 4px hover translation must finish after a real pointer
          // departure before recording that resting baseline.
          await page.mouse.move(viewport.width / 2, viewport.height - 12);
          await expect
            .poll(() =>
              menu.evaluate((node) =>
                node
                  .getAnimations()
                  .some((animation) => animation.pending || animation.playState === 'running')
              )
            )
            .toBe(false);
          const trigger = page.locator(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          );
          const waitForClosedPortals = async () => {
            for (const ref of ['mask', 'panel']) {
              await expect
                .poll(async () =>
                  page.evaluate((ref) => {
                    // Observe the Dialog's own portals by owner.  Before the
                    // Dialog's first open there is no committed generation, so
                    // the owner-scoped observation stays valid in every state.
                    const search = document.querySelector<HTMLElement>('site-search');
                    const mount = search?.querySelector<HTMLElement>('[data-search-dialog-mount]');
                    const owner = mount?.dataset.projectionOwner;
                    if (!owner) return true;
                    const nodes = [
                      ...document.querySelectorAll<HTMLElement>(
                        `[data-projection-owner="${CSS.escape(owner)}"][data-demo-ref="${ref}"]`
                      ),
                    ];
                    if (nodes.length === 0) return true;
                    return nodes.every(
                      (node) =>
                        node.hasAttribute('data-pui-view-detached') &&
                        getComputedStyle(node).display === 'none'
                    );
                  }, ref)
                )
                .toBe(true);
            }
          };
          const readGeometry = () =>
            page.locator('[data-homepage-runtime]').evaluate((header) => {
              const required = (selector: string, root: Element = header) => {
                const node = root.querySelector<HTMLElement>(selector);
                if (!node) throw new Error(`Missing Header geometry target: ${selector}`);
                return node;
              };
              const rect = (node: HTMLElement) => {
                const box = node.getBoundingClientRect();
                return {
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                  center: box.y + box.height / 2,
                  display: getComputedStyle(node).display,
                  lineHeight: getComputedStyle(node).lineHeight,
                };
              };
              const active = '[data-projection-generation-state="active"]';
              const search = required('site-search');
              const dialogMount = required('[data-search-dialog-mount]', search);
              const dialogContent = required(
                `${active} > .pui-projection-scope > .pui-projection-content`,
                dialogMount
              );
              // The Dialog content element carries its own scope generation, so
              // portaled content (mask, panel) is matched by the Dialog's own
              // committed generation and never by the opener's command
              // generation.
              const dialogGeneration = dialogContent.dataset.projectionGeneration ?? '';
              const portalSelector =
                `[data-projection-owner="${CSS.escape(dialogMount.dataset.projectionOwner!)}"]` +
                `[data-projection-generation="${CSS.escape(dialogGeneration)}"]`;
              return {
                family: search.dataset.searchFamily,
                runtime: search.dataset.searchRuntime,
                generation: dialogGeneration,
                wrapper: rect(required('.site-header-search')),
                trigger: rect(required(`${active} [data-open-modal]`, search)),
                peers: ['home-theme', 'home-menu'].map((ref) => ({
                  ref,
                  ...rect(required(`${active} [data-demo-ref="${ref}"]`)),
                })),
                dialogMount: rect(dialogMount),
                dialogContent: rect(dialogContent),
                dialogRoot: rect(required('[data-demo-ref="dialog"]', dialogContent)),
                portals: ['mask', 'panel'].map((ref) => ({
                  ref,
                  nodes: [
                    ...document.querySelectorAll<HTMLElement>(
                      `${portalSelector}[data-demo-ref="${ref}"]`
                    ),
                  ].map((node) => ({
                    ...rect(node),
                    transition: node.getAttribute('data-transition-state'),
                    detached: node.hasAttribute('data-pui-view-detached'),
                    outsideSearch: !search.contains(node),
                  })),
                })),
              };
            });
          // Visibility may become false at the start of leave because the
          // portal is inert. Require actual view retirement, not that early
          // snapshot, before measuring a closed owner or reopening it.
          await waitForClosedPortals();
          const initial = await readGeometry();
          expect(initial.generation).toBeTruthy();
          const recordGeometry = async (state: string, closed: boolean) => {
            stage(page, id, state);
            const geometry = await readGeometry();
            const publicState = await page.evaluate(readSearchPublicState);
            await mkdir(evidenceDirectory, { recursive: true });
            await writeFile(
              path.join(evidenceDirectory, `${id}-${state}-header-geometry.json`),
              JSON.stringify({ source, family, runtime, viewport, geometry, publicState }, null, 2)
            );
            await capture(page, id, state);
            expect(geometry.family).toBe(family);
            expect(geometry.runtime).toBe(runtime);
            expect(publicState.open).toBe(!closed);
            // Soft geometry assertions preserve every state measurement on the
            // negative control. They still fail the case, with the original 1px
            // geometry tolerance, instead of stopping at the first closed frame.
            expect.soft(Math.abs(geometry.trigger.height - 44)).toBeLessThanOrEqual(1);
            expect
              .soft(Math.abs(geometry.wrapper.height - geometry.trigger.height))
              .toBeLessThanOrEqual(1);
            expect.soft(Math.abs(geometry.trigger.y - initial.trigger.y)).toBeLessThanOrEqual(1);
            for (const peer of geometry.peers) {
              expect.soft(Math.abs(peer.height - 44)).toBeLessThanOrEqual(1);
              expect
                .soft(Math.abs(peer.center - geometry.trigger.center), peer.ref)
                .toBeLessThanOrEqual(1);
            }
            if (closed) {
              expect.soft(geometry.dialogMount.height).toBeLessThanOrEqual(1);
              expect.soft(geometry.dialogContent.height).toBeLessThanOrEqual(1);
              expect.soft(geometry.dialogRoot.height).toBeLessThanOrEqual(1);
            }
          };
          await recordGeometry('closed', true);
          for (const cycle of [0, 1]) {
            stage(page, id, cycle === 0 ? 'open' : 'reopen');
            if (cycle === 0) await trigger.click();
            else await trigger.press('Enter');
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(true);
            for (const ref of ['mask', 'panel']) {
              const part = await searchPart(page, ref);
              await expect.poll(() => part.getAttribute('data-transition-state')).toBe('entered');
            }
            const panel = await searchPart(page, 'panel');
            expect(await panel.count()).toBe(1);
            expect(await panel.getAttribute('data-projection-generation')).toBe(initial.generation);
            expect(await panel.getAttribute('data-projection-family')).toBe(family);
            expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
            expect(await panel.evaluate((node) => node.closest('site-search') === null)).toBe(true);
            await recordGeometry(cycle === 0 ? 'opened' : 'reopened', false);
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).inputFocused)
              .toBe(true);
            if (cycle === 0) {
              // Measure the resting Brutalist trigger when Escape returns focus.
              if (family === 'brutalist')
                await page.mouse.move(viewport.width / 2, viewport.height - 12);
              await page.keyboard.press('Escape');
            } else await (await searchPart(page, 'close')).click();
            await expect
              .poll(async () => (await page.evaluate(readSearchPublicState)).open)
              .toBe(false);
            await waitForClosedPortals();
            await recordGeometry(cycle === 0 ? 'closed-after-escape' : 'closed-after-button', true);
            await expect
              .poll(() => trigger.evaluate((node) => node === document.activeElement))
              .toBe(true);
          }
          expect(diagnosticPages.get(page)!.errors).toEqual([]);
        } catch (error) {
          await captureFailure(page, error);
          throw error;
        } finally {
          await context.close();
        }
      }, 60_000);
    }
  }
}

for (const width of [1280, 1440, 2048]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`homepage ${family} ${width}px aligns actual Search and both selectors in every runtime`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await installOpenCounter(page);
      try {
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (family === 'brutalist') await choosePageControl(page, 'family', 'Brutalist');
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          if (runtime !== 'wc') await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, family, runtime);
          const geometry = await page.locator('[data-homepage-runtime]').evaluate((home) => {
            const select = (name: string) =>
              home.querySelector<HTMLElement>(
                `[data-projection-generation-state="active"] [data-projection-control="${name}"] [role="combobox"]`
              )!;
            const search = home.querySelector<HTMLElement>(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            )!;
            const rect = (node: HTMLElement) => {
              const box = node.getBoundingClientRect();
              return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                bottom: box.bottom,
                center: box.y + box.height / 2,
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
              };
            };
            const selectors = ['family', 'runtime'].map((name) => {
              const trigger = select(name);
              const control = trigger.closest('[data-projection-control]')!;
              const value = trigger.querySelector<HTMLElement>(
                '[data-projection-prototype$="select-value"]'
              );
              return {
                name,
                trigger: rect(trigger),
                hasVisualLabel: !!control.querySelector('.pui-projection-control-label'),
                expectedLabel: (home as HTMLElement).dataset[`${name}Label`],
                value: value ? rect(value) : null,
                text: trigger.textContent,
              };
            });
            const searchRoot = home.querySelector<HTMLElement>('site-search')!;
            return {
              search: rect(search),
              selectors,
              overflow: document.documentElement.scrollWidth - innerWidth,
              pageGeneration: (home as HTMLElement).dataset.runtimeGeneration,
              searchGeneration: searchRoot.dataset.searchGeneration,
              commands: [
                ...searchRoot.querySelectorAll<HTMLElement>(
                  '[data-projection-generation-state="active"] [data-search-command]'
                ),
              ].map((node) => ({
                command: node.dataset.searchCommand,
                prototype: node.dataset.projectionPrototype,
                generation: node.dataset.projectionGeneration,
                runtime: node.dataset.projectionRuntime,
                family: node.dataset.projectionFamily,
              })),
            };
          });
          const id = `home-${family}-${runtime}-${width}`;
          await capture(page, id, 'geometry');
          await writeFile(
            path.join(evidenceDirectory, `${id}-rects.json`),
            JSON.stringify({ source, width, family, runtime, geometry }, null, 2)
          );
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(geometry.commands).toHaveLength(1);
          expect(geometry.commands[0].command).toBe('open');
          const panel = await searchPart(page, 'panel');
          expect(await panel.getAttribute('data-projection-generation')).toBe(
            geometry.pageGeneration
          );
          expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
          expect(await panel.getAttribute('data-projection-family')).toBe(family);
          expect(Math.abs(geometry.search.height - 44)).toBeLessThanOrEqual(1);
          for (const selector of geometry.selectors) {
            expect(Math.abs(selector.trigger.height - 44)).toBeLessThanOrEqual(1);
            expect(Math.abs(selector.trigger.bottom - geometry.search.bottom)).toBeLessThanOrEqual(
              1
            );
            expect(Math.abs(selector.trigger.center - geometry.search.center)).toBeLessThanOrEqual(
              1
            );
            // The Trigger owns the authored AX name without a separate visual label row.
            expect(selector.hasVisualLabel).toBe(false);
            expect(selector.expectedLabel).toBeTruthy();
            expect(
              await page
                .locator(
                  `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${selector.name}"]`
                )
                .getByRole('combobox', { name: selector.expectedLabel, exact: true })
                .count()
            ).toBe(1);
            expect(selector.trigger.scrollWidth - selector.trigger.clientWidth).toBeLessThanOrEqual(
              1
            );
            expect(selector.value, 'actual Select value projection').not.toBeNull();
            if (selector.value)
              expect(selector.value.scrollWidth - selector.value.clientWidth).toBeLessThanOrEqual(
                1
              );
          }
          for (const command of geometry.commands) {
            expect(command.prototype).toBe(`${family}-button`);
            expect(command.generation).toBe(geometry.pageGeneration);
            expect(command.runtime).toBe(runtime);
            expect(command.family).toBe(family);
          }
          const trigger = page.locator(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          );
          await trigger.locator('svg').click();
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(true);
          await page.keyboard.press('Escape');
          await expect
            .poll(() => trigger.evaluate((node) => node === document.activeElement))
            .toBe(true);
        }
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 180_000);
  }
}

it('homepage keeps one active public Search session through runtime transitions and repeat initialization', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await installOpenCounter(page);
  stage(page, 'home-open-runtime', 'navigate');
  try {
    expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
    await homeReady(page, 'shadcn', 'wc');
    await page
      .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
      .click();
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
    await (await searchInput(page)).fill('public-session-retained');
    await expect
      .poll(async () => (await page.evaluate(readSearchPublicState)).query)
      .toBe('public-session-retained');
    await page.evaluate(() => {
      const search = document.querySelector('site-search') as HTMLElement & {
        connectedCallback(): void;
      };
      search.connectedCallback();
      search.connectedCallback();
    });
    for (const runtime of ['react', 'vue', 'vue2', 'wc']) {
      const previousPanel = await (await searchPart(page, 'panel')).elementHandle();
      expect(previousPanel).not.toBeNull();
      const previousState = await page.evaluate(readSearchPublicState);
      await page.evaluate(
        (runtime) =>
          document.dispatchEvent(
            new CustomEvent('proto-adapter:change', { detail: { adapter: runtime } })
          ),
        runtime
      );
      await homeReady(page, 'shadcn', runtime);
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
      await expect.poll(() => previousPanel!.evaluate((node) => node.isConnected)).toBe(false);
      const currentState = await page.evaluate(readSearchPublicState);
      expect(currentState.generation).not.toBe(previousState.generation);
      expect(currentState.query).toBe(previousState.query);
      const panel = await searchPart(page, 'panel');
      expect(await panel.count()).toBe(1);
      expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
      stage(page, 'home-open-runtime', `${runtime}-close-focus`);
      await (await searchPart(page, 'close')).click();
      const trigger = page.locator(
        'site-search [data-projection-generation-state="active"] [data-open-modal]'
      );
      await expect
        .poll(() => trigger.evaluate((node) => node === document.activeElement))
        .toBe(true);
      await trigger.press('Space');
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
      await previousPanel!.dispose();
    }
    await capture(page, 'home-open-runtime', 'final');
  } catch (error) {
    await captureFailure(page, error);
    throw error;
  } finally {
    await context.close();
  }
}, 120_000);

it('keeps Bootstrap Homepage Search available after selecting the WIP family', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  stage(page, 'home-bootstrap-search', 'navigate');
  try {
    await installSuccessfulEmptySearchData(page);
    expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
    await homeReady(page, 'shadcn', 'wc');
    await choosePageControl(page, 'family', 'Bootstrap 2.3.2 · WIP');
    await homeReady(page, 'bootstrap-2-3-2', 'wc');
    await page
      .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
      .click();
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
    expect(await (await searchPart(page, 'panel')).getAttribute('data-projection-family')).toBe(
      'bootstrap-2-3-2'
    );
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(false);
  } catch (error) {
    await captureFailure(page, error);
    throw error;
  } finally {
    await context.close();
  }
}, 60_000);

it('retains Homepage Search Close focus across replacement and returns shortcut focus to the opener', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  stage(page, 'home-search-shortcut-handback', 'navigate');
  try {
    await installSuccessfulEmptySearchData(page);
    expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
    await homeReady(page, 'shadcn', 'wc');
    const trigger = page.locator(
      'site-search [data-projection-generation-state="active"] [data-open-modal]'
    );
    await trigger.click();
    const editor = await searchInput(page);
    await expect.poll(() => editor.evaluate((node) => node === document.activeElement)).toBe(true);
    const panel = await searchPart(page, 'panel');
    await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
    await (await searchPart(page, 'close')).focus();
    await page.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
      )
    );
    await homeReady(page, 'shadcn', 'react');
    const close = await searchPart(page, 'close');
    await expect.poll(() => close.evaluate((node) => node === document.activeElement)).toBe(true);
    await page.keyboard.press('Control+k');
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(false);
    await expect.poll(() => trigger.evaluate((node) => node === document.activeElement)).toBe(true);
    await capture(page, 'home-search-shortcut-handback', 'returned');
  } catch (error) {
    await captureFailure(page, error);
    throw error;
  } finally {
    await context.close();
  }
}, 60_000);

it.each(['query', 'close', 'newer focus'] as const)(
  'retains Homepage Search %s through a failure after replacement publication begins',
  async (focusedRef) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const id = `home-search-late-rollback-${focusedRef.replace(' ', '-')}`;
    let profile: CDPSession | undefined;
    stage(page, id, 'navigate');
    try {
      await installSuccessfulEmptySearchData(page);
      expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(true);
      await homeReady(page, 'shadcn', 'wc');
      const trigger = page.locator(
        'site-search [data-projection-generation-state="active"] [data-open-modal]'
      );
      await trigger.click();
      const panel = await searchPart(page, 'panel');
      await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
      const editor = await searchInput(page);
      await editor.fill('retained search query');
      await editor.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 9));
      const focused = focusedRef === 'close' ? await searchPart(page, 'close') : editor;
      await focused.focus();
      const before = await page.evaluate(readSearchPublicState);
      const originalPanel = await panel.elementHandle();
      const originalEditor = await editor.elementHandle();
      expect(originalPanel).not.toBeNull();
      expect(originalEditor).not.toBeNull();
      expect(await focused.evaluate((node) => node === document.activeElement)).toBe(true);
      const home = page.locator('[data-homepage-runtime]');
      await home.evaluate((root: HTMLElement, focusedRef) => {
        const dataset = root.dataset;
        const mount = root.querySelector('[data-search-dialog-mount]')!;
        const search = mount.closest<HTMLElement>('site-search')!;
        const descriptor = Object.getOwnPropertyDescriptor(root, 'dataset');
        const trace: unknown[] = [];
        const record = (kind: string, detail?: unknown, at = performance.now()) => {
          if (trace.length === 80) return;
          trace.push({
            at,
            kind,
            state: root.getAttribute('data-runtime-state'),
            runtime: root.getAttribute('data-runtime'),
            detail,
          });
        };
        Object.assign(window, { __puiSearchLateRollbackTrace: trace });
        record('installed');
        document.addEventListener('proto-adapter:change', () => record('runtime-request'), {
          capture: true,
          once: true,
        });
        // The cold framework preparation has the same readiness budget as a
        // successful swap. The 1000 ms rollback budget starts at the fault and
        // uses this page clock even if Node observes both states much later.
        const changes = new MutationObserver((records) => {
          const at = performance.now();
          const fault = (window as any).__puiSearchLateRollback;
          if (fault && fault.errorAt === null && root.dataset.runtimeState === 'error')
            fault.errorAt = at;
          record(
            'attributes',
            records.map((entry) => ({ name: entry.attributeName, previous: entry.oldValue })),
            at
          );
        });
        changes.observe(root, {
          attributes: true,
          attributeOldValue: true,
          attributeFilter: ['data-runtime-state', 'data-runtime', 'data-runtime-generation'],
        });
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          const tasks = new PerformanceObserver((entries) => {
            for (const task of entries.getEntries())
              record('longtask', { startTime: task.startTime, duration: task.duration });
          });
          tasks.observe({ type: 'longtask' });
        }
        const outside = focusedRef === 'newer focus' ? document.createElement('button') : null;
        if (outside) {
          outside.id = 'search-rollback-newer-focus';
          outside.textContent = 'Unrelated focus destination';
          document.body.append(outside);
        }
        let newerFocusLanded = false;
        Object.defineProperty(root, 'dataset', {
          configurable: true,
          value: new Proxy(dataset, {
            set(subject, key, value) {
              if (key === 'runtimeState' || key === 'runtime')
                record('publication-assignment', { key, value });
              if (outside && key === 'runtimeState' && value === 'loading') {
                outside.focus();
                newerFocusLanded = document.activeElement === outside;
              }
              if (key !== 'runtime' || value !== 'react' || dataset.runtimeState !== 'ready')
                return Reflect.set(subject, key, value, subject);
              const active = mount.querySelector<HTMLElement>(
                '[data-projection-generation-state="active"]'
              );
              let speculativeFocusLanded = false;
              if (active && focusedRef === 'close') {
                // The lazy React editor can still be mounting at this
                // synchronous publication boundary. Give the already
                // activated owner's native content carrier a real focus event.
                const carrier = active.querySelector<HTMLElement>(
                  '.pui-projection-content[data-projection-owner][data-projection-generation]'
                );
                if (carrier) {
                  carrier.tabIndex = -1;
                  carrier.focus();
                  speculativeFocusLanded = carrier === document.activeElement;
                }
              }
              const faultAt = performance.now();
              Object.assign(window, {
                __puiSearchLateRollback: {
                  faultAt,
                  errorAt: null,
                  generation: active?.dataset.projectionGenerationHost,
                  active: !!active && !active.inert,
                  searchRuntime: search.dataset.searchRuntime,
                  newerFocusLanded,
                  speculativeFocusLanded,
                },
              });
              record('publication-fault', undefined, faultAt);
              if (descriptor) Object.defineProperty(root, 'dataset', descriptor);
              else Reflect.deleteProperty(root, 'dataset');
              throw new Error('Controlled Homepage publication failure after Search activation');
            },
          }),
        });
      }, focusedRef);
      if (process.env.PROTO_UI_SEARCH_ROLLBACK_PROFILE === '1') {
        profile = await context.newCDPSession(page);
        await profile.send('Profiler.enable');
        await profile.send('Profiler.setSamplingInterval', { interval: 1000 });
        await profile.send('Profiler.start');
      }
      stage(page, id, 'rollback');
      await page.evaluate(() =>
        document.dispatchEvent(
          new CustomEvent('proto-adapter:change', { detail: { adapter: 'react' } })
        )
      );
      // Use the existing successful-swap readiness wait for the prerequisite,
      // then require recovery within 1000 ms of its actual page-side fault.
      await page.waitForFunction(() => (window as any).__puiSearchLateRollback?.faultAt != null);
      await expect.poll(() => home.getAttribute('data-runtime-state')).toBe('error');
      const fault = await page.evaluate(
        () =>
          (window as any).__puiSearchLateRollback as {
            faultAt: number;
            errorAt: number | null;
          }
      );
      await writeFile(
        path.join(evidenceDirectory, `${id}-fault.json`),
        JSON.stringify({ source, fault, previousGeneration: before.generation }, null, 2)
      );
      expect(fault).toMatchObject({
        faultAt: expect.any(Number),
        errorAt: expect.any(Number),
        generation: expect.any(String),
        active: true,
        searchRuntime: 'react',
        newerFocusLanded: focusedRef === 'newer focus',
        speculativeFocusLanded: focusedRef === 'close',
      });
      expect(
        homepageRollbackWasOnTime(fault),
        'Recovery must finish within 1000 ms of the fault'
      ).toBe(true);
      expect(fault).not.toMatchObject({ generation: before.generation });
      expect(await home.getAttribute('data-runtime')).toBe('wc');
      expect(
        await page.evaluate(async () => {
          const resource = performance
            .getEntriesByType('resource')
            .find(({ name }) =>
              new URL(name).pathname.endsWith('/components/site-search-commands.ts')
            );
          if (!resource) throw new Error('Missing active Search participant module');
          const browserImport = new Function('url', 'return import(url)') as (
            url: string
          ) => Promise<typeof import('../../../components/site-search-commands')>;
          const { searchCommandParticipant } = await browserImport(resource.name);
          return searchCommandParticipant(
            document.querySelector<HTMLElement>('site-search')!
          ).isOpen();
        })
      ).toBe(true);
      await expect
        .poll(() => page.evaluate(readSearchPublicState))
        .toMatchObject({
          generation: before.generation,
          open: true,
          query: 'retained search query',
        });
      expect(await panel.evaluate((node, old) => node === old, originalPanel)).toBe(true);
      expect(await editor.evaluate((node, old) => node === old, originalEditor)).toBe(true);
      expect(
        await editor.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])
      ).toEqual([2, 9]);
      const target =
        focusedRef === 'newer focus' ? page.locator('#search-rollback-newer-focus') : focused;
      await expect
        .poll(() => target.evaluate((node) => node === document.activeElement))
        .toBe(true);
      await capture(page, id, 'retained');
      await page.keyboard.press('Control+k');
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(false);
      await trigger.click();
      await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(true);
    } catch (error) {
      await captureFailure(page, error);
      throw error;
    } finally {
      if (profile) {
        try {
          const recording = await profile.send('Profiler.stop');
          await mkdir(evidenceDirectory, { recursive: true });
          await writeFile(
            path.join(evidenceDirectory, `${id}-cpu-profile.json`),
            JSON.stringify({ source, diagnosticOnly: true, ...recording })
          );
        } catch (error) {
          console.warn('[Search rollback] CPU diagnostic unavailable', error);
        } finally {
          await profile.detach().catch(() => {});
        }
      }
      await context.close();
    }
  },
  60_000
);

it('keeps a documentation link available without JavaScript', async () => {
  const startedAt = Date.now();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const steps: Array<{ stage: string; elapsedMs: number; url: string }> = [];
  const responses: Array<{ url: string; status: number; elapsedMs: number }> = [];
  let nativeHref: string | null = null;
  let headingText: string | null = null;
  let outcome = 'pending';
  const mark = (step: string) => {
    stage(page, 'no-js', step);
    steps.push({ stage: step, elapsedMs: Date.now() - startedAt, url: page.url() });
  };
  page.on('response', (response) => {
    if (response.request().isNavigationRequest() && response.request().frame() === page.mainFrame())
      responses.push({
        url: response.url(),
        status: response.status(),
        elapsedMs: Date.now() - startedAt,
      });
  });
  try {
    mark('navigate-source');
    const sourceResponse = await page.goto(`${baseUrl}${searchRoute('shadcn')}`, {
      timeout: 10_000,
    });
    expect(sourceResponse?.ok()).toBe(true);
    mark('find-native-link');
    const link = page.locator('site-search noscript a');
    expect(await link.isVisible()).toBe(true);
    nativeHref = await link.getAttribute('href');
    expect(nativeHref).not.toBeNull();
    expect(new URL(nativeHref!, page.url()).origin).toBe(new URL(baseUrl).origin);
    expect(new URL(nativeHref!, page.url()).pathname).toBe('/zh-cn/ui-libraries/shadcn/button/');
    mark('click-native-link');
    const [destinationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().isNavigationRequest() &&
          response.request().frame() === page.mainFrame() &&
          new URL(response.url()).pathname === '/zh-cn/ui-libraries/shadcn/button/',
        { timeout: 10_000 }
      ),
      page.waitForURL('**/zh-cn/ui-libraries/shadcn/button/', { timeout: 10_000 }),
      link.click({ timeout: 10_000 }),
    ]);
    expect(destinationResponse.ok()).toBe(true);
    mark('destination-heading');
    const heading = page.getByRole('heading', { level: 1, name: 'Button', exact: true });
    expect(await heading.isVisible()).toBe(true);
    headingText = await heading.innerText();
    expect(headingText).toBe('Button');
    expect(new URL(page.url()).pathname).toBe('/zh-cn/ui-libraries/shadcn/button/');
    outcome = 'passed';
    mark('complete');
    await capture(page, 'no-js', 'destination');
  } catch (error) {
    outcome = 'failed';
    mark('failure');
    await captureFailure(page, error);
    throw error;
  } finally {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(
      path.join(evidenceDirectory, 'no-js-navigation.json'),
      JSON.stringify(
        {
          source,
          outcome,
          javaScriptEnabled: false,
          totalBudgetMs: 20_000,
          navigationBudgetMs: 10_000,
          elapsedMs: Date.now() - startedAt,
          steps,
          responses,
          nativeHref,
          headingText,
          finalUrl: page.url(),
        },
        null,
        2
      )
    );
    await context.close();
  }
  // The implicit Vitest 5s total failed after the correct destination arrived.
  // Keep finite per-navigation and total budgets, without retry or sleep.
}, 20_000);
