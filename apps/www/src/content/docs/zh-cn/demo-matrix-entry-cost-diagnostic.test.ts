import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatrixEntryCostDiagnostic } from './demo-matrix-entry-cost-diagnostic';

const original = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');
afterEach(() => {
  if (original) Object.defineProperty(Element.prototype, 'checkVisibility', original);
  else delete (Element.prototype as Partial<Element>).checkVisibility;
  vi.restoreAllMocks();
});
function native(method: (this: Element, ...args: unknown[]) => unknown) {
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    writable: true,
    value: method,
  });
}

describe('opt-in Matrix native call attribution', () => {
  it('serializes without module-private dependencies for a real page init script', () => {
    const method = vi.fn(() => true);
    native(method);
    const dispose = new Function(`return (${installMatrixEntryCostDiagnostic.toString()})()`)();
    expect(document.body.checkVisibility()).toBe(true);
    expect(method).toHaveBeenCalledTimes(1);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(method);
  });

  it('forwards the exact native receiver, arguments and result', () => {
    const expected = { checkVisibilityCSS: true };
    const receiver = document.createElement('button');
    const method = vi.fn(function (this: Element, options: unknown) {
      expect(this).toBe(receiver);
      expect(options).toBe(expected);
      return false;
    });
    native(method);
    const dispose = installMatrixEntryCostDiagnostic();
    expect(receiver.checkVisibility(expected)).toBe(false);
    expect(method).toHaveBeenCalledTimes(1);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(method);
  });

  it('preserves a native exception even if diagnostic output also throws', () => {
    const failure = new Error('native failure');
    native(() => {
      throw failure;
    });
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (time += 10_000));
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('sink unavailable');
    });
    installMatrixEntryCostDiagnostic();
    expect(() => document.body.checkVisibility()).toThrow(failure);
  });

  it('caps records without skipping later native calls or restoring over another owner', () => {
    const method = vi.fn(() => true);
    native(method);
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (time += 10_000));
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const dispose = installMatrixEntryCostDiagnostic();
    for (let i = 0; i < 40; i++) expect(document.body.checkVisibility()).toBe(true);
    expect(method).toHaveBeenCalledTimes(40);
    expect(info).toHaveBeenCalledTimes(18);
    const successor = () => false;
    native(successor);
    dispose();
    expect(Element.prototype.checkVisibility).toBe(successor);
  });
});
