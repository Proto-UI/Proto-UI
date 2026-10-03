// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Browser, JSHandle, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { highlightCode } from '../../../components/PrototypePreviewer/code-highlight';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import {
  nativeCodeSelectionScrollTarget,
  nativeCodeSelectionHasGutter,
} from './code-surface-evidence';

// Issue #630 acceptance; website presentation only, not a Prototype guarantee.
const ROUTE = '/zh-cn/ui-libraries/base/transition/';
const QUICK_START = '/zh-cn/start-here/quick-start/';
let browser: Browser;
let baseUrl: string;

type CodeStyleFacts = {
  background: string;
  color: string;
  font: string;
  size: string;
  lineHeight: string;
};

type SurfaceFacts = {
  ec: CodeStyleFacts;
  preview: CodeStyleFacts;
  ecCode: CodeStyleFacts;
  previewCode: CodeStyleFacts;
  border: [string, string];
  radius: [string, string];
  expectedPreviewRadius: string;
  canvasCount: number | null;
  layoutBorderWidths: string[] | null;
  documentOverflow: number;
};

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

async function ready(page: Page): Promise<void> {
  await page.waitForSelector('[data-code-panel-init="1"]:visible');
  await page.waitForFunction(() => customElements.get('wc-shadcn-button'));
  // CodePanel initializes before the async Previewer mount replaces its SSR pre.
  // Wait for that replacement before Playwright can retain an element to measure.
  await page.waitForFunction(() => {
    const shell = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find((element) =>
      element.checkVisibility()
    );
    if (!shell) return false;
    const previewer = shell.closest('[data-previewer-id]') as
      | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
      | null;
    // CodeExample owns a CodePanel without an async Previewer runtime.
    const sources = document.querySelectorAll<HTMLElement>('[data-site-code-surface="frame"]');
    const visibleReady = [...sources]
      .filter((root) => root.checkVisibility())
      .every((root) => root.dataset.codeSurfaceView === 'ready');
    return visibleReady && (!previewer || Boolean(previewer.__previewer__?.getCurrentRuntime()));
  });
}

