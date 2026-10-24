import { AdaptToWebComponent, setElementProps } from '../src';
import { describeViewportWidthIntegration } from '../../base/test-utils/viewport-width';

describeViewportWidthIntegration('wc', async (proto, options) => {
  AdaptToWebComponent(proto, options);
  const host = document.createElement('div');
  const element = document.createElement(proto.name) as HTMLElement & {
    update(): void;
    getExposes(): { view: { show(): void; hide(): void } };
  };
  host.append(element);
  document.body.append(host);
  const settle = async (action: () => void) => {
    action();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    act: settle,
    setProps: (props, concurrent) =>
      settle(() => {
        setElementProps(element, props);
        concurrent?.();
      }),
    setPresent: (present) => settle(() => element.getExposes().view[present ? 'show' : 'hide']()),
    update: () => settle(() => element.update()),
    unmount: () => settle(() => host.remove()),
  };
});

import { expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
it('rebinds viewport width to adopted Document and leaves the old realm inert', async () => {
  const old = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 767 });
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const other = frame.contentDocument!;
  Object.defineProperty(other.defaultView!, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 900,
  });
  const proto = definePrototype({
    name: 'viewport-width-adopted-document',
    setup(def) {
      def.feedback.style.use(tw('text-base'));
      def.rule({
        when: (w) => w.meta('viewport.width').gte(768),
        intent: (i) => i.feedback.style.use(tw('text-sm')),
      });
      return (r) => r.el('span', 'retained');
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name) as HTMLElement & { adoptedCallback(): void };
  const flush = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  try {
    document.body.append(host);
    await flush();
    expect(host.getAttribute('data-pui-style')).toContain('text-base');
    other.body.append(other.adoptNode(host));
    // happy-dom does not dispatch native adoption; invoke the real Adapter callback.
    host.adoptedCallback();
    await flush();
    expect(host.getAttribute('data-pui-style')).toContain('text-sm');
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 300 });
    window.dispatchEvent(new Event('resize'));
    await flush();
    expect(host.getAttribute('data-pui-style')).toContain('text-sm');
    Object.defineProperty(other.defaultView!, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 700,
    });
    other.defaultView!.dispatchEvent(new other.defaultView!.Event('resize'));
    await flush();
    expect(host.getAttribute('data-pui-style')).toContain('text-base');
  } finally {
    host.remove();
    frame.remove();
    await flush();
    if (old) Object.defineProperty(window, 'innerWidth', old);
  }
});
