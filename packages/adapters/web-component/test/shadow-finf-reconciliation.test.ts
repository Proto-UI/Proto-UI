import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype, tw, type EffectsPort, type RunHandle } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { installExperimentalVisualConsumer } from '../src/runtime/experimental-visual-consumer';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
let serial = 0;
const shadow = {
  mode: 'open',
  presentation: 'split',
  styleArtifact: renderProtoShadowSplitStyleArtifact(['p-2', 'p-4', 'bg-primary']),
} as const;
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
});

it.each(['null', 'provider'] as const)(
  'keeps split role provenance and one optical lease per view (%s)',
  async (mode) => {
    let run!: RunHandle<any>,
      setups = 0;
    const frames: VisualFeedbackFrame[] = [],
      releases: number[] = [];
    const provider = vi.fn((_host: HTMLElement, effects: EffectsPort) =>
      mode === 'null'
        ? null
        : {
            commit(frame: VisualFeedbackFrame) {
              frames.push(frame);
              effects.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
              effects.requestFlush();
            },
            release(view: number) {
              releases.push(view);
            },
          }
    );
    const C = AdaptToWebComponent(
      definePrototype({
        name: `wc-split-finf-${++serial}`,
        setup(def) {
          setups++;
          def.feedback.style.use(tw('p-2 bg-primary'));
          def.expose.method('present', (value: boolean) => run.lifecycle.setPresent(value));
          def.lifecycle.onCreated((value) => {
            run = value;
          });
          return (r) => r.el('span', {}, 'view');
        },
      }),
      { shadow, createVisualSink: provider }
    );
    const host = new C();
    document.body.append(host);
    await flush();
    const surface = host.shadowRoot!.querySelector('[part="surface"]')!;
    const stylesheet = host.shadowRoot!.querySelector('style');
    expect(surface.getAttribute('data-pui-style')).toContain('bg-primary');
    expect(host.getAttribute('data-pui-split-root-style')).toContain('p-2');
    expect(host.getAttribute('data-pui-style')).toBeNull();
    (host.getExposes() as { present(value: boolean): void }).present(false);
    await flush();
    expect(surface.isConnected).toBe(true);
    expect(surface.childNodes.length).toBe(0);
    expect(host.getAttribute('data-pui-split-root-style')).toBeNull();
    (host.getExposes() as { present(value: boolean): void }).present(true);
    await flush();
    expect(setups).toBe(1);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(host.shadowRoot!.querySelector('[part="surface"]')).toBe(surface);
    expect(host.shadowRoot!.querySelector('style')).toBe(stylesheet);
    expect(surface.textContent).toBe('view');
    if (mode === 'provider') {
      expect(releases).toHaveLength(1);
      expect(frames.every((frame) => 'entries' in frame.style)).toBe(true);
      expect(frames.at(-1)!.view).toBeGreaterThan(frames[0]!.view);
    }
    host.remove();
    await flush();
    expect(host.shadowRoot!.childNodes).toHaveLength(0);
  }
);

it('routes the private final optical sink through split effects without losing its owned node on commits', async () => {
  let run!: RunHandle<any>;
  const proto = definePrototype({
    name: `wc-split-finf-final-${++serial}`,
    setup(def) {
      def.feedback.style.use(tw('p-2 bg-primary'));
      def.expose.method('present', (value: boolean) => run.lifecycle.setPresent(value));
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      return (r) => r.slot();
    },
  });
  const canvases: HTMLCanvasElement[] = [];
  const uninstall = installExperimentalVisualConsumer(proto, (host, style, surface) => {
    const canvas = host.ownerDocument.createElement('canvas');
    canvases.push(canvas);
    return {
      commit(frame) {
        style.apply([...frame.style.tokens]);
        surface.mount(canvas);
      },
      release() {
        style.clear();
        surface.release(canvas);
      },
    };
  });
  try {
    const C = AdaptToWebComponent(proto, { shadow });
    const host = new C();
    host.textContent = 'consumer';
    document.body.append(host);
    await flush();
    const presentation = host.shadowRoot!.querySelector('[part="surface"]')!;
    const slot = presentation.querySelector('slot');
    expect(presentation.getAttribute('data-pui-style')).toContain('bg-primary');
    expect(host.getAttribute('data-pui-split-root-style')).toContain('p-2');
    expect(host.getAttribute('data-pui-style')).toBeNull();
    expect(canvases[0].parentNode).toBe(host.shadowRoot);
    host.update();
    await flush();
    expect(presentation.querySelector('slot')).toBe(slot);
    expect(canvases[0].parentNode).toBe(host.shadowRoot);
    (host.getExposes() as { present(value: boolean): void }).present(false);
    await flush();
    expect(canvases[0].isConnected).toBe(false);
    (host.getExposes() as { present(value: boolean): void }).present(true);
    await flush();
    expect(canvases).toHaveLength(2);
    expect(canvases[1].parentNode).toBe(host.shadowRoot);
    host.remove();
    await flush();
    expect(host.shadowRoot!.childNodes).toHaveLength(0);
  } finally {
    uninstall();
  }
});

it('finishes a split optical teardown after a throwing release reconnects the same shell', async () => {
  let host!: HTMLElement & {
    _instanceToken: unknown;
    _controller: unknown;
    _splitResources: unknown;
  };
  let setups = 0,
    providers = 0,
    releases = 0;
  const failure = new Error('split optical release');
  const errors: unknown[] = [];
  const queue = globalThis.queueMicrotask.bind(globalThis);
  const microtasks = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) =>
    queue(() => {
      try {
        const result = (callback as () => unknown)();
        if (result instanceof Promise) result.catch((error) => errors.push(error));
      } catch (error) {
        errors.push(error);
      }
    })
  );
  const C = AdaptToWebComponent(
    definePrototype({
      name: `wc-split-finf-release-${++serial}`,
      setup(def) {
        setups++;
        def.feedback.style.use(tw('p-2 bg-primary'));
        return (r) => r.el('span', {}, 'fresh view');
      },
    }),
    {
      shadow,
      createVisualSink(_host, effects) {
        const provider = ++providers;
        return {
          commit(frame) {
            effects.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
            effects.requestFlush();
          },
          release() {
            releases++;
            if (provider === 1) {
              document.body.append(host);
              throw failure;
            }
          },
        };
      },
    }
  );
  host = new C() as unknown as typeof host;
  try {
    document.body.append(host);
    await flush();
    const token = host._instanceToken,
      controller = host._controller;
    const resources = host._splitResources;
    const oldSurface = host.shadowRoot!.querySelector('[part="surface"]')!;
    host.remove();
    await flush();
    expect(errors).toEqual([failure]);
    expect({ setups, providers, releases }).toEqual({ setups: 2, providers: 2, releases: 1 });
    expect(host._instanceToken).not.toBe(token);
    expect(host._controller).not.toBe(controller);
    expect(host._splitResources).not.toBe(resources);
    expect(oldSurface.isConnected).toBe(false);
    expect(host.shadowRoot!.querySelectorAll('style')).toHaveLength(1);
    expect(host.shadowRoot!.querySelector('[part="surface"]')!.textContent).toBe('fresh view');
    host.remove();
    await flush();
    expect(releases).toBe(2);
    expect(host._controller).toBeNull();
    expect(host._splitResources).toBeNull();
    expect(host.shadowRoot!.childNodes).toHaveLength(0);
    expect(errors).toEqual([failure]);
  } finally {
    host.remove();
    await flush();
    microtasks.mockRestore();
  }
});
