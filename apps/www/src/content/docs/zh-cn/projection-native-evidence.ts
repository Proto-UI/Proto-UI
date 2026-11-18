import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance as nodePerformance } from 'node:perf_hooks';
import type { Page } from 'playwright-core';

// Evidence-only companion. It never writes component state, CSS or control facts.
const outputRoot = process.env.PROTO_UI_PROJECTION_EVIDENCE_DIR;
type GeometryTransport = { context: string; ids: number[]; samples: { id: number; sample: unknown }[] };
type GeometryCache = { context: string; samples: Map<number, unknown> };
const geometryCaches = new WeakMap<Page, GeometryCache>();
const pages = new WeakMap<Page, { id: number; testName: string; sequence: number }>();
let nextPage = 0;

// A capture owns its cache copy across awaits, including overlapping captures and navigation.
function materializeGeometry(transport: GeometryTransport, previous?: GeometryCache): GeometryCache {
  if (typeof transport.context !== 'string' || !transport.context)
    throw new Error('Geometry context identity is missing.');
  const samples = new Map(previous?.context === transport.context ? previous.samples : []);
  const ids = new Set<number>();
  for (const id of transport.ids) {
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id))
      throw new Error('Geometry window has an invalid or duplicate sample identity.');
    ids.add(id);
  }
  const received = new Set<number>();
  for (const entry of transport.samples) {
    if (!ids.has(entry.id) || received.has(entry.id) || samples.has(entry.id))
      throw new Error('Geometry transfer has an unexpected or duplicate sample identity.');
    if (!entry.sample || typeof entry.sample !== 'object' || Array.isArray(entry.sample))
      throw new Error('Geometry transfer has no sample record.');
    received.add(entry.id);
    samples.set(entry.id, entry.sample);
  }
  for (const id of ids) if (!samples.has(id)) throw new Error(`Geometry sample ${id} is missing.`);
  for (const id of samples.keys()) if (!ids.has(id)) samples.delete(id);
  return { context: transport.context, samples };
}

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
      transport(context: string | null, known: number[]): GeometryTransport;
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
    const context = crypto.randomUUID();
    const sampleIds = new WeakMap<Observation, number>();
    let nextSampleId = 0;
    const transport = (knownContext: string | null, known: number[]): GeometryTransport => {
      const retained = new Set(knownContext === context ? known : []);
      const ids: number[] = [];
      const samples: GeometryTransport['samples'] = [];
      for (const sample of geometry) {
        const id = sampleIds.get(sample);
        if (id === undefined) throw new Error('Geometry sample has no assigned identity.');
        ids.push(id);
        if (!retained.has(id)) samples.push({ id, sample });
      }
      return { context, ids, samples };
    };
    view.__pui1472NativeEvidence = { events, geometry, readLayout, transport };
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
      // All nested values are freshly read scalar/plain records, never mutated after insertion.
      const sample = { phase, time: performance.now(), fonts: document.fonts.status, boxes };
      sampleIds.set(sample, ++nextSampleId);
      geometry.push(sample);
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
  const timings: { phase: string; startedAt: string; endedAt: string; durationMs: number; outcome: string }[] = [];
  const timed = async <T,>(phase: string, operation: () => T | Promise<T>): Promise<T> => {
    const startedAt = new Date().toISOString();
    const start = nodePerformance.now();
    let outcome = 'failed';
    try { const result = await operation(); outcome = 'completed'; return result; }
    finally { timings.push({ phase, startedAt, endedAt: new Date().toISOString(), durationMs: nodePerformance.now() - start, outcome }); }
  };
  const previous = geometryCaches.get(page);
  // This is the received reduced transport, never a successfully materialized snapshot.
  let transferred: { snapshot: string; browserEvaluate: { started: number; ended: number; durationMs: number } } | null = null;
  let browserEvaluate: { started: number; ended: number; durationMs: number } | null = null;
  let snapshotPhase = 'native-snapshot';
  try {
    const handle = await timed('evaluate', () => page.evaluateHandle(known => {
      const evaluateStarted = performance.now();
      type EvidenceWindow = Window & {
        __pui1472NativeEvidence?: {
          events: unknown[];
          geometry: unknown[];
          transport(context: string | null, known: number[]): GeometryTransport;
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
      const snapshot = {
        url: location.href, timestamp: performance.now(), viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        activeElement: scalar(document.activeElement),
        events: (window as EvidenceWindow).__pui1472NativeEvidence?.events ?? [],
        geometryTrace: evidence.transport(known.context, known.ids),
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
      // Freeze the JSON fact set in this synchronous evaluation. In particular,
      // events and the original portal probe may change before handle.jsonValue().
      const serialized = JSON.stringify(snapshot);
      const evaluateEnded = performance.now();
      return { snapshot: serialized, browserEvaluate: { started: evaluateStarted, ended: evaluateEnded, durationMs: evaluateEnded - evaluateStarted } };
    }, { context: previous?.context ?? null, ids: previous ? [...previous.samples.keys()] : [] }));
    try {
      snapshotPhase = 'native-protocol';
      const received = await timed('protocol', () => handle.jsonValue());
      transferred = received;
      browserEvaluate = received.browserEvaluate;
      snapshotPhase = 'geometry-materialize';
      snapshot = await timed('materialize', () => {
        const partial = JSON.parse(received.snapshot) as { geometryTrace: GeometryTransport } & Record<string, unknown>;
        const cache = materializeGeometry(partial.geometryTrace, previous);
        const full = { ...partial, geometryTrace: partial.geometryTrace.ids.map(id => cache.samples.get(id)) };
        geometryCaches.set(page, cache);
        return full;
      });
    } finally {
      try { await timed('protocol-dispose', () => handle.dispose()); }
      catch (error) { failures.push({ phase: 'protocol-dispose', error }); }
    }
    snapshotCaptured = true;
    // Retain native facts and the original assertion context before image work.
    await timed('write', () => writeFile(path.join(outputRoot, `${stem}.json`), JSON.stringify({ ...metadata, sequence, stage, extra, snapshot }) + '\n'));
    snapshotWritten = true;
    // PNG encodes the current page state; it does not advance animations or inject UI state.
    try {
      await timed('screenshot', () => page.screenshot({ path: path.join(outputRoot, `${stem}.png`), timeout: 5_000 }));
      screenshotWritten = true;
    } catch (error) {
      failures.push({ phase: 'screenshot', error });
    }
  } catch (error) {
    failures.push({ phase: snapshotCaptured ? 'raw-retention' : snapshotPhase, error });
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
        failures: failures.map(describe), timings, browserEvaluate,
      }) + '\n');
    } catch (error) {
      failures.push({ phase: 'observation-index', error });
    }
    if (failures.length) {
      const failure = {
        ...metadata, sequence, stage, extra, snapshotCaptured, snapshotWritten, screenshotWritten,
        rawSnapshotFile: snapshotWritten ? `${stem}.json` : null,
        rawSnapshot: snapshotCaptured && !snapshotWritten ? snapshot : null,
        // Keep the exact already-received string on materialization failure. No
        // re-evaluation, full-window fallback, or snapshot-success substitution.
        rawTransportEnvelope: !snapshotCaptured ? transferred : null,
        failures: failures.map(describe), timings, browserEvaluate,
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
