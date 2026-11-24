import * as React from 'react';
import { act } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it.each(['main-document', 'iframe-document'] as const)(
  'commits authored children once into their actual %s portal epoch',
  async (mode) => {
    const frame = mode === 'iframe-document' ? document.createElement('iframe') : null;
    if (frame) document.body.append(frame);
    const doc = frame?.contentDocument ?? document;
    const home = doc.createElement('div');
    doc.body.append(home);
    const root = createRoot(home);
    const counts = { mounted: 0, released: 0, clicked: 0 };
    const hosts: HTMLElement[] = [];
    const bindChild = (node: HTMLButtonElement | null) => {
      if (node) hosts.push(node);
    };
    function Child({ label }: { label: string }) {
      React.useLayoutEffect(() => {
        counts.mounted++;
        return () => {
          counts.released++;
        };
      }, []);
      return React.createElement(
        'button',
        {
          ref: bindChild,
          onClick: () => {
            counts.clicked++;
          },
        },
        label
      );
    }
    const Content = createReactAdapter({ ...React, createPortal })(
      definePrototype({
        name: 'portal-first-content-identity',
        setup() {
          asOverlay().configure({
            defaultOpen: true,
            portal: true,
            entry: 'manual',
            restore: 'none',
          });
          return (render) => render.slot();
        },
      })
    );
    try {
      await act(async () =>
        root.render(
          React.createElement(Content, null, React.createElement(Child, { label: 'Before update' }))
        )
      );
      const child = doc.querySelector<HTMLButtonElement>('[data-pui-portal-mount] button');
      expect(child).not.toBeNull();
      expect(child!.ownerDocument).toBe(doc);
      expect(home.querySelector('button')).toBeNull();
      expect(new Set(hosts)).toEqual(new Set([child]));
      expect(counts).toEqual({ mounted: 1, released: 0, clicked: 0 });
      await act(async () => child!.click());
      await act(async () =>
        root.render(
          React.createElement(Content, null, React.createElement(Child, { label: 'After update' }))
        )
      );
      expect(doc.querySelector('[data-pui-portal-mount] button')).toBe(child);
      expect(child!.textContent).toBe('After update');
      expect(new Set(hosts)).toEqual(new Set([child]));
      expect(counts).toEqual({ mounted: 1, released: 0, clicked: 1 });
    } finally {
      await act(async () => root.unmount());
      home.remove();
      frame?.remove();
    }
    expect(counts.released).toBe(1);
  }
);
