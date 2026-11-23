import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import {
  createWebMaterialPreferences,
  type WebMaterialPreferences,
} from '../src/material/preferences';
import { createWebMaterialSink } from '../src/material/sink';
import type { OpticalFrame } from '../src/material/program';
import type { CanvasBackdropFrame } from '../src/material/source';

const optical = vi.hoisted(() => ({
  render: vi.fn((_frame: unknown) => 'data:image/png;base64,AA=='),
  clear: vi.fn(),
}));
const decoding = vi.hoisted(() => ({
  prepare: vi.fn((_doc: Document, _source: string, ready: () => void, _failed: () => void) => {
    ready();
    return () => {};
  }),
}));
vi.mock('../src/material/program', () => ({ createWebOpticalProgram: () => optical }));
vi.mock('../src/material/image-prepare', () => ({
  createOpticalImageCache: (document: Document) => ({
    prepare: (source: string, ready: () => void, failed: () => void) =>
      decoding.prepare(document, source, ready, failed),
    clear() {},
    dispose() {},
  }),
  inspectOpticalImageResources: () => ({}),
}));
vi.mock('../src/material/contact-carrier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/material/contact-carrier')>()),
  inspectContactCarrier: () => null,
  contactCarrierBounds: (element: Element) => element.getBoundingClientRect(),
  createContactCarrier: () => ({ valid: () => true, release() {} }),
}));

// The actual window-backed preferences and sink execute together. Only MQL
// state/event delivery, source notifications, geometry, GPU, carrier and decode completion are stubs;
// this does not reproduce CDP delivery timing or establish browser paint.
function mediaHarness() {
  let reduced = false;
  const lists: Array<{ query: string; listeners: Set<() => void>; matches: boolean }> = [];
  const matches = (query: string) =>
    query === `(prefers-reduced-motion: ${reduced ? 'reduce' : 'no-preference'})` ||
    query === '(prefers-reduced-transparency: no-preference)' ||
    query === '(prefers-contrast: no-preference)' ||
    query === '(forced-colors: none)';
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const entry = { query, listeners: new Set<() => void>(), matches: matches(query) };
    lists.push(entry);
    return {
      get matches() {
        return entry.matches;
      },
      media: query,
      addEventListener(_event: string, fn: () => void) {
        entry.listeners.add(fn);
      },
      removeEventListener(_event: string, fn: () => void) {
        entry.listeners.delete(fn);
      },
    } as unknown as MediaQueryList;
  });
  return {
    set(value: boolean, notify = true) {
      reduced = value;
      const changed = lists.filter((entry) => entry.matches !== matches(entry.query));
      // Host state is updated before its corresponding queued change events.
      for (const entry of lists) entry.matches = matches(entry.query);
      if (notify)
        for (const entry of changed) for (const listener of [...entry.listeners]) listener();
    },
    get subscriptions() {
      return lists.reduce((sum, entry) => sum + entry.listeners.size, 0);
    },
  };
}

const cleanups: Array<() => void> = [];
const rect = (x: number, y: number, width: number, height: number) =>
  ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height }) as DOMRect;
function fixture(
  fill: string,
  tint = true,
  preferences: WebMaterialPreferences = createWebMaterialPreferences(window)
) {
  const scope = document.createElement('div');
  const canvas = document.createElement('canvas');
  const host = document.createElement('button');
  scope.append(canvas, host);
  document.body.append(scope);
  canvas.width = 400;
  canvas.height = 240;
  host.style.color = 'rgb(255, 255, 255)';
  host.style.borderRadius = '12px';
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 240));
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(40, 30, 100, 40));
  let revision = 0;
  const sourceFrame = (): CanvasBackdropFrame => ({
    revision: ++revision,
    canvas,
    scope,
    width: canvas.width,
    height: canvas.height,
    pixels: new Uint8Array(canvas.width * canvas.height * 4).fill(255),
  });
  let source: CanvasBackdropFrame | null = sourceFrame();
  const sourceListeners = new Set<() => void>();
  let tokens: readonly string[] = [];
  const sink = createWebMaterialSink(
    host,
    {
      queueStyle(style) {
        tokens = style.tokens;
      },
      requestFlush() {
        host.setAttribute('data-pui-style', tokens.join(' '));
      },
    },
    {
      source: {
        current: () => source,
        subscribe(fn) {
          sourceListeners.add(fn);
          return () => {
            sourceListeners.delete(fn);
          };
        },
        draw() {
          throw new Error('Test source frames are supplied explicitly');
        },
        revoke() {
          source = null;
          for (const listener of sourceListeners) listener();
        },
        dispose() {
          source = null;
          sourceListeners.clear();
        },
      },
      palette: {
        current: () => ({ revision: 1, colors: { primary: fill, 'primary-foreground': '#fff' } }),
        subscribe: () => () => {},
      },
      preferences,
    }
  );
  cleanups.push(() => sink.release(1));
  const frame = (revision: number, optical = true): VisualFeedbackFrame => ({
    view: 1,
    revision,
    style: { kind: 'tw', tokens: ['bg-primary', 'text-primary-foreground', 'rounded-lg'] },
    material: {
      slot: {
        version: 2,
        shape: { kind: 'rounded-rect', geometry: 'style' },
        source: { kind: 'in-app-backdrop' },
        fallback: { fill: 'style', foreground: 'style' },
      },
      candidates: optical
        ? [
            {
              intent: 'liquid-glass',
              variant: 'regular',
              ...(tint ? { tint: 'style-fill' as const } : {}),
              deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
            },
          ]
        : [],
    },
  });
  return {
    host,
    sink,
    frame,
    source(value: boolean) {
      source = value ? sourceFrame() : null;
      for (const listener of sourceListeners) listener();
    },
  };
}

