// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from '../content/docs/zh-cn/browser-harness';
import {
  keyboardClosePaintFailures,
  imageSpringMotionFailures,
  IMAGE_MOTION_DURATION_MS,
  IMAGE_SPRING_MAX_SLOPE,
  type ImageMotionFrame,
  sharedImageHitPoint,
  type KeyboardClosePaint,
} from './documentation-image-preview.test-utils';
const MD = '/en/test/image-preview-markdown/';
const MDX = '/en/test/image-preview-mdx/';
let browser: Browser;
let baseUrl = '';
const evidence = process.env.IMAGE_PREVIEW_EVIDENCE_DIR;
const motionEvidence =
  evidence ??
  (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'image-preview-motion')
    : undefined);
const records: object[] = [];
const failuresByPage = new WeakMap<Page, string[]>();
function track(page: Page): Page {
  const failures: string[] = [];
  failuresByPage.set(page, failures);
  page.on('pageerror', (error) => failures.push(error.message));
  return page;
}
async function capture(page: Page, name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  const state = await page.evaluate(() => ({
    url: location.pathname,
    family: document.documentElement.dataset.siteLibraryFamily,
    viewerDefined: Boolean(customElements.get('documentation-image-preview')),
    contentRoots: document.querySelectorAll('[data-doc-flow]').length,
    triggers: Array.from(document.querySelectorAll('[data-docs-image-trigger]')).map((el) => ({
      tag: el.localName,
      text: el.textContent,
      alt: el.querySelector('img')?.alt,
      label: el.getAttribute('aria-label'),
      inertAncestor: Boolean(el.closest('[inert]')),
      hiddenAncestor: Boolean(el.closest('[aria-hidden="true"], [hidden]')),
      mediaVisibility: el.querySelector('img')
        ? getComputedStyle(el.querySelector('img')!).visibility
        : null,
      mediaOpacity: el.querySelector('img')
        ? getComputedStyle(el.querySelector('[data-docs-image-source-surface]')!).opacity
        : null,
    })),
    panels: Array.from(document.querySelectorAll('[data-docs-image-content]')).map((el) => ({
      tag: el.localName,
      active: document.activeElement === el,
      tabIndex: (el as HTMLElement).tabIndex,
      nativeFocusVisible: el.matches(':focus-visible'),
      state: el.getAttribute('data-transition-state'),
      detached: el.hasAttribute('data-pui-view-detached'),
      display: getComputedStyle(el).display,
      animation: getComputedStyle(el).animationName,
      outline: {
        style: getComputedStyle(el).outlineStyle,
        width: getComputedStyle(el).outlineWidth,
        color: getComputedStyle(el).outlineColor,
        offset: getComputedStyle(el).outlineOffset,
      },
    })),
    activeElement: document.activeElement?.localName,
    sourceFocused: document.activeElement?.hasAttribute('data-docs-image-trigger') ?? false,
    triggerFrames: (window as any).__docsTriggerFrames ?? [],
    focusTimeline: (window as any).__docsFocusTimeline ?? [],
    previewFocus: (window as any).__docsImageFocusProbe?.read(true) ?? null,
    previewFocusTimeline: (window as any).__docsImageFocusProbe?.timeline ?? [],
    closeReadability: (window as any).__docsImageCloseReadability?.read() ?? null,
  }));
  await writeFile(
    path.join(evidence, `${name}.json`),
    JSON.stringify({ ...state, pageErrors: failuresByPage.get(page) ?? [] }, null, 2)
  );
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: false });
}
async function observeKeyboardCloseReadability(page: Page) {
  await page.evaluate(() => {
    (window as any).__docsImageCloseReadability?.dispose();
    const box = (rect: DOMRect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    });
    // A detached canvas resolves the browser's computed CSS colors to sRGB.
    // It does not replace the image, alter theme tokens or participate in layout.
    const colors = new Map<string, number[]>();
    const context = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string) => {
      if (!colors.has(color)) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        colors.set(color, Array.from(context.getImageData(0, 0, 1, 1).data));
      }
      return colors.get(color)!;
    };
    const read = () => {
      const node = document.querySelector<HTMLElement>('[data-docs-image-close]');
      if (!node) return null;
      const style = getComputedStyle(node);
      const range = document.createRange();
      range.selectNodeContents(node);
      const ancestors = [];
      for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor);
        ancestors.push({
          tag: ancestor.localName,
          content: ancestor.hasAttribute('data-docs-image-content'),
          canvas: ancestor.hasAttribute('data-docs-image-canvas'),
          close: ancestor === node,
          box: box(ancestor.getBoundingClientRect()),
          client: {
            left: ancestor.clientLeft,
            top: ancestor.clientTop,
            width: ancestor.clientWidth,
            height: ancestor.clientHeight,
          },
          scroll: {
            x: ancestor.scrollLeft,
            y: ancestor.scrollTop,
            width: ancestor.scrollWidth,
            height: ancestor.scrollHeight,
          },
          overflowX: css.overflowX,
          overflowY: css.overflowY,
          clipPath: css.clipPath,
          clip: css.clip,
          contain: css.contain,
          transform: css.transform,
          maskImage: css.maskImage,
        });
      }
      return {
        time: performance.now(),
        text: node.textContent,
        active: node === document.activeElement,
        nativeFocusVisible: node.matches(':focus-visible'),
        dataFocusVisible: node.getAttribute('data-focus-visible'),
        box: box(node.getBoundingClientRect()),
        textBox: box(range.getBoundingClientRect()),
        textRects: Array.from(range.getClientRects(), box),
        style: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          foregroundRgba: rgba(style.color),
          backgroundRgba: rgba(style.backgroundColor),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          opacity: style.opacity,
          visibility: style.visibility,
          display: style.display,
          position: style.position,
          top: style.top,
          right: style.right,
          bottom: style.bottom,
          left: style.left,
          width: style.width,
          height: style.height,
          padding: style.padding,
          borderWidth: style.borderWidth,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          clipPath: style.clipPath,
          outline: style.outline,
          boxShadow: style.boxShadow,
          transitionProperty: style.transitionProperty,
          transitionDuration: style.transitionDuration,
          transitionDelay: style.transitionDelay,
          transitionTimingFunction: style.transitionTimingFunction,
          animationName: style.animationName,
        },
        animations: node.getAnimations({ subtree: false }).map((animation) => ({
          kind: animation.constructor.name,
          property: 'transitionProperty' in animation ? animation.transitionProperty : null,
          playState: animation.playState,
          currentTime: animation.currentTime,
          timing: animation.effect?.getComputedTiming(),
          keyframes: (animation.effect as KeyframeEffect | null)?.getKeyframes(),
        })),
        viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
        contentPhase: node
          .closest('[data-docs-image-content]')
          ?.getAttribute('data-transition-state'),
        ancestors,
      };
    };
    const record = {
      before: read(),
      input: null as null | { key: string; shift: boolean; trusted: boolean; time: number },
      atInput: null as ReturnType<typeof read>,
      frames: [] as Array<NonNullable<ReturnType<typeof read>>>,
      done: false,
      read,
      dispose: () => {
        removeEventListener('keydown', onKey, true);
        cancelAnimationFrame(frame);
      },
    };
    let frame = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !event.isTrusted) return;
      removeEventListener('keydown', onKey, true);
      record.input = {
        key: event.key,
        shift: event.shiftKey,
        trusted: event.isTrusted,
        time: event.timeStamp,
      };
      record.atInput = read();
      const started = performance.now();
      const sample = () => {
        const facts = read();
        if (facts) record.frames.push(facts);
        if (performance.now() - started < 400) frame = requestAnimationFrame(sample);
        else record.done = true;
      };
      frame = requestAnimationFrame(sample);
    };
    (window as any).__docsImageCloseReadability = record;
    addEventListener('keydown', onKey, true);
  });
}
async function collectKeyboardCloseReadability(page: Page, name: string) {
  // This bounded observation includes the first paint and terminal frames. It
  // does not delay the input, replace native focus or wait away earlier clipping.
  await page.waitForFunction(() => (window as any).__docsImageCloseReadability?.done === true);
  const result = await page.evaluate(() => {
    const record = (window as any).__docsImageCloseReadability;
    return {
      before: record.before,
      input: record.input,
      atInput: record.atInput,
      frames: record.frames,
      terminal: record.read(),
    };
  });
  if (evidence) {
    await writeFile(
      path.join(evidence, `${name}-close-reveal.json`),
      JSON.stringify(result, null, 2)
    );
    await capture(page, `${name}-close-terminal`);
  }
  // Data integrity only: the diagnostic does not pre-judge the clipping owner
  // or treat clip-path:none / a focused semantic state as readable text.
  expect(result.input?.trusted).toBe(true);
  expect(result.frames.length).toBeGreaterThan(1);
  return result;
}
function expectReadableKeyboardClose(result: {
  before: KeyboardClosePaint;
  frames: KeyboardClosePaint[];
  terminal: KeyboardClosePaint;
}) {
  const focused = result.frames.filter((frame) => frame.active);
  expect(focused.length).toBeGreaterThan(1);
  for (const frame of [...focused, result.terminal])
    expect(keyboardClosePaintFailures(frame)).toEqual([]);
  expect(result.frames.map((frame) => [frame.viewport.scrollX, frame.viewport.scrollY])).toEqual(
    result.frames.map(() => [result.before.viewport.scrollX, result.before.viewport.scrollY])
  );
}
async function observePreviewFocus(page: Page, sourceSelector: string) {
  await page.evaluate((selector) => {
    const timeline: object[] = [];
    const identities = new WeakMap<Element, number>();
    let nextIdentity = 1;
    let closeButton: HTMLElement | null = null;
    let closeCommand: HTMLElement | null = null;
    const label = (node: EventTarget | null) => {
      if (!(node instanceof Element)) return null;
      if (!identities.has(node)) identities.set(node, nextIdentity++);
      return {
        identity: identities.get(node),
        tag: node.localName,
        source: node.hasAttribute('data-docs-image-trigger'),
        close: node.hasAttribute('data-docs-image-close'),
        content: node.hasAttribute('data-docs-image-content'),
        prototype: (node as HTMLElement).dataset.docsPreviewPrototype ?? null,
      };
    };
    const control = (node: HTMLElement | null, includeStyle: boolean) => {
      if (!node) return null;
      // These two readonly facts are declared by Base Button and DialogClose.
      // Never request focus, invoke activation or manufacture an interaction fact.
      let publicFacts: object;
      try {
        const exposes = (
          node as HTMLElement & {
            getExposes?: () => {
              focused?: { get(): boolean };
              focusVisible?: { get(): boolean };
            };
          }
        ).getExposes?.();
        publicFacts = {
          focused: exposes?.focused?.get() ?? null,
          focusVisible: exposes?.focusVisible?.get() ?? null,
        };
      } catch (error) {
        publicFacts = { error: String(error) };
      }
      return {
        ...label(node),
        connected: node.isConnected,
        active: document.activeElement === node,
        nativeFocusVisible: node.matches(':focus-visible'),
        dataFocusVisible: node.getAttribute('data-focus-visible'),
        dataFocused: node.getAttribute('data-focused'),
        publicFacts,
        ...(includeStyle ? { clipPath: getComputedStyle(node).clipPath } : {}),
      };
    };
    const read = (includeStyle = false) => {
      const liveClose = document.querySelector<HTMLElement>('[data-docs-image-close]');
      if (liveClose) {
        closeButton = liveClose;
        closeCommand = liveClose.closest<HTMLElement>(
          'docs-preview-shadcn-dialog-close, docs-preview-brutalist-dialog-close'
        );
      }
      // Retain the observed handles across the closing view epoch so the
      // evidence can distinguish detached old facts from the next live owner.
      const content = document.querySelector<HTMLElement>('[data-docs-image-content]');
      const trigger =
        document.querySelector(selector)?.closest<HTMLElement>('[data-docs-image-trigger]') ?? null;
      return {
        activeElement: label(document.activeElement),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        closeButton: control(closeButton, includeStyle),
        closeCommand: control(closeCommand, includeStyle),
        trigger: control(trigger, includeStyle),
        modal: {
          contentPresent: Boolean(content),
          contentActive: content !== null && document.activeElement === content,
          contentTabIndex: content?.tabIndex ?? null,
          contentNativeFocusVisible: content?.matches(':focus-visible') ?? null,
          ...(includeStyle && content
            ? {
                contentOutline: {
                  style: getComputedStyle(content).outlineStyle,
                  width: getComputedStyle(content).outlineWidth,
                  color: getComputedStyle(content).outlineColor,
                  offset: getComputedStyle(content).outlineOffset,
                },
              }
            : {}),
          phase: content?.getAttribute('data-transition-state') ?? null,
          detached: content?.hasAttribute('data-pui-view-detached') ?? null,
          ariaModal: content?.getAttribute('aria-modal') ?? null,
          bodyOverflow: document.body.style.overflow,
          sourceInert: Boolean(trigger?.closest('[inert]')),
          activeInert: Boolean(document.activeElement?.closest('[inert]')),
        },
      };
    };
    (window as any).__docsImageFocusProbe = { read, timeline };
    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
      'keydown',
      'keyup',
      'focusin',
      'focusout',
    ]) {
      for (const capture of [true, false])
        document.addEventListener(
          type,
          (event) => {
            timeline.push({
              time: performance.now(),
              type,
              capture,
              trusted: event.isTrusted,
              target: label(event.target),
              key: event instanceof KeyboardEvent ? event.key : null,
              pointerType: event instanceof PointerEvent ? event.pointerType : null,
              defaultPrevented: event.defaultPrevented,
              // Do not force computed-style/layout sampling inside native input.
              ...read(),
            });
          },
          { capture, passive: true }
        );
    }
  }, sourceSelector);
}
async function entered(page: Page) {
  // PUI's logical phase and the browser's first painted transition frame have
  // distinct clocks. Observe both; do not treat a phase label as settled pixels.
  const content = await page.locator('[data-docs-image-content]').elementHandle();
  const media = await page.locator('.docs-image-full').elementHandle();
  try {
    // Bind the current render/media identity, then sample its live animations.
    // No stale finished promise can accept a canceled or replaced generation.
    await page.waitForFunction(
      ({ content, media }) =>
        content?.isConnected &&
        media?.isConnected &&
        content === document.querySelector('[data-docs-image-content]') &&
        media === document.querySelector('.docs-image-full') &&
        content.getAttribute('data-transition-state') === 'entered' &&
        content
          .getAnimations()
          .every((animation) => !animation.pending && animation.playState !== 'running'),
      { content, media }
    );
  } catch (error) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const facts = await Promise.race([
        page.evaluate(
          ({ content, media }) => {
            const currentContent = document.querySelector('[data-docs-image-content]');
            const currentMedia = document.querySelector<HTMLImageElement>('.docs-image-full');
            const source = document.querySelector<HTMLImageElement>(
              '.whitepaper-figure [data-docs-image-trigger] img'
            );
            return {
              url: location.href,
              forcedColors: matchMedia('(forced-colors: active)').matches,
              boundContentConnected: content?.isConnected ?? null,
              boundContentCurrent: content === currentContent,
              boundMediaConnected: media?.isConnected ?? null,
              boundMediaCurrent: media === currentMedia,
              boundMediaSrc: media?.getAttribute('src') ?? null,
              boundPhase: content?.getAttribute('data-transition-state') ?? null,
              currentPhase: currentContent?.getAttribute('data-transition-state') ?? null,
              currentDetached: currentContent?.hasAttribute('data-pui-view-detached') ?? null,
              currentAnimations:
                currentContent?.getAnimations().map((animation) => ({
                  pending: animation.pending,
                  state: animation.playState,
                  currentTime: animation.currentTime,
                  startTime: animation.startTime,
                })) ?? null,
              currentMedia: currentMedia
                ? {
                    src: currentMedia.getAttribute('src'),
                    currentSrc: currentMedia.currentSrc,
                    complete: currentMedia.complete,
                    naturalWidth: currentMedia.naturalWidth,
                  }
                : null,
              source: source
                ? {
                    currentSrc: source.currentSrc,
                    complete: source.complete,
                    naturalWidth: source.naturalWidth,
                  }
                : null,
              active: document.activeElement?.localName,
            };
          },
          { content, media }
        ),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ unavailable: '2000ms observation budget' }), 2000);
        }),
      ]);
      console.info('[image entered identity failure]', JSON.stringify(facts));
    } catch (observationError) {
      console.info(
        '[image entered identity failure]',
        JSON.stringify({ observationError: String(observationError) })
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
    throw error;
  } finally {
    await content?.dispose();
    await media?.dispose();
  }
}
async function closed(page: Page) {
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-docs-image-content]') ||
      document.querySelector('[data-docs-image-content]')?.hasAttribute('data-pui-view-detached')
  );
}
async function open(page: Page, alt: string) {
  const trigger = page.getByRole('button', { name: `Enlarge image: ${alt}`, exact: true });
  await trigger.click();
  await entered(page);
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('.docs-image-full');
    return Boolean(img?.complete && img.naturalWidth);
  });
  await contentInitialFocus(page);
  return trigger;
}
type MediaBox = { x: number; y: number; width: number; height: number };
async function contentInitialFocus(page: Page) {
  // Read actual native focus, not a requested target or a synthesized state.
  // Content intentionally has no public focused/focusVisible expose.
  const facts = await page.locator('[data-docs-image-content]').evaluate((node) => {
    const content = node as HTMLElement;
    const close = content.querySelector('[data-docs-image-close]')!;
    const style = getComputedStyle(content);
    return {
      active: document.activeElement === content,
      tabIndex: content.tabIndex,
      nativeFocusVisible: content.matches(':focus-visible'),
      closeActive: document.activeElement === close,
      closeClip: getComputedStyle(close).clipPath,
      outline: {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
        offset: style.outlineOffset,
      },
    };
  });
  expect(facts.active).toBe(true);
  expect(facts.tabIndex).toBe(-1);
  expect(facts.closeActive).toBe(false);
  expect(facts.closeClip).toBe('inset(50%)');
  expect(facts.outline.style).toBe('none');
  expect(facts.outline.width).toBe('0px');
  return facts;
}
async function containedWhitepaper(page: Page) {
  await page.locator('.docs-image-full').evaluate((node) => (node as HTMLImageElement).decode());
  const initialFocus = await contentInitialFocus(page);
  const facts = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-docs-image-content]')!;
    const image = document.querySelector<HTMLImageElement>('.docs-image-full')!;
    const canvas = document.querySelector<HTMLElement>('[data-docs-image-canvas]')!;
    const rect = (node: Element) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const style = getComputedStyle(content);
    const canvasStyle = getComputedStyle(canvas);
    const viewport = window.visualViewport;
    return {
      image: rect(image),
      content: rect(content),
      viewport: {
        x: viewport?.offsetLeft ?? 0,
        y: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      },
      src: image.src,
      alt: image.alt,
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      returnMode: content.dataset.docsImageReturn,
      style: {
        animation: style.animationName,
        duration: style.transitionDuration,
        easing: style.transitionTimingFunction,
        border: style.borderWidth,
        padding: style.padding,
        radius: style.borderRadius,
        shadow: style.boxShadow,
        background: style.backgroundColor,
      },
      canvas: {
        background: canvasStyle.backgroundColor,
        padding: canvasStyle.padding,
        border: canvasStyle.borderTopWidth,
        shadow: canvasStyle.boxShadow,
      },
      scroll: {
        x: content.scrollLeft,
        y: content.scrollTop,
        maxX: content.scrollWidth - content.clientWidth,
        maxY: content.scrollHeight - content.clientHeight,
      },
      closeClip: getComputedStyle(content.querySelector('[data-docs-image-close]')!).clipPath,
    };
  });
  expect(
    await page
      .locator(
        '.docs-image-toolbar, [data-docs-image-zoom], [data-docs-image-zoom-in], [data-docs-image-zoom-out], [data-docs-image-viewport]'
      )
      .count()
  ).toBe(0);
  expect(await page.locator('[data-docs-image-content] header').count()).toBe(0);
  expect(facts.natural.width).toBeGreaterThan(0);
  expect(facts.natural.height).toBeGreaterThan(0);
  expect(facts.returnMode).toBe('origin');
  expect(facts.style.animation).toBe('none');
  expect(facts.style.duration.split(',').map((value) => value.trim())).toContain('0.42s');
  expect(facts.style.easing.split(',').some((value) => value.trim().startsWith('linear('))).toBe(
    true
  );
  expect(facts.style.border).toBe('0px');
  expect(facts.style.padding).toBe('0px');
  expect(facts.style.radius).toBe('0px');
  expect(facts.style.shadow).toBe('none');
  expect(facts.style.background).toBe('rgba(0, 0, 0, 0)');
  expect(facts.canvas.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(facts.canvas.padding).toBe('0px');
  expect(facts.canvas.border).toBe('0px');
  expect(facts.canvas.shadow).toBe('none');
  expect(facts.image.width).toBeGreaterThan(0);
  expect(facts.image.height).toBeGreaterThan(0);
  expect(facts.image.x).toBeGreaterThanOrEqual(facts.viewport.x - 1);
  expect(facts.image.y).toBeGreaterThanOrEqual(facts.viewport.y - 1);
  expect(facts.image.x + facts.image.width).toBeLessThanOrEqual(
    facts.viewport.x + facts.viewport.width + 1
  );
  expect(facts.image.y + facts.image.height).toBeLessThanOrEqual(
    facts.viewport.y + facts.viewport.height + 1
  );
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(facts.image[key] - facts.content[key])).toBeLessThanOrEqual(1);
  expect(
    Math.abs(facts.image.width * facts.natural.height - facts.image.height * facts.natural.width) /
      Math.max(facts.natural.width, facts.natural.height)
  ).toBeLessThanOrEqual(1);
  expect(facts.scroll.x).toBe(0);
  expect(facts.scroll.y).toBe(0);
  expect(facts.scroll.maxX).toBeLessThanOrEqual(1);
  expect(facts.scroll.maxY).toBeLessThanOrEqual(1);
  return { ...facts, initialFocus };
}
async function keyboardCloseFocus(page: Page, entry: 'Tab' | 'Shift+Tab' = 'Tab') {
  await page.keyboard.press(entry);
  const close = page.locator('[data-docs-image-close]');
  expect(await close.evaluate((node) => node === document.activeElement)).toBe(true);
  expect(await close.getAttribute('data-focus-visible')).not.toBeNull();
  for (const key of ['Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    expect(await close.evaluate((node) => node === document.activeElement)).toBe(true);
    expect(await close.getAttribute('data-focus-visible')).not.toBeNull();
  }
  const facts = await close.evaluate((node) => {
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const content = node.closest('[data-docs-image-content]')!.getBoundingClientRect();
    return {
      clip: style.clipPath,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      fitsContent:
        box.left >= content.left &&
        box.top >= content.top &&
        box.right <= content.right &&
        box.bottom <= content.bottom,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(facts.clip).toBe('none');
  expect(facts.box.width).toBeGreaterThan(1);
  expect(facts.box.height).toBeGreaterThan(1);
  expect(facts.fitsContent).toBe(true);
  return { ...facts, entry, tabLoops: ['Tab', 'Shift+Tab'] };
}
type MotionFrame = ImageMotionFrame;
type MotionInput = {
  type: string;
  trusted: boolean;
  source: MediaBox | null;
  sourceCurrentSrc: string | null;
  scroll: { x: number; y: number };
};
async function recordNextMotion(
  page: Page,
  input: 'pointerdown' | 'keydown',
  sourceSelector = '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
) {
  // Instrumentation records real frames after the next native input. It neither
  // changes application state nor slows the requested 420ms spring motion.
  await page.evaluate(
    ({ input, sourceSelector }) => {
      const record = {
        frames: [] as MotionFrame[],
        input: null as MotionInput | null,
        done: false,
      };
      (window as any).__docsImageMotion = record;
      window.addEventListener(
        input,
        (event) => {
          // Locator input can scroll before dispatch. Measure the original
          // media at the native input boundary, before application handlers;
          // never derive the expected origin from the animated foreground.
          const source = document.querySelector(sourceSelector);
          const box = source?.getBoundingClientRect();
          record.input = {
            type: event.type,
            trusted: event.isTrusted,
            source: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
            sourceCurrentSrc: source instanceof HTMLImageElement ? source.currentSrc : null,
            scroll: { x: scrollX, y: scrollY },
          };
          let start = -1;
          const sample = (time: number) => {
            if (start < 0) start = time;
            const content = document.querySelector<HTMLElement>('[data-docs-image-content]');
            const mask = document.querySelector<HTMLElement>('[data-docs-image-mask]');
            if (content && mask && !content.hasAttribute('data-pui-view-detached')) {
              const rect = content.getBoundingClientRect();
              const source = document.querySelector(sourceSelector);
              record.frames.push({
                time: time - start,
                phase: content.getAttribute('data-transition-state'),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: Number(
                  getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity
                ),
                sourceOpacity: source
                  ? Number(
                      getComputedStyle(source.closest('[data-docs-image-source-surface]')!).opacity
                    )
                  : null,
              });
            }
            if (time - start < 550) requestAnimationFrame(sample);
            else record.done = true;
          };
          requestAnimationFrame(sample);
        },
        { once: true, capture: true }
      );
    },
    { input, sourceSelector }
  );
}
async function motionFrames(page: Page, name: string): Promise<MotionFrame[]> {
  await page.waitForFunction(() => (window as any).__docsImageMotion?.done);
  const motion = (await page.evaluate(() => ({
    frames: (window as any).__docsImageMotion.frames,
    input: (window as any).__docsImageMotion.input,
  }))) as { frames: MotionFrame[]; input: MotionInput | null };
  if (motionEvidence) {
    await mkdir(motionEvidence, { recursive: true });
    await writeFile(
      path.join(motionEvidence, `${name}-frames.json`),
      JSON.stringify(motion.frames, null, 2)
    );
    await writeFile(
      path.join(motionEvidence, `${name}-input.json`),
      JSON.stringify(motion.input, null, 2)
    );
  }
  return motion.frames;
}
function expectSpringImageMotion(
  frames: MotionFrame[],
  origin: MediaBox,
  target: MediaBox,
  direction: 'opening' | 'closing'
) {
  expect(imageSpringMotionFailures(frames, origin, target, direction), direction).toEqual([]);
}
describe('automatic documentation image preview in real Chromium', () => {
  beforeAll(async () => {
    baseUrl = await startServer(MD);
    browser = await launchBrowser();
  }, 240_000);
  afterAll(async () => {
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await writeFile(
        path.join(evidence, 'matrix.json'),
        JSON.stringify(
          {
            candidate: process.env.CANDIDATE_SHA ?? null,
            browser: browser?.version(),
            records,
            note: 'Family axis injects the documented page-family signal; no runtime/family selector interaction is claimed.',
          },
          null,
          2
        )
      );
    }
    await browser?.close();
    await stopServer();
  });
  for (const width of [320, 390, 1280])
    for (const colorScheme of ['light', 'dark'] as const)
      for (const family of ['shadcn', 'brutalist'] as const) {
        it(`${width}px ${colorScheme} ${family}: borderless raster contain, keyboard, focus and spring motion`, async () => {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme,
            hasTouch: width < 500,
          });
          const page = track(await context.newPage());
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          try {
            await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
            await page.evaluate(
              ({ family, colorScheme }) => {
                document.documentElement.dataset.siteLibraryFamily = family;
                document.documentElement.dataset.theme = colorScheme;
              },
              { family, colorScheme }
            );
            await page.waitForFunction((family) => {
              const triggers = [
                ...document.querySelectorAll<HTMLElement>('[data-docs-image-trigger]'),
              ];
              return (
                triggers.length === 2 &&
                triggers.every(
                  (trigger) =>
                    trigger.localName === `docs-preview-${family}-image-trigger` &&
                    trigger.dataset.docsPreviewFamily === family &&
                    trigger.getAttribute('role') === 'button' &&
                    trigger.tabIndex === 0 &&
                    trigger.getAttribute('aria-disabled') !== 'true' &&
                    !trigger.closest('[hidden], [inert]')
                )
              );
            }, family);
            expect(await page.locator('[data-docs-image-trigger]').count()).toBe(2);
            const trigger = page.getByRole('button', {
              name: 'Enlarge image: Raster comparison diagram',
              exact: true,
            });
            expect(await trigger.count(), 'exact source image accessible name').toBe(1);
            expect(await trigger.isEnabled(), 'public Base semantic trigger is usable').toBe(true);
            if (width < 500) await trigger.tap();
            else await trigger.click();
            await entered(page);
            const panel = page.locator('[data-docs-image-content]');
            expect(await panel.getAttribute('role')).toBe('dialog');
            expect(await panel.getAttribute('aria-modal')).toBe('true');
            const initialFocus = await contentInitialFocus(page);
            const style = await panel.evaluate((el) => ({
              animation: getComputedStyle(el).animationName,
              duration: getComputedStyle(el).transitionDuration,
              easing: getComputedStyle(el).transitionTimingFunction,
              border: getComputedStyle(el).borderTopWidth,
              background: getComputedStyle(el).backgroundColor,
              borderRadius: getComputedStyle(el).borderRadius,
              shadow: getComputedStyle(el).boxShadow,
              x: el.getBoundingClientRect().x,
              right: el.getBoundingClientRect().right,
              bottom: el.getBoundingClientRect().bottom,
              top: el.getBoundingClientRect().top,
            }));
            expect(style.animation).toBe('none');
            expect(style.duration.split(',').map((s) => s.trim())).toContain('0.42s');
            expect(style.easing.split(',').some((s) => s.trim().startsWith('linear('))).toBe(true);
            expect(style.border).toBe('0px');
            expect(style.shadow).toBe('none');
            expect(style.background).toBe('rgba(0, 0, 0, 0)');
            expect(style.x).toBeGreaterThanOrEqual(0);
            expect(style.right).toBeLessThanOrEqual(width);
            expect(style.top).toBeGreaterThanOrEqual(0);
            expect(style.bottom).toBeLessThanOrEqual(901);
            expect(style.borderRadius).toBe('0px');
            const mask = await page.locator('[data-docs-image-mask]').evaluate((el) => ({
              opacity: getComputedStyle(el.querySelector('[data-docs-image-scrim]')!)
                .backgroundColor,
              backdropFilter: getComputedStyle(el).backdropFilter,
            }));
            expect(mask.opacity).toBe('rgba(0, 0, 0, 0.8)');
            expect(mask.backdropFilter).toBe('none');
            expect(await page.locator('[data-docs-image-zoom], .docs-image-toolbar').count()).toBe(
              0
            );
            expect(
              await page
                .locator('[data-docs-image-close]')
                .evaluate((el) => getComputedStyle(el).clipPath)
            ).toBe('inset(50%)');
            await capture(page, `${width}-${colorScheme}-${family}-fit`);
            await page.locator('.docs-image-full').click();
            expect(await panel.getAttribute('data-transition-state')).toBe('entered');
            await observeKeyboardCloseReadability(page);
            for (let count = 0; count < 5; count++) {
              await page.keyboard.press('Tab');
              expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
              expect(
                await page
                  .locator('[data-docs-image-close]')
                  .evaluate((el) => document.activeElement === el)
              ).toBe(true);
            }
            await page.keyboard.press('Shift+Tab');
            expect(
              await page
                .locator('[data-docs-image-close]')
                .evaluate((el) => document.activeElement === el)
            ).toBe(true);
            expect(
              await page
                .locator('[data-docs-image-close]')
                .evaluate((el) => getComputedStyle(el).clipPath)
            ).toBe('none');
            await capture(page, `${width}-${colorScheme}-${family}-keyboard-close`);
            const closeReveal = await collectKeyboardCloseReadability(
              page,
              `${width}-${colorScheme}-${family}`
            );
            await page.keyboard.press('Escape');
            await closed(page);
            expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
            expect(await trigger.getAttribute('data-focus-visible')).not.toBeNull();
            expect(
              await trigger.evaluate(
                (el) =>
                  getComputedStyle(el.querySelector('[data-docs-image-trigger-surface]')!).boxShadow
              )
            ).not.toBe('none');
            await capture(page, `${width}-${colorScheme}-${family}-keyboard-focus`);
            if (width === 390 && family === 'brutalist') {
              await page.evaluate(() => {
                const trigger = document.querySelector('[data-docs-image-trigger]')!;
                const frames: object[] = [];
                (window as any).__docsTriggerFrames = frames;
                const sample = (time: number) => {
                  const rect = trigger.getBoundingClientRect();
                  const style = getComputedStyle(trigger);
                  frames.push({
                    time,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    hovered: trigger.hasAttribute('data-hovered'),
                    pressed: trigger.hasAttribute('data-pressed'),
                    focused: document.activeElement === trigger,
                    transform: style.transform,
                    translate: style.translate,
                    tokens: trigger.getAttribute('data-pui-style'),
                  });
                  if (frames.length < 240) requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
              });
            }
            const repeatedFocus = [];
            for (let count = 0; count < 2; count++) {
              await trigger.click();
              await entered(page);
              repeatedFocus.push(await contentInitialFocus(page));
              await page.mouse.click(1, 1);
              await closed(page);
            }
            expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
            ).toBe(true);
            expect(errors).toEqual([]);
            records.push({
              width,
              colorScheme,
              family,
              style,
              mask,
              initialFocus,
              repeatedFocus,
              closeReveal,
            });
            expectReadableKeyboardClose(closeReveal);
          } finally {
            await capture(page, `${width}-${colorScheme}-${family}-last-observed`);
            await context.close();
          }
        }, 90_000);
      }
  for (const width of [390, 1280]) {
    it(`${width}px real intermediate frames follow damped spring forward/reverse motion`, async () => {
      if (evidence) await mkdir(path.join(evidence, 'videos'), { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(evidence
          ? { recordVideo: { dir: path.join(evidence, 'videos'), size: { width, height: 900 } } }
          : {}),
      });
      const page = track(await context.newPage());
      const video = page.video();
      try {
        await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
        const trigger = page.getByRole('button', {
          name: 'Enlarge image: Raster comparison diagram',
          exact: true,
        });
        await trigger.scrollIntoViewIfNeeded();
        const origin = (await trigger.locator('img').boundingBox())!;
        await recordNextMotion(page, 'pointerdown');
        await trigger.click();
        await page.waitForFunction(
          () => {
            const mask = document.querySelector('[data-docs-image-mask]');
            const opacity =
              mask &&
              Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `spring-${width}-opening`);
        await entered(page);
        const target = (await page.locator('[data-docs-image-content]').boundingBox())!;
        const opening = await motionFrames(page, `spring-${width}-opening`);
        expectSpringImageMotion(opening, origin, target, 'opening');
        await capture(page, `spring-${width}-contained`);
        await recordNextMotion(page, 'keydown');
        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () => {
            const mask = document.querySelector('[data-docs-image-mask]');
            const opacity =
              mask &&
              Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `spring-${width}-closing`);
        const closing = await motionFrames(page, `spring-${width}-closing`);
        expectSpringImageMotion(closing, origin, target, 'closing');
        await closed(page);
        expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
        expect(await trigger.locator('img').evaluate((el) => getComputedStyle(el).visibility)).toBe(
          'visible'
        );
        expect(failuresByPage.get(page)).toEqual([]);
        records.push({ motion: width, origin, target, opening, closing });
      } finally {
        await capture(page, `spring-${width}-last-observed`);
        await context.close();
        if (evidence && video) await video.saveAs(path.join(evidence, `spring-${width}.webm`));
      }
    }, 90_000);
  }
  it('reverses a native interrupted close and safely handles resized, offscreen or removed sources', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      // This DOM locator is solely for explicit fixture mutations, not a claim
      // of native background interaction while the modal is present.
      const sourceOwner = page.locator(
        '[data-docs-image-trigger]:has(img[alt="Raster comparison diagram"])'
      );
      const originWidth = (await sourceOwner.locator('img').boundingBox())!.width;
      await open(page, 'Raster comparison diagram');
      const initial = (await page.locator('[data-docs-image-content]').boundingBox())!;
      await recordNextMotion(page, 'keydown');
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => {
          const mask = document.querySelector('[data-docs-image-mask]');
          const opacity =
            mask &&
            Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
          return opacity && opacity > 0.5 && opacity < 0.8;
        },
        undefined,
        { polling: 'raf' }
      );
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-transition-state')
      ).toBe('leaving');
      await page.keyboard.press('Enter');
      await entered(page);
      const interrupted = await motionFrames(page, 'interrupted-reopen');
      expect(Math.min(...interrupted.map((f) => f.width))).toBeLessThan(initial.width - 20);
      expect(interrupted.at(-1)!.width).toBeCloseTo(initial.width, 0);
      for (let i = 1; i < interrupted.length; i++)
        expect(Math.abs(interrupted[i].width - interrupted[i - 1].width)).toBeLessThan(
          (Math.abs(initial.width - originWidth) *
            IMAGE_SPRING_MAX_SLOPE *
            (interrupted[i].time - interrupted[i - 1].time)) /
            IMAGE_MOTION_DURATION_MS +
            2
        );
      await page.setViewportSize({ width: 390, height: 700 });
      await page.waitForFunction(() => {
        const r = document.querySelector('[data-docs-image-content]')!.getBoundingClientRect();
        return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
      });
      await capture(page, 'interrupted-resized');
      await sourceOwner.evaluate((el) => {
        (el as HTMLElement).style.transform = 'translateY(4000px)';
      });
      await page.waitForFunction(
        () =>
          document.querySelector('[data-docs-image-trigger] img')!.getBoundingClientRect().top >=
          innerHeight
      );
      const beforeClose = await sourceOwner.evaluate((el) => ({
        source: el.querySelector('img')!.getBoundingClientRect().toJSON(),
        scrollY,
        viewport: {
          width: innerWidth,
          height: innerHeight,
          x: visualViewport?.offsetLeft,
          y: visualViewport?.offsetTop,
        },
        returnMode: document.querySelector<HTMLElement>('[data-docs-image-content]')!.dataset
          .docsImageReturn,
      }));
      await page.keyboard.press('Escape');
      const afterClose = await sourceOwner.evaluate((el) => ({
        source: el.querySelector('img')!.getBoundingClientRect().toJSON(),
        scrollY,
        returnMode: document.querySelector<HTMLElement>('[data-docs-image-content]')!.dataset
          .docsImageReturn,
      }));
      records.push({ invalidOrigin: { beforeClose, afterClose } });
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-docs-image-return')
      ).toBe('fade');
      await closed(page);
      await sourceOwner.evaluate((el) => {
        (el as HTMLElement).style.removeProperty('transform');
      });
      await open(page, 'Raster comparison diagram');
      await sourceOwner.evaluate((el) => el.remove());
      await page.keyboard.press('Escape');
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-docs-image-return')
      ).toBe('fade');
      await closed(page);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      expect(failuresByPage.get(page)).toEqual([]);
    } finally {
      await capture(page, 'interrupted-last-observed');
      await context.close();
    }
  }, 90_000);
  it('preserves source alt and action name while open, leaving and restored without background input leakage', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      const name = 'Enlarge image: Raster comparison diagram';
      await page.evaluate(() => {
        const timeline: object[] = [];
        (window as any).__docsFocusTimeline = timeline;
        const label = (node: EventTarget | null) =>
          node instanceof Element
            ? node.hasAttribute('data-docs-image-trigger')
              ? 'source-trigger'
              : node.hasAttribute('data-docs-image-mask')
                ? 'image-mask'
                : node.classList.contains('docs-image-full')
                  ? 'preview-image'
                  : node.localName
            : null;
        for (const type of [
          'pointerdown',
          'mousedown',
          'pointerup',
          'mouseup',
          'click',
          'focusin',
          'focusout',
        ]) {
          for (const capture of [true, false])
            document.addEventListener(
              type,
              (event) => {
                timeline.push({
                  time: performance.now(),
                  type,
                  capture,
                  trusted: event.isTrusted,
                  target: label(event.target),
                  active: label(document.activeElement),
                  defaultPrevented: event.defaultPrevented,
                  phase: document
                    .querySelector('[data-docs-image-content]')
                    ?.getAttribute('data-transition-state'),
                });
              },
              { capture }
            );
        }
      });
      const trigger = page.getByRole('button', { name, exact: true });
      const source = page.locator('[data-docs-image-trigger] img[alt="Raster comparison diagram"]');
      const originalSrc = await source.getAttribute('src');
      const states: object[] = [];
      const sourceFact = async (phase: string) => {
        const count = await trigger.count();
        const facts = await source.evaluate((el) => ({
          alt: el.getAttribute('alt'),
          src: el.getAttribute('src'),
          opacity: getComputedStyle(el.closest('[data-docs-image-source-surface]')!).opacity,
          visibility: getComputedStyle(el).visibility,
          transition: getComputedStyle(el).transition,
          inlineTransition: {
            value: (el as HTMLElement).style.getPropertyValue('transition'),
            priority: (el as HTMLElement).style.getPropertyPriority('transition'),
          },
          inlineOpacity: {
            value: (el as HTMLElement).style.getPropertyValue('opacity'),
            priority: (el as HTMLElement).style.getPropertyPriority('opacity'),
          },
          phase: document
            .querySelector('[data-docs-image-content]')
            ?.getAttribute('data-transition-state'),
        }));
        states.push({ stage: phase, count, ...facts });
        expect(count).toBe(1);
        expect(facts.alt).toBe('Raster comparison diagram');
        expect(facts.src).toBe(originalSrc);
        expect(facts.visibility).toBe('visible');
        return facts;
      };
      const before = await sourceFact('before');
      await open(page, 'Raster comparison diagram');
      const opened = await sourceFact('open');
      expect(opened.opacity).toBe('0');
      expect(opened.inlineTransition).toEqual(before.inlineTransition);
      expect(opened.inlineOpacity).toEqual(before.inlineOpacity);
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        expect(
          await page
            .locator('[data-docs-image-content]')
            .evaluate((el) => el.contains(document.activeElement))
        ).toBe(true);
      }
      await page.keyboard.press('Escape');
      const leaving = await sourceFact('leaving');
      expect(leaving.phase).toBe('leaving');
      expect(leaving.opacity).toBe('0');
      expect(leaving.inlineTransition).toEqual(before.inlineTransition);
      expect(leaving.inlineOpacity).toEqual(before.inlineOpacity);
      expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      expect(await trigger.getAttribute('data-focus-visible')).not.toBeNull();
      await closed(page);
      const restored = await sourceFact('restored');
      expect(restored.opacity).toBe('1');
      expect(restored.transition).toBe(before.transition);
      expect(restored.inlineTransition).toEqual(before.inlineTransition);
      expect(restored.inlineOpacity).toEqual(before.inlineOpacity);
      expect(await trigger.getAttribute('data-docs-image-source-instant')).toBeNull();
      await page.evaluate(() => {
        (window as any).__docsSourceClicks = 0;
        document.querySelector('[data-docs-image-trigger]')!.addEventListener('click', (event) => {
          if (event.isTrusted) (window as any).__docsSourceClicks++;
        });
      });
      await trigger.click();
      await entered(page);
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      await page.waitForFunction(() => {
        const source = document.querySelector<HTMLImageElement>(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        );
        const preview = document.querySelector<HTMLImageElement>('.docs-image-full');
        const content = preview?.closest('[data-docs-image-content]');
        const owner = source?.closest('[data-docs-image-trigger]');
        return Boolean(
          source?.complete &&
          preview?.complete &&
          preview.naturalWidth &&
          content &&
          owner &&
          content.getAttribute('data-transition-state') === 'entered' &&
          [content, owner].every((el) =>
            el
              .getAnimations({ subtree: true })
              .every((animation) => !animation.pending && animation.playState !== 'running')
          )
        );
      });
      const geometry = await page.evaluate(async () => {
        const source = document.querySelector<HTMLElement>(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        )!;
        const preview = document.querySelector<HTMLElement>('.docs-image-full')!;
        const rect = (el: Element) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        const read = () => {
          const scroll = [[window.scrollX, window.scrollY]];
          for (let owner = source.parentElement; owner; owner = owner.parentElement)
            scroll.push([owner.scrollLeft, owner.scrollTop]);
          return { source: rect(source), preview: rect(preview), scroll };
        };
        // Read both boxes in one frame, then prove layout/scroll stability in
        // the next frame. There is no timer or relaxed coordinate tolerance.
        const before = read();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { before, after: read() };
      });
      expect(geometry.after).toEqual(geometry.before);
      const point = sharedImageHitPoint(geometry.after.source, geometry.after.preview);
      expect(
        point,
        'source and foreground image must have a shared painted interior'
      ).not.toBeNull();
      if (!point) throw new Error('No shared source/preview hit point');
      for (const box of [geometry.after.source, geometry.after.preview]) {
        expect(point.x).toBeGreaterThan(box.x);
        expect(point.x).toBeLessThan(box.x + box.width);
        expect(point.y).toBeGreaterThan(box.y);
        expect(point.y).toBeLessThan(box.y + box.height);
      }
      const hitPreview = await page.evaluate((point) => {
        const preview = document.querySelector('.docs-image-full')!;
        const source = document.querySelector(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        )!;
        const rect = (el: Element) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        (window as any).__docsPreviewPointer = null;
        document.addEventListener(
          'pointerdown',
          (event) => {
            (window as any).__docsPreviewPointer = {
              trusted: event.isTrusted,
              preview: event.target === preview,
              x: event.clientX,
              y: event.clientY,
              source: rect(source),
              foreground: rect(preview),
            };
          },
          { capture: true, once: true }
        );
        return document.elementFromPoint(point.x, point.y) === preview;
      }, point);
      expect(hitPreview).toBe(true);
      await page.mouse.click(point.x, point.y);
      const pointer = await page.evaluate(() => (window as any).__docsPreviewPointer);
      expect(pointer).toMatchObject({
        trusted: true,
        preview: true,
        source: geometry.after.source,
        foreground: geometry.after.preview,
      });
      for (const box of [pointer.source, pointer.foreground]) {
        expect(pointer.x).toBeGreaterThan(box.x);
        expect(pointer.x).toBeLessThan(box.x + box.width);
        expect(pointer.y).toBeGreaterThan(box.y);
        expect(pointer.y).toBeLessThan(box.y + box.height);
      }
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-transition-state')
      ).toBe('entered');
      await page.mouse.click(1, 1);
      await closed(page);
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      records.push({
        sourceNaming: states,
        sourceHitProbe: { ...geometry, point, hitPreview, pointer },
      });
      expect(failuresByPage.get(page)).toEqual([]);
    } finally {
      await capture(page, 'source-name-last-observed');
      await context.close();
    }
  }, 90_000);
  it('preserves authored MDX picture/alt/caption, safe SVG, links and error recovery', async () => {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MDX}`, { waitUntil: 'networkidle' });
      expect(await page.locator('[data-fixture="picture"] picture > source').count()).toBe(1);
      expect(
        await page
          .locator('[data-fixture="unsupported-svg"]')
          .evaluate((el) => el.closest('[data-docs-image-trigger]'))
      ).toBeNull();
      expect(
        await page.locator('[data-fixture="interactive"] [data-docs-image-trigger]').count()
      ).toBe(0);
      expect(await page.locator('[data-fixture="opt-out"] [data-docs-image-trigger]').count()).toBe(
        0
      );
      await open(page, 'Responsive raster diagram');
      expect(await page.locator('.docs-image-full').getAttribute('src')).toContain(
        '/images/preview-fixture/raster.png'
      );
      expect(await page.locator('.docs-image-accessible-description').textContent()).toContain(
        'Authored picture caption'
      );
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await page.locator('[data-fixture="inline-svg"] svg text').allTextContents()).toEqual([
        'Source',
        'Result',
      ]);
      await open(page, 'Static inline diagram');
      expect(await page.locator('.docs-image-full').getAttribute('src')).toMatch(/^blob:/);
      expect(await page.locator('[data-docs-image-content] svg').count()).toBe(0);
      await capture(page, 'mdx-safe-inline-svg');
      await page.keyboard.press('Escape');
      await closed(page);
      await page
        .getByRole('button', { name: 'Enlarge image: Unavailable diagram', exact: true })
        .click();
      await entered(page);
      await page
        .getByRole('status')
        .filter({ hasText: 'This image could not be loaded' })
        .waitFor({ state: 'visible' });
      const status = page.locator('.docs-image-status');
      expect(await status.evaluate((node) => node.localName)).toBe('p');
      expect(await status.getAttribute('role')).toBe('status');
      const statusText = status.locator('[data-docs-image-status-text][data-pui-root]');
      expect(await statusText.count()).toBe(1);
      expect(await statusText.getAttribute('data-docs-preview-prototype')).toBe('shadcn-text-root');
      expect(await statusText.getAttribute('role')).toBeNull();
      expect(await statusText.getAttribute('tabindex')).toBeNull();
      expect(await statusText.getAttribute('data-pui-style')).toContain('text-base');
      await capture(page, 'mdx-image-error');
      await page.keyboard.press('Escape');
      await closed(page);
      await open(page, 'Responsive raster diagram');
      expect(await page.locator('.docs-image-status').isVisible()).toBe(false);
      await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
      expect(await page.locator('[data-docs-image-content]').count()).toBe(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      await page.locator('a:has(img[alt="Linked vector"])').click();
      expect(page.url()).toContain('#linked-destination');
      expect(await page.locator('[data-docs-image-content][data-open]').count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);
  // Restore #796 for whitepaper figures too. The withdrawn reading/fit
  // toolbar is not an alternative acceptance path for this presentation.
  for (const [locale, width, colorScheme] of [
    ['zh-cn', 1280, 'light'],
    ['zh-cn', 390, 'dark'],
    ['zh-cn', 320, 'light'],
    ['en', 1280, 'dark'],
    ['en', 390, 'light'],
    ['en', 320, 'dark'],
  ] as const) {
    it(`migrates the actual ${locale} whitepaper viewer at ${width}px ${colorScheme}`, async () => {
      const height = width < 640 ? 844 : 900;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme,
        hasTouch: width < 640,
      });
      const page = track(await context.newPage());
      const name = `whitepaper-${locale}-${width}-${colorScheme}`;
      try {
        await page.goto(`${baseUrl}/${locale}/whitepaper/6-consistency-boundary/`, {
          waitUntil: 'networkidle',
        });
        await page.evaluate((scheme) => {
          document.documentElement.dataset.theme = scheme;
        }, colorScheme);
        const trigger = page.locator('.whitepaper-figure [data-docs-image-trigger]').first();
        const source = trigger.locator('img');
        const sourceSelector = '.whitepaper-figure [data-docs-image-trigger] img';
        await observePreviewFocus(page, sourceSelector);
        const readSource = () =>
          source.evaluate((node) => {
            const image = node as HTMLImageElement;
            return {
              src: image.getAttribute('src'),
              currentSrc: image.currentSrc,
              alt: image.alt,
              width: image.getAttribute('width'),
              height: image.getAttribute('height'),
              picture: image.closest('picture')?.querySelector('source')?.outerHTML ?? null,
              caption: image.closest('figure')?.querySelector('figcaption')?.textContent?.trim(),
            };
          });
        await trigger.scrollIntoViewIfNeeded();
        await source.evaluate((node) => (node as HTMLImageElement).decode());
        const original = await readSource();
        expect(original.currentSrc).toContain(
          `whitepaper-conditional-consistency${width < 640 ? '.mobile' : ''}.${locale}.svg`
        );
        expect(original.alt.length).toBeGreaterThan(0);
        const beforeInput = await source.evaluate((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { origin: { x, y, width, height }, scroll: { x: scrollX, y: scrollY } };
        });
        const origin = beforeInput.origin;
        await capture(page, `${name}-source`);
        if (evidence)
          await writeFile(
            path.join(evidence, `${name}-source-measurement.json`),
            JSON.stringify({ ...beforeInput, original }, null, 2)
          );
        await recordNextMotion(page, 'pointerdown', sourceSelector);
        if (width < 640) await trigger.tap();
        else await trigger.click();
        await entered(page);
        const fit = await containedWhitepaper(page);
        expect(fit.src).toBe(original.currentSrc);
        expect(fit.alt).toBe(original.alt);
        expect(fit.closeClip).toBe('inset(50%)');
        expect(await page.locator('button[data-diagram-open]').count()).toBe(0);
        if (original.caption)
          expect(
            (await page.locator('.docs-image-accessible-description').textContent())?.replace(
              /\s+/g,
              ' '
            )
          ).toContain(original.caption.replace(/\s+/g, ' '));
        const opening = await motionFrames(page, `${name}-opening`);
        const openingInput = (await page.evaluate(
          () => (window as any).__docsImageMotion.input
        )) as MotionInput | null;
        expect(openingInput).toMatchObject({
          type: 'pointerdown',
          trusted: true,
          sourceCurrentSrc: original.currentSrc,
        });
        expect(openingInput?.source).not.toBeNull();
        const inputOrigin = openingInput!.source!;
        for (const key of ['x', 'y', 'width', 'height'] as const)
          expect(Number.isFinite(inputOrigin[key])).toBe(true);
        expect(inputOrigin.width).toBeGreaterThan(0);
        expect(inputOrigin.height).toBeGreaterThan(0);
        expectSpringImageMotion(opening, inputOrigin, fit.content, 'opening');
        await capture(page, `${name}-contained`);
        await page.locator('.docs-image-full').click();
        expect(
          await page.locator('[data-docs-image-content]').getAttribute('data-transition-state')
        ).toBe('entered');
        const background = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
        await page.mouse.wheel(120, 240);
        const afterWheel = await page.evaluate(async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          return { x: scrollX, y: scrollY };
        });
        expect(afterWheel).toEqual(background);
        const keyboardFocus = await keyboardCloseFocus(page);
        await capture(page, `${name}-keyboard-close`);
        const returnOrigin = (await source.boundingBox())!;
        await recordNextMotion(page, 'keydown', sourceSelector);
        await page.keyboard.press('Escape');
        const closing = await motionFrames(page, `${name}-closing`);
        expectSpringImageMotion(closing, returnOrigin, fit.content, 'closing');
        await closed(page);
        expect(await trigger.evaluate((node) => document.activeElement === node)).toBe(true);
        expect(await trigger.getAttribute('data-focus-visible')).not.toBeNull();
        expect(
          await source.evaluate(
            (node) => getComputedStyle(node.closest('[data-docs-image-source-surface]')!).opacity
          )
        ).toBe('1');
        expect(await trigger.getAttribute('data-docs-image-origin-hidden')).toBeNull();
        expect(await trigger.getAttribute('data-docs-image-source-instant')).toBeNull();
        await capture(page, `${name}-returned`);

        // A new pointer activation must not retain the previous Escape's
        // keyboard-only Close presentation. Save the actual state before asserting.
        if (width < 640) await trigger.tap();
        else await trigger.click();
        await entered(page);
        const repeatedPointer = await page.evaluate(() =>
          (window as any).__docsImageFocusProbe.read(true)
        );
        await capture(page, `${name}-repeated-pointer`);
        expect(repeatedPointer.modal.contentActive).toBe(true);
        expect(repeatedPointer.modal.contentTabIndex).toBe(-1);
        expect(repeatedPointer.modal.contentOutline.style).toBe('none');
        expect(repeatedPointer.modal.contentOutline.width).toBe('0px');
        expect(repeatedPointer.closeButton?.active).toBe(false);
        expect(repeatedPointer.closeButton?.clipPath).toBe('inset(50%)');
        await page.keyboard.press('Escape');
        await closed(page);
        expect(await trigger.evaluate((node) => document.activeElement === node)).toBe(true);

        // Keyboard activation also enters Content. Reverse Tab reaches the
        // same public Close action without introducing Content into tab order.
        await page.keyboard.press('Enter');
        await entered(page);
        const reopened = await containedWhitepaper(page);
        const reopenedKeyboardFocus = await keyboardCloseFocus(page, 'Shift+Tab');
        await page.keyboard.press('Enter');
        await closed(page);
        expect(await trigger.evaluate((node) => document.activeElement === node)).toBe(true);
        if (width < 640) await trigger.tap();
        else await trigger.click();
        await entered(page);
        const pointerFit = await containedWhitepaper(page);
        const pointerOrigin = (await source.boundingBox())!;
        await recordNextMotion(page, 'pointerdown', sourceSelector);
        if (width < 640) await page.touchscreen.tap(1, 1);
        else await page.mouse.click(1, 1);
        const backgroundClosing = await motionFrames(page, `${name}-background-closing`);
        expectSpringImageMotion(backgroundClosing, pointerOrigin, pointerFit.content, 'closing');
        await closed(page);
        expect(await trigger.evaluate((node) => document.activeElement === node)).toBe(true);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
        const restored = await readSource();
        expect(restored).toEqual(original);
        expect(failuresByPage.get(page)).toEqual([]);
        records.push({
          whitepaper: locale,
          width,
          height,
          colorScheme,
          original,
          origin,
          beforeInput,
          openingInput,
          inputOrigin,
          fit,
          opening,
          returnOrigin,
          closing,
          background,
          afterWheel,
          keyboardFocus,
          repeatedPointer,
          reopened,
          reopenedKeyboardFocus,
          pointerOrigin,
          pointerFit,
          backgroundClosing,
          restored,
          presentation: 'contain, no persistent toolbar; not a reading-size acceptance claim',
          imageScaleAgainstArticle: {
            width: fit.image.width / origin.width,
            height: fit.image.height / origin.height,
          },
        });
      } finally {
        await capture(page, `${name}-last-observed`);
        await context.close();
      }
    }, 90_000);
  }
  for (const locale of ['zh-cn', 'en'] as const) {
    it(`keeps the five ${locale} channel identifiers readable in the actual mobile table`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = track(await context.newPage());
      try {
        await page.goto(`${baseUrl}/${locale}/whitepaper/2-interaction-relations/`, {
          waitUntil: 'networkidle',
        });
        const words = page.locator('.whitepaper-channel-table tbody td:first-child code');
        expect(await words.allTextContents()).toEqual([
          'Event',
          'Feedback',
          'Props',
          'Expose',
          'Context',
        ]);
        const geometry = await words.evaluateAll((nodes) =>
          nodes.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const lines = [...range.getClientRects()].filter(
              (rect) => rect.width > 0 && rect.height > 0
            );
            return {
              text: node.textContent,
              lineTops: lines.map((rect) => rect.top),
              whiteSpace: getComputedStyle(node).whiteSpace,
            };
          })
        );
        for (const word of geometry) {
          expect(word.lineTops.length).toBeGreaterThan(0);
          expect(Math.max(...word.lineTops) - Math.min(...word.lineTops)).toBeLessThan(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        );
        records.push({ channelTable: locale, geometry });
        await words.first().scrollIntoViewIfNeeded();
        await capture(page, `channel-table-${locale}-390`);
      } finally {
        await context.close();
      }
    }, 90_000);
    for (const figure of ['lifecycle', 'translation'] as const) {
      it(`preserves the authored ${locale} ${figure} drawing in borderless mobile contain`, async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: locale === 'zh-cn' ? 'light' : 'dark',
          hasTouch: true,
        });
        const page = track(await context.newPage());
        try {
          const chapter =
            figure === 'lifecycle' ? '4-semantics-beyond-channels' : '5-translation-layer';
          const asset =
            figure === 'lifecycle'
              ? 'whitepaper-lifecycle.svg'
              : `whitepaper-translation-responsibility.${locale}.svg`;
          await page.goto(`${baseUrl}/${locale}/whitepaper/${chapter}/`, {
            waitUntil: 'networkidle',
          });
          const authored = page.locator(`img[src="/diagrams/${asset}"]`).first();
          const trigger = page.locator('[data-docs-image-trigger]').filter({ has: authored });
          await trigger.scrollIntoViewIfNeeded();
          await authored.evaluate((node) => (node as HTMLImageElement).decode());
          const source = await authored.evaluate((node) => {
            const image = node as HTMLImageElement;
            const box = image.getBoundingClientRect();
            return {
              src: image.currentSrc,
              alt: image.alt,
              width: image.getAttribute('width'),
              height: image.getAttribute('height'),
              rect: { x: box.x, y: box.y, width: box.width, height: box.height },
            };
          });
          expect(source.src).toContain(`/diagrams/${asset}`);
          expect(source.alt.length).toBeGreaterThan(0);
          await capture(page, `authored-${locale}-${figure}-source`);
          await trigger.tap();
          await entered(page);
          const fit = await containedWhitepaper(page);
          expect(fit.src).toBe(source.src);
          expect(fit.alt).toBe(source.alt);
          expect(fit.closeClip).toBe('inset(50%)');
          await capture(page, `authored-${locale}-${figure}-contained`);
          await page.keyboard.press('Escape');
          await closed(page);
          expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await authored.getAttribute('alt')).toBe(source.alt);
          expect(await authored.getAttribute('width')).toBe(source.width);
          expect(await authored.getAttribute('height')).toBe(source.height);
          await page.keyboard.press('Enter');
          await entered(page);
          const reopened = await containedWhitepaper(page);
          expect(reopened.image).toEqual(fit.image);
          expect(reopened.src).toBe(source.src);
          await page.touchscreen.tap(1, 1);
          await closed(page);
          expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
          records.push({
            authored: asset,
            locale,
            source,
            fit,
            reopened,
            imageScaleAgainstArticle: {
              width: fit.image.width / source.rect.width,
              height: fit.image.height / source.rect.height,
            },
            presentation:
              'Whole authored image contained without a toolbar; inspect text in these captures. This does not claim the retired reading-size or pan acceptance.',
          });
          expect(failuresByPage.get(page)).toEqual([]);
        } finally {
          await capture(page, `authored-${locale}-${figure}-last-observed`);
          await context.close();
        }
      }, 90_000);
    }
  }
  // The old retained diagram-button callback test belonged to the removed
  // reading/fit controls. Keep a distinct negative lifecycle probe for the
  // actual media and Dialog that still exist; do not report the old test green.
  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`ignores retired ${family} whitepaper image events after close and reopen`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = track(await context.newPage());
      try {
        await page.goto(`${baseUrl}/en/whitepaper/6-consistency-boundary/`, {
          waitUntil: 'networkidle',
        });
        await page.evaluate((family) => {
          document.documentElement.dataset.siteLibraryFamily = family;
        }, family);
        await page.waitForFunction(
          (family) =>
            document.querySelector('.whitepaper-figure [data-docs-image-trigger]')?.localName ===
            `docs-preview-${family}-image-trigger`,
          family
        );
        const trigger = page.locator('.whitepaper-figure [data-docs-image-trigger]').first();
        await trigger.click();
        await entered(page);
        await containedWhitepaper(page);
        const oldImage = await page.locator('.docs-image-full').elementHandle();
        const content = await page.locator('[data-docs-image-content]').elementHandle();
        expect(oldImage).not.toBeNull();
        expect(content).not.toBeNull();
        try {
          await page.keyboard.press('Escape');
          await closed(page);
          expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
          await trigger.click();
          await entered(page);
          const fit = await containedWhitepaper(page);
          const probe = await page.evaluate(
            ({ oldImage, content }) => {
              const root = document.querySelector<
                HTMLElement & {
                  getExposes?: () => { open?: { get?: () => boolean } };
                }
              >('[data-docs-image-dialog]');
              const snapshot = () => {
                const image = document.querySelector<HTMLImageElement>('.docs-image-full')!;
                const panel = document.querySelector<HTMLElement>('[data-docs-image-content]')!;
                const status = document.querySelector<HTMLElement>('.docs-image-status')!;
                const { x, y, width, height } = image.getBoundingClientRect();
                return {
                  open: root?.getExposes?.().open?.get?.(),
                  src: image.src,
                  alt: image.alt,
                  hidden: image.hidden,
                  statusHidden: status.hidden,
                  phase: panel.getAttribute('data-transition-state'),
                  returnMode: panel.dataset.docsImageReturn,
                  originHidden: document
                    .querySelector('.whitepaper-figure [data-docs-image-trigger]')
                    ?.hasAttribute('data-docs-image-origin-hidden'),
                  image: { x, y, width, height },
                };
              };
              const before = snapshot();
              const afterEach = [];
              // Deliberately synthetic events on a retained retired image are
              // negative controls, separate from the native open/close inputs.
              oldImage!.dispatchEvent(new Event('error'));
              afterEach.push(snapshot());
              oldImage!.dispatchEvent(new Event('load'));
              afterEach.push(snapshot());
              content!.dispatchEvent(new CustomEvent('afterLeave'));
              afterEach.push(snapshot());
              return {
                oldConnected: oldImage!.isConnected,
                replaced: oldImage !== document.querySelector('.docs-image-full'),
                before,
                afterEach,
              };
            },
            { oldImage, content }
          );
          expect(probe.oldConnected).toBe(false);
          expect(probe.replaced).toBe(true);
          expect(probe.before).toMatchObject({
            open: true,
            src: fit.src,
            alt: fit.alt,
            hidden: false,
            statusHidden: true,
            phase: 'entered',
            returnMode: 'origin',
            originHidden: true,
          });
          for (const after of probe.afterEach) expect(after).toEqual(probe.before);
          records.push({ retiredWhitepaperMedia: family, probe });
          await capture(page, `whitepaper-retired-media-${family}`);
          await page.keyboard.press('Escape');
          await closed(page);
          expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(failuresByPage.get(page)).toEqual([]);
        } finally {
          await oldImage?.dispose();
          await content?.dispose();
        }
      } finally {
        await context.close();
      }
    }, 90_000);
  }

  it('preserves actual cross-origin image referrer and credential requests', async () => {
    const bytes = await readFile('apps/www/public/images/preview-fixture/raster.png');
    const requests: Array<{ cookie: string; referer: string; origin: string }> = [];
    const server = createServer((request, response) => {
      requests.push({
        cookie: request.headers.cookie ?? '',
        referer: request.headers.referer ?? '',
        origin: request.headers.origin ?? '',
      });
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': baseUrl,
        'Access-Control-Allow-Credentials': 'true',
      });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const imageOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const context = await browser.newContext();
    const page = track(await context.newPage());
    try {
      // Deliberately fake fixture cookie; no account or user credential is involved.
      await context.addCookies([
        { url: imageOrigin, name: 'preview-fixture', value: 'non-secret', sameSite: 'Lax' },
      ]);
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      for (const crossOrigin of ['anonymous', 'use-credentials'] as const) {
        requests.length = 0;
        const referrerPolicy = crossOrigin === 'anonymous' ? 'no-referrer' : 'origin';
        await page.evaluate(
          ({ src, crossOrigin, referrerPolicy }) => {
            const image = document.createElement('img');
            image.alt = `Policy ${crossOrigin}`;
            image.crossOrigin = crossOrigin;
            image.referrerPolicy = referrerPolicy;
            image.src = src;
            document.querySelector('[data-doc-flow]')!.append(image);
          },
          { src: `${imageOrigin}/policy.png?${crossOrigin}`, crossOrigin, referrerPolicy }
        );
        await page.waitForFunction((alt) => {
          const image = Array.from(document.querySelectorAll('img')).find((img) => img.alt === alt);
          return Boolean(image?.complete && image.naturalWidth);
        }, `Policy ${crossOrigin}`);
        await open(page, `Policy ${crossOrigin}`);
        // HTML may reuse the document's already-decoded image even with no-store.
        // Verify the preview policy itself, plus every request actually emitted.
        const previewPolicy = await page.locator('.docs-image-full').evaluate((element) => {
          const image = element as HTMLImageElement;
          return {
            crossOrigin: image.crossOrigin,
            referrerPolicy: image.referrerPolicy,
            src: image.src,
          };
        });
        expect(previewPolicy).toEqual({
          crossOrigin,
          referrerPolicy,
          src: `${imageOrigin}/policy.png?${crossOrigin}`,
        });
        expect(requests.length).toBeGreaterThanOrEqual(1);
        for (const request of requests) {
          expect(request.origin).toBe(baseUrl);
          expect(request.referer).toBe(referrerPolicy === 'no-referrer' ? '' : `${baseUrl}/`);
          expect(request.cookie.includes('preview-fixture=non-secret')).toBe(
            crossOrigin === 'use-credentials'
          );
        }
        records.push({
          network: crossOrigin,
          requestCount: requests.length,
          previewPolicy,
          referrerPolicy,
          requests: requests.map((request) => ({
            origin: request.origin,
            referrer: request.referer,
            fixtureCredentialSent: Boolean(request.cookie),
          })),
        });
        await page.keyboard.press('Escape');
        await closed(page);
      }
    } finally {
      await context.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 90_000);
  it('keeps keyboard focus visible without adding an image frame in forced colors', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      forcedColors: 'active',
    });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      const trigger = await open(page, 'Vector landscape');
      expect(
        await page
          .locator('[data-docs-image-content]')
          .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
      ).toBe(0);
      await observeKeyboardCloseReadability(page);
      await page.keyboard.press('Tab');
      expect(
        await page.locator('[data-docs-image-close]').getAttribute('data-focus-visible')
      ).not.toBeNull();
      await capture(page, 'forced-colors-vector');
      const vectorCloseReveal = await collectKeyboardCloseReadability(page, 'forced-colors-vector');
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
      const focusPaint = await trigger
        .locator('[data-docs-image-trigger-surface]')
        .evaluate((el) => ({
          style: getComputedStyle(el).outlineStyle,
          color: getComputedStyle(el).outlineColor,
          width: getComputedStyle(el).outlineWidth,
        }));
      expect(focusPaint.style).toBe('solid');
      expect(focusPaint.width).toBe('2px');
      expect(focusPaint.color).not.toBe('rgba(0, 0, 0, 0)');
      await capture(page, 'forced-colors-keyboard-focus');
      await page.goto(`${baseUrl}/en/whitepaper/6-consistency-boundary/`, {
        waitUntil: 'networkidle',
      });
      await page.locator('.whitepaper-figure [data-docs-image-trigger]').first().click();
      await entered(page);
      await page
        .locator('.docs-image-full')
        .evaluate((node) => (node as HTMLImageElement).decode());
      expect(await page.locator('.docs-image-toolbar, [data-docs-image-zoom]').count()).toBe(0);
      const whitepaperInitialFocus = await contentInitialFocus(page);
      await observeKeyboardCloseReadability(page);
      const whitepaperCloseFocus = await keyboardCloseFocus(page);
      records.push({
        forcedColorsWhitepaperInitialFocus: whitepaperInitialFocus,
        forcedColorsWhitepaperCloseFocus: whitepaperCloseFocus,
        forcedColorsVectorCloseReveal: vectorCloseReveal,
      });
      await capture(page, 'forced-colors-whitepaper-keyboard-close');
      const whitepaperCloseReveal = await collectKeyboardCloseReadability(
        page,
        'forced-colors-whitepaper'
      );
      await page.keyboard.press('Enter');
      await closed(page);
      expect(
        await page
          .locator('.whitepaper-figure [data-docs-image-trigger]')
          .first()
          .evaluate((node) => node === document.activeElement)
      ).toBe(true);
      expectReadableKeyboardClose(vectorCloseReveal);
      expectReadableKeyboardClose(whitepaperCloseReveal);
    } finally {
      await context.close();
    }
  }, 90_000);
  it('honors reduced motion and preserves no-JavaScript media/link content', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      await observePreviewFocus(page, '[data-docs-image-trigger] img[alt="Vector landscape"]');
      const trigger = await open(page, 'Vector landscape');
      expect(
        await page
          .locator('[data-docs-image-content]')
          .evaluate((el) => getComputedStyle(el).transitionDuration)
      ).toBe('0s');
      await capture(page, 'reduced-motion-vector');
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
      await capture(page, 'reduced-motion-escape-returned');
      await trigger.click();
      await entered(page);
      const repeatedPointer = await page.evaluate(() =>
        (window as any).__docsImageFocusProbe.read(true)
      );
      await capture(page, 'reduced-motion-repeated-pointer');
      expect(repeatedPointer.reducedMotion).toBe(true);
      expect(repeatedPointer.modal.contentActive).toBe(true);
      expect(repeatedPointer.modal.contentTabIndex).toBe(-1);
      expect(repeatedPointer.modal.contentOutline.style).toBe('none');
      expect(repeatedPointer.modal.contentOutline.width).toBe('0px');
      expect(repeatedPointer.closeButton?.active).toBe(false);
      expect(repeatedPointer.closeButton?.clipPath).toBe('inset(50%)');
      records.push({ reducedMotionRepeatedPointer: repeatedPointer });
      await page.mouse.click(1, 1);
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally {
      await capture(page, 'reduced-motion-pointer-return');
      await context.close();
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = track(await noJs.newPage());
    try {
      await staticPage.goto(`${baseUrl}${MD}`);
      expect(await staticPage.locator('[data-doc-flow] img').count()).toBe(4);
      expect(await staticPage.locator('[data-docs-image-trigger]').count()).toBe(0);
      expect(await staticPage.locator('a:has(img[alt="Linked vector"])').getAttribute('href')).toBe(
        '#linked-destination'
      );
    } finally {
      await noJs.close();
    }
  }, 90_000);
});
