import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../src';

const restore: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  while (restore.length) restore.pop()!();
  vi.restoreAllMocks();
});
function geometry(document: Document, width: number) {
  const view = document.defaultView!;
  const root = document.documentElement;
  for (const [key, value] of Object.entries({
    clientWidth: width,
    clientHeight: 800,
    clientLeft: 0,
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    Object.defineProperty(root, key, { configurable: true, value });
    restore.push(() => {
      if (descriptor) Object.defineProperty(root, key, descriptor);
      else Reflect.deleteProperty(root, key);
    });
  }
  const viewport = Object.getOwnPropertyDescriptor(view, 'visualViewport');
  Object.defineProperty(view, 'visualViewport', { configurable: true, value: undefined });
  restore.push(() => {
    if (viewport) Object.defineProperty(view, 'visualViewport', viewport);
    else Reflect.deleteProperty(view, 'visualViewport');
  });
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: 800,
    width,
    height: 800,
    toJSON() {},
  });
  const readStyle = view.getComputedStyle.bind(view);
  vi.spyOn(view, 'getComputedStyle').mockImplementation((element) =>
    element.hasAttribute('data-pui-available-space-probe')
      ? ({
          paddingTop: '0px',
          paddingRight: '0px',
          paddingBottom: '0px',
          paddingLeft: '0px',
        } as CSSStyleDeclaration)
      : readStyle(element)
  );
}

it('adoption refreshes the active available-space lease without an old-document resize', async () => {
  geometry(document, 390);
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const other = iframe.contentDocument!;
  geometry(other, 430);
  let host: HTMLElement & { adoptedCallback(): void };
  const proto = definePrototype({
    name: 'available-space-document-adoption-catalog',
    setup(def) {
      const overlay = asOverlay();
      overlay.configure({ availableSpace: true, defaultOpen: true });
      def.lifecycle.onMounted(() => overlay.registerContent(host));
      def.event.on('host:close', () => overlay.close('programmatic'));
      return (r) => r.el('span', 'Retained overlay');
    },
  });
  AdaptToWebComponent(proto);
  host = document.createElement(proto.name) as typeof host;
  document.body.append(host);
  await flush();
  const key = '--proto-ui-available-region-width';
  expect(host.style.getPropertyValue(key)).toBe('390px');
  expect(document.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(1);
  other.body.append(other.adoptNode(host));
  // happy-dom adopts the DOM node but does not invoke the platform callback.
  // Exercise the actual Adapter callback explicitly; native dispatch is separate evidence.
  host.adoptedCallback();
  await flush();
  expect(host.ownerDocument).toBe(other);
  expect(document.querySelector('[data-pui-available-space-probe]')).toBeNull();
  expect(other.querySelectorAll('[data-pui-available-space-probe]')).toHaveLength(1);
  expect(host.style.getPropertyValue(key)).toBe('430px');
  host.dispatchEvent(new Event('close'));
  await flush();
  expect(other.querySelector('[data-pui-available-space-probe]')).toBeNull();
  expect(host.style.getPropertyValue(key)).toBe('');
  host.adoptedCallback();
  await flush();
  expect(other.querySelector('[data-pui-available-space-probe]')).toBeNull();
  host.remove();
  await flush();
});
