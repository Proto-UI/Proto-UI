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
              const range = document.createRange();
              range.selectNodeContents(text);
              const selection = getSelection()!;
              selection.removeAllRanges();
              selection.addRange(range);
              const target = document.querySelector<HTMLElement>(
                focusOwner === 'menu'
                  ? '[data-site-header-fallback-summary]'
                  : '[data-site-header-desktop-navigation] a'
              )!;
              const state = {
                code,
                text,
                target,
                anchor: selection.anchorNode,
                anchorOffset: selection.anchorOffset,
                extent: selection.focusNode,
                extentOffset: selection.focusOffset,
                selected: selection.toString(),
                trustedTabCount: 0,
                trace: [] as Record<string, unknown>[],
              };
              (window as any).__nativeFragmentControl = state;
              const observe = (event: Event) => {
                if (event instanceof KeyboardEvent && event.key === 'Tab' && event.isTrusted)
                  state.trustedTabCount++;
                if (state.trace.length < 1200)
                  state.trace.push({
                    kind: event.type,
                    trusted: event.isTrusted,
                    at: performance.now(),
                    readyState: document.readyState,
                    fragmentTarget: document.querySelector(':target')?.id ?? null,
                    focused: document.activeElement === target,
                    activeTag: document.activeElement?.localName,
                    targetTag: event.target instanceof Element ? event.target.localName : null,
                  });
              };
              for (const type of [
                'keydown',
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
              if (input === 'programmatic') target.focus({ preventScroll: true });
            },
            { focusOwner, input }
          );
          if (input === 'keyboard') {
            // A code Range can move the sequential navigation starting point.
            // Walk backwards through the real tab order, never call focus().
            for (let tabs = 0; tabs < 160; tabs++) {
              if ((await page.evaluate(readControl)).focused) break;
              await page.keyboard.press('Shift+Tab');
            }
          }
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
          if (input === 'keyboard') expect(before.trustedTabCount).toBeGreaterThan(0);
          expect(
            emptiedScripts.length,
            'the native document is held by real module requests'
          ).toBeGreaterThan(0);
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
