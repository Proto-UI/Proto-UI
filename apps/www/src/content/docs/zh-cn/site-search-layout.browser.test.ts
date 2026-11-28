// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { searchPart, searchInput, readSearchPublicState } from './site-search-public-browser';
import { revealHeaderPreferences } from './site-header-browser';
import { describe, expect, it } from 'vitest';
import { settleFamilyQueryBatch } from './family-query-observer';
import { installDocsCallTimingObserver } from '../../../../test/helpers/docs-query-timing.mjs';
import { createQueryDispatchTrace } from './query-dispatch-trace.mjs';
import {
  readDocsAdapterRoleNow,
  traceSearchGetter,
  searchRevealMatchesViewport,
} from './site-search-evidence';
import path from 'node:path';
import type { SearchGetterSample } from './site-search-evidence';
import {
  browser,
  baseUrl,
  source,
  searchRoute,
  evidenceDirectory,
  stage,
  captureFailure,
  capture,
  runtimeLabels,
  installSuccessfulEmptySearchData,
} from './site-search-browser';

for (const width of [320, 390, 1280, 1440, 2048]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`Docs ${family} ${width}px shows complete runtime values beside real Search`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const roleTiming = installDocsCallTimingObserver(page, {
        sdkRoot: path.dirname(
          createRequire(import.meta.url).resolve('playwright-core/package.json')
        ),
      });
      const dispatchTrace =
        family === 'shadcn' && width === 1440 && process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
          ? createQueryDispatchTrace(
              page,
              path.join(evidenceDirectory, 'query-dispatch-shadcn-1440')
            )
          : null;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await dispatchTrace?.prepare();
        await page.addInitScript(roleTiming.targetObserver, roleTiming.initOptions);
        const response = await page.goto(`${baseUrl}${searchRoute(family)}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.ok()).toBe(true);
        const selector = page
          .locator('[data-docs-site-header] [data-adapter-select] [data-site-select-trigger]')
          .first();
        const roleGetters: SearchGetterSample[] = [];
        const roleRequests: Array<{ call: number; request: Promise<string | null> }> = [];
        let roleCalls = 0;
        let rolePassed = false;
        let roleObserverError = false;
        let roleVerdict: {
          frozenAt: number;
          calls: number;
          references: number;
          samples: SearchGetterSample[];
        } | null = null;
        try {
          await expect
            .poll(
              () => {
                const call = ++roleCalls;
                return traceSearchGetter(roleGetters, () => {
                  // Keep the original deadline around the same real control's DOM
                  // read, including RPC time, without cold locator-engine injection.
                  const request = roleTiming.runOriginalQuery(call, () =>
                    page.evaluate(readDocsAdapterRoleNow)
                  );
                  try {
                    roleRequests.push({ call, request });
                  } catch {
                    roleObserverError = true;
                  }
                  return request;
                });
              },
              { timeout: 1000 }
            )
            .toBe('combobox');
          rolePassed = true;
        } finally {
          try {
            roleTiming.freezeVerdict(rolePassed);
          } catch {
            roleObserverError = true;
          }
          try {
            const frozen = roleGetters.map((sample) => ({ ...sample }));
            roleVerdict = {
              frozenAt: Date.now(),
              calls: roleCalls,
              references: roleRequests.length,
              samples: frozen,
            };
            console.log(
              '[Docs role readiness]',
              JSON.stringify({
                source,
                family,
                width,
                roleRead: 'native-dom',
                frozenAt: roleVerdict.frozenAt,
                passed: rolePassed,
                calls: roleCalls,
                dropped: Math.max(0, roleCalls - frozen.length),
                pending: frozen.filter((sample) => sample.settledAt === undefined).length,
                samples: frozen,
              })
            );
          } catch {
            roleObserverError = true;
            // Diagnostics must not replace the original poll verdict.
          }
          const verdict = roleVerdict;
          try {
            dispatchTrace?.markVerdict(roleTiming.snapshot());
          } catch {
            // Diagnostics must not replace the original poll verdict.
          }
          if (!rolePassed && verdict) {
            try {
              const startedMs = performance.now();
              const budgetMs = 2000;
              const deadlineMs = startedMs + budgetMs;
              let drainedReferences = 0;
              let budgetExpired = false;
              let droppedOutcomes = 0;
              const outcomes: Array<Record<string, unknown>> = [];
              while (drainedReferences < roleRequests.length) {
                const batch = roleRequests.slice(drainedReferences);
                const result = await settleFamilyQueryBatch(
                  batch.map(({ request }) => request),
                  Math.max(0, deadlineMs - performance.now())
                );
                if (!result.complete) {
                  budgetExpired = true;
                  break;
                }
                const batchObservedMs = performance.now();
                result.outcomes.forEach((outcome, index) => {
                  if (outcomes.length < 32)
                    outcomes.push({
                      call: batch[index]!.call,
                      status: outcome.status,
                      ...('value' in outcome
                        ? { value: outcome.value }
                        : { error: String(outcome.reason).slice(0, 400) }),
                      batchObservedMs,
                    });
                  else droppedOutcomes++;
                });
                drainedReferences += batch.length;
              }
              const finishedMs = performance.now();
              // This is a drain-point snapshot, not proof that Vitest cannot retry later.
              console.log(
                '[Docs role settlement]',
                JSON.stringify({
                  source,
                  family,
                  width,
                  roleRead: 'native-dom',
                  verdict,
                  nodeTimeOrigin: performance.timeOrigin,
                  startedMs,
                  finishedMs,
                  budgetMs,
                  budgetExpired,
                  drainedReferences,
                  referencesAtDrainPoint: roleRequests.length,
                  callsAtDrainPoint: roleCalls,
                  issuedAfterVerdict: roleCalls - verdict.calls,
                  pendingRecordedSamples: roleGetters.filter(
                    (sample) => sample.settledAt === undefined
                  ).length,
                  droppedSamples: Math.max(0, roleCalls - roleGetters.length),
                  outcomes,
                  droppedOutcomes,
                  observerError: roleObserverError,
                  completeAtDrainPoint:
                    !roleObserverError &&
                    !budgetExpired &&
                    drainedReferences === roleRequests.length,
                })
              );
            } catch {
              // Missing observation is evidence debt, not a replacement verdict.
            }
          }
        }
        await revealHeaderPreferences(page);
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          if (runtime !== 'wc') {
            await selector.click();
            const listboxId = await selector.getAttribute('aria-controls');
            expect(listboxId).toBeTruthy();
            await page
              .locator(`[id=${JSON.stringify(listboxId)}]`)
              .getByRole('option', { name: runtimeLabels[runtime], exact: true })
              .click();
          }
          await page.waitForFunction(
            ({ family, runtime }) => {
              const search = document.querySelector<HTMLElement>('site-search');
              return (
                search?.dataset.searchRuntime === runtime && search.dataset.searchFamily === family
              );
            },
            { family, runtime }
          );
          const geometry = await page.locator('[data-docs-site-header]').evaluate((header) => {
            const rect = (element: Element) => {
              const box = element.getBoundingClientRect();
              return {
                ...box.toJSON(),
                center: box.y + box.height / 2,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              };
            };
            const select = header.querySelector<HTMLElement>(
              '[data-adapter-select] [data-site-select-trigger]'
            )!;
            const value = select.querySelector<HTMLElement>(
              'wc-shadcn-select-value, wc-brutalist-select-value'
            )!;
            const search = header.querySelector<HTMLElement>(
              'site-search [data-projection-generation-state="active"] [data-open-modal]'
            )!;
            const label = header.querySelector<HTMLElement>('.site-header-runtime-label')!;
            const settings = header.querySelector<HTMLDetailsElement>('[data-site-header-panel]')!;
            const text = document.createRange();
            text.selectNodeContents(value);
            return {
              header: rect(header),
              select: rect(select),
              search: rect(search),
              label: rect(label),
              labelDisplay: getComputedStyle(label).display,
              value: rect(value),
              valueText: value.textContent?.trim(),
              textWidth: text.getBoundingClientRect().width,
              selectTag: select.localName,
              searchRole: search.getAttribute('role'),
              searchDisabled: search.getAttribute('aria-disabled'),
              overflow: document.documentElement.scrollWidth - innerWidth,
              settings: {
                ...rect(settings),
                open: settings.open,
                ownsSelect: settings.contains(select),
              },
            };
          });
          // Save the actual measured geometry even when the assertion below fails.
          const id = `docs-${family}-${runtime}-${width}`;
          await capture(page, id, 'geometry');
          await writeFile(
            path.join(evidenceDirectory, `${id}-rects.json`),
            JSON.stringify({ source, family, runtime, width, geometry }, null, 2)
          );
          expect(geometry.selectTag).toBe(`wc-${family}-select-trigger`);
          expect(geometry.valueText).toBe(runtimeLabels[runtime]);
          expect(geometry.value.scrollWidth - geometry.value.clientWidth).toBeLessThanOrEqual(1);
          expect(geometry.textWidth - geometry.value.width).toBeLessThanOrEqual(1);
          expect(geometry.select.scrollWidth - geometry.select.clientWidth).toBeLessThanOrEqual(1);
          expect(geometry.overflow).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.select.height - 44)).toBeLessThanOrEqual(1);
          expect(Math.abs(geometry.search.height - 44)).toBeLessThanOrEqual(1);
          expect(geometry.searchRole).toBe('button');
          expect(geometry.searchDisabled).toBe('false');
          expect(
            await selector
              .and(page.getByRole('combobox', { name: '选择适配器', exact: true }))
              .count()
          ).toBe(1);
          if (width < 1100) {
            expect(geometry.labelDisplay).not.toBe('none');
            expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.select.y + 1);
            expect(geometry.search.bottom).toBeLessThanOrEqual(geometry.label.y + 1);
          } else {
            expect(Math.abs(geometry.select.center - geometry.search.center)).toBeLessThanOrEqual(
              1
            );
          }
          if (width < 768) {
            expect(geometry.settings.open).toBe(true);
            expect(geometry.settings.ownsSelect).toBe(true);
            expect(
              Math.abs(geometry.settings.top - geometry.header.bottom - 5)
            ).toBeLessThanOrEqual(1);
            expect(geometry.settings.left).toBeGreaterThanOrEqual(-1);
            expect(geometry.settings.right).toBeLessThanOrEqual(width + 1);
          }
        }
        expect(errors).toEqual([]);
      } finally {
        let contextClosed = false;
        try {
          try {
            dispatchTrace?.beforeContextClose();
          } catch {
            // Trace teardown cannot prevent the original context close.
          }
          roleTiming.markContextCloseStart();
          await context.close();
          contextClosed = true;
        } finally {
          try {
            roleTiming.disposeAfterContextClosed(contextClosed);
            await mkdir(evidenceDirectory, { recursive: true });
            await writeFile(
              path.join(evidenceDirectory, `docs-call-timing-${family}-${width}.json`),
              JSON.stringify(
                {
                  source,
                  family,
                  width,
                  contextClosed,
                  roleRead: 'native-dom',
                  observation: roleTiming.snapshot(),
                },
                null,
                2
              )
            );
          } catch {
            // Missing diagnostics must not replace the original verdict or cleanup.
          }
          try {
            await dispatchTrace?.finish(contextClosed, roleTiming.snapshot());
          } catch {
            // Diagnostic capture cannot replace the original error or cleanup.
          }
        }
      }
    }, 180_000);
  }
}

for (const width of [320, 390]) {
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`Docs ${family} ${width}px keeps enlarged 200% text reachable without clipping`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const id = `docs-${family}-font-200-${width}`;
      stage(page, id, 'font-navigate');
      try {
        // This is the geometry/reflow control. Dev has no Pagefind index, so
        // keep its external data outcome stable while retaining every native
        // clipping, hit-test, focus and dismissal assertion below. Loading and
        // failure transitions have their own unchanged cases in this suite.
        await installSuccessfulEmptySearchData(page);
        expect(
          (await page.goto(`${baseUrl}${searchRoute(family)}`, { waitUntil: 'networkidle' }))?.ok()
        ).toBe(true);
        // This is actual browser font enlargement, not DPR or a claim of native
        // browser zoom. Keep viewport unchanged so text must genuinely reflow.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const header = page.locator('[data-docs-site-header]');
        const select = header.locator('[data-adapter-select] [data-site-select-trigger]').first();
        await expect.poll(() => select.getAttribute('role')).toBe('combobox');
        await page.waitForFunction(() => {
          const root = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
          const frame = root.closest<HTMLElement>('.site-page-frame')!;
          return frame.style.getPropertyValue('--header-height') === `${root.offsetHeight}px`;
        });
        await revealHeaderPreferences(page);
        stage(page, id, 'font-geometry');
        await capture(page, id, 'before-geometry');
        const geometry = await header.evaluate((header) => {
          const select = header.querySelector<HTMLElement>(
            '[data-adapter-select] [data-site-select-trigger]'
          )!;
          const value = select.querySelector<HTMLElement>(
            'wc-shadcn-select-value, wc-brutalist-select-value'
          )!;
          const search = header.querySelector<HTMLElement>(
            'site-search [data-projection-generation-state="active"] [data-open-modal]'
          )!;
          const label = header.querySelector<HTMLElement>('.site-header-runtime-label')!;
          const text = document.createRange();
          text.selectNodeContents(value);
          return {
            enlargement: 'documentElement font-size: 200%; viewport unchanged',
            viewportWidth: innerWidth,
            dpr: devicePixelRatio,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            selectFontSize: getComputedStyle(select).fontSize,
            header: header.getBoundingClientRect().toJSON(),
            select: select.getBoundingClientRect().toJSON(),
            search: search.getBoundingClientRect().toJSON(),
            label: label.getBoundingClientRect().toJSON(),
            value: value.getBoundingClientRect().toJSON(),
            text: text.getBoundingClientRect().toJSON(),
            valueText: value.textContent?.trim(),
            valueOverflow: value.scrollWidth - value.clientWidth,
            pageOverflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        await capture(page, id, 'geometry');
        await writeFile(
          path.join(evidenceDirectory, `${id}-rects.json`),
          JSON.stringify({ source, family, width, geometry }, null, 2)
        );
        expect(geometry.rootFontSize).toBe('32px');
        expect(geometry.selectFontSize).toBe('28px');
        expect(geometry.valueText).toBe('Web Components');
        expect(geometry.valueOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
        expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.value.left - 1);
        expect(geometry.text.right).toBeLessThanOrEqual(geometry.value.right + 1);
        expect(geometry.text.bottom).toBeLessThanOrEqual(geometry.select.bottom + 1);
        expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.select.y + 1);
        expect(geometry.select.height).toBeGreaterThanOrEqual(44);
        expect(geometry.search.height).toBeGreaterThanOrEqual(44);
        expect(geometry.search.width).toBeGreaterThanOrEqual(44);
        const openRuntimeSelect = async (state: string) => {
          stage(page, id, state);
          await select.click();
          const listboxId = await select.getAttribute('aria-controls');
          expect(listboxId).toBeTruthy();
          const popup = page.locator(`[id=${JSON.stringify(listboxId)}]`);
          // Click commits Root.open; cold Select preparation may still be
          // mounting/positioning the popup. Actual visibility is the boundary,
          // and a named geometry abort must still fail this bounded wait.
          await popup.waitFor({ state: 'visible', timeout: 1000 });
          expect(await popup.isVisible()).toBe(true);
          const popupGeometry = await popup.evaluate((node) => {
            const viewport = node.querySelector('wc-shadcn-select-viewport') ?? node;
            return {
              panel: node.getBoundingClientRect().toJSON(),
              viewport: viewport.getBoundingClientRect().toJSON(),
              pageWidth: innerWidth,
              pageHeight: innerHeight,
              options: [...node.querySelectorAll<HTMLElement>('[role="option"]')].map((option) => {
                const text = option.querySelector('wc-shadcn-select-item-text') ?? option;
                const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
                const lines: ReturnType<DOMRect['toJSON']>[] = [];
                for (let part = walker.nextNode(); part; part = walker.nextNode()) {
                  if (!part.textContent?.trim()) continue;
                  const range = document.createRange();
                  range.selectNodeContents(part);
                  lines.push(...[...range.getClientRects()].map((line) => line.toJSON()));
                }
                const box = option.getBoundingClientRect();
                const center = document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2
                );
                return {
                  text: text.textContent?.trim(),
                  box: box.toJSON(),
                  lines,
                  ownsCenter: center === option || (!!center && option.contains(center)),
                };
              }),
            };
          });
          await writeFile(
            path.join(evidenceDirectory, `${id}-${state}-rects.json`),
            JSON.stringify({ source, family, width, popupGeometry }, null, 2)
          );
          await capture(page, id, state);
          expect(popupGeometry.options.map((option) => option.text)).toEqual([
            'Web Components',
            'React',
            'Vue',
            'Vue 2',
          ]);
          const panel = popupGeometry.panel;
          expect(panel.width).toBeGreaterThan(0);
          expect(panel.height).toBeGreaterThan(0);
          expect(panel.left).toBeGreaterThanOrEqual(-1);
          expect(panel.right).toBeLessThanOrEqual(popupGeometry.pageWidth + 1);
          expect(panel.top).toBeGreaterThanOrEqual(-1);
          expect(panel.bottom).toBeLessThanOrEqual(popupGeometry.pageHeight + 1);
          for (const option of popupGeometry.options) {
            expect(option.ownsCenter).toBe(true);
            expect(option.lines.length).toBeGreaterThan(0);
            for (const line of option.lines) {
              for (const bounds of [option.box, popupGeometry.viewport, panel]) {
                expect(line.left).toBeGreaterThanOrEqual(bounds.left - 1);
                expect(line.right).toBeLessThanOrEqual(bounds.right + 1);
                expect(line.top).toBeGreaterThanOrEqual(bounds.top - 1);
                expect(line.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
              }
            }
          }
          return popup;
        };
        const beforePortal = await header.boundingBox();
        const initialPopup = await openRuntimeSelect('font-popup-open');
        expect((await header.boundingBox())!.height).toBe(beforePortal!.height);
        await page.keyboard.press('Escape');
        await initialPopup.waitFor({ state: 'hidden' });
        // The root-font gate covers the actual public modal as well as its trigger.
        // A short viewport must not clip the editor/Close just because the result list shrinks.
        for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
          const modalId = `${id}-${runtime}`;
          await revealHeaderPreferences(page);
          const popup = await openRuntimeSelect(`font-popup-select-${runtime}`);
          await popup.getByRole('option', { name: runtimeLabels[runtime], exact: true }).click();
          await popup.waitFor({ state: 'hidden' });
          expect(
            await select.evaluate((trigger) => {
              const root = trigger.closest('[data-site-select-root]');
              return (root as any)?.getExposes?.()?.value?.get?.();
            })
          ).toBe(runtime);
          await page.waitForFunction((runtime) => {
            const search = document.querySelector<HTMLElement>('site-search');
            return (
              search?.dataset.searchRuntime === runtime && search.dataset.searchView === 'ready'
            );
          }, runtime);
          const originalViewport = page.viewportSize();
          if (!originalViewport) throw new Error('Expected explicit Search test viewport');
          await page.setViewportSize({ width: originalViewport.width, height: 390 });
          await header
            .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
            .click();
          const panel = await searchPart(page, 'panel');
          const editor = await searchInput(page);
          const close = await searchPart(page, 'close');
          const scrollBody = await searchPart(page, 'scroll-body');
          const list = await searchPart(page, 'list');
          const status = await searchPart(page, 'status');
          expect(await scrollBody.evaluate((node) => getComputedStyle(node).overflowY)).toBe(
            'auto'
          );
          expect(await list.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
          expect(await list.evaluate((node) => getComputedStyle(node).maxHeight)).not.toBe('none');
          await editor.waitFor({ state: 'visible' });
          const [panelGeometry, editorGeometry, closeGeometry] = await Promise.all(
            [panel, editor, close].map((part) =>
              part.evaluate((node) => {
                const box = node.getBoundingClientRect();
                const center = document.elementFromPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2
                );
                return {
                  box: box.toJSON(),
                  ownsCenter: center === node || (!!center && node.contains(center)),
                };
              })
            )
          );
          const modal = {
            panel: panelGeometry,
            editor: editorGeometry,
            close: closeGeometry,
            width: originalViewport.width,
            height: 390,
          };
          await capture(page, modalId, 'root-font-short-modal');
          await writeFile(
            path.join(evidenceDirectory, `${modalId}-modal-rects.json`),
            JSON.stringify({ source, family, runtime, width, modal }, null, 2)
          );
          for (const part of [modal.panel, modal.editor, modal.close]) {
            expect(part.box.width).toBeGreaterThan(0);
            expect(part.box.height).toBeGreaterThan(0);
            expect(part.box.left).toBeGreaterThanOrEqual(-1);
            expect(part.box.right).toBeLessThanOrEqual(modal.width + 1);
            expect(part.box.top).toBeGreaterThanOrEqual(-1);
            expect(part.box.bottom).toBeLessThanOrEqual(modal.height + 1);
          }
          expect(modal.editor.ownsCenter).toBe(true);
          expect(modal.close.ownsCenter).toBe(true);
          await expect.poll(() => status.textContent()).toBe('输入关键词搜索全部文档');
          const statusText = await status.textContent();
          expect(statusText?.trim()).toBeTruthy();
          await status.evaluate((node) => node.scrollIntoView({ block: 'end' }));
          const lastText = await status.evaluate((node) => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let last: Text | null = null;
            for (let text = walker.nextNode(); text; text = walker.nextNode()) {
              if (text.textContent?.length) last = text as Text;
            }
            if (!last) throw new Error('Expected complete live status text');
            const range = document.createRange();
            range.setStart(last, last.length - 1);
            range.setEnd(last, last.length);
            return range.getBoundingClientRect().toJSON();
          });
          const bodyBox = await scrollBody.boundingBox();
          expect(bodyBox).not.toBeNull();
          if (!bodyBox) throw new Error('Expected visible Search scroll body');
          expect(lastText.bottom).toBeLessThanOrEqual(bodyBox.y + bodyBox.height + 1);
          expect(await status.textContent()).toBe(statusText);
          await close.click();
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(false);
          stage(page, id, `font-modal-${runtime}-reopen`);
          await header
            .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
            .click();
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(true);
          const keyboardClose = await searchPart(page, 'close');
          stage(page, id, `font-modal-${runtime}-keyboard-close`);
          await keyboardClose.focus();
          await expect
            .poll(() => keyboardClose.evaluate((node) => node === document.activeElement))
            .toBe(true);
          await page.keyboard.press('Enter');
          await expect
            .poll(async () => (await page.evaluate(readSearchPublicState)).open)
            .toBe(false);
          await page.setViewportSize(originalViewport);
        }
        // Keep the existing Button/Card route witnesses and target their real
        // installation section. An authored preview may precede that section;
        // its insertion must not change the sticky-heading target.
        const headingRoute =
          family === 'brutalist'
            ? '/zh-cn/ui-libraries/brutalist/components/card/'
            : searchRoute(family);
        if (new URL(page.url()).pathname !== headingRoute) {
          stage(page, id, 'heading-navigation');
          const response = await page.goto(`${baseUrl}${headingRoute}`, {
            waitUntil: 'networkidle',
          });
          expect(response?.ok()).toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
          await expect.poll(() => select.getAttribute('role')).toBe('combobox');
          await page.waitForFunction(() => {
            const root = document.querySelector<HTMLElement>('[data-docs-site-header]')!;
            const frame = root.closest<HTMLElement>('.site-page-frame')!;
            return frame.style.getPropertyValue('--header-height') === `${root.offsetHeight}px`;
          });
        }
        stage(page, id, 'heading-offset');
        const heading = page.locator('[data-doc-flow] h2[id="安装"]');
        expect(await heading.count()).toBe(1);
        expect(await heading.isVisible()).toBe(true);
        const headingFacts = await heading.evaluate((element) => ({
          id: element.id,
          text: element.textContent?.trim(),
          inActualFlow: !!element.closest('[data-doc-flow]'),
          route: location.pathname,
          rootFontSize: getComputedStyle(document.documentElement).fontSize,
          box: element.getBoundingClientRect().toJSON(),
          scrollMarginTop: parseFloat(getComputedStyle(element).scrollMarginTop),
        }));
        await writeFile(
          path.join(evidenceDirectory, `${id}-heading.json`),
          JSON.stringify({ source, family, width, headingFacts }, null, 2)
        );
        expect(headingFacts.inActualFlow).toBe(true);
        expect(headingFacts.route).toBe(headingRoute);
        expect(headingFacts.rootFontSize).toBe('32px');
        expect(headingFacts.text).toBe('安装');
        expect(headingFacts.id).toBe('安装');
        expect(headingFacts.text).toBeTruthy();
        expect(headingFacts.box.width).toBeGreaterThan(0);
        expect(headingFacts.box.height).toBeGreaterThan(0);
        expect(headingFacts.scrollMarginTop).toBeGreaterThanOrEqual(
          (await header.boundingBox())!.height
        );
        await heading.evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await expect
          .poll(
            async () =>
              (await heading.boundingBox())!.y -
              (await header.boundingBox())!.y -
              (await header.boundingBox())!.height
          )
          .toBeGreaterThanOrEqual(-1);
        expect((await heading.boundingBox())!.y).toBeLessThan(1000);
        // The same-route Shadcn journey already revealed settings above;
        // the different-route Brutalist journey has a new closed disclosure.
        // Follow its actual state rather than toggling the first one closed.
        await revealHeaderPreferences(page);
        const preferencesPanel = header.locator('[data-site-header-panel]');
        expect(await header.locator('[data-site-menu-button]').getAttribute('aria-expanded')).toBe(
          'true'
        );
        expect(await preferencesPanel.isVisible()).toBe(true);
        const panelBox = (await preferencesPanel.boundingBox())!;
        const headerBox = (await header.boundingBox())!;
        expect(panelBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
        expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(1001);
        await capture(page, id, 'menu-and-heading');
        expect(errors).toEqual([]);
      } catch (error) {
        let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          const selects = await Promise.race([
            page.evaluate(() =>
              Array.from(document.querySelectorAll<HTMLElement>('*'))
                .filter((node) =>
                  /-select-(root|content|surface|viewport|trigger|value|item|item-text)$/.test(
                    node.localName
                  )
                )
                .slice(0, 100)
                .map((node) => {
                  const exposed =
                    (
                      node as HTMLElement & { getExposes?: () => Record<string, unknown> }
                    ).getExposes?.() ?? {};
                  const states: Record<string, unknown> = {};
                  for (const key of [
                    'open',
                    'transitionState',
                    'alignmentDiagnostic',
                    'value',
                    'displayValue',
                    'selected',
                  ]) {
                    const handle = exposed[key] as { get?: () => unknown } | undefined;
                    if (typeof handle?.get === 'function') {
                      try {
                        states[key] = handle.get();
                      } catch (failure) {
                        states[key] = String(failure);
                      }
                    }
                  }
                  const computed = getComputedStyle(node);
                  return {
                    tag: node.localName,
                    id: node.id,
                    connected: node.isConnected,
                    attributes: Object.fromEntries(
                      Array.from(node.attributes, (attribute) => [attribute.name, attribute.value])
                    ),
                    states,
                    box: node.getBoundingClientRect().toJSON(),
                    offsetWidth: node.offsetWidth,
                    offsetHeight: node.offsetHeight,
                    clientWidth: node.clientWidth,
                    clientHeight: node.clientHeight,
                    scrollWidth: node.scrollWidth,
                    scrollHeight: node.scrollHeight,
                    offsetParent: node.offsetParent?.localName ?? null,
                    parent: node.parentElement?.localName ?? null,
                    computed: Object.fromEntries(
                      [
                        'display',
                        'visibility',
                        'position',
                        'width',
                        'height',
                        'min-width',
                        'max-width',
                        'min-height',
                        'max-height',
                        'overflow-x',
                        'overflow-y',
                        'top',
                        'left',
                        'transform',
                        'direction',
                      ].map((property) => [property, computed.getPropertyValue(property)])
                    ),
                  };
                })
            ),
            new Promise<null>((resolve) => {
              snapshotTimer = setTimeout(() => resolve(null), 1000);
            }),
          ]);
          await mkdir(evidenceDirectory, { recursive: true });
          await writeFile(
            path.join(evidenceDirectory, `${id}-select-failure.json`),
            JSON.stringify(
              {
                source,
                family,
                width,
                selects,
                unavailable: selects === null ? 'Select failure snapshot exceeded 1000ms' : null,
              },
              null,
              2
            )
          );
        } catch {
          // This read-only post-failure snapshot cannot replace the verdict.
        } finally {
          if (snapshotTimer !== undefined) clearTimeout(snapshotTimer);
        }
        await captureFailure(page, error);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

// Transport-only fixture: real page, Dialog/Command, adapters, keyboard and scroll.
// This does not replace the separate generated Pagefind index acceptance.
for (const family of ['shadcn', 'brutalist'] as const) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`Search ${family}/${runtime} keeps nested scrollports and dismissal reachable at 200%`, async () => {
      const context = await browser.newContext({
        viewport: { width: 320, height: 390 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const id = `search-scroll-${family}-${runtime}`;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      stage(page, id, 'controlled-data-navigation');
      await page.route('**/pagefind/pagefind.js', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/javascript',
          body: `let failed = false;
          export async function options() {}
          export async function search(query) {
            if (query === 'failure' && !failed) { failed = true; throw new Error('Controlled data failure'); }
            if (query === 'loading') await new Promise(resolve => window.addEventListener('release-search-data', resolve, {once:true}));
            if (query === 'empty' || query === 'failure' || query === 'loading') return {results:[]};
            return {results:Array.from({length:20}, (_,i)=>({id:String(i),data:async()=>({url:'/docs/result-'+i,meta:{title:'Result '+i+' — documentation details'}})}))};
          }`,
        })
      );
      try {
        expect(
          (await page.goto(`${baseUrl}${searchRoute(family)}`, { waitUntil: 'networkidle' }))?.ok()
        ).toBe(true);
        const header = page.locator('[data-docs-site-header]');
        const select = header.locator('[data-adapter-select] [data-site-select-trigger]').first();
        await revealHeaderPreferences(page);
        if ((await page.locator('site-search').getAttribute('data-search-runtime')) !== runtime) {
          await select.click();
          const optionsId = await select.getAttribute('aria-controls');
          expect(optionsId).toBeTruthy();
          await page
            .locator(`[id=${JSON.stringify(optionsId)}]`)
            .getByRole('option', { name: runtimeLabels[runtime], exact: true })
            .click();
        }
        await page.waitForFunction((runtime) => {
          const search = document.querySelector<HTMLElement>('site-search');
          return search?.dataset.searchRuntime === runtime && search.dataset.searchView === 'ready';
        }, runtime);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
          // Pure observations installed in the existing preparation evaluation.
          // Actions, pointer coordinates and the original poll budgets are unchanged.
          const events: unknown[] = [];
          (window as any).__puiSearchScrollInputEvidence = events;
          const describe = (node: Element | null) =>
            node && {
              tag: node.localName,
              ref: node.getAttribute('data-demo-ref'),
              role: node.getAttribute('role'),
              owner: node.getAttribute('data-projection-owner'),
              generation: node.getAttribute('data-projection-generation'),
              connected: node.isConnected,
            };
          const surface = (node: HTMLElement | null) => {
            if (!node) return null;
            const style = getComputedStyle(node);
            return {
              ...describe(node),
              rect: node.getBoundingClientRect().toJSON(),
              clientHeight: node.clientHeight,
              scrollHeight: node.scrollHeight,
              scrollTop: node.scrollTop,
              maxScrollTop: node.scrollHeight - node.clientHeight,
              padding: style.padding,
              overflowY: style.overflowY,
              touchAction: style.touchAction,
            };
          };
          const record = (event: Event) => {
            const path = event
              .composedPath()
              .filter((node): node is HTMLElement => node instanceof HTMLElement);
            const body = path.find((node) => node.dataset.demoRef === 'scroll-body');
            if (!body) return;
            if (events.length >= 240) return;
            const list = body.querySelector<HTMLElement>('[data-demo-ref="list"]');
            const hint = body.querySelector<HTMLElement>('[data-demo-ref="keyboard-hint"]');
            if (event.type === 'scroll' || event.type === 'scrollend') {
              events.push({
                at: performance.now(),
                type: event.type,
                target: describe(path[0] ?? null),
                bodyScrollTop: body.scrollTop,
                listScrollTop: list?.scrollTop,
              });
              return;
            }
            const touch = event instanceof TouchEvent ? event.touches[0] : undefined;
            const point = touch
              ? { x: touch.clientX, y: touch.clientY }
              : event instanceof WheelEvent
                ? { x: event.clientX, y: event.clientY }
                : null;
            events.push({
              at: performance.now(),
              type: event.type,
              trusted: event.isTrusted,
              target: describe(path[0] ?? null),
              path: path.map(describe),
              point,
              hit: point ? describe(document.elementFromPoint(point.x, point.y)) : null,
              defaultPreventedAtCapture: event.defaultPrevented,
              deltaY: event instanceof WheelEvent ? event.deltaY : undefined,
              body: surface(body),
              list: surface(list),
              hint: surface(hint),
              active: describe(document.activeElement),
              page: { x: scrollX, y: scrollY },
            });
          };
          for (const type of ['touchstart', 'wheel', 'scroll', 'scrollend'])
            document.addEventListener(type, record, { capture: true, passive: true });
        });
        await header
          .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
          .click();
        const editor = await searchInput(page);
        const list = await searchPart(page, 'list');
        const body = await searchPart(page, 'scroll-body');
        const close = await searchPart(page, 'close');
        const status = await searchPart(page, 'status');
        const panel = await searchPart(page, 'panel');
        const revealFrames: unknown[] = [];
        const settlePanel = async () => {
          await expect
            .poll(() =>
              panel.evaluate((node) =>
                node
                  .getAnimations()
                  .some((animation) => animation.pending || animation.playState === 'running')
              )
            )
            .toBe(false);
        };
        const readReveal = (key: 'End' | 'Home') =>
          list.evaluate((node, key) => {
            const options = node.querySelectorAll<HTMLElement>('[role="option"]');
            const target = options[key === 'End' ? options.length - 1 : 0];
            if (!target) throw new Error('Expected the current keyboard result');
            const style = getComputedStyle(node);
            const targetStyle = getComputedStyle(target);
            const rect = node.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const title = target.querySelector('[data-search-result-url]')?.parentElement;
            const titleText = [...(title?.childNodes ?? [])].find(
              (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
            );
            let titleFirstLine = null;
            if (titleText) {
              const range = document.createRange();
              range.selectNodeContents(titleText);
              titleFirstLine = range.getClientRects()[0]?.toJSON() ?? null;
            }
            const pixels = (value: string) => (value === 'auto' ? 0 : Number.parseFloat(value));
            const query = node
              .closest('[data-demo-ref="command"]')
              ?.querySelector('[data-demo-ref="query"]');
            const editor = query?.matches('input') ? query : query?.querySelector('input');
            const ancestors: unknown[] = [];
            for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
              ancestors.push({
                tag: ancestor.localName,
                ref: ancestor.dataset.demoRef ?? null,
                top: ancestor.scrollTop,
                left: ancestor.scrollLeft,
              });
            }
            return {
              at: performance.now(),
              bounds: {
                viewportTop:
                  rect.top + pixels(style.borderTopWidth) + pixels(style.scrollPaddingTop),
                viewportBottom:
                  rect.bottom - pixels(style.borderBottomWidth) - pixels(style.scrollPaddingBottom),
                targetTop: targetRect.top - pixels(targetStyle.scrollMarginTop),
                targetBottom: targetRect.bottom + pixels(targetStyle.scrollMarginBottom),
              },
              native: {
                physicalViewportTop: rect.top + pixels(style.borderTopWidth),
                physicalViewportBottom:
                  rect.bottom -
                  pixels(style.borderBottomWidth) -
                  Math.max(
                    0,
                    (node as HTMLElement).offsetHeight -
                      node.clientHeight -
                      pixels(style.borderTopWidth) -
                      pixels(style.borderBottomWidth)
                  ),
                physicalTargetTop: targetRect.top,
                physicalTargetBottom: targetRect.bottom,
                scrollTop: node.scrollTop,
                maxScrollTop: Math.max(0, node.scrollHeight - node.clientHeight),
              },
              viewport: rect.toJSON(),
              target: targetRect.toJSON(),
              titleFirstLine,
              clientHeight: node.clientHeight,
              scrollHeight: node.scrollHeight,
              scrollTop: node.scrollTop,
              inputFocused: document.activeElement === editor,
              ancestors,
            };
          }, key);
        const recordReveal = async (frame: unknown) => {
          revealFrames.push(frame);
          await writeFile(
            path.join(evidenceDirectory, `${id}-reveal-geometry.json`),
            JSON.stringify({ source, family, runtime, frames: revealFrames }, null, 2)
          );
        };
        const checkReveal = async (key: 'End' | 'Home', size: '200%' | '100%') => {
          await settlePanel();
          const before = await readReveal(key);
          await recordReveal({ phase: 'before', key, size, ...before });
          expect(before.clientHeight).toBeGreaterThan(0);
          expect(before.bounds.viewportBottom).toBeGreaterThan(before.bounds.viewportTop);
          // The fixture starts beyond the relevant edge. This establishes which
          // edge is nearest without copying the host's scroll calculation.
          if (key === 'End')
            expect(before.bounds.targetTop).toBeGreaterThanOrEqual(
              before.bounds.viewportBottom - 1
            );
          else
            expect(before.bounds.targetBottom).toBeLessThanOrEqual(before.bounds.viewportTop + 1);
          const oversized =
            before.bounds.targetBottom - before.bounds.targetTop >
            before.bounds.viewportBottom - before.bounds.viewportTop;
          expect(oversized).toBe(size === '200%');
          await editor.press(key);
          const target =
            key === 'End' ? list.getByRole('option').last() : list.getByRole('option').first();
          await expect.poll(() => target.getAttribute('aria-selected')).toBe('true');
          const after = await readReveal(key);
          await recordReveal({ phase: 'after', key, size, ...after });
          expect(
            searchRevealMatchesViewport(after.bounds, key === 'End' ? 'start' : 'end', after.native)
          ).toBe(true);
          // Nearest-edge mathematics alone must not admit an unreadable sliver.
          // End aligns the row's beginning, including its first rendered title line.
          if (key === 'End') {
            expect(after.titleFirstLine).not.toBeNull();
            expect(after.titleFirstLine!.height).toBeGreaterThan(0);
            expect(after.titleFirstLine!.top).toBeGreaterThanOrEqual(after.bounds.viewportTop - 1);
            expect(after.titleFirstLine!.bottom).toBeLessThanOrEqual(
              after.bounds.viewportBottom + 1
            );
          }
          expect(after.inputFocused).toBe(true);
          expect(after.ancestors).toEqual(before.ancestors);
          await editor.press(key);
          const repeated = await readReveal(key);
          await recordReveal({ phase: 'repeated-key', key, size, ...repeated });
          expect(repeated.scrollTop).toBe(after.scrollTop);
          expect(repeated.inputFocused).toBe(true);
          expect(repeated.ancestors).toEqual(before.ancestors);
        };
        const checkClose = async () => {
          const geometry = await close.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { box: box.toJSON(), hit: hit === node || (!!hit && node.contains(hit)) };
          });
          expect(geometry.box.top).toBeGreaterThanOrEqual(-1);
          expect(geometry.box.bottom).toBeLessThanOrEqual(391);
          expect(geometry.box.left).toBeGreaterThanOrEqual(-1);
          expect(geometry.box.right).toBeLessThanOrEqual(321);
          expect(geometry.hit).toBe(true);
          return geometry;
        };
        await editor.fill('many');
        await expect.poll(() => list.getByRole('option').count()).toBe(20);
        await checkReveal('End', '200%');
        await checkClose();
        await capture(page, id, 'selected-200pct-nearest-edge');
        await checkReveal('Home', '200%');
        // Preserve full containment for ordinary rows in the same live consumer.
        // Only rows physically taller than the Content viewport use nearest edge.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '100%';
        });
        await checkReveal('End', '100%');
        await capture(page, id, 'selected-100pct-contained');
        await checkReveal('Home', '100%');
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await checkReveal('End', '200%');
        await checkReveal('Home', '200%');
        const before = await Promise.all([
          list.evaluate((n) => n.scrollTop),
          body.evaluate((n) => n.scrollTop),
        ]);
        const touch = await context.newCDPSession(page);
        try {
          const box = await body.boundingBox();
          if (!box || box.height < 20) throw new Error('Expected touch-scrollable body');
          const x = box.x + box.width / 2,
            y = box.y + box.height - 5;
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y }],
          });
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: box.y + 5 }],
          });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await expect
            .poll(async () => {
              const after = await Promise.all([
                list.evaluate((n) => n.scrollTop),
                body.evaluate((n) => n.scrollTop),
              ]);
              return after.some((value, index) => value > before[index]!);
            })
            .toBe(true);
        } finally {
          await touch.detach();
        }
        await checkClose();
        // After all unchanged keyboard/pointer coordinates have been exercised,
        // use real wheel input to reach the noninteractive hint in the outer body.
        const hint = await searchPart(page, 'keyboard-hint');
        const bodyBox = await body.boundingBox();
        if (!bodyBox) throw new Error('Expected the current outer Search scrollport');
        const pageScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
        await page.mouse.move(bodyBox.x + bodyBox.width - 2, bodyBox.y + bodyBox.height / 2);
        await page.mouse.wheel(0, 10_000);
        await page.mouse.wheel(0, 10_000);
        await expect
          .poll(() =>
            hint.evaluate((node) => {
              const body = node.closest<HTMLElement>('[data-demo-ref="scroll-body"]');
              if (!body) return false;
              const view = body.getBoundingClientRect();
              const rect = node.getBoundingClientRect();
              return rect.height > 0 && rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1;
            })
          )
          .toBe(true);
        expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(pageScroll);
        await checkClose();
        await capture(page, id, 'outer-body-hint-reachable');
        const phases: unknown[] = [];
        for (const query of ['failure', 'loading', 'empty']) {
          await editor.fill(query);
          const expected =
            query === 'failure'
              ? '搜索暂不可用，请重试'
              : query === 'loading'
                ? '正在加载搜索…'
                : '0 条匹配文档';
          await expect.poll(() => status.textContent()).toBe(expected);
          phases.push({
            query,
            renderedStatus: await status.textContent(),
            close: await checkClose(),
          });
          if (query === 'failure') {
            const retry = await searchPart(page, 'search-page-action');
            await retry.scrollIntoViewIfNeeded();
            await retry.click();
            await expect.poll(() => status.textContent()).toBe('0 条匹配文档');
          }
          if (query === 'loading')
            await page.evaluate(() => window.dispatchEvent(new Event('release-search-data')));
        }
        await capture(page, id, 'keyboard-touch-state-geometry');
        await writeFile(
          path.join(evidenceDirectory, `${id}-states.json`),
          JSON.stringify(
            {
              source,
              family,
              runtime,
              revealFrames,
              phases,
              scope: 'controlled Pagefind data only; real native composition',
            },
            null,
            2
          )
        );
        await close.focus();
        await page.keyboard.press('Enter');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).open)
          .toBe(false);
        expect(errors).toEqual([]);
      } catch (error) {
        await captureFailure(page, error);
        throw error;
      } finally {
        try {
          await writeFile(
            path.join(evidenceDirectory, id + '-native-scroll-input.json'),
            JSON.stringify(
              {
                source,
                family,
                runtime,
                scope:
                  'Passive touch/wheel/scroll observation; original actions and 1000ms assertions unchanged.',
                events: await page.evaluate(
                  () => (window as any).__puiSearchScrollInputEvidence ?? []
                ),
              },
              null,
              2
            )
          );
        } catch {
          // Missing observation cannot replace the original verdict or cleanup.
        }
        await context.close();
      }
    }, 90_000);
  }
}
