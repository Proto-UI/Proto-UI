import { afterEach, expect, it, vi } from 'vitest';
import { observeRootSpace } from '../src/web/root-space-observer';
import { createWebAvailableSpaceHost } from '../src/web/available-space-host';
let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const stop of cleanup.splice(0).reverse()) stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture() {
  const root = document.documentElement,
    view = document.defaultView!;
  let width = 390,
    left = 0;
  const saved = ['clientWidth', 'clientLeft'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(root, key)] as const
  );
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(root, 'clientLeft', { configurable: true, get: () => left });
  const instances: {
    fire(): void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const original = Object.getOwnPropertyDescriptor(view, 'ResizeObserver');
  class Resize {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: () => void) {
      instances.push({ fire: callback, observe: this.observe, disconnect: this.disconnect });
    }
  }
  Object.defineProperty(view, 'ResizeObserver', { configurable: true, value: Resize });
  cleanup.push(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(root, key, descriptor);
      else Reflect.deleteProperty(root, key);
    }
    if (original) Object.defineProperty(view, 'ResizeObserver', original);
    else Reflect.deleteProperty(view, 'ResizeObserver');
  });
  return {
    root,
    instances,
    resize: (next: number) => {
      width = next;
      instances.forEach((i) => i.fire());
    },
    origin: (next: number) => {
      left = next;
    },
  };
}
it('shares one root observer, reports changed space only and ends after the last lease', () => {
  const f = fixture(),
    a = vi.fn(),
    b = vi.fn();
  const stopA = observeRootSpace(document, a),
    stopB = observeRootSpace(document, b);
  cleanup.push(stopA, stopB);
  expect(f.instances).toHaveLength(1);
  expect(f.instances[0].observe).toHaveBeenCalledWith(f.root);
  f.resize(390);
  expect(a).not.toHaveBeenCalled();
  f.resize(375);
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(1);
  stopA();
  stopA();
  f.resize(390);
  expect(a).toHaveBeenCalledTimes(1);
  expect(b).toHaveBeenCalledTimes(2);
  stopB();
  expect(f.instances[0].disconnect).toHaveBeenCalledTimes(1);
  f.resize(430);
  expect(b).toHaveBeenCalledTimes(2);
});
it('observes origin-only changes on the root without a perpetual frame loop', async () => {
  const f = fixture(),
    update = vi.fn(),
    old = f.root.getAttribute('dir');
  const stop = observeRootSpace(document, update);
  cleanup.push(stop, () => {
    if (old === null) f.root.removeAttribute('dir');
    else f.root.setAttribute('dir', old);
  });
  f.origin(15);
  f.root.setAttribute('dir', 'rtl');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(update).toHaveBeenCalledTimes(1);
  f.root.setAttribute('dir', 'ltr');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(update).toHaveBeenCalledTimes(1);
});
it('does not deliver an obsolete callback removed during another root listener', () => {
  const f = fixture(),
    b = vi.fn();
  let stopB = () => {};
  const stopA = observeRootSpace(document, () => stopB());
  stopB = observeRootSpace(document, b);
  cleanup.push(stopA, stopB);
  f.resize(375);
  expect(b).not.toHaveBeenCalled();
});
it('feeds root changes into active available-space frames and releases them on close', () => {
  const f = fixture(),
    target = document.createElement('div');
  document.body.append(target);
  const lease = createWebAvailableSpaceHost({
    readRegion: () => ({ x: f.root.clientLeft, y: 0, width: f.root.clientWidth, height: 900 }),
  }).attach({ target, boundary: 'root-content', viewEpoch: 1 });
  cleanup.push(() => lease.dispose());
  expect(target.style.getPropertyValue('--proto-ui-available-region-width')).toBe('390px');
  f.resize(375);
  expect(target.style.getPropertyValue('--proto-ui-available-region-width')).toBe('375px');
  lease.dispose();
  f.resize(430);
  expect(target.style.getPropertyValue('--proto-ui-available-region-width')).toBe('');
  expect(f.instances[0].disconnect).toHaveBeenCalledTimes(1);
});

it('delivers a root change to other live owners before surfacing a subscriber failure', () => {
  const f = fixture(),
    failure = new Error('consumer update failed'),
    second = vi.fn();
  const a = observeRootSpace(document, () => {
      throw failure;
    }),
    b = observeRootSpace(document, second);
  cleanup.push(a, b);
  expect(() => f.resize(375)).toThrow(failure);
  expect(second).toHaveBeenCalledTimes(1);
  a();
  f.resize(390);
  expect(second).toHaveBeenCalledTimes(2);
});