async function surfaceFacts(page: Page): Promise<SurfaceFacts> {
  return page.evaluate(() => {
    const ec = document.querySelector<HTMLElement>('.expressive-code pre')!;
    const preview = [...document.querySelectorAll<HTMLElement>('.proto-previewer__code')].find(
      (element) => element.checkVisibility()
    )!;
    const card = preview.closest<HTMLElement>('.proto-previewer, .code-example')!;
    const isRuntimePreview = card.matches('.proto-previewer');
    const canvases = card.querySelectorAll<HTMLElement>(
      '.pui-runtime-preview-surface[data-pui-style]'
    );
    const sourceFrame = preview.closest<HTMLElement>('[data-site-code-surface="frame"]')!;
    const frame = sourceFrame.querySelector<HTMLElement>(
      ':scope > .site-code-surface-mount .site-code-surface-paint'
    )!;
    const ecFrame = ec
      .closest<HTMLElement>('[data-site-code-surface="frame"]')!
      .querySelector<HTMLElement>(':scope > .site-code-surface-mount .site-code-surface-paint')!;
    if (!frame) throw new Error('The committed RuntimeBox canvas must exist before paint evidence');
    const frameStyle = getComputedStyle(frame);
    const layoutStyle = getComputedStyle(card);
    // Source frames now share an actual passive Prototype; the RuntimeBox
    // canvas remains separate. Derive expected radius from the theme input.
    const radiusProbe = document.createElement('span');
    radiusProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    radiusProbe.style.setProperty('--pui-radius', frameStyle.getPropertyValue('--pui-radius'));
    radiusProbe.style.setProperty(
      '--pui-radius-xl',
      frameStyle.getPropertyValue('--pui-radius-xl')
    );
    radiusProbe.style.borderRadius = 'var(--pui-radius-xl)';
    document.body.append(radiusProbe);
    const expectedPreviewRadius = getComputedStyle(radiusProbe).borderRadius;
    radiusProbe.remove();
    const facts = (element: HTMLElement, surface?: HTMLElement): CodeStyleFacts => {
      const style = getComputedStyle(element);
      return {
        background: surface ? getComputedStyle(surface).backgroundColor : style.backgroundColor,
        color: style.color,
        font: style.fontFamily,
        size: style.fontSize,
        lineHeight: style.lineHeight,
      };
    };
    return {
      ec: facts(ec, ecFrame),
      preview: facts(preview, frame),
      ecCode: facts(ec.querySelector('code')!),
      previewCode: facts(preview.querySelector('code')!),
      border: [getComputedStyle(ecFrame).borderLeftColor, frameStyle.borderLeftColor],
      radius: [getComputedStyle(ecFrame).borderRadius, frameStyle.borderRadius],
      expectedPreviewRadius,
      canvasCount: isRuntimePreview ? canvases.length : null,
      layoutBorderWidths: isRuntimePreview
        ? [
            layoutStyle.borderTopWidth,
            layoutStyle.borderRightWidth,
            layoutStyle.borderBottomWidth,
            layoutStyle.borderLeftWidth,
          ]
        : null,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function expectSurfaces(page: Page): Promise<SurfaceFacts> {
  const facts = await surfaceFacts(page);
  expect(facts.preview).toEqual(facts.ec);
  expect(facts.previewCode).toEqual(facts.ecCode);
  expect(facts.ec.size).toBe('13px');
  expect(facts.ec.lineHeight).toBe('24px');
  expect(facts.radius[0]).toBe(facts.expectedPreviewRadius);
  expect(parseFloat(facts.expectedPreviewRadius)).toBeGreaterThan(0);
  expect(facts.radius[1]).toBe(facts.expectedPreviewRadius);
  if (facts.canvasCount !== null) {
    expect(facts.canvasCount).toBe(1);
    expect(facts.layoutBorderWidths).toEqual(['0px', '0px', '0px', '0px']);
  }
  expect(facts.border[0]).toBe(facts.border[1]);
  if (facts.documentOverflow > 1) {
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            id: element.id,
            className: element.className,
            ref: element.dataset.demoRef,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            right: rect.right,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            display: style.display,
            flexWrap: style.flexWrap,
            overflowX: style.overflowX,
          };
        })
        .filter(
          (row) =>
            row.width > 0 &&
            (row.right > innerWidth + 1 || row.x < -1 || row.scrollWidth > row.clientWidth + 1)
        )
    );
    await retainEvidence(
      page,
      `overflow-${page.viewportSize()?.width}-${await page.evaluate(() => document.documentElement.dataset.theme)}`,
      { facts, overflow }
    );
  }
  expect(facts.documentOverflow).toBeLessThanOrEqual(1);
  return facts;
}

async function expectCopyControls(page: Page): Promise<void> {
  const panel = page.locator('[data-code-shell]:visible').first();
  const toggle = panel.locator('[data-code-toggle]');
  if (await toggle.isVisible()) await toggle.click();
  const ec = page
    .locator(
      '.expressive-code [data-site-copy][data-copy-view="ready"] [data-demo-ref="copy-button"]'
    )
    .first();
  const preview = panel.locator(
    '[data-copy][data-copy-view="ready"] [data-demo-ref="copy-button"]'
  );
  for (const control of [ec, preview]) {
    await control.waitFor({ state: 'visible' });
    await page.mouse.move(0, 0);
    await control.evaluate((element: HTMLElement) => element.blur());
    const facts = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      const icon = element.querySelector('svg')!;
      const buttonRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const radius = document.createElement('div');
      radius.style.borderRadius = style.getPropertyValue('--pui-radius-lg');
      element.parentElement!.append(radius);
      const expectedRadius = getComputedStyle(radius).borderRadius;
      radius.remove();
      return {
        width: style.width,
        height: style.height,
        radius: style.borderRadius,
        expectedRadius,
        opacity: style.opacity,
        glyph: [getComputedStyle(icon).width, getComputedStyle(icon).height],
        center: [
          Math.abs(iconRect.x + iconRect.width / 2 - buttonRect.x - buttonRect.width / 2),
          Math.abs(iconRect.y + iconRect.height / 2 - buttonRect.y - buttonRect.height / 2),
        ],
        tokens: element.getAttribute('data-pui-style'),
        shadow: style.boxShadow,
      };
    });
    // #630 keeps its 32px/18px geometry. Radius and focus now belong to the
    // actual Shadcn Button's rounded-lg/ring-3 recipe, not a CSS imitation.
    expect([facts.width, facts.height, ...facts.glyph]).toEqual(['32px', '32px', '18px', '18px']);
    expect(facts.radius).toBe(facts.expectedRadius);
    expect(facts.opacity).toBe('1');
    expect(facts.tokens).toContain('rounded-lg');
    expect(Math.max(...facts.center)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Tab');
    await control.focus();
    await page.waitForFunction(
      (element) => element?.getAttribute('data-pui-style')?.includes('ring-3'),
      await control.elementHandle()
    );
    const focused = await control.evaluate((element) => ({
      focused: document.activeElement === element,
      shadow: getComputedStyle(element).boxShadow,
    }));
    expect(focused.focused).toBe(true);
    expect(focused.shadow).not.toBe(facts.shadow);
  }
  expect(await preview.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    await ec.evaluate((element) => getComputedStyle(element).backgroundColor)
  );
}

