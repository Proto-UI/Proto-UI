import { AdaptToWebComponent } from '../src';
import {
  exposeStateWebAdapterConformance,
  type ExposeStateWebTree,
} from '../../base/test/fixtures/expose-state-web-conformance';

exposeStateWebAdapterConformance('wc', async (tree, options) => {
  const host = document.createElement('div');
  const render = (node: ExposeStateWebTree): HTMLElement => {
    if (!customElements.get(node.proto.name)) AdaptToWebComponent(node.proto, options);
    const el = document.createElement(node.proto.name);
    el.className = 'user-esw-class';
    el.append(...(node.children ?? []).map(render));
    return el;
  };
  host.append(...tree.map(render));
  document.body.append(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    flush,
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});

// C-HOST-SURFACE-PROJECTION-0001-G: selector context is presentation-only.
import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { declareTextControl } from '@proto.ui/module-text-control';
it('T-EXPOSE-STATE-WEB-0001-CASE-SURFACE: mirrors current state to a physical textarea without copying boundary identity', async () => {
  const proto = definePrototype({
    name: 'esw-wc-split-surface',
    modules: [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })],
    setup(def) {
      const selected = def.state.bool('selected', false);
      const count = def.state.numberDiscrete('count', 1);
      def.expose.state('selected', selected);
      def.expose.state('count', count);
      def.event.on('press.commit', () => {
        selected.set(!selected.get());
        count.set(count.get() + 1);
      });
      return () => null;
    },
  });
  AdaptToWebComponent(proto);
  const host = document.createElement(proto.name);
  document.body.append(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  try {
    await flush();
    const surface = host.querySelector('textarea')!;
    expect(surface).not.toBeNull();
    expect(surface.hasAttribute('data-pui-root')).toBe(false);
    for (const el of [host, surface]) {
      expect(el.hasAttribute('data-selected')).toBe(false);
      expect(el.style.getPropertyValue('--pui-count')).toBe('1');
    }
    surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    for (const el of [host, surface]) {
      expect(el.getAttribute('data-selected')).toBe('');
      expect(el.style.getPropertyValue('--pui-count')).toBe('2');
      expect(el.hasAttribute('aria-selected')).toBe(false);
    }
    expect(host.hasAttribute('data-pui-root')).toBe(true);
    expect(surface.hasAttribute('data-pui-root')).toBe(false);
  } finally {
    host.remove();
    await flush();
  }
});
