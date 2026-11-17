import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright-core';

// Evidence-only companion. It never writes component state, CSS or control facts.
const outputRoot = process.env.PROTO_UI_PROJECTION_EVIDENCE_DIR;
const pages = new WeakMap<Page, { id: number; testName: string; sequence: number }>();
let nextPage = 0;

export async function installProjectionEvidence(page: Page, testName: string): Promise<void> {
  if (!outputRoot) throw new Error('PR1472 native evidence requires its output directory.');
  await mkdir(outputRoot, { recursive: true });
  const metadata = { id: ++nextPage, testName, sequence: 0 };
  pages.set(page, metadata);
  await appendFile(path.join(outputRoot, 'pages.ndjson'), JSON.stringify(metadata) + '\n');
  page.on('console', message => {
    if (message.type() === 'error')
      void appendFile(path.join(outputRoot, 'console-errors.ndjson'), JSON.stringify({ page: metadata.id, text: message.text() }) + '\n')
        .catch(error => console.error('[pr1472-evidence] Cannot retain console error:', error));
  });
  await page.addInitScript(() => {
    type Observation = Record<string, unknown>;
    type EvidenceWindow = Window & { __pui1472NativeEvidence?: {
      events: Observation[];
      geometry: Observation[];
      readLayout(element: HTMLElement): Record<string, unknown>;
    } };
    const view = window as EvidenceWindow;
    const events: Observation[] = [];
    const geometry: Observation[] = [];
    const identities = new WeakMap<Element, number>();
    let nextIdentity = 0;
    const identity = (element: Element | null): number | null => {
      if (!element) return null;
      let value = identities.get(element);
      if (value === undefined) { value = ++nextIdentity; identities.set(element, value); }
      return value;
    };
    const layoutBox = (element: HTMLElement) => {
      let inlineStart = 0;
      let current: HTMLElement | null = element;
      while (current) {
        inlineStart += current.offsetLeft;
        const parent: Element | null = current.offsetParent;
        if (!parent || !('offsetLeft' in parent)) break;
        inlineStart += (parent as HTMLElement).clientLeft;
        current = parent as HTMLElement;
      }
      for (let parent = element.parentElement; parent; parent = parent.parentElement)
        inlineStart -= parent.scrollLeft;
      const css = getComputedStyle(element);
      return {
        observationId: identity(element), parentId: identity(element.parentElement),
        offsetParentId: identity(element.offsetParent),
        tag: element.tagName, id: element.id, role: element.getAttribute('role'),
        ref: element.getAttribute('data-demo-ref'), prototype: element.getAttribute('data-projection-prototype'),
        position: css.position, overflowX: css.overflowX, overflowY: css.overflowY,
        offsetLeft: element.offsetLeft, offsetWidth: element.offsetWidth,
        clientLeft: element.clientLeft, clientWidth: element.clientWidth, scrollLeft: element.scrollLeft,
        layoutInlineStart: inlineStart,
        borderInlineInterval: { start: inlineStart, end: inlineStart + element.offsetWidth },
        clientInlineInterval: { start: inlineStart + element.clientLeft, end: inlineStart + element.clientLeft + element.clientWidth },
      };
    };
    const readLayout = (element: HTMLElement): Record<string, unknown> => {
      const frame = element.closest<HTMLElement>('[role="listbox"]');
      const frameIsContent = frame?.getAttribute('data-projection-prototype')?.endsWith('-select-content') === true;
      const ancestorBoxes = [];
      for (let parent = element.parentElement; parent; parent = parent.parentElement)
        ancestorBoxes.push({ ...layoutBox(parent), isObservedContentFrame: parent === frame && frameIsContent });
      return {
        layout: layoutBox(element), ancestorBoxes,
        frameBoundary: {
          observationId: identity(frame), contentPrototypeObserved: frameIsContent,
          controlledBy: frame?.id ? [...document.querySelectorAll<HTMLElement>('[role="combobox"][aria-controls]')]
            .filter(trigger => trigger.getAttribute('aria-controls') === frame.id).map(trigger => identity(trigger)) : [],
          basis: 'Observed Content listbox ancestor and aria-controls. The floating-frame association is source-derived from asOverlay registering its current Content host.',
          availability: frame && frameIsContent ? 'observed-content-view' : 'owning-frame-unresolved',
        },
      };
    };
    view.__pui1472NativeEvidence = { events, geometry, readLayout };
    let previousGeometry = '';
    const sampleGeometry = (phase: string) => {
      const boxes = [...document.querySelectorAll<HTMLElement>(
        '[role="combobox"], [role="listbox"], [role="option"], [data-projection-prototype$="select-surface"], [data-projection-prototype$="select-viewport"]'
      )].map(element => {
        const css = getComputedStyle(element);
        return {
          id: element.id, ref: element.getAttribute('data-demo-ref'), role: element.getAttribute('role'),
          prototype: element.getAttribute('data-projection-prototype'), generation: element.getAttribute('data-projection-generation'),
          text: element.textContent?.slice(0, 300), connected: element.isConnected,
          width: element.offsetWidth, height: element.offsetHeight,
          clientWidth: element.clientWidth, clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
          inline: element.style.cssText, display: css.display, visibility: css.visibility,
          minWidth: css.minWidth, maxWidth: css.maxWidth, minHeight: css.minHeight, maxHeight: css.maxHeight,
          whiteSpace: css.whiteSpace, lineHeight: css.lineHeight, fontSize: css.fontSize, fontFamily: css.fontFamily,
          overflowX: css.overflowX, overflowY: css.overflowY,
          ...readLayout(element),
        };
      });
      const signature = JSON.stringify(boxes);
      if (signature === previousGeometry) return;
      previousGeometry = signature;
      geometry.push({ phase, time: performance.now(), fonts: document.fonts.status, boxes });
      if (geometry.length > 128) geometry.shift();
    };
    // Read-only observations at actual DOM delivery/frame boundaries. A synchronous
    // host rejection can still roll back before either boundary; never infer its
    // pre-rollback dimensions from this trace.
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; sampleGeometry('mutation-delivery'); });
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-pui-style', 'data-state', 'aria-expanded'] });
    for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'focusin', 'focusout', 'valueChange', 'proto-adapter:change']) {
      document.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target : null;
        const keyboard = event instanceof KeyboardEvent ? event : null;
        const pointer = event instanceof PointerEvent ? event : null;
        const custom = event instanceof CustomEvent ? event : null;
        const detail = custom?.detail;
        events.push({
          type, isTrusted: event.isTrusted, time: performance.now(),
          key: keyboard?.key, pointerType: pointer?.pointerType, buttons: pointer?.buttons,
          detail: detail && typeof detail === 'object' ? { value: detail.value, adapter: detail.adapter } : null,
          target: target ? { tag: target.tagName, id: target.id, role: target.getAttribute('role'), ref: target.getAttribute('data-demo-ref'), prototype: target.getAttribute('data-projection-prototype') } : null,
        });
        if (events.length > 512) events.shift();
        if (type === 'click' || type === 'keydown' || type === 'valueChange' || type === 'proto-adapter:change') {
          queueMicrotask(() => sampleGeometry(`${type}-turn-tail`));
          requestAnimationFrame(() => sampleGeometry(`${type}-next-frame`));
        }
      }, { capture: true, passive: true });
    }
  });
}

