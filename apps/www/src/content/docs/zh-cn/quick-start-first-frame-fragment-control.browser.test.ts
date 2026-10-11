// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { acquireHeaderKeyboardFocus } from './quick-start-first-frame-keyboard';

// This is a causal control, not a replacement for the real 18-case suite.
// Keep the same initial fragment and document bytes. External JavaScript is
// replaced with an empty module; a response CSP blocks all inline scripts and
// event handlers, so neither kind can secretly enhance or reposition the UI.
const route = '/zh-cn/start-here/quick-start/#_top';
const directory = path.join(
  process.env.PUI_QUICK_START_EVIDENCE_DIR ??
    path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'quick-start-first-frame'),
  'fragment-controls'
);
const emptyModule = '// Native fragment control: no application code.\n';
const inlineScriptPolicy = "script-src 'self'; script-src-attr 'none'";
let browser: Browser;
let baseUrl: string;
let source: { sha: string; tree: string; dirty: boolean };
beforeAll(async () => {
  source = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

async function capture(page: Page, name: string) {
  // Avoid Playwright's whole-document font wait while modules are held.
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(path.join(directory, `${name}.png`), Buffer.from(data, 'base64'));
  } finally {
    await session.detach();
  }
}

function readControl() {
  const state = (window as any).__nativeFragmentControl;
  const selection = getSelection()!;
  return {
    readyState: document.readyState,
    phase: state.phase,
    documentHasFocus: document.hasFocus(),
    visibilityState: document.visibilityState,
    selectionRangeCount: selection.rangeCount,
    selectionAnchor: state.describe(selection.anchorNode),
    selectionExtent: state.describe(selection.focusNode),
    active: state.describe(document.activeElement),
    activePath: state.activePath(),
    target: state.describe(state.target),
    keyboardSteps: state.keyboardSteps,
    rangeSetup: state.rangeSetup,
    headerCandidates: state.headerCandidates,
    actualTheme: document.documentElement.dataset.theme,
    inlinePolicyViolations: (window as any).__inlinePolicyViolations ?? [],
    hash: location.hash,
    fragmentTarget: document.querySelector(':target')?.id ?? null,
    focused: document.activeElement === state.target,
    activeTag: document.activeElement?.localName,
    menuEnhanced: document
      .querySelector('[data-docs-site-header]')
      ?.hasAttribute('data-site-menu-ready'),
    typographyEnhanced: !!document.querySelector('[data-typography-runtime]'),
    codeEnhanced: !!document.querySelector('[data-code-surface-view="ready"]'),
    codeSame: document.querySelector('[data-site-code-surface="frame"] pre') === state.code,
    textRetained: state.text.isConnected && state.code.contains(state.text),
    selectionNonempty: selection.toString().trim().length > 0,
    selectionSame:
      selection.anchorNode === state.anchor &&
      selection.anchorOffset === state.anchorOffset &&
      selection.focusNode === state.extent &&
      selection.focusOffset === state.extentOffset &&
      selection.toString() === state.selected,
    trustedTabCount: state.trustedTabCount,
    trace: state.trace,
  };
}

describe('Quickstart native fragment causal controls, application modules empty', () => {
  for (const focusOwner of ['menu', 'content-link'] as const)
    for (const input of ['programmatic', 'keyboard'] as const)
      it(`${focusOwner}, ${input}: isolate initial fragment focus from enhancement`, async () => {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 1000 },
          colorScheme: 'light',
          bypassCSP: false,
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          // Observer only. Playwright setup is separate from the unchanged
          // document's application scripts, which the response CSP rejects.
          (window as any).__inlinePolicyViolations = [];
          document.addEventListener('securitypolicyviolation', (event) => {
            (window as any).__inlinePolicyViolations.push({
              disposition: event.disposition,
              effectiveDirective: event.effectiveDirective,
              originalPolicy: event.originalPolicy,
              blockedURI: event.blockedURI,
            });
          });
        });
        const name = `${focusOwner}-${input}`;
        const errors: string[] = [];
        const emptiedScripts: string[] = [];
        const documents: Record<string, unknown>[] = [];
        const loader = {
          document: 'unchanged response bytes with an additional restrictive CSP',
          inlineScripts: 'blocked by CSP, including inline modules and event handlers',
          externalScripts: 'every requested script held until release, then empty 200 JavaScript',
          policy: inlineScriptPolicy,
          emptyModuleSHA256: createHash('sha256').update(emptyModule).digest('hex'),
          keyboardSetup:
            'fresh document and empty Selection, native forward Tab to Header, then script-created code Range; no focus correction',
          shadowObservation:
            'open shadow active paths and composed event paths only; closed shadow internals are not inferred',
        };
        page.on('pageerror', (error) => errors.push(error.message));
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/*', async (request) => {
          if (
            request.request().isNavigationRequest() &&
            request.request().resourceType() === 'document'
          ) {
            const response = await request.fetch();
            const body = await response.body();
            const scriptInventory: Record<string, unknown>[] = [];
            const visit = (node: any) => {
              if (node.tagName === 'script') {
                const attributes = Object.fromEntries(
                  node.attrs.map((a: any) => [a.name, a.value])
                );
                scriptInventory.push({
                  type: attributes.type ?? 'classic',
                  src: attributes.src ?? null,
                  inlineSHA256: attributes.src
                    ? null
                    : createHash('sha256')
                        .update(node.childNodes.map((child: any) => child.value ?? '').join(''))
                        .digest('hex'),
                });
              }
              for (const child of node.childNodes ?? []) visit(child);
            };
            visit(parse(body.toString('utf8')));
            documents.push({
              url: response.url(),
              status: response.status(),
              sha256: createHash('sha256').update(body).digest('hex'),
              scriptInventory,
            });
            // fragment-control-response-headers-start
            const headers = {
              ...response.headers(),
              'content-security-policy': [
                response.headers()['content-security-policy'],
                inlineScriptPolicy,
              ]
                .filter(Boolean)
                .join(', '),
            };
            // fragment-control-response-headers-end
            return request.fulfill({ response, body, headers });
          }
          if (request.request().resourceType() !== 'script') return request.continue();
          emptiedScripts.push(request.request().url());
          await gate;
          return request.fulfill({
            status: 200,
            contentType: 'text/javascript',
            body: emptyModule,
          });
        });
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'commit' });
          await page.locator('[data-site-code-surface="frame"] pre').first().waitFor();
          await page.evaluate(
            ({ focusOwner, input }) => {
              const code = document.querySelector('[data-site-code-surface="frame"] pre')!;
              const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
              let text = walker.nextNode()!;
              while (text && !text.textContent?.trim()) text = walker.nextNode()!;
              const selection = getSelection()!;
              const target = document.querySelector<HTMLElement>(
                focusOwner === 'menu'
                  ? '[data-site-header-fallback-summary]'
                  : '[data-site-header-desktop-navigation] a'
              )!;
              // native-focus-description-start
              const nodeIds = new WeakMap<Node, number>();
              let nextNodeId = 1;
              const describe = (node: Node | null): any => {
                if (!node) return null;
                if (!nodeIds.has(node)) nodeIds.set(node, nextNodeId++);
                const element = node instanceof Element ? node : node.parentElement;
                if (!element) return { nodeId: nodeIds.get(node), nodeType: node.nodeType };
                const header = document.querySelector('[data-docs-site-header]');
                const css = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const ancestors = [];
                let blockedByClosedDetails = false;
                let hiddenOrInert = false;
                for (let owner: Element | null = element; owner; ) {
                  const style = getComputedStyle(owner);
                  const summary: Element | null =
                    owner.localName === 'details'
                      ? ([...owner.children].find((child) => child.localName === 'summary') ?? null)
                      : null;
                  const closed = owner.localName === 'details' && !owner.hasAttribute('open');
                  const inFirstSummary =
                    !!summary && (summary === element || summary.contains(element));
                  if (closed && !inFirstSummary) blockedByClosedDetails = true;
                  if (owner.hasAttribute('hidden') || owner.hasAttribute('inert'))
                    hiddenOrInert = true;
                  if (
                    owner === element ||
                    closed ||
                    owner.hasAttribute('hidden') ||
                    owner.hasAttribute('inert') ||
                    style.display === 'none' ||
                    style.visibility !== 'visible' ||
                    style.contentVisibility === 'hidden'
                  )
                    ancestors.push({
                      tag: owner.localName,
                      id: owner.id,
                      closedDetails: closed,
                      inFirstSummary,
                      hidden: owner.hasAttribute('hidden'),
                      inert: owner.hasAttribute('inert'),
                      display: style.display,
                      visibility: style.visibility,
                      contentVisibility: style.contentVisibility,
                    });
                  const root = owner.getRootNode();
                  owner = owner.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
                }
                const root = element.getRootNode();
                return {
                  nodeId: nodeIds.get(node),
                  nodeType: node.nodeType,
                  tag: element.localName,
                  id: element.id,
                  text: (node.textContent ?? '').trim().slice(0, 80),
                  href: element.getAttribute('href'),
                  tabIndex: (element as HTMLElement).tabIndex,
                  tabindexAttribute: element.getAttribute('tabindex'),
                  connected: node.isConnected,
                  disabled: element.matches(':disabled'),
                  hiddenOrInert,
                  blockedByClosedDetails,
                  ancestors,
                  inHeader: !!header?.contains(element),
                  precedesHeader:
                    !!header &&
                    !header.contains(element) &&
                    !!(element.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING),
                  root:
                    root instanceof ShadowRoot
                      ? { type: 'shadow', mode: root.mode, host: root.host.localName }
                      : { type: 'document' },
                  exposedShadowRoot: element.shadowRoot?.mode ?? null,
                  checkVisibility:
                    element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ??
                    null,
                  rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  css: {
                    display: css.display,
                    visibility: css.visibility,
                    opacity: css.opacity,
                    contentVisibility: css.contentVisibility,
                  },
                };
              };
              const activePath = () => {
                const result = [];
                for (
                  let owner = document.activeElement;
                  owner;
                  owner = owner.shadowRoot?.activeElement ?? null
                )
                  result.push(describe(owner));
                return result;
              };
              // native-focus-description-end
              const state = {
                code,
                text,
                target,
                describe,
                activePath,
                phase: 'initial' as string,
                anchor: null as Node | null,
                anchorOffset: 0,
                extent: null as Node | null,
                extentOffset: 0,
                selected: '',
                trustedTabCount: 0,
                keyboardSteps: 0,
                rangeSetup: null as Record<string, unknown> | null,
                headerCandidates: {
                  kind: 'DOM-order hints only; actual Tab order is recorded by trusted focus events',
                  nodes: [
                    ...document.querySelectorAll(
                      '[data-docs-site-header] a[href], [data-docs-site-header] summary, [data-docs-site-header] button, [data-docs-site-header] [tabindex]'
                    ),
                  ].map(describe),
                },
                trace: [] as Record<string, unknown>[],
                selectCode: () => {
                  const focusedBefore = document.activeElement;
                  state.phase = 'code-range-setup';
                  const range = document.createRange();
                  range.selectNodeContents(text);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  state.anchor = selection.anchorNode;
                  state.anchorOffset = selection.anchorOffset;
                  state.extent = selection.focusNode;
                  state.extentOffset = selection.focusOffset;
                  state.selected = selection.toString();
                  state.rangeSetup = {
                    focusRetained: document.activeElement === focusedBefore,
                    before: describe(focusedBefore),
                    after: describe(document.activeElement),
                  };
                  return state.rangeSetup;
                },
              };
              (window as any).__nativeFragmentControl = state;
              // native-keyboard-observer-start
              const observe = (event: Event) => {
                if (
                  event.type === 'keydown' &&
                  event instanceof KeyboardEvent &&
                  event.key === 'Tab' &&
                  event.isTrusted
                )
                  state.trustedTabCount++;
                if (state.trace.length < 1200)
                  state.trace.push({
                    kind: event.type,
                    phase: state.phase,
                    key: event instanceof KeyboardEvent ? event.key : null,
                    code: event instanceof KeyboardEvent ? event.code : null,
                    shiftKey: event instanceof KeyboardEvent ? event.shiftKey : null,
                    documentHasFocus: document.hasFocus(),
                    active: describe(document.activeElement),
                    activePath: activePath(),
                    eventTarget: event.target instanceof Node ? describe(event.target) : null,
                    relatedTarget:
                      event instanceof FocusEvent && event.relatedTarget instanceof Node
                        ? describe(event.relatedTarget)
                        : null,
                    composedPath: event
                      .composedPath()
                      .filter((node): node is Node => node instanceof Node)
                      .map(describe),
                    intendedTarget: describe(target),
                    trusted: event.isTrusted,
                    at: performance.now(),
                    readyState: document.readyState,
                    fragmentTarget: document.querySelector(':target')?.id ?? null,
                    focused: document.activeElement === target,
                    activeTag: document.activeElement?.localName,
                    targetTag: event.target instanceof Element ? event.target.localName : null,
                  });
              };
              // native-keyboard-observer-end
              for (const type of [
                'keydown',
                'keyup',
                'focusin',
                'focusout',
                'selectionchange',
                'DOMContentLoaded',
              ])
                document.addEventListener(type, observe, true);
              for (const type of ['load', 'pageshow', 'hashchange'])
                window.addEventListener(type, observe);
              // The first arm reproduces the original injected setup. The second
              // acquires focus only with browser keyboard input below. Neither arm
              // restores focus after releasing the pending initial navigation.
              if (input === 'programmatic') {
                state.selectCode();
                target.focus({ preventScroll: true });
              } else state.phase = 'keyboard-acquisition';
            },
            { focusOwner, input }
          );
          if (input === 'keyboard') {
            // Range setup can move the sequential starting point even with body
            // active. Acquire the Header through its short fresh-document prefix
            // first; don't reverse through the sidebar or repair focus with JS.
            await writeFile(
              path.join(directory, `${name}-keyboard-start.json`),
              JSON.stringify(
                {
                  source,
                  browser: browser.version(),
                  loader,
                  start: await page.evaluate(readControl),
                },
                null,
                2
              )
            );
            const steps = await acquireHeaderKeyboardFocus(
              () => page.evaluate(readControl),
              () => page.keyboard.press('Tab')
            );
            await page.evaluate((steps) => {
              (window as any).__nativeFragmentControl.keyboardSteps = steps;
            }, steps);
            const rangeSetup = await page.evaluate(() =>
              (window as any).__nativeFragmentControl.selectCode()
            );
            expect(
              rangeSetup.focusRetained,
              'the code Range must not change the keyboard-acquired owner'
            ).toBe(true);
          }
          await page.evaluate(() => {
            (window as any).__nativeFragmentControl.phase = 'before-release';
          });
          const before = await page.evaluate(readControl);
          await writeFile(
            path.join(directory, `${name}-before.json`),
            JSON.stringify(
              {
                source,
                browser: browser.version(),
                input,
                selectionInput: 'script-created native Range',
                url: page.url(),
                loader,
                documents,
                emptiedScripts,
                before,
              },
              null,
              2
            )
          );
          await capture(page, `${name}-before`);
          expect(before.hash).toBe('#_top');
          expect(before.fragmentTarget, 'initial native fragment has not completed').toBeNull();
          expect(before.focused, 'the intended pre-completion owner really acquired focus').toBe(
            true
          );
          expect(before.menuEnhanced).toBe(false);
          expect(before.typographyEnhanced).toBe(false);
          expect(before.codeEnhanced).toBe(false);
          expect(before.selectionNonempty).toBe(true);
          expect(before.selectionSame).toBe(true);
          // enforced-inline-policy-observation-start
          const enforcedInlineBlock = before.inlinePolicyViolations.some(
            (event: {
              disposition: string;
              effectiveDirective: string;
              originalPolicy: string;
              blockedURI: string;
            }) =>
              event.disposition === 'enforce' &&
              ['script-src', 'script-src-elem'].includes(event.effectiveDirective) &&
              event.originalPolicy === inlineScriptPolicy &&
              event.blockedURI === 'inline'
          );
          // enforced-inline-policy-observation-end
          expect(enforcedInlineBlock, 'the browser actually enforced the no-inline policy').toBe(
            true
          );
          if (input === 'keyboard') {
            expect(before.trustedTabCount).toBeGreaterThan(0);
            expect(before.trustedTabCount).toBe(before.keyboardSteps);
            expect(
              before.trace
                .filter((event: any) => event.kind === 'keydown' && event.key === 'Tab')
                .every((event: any) => event.trusted && event.shiftKey === false)
            ).toBe(true);
          }
          expect(
            emptiedScripts.length,
            'the native document is held by real module requests'
          ).toBeGreaterThan(0);
          await page.evaluate(() => {
            (window as any).__nativeFragmentControl.phase = 'document-completion';
          });
          release();
          await page.waitForLoadState('load');
          await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          );
          const after = await page.evaluate(readControl);
          await writeFile(
            path.join(directory, `${name}-after.json`),
            JSON.stringify(
              {
                source,
                browser: browser.version(),
                input,
                selectionInput: 'script-created native Range',
                url: page.url(),
                loader,
                documents,
                emptiedScripts,
                errors,
                before,
                after,
              },
              null,
              2
            )
          );
          await capture(page, `${name}-after`);
          expect(errors).toEqual([]);
          expect(after.hash).toBe('#_top');
          expect(after.fragmentTarget).toBe('_top');
          expect(after.menuEnhanced).toBe(false);
          expect(after.typographyEnhanced).toBe(false);
          expect(after.codeEnhanced).toBe(false);
          expect(after.codeSame).toBe(true);
          expect(after.textRetained).toBe(true);
          expect(after.selectionSame).toBe(true);
          // HTML scroll-to-fragment focuses a non-focusable target's viewport.
          // This prediction must be verified natively before changing the real
          // ownership gate. A failure rejects this proposed causal explanation.
          expect(
            after.focused,
            'empty modules still expose the pending native fragment focus'
          ).toBe(false);
          expect(after.activeTag).toBe('body');
        } catch (error) {
          await writeFile(
            path.join(directory, `${name}-failure.json`),
            JSON.stringify(
              {
                source,
                browser: browser.version(),
                url: page.url(),
                loader,
                documents,
                emptiedScripts,
                errors,
                failure: error instanceof Error ? (error.stack ?? error.message) : String(error),
                observed: await page.evaluate(readControl).catch(() => null),
              },
              null,
              2
            )
          );
          await capture(page, `${name}-failure`).catch(() => {});
          throw error;
        } finally {
          release();
          await page.unrouteAll({ behavior: 'wait' });
          await context.close();
        }
      }, 90_000);
});
