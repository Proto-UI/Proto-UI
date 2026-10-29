// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/en/ui-libraries/shadcn/menubar/';
const out = path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ?? tmpdir(), 'menubar');
let browser: Browser;
let baseUrl = '';
const source = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  trackedDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim(),
};

beforeAll(async () => {
  expect(source.trackedDirty).toBe('');
  const external = process.env.PROTO_UI_BROWSER_BASE_URL;
  if (external) {
    // Only the existing source-bound CI runner may supply its shared local server.
    expect(process.env.GITHUB_ACTIONS).toBe('true');
    expect(process.env.PROTO_UI_RUNTIME_PHASE).toBe('browser');
    expect(process.env.GITHUB_SHA).toBe(source.sha);
    const server = new URL(external);
    expect(server.protocol).toBe('http:');
    expect(server.hostname).toBe('127.0.0.1');
  }
  await mkdir(out, { recursive: true });
  baseUrl = await startServer([ROUTE]);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

async function facts(locator: Locator) {
  return locator.evaluate((element) => {
    const css = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      minWidth: css.minWidth,
      paddingTop: css.paddingTop,
      paddingRight: css.paddingRight,
      paddingBottom: css.paddingBottom,
      paddingLeft: css.paddingLeft,
      radius: css.borderRadius,
      background: css.backgroundColor,
      shadow: css.boxShadow,
      focused: document.activeElement === element,
      focusVisible: element.hasAttribute('data-focus-visible'),
      expanded: element.getAttribute('aria-expanded'),
      tokens: element.getAttribute('data-pui-style'),
    };
  });
}

// Real Rhea public consumer only. New York native parity, controlled/disabled/touch
// and complete submenu/AT acceptance remain separate pending evidence.
describe.sequential('Shadcn Menubar public Rhea native projection', () => {
  for (const runtime of RUNTIMES) {
    for (const scheme of ['light', 'dark'] as const) {
      it(`${runtime} ${scheme} preserves closed focus, navigation and real item paint`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, ROUTE, {
          width: 1100,
          height: 1000,
        });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const observations: unknown[] = [];
        let interactionTrace: unknown = null;
        let failure: string | null = null;
        const screenshots: Array<{ path: string; sha256: string }> = [];
        const prefix = `${runtime}-${scheme}`;
        let outcome = 'failed';
        const capture = async (subject: Locator, state: string) => {
          const filename = `${prefix}-${state}.png`;
          const target = path.join(out, filename);
          // Locator screenshots may scroll the document and disturb a fixed anchored
          // overlay. Capture the real viewport without moving the input/anchor.
          observations.push({
            state: `capture-${state}`,
            subject: await facts(subject),
            scroll: await page.evaluate(() => ({ x: scrollX, y: scrollY })),
          });
          await page.screenshot({ path: target });
          screenshots.push({
            path: filename,
            sha256: createHash('sha256')
              .update(await readFile(target))
              .digest('hex'),
          });
        };
        try {
          expect(await page.locator('vite-error-overlay').count()).toBe(0);
          expect(await previewer.getAttribute('data-demo-id')).toBe('demo-shadcn-menubar');
          await selectRuntime(page, previewer, runtime, '[role="menubar"]', 1);
          await applyColorScheme(page, scheme);
          await page.evaluate(() => {
            const events: unknown[] = [];
            let dropped = 0;
            const describe = (node: EventTarget | null) => {
              if (!(node instanceof Element)) return null;
              return {
                tag: node.tagName,
                role: node.getAttribute('role'),
                text: node.textContent?.slice(0, 80),
                connected: node.isConnected,
                parent: node.parentElement?.tagName,
              };
            };
            const record = (event: unknown) => {
              if (events.length < 160) events.push(event);
              else dropped++;
            };
            const offListeners: Array<() => void> = [];
            for (const type of ['focusin', 'focusout', 'keydown']) {
              const listener = (event: Event) => {
                const eventPath = event.composedPath();
                const target = eventPath[0];
                if (
                  !eventPath.some(
                    (node) =>
                      node instanceof Element && node.closest('[role="menubar"], [role="menu"]')
                  )
                )
                  return;
                record({
                  kind: type,
                  time: performance.now(),
                  trusted: event.isTrusted,
                  key: event instanceof KeyboardEvent ? event.key : null,
                  target: describe(target ?? null),
                  pathRoles: eventPath
                    .filter(
                      (node): node is Element =>
                        node instanceof Element && node.hasAttribute('role')
                    )
                    .map(describe),
                  active: describe(document.activeElement),
                  scrollY,
                });
              };
              document.addEventListener(type, listener, true);
              offListeners.push(() => document.removeEventListener(type, listener, true));
            }
            const observer = new MutationObserver((records) => {
              for (const mutation of records) {
                const menus = (nodes: NodeList) =>
                  [...nodes].flatMap((node) =>
                    node instanceof Element
                      ? [node, ...node.querySelectorAll('[role="menu"]')]
                          .filter((element) => element.getAttribute('role') === 'menu')
                          .map(describe)
                      : []
                  );
                const added = menus(mutation.addedNodes),
                  removed = menus(mutation.removedNodes);
                if (added.length || removed.length)
                  record({
                    kind: 'menu-childlist-delivery',
                    time: performance.now(),
                    parent: describe(mutation.target),
                    added,
                    removed,
                    active: describe(document.activeElement),
                    scrollY,
                  });
              }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            (
              window as typeof window & {
                __menubarTrace?: { events: unknown[]; dropped(): number; stop(): void };
              }
            ).__menubarTrace = {
              events,
              dropped: () => dropped,
              stop: () => {
                observer.disconnect();
                offListeners.forEach((off) => off());
              },
            };
          });
          const bar = previewer.getByRole('menubar', { name: 'Project commands', exact: true });
          const file = bar.getByRole('menuitem', { name: 'File', exact: true });
          const edit = bar.getByRole('menuitem', { name: 'Edit', exact: true });
          const fileMenu = page.getByRole('menu', { name: 'File commands', exact: true });
          const editMenu = page.getByRole('menu', { name: 'Edit commands', exact: true });
          await bar.scrollIntoViewIfNeeded();
          for (const fontSize of [16, 32]) {
            await page.evaluate((size) => {
              document.documentElement.style.fontSize = `${size}px`;
            }, fontSize);
            await expect.poll(async () => (await facts(bar)).height).toBeCloseTo(fontSize * 2, 1);
            // Focus acquisition is native; the subsequent arrow is real keyboard input.
            // An initially closed menu must not open merely because its roving focus moves.
            await file.focus();
            await page.keyboard.press('ArrowRight');
            await expect
              .poll(() => edit.evaluate((el) => document.activeElement === el))
              .toBe(true);
            expect(await edit.getAttribute('aria-expanded')).toBe('false');
            const closed = await facts(edit);
            expect(closed.focusVisible).toBe(true);
            expect(closed.shadow).not.toBe('none');
            expect(closed.tokens).toContain('ring-2');
            observations.push({
              fontSize,
              state: 'closed-keyboard-focus',
              bar: await facts(bar),
              trigger: closed,
            });
            await capture(bar, `${fontSize}-closed-focus`);

            const scrollBeforeEntry = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
            await page.keyboard.press('ArrowDown');
            await editMenu.waitFor({ state: 'visible' });
            const undo = editMenu.getByRole('menuitem', { name: 'Undo', exact: true });
            await expect
              .poll(() => undo.evaluate((el) => document.activeElement === el))
              .toBe(true);
            const item = await facts(undo);
            expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
              scrollBeforeEntry
            );
            expect(item.height).toBeGreaterThanOrEqual(fontSize * 1.75 - 0.1);
            expect(Number.parseFloat(item.paddingLeft)).toBeCloseTo(fontSize * 0.5, 1);
            expect(Number.parseFloat(item.paddingTop)).toBeCloseTo(fontSize * 0.375, 1);
            expect(item.tokens).toContain('data-[focused]:bg-accent');
            const accent = await undo.evaluate((element) => {
              const probe = document.createElement('span');
              probe.style.cssText =
                'position:absolute;visibility:hidden;pointer-events:none;background:var(--pui-accent);color:var(--pui-accent-foreground)';
              element.append(probe);
              try {
                const css = getComputedStyle(probe);
                const inherited = getComputedStyle(element);
                const backgroundVariable = inherited.getPropertyValue('--pui-accent').trim();
                const foregroundVariable = inherited
                  .getPropertyValue('--pui-accent-foreground')
                  .trim();
                return {
                  background: css.backgroundColor,
                  foreground: css.color,
                  backgroundVariable,
                  foregroundVariable,
                  backgroundValid: CSS.supports('color', backgroundVariable),
                  foregroundValid: CSS.supports('color', foregroundVariable),
                };
              } finally {
                probe.remove();
              }
            });
            expect(accent.backgroundVariable).not.toBe('');
            expect(accent.foregroundVariable).not.toBe('');
            expect(accent.backgroundValid).toBe(true);
            expect(accent.foregroundValid).toBe(true);
            expect(item.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(accent.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(accent.foreground).not.toBe('rgba(0, 0, 0, 0)');
            expect(item.background).toBe(accent.background);
            expect(await undo.evaluate((element) => getComputedStyle(element).color)).toBe(
              accent.foreground
            );
            const content = await facts(editMenu);
            expect(content.y).toBeGreaterThanOrEqual(0);
            expect(content.y + content.height).toBeLessThanOrEqual(1000);
            expect(Number.parseFloat(content.minWidth)).toBeCloseTo(fontSize * 9, 1);
            expect(content.width).toBeGreaterThanOrEqual(fontSize * 9 - 0.1);
            observations.push({ fontSize, state: 'open-keyboard-item', content, item });
            await capture(editMenu, `${fontSize}-open-menu`);

            // Escape restores the matching native trigger, and the next activation re-enters.
            await page.keyboard.press('Escape');
            await expect.poll(() => edit.getAttribute('aria-expanded')).toBe('false');
            await expect
              .poll(() => edit.evaluate((el) => document.activeElement === el))
              .toBe(true);
            await file.click();
            await fileMenu.waitFor({ state: 'visible' });
            const selection =
              fontSize === 16
                ? { label: 'New document', value: 'new' }
                : { label: 'Open document', value: 'open' };
            const expectedStatus = `${selection.value} selected`;
            expect(await previewer.locator('[data-demo-ref="status"]').textContent()).not.toBe(
              expectedStatus
            );
            await fileMenu.getByRole('menuitem', { name: selection.label, exact: true }).click();
            await expect
              .poll(() => previewer.locator('[data-demo-ref="status"]').textContent())
              .toBe(expectedStatus);
            await expect.poll(() => file.getAttribute('aria-expanded')).toBe('false');
            observations.push({ fontSize, state: 'pointer-select-closed', status: expectedStatus });
          }
          expect(errors).toEqual([]);
          expect(
            execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
              encoding: 'utf8',
            }).trim()
          ).toBe('');
          outcome = 'passed';
        } catch (error) {
          failure = String(error);
          try {
            observations.push({
              state: 'failure-diagnostic',
              roleMenus: await page
                .getByRole('menu', { includeHidden: true })
                .evaluateAll((elements) =>
                  elements.map((element) => ({
                    html: element.outerHTML.slice(0, 3500),
                    rect: element.getBoundingClientRect().toJSON(),
                    position: getComputedStyle(element).position,
                    transform: getComputedStyle(element).transform,
                    display: getComputedStyle(element).display,
                    visibility: getComputedStyle(element).visibility,
                  }))
                ),
              dom: await page.evaluate(() => {
                const describe = (element: Element | null) =>
                  element
                    ? {
                        tag: element.tagName,
                        role: element.getAttribute('role'),
                        text: element.textContent?.slice(0, 160),
                        html: element.outerHTML.slice(0, 2500),
                        rect: element.getBoundingClientRect().toJSON(),
                        position: getComputedStyle(element).position,
                        transform: getComputedStyle(element).transform,
                      }
                    : null;
                const active = document.activeElement;
                return {
                  scroll: { x: scrollX, y: scrollY },
                  viewport: { width: innerWidth, height: innerHeight },
                  active: describe(active),
                  shadowActive: describe(active?.shadowRoot?.activeElement ?? null),
                  menus: [...document.querySelectorAll('[role="menu"], [role="menubar"]')].map(
                    describe
                  ),
                };
              }),
            });
            const target = path.join(out, `${prefix}-failed-viewport.png`);
            await page.screenshot({ path: target });
            screenshots.push({
              path: path.basename(target),
              sha256: createHash('sha256')
                .update(await readFile(target))
                .digest('hex'),
            });
          } catch (diagnosticError) {
            observations.push({
              state: 'failure-diagnostic-error',
              error: String(diagnosticError),
            });
          }
          throw error;
        } finally {
          try {
            try {
              interactionTrace = await page.evaluate(() => {
                const trace = (
                  window as typeof window & {
                    __menubarTrace?: { events: unknown[]; dropped(): number; stop(): void };
                  }
                ).__menubarTrace;
                trace?.stop();
                return {
                  events: trace?.events ?? [],
                  dropped: trace?.dropped() ?? 0,
                  cap: 160,
                  limitation:
                    'Mutation timestamps describe observer delivery, not mutation instants. Mutation observation covers the document light DOM, not open or closed shadow contents; focus evidence is limited to composed events reaching this document. Empty or truncated trace is not proof of no event.',
                };
              });
            } catch (traceError) {
              observations.push({ state: 'trace-read-error', error: String(traceError) });
            }
            await writeFile(
              path.join(out, `${prefix}.json`),
              JSON.stringify(
                {
                  source,
                  server: {
                    baseUrl,
                    owner: process.env.PROTO_UI_BROWSER_BASE_URL
                      ? 'existing-source-bound-CI-shared-runner'
                      : 'owned-browser-harness',
                  },
                  runtime,
                  scheme,
                  profile: 'rhea',
                  outcome,
                  errors,
                  failure,
                  observations,
                  interactionTrace,
                  screenshots,
                  limitations: [
                    'No New York native parity claim',
                    'No controlled/disabled/touch/AT or submenu acceptance claim',
                    'Root font scaling is not browser UI zoom',
                  ],
                },
                null,
                2
              )
            );
          } finally {
            await context.close();
          }
        }
      }, 90_000);
    }
  }
});