export async function captureProjectionEvidence(
  page: Page,
  stage: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const metadata = pages.get(page);
  if (!outputRoot || !metadata) throw new Error('PR1472 evidence page is not registered.');
  const sequence = ++metadata.sequence;
  const stem = `${metadata.id}-${String(sequence).padStart(3, '0')}-${stage}`;
  let snapshot: unknown;
  let snapshotCaptured = false;
  let snapshotWritten = false;
  let screenshotWritten = false;
  const failures: { phase: string; error: unknown }[] = [];
  try {
    snapshot = await page.evaluate(() => {
      type EvidenceWindow = Window & {
        __pui1472NativeEvidence?: {
          events: unknown[];
          geometry: unknown[];
          readLayout(element: HTMLElement): Record<string, unknown>;
        };
        __puiProjectionPortalProbe?: { running: boolean; samples: unknown[] };
      };
      const evidence = (window as EvidenceWindow).__pui1472NativeEvidence;
      if (!evidence) throw new Error('Native observation state is unavailable.');
      const scalar = (element: Element | null) => element ? {
        tag: element.tagName, id: element.id, role: element.getAttribute('role'),
        ref: element.getAttribute('data-demo-ref'), prototype: element.getAttribute('data-projection-prototype'),
      } : null;
      const elements = [...document.querySelectorAll<HTMLElement>(
        '[role="combobox"], [role="listbox"], [role="option"], [data-projection-prototype$="select-surface"], [data-projection-prototype$="select-viewport"], [data-projection-prototype$="select-item-text"], [data-projection-scope], [data-pui-portal-mount]'
      )];
      return {
        url: location.href, timestamp: performance.now(), viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        activeElement: scalar(document.activeElement),
        events: (window as EvidenceWindow).__pui1472NativeEvidence?.events ?? [],
        geometryTrace: (window as EvidenceWindow).__pui1472NativeEvidence?.geometry ?? [],
        originalPortalProbe: (window as EvidenceWindow).__puiProjectionPortalProbe ?? null,
        surfaces: elements.map(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const inlineFields = ['width', 'height', 'inline-size', 'block-size', 'box-sizing', 'min-width', 'max-width', 'min-height', 'max-height'];
          return {
            ...scalar(element), connected: element.isConnected,
            text: element.textContent?.slice(0, 500),
            owner: element.getAttribute('data-projection-owner'),
            runtime: element.getAttribute('data-projection-runtime'), family: element.getAttribute('data-projection-family'), generation: element.getAttribute('data-projection-generation'),
            state: element.getAttribute('data-projection-state'), controls: element.getAttribute('aria-controls'), expanded: element.getAttribute('aria-expanded'),
            hidden: element.hidden, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden'),
            attributes: Object.fromEntries([...element.attributes].filter(item => /^(data-pui|data-projection|data-state|data-demo-ref|aria-)/.test(item.name)).map(item => [item.name, item.value])),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            offset: { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight },
            client: { width: element.clientWidth, height: element.clientHeight, left: element.clientLeft, top: element.clientTop },
            scroll: { width: element.scrollWidth, height: element.scrollHeight, left: element.scrollLeft, top: element.scrollTop },
            inline: Object.fromEntries(inlineFields.map(name => [name, { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) }])),
            computed: Object.fromEntries(['display', 'visibility', 'pointer-events', 'position', 'box-sizing', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'overflow-x', 'overflow-y', 'white-space', 'line-height', 'font-family', 'font-size', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width', 'transform'].map(name => [name, style.getPropertyValue(name)])),
            ...evidence.readLayout(element),
          };
        }),
      };
    });
    snapshotCaptured = true;
    // Retain native facts and the original assertion context before image work.
    await writeFile(path.join(outputRoot, `${stem}.json`), JSON.stringify({ ...metadata, sequence, stage, extra, snapshot }, null, 2) + '\n');
    snapshotWritten = true;
    // PNG encodes the current page state; it does not advance animations or inject UI state.
    try {
      await page.screenshot({ path: path.join(outputRoot, `${stem}.png`), timeout: 5_000 });
      screenshotWritten = true;
    } catch (error) {
      failures.push({ phase: 'screenshot', error });
    }
  } catch (error) {
    failures.push({ phase: snapshotCaptured ? 'raw-retention' : 'native-snapshot', error });
  } finally {
    const describe = (failure: { phase: string; error: unknown }) => ({
      phase: failure.phase, errorPresent: true, thrownType: typeof failure.error, error: String(failure.error),
    });
    try {
      await appendFile(path.join(outputRoot, 'observations.ndjson'), JSON.stringify({
        page: metadata.id, testName: metadata.testName, sequence, stage,
        json: snapshotWritten ? `${stem}.json` : null,
        png: screenshotWritten ? `${stem}.png` : null,
        snapshotCaptured, snapshotWritten, screenshotWritten,
        failures: failures.map(describe),
      }) + '\n');
    } catch (error) {
      failures.push({ phase: 'observation-index', error });
    }
    if (failures.length) {
      const failure = {
        ...metadata, sequence, stage, extra, snapshotCaptured, snapshotWritten, screenshotWritten,
        rawSnapshotFile: snapshotWritten ? `${stem}.json` : null,
        rawSnapshot: snapshotCaptured && !snapshotWritten ? snapshot : null,
        failures: failures.map(describe),
      };
      // Secondary evidence failures never replace the original test failure,
      // including falsy throws. The supervisor rejects incomplete captures.
      try {
        await appendFile(path.join(outputRoot, 'capture-errors.ndjson'), JSON.stringify(failure) + '\n');
      } catch (error) {
        failure.failures.push({ phase: 'failure-retention', errorPresent: true, thrownType: typeof error, error: String(error) });
      }
      try { console.error('[pr1472-evidence] capture incomplete:', failure); } catch { /* Best effort after native-fact retention. */ }
    }
  }
}
