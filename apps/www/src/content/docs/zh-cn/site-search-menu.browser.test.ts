// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { searchPart, searchInput, readSearchPublicState } from './site-search-public-browser';
import { expect, it } from 'vitest';
import path from 'node:path';
import type { Locator } from 'playwright-core';
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

// These cases observe the actual editor and physical portal, not only a Header
// runtime label. An empty controlled Pagefind response is not production search
// relevance, multi-result scrolling or latency evidence.
for (const viewport of headerTriggerViewports) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`homepage shadcn/${runtime} ${viewport.name} renders the explicit Rhea website menu anatomy`, async () => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const id = `command-menu-shadcn-${runtime}-${viewport.name}`;
      stage(page, id, 'navigate');
      try {
        await installSuccessfulEmptySearchData(page);
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (runtime !== 'wc') {
          await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, 'shadcn', runtime);
        }
        const menu = page.locator(
          '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
        const trigger = page.locator(
          'site-search [data-projection-generation-state="active"] [data-open-modal]'
        );
        await trigger.click();
        const panel = await searchPart(page, 'panel');
        await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
        expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
        const queryPart = await searchPart(page, 'query');
        expect(await queryPart.getAttribute('data-projection-runtime')).toBe(runtime);
        const editor = await searchInput(page);
        const shell = await searchPart(page, 'query-shell');
        expect(await shell.count()).toBe(1);
        const readMenuGeometry = () =>
          editor.evaluate((node) => {
            const shell = node.closest<HTMLElement>(
              '[data-projection-prototype="shadcn-input-shell"]'
            );
            const wrapper = node.closest<HTMLElement>(
              '[data-projection-prototype="shadcn-command-input-wrapper"]'
            );
            const panel = node.closest<HTMLElement>('[data-demo-ref="panel"]');
            const glyph = wrapper?.querySelector<HTMLElement>('[data-demo-ref="query-decoration"]');
            const footer = panel?.querySelector<HTMLElement>('[data-demo-ref="dismissal"]');
            const body = panel?.querySelector<HTMLElement>('[data-demo-ref="scroll-body"]');
            if (!shell || !wrapper || !panel || !glyph || !footer || !body)
              throw new Error('Missing real menu anatomy');
            const inputStyle = getComputedStyle(node);
            const wrapperStyle = getComputedStyle(wrapper);
            const panelStyle = getComputedStyle(panel);
            const panelMotion = panel
              .getAnimations()
              .filter((animation) => animation.pending || animation.playState === 'running');
            return {
              input: node.getBoundingClientRect().toJSON(),
              shell: shell.getBoundingClientRect().toJSON(),
              wrapper: wrapper.getBoundingClientRect().toJSON(),
              panel: panel.getBoundingClientRect().toJSON(),
              panelPaint: {
                owner: panel.dataset.projectionOwner,
                generation: panel.dataset.projectionGeneration,
                scale: panelStyle.scale,
                maxWidth: panelStyle.maxWidth,
                maxHeight: panelStyle.maxHeight,
                activeMotion: panelMotion.map((animation) =>
                  animation instanceof CSSAnimation
                    ? animation.animationName
                    : animation instanceof CSSTransition
                      ? animation.transitionProperty
                      : animation.playState
                ),
              },
              glyph: glyph.getBoundingClientRect().toJSON(),
              footer: footer.getBoundingClientRect().toJSON(),
              body: body.getBoundingClientRect().toJSON(),
              paddingStart: parseFloat(inputStyle.paddingInlineStart),
              paddingEnd: parseFloat(inputStyle.paddingInlineEnd),
              wrapperPaddingStart: parseFloat(wrapperStyle.paddingInlineStart),
              wrapperPaddingEnd: parseFloat(wrapperStyle.paddingInlineEnd),
              wrapperGap: parseFloat(wrapperStyle.columnGap),
              wrapperBorder: parseFloat(wrapperStyle.borderLeftWidth),
              rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
              viewport: { width: innerWidth, height: innerHeight },
              inputRole: node.getAttribute('role'),
              shellRole: shell.getAttribute('role'),
              shellTabIndex: shell.getAttribute('tabindex'),
              glyphHidden: glyph.getAttribute('aria-hidden'),
              glyphSvgCount: glyph.querySelectorAll('svg').length,
              nativeEditorCount: panel.querySelectorAll('input').length,
            };
          });
        type MenuGeometry = Awaited<ReturnType<typeof readMenuGeometry>>;
        const settleMenuGeometry = async (initial: MenuGeometry) => {
          const frame = (geometry: MenuGeometry) =>
            JSON.stringify([
              geometry.panelPaint.owner,
              geometry.panelPaint.generation,
              geometry.rootFont,
              geometry.panel,
              geometry.wrapper,
              geometry.glyph,
              geometry.body,
              geometry.footer,
            ]);
          let current = initial;
          let previous = frame(current);
          // Logical entry can precede CSS zoom, and a font resize starts new
          // size transitions. Compare the same menu after physical paint settles.
          await expect
            .poll(
              async () => {
                current = await readMenuGeometry();
                const next = frame(current);
                const still = next === previous && current.panelPaint.activeMotion.length === 0;
                previous = next;
                return still;
              },
              { timeout: 1000 }
            )
            .toBe(true);
          return current;
        };
        const initialGeometry = await readMenuGeometry();
        const geometry = await settleMenuGeometry(initialGeometry);
        const state = await page.evaluate(readSearchPublicState);
        await mkdir(evidenceDirectory, { recursive: true });
        await writeFile(
          path.join(evidenceDirectory, `${id}-geometry.json`),
          JSON.stringify(
            {
              source,
              runtime,
              viewport,
              initialGeometry,
              geometry,
              state,
              dataFixture: 'successful empty Pagefind boundary; real native composition',
            },
            null,
            2
          )
        );
        await capture(page, id, 'actual-editor-inset');
        const assertMenuGeometry = (geometry: Awaited<ReturnType<typeof readMenuGeometry>>) => {
          // MIT website CommandMenu@24a1642: wrapper h9/px3/gap2, editor no inset,
          // max32rem/top15%; unlike the separate unchanged no-addon default.
          expect(Math.abs(geometry.paddingStart)).toBeLessThanOrEqual(0.1);
          expect(Math.abs(geometry.paddingEnd)).toBeLessThanOrEqual(0.1);
          expect(
            Math.abs(geometry.wrapperPaddingStart - geometry.rootFont * 0.75)
          ).toBeLessThanOrEqual(0.1);
          expect(
            Math.abs(geometry.wrapperPaddingEnd - geometry.rootFont * 0.75)
          ).toBeLessThanOrEqual(0.1);
          expect(Math.abs(geometry.wrapperGap - geometry.rootFont * 0.5)).toBeLessThanOrEqual(0.1);
          expect(Math.abs(geometry.wrapper.height - geometry.rootFont * 2.25)).toBeLessThanOrEqual(
            1
          );
          expect(geometry.wrapperBorder).toBeGreaterThanOrEqual(1);
          expect(
            Math.abs(
              geometry.panel.width -
                Math.min(32 * geometry.rootFont, geometry.viewport.width - 2 * geometry.rootFont)
            )
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs(geometry.panel.top - geometry.viewport.height * 0.15)
          ).toBeLessThanOrEqual(1);
          expect(geometry.panel.bottom).toBeLessThanOrEqual(
            geometry.viewport.height - geometry.rootFont + 1
          );
          expect(geometry.footer.bottom - geometry.panel.bottom).toBeLessThanOrEqual(1);
          expect(geometry.body.bottom - geometry.footer.top).toBeLessThanOrEqual(1);
          expect(geometry.input.right - geometry.shell.right).toBeLessThanOrEqual(1);
          expect(geometry.inputRole).toBe('combobox');
          expect(geometry.shellRole).toBeNull();
          expect(geometry.shellTabIndex).toBeNull();
          expect(geometry.glyphHidden).toBe('true');
          expect(geometry.glyphSvgCount).toBe(1);
          expect(geometry.nativeEditorCount).toBe(1);
          expect(geometry.glyph.width).toBeGreaterThanOrEqual(16);
          expect(geometry.input.left - geometry.glyph.right).toBeGreaterThanOrEqual(
            geometry.rootFont * 0.5 - 1
          );
        };
        assertMenuGeometry(geometry);
        const results = await searchPart(page, 'results');
        await expect.poll(() => results.getAttribute('aria-label')).toBe('页面');
        await expect.poll(() => results.getByRole('option').count()).toBe(4);
        const keyboardHint = await searchPart(page, 'keyboard-hint');
        await expect.poll(() => keyboardHint.textContent()).toContain('打开页面');
        await page.keyboard.press('ArrowDown');
        await expect.poll(() => results.locator('[aria-selected="true"]').count()).toBe(1);
        const activePaint = await results.locator('[aria-selected="true"]').evaluate((node) => ({
          background: getComputedStyle(node).backgroundColor,
          border: getComputedStyle(node).borderLeftColor,
        }));
        expect(activePaint.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(activePaint.border).not.toBe('rgba(0, 0, 0, 0)');
        // Enlarged-root layout uses the same real public menu; no changed result
        // cutoff, scroll threshold, viewport or timeout hides bounded overflow.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const enlargedInitial = await readMenuGeometry();
        const enlarged = await settleMenuGeometry(enlargedInitial);
        await writeFile(
          path.join(evidenceDirectory, `${id}-200pct-geometry.json`),
          JSON.stringify(
            { source, runtime, viewport, initialGeometry: enlargedInitial, geometry: enlarged },
            null,
            2
          )
        );
        assertMenuGeometry(enlarged);
        await capture(page, id, '200pct-menu-anatomy');
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '';
        });
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).inputFocused)
          .toBe(true);
        const identity = await editor.elementHandle();
        if (!identity) throw new Error('Missing real editor handle');
        await editor.fill('inset query');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).query)
          .toBe('inset query');
        expect(await editor.evaluate((node, previous) => node === previous, identity)).toBe(true);
        await page.keyboard.press('Escape');
        await expect
          .poll(async () => (await page.evaluate(readSearchPublicState)).open)
          .toBe(false);
        await expect
          .poll(() => trigger.evaluate((node) => node === document.activeElement))
          .toBe(true);
        expect(diagnosticPages.get(page)!.errors).toEqual([]);
      } catch (error) {
        await captureFailure(page, error);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

it('docs brutalist dark 390px keeps Close focused through delayed Pagefind failure and Space dismissal', async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 960 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  const id = 'docs-brutalist-dark-390-delayed-failure-close';
  const { promise: failure, resolve: releaseFailure } = Promise.withResolvers<void>();
  let dataRequested = false;
  let failedDataResponses = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname.endsWith('/pagefind/pagefind.js') &&
      response.status() === 404
    )
      failedDataResponses++;
  });
  stage(page, id, 'navigate');
  try {
    await page.addInitScript(() => localStorage.setItem('starlight-theme', 'dark'));
    await installOpenCounter(page);
    // Delay only the external index boundary. Search, its Docs focus observer,
    // both author-slot commits and the public Close command remain real.
    await page.route('**/pagefind/pagefind.js', async (route) => {
      dataRequested = true;
      await failure;
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Controlled delayed missing test index',
      });
    });
    expect(
      (await page.goto(`${baseUrl}${searchRoute('brutalist')}`, { waitUntil: 'networkidle' }))?.ok()
    ).toBe(true);
    const trigger = page.locator(
      'site-search [data-projection-generation-state="active"] [data-open-modal]'
    );
    await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
    await expect.poll(() => trigger.getAttribute('aria-disabled')).toBe('false');
    await trigger.click();
    await expect
      .poll(async () => (await page.evaluate(readSearchPublicState)).inputFocused)
      .toBe(true);
    await expect.poll(() => dataRequested).toBe(true);
    expect(await (await searchPart(page, 'panel')).getAttribute('data-projection-runtime')).toBe(
      'wc'
    );
    const close = await searchPart(page, 'close');
    const status = await searchPart(page, 'status');
    const retry = await searchPart(page, 'search-page-action');
    await close.focus();
    expect(await close.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await retry.count()).toBe(0);
    expect(failedDataResponses).toBe(0);
    const beforeFailure = await page.evaluate(readSearchPublicState);
    expect(beforeFailure.query).toBe('');
    expect(beforeFailure.open).toBe(true);

    stage(page, id, 'release-failure');
    releaseFailure();
    await expect.poll(() => status.textContent()).toBe('搜索暂不可用，请重试');
    await expect.poll(() => retry.textContent()).toBe('重试');
    expect(failedDataResponses).toBeGreaterThan(0);
    expect(await close.evaluate((node) => node === document.activeElement)).toBe(true);
    const afterFailure = await page.evaluate(readSearchPublicState);
    expect(afterFailure.open).toBe(true);
    expect(afterFailure.query).toBe('');
    expect(afterFailure.inputFocused).toBe(false);
    await capture(page, id, 'failure-close-focus');

    // Locator.press would focus Close again and conceal a stolen-focus defect.
    stage(page, id, 'native-space');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await page.evaluate(readSearchPublicState)).open).toBe(false);
    await expectSearchOpenerFocus(page, trigger, id, 'delayed-failure-space');
    const spaceTargets = await page.evaluate(() => {
      // installOpenCounter owns this in-process event record.
      const observedWindow = window as unknown as Window & {
        __puiSearchTimeline: Array<{
          type: string;
          target: { ref: string | null } | null;
          extra: { key?: string; trusted?: boolean } | null;
        }>;
      };
      return observedWindow.__puiSearchTimeline
        .filter((event) => event.type === 'keydown:capture' && event.extra?.key === ' ')
        .map((event) => ({ ref: event.target?.ref, trusted: event.extra?.trusted }));
    });
    expect(spaceTargets).toEqual([{ ref: 'close', trusted: true }]);
    const closed = await page.evaluate(readSearchPublicState);
    await capture(page, id, 'space-dismissed');
    await writeFile(
      path.join(evidenceDirectory, `${id}-focus.json`),
      JSON.stringify(
        { source, beforeFailure, afterFailure, closed, failedDataResponses, spaceTargets },
        null,
        2
      )
    );
    expect(errors).toEqual([]);
  } catch (error) {
    await captureFailure(page, error);
    throw error;
  } finally {
    releaseFailure();
    await context.close();
  }
}, 60_000);