beforeEach(() => {
  optical.render.mockReset().mockReturnValue('data:image/png;base64,AA==');
  optical.clear.mockClear();
  decoding.prepare.mockReset().mockImplementation((_doc, _source, ready) => {
    ready();
    return () => {};
  });
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe.each(['#0061cc', '#0a6cdb'])(
  'real material preferences with %s selected palette (event/decode stubs, no GPU claim)',
  (fill) => {
    it('keeps subscriptions through source and opaque round trips and publishes static before rendering', () => {
      const media = mediaHarness();
      const f = fixture(fill);
      f.sink.commit(f.frame(1));
      expect(f.host.dataset.materialMotion).toBe('press');
      expect(media.subscriptions).toBe(10);
      f.source(false);
      expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
      f.source(true);
      f.sink.commit(f.frame(2, false));
      expect(f.host.dataset.materialQuality).toBe('opaque-fallback');
      f.sink.commit(f.frame(3));
      expect(media.subscriptions).toBe(10);
      expect(f.host.dataset.materialMotion).toBe('press');
      const renderObservations: Array<{
        motion: string | undefined;
        pressed: boolean;
        tint: OpticalFrame['tint'];
        strength: number | undefined;
      }> = [];
      optical.render.mockImplementation((frame) => {
        const value = frame as OpticalFrame;
        renderObservations.push({
          motion: f.host.dataset.materialMotion,
          pressed: value.pressed,
          tint: value.tint,
          strength: value.contact?.strength,
        });
        return 'data:image/png;base64,AA==';
      });
      media.set(true);
      // Assertions must be outside the renderer: the sink catches renderer
      // exceptions, and a later MQL notification could otherwise hide a failure.
      expect(renderObservations.length).toBeGreaterThan(0);
      for (const observation of renderObservations)
        expect(observation).toEqual({
          motion: 'static',
          pressed: false,
          tint: 'style-fill',
          strength: 0,
        });
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(f.host.dataset.materialProfile).toBe('pui-regular-style-tint-contact-6');
      optical.render.mockReturnValue('data:image/png;base64,AA==');
      media.set(false);
      expect(f.host.dataset.materialMotion).toBe('press');
      f.sink.release(1);
      expect(media.subscriptions).toBe(0);
    });

    it('rejects a held decode after live MQL changes before event delivery and repaints static immediately', () => {
      const media = mediaHarness();
      const f = fixture(fill);
      const ready: Array<() => void> = [];
      decoding.prepare.mockImplementation((_doc, _source, callback) => {
        ready.push(callback);
        return () => {};
      });
      f.sink.commit(f.frame(1));
      expect(f.host.dataset.materialMotion).toBe('press');
      media.set(true, false);
      ready[0]();
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      expect(f.host.dataset.materialMotion).toBe('static');
      expect(optical.render.mock.calls.at(-1)?.[0]).toMatchObject({
        pressed: false,
        tint: 'style-fill',
        contact: { strength: 0 },
      });
      expect(ready).toHaveLength(2);
      ready[1]();
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(f.host.dataset.materialPhase).toBe('rest');
    });

    it('updates motion while decode is pending and refuses a retired held callback', () => {
      const media = mediaHarness();
      const f = fixture(fill);
      const ready: Array<() => void> = [];
      decoding.prepare.mockImplementation((_doc, _source, callback) => {
        ready.push(callback);
        return () => {};
      });
      f.sink.commit(f.frame(1));
      const held = ready[0];
      media.set(true);
      expect(f.host.dataset.materialMotion).toBe('static');
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      held();
      expect(f.host.dataset.materialMotion).toBe('static');
      expect(f.host.dataset.materialQuality).not.toBe('self-optical');
      ready.at(-1)!();
      expect(f.host.dataset.materialQuality).toBe('self-optical');
      expect(f.host.dataset.materialPhase).toBe('rest');
    });

    it('updates both mixed-profile consumers and removes only the released preferences owner', () => {
      const media = mediaHarness();
      const preferences = createWebMaterialPreferences(window);
      const tinted = fixture(fill, true, preferences);
      const neutral = fixture(fill, false, preferences);
      tinted.sink.commit(tinted.frame(1));
      neutral.sink.commit(neutral.frame(1));
      expect(media.subscriptions).toBe(20);
      media.set(true);
      for (const f of [tinted, neutral]) {
        expect(f.host.dataset.materialMotion).toBe('static');
        expect(f.host.dataset.materialQuality).toBe('self-optical');
        expect(f.host.dataset.materialPhase).toBe('rest');
      }
      expect(tinted.host.dataset.materialProfile).toBe('pui-regular-style-tint-contact-6');
      expect(neutral.host.dataset.materialProfile).not.toBe(tinted.host.dataset.materialProfile);
      tinted.sink.release(1);
      expect(media.subscriptions).toBe(10);
      media.set(false);
      expect(tinted.host.dataset.materialMotion).toBeUndefined();
      expect(neutral.host.dataset.materialMotion).toBe('press');
      neutral.sink.release(1);
      expect(media.subscriptions).toBe(0);
    });
  }
);