// Compare actual EC output against the same source rendered by the Previewer's
// highlighter, in its real code panel. Character colors avoid pinning span splits.
async function paletteProbe(page: Page): Promise<void> {
  const source = await page
    .locator('.expressive-code pre[data-language="ts"]')
    .evaluate((pre) =>
      [...pre.querySelectorAll('.ec-line .code')].map((line) => line.textContent).join('\n')
    );
  const html = await highlightCode(source, 'typescript');
  await page
    .locator('[data-code-content]')
    .first()
    .evaluate((content, highlighted) => {
      content.innerHTML = highlighted;
    }, html);
  const palettes = await page.evaluate(() => {
    const colors = (root: Element) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const result: [string, string][] = [];
      while (walker.nextNode()) {
        const text = walker.currentNode;
        for (const character of text.textContent ?? '') {
          if (!/\s/.test(character))
            result.push([character, getComputedStyle(text.parentElement!).color]);
        }
      }
      return result;
    };
    return {
      ec: colors(document.querySelector('.expressive-code pre[data-language="ts"]')!),
      preview: colors(document.querySelector('.proto-previewer__code')!),
    };
  });
  expect(palettes.preview).toEqual(palettes.ec);
  // A real author override must win without participating in an !important fight.
  await page.addStyleTag({
    content: '.proto-previewer__code span[style] { color: rgb(1, 2, 3); }',
  });
  expect(
    await page
      .locator('.proto-previewer__code span[style]')
      .first()
      .evaluate((element) => getComputedStyle(element).color)
  ).toBe('rgb(1, 2, 3)');
  expect(
    await page
      .locator('.proto-previewer__code')
      .first()
      .evaluate((element) => {
        element.style.backgroundColor = 'rgb(4, 5, 6)';
        return getComputedStyle(element).backgroundColor;
      })
  ).toBe('rgb(4, 5, 6)');
}

