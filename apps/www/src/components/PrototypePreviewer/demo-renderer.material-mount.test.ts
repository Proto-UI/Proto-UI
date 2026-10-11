import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { VisualFeedbackFrame, VisualFeedbackSink } from '@proto.ui/module-feedback';
import { renderDemo } from './demo-renderer';
import type { DemoSpec } from './demo-types';
import { loadPrototypes } from './prototype-modules';
import { registerPreviewMaterialProvider } from './preview-material-provider';
import { releaseHostMount } from './runtimes/host-mount';

// Only framework acquisition changes. The formal Previewer, installed Vue2,
// Adapter, Liquid Button, provider ancestry lookup and view leases are real.
// The recording sink establishes lifecycle wiring, never optical paint.
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...actual, loadVue2: async () => require('vue') };
});
const cleanups: Array<() => void | Promise<void>> = [];
beforeAll(() => loadPrototypes(['liquid-glass-button']));
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
function scope() {
  const scope = document.createElement('section');
  const host = document.createElement('div');
  scope.append(host);
  document.body.append(scope);
  const allocations: Array<{
    host: HTMLElement;
    frames: VisualFeedbackFrame[];
    release: ReturnType<typeof vi.fn>;
  }> = [];
  const allocate = vi.fn((element: HTMLElement): VisualFeedbackSink => {
    expect(element.isConnected).toBe(true);
    expect(scope.contains(element)).toBe(true);
    const allocation = { host: element, frames: [] as VisualFeedbackFrame[], release: vi.fn() };
    allocations.push(allocation);
    return { commit: (frame) => allocation.frames.push(frame), release: allocation.release };
  });
  cleanups.push(registerPreviewMaterialProvider(scope, allocate));
  return { scope, host, allocate, allocations };
}
function demo(boxed = true): DemoSpec {
  const button = (ref: string) => ({
    kind: 'proto' as const,
    prototypeId: 'liquid-glass-button',
    ref,
    children: [ref],
  });
  return {
    type: 'demo',
    root: boxed ? { kind: 'box', children: [button('one'), button('two')] } : button('one'),
  };
}
describe('Vue2 formal Previewer material mount ancestry', () => {
  it.each([false, true])(
    'acquires each real Button sink at its first connected commit (boxed=%s)',
    async (boxed) => {
      const f = scope();
      const result = await renderDemo({ runtime: 'vue2', host: f.host, demo: demo(boxed) });
      cleanups.push(result.destroy);
      expect(f.allocate).toHaveBeenCalledTimes(boxed ? 2 : 1);
      for (const allocation of f.allocations) {
        expect(allocation.frames.length).toBeGreaterThan(0);
        expect(allocation.frames[0]!.material.slot?.version).toBe(2);
        expect(
          allocation.frames.at(-1)!.material.candidates,
          JSON.stringify(allocation.frames)
        ).not.toHaveLength(0);
        expect(allocation.release).not.toHaveBeenCalled();
      }
      await result.destroy();
      expect(f.host.childNodes).toHaveLength(0);
      for (const allocation of f.allocations) {
        expect(allocation.release).toHaveBeenCalledTimes(1);
        expect(allocation.release).toHaveBeenCalledWith(allocation.frames[0]!.view);
      }
    }
  );
  it('releases old sinks and acquires the new provider after the same host is remounted', async () => {
    const first = scope(),
      next = scope();
    const old = await renderDemo({ runtime: 'vue2', host: first.host, demo: demo() });
    cleanups.push(old.destroy);
    expect(first.allocations).toHaveLength(2);
    await old.destroy();
    next.scope.append(first.host);
    const current = await renderDemo({ runtime: 'vue2', host: first.host, demo: demo() });
    cleanups.push(current.destroy);
    expect(next.allocations).toHaveLength(2);
    expect(first.allocate).toHaveBeenCalledTimes(2);
    await old.destroy();
    expect(first.host.querySelectorAll('[data-pui-root]')).toHaveLength(2);
    for (const allocation of first.allocations) expect(allocation.release).toHaveBeenCalledTimes(1);
    for (const allocation of next.allocations) expect(allocation.release).not.toHaveBeenCalled();
    await current.destroy();
    for (const allocation of next.allocations) expect(allocation.release).toHaveBeenCalledTimes(1);
  });
  it('releases connected sinks when demo setup rejects the mounted generation', async () => {
    const f = scope();
    const failed = demo();
    failed.setup = () => {
      throw new Error('author setup rejected');
    };
    await expect(renderDemo({ runtime: 'vue2', host: f.host, demo: failed })).rejects.toThrow(
      'author setup rejected'
    );
    expect(f.allocations).toHaveLength(2);
    expect(f.host.childNodes).toHaveLength(0);
    for (const allocation of f.allocations) expect(allocation.release).toHaveBeenCalledTimes(1);
  });
  it('does not append a retired root after a provider synchronously replaces the host lease', async () => {
    const f = scope();
    f.allocate.mockImplementationOnce((element) => {
      expect(element.isConnected).toBe(true);
      releaseHostMount(f.host);
      return { commit: vi.fn(), release: vi.fn() };
    });
    const result = await renderDemo({ runtime: 'vue2', host: f.host, demo: demo(false) });
    cleanups.push(result.destroy);
    expect(f.allocate).toHaveBeenCalledTimes(1);
    expect(f.host.childNodes).toHaveLength(0);
  });
});
