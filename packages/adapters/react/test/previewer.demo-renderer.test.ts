import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { registerPrototype } from '../../../../apps/www/src/components/PrototypePreviewer/registry';

const reactRoot = {
  render: vi.fn(),
  unmount: vi.fn(),
};

const flushSync = vi.fn((callback: () => unknown) => callback());

const loadReact = vi.fn(async () => ({
  React: {
    useState: <T>(init: T) => [init, vi.fn()] as [T, (next: T) => void],
    useRef: <T>(init: T) => ({ current: init }),
    useEffect: vi.fn(),
    useLayoutEffect: vi.fn(),
    useImperativeHandle: vi.fn(),
    forwardRef: (render: any) => {
      const component = (props: any, ref: any) => render(props, ref);
      component.__forwardRefRender = render;
      return component;
    },
    createElement: (type: any, props?: any, ...children: any[]) => ({
      type,
      props: {
        ...(props ?? {}),
        ...(children.length === 0
          ? {}
          : {
              children: children.length === 1 ? children[0] : children,
            }),
      },
      children,
    }),
  },
  ReactDOM: {
    createRoot: vi.fn(() => reactRoot),
    createPortal: vi.fn((children: any) => children),
    flushSync,
  },
}));

vi.mock('../../../../apps/www/src/components/PrototypePreviewer/runtimes/react-runtime', () => ({
  loadReact,
}));

describe('PrototypePreviewer demo-renderer / react', () => {
  beforeEach(() => {
    reactRoot.render.mockReset();
    reactRoot.unmount.mockReset();
    flushSync.mockClear();
  });

  it('passes surfaceClassName and props into React adapter tree', async () => {
    const proto = definePrototype({
      name: 'previewer-react-inline',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        return (r) => [r.el('div', String(r.read.props.get().label))];
      },
    });

    registerPrototype('previewer-react-inline', proto as any);

    const { renderDemo } =
      await import('../../../../apps/www/src/components/PrototypePreviewer/demo-renderer');

    const host = document.createElement('div');
    document.body.appendChild(host);

    const session = await renderDemo({
      runtime: 'react',
      host,
      demo: {
        type: 'demo',
        root: {
          kind: 'proto',
          prototypeId: 'previewer-react-inline',
          className: 'rounded bg-red-500',
          props: { label: 'Second' },
          children: ['Hello'],
        },
      },
    });

    expect(loadReact).toHaveBeenCalledTimes(1);
    expect(reactRoot.render).toHaveBeenCalledTimes(1);
    expect(flushSync).toHaveBeenCalledTimes(1);

    const tree = reactRoot.render.mock.calls[0]?.[0] as any;
    expect(typeof tree.type).toBe('function');
    expect(tree.props.surfaceClassName).toBe('rounded bg-red-500');
    expect(tree.props.label).toBe('Second');
    expect(tree.props.children).toBe('Hello');

    await session.destroy();

    expect(reactRoot.unmount).toHaveBeenCalledTimes(1);
    host.remove();
  }, 15000);
});