// Observe the unchanged native gesture on the same retained token. In particular,
// a sticky line-number pseudo-element can hit-test as its .line origin even when
// a token's Range rect lies underneath it. This probe never changes DOM/selection.
function installNativeSelectionEventProbe(
  element: HTMLElement | SVGElement,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const pre = element.closest('pre')!;
  const line = element.closest('.line')!;
  const rect = (value: DOMRect) => ({
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  });
  const node = (value: Node | null) =>
    value && {
      name: value.nodeName,
      text: value.nodeValue,
      className: value instanceof Element ? value.getAttribute('class') : null,
      parentTag: value.parentElement?.tagName ?? null,
      relation:
        value === element
          ? 'token'
          : element.contains(value)
            ? 'token-descendant'
            : value === line
              ? 'line'
              : value === pre
                ? 'pre'
                : 'other',
    };
  const endpoint = (value: Node | null, offset: number | null) => ({
    node: node(value),
    offset,
  });
  const caret = (point: { x: number; y: number }) => {
    // Measurement only: this Range is never installed as the Selection.
    const range = document.caretRangeFromPoint?.(point.x, point.y);
    return range ? endpoint(range.startContainer, range.startOffset) : null;
  };
  const start = { x: bounds.x + 1, y: bounds.y + bounds.height / 2 };
  const end = { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height / 2 };
  const pointFacts = (point: { x: number; y: number }) => ({
    point,
    hit: node(document.elementFromPoint(point.x, point.y)),
    caret: caret(point),
  });
  const gutter = () => {
    const style = getComputedStyle(line, '::before');
    return {
      // These are computed pseudo styles plus its originating element's rect,
      // not a claimed directly measured pseudo-element border box.
      origin: node(line),
      originRect: rect(line.getBoundingClientRect()),
      content: style.content,
      position: style.position,
      left: style.left,
      width: style.width,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      boxSizing: style.boxSizing,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      userSelect: style.userSelect,
    };
  };
  const snapshot = () => {
    const selection = getSelection();
    return {
      token: {
        connected: element.isConnected,
        sameToken:
          pre.querySelector('.line') === line &&
          [...line.querySelectorAll('span')].find(
            (span) => span.textContent === 'wc-base-transition'
          ) === element,
        text: element.textContent,
        rect: rect(element.getBoundingClientRect()),
      },
      pre: {
        rect: rect(pre.getBoundingClientRect()),
        scrollLeft: pre.scrollLeft,
        scrollTop: pre.scrollTop,
      },
      selection: {
        text: selection?.toString() ?? null,
        anchor: endpoint(selection?.anchorNode ?? null, selection?.anchorOffset ?? null),
        focus: endpoint(selection?.focusNode ?? null, selection?.focusOffset ?? null),
      },
    };
  };
  const initial = {
    ...snapshot(),
    start: pointFacts(start),
    end: pointFacts(end),
    gutter: gutter(),
  };
  const observations: { event: Event; facts: unknown }[] = [];
  const errors: string[] = [];
  let dropped = 0;
  const observe = (event: Event) => {
    if (observations.length >= 64) {
      dropped++;
      return;
    }
    try {
      const mouse = event instanceof MouseEvent ? event : null;
      observations.push({
        event,
        facts: {
          type: event.type,
          phase: event.type === 'selectionchange' ? 'notification' : 'capture-before-default',
          timeStamp: event.timeStamp,
          isTrusted: event.isTrusted,
          target: event.target instanceof Node ? node(event.target) : null,
          buttons: mouse?.buttons ?? null,
          detail: mouse?.detail ?? null,
          pointer: mouse ? pointFacts({ x: mouse.clientX, y: mouse.clientY }) : null,
          ...snapshot(),
        },
      });
    } catch (error) {
      if (errors.length < 4) errors.push(String(error));
    }
  };
  const events = [
    'pointerdown',
    'mousedown',
    'pointermove',
    'mousemove',
    'pointerup',
    'mouseup',
    'selectionchange',
  ];
  for (const type of events)
    document.addEventListener(type, observe, { capture: true, passive: true });
  return {
    finish() {
      for (const type of events) document.removeEventListener(type, observe, true);
      return {
        mode: 'passive-same-token-native-gesture',
        productionCodeChanged: false,
        gestureChanged: false,
        initial,
        events: observations.map(({ event, facts }) => ({
          ...(facts as object),
          defaultPreventedAfterDispatch: event.defaultPrevented,
        })),
        final: { ...snapshot(), start: pointFacts(start), end: pointFacts(end), gutter: gutter() },
        dropped,
        errors,
      };
    },
  };
}

// Read-only failure probe. Ranges measure text runs; they are never installed as
// the browser selection. Keep the original mouse drag and exact assertion.
function readNativeSelectionDiagnostics(
  element: HTMLElement | SVGElement,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const rect = (value: DOMRect) => ({
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  });
  const node = (value: Node | null) =>
    value && {
      name: value.nodeName,
      text: value.nodeValue,
      index: value.parentNode
        ? Array.from(value.parentNode.childNodes).indexOf(value as ChildNode)
        : -1,
      parentTag: value.parentElement?.tagName ?? null,
      parentText: value.parentElement?.textContent ?? null,
    };
  const textRuns = (root: Node | null) => {
    if (!root) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const runs = [];
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const value = text.nodeValue ?? '';
      const glyphs = [];
      for (let offset = 0; offset < value.length; offset++) {
        const range = document.createRange();
        range.setStart(text, offset);
        range.setEnd(text, offset + 1);
        glyphs.push({
          offset,
          text: value[offset],
          rects: Array.from(range.getClientRects(), rect),
        });
      }
      runs.push({ node: node(text), glyphs });
    }
    return runs;
  };
  const selection = getSelection();
  const pre = element.closest('pre')!;
  const style = getComputedStyle(pre);
  return {
    selectedText: selection?.toString() ?? null,
    anchor: { node: node(selection?.anchorNode ?? null), offset: selection?.anchorOffset ?? null },
    focus: { node: node(selection?.focusNode ?? null), offset: selection?.focusOffset ?? null },
    selectionRects: selection?.rangeCount
      ? Array.from(selection.getRangeAt(0).getClientRects(), rect)
      : [],
    token: {
      text: element.textContent,
      rect: rect(element.getBoundingClientRect()),
      runs: textRuns(element),
    },
    nextRun: textRuns(element.nextSibling),
    pre: {
      rect: rect(pre.getBoundingClientRect()),
      scrollLeft: pre.scrollLeft,
      scrollTop: pre.scrollTop,
      clientWidth: pre.clientWidth,
      scrollWidth: pre.scrollWidth,
      font: style.font,
      whiteSpace: style.whiteSpace,
      userSelect: style.userSelect,
    },
    hitTargets: {
      start: node(document.elementFromPoint(bounds.x + 1, bounds.y + bounds.height / 2)),
      end: node(
        document.elementFromPoint(bounds.x + bounds.width - 1, bounds.y + bounds.height / 2)
      ),
    },
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, devicePixelRatio },
  };
}

