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
