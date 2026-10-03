import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DemoSpec } from './demo-types';
const react = vi.hoisted(() => ({
  createAdapter: vi.fn(),
  load: vi.fn(),
}));

vi.mock('@proto.ui/adapter-react', () => ({ createReactAdapter: react.createAdapter }));
vi.mock('./runtimes/react-runtime', () => ({ loadReact: react.load }));

vi.mock('./registry', () => ({ getPrototype: () => ({}) }));
vi.mock('./wc-registry', () => ({ ensurePreviewWcRegistered: () => 'pui-cleanup-test' }));

import { renderDemo } from './demo-renderer';

const demo = (cleanup: () => void): DemoSpec => ({
  type: 'demo',
  setup: () => cleanup,
  root: {
    kind: 'box',
    children: [
      { kind: 'proto', prototypeId: 'cleanup-test', children: ['First'] },
      { kind: 'proto', prototypeId: 'cleanup-test', children: ['Second'] },
    ],
  },
});

beforeEach(() => {
  react.createAdapter.mockReset();
  react.load.mockReset();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Previewer demo renderer cleanup', () => {
  it('disconnects rendered instances after composition cleanup throws', async () => {
    const failure = new Error('composition cleanup failed');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const rendered = await renderDemo({
      runtime: 'wc',
      demo: demo(() => {
        throw failure;
      }),
      host,
    });
    const [first, second] = Array.from(host.querySelectorAll<HTMLElement>('pui-cleanup-test'));
    const firstRemove = vi.spyOn(first!, 'remove');
    const secondRemove = vi.spyOn(second!, 'remove').mockImplementation(() => {
      throw new Error('instance disconnect also failed');
    });

    expect(() => rendered.destroy()).toThrow(failure);
    expect(secondRemove).toHaveBeenCalledTimes(1);
    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(host.childNodes).toHaveLength(0);
  });

  it('normalizes string and mixed styles before rendering React surfaces', async () => {
    const render = vi.fn();
    const unmount = vi.fn();
    const React = {
      createElement: vi.fn((type: unknown, props: unknown, ...children: unknown[]) => ({
        type,
        props,
        children,
      })),
    };
    const ReactDOM = {
      createPortal: vi.fn(),
      createRoot: vi.fn(() => ({ render, unmount })),
    };
    react.load.mockResolvedValue({ React, ReactDOM });
    react.createAdapter.mockReturnValue(function ProjectedSurface() {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const host = document.createElement('div');
    document.body.appendChild(host);

    const rendered = await renderDemo({
      runtime: 'react',
      host,
      demo: {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'react-style-test',
          surfaceStyle: [
            'color: red; background-color: black; float: left;',
            { color: 'blue', '--pui-background': '#090909' },
          ],
        },
      },
    });

    expect(render).toHaveBeenCalledTimes(1);
    const tree = render.mock.calls[0]![0] as { props: { surfaceStyle: unknown } };
    expect(tree.props.surfaceStyle).toEqual({
      color: 'blue',
      backgroundColor: 'black',
      cssFloat: 'left',
      '--pui-background': '#090909',
    });

    rendered.destroy();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});

// The doubles below hold owner effects until the renderer's commit boundary.
// The Search suite separately exercises real React + Proto Button activation.
describe('React demo props commit and deferred refresh ownership', () => {
  async function mountPropsHarness(synchronousCommit: boolean) {
    const host = document.createElement('div');
    const button = document.createElement('div');
    document.body.appendChild(host);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    let captureFrames = false;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++nextFrame;
      if (captureFrames) frames.set(id, callback);
      else queueMicrotask(() => callback(0));
      return id;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    const effects: Array<() => void> = [];
    let currentProps: Record<string, unknown> = {};
    const update = vi.fn(() => {
      button.removeAttribute('role');
      effects.push(() => {
        button.setAttribute('role', 'button');
        button.setAttribute('aria-disabled', String(currentProps.disabled));
      });
    });
    const unmount = vi.fn(() => button.remove());
    const render = vi.fn((tree: { props: Record<string, unknown> }) => {
      currentProps = tree.props;
      (currentProps.ref as (instance: { update(): void }) => void)({ update });
      host.append(button);
    });
    react.createAdapter.mockReturnValue(function DeferredButton() {});
    react.load.mockResolvedValue({
      React: {
        createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
          type,
          props,
          children,
        }),
      },
      ReactDOM: {
        createRoot: () => ({ render, unmount }),
        ...(synchronousCommit
          ? {
              flushSync(callback: () => unknown) {
                const result = callback();
                for (const effect of effects.splice(0)) effect();
                return result;
              },
            }
          : {}),
      },
    });
    let api!: import('./demo-types').DemoRuntimeApi;
    const rendered = await renderDemo({
      runtime: 'react',
      host,
      demo: {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'deferred-button',
          ref: 'button',
          props: { disabled: true },
        },
        setup(context) {
          api = context.api;
        },
      },
    });
    captureFrames = true;
    return { host, button, frames, update, render, cancel, rendered, api };
  }

  it('commits owner effects before setProps returns without reopening an asynchronous refresh gap', async () => {
    const h = await mountPropsHarness(true);
    try {
      h.api.setProps('button', { disabled: false });
      expect(h.button.getAttribute('role')).toBe('button');
      expect(h.button.getAttribute('aria-disabled')).toBe('false');
      expect(h.frames.size).toBe(0);
      h.api.setProps('button', { disabled: true });
      expect(h.button.getAttribute('aria-disabled')).toBe('true');
      expect(h.frames.size).toBe(0);
    } finally {
      h.rendered.destroy();
    }
  });

  it('cancels fallback refresh and rejects stale props after destroying the owner', async () => {
    const h = await mountPropsHarness(false);
    h.api.setProps('button', { disabled: false });
    expect(h.frames.size).toBe(1);
    const [frame, lateDelivery] = [...h.frames.entries()][0]!;
    h.rendered.destroy();
    expect(h.cancel).toHaveBeenCalledWith(frame);
    expect(h.frames.size).toBe(0);
    h.update.mockClear();
    h.render.mockClear();
    // Model a callback already dequeued when cancellation occurs.
    lateDelivery(0);
    h.api.setProps('button', { disabled: true });
    expect(h.update).not.toHaveBeenCalled();
    expect(h.render).not.toHaveBeenCalled();
    expect(h.host.childNodes).toHaveLength(0);
  });

  it('does not refresh an old owner after another renderer claims its host', async () => {
    const h = await mountPropsHarness(false);
    h.api.setProps('button', { disabled: false });
    const lateDelivery = [...h.frames.values()][0]!;
    const replacement = await renderDemo({
      runtime: 'wc',
      host: h.host,
      demo: { type: 'demo', root: { kind: 'box', children: ['Current generation'] } },
    });
    try {
      h.update.mockClear();
      h.render.mockClear();
      lateDelivery(0);
      h.api.setProps('button', { disabled: true });
      expect(h.update).not.toHaveBeenCalled();
      expect(h.render).not.toHaveBeenCalled();
      expect(h.host.textContent).toBe('Current generation');
      expect(h.frames.size).toBe(0);
    } finally {
      replacement.destroy();
    }
  });
});