async function expectNativeTokenSelection(
  page: Page,
  token: Locator,
  bounds: { x: number; y: number; width: number; height: number },
  name: string,
  preparation: unknown
): Promise<void> {
  const selected = await page.evaluate(() => getSelection()?.toString());
  {
    try {
      const facts = {
        name,
        source: {
          exactSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          expectedSHA: process.env.CANDIDATE_SHA ?? process.env.PROTO_UI_EXPECTED_REVISION ?? null,
          eventSHA: process.env.GITHUB_SHA ?? null,
        },
        preparation,
        drag: {
          start: { x: bounds.x + 1, y: bounds.y + bounds.height / 2 },
          end: { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height / 2 },
          steps: 8,
        },
        observed: await token.evaluate(readNativeSelectionDiagnostics, bounds),
      };
      if (selected !== 'wc-base-transition')
        console.error('[code-native-selection]', JSON.stringify(facts));
      const directory =
        process.env.PROTO_UI_CODE_EVIDENCE_DIR ??
        (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
          ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'code-surfaces')
          : undefined);
      if (directory) {
        await mkdir(directory, { recursive: true });
        await writeFile(
          join(directory, `${name}-native-selection.json`),
          JSON.stringify(facts, null, 2)
        );
      }
    } catch (error) {
      console.error('[code-native-selection] diagnosis unavailable:', String(error));
    }
  }
  // Whitespace is significant: diagnostics must never normalize the payload or
  // replace the original selection failure, even if collection itself fails.
  expect(selected).toBe('wc-base-transition');
}