// The prior Header native run encountered this real product state. Preserve it
// independently: a missing index intentionally focuses the actual Retry Button,
// and must not be misclassified as CSS-induced input focus loss.
for (const family of ['shadcn', 'brutalist'] as const) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`homepage ${family}/${runtime} missing Pagefind keeps the real Retry action focused`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const id = `search-missing-index-${family}-${runtime}`;
      let failedDataResponses = 0;
      const expectedDataConsoleErrors: string[] = [];
      stage(page, id, 'navigate');
      try {
        page.on('response', (response) => {
          if (
            new URL(response.url()).pathname.endsWith('/pagefind/pagefind.js') &&
            response.status() === 404
          )
            failedDataResponses++;
        });
        page.on('console', (message) => {
          if (message.type() !== 'error' || !message.text().includes('404 (Not Found)')) return;
          const location = message.location().url;
          if (
            location &&
            new URL(location).origin === new URL(baseUrl).origin &&
            new URL(location).pathname.endsWith('/pagefind/pagefind.js')
          ) {
            expectedDataConsoleErrors.push(`console: ${message.text()}`);
          }
        });
        await page.route('**/pagefind/pagefind.js', (route) =>
          route.fulfill({
            status: 404,
            contentType: 'text/plain',
            body: 'Controlled missing test index',
          })
        );
        expect((await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' }))?.ok()).toBe(
          true
        );
        await homeReady(page, 'shadcn', 'wc');
        if (family !== 'shadcn') {
          await choosePageControl(page, 'family', 'Brutalist');
          await homeReady(page, family, 'wc');
        }
        if (runtime !== 'wc') {
          await choosePageControl(page, 'runtime', runtimeLabels[runtime]);
          await homeReady(page, family, runtime);
        }
        const menu = page.locator(
          '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
        await page
          .locator('site-search [data-projection-generation-state="active"] [data-open-modal]')
          .click();
        const panel = await searchPart(page, 'panel');
        await expect.poll(() => panel.getAttribute('data-transition-state')).toBe('entered');
        expect(await panel.getAttribute('data-projection-runtime')).toBe(runtime);
        expect(
          await (await searchPart(page, 'query')).getAttribute('data-projection-runtime')
        ).toBe(runtime);
        const retry = await searchPart(page, 'search-page-action');
        await expect.poll(() => retry.textContent()).toBe('重试');
        await expect
          .poll(() => retry.evaluate((node) => node === document.activeElement))
          .toBe(true);
        const state = await page.evaluate(readSearchPublicState);
        expect(state.open).toBe(true);
        expect(state.inputFocused).toBe(false);
        expect(failedDataResponses).toBeGreaterThan(0);
        expect(await (await searchPart(page, 'status')).textContent()).toBe('搜索暂不可用，请重试');
        await capture(page, id, 'actual-retry-focus');
        await writeFile(
          path.join(evidenceDirectory, `${id}-focus.json`),
          JSON.stringify({ source, family, runtime, state, failedDataResponses }, null, 2)
        );
        const unexpectedErrors = [...diagnosticPages.get(page)!.errors];
        for (const expected of expectedDataConsoleErrors) {
          const index = unexpectedErrors.indexOf(expected);
          expect(index).toBeGreaterThanOrEqual(0);
          unexpectedErrors.splice(index, 1);
        }
        // A generic asset404 or unrelated page error is not excused by the
        // controlled Pagefind404. Only exact same-origin console provenance is.
        expect(unexpectedErrors).toEqual([]);
      } catch (error) {
        await captureFailure(page, error);
        throw error;
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}

// Compatibility controls migrated from the former website no-addon composition.
// The website now explicitly opts in to menu, so a real independent public fixture
// retains all four hosts/two viewports and the original exact10px editor oracle.
for (const viewport of headerTriggerViewports) {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`default public Command ${runtime} ${viewport.name} retains the no-addon Rhea editor inset`, async () => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      const id = `command-default-inset-${runtime}-${viewport.name}`;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        expect(
          (
            await page.goto(`${baseUrl}/en/test/command-no-addon/?runtime=${runtime}`, {
              waitUntil: 'networkidle',
            })
          )?.ok()
        ).toBe(true);
        const host = page.locator('[data-command-default-host]');
        await expect.poll(() => host.getAttribute('data-mount-state')).toBe('ready');
        await expect.poll(() => host.getAttribute('data-rendered-runtime')).toBe(runtime);
        const editor = host.getByRole('combobox', { name: 'Default search', exact: true });
        await expect.poll(() => editor.count()).toBe(1);
        await editor.focus();
        const identity = await editor.elementHandle();
        if (!identity) throw new Error('Missing actual default editor');
        const geometry = await editor.evaluate((node) => {
          const owner = node.closest<HTMLElement>('[data-demo-ref="shell"]');
          if (!owner) throw new Error('Missing actual default InputShell');
          const input = node.getBoundingClientRect();
          const shell = owner.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            input: input.toJSON(),
            shell: shell.toJSON(),
            paddingStart: parseFloat(style.paddingInlineStart),
            paddingEnd: parseFloat(style.paddingInlineEnd),
            rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
            textInset:
              input.left +
              parseFloat(style.borderLeftWidth) +
              parseFloat(style.paddingLeft) -
              shell.left,
            inputRole: node.getAttribute('role'),
            shellRole: owner.getAttribute('role'),
            shellTabIndex: owner.getAttribute('tabindex'),
          };
        });
        const inset = geometry.rootFont * 0.625;
        expect(Math.abs(geometry.paddingStart - inset)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(geometry.paddingEnd - inset)).toBeLessThanOrEqual(0.1);
        expect(geometry.textInset).toBeGreaterThanOrEqual(inset);
        expect(geometry.textInset).toBeLessThanOrEqual(inset + 1);
        expect(geometry.input.right - geometry.shell.right).toBeLessThanOrEqual(1);
        expect(geometry.inputRole).toBe('combobox');
        expect(geometry.shellRole).toBeNull();
        expect(geometry.shellTabIndex).toBeNull();
        await editor.fill('retained default query');
        await expect.poll(() => editor.inputValue()).toBe('retained default query');
        await page.locator('[data-fixture-blur]').click();
        await editor.focus();
        expect(await editor.evaluate((node, previous) => node === previous, identity)).toBe(true);
        expect(await editor.evaluate((node) => node === document.activeElement)).toBe(true);
        await mkdir(evidenceDirectory, { recursive: true });
        await writeFile(
          path.join(evidenceDirectory, `${id}-geometry.json`),
          JSON.stringify(
            {
              source,
              runtime,
              viewport,
              geometry,
              scope: 'independent default public fixture, not production menu',
            },
            null,
            2
          )
        );
        await page.screenshot({ path: path.join(evidenceDirectory, `${id}.png`), fullPage: false });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 90_000);
  }
}
