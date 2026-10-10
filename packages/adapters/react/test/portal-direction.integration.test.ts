import { expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { definePrototype } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

it('real React portal preserves the intervening author wrapper, explicit dir and origin disposal', async () => {
  const style = document.createElement('style');
  // UA-equivalent presentation rule missing in happy-dom; native paint is
  // checked separately by the unchanged eight browser journeys.
  style.textContent = '[dir="rtl"]{direction:rtl}[dir="ltr"]{direction:ltr}';
  document.head.append(style);
  const adapt = createReactAdapter({ ...React, createPortal });
  const Owner = adapt(
    definePrototype({ name: 'react-direction-owner', setup: () => (r) => r.slot() })
  );
  const Content = adapt(
    definePrototype({
      name: 'react-direction-content',
      setup() {
        asOverlay().configure({
          defaultOpen: true,
          portal: true,
          entry: 'manual',
          restore: 'none',
        });
        return () => 'Portalled content';
      },
    })
  );
  const host = document.createElement('div');
  host.dir = 'rtl';
  document.body.append(host);
  const root = createRoot(host);
  const render = (direction?: 'ltr' | 'rtl' | 'auto') =>
    root.render(
      React.createElement(
        Owner,
        null,
        React.createElement(
          'section',
          { dir: 'ltr', 'data-direction-author': '' },
          React.createElement(Content, { className: 'portal-direction-target', dir: direction })
        )
      )
    );
  try {
    await act(async () => render());
    await settle();
    const target = document.querySelector<HTMLElement>('.portal-direction-target')!;
    const author = host.querySelector<HTMLElement>('[data-direction-author]')!;
    expect(target.parentElement).toBe(document.body);
    expect(target.dir).toBe('ltr');
    expect(author.querySelector('[data-pui-portal-origin]')).not.toBeNull();
    author.dir = 'rtl';
    await settle();
    expect(target.dir).toBe('rtl');
    await act(async () => render('ltr'));
    await settle();
    expect(target.dir).toBe('ltr');
    author.dir = 'rtl';
    await settle();
    expect(target.dir).toBe('ltr');
    await act(async () => render());
    await settle();
    expect(target.dir).toBe('rtl');
    await act(async () => root.unmount());
    await settle();
    expect(target.isConnected).toBe(false);
    expect(target.getAttribute('dir')).toBe(null);
    expect(host.querySelector('[data-pui-portal-origin]')).toBe(null);
    author.dir = 'ltr';
    await settle();
    expect(target.getAttribute('dir')).toBe(null);
  } finally {
    if (host.firstChild) await act(async () => root.unmount());
    host.remove();
    style.remove();
  }
});