async function retainEvidence(page: Page, name: string, facts: unknown): Promise<void> {
  const directory =
    process.env.PROTO_UI_CODE_EVIDENCE_DIR ??
    (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
      ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'code-surfaces')
      : undefined);
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.json`), JSON.stringify(facts, null, 2));
  await page
    .locator(
      name.endsWith('-install') ? '.install-command-card:visible' : '[data-code-shell]:visible'
    )
    .first()
    .evaluate((element) => element.scrollIntoView({ block: 'center' }));
  // CDP capture does not wait for unrelated external webfonts to finish loading.
  const session = await page.context().newCDPSession(page);
  const image = await session.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(directory, `${name}.png`), Buffer.from(image.data, 'base64'));
  if (name.endsWith('-expanded')) {
    await page
      .locator('.expressive-code')
      .first()
      .evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const markdown = await session.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(directory, `${name}-markdown.png`), Buffer.from(markdown.data, 'base64'));
  }
  await session.detach();
}

describe.sequential('code-surface dogfood matrix (#630, #420, #568)', () => {
  for (const width of [1440, 390, 320]) {
    for (const theme of ['light', 'dark'] as const) {
      it(`shares tokens, palette, controls and scroll at ${width}px/${theme}`, async () => {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          // Explicit site selection must win over the opposite OS preference.
          colorScheme: theme === 'dark' ? 'light' : 'dark',
        });
        const page = await context.newPage();
        try {
          await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
          await ready(page);
          await page.evaluate((mode) => {
            document.documentElement.dataset.theme = mode;
          }, theme);
          const facts = await expectSurfaces(page);
          if (width === 1440) {
            const box = page.locator('.transition-box').first();
            const boxGeometry = await box.evaluate((element) => ({
              layoutWidth: (element as HTMLElement).offsetWidth,
              visualWidth: element.getBoundingClientRect().width,
              transform: getComputedStyle(element).transform,
              declaredWidth: getComputedStyle(element).width,
            }));
            Object.assign(facts, { transitionBoxGeometry: boxGeometry });
            // The authored entering/leaving scale (.98) changes the visual
            // rectangle, not the 256px desktop layout contract.
            expect(boxGeometry.layoutWidth).toBe(256);
            expect(boxGeometry.declaredWidth).toBe('256px');
          }
          const pre = page.locator('.proto-previewer__code').first();
          const collapsed = await pre.evaluate((element) => {
            const content = element.closest('[data-code-content]')!;
            return {
              expanded: element.closest<HTMLElement>('[data-code-shell]')!.dataset.codeExpanded,
              selectable: getComputedStyle(content).userSelect !== 'none',
              overflow: getComputedStyle(element).overflowX,
              scrollable: element.scrollWidth > element.clientWidth,
            };
          });
          expect(collapsed).toEqual({
            expanded: 'false',
            selectable: true,
            overflow: 'auto',
            scrollable: true,
          });
          await pre.evaluate((element) => element.scrollIntoView({ block: 'center' }));
          const token = pre
            .locator('.line')
            .first()
            .locator('span')
            .filter({ hasText: /^wc-base-transition$/ });
          const originalToken = (await token.elementHandle())!;
          const readGeometry = (element: HTMLElement | SVGElement) => {
            const rect = element.getBoundingClientRect();
            const pre = element.closest('pre')!;
            const box = pre.getBoundingClientRect();
            return {
              token: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              pre: {
                left: box.x + pre.clientLeft,
                width: pre.clientWidth,
                scrollLeft: pre.scrollLeft,
                scrollWidth: pre.scrollWidth,
              },
            };
          };
          const beforeWheel = await originalToken.evaluate(readGeometry);
          const targetScroll = nativeCodeSelectionScrollTarget(beforeWheel);
          const delta = targetScroll - beforeWheel.pre.scrollLeft;
          await page.mouse.move(
            beforeWheel.pre.left + beforeWheel.pre.width / 2,
            beforeWheel.token.y + beforeWheel.token.height / 2
          );
          if (Math.abs(delta) > 0.5) await page.mouse.wheel(delta, 0);
          await expect
            .poll(
              async () =>
                Math.abs(
                  (await originalToken.evaluate(readGeometry)).pre.scrollLeft - targetScroll
                ),
              { timeout: 2000 }
            )
            .toBeLessThanOrEqual(1);
          await expect
            .poll(
              async () =>
                originalToken.evaluate(async (element) => {
                  const sample = () => {
                    const r = element.getBoundingClientRect();
                    const p = element.closest('pre')!;
                    return JSON.stringify([r.x, r.y, r.width, r.height, p.scrollLeft, p.scrollTop]);
                  };
                  const first = sample();
                  await new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                  );
                  return first === sample();
                }),
              { timeout: 2000 }
            )
            .toBe(true);
          expect(
            await originalToken.evaluate(
              (node) => node.isConnected && node.textContent === 'wc-base-transition'
            )
          ).toBe(true);
          const afterWheel = await originalToken.evaluate(readGeometry);
          expect(nativeCodeSelectionHasGutter(afterWheel)).toBe(true);
          const bounds = (await originalToken.boundingBox())!;
          const preparation = {
            beforeWheel,
            wheel: { deltaX: delta, deltaY: 0, targetScroll },
            afterWheel,
            nativeEventProbe: null as unknown,
          };
          let eventProbe: JSHandle<ReturnType<typeof installNativeSelectionEventProbe>> | undefined;
          try {
            eventProbe = await originalToken.evaluateHandle(
              installNativeSelectionEventProbe,
              bounds
            );
          } catch (error) {
            preparation.nativeEventProbe = { setupError: String(error) };
          }
          try {
            await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
            await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width - 1, bounds.y + bounds.height / 2, {
              steps: 8,
            });
            await page.mouse.up();
          } finally {
            if (eventProbe) {
              try {
                preparation.nativeEventProbe = await eventProbe.evaluate((probe) => probe.finish());
              } catch (error) {
                preparation.nativeEventProbe = { collectionError: String(error) };
              }
              await eventProbe.dispose().catch(() => {});
            }
          }
          await expectNativeTokenSelection(page, token, bounds, `${width}-${theme}`, preparation);
          await originalToken.dispose();
          await page.evaluate(() => getSelection()?.removeAllRanges());
          await pre.focus();
          const beforeArrow = await pre.evaluate((element) => element.scrollLeft);
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(
            (before) => document.querySelector('.proto-previewer__code')!.scrollLeft > before,
            beforeArrow
          );
          await retainEvidence(page, `${width}-${theme}-collapsed`, { facts, collapsed });
          await expectCopyControls(page);
          await retainEvidence(page, `${width}-${theme}-expanded`, await surfaceFacts(page));
          await paletteProbe(page);
        } finally {
          await context.close();
        }
      }, 90_000);
    }
  }

  it('retains CodeExample and install tokens across navigation and Astro reinitialization', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate(() => {
        sessionStorage.setItem('codeSurfaceSwaps', '0');
        document.addEventListener('astro:after-swap', () => {
          sessionStorage.setItem(
            'codeSurfaceSwaps',
            String(Number(sessionStorage.getItem('codeSurfaceSwaps')) + 1)
          );
        });
      });
      await page.getByRole('button', { name: '页面目录', exact: true }).click();
      await page.locator(`a[href="${QUICK_START}"]`).first().click();
      await page.waitForURL(`**${QUICK_START}`);
      await ready(page);
      // The current site uses document navigation, not ClientRouter swaps.
      expect(await page.evaluate(() => sessionStorage.getItem('codeSurfaceSwaps'))).toBe('0');
      expect(
        await page.evaluate(() =>
          performance.getEntriesByType('navigation').map((entry) => entry.name)
        )
      ).toEqual([`${baseUrl}${QUICK_START}`]);
      const expectedInstall = new Map<string, CodeStyleFacts>();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((mode) => {
          document.documentElement.dataset.theme = mode;
        }, theme);
        const facts = await expectSurfaces(page);
        expectedInstall.set(theme, facts.ec);
        await expectCopyControls(page);
        await page.evaluate(() => {
          document.dispatchEvent(new Event('astro:page-load'));
          document.dispatchEvent(new Event('astro:page-load'));
        });
        expect(await surfaceFacts(page)).toEqual(facts);
        await expectCopyControls(page);
        await retainEvidence(page, `390-${theme}-after-navigation`, { facts });
      }
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/button/`, {
        waitUntil: 'domcontentloaded',
      });
      await ready(page);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((mode) => {
          document.documentElement.dataset.theme = mode;
        }, theme);
        await page.waitForFunction(() =>
          [...document.querySelectorAll<HTMLElement>('.install-command-card')]
            .filter((card) => card.checkVisibility())
            .every((card) => card.dataset.codeSurfaceView === 'ready')
        );
        const facts = { ec: expectedInstall.get(theme)! };
        const install = await page
          .locator('.install-command-card:visible')
          .first()
          .evaluate((element) => {
            const surface = element.querySelector<HTMLElement>(
              ':scope > .site-code-surface-mount .site-code-surface-paint'
            )!;
            const style = getComputedStyle(surface);
            const code = getComputedStyle(element.querySelector('code')!);
            const probe = document.createElement('span');
            probe.style.setProperty('--pui-radius', style.getPropertyValue('--pui-radius'));
            probe.style.setProperty('--pui-radius-xl', style.getPropertyValue('--pui-radius-xl'));
            probe.style.borderRadius = 'var(--pui-radius-xl)';
            document.body.append(probe);
            const expectedRadius = getComputedStyle(probe).borderRadius;
            probe.remove();
            return {
              background: style.backgroundColor,
              color: code.color,
              radius: style.borderRadius,
              expectedRadius,
              font: code.fontFamily,
              size: code.fontSize,
              lineHeight: code.lineHeight,
            };
          });
        expect(install).toEqual({
          ...facts.ec,
          radius: install.expectedRadius,
          expectedRadius: install.expectedRadius,
        });
        expect(parseFloat(install.radius)).toBeGreaterThan(0);
        const body = page.locator('.install-command-card__body:visible').first();
        expect(
          await body.evaluate((element) => {
            const style = getComputedStyle(element);
            return (
              element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
            );
          })
        ).toBeLessThanOrEqual(parseFloat(install.lineHeight) + 1);
        await retainEvidence(page, `390-${theme}-install`, { facts, install });
      }
    } finally {
      await context.close();
    }
  }, 90_000);
});
