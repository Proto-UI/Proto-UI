import { afterEach, describe, expect, it } from 'vitest';
import { installHeaderSizeReadProbe } from './header-size-read-probe';

declare global {
  interface Window {
    __headerSizeReadProbe?: ReturnType<typeof installHeaderSizeReadProbe>;
  }
}
let current: ReturnType<typeof installHeaderSizeReadProbe> | undefined;
afterEach(() => {
  current?.finish();
  current = undefined;
  delete window.__headerSizeReadProbe;
  document.body.replaceChildren();
});
const row = () => {
  const element = document.createElement('div');
  element.dataset.projectionOwner = 'homepage-home-preferences';
  element.dataset.projectionPrototype = 'shadcn-select-item';
  document.body.append(element);
  return element;
};
const finish = () => {
  if (!current) throw new Error('Probe fixture not installed');
  const result = current.finish();
  current = undefined;
  return result;
};

describe('temporary Header read-probe non-interference controls', () => {
  it('keeps ordinary native return values, attributes and styles unchanged and restores descriptors', () => {
    const node = row();
    node.style.width = '192px';
    const before = [
      node.offsetWidth,
      node.offsetHeight,
      node.getAttribute('style'),
      node.getAttribute('data-pui-style'),
    ];
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const setter = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'setProperty');
    current = installHeaderSizeReadProbe();
    expect([
      node.offsetWidth,
      node.offsetHeight,
      node.getAttribute('style'),
      node.getAttribute('data-pui-style'),
    ]).toEqual(before);
    const result = finish();
    expect(result.overflow).toBe(false);
    expect(result.probeErrors).toEqual([]);
    expect(result.restored.every(Boolean)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')).toEqual(offset);
    expect(Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'setProperty')).toEqual(
      setter
    );
  });

  it('does not replace a successful native getter or setter when observation throws', () => {
    const node = row();
    const expected = node.offsetWidth;
    const getAttribute = node.getAttribute;
    current = installHeaderSizeReadProbe();
    let coercions = 0;
    const hostileObservationError = {
      toString() {
        coercions++;
        throw new Error('must not coerce');
      },
    };
    node.getAttribute = () => {
      throw hostileObservationError;
    };
    expect(node.offsetWidth).toBe(expected);
    expect(node.style.setProperty('width', '211px')).toBeUndefined();
    expect(node.style.width).toBe('211px');
    expect(coercions).toBe(0);
    node.getAttribute = getAttribute;
    const result = finish();
    expect(result.probeErrors.length).toBeGreaterThan(0);
    expect(result.restored.every(Boolean)).toBe(true);
  });

  it('preserves the original native exception and does not swallow it as an observation failure', () => {
    const holder = HTMLElement.prototype;
    const original = Object.getOwnPropertyDescriptor(holder, 'offsetWidth');
    if (!original?.configurable) throw new Error('Fixture requires configurable offsetWidth');
    const setterHolder = CSSStyleDeclaration.prototype;
    const originalSetter = Object.getOwnPropertyDescriptor(setterHolder, 'setProperty');
    if (!originalSetter?.configurable) throw new Error('Fixture requires configurable setProperty');
    const sentinel = new Error('native sentinel');
    const setterSentinel = new Error('native setter sentinel');
    Object.defineProperty(holder, 'offsetWidth', {
      ...original,
      get() {
        throw sentinel;
      },
    });
    Object.defineProperty(setterHolder, 'setProperty', {
      ...originalSetter,
      value() {
        throw setterSentinel;
      },
    });
    try {
      const node = row();
      current = installHeaderSizeReadProbe();
      let caught: unknown;
      try {
        void node.offsetWidth;
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(sentinel);
      let setterCaught: unknown;
      try {
        node.style.setProperty('width', '192px');
      } catch (error) {
        setterCaught = error;
      }
      expect(setterCaught).toBe(setterSentinel);
      const result = finish();
      expect(result.restored.every(Boolean)).toBe(true);
    } finally {
      Object.defineProperty(holder, 'offsetWidth', original);
      Object.defineProperty(setterHolder, 'setProperty', originalSetter);
    }
  });

  it('restores wrappers even when final geometry observation fails', () => {
    const node = row();
    current = installHeaderSizeReadProbe();
    node.getAttribute = () => {
      throw new Error('final facts unavailable');
    };
    const result = finish();
    expect(result.probeErrors.length).toBeGreaterThan(0);
    expect(result.restored.every(Boolean)).toBe(true);
  });

  it('records bounded ordered geometry-owner reads without claiming a synthetic lease identity', () => {
    const node = row();
    current = installHeaderSizeReadProbe();
    current.phase('test-owner-read');
    const owner = {
      ['target-alignment-host']() {
        return node.offsetWidth;
      },
    };
    const before = node.offsetWidth;
    expect(owner['target-alignment-host']()).toBe(before);
    const result = finish();
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.map((entry) => entry.sequence)).toEqual(
      result.rows.map((_, index) => index + 1)
    );
    expect(result.rows.every((entry) => entry.phase === 'test-owner-read')).toBe(true);
    expect(result.syntheticLeaseId).toBe(false);
    expect(result.overflow).toBe(false);
    expect(result.restored.every(Boolean)).toBe(true);
  });
});
