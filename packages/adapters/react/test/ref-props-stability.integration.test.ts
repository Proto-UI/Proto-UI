import * as React from 'react';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';

import { createReactAdapter } from '../src';

const mountedRoots: Array<{ unmount(): void }> = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.replaceChildren();
});

describe('adapter-react: ref props stability', () => {
  it('does not treat React 19 forwardRef props cloning as a raw-props update loop', async () => {
    const proto = definePrototype<{ tone?: 'base' | 'accent' }>({
      name: 'react-ref-props-stability',
      setup(def) {
        def.props.define({
          tone: { type: 'enum', options: ['base', 'accent'] },
        });
        def.props.setDefaults({ tone: 'base' });
        def.feedback.style.use(tw('base-token'));
        def.rule({
          when: (w) => w.prop('tone').eq('accent'),
          intent: (i) => i.feedback.style.use(tw('accent-token')),
        });
        return (renderer) => renderer.r.slot();
      },
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    const Component = createReactAdapter(React)(proto);
    const ref = React.createRef<React.ComponentRef<typeof Component>>();

    await act(async () => {
      root.render(React.createElement(Component, { ref, tone: 'base' }, 'content'));
      await Promise.resolve();
    });

    const element = host.querySelector<HTMLElement>('[data-pui-root]');
    expect(ref.current?.getExposes).toBeTypeOf('function');
    expect(element?.getAttribute('data-pui-style')).toContain('base-token');

    await act(async () => {
      root.render(React.createElement(Component, { ref, tone: 'accent' }, 'content'));
      await Promise.resolve();
    });

    expect(element?.getAttribute('data-pui-style')).toContain('accent-token');
  });

  it('keeps one imperative handle identity for a fresh consumer callback ref', async () => {
    const proto = definePrototype<{ tone?: 'base' | 'accent' }>({
      name: 'react-ref-handle-identity',
      setup(def) {
        def.props.define({
          tone: { type: 'enum', options: ['base', 'accent'] },
        });
        def.props.setDefaults({ tone: 'base' });
        def.feedback.style.use(tw('base-token'));
        def.rule({
          when: (w) => w.prop('tone').eq('accent'),
          intent: (i) => i.feedback.style.use(tw('accent-token')),
        });
        return (renderer) => renderer.r.slot();
      },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    const Component = createReactAdapter(React)(proto);
    type Handle = React.ComponentRef<typeof Component>;
    const delivered: Array<Handle | null> = [];
    const render = async (tone: 'base' | 'accent') => {
      await act(async () => {
        root.render(
          React.createElement(
            Component,
            {
              tone,
              ref: (handle: Handle | null) => {
                delivered.push(handle);
              },
            },
            'content'
          )
        );
        await Promise.resolve();
      });
    };

    await render('base');
    const first = delivered.filter((handle): handle is Handle => handle !== null);
    expect(first).toHaveLength(1);
    expect(first[0].getExposes).toBeTypeOf('function');

    await render('accent');
    const second = delivered.filter((handle): handle is Handle => handle !== null);
    // The current callback ref still receives the handle after the commit.
    expect(second).toHaveLength(2);
    // One public handle identity survives the commit: consumers reserve real
    // instance identity (for example the shadcn InputShell binding lifetime).
    expect(second[1]).toBe(second[0]);
    expect(second[1].getExposes).toBeTypeOf('function');
    // The surviving handle still drives the live view instead of a snapshot.
    await act(async () => {
      second[1].update();
      await Promise.resolve();
    });
    expect(host.querySelector('[data-pui-root]')?.getAttribute('data-pui-style')).toContain(
      'accent-token'
    );
  });

  it('keeps one imperative handle identity across the StrictMode effect replay', async () => {
    const proto = definePrototype({
      name: 'react-strict-handle-identity',
      setup(def) {
        def.feedback.style.use(tw('base-token'));
        return (renderer) => renderer.r.slot();
      },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    const Component = createReactAdapter(React)(proto);
    type Handle = React.ComponentRef<typeof Component>;
    const delivered: Array<Handle | null> = [];

    await act(async () => {
      root.render(
        React.createElement(
          StrictMode,
          null,
          React.createElement(
            Component,
            {
              ref: (handle: Handle | null) => {
                delivered.push(handle);
              },
            },
            'content'
          )
        )
      );
      await Promise.resolve();
    });

    const handles = delivered.filter((handle): handle is Handle => handle !== null);
    expect(handles.length).toBeGreaterThan(0);
    expect(handles.every((handle) => handle === handles[0])).toBe(true);
  });
});
