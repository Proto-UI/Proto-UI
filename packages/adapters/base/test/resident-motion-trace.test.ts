import { expect, it, vi } from 'vitest';
import {
  installResidentMotionTrace,
  probeResidentLegacyColorSerialization,
} from './resident-motion-trace';
function harness() {
  let next = 1,
    now = 0,
    fault = false,
    ignored = '';
  const callbacks = new Map<number, Function>();
  const failure = new Error('native failure'),
    result = { native: true };
  const writes: { receiver: unknown; args: unknown[] }[] = [];
  class Style {
    values = new Map<string, string>();
    setProperty(...args: unknown[]) {
      writes.push({ receiver: this, args });
      if (fault) throw failure;
      const key = String(args[0]),
        value = String(args[1]);
      if (key !== ignored) this.values.set(key, value);
      return result;
    }
    getPropertyValue(key: string) {
      return this.values.get(key) ?? '';
    }
  }
  const request = vi.fn(function (this: unknown, callback: unknown, ...extra: unknown[]) {
    if (typeof callback !== 'function') throw failure;
    const id = next++;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn(function (this: unknown, id: unknown, ...extra: unknown[]) {
    callbacks.delete(Number(id));
    return result;
  });
  const win = {
    requestAnimationFrame: request,
    cancelAnimationFrame: cancel,
    performance: { now: () => ++now },
    document: { visibilityState: 'visible' },
    CSSStyleDeclaration: Style,
    getComputedStyle: vi.fn(() => {
      throw new Error('unexpected layout');
    }),
  } as unknown as Window & typeof globalThis;
  return {
    win,
    request,
    cancel,
    callbacks,
    Style,
    writes,
    failure,
    result,
    fail() {
      fault = true;
    },
    ignore(key: string) {
      ignored = key;
    },
  };
}
it('preserves request/callback receivers, all args, returns and one native request', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    receiver = {},
    cbReceiver = {},
    result = {};
  const cb = vi.fn(function (this: unknown, ...args: unknown[]) {
    expect(this).toBe(cbReceiver);
    expect(args).toEqual([123.456, 'extra']);
    return result;
  });
  const id = Reflect.apply(h.win.requestAnimationFrame, receiver, [cb, 'request-extra']);
  expect(id).toBe(1);
  expect(h.request).toHaveBeenCalledTimes(1);
  expect(h.request.mock.contexts[0]).toBe(receiver);
  expect(h.request.mock.calls[0].slice(1)).toEqual(['request-extra']);
  expect(trace.checkpoint().pending.map((x) => x.ticket)).toEqual([id]);
  expect(Reflect.apply(h.callbacks.get(id)!, cbReceiver, [123.456, 'extra'])).toBe(result);
  expect(cb).toHaveBeenCalledTimes(1);
  const log = trace.finish();
  expect(log.pending).toEqual([]);
  expect(log.lastDelivered?.timestamp).toBe(123.456);
  expect(log.entries.map((x) => x.kind)).toEqual(['raf-request', 'raf-deliver']);
  expect(h.win.getComputedStyle).not.toHaveBeenCalled();
});
it('does not make invalid callbacks valid or mask native request errors', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win);
  expect(() => Reflect.apply(h.win.requestAnimationFrame, h.win, [null])).toThrow(h.failure);
  expect(h.request.mock.calls).toEqual([[null]]);
  expect(trace.finish().entries).toEqual([]);
});
it('does not swallow callback exceptions', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    fail = new Error('callback');
  const cb = vi.fn(() => {
      throw fail;
    }),
    id = h.win.requestAnimationFrame(cb);
  expect(() => h.callbacks.get(id)!(27)).toThrow(fail);
  expect(cb.mock.calls).toEqual([[27]]);
  expect(trace.finish().pending).toEqual([]);
});
it('delegates cancel receiver/all args/return without an extra cancel', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    receiver = {},
    id = h.win.requestAnimationFrame(() => {});
  expect(Reflect.apply(h.win.cancelAnimationFrame, receiver, [id, 'extra'])).toBe(h.result);
  expect(h.cancel.mock.contexts[0]).toBe(receiver);
  expect(h.cancel.mock.calls).toEqual([[id, 'extra']]);
  expect(trace.finish().pending).toEqual([]);
  expect(h.cancel).toHaveBeenCalledTimes(1);
});
it('does not double-coerce cancel and discloses ambiguous pending knowledge', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    id = h.win.requestAnimationFrame(() => {}),
    convert = vi.fn(() => id);
  Reflect.apply(h.win.cancelAnimationFrame, h.win, [{ valueOf: convert }]);
  expect(convert).toHaveBeenCalledTimes(1);
  expect(h.callbacks.size).toBe(0);
  const log = trace.finish();
  expect(log.ambiguousCancels).toBe(1);
  expect(log.pendingComplete).toBe(false);
});
it('captures the actual fractional CSS input while preserving receiver/args and single conversion', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    style = new h.Style();
  const text = 'rgba(0.47673894861645416, 0.47673890635160826, 0.4767387910269291, 1)';
  expect(style.setProperty('background-color', text, '')).toBe(h.result);
  const convert = vi.fn(() => 'rgba(1, 1, 1, 1)');
  style.setProperty('background-color', { toString: convert });
  expect(convert).toHaveBeenCalledTimes(1);
  expect(h.writes[0]).toEqual({ receiver: style, args: ['background-color', text, ''] });
  const log = trace.finish();
  expect(log.entries[0]).toMatchObject({ kind: 'style-input', value: text });
  expect(log.entries[2]).toMatchObject({ kind: 'style-input', value: { type: 'object' } });
});
it('passes unobserved CSS properties through and preserves setter errors', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    style = new h.Style();
  expect(style.setProperty('width', '2px')).toBe(h.result);
  h.fail();
  expect(() => style.setProperty('background-color', 'red')).toThrow(h.failure);
  expect(trace.finish().entries.map((x) => x.kind)).toEqual(['style-input']);
});
it('recording faults do not alter native work or hide incomplete evidence', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win);
  h.win.performance.now = () => {
    throw new Error('clock');
  };
  const cb = vi.fn(() => 'result'),
    id = h.win.requestAnimationFrame(cb);
  expect(h.callbacks.get(id)!(44)).toBe('result');
  expect(new h.Style().setProperty('background-color', 'red')).toBe(h.result);
  const log = trace.finish();
  expect(log.observationErrors).toBeGreaterThan(0);
  expect(log.pendingComplete).toBe(false);
  expect(h.request).toHaveBeenCalledTimes(1);
  expect(h.cancel).not.toHaveBeenCalled();
});
it('bounds events/pending/input size and reports overflow', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win, { entries: 4, pending: 2 });
  new h.Style().setProperty('background-color', 'x'.repeat(3000));
  for (let i = 0; i < 20; i++) h.win.requestAnimationFrame(() => {});
  const log = trace.finish();
  expect(log.entries).toHaveLength(4);
  expect(log.pending).toHaveLength(2);
  expect(log.dropped).toBe(18);
  expect(log.pendingOverflow).toBe(18);
  expect(log.pendingComplete).toBe(false);
  expect(log.entries[0].value).toMatchObject({ type: 'truncated-string', length: 3000 });
  expect(h.request).toHaveBeenCalledTimes(20);
  expect(h.cancel).not.toHaveBeenCalled();
});
it('restores exact descriptors, does not cancel pending work, and late callbacks still delegate without recording', () => {
  const h = harness(),
    keys = ['requestAnimationFrame', 'cancelAnimationFrame'];
  const before = keys.map((key) => Object.getOwnPropertyDescriptor(h.win, key));
  const styleBefore = Object.getOwnPropertyDescriptor(h.Style.prototype, 'setProperty'),
    trace = installResidentMotionTrace(h.win),
    cb = vi.fn(() => 'late'),
    id = h.win.requestAnimationFrame(cb);
  const log = trace.finish();
  expect(log.pending.map((x) => x.ticket)).toEqual([id]);
  expect(h.cancel).not.toHaveBeenCalled();
  expect(h.callbacks.get(id)!(88)).toBe('late');
  expect(cb.mock.calls).toEqual([[88]]);
  expect(trace.finish()).toEqual(log);
  expect(keys.map((key) => Object.getOwnPropertyDescriptor(h.win, key))).toEqual(before);
  expect(Object.getOwnPropertyDescriptor(h.Style.prototype, 'setProperty')).toEqual(styleBefore);
});
it('does not overwrite a newer wrapper owner', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win),
    newer = vi.fn(() => 99);
  h.win.requestAnimationFrame = newer;
  expect(trace.finish().cleanupConflicts).toEqual(['requestAnimationFrame']);
  expect(h.win.requestAnimationFrame).toBe(newer);
  expect(h.win.cancelAnimationFrame).toBe(h.cancel);
});
it('rolls back partial setup on an immutable descriptor', () => {
  const h = harness();
  Object.defineProperty(h.win, 'cancelAnimationFrame', {
    value: h.cancel,
    configurable: false,
    writable: false,
  });
  expect(() => installResidentMotionTrace(h.win)).toThrow();
  expect(h.win.requestAnimationFrame).toBe(h.request);
  expect(h.Style.prototype.setProperty.name).toBe('setProperty');
});
it.each(['translate', 'background-color'])(
  'does not conceal a deliberately dropped %s write',
  (property) => {
    const h = harness(),
      style = new h.Style();
    style.setProperty('translate', '0px');
    style.setProperty('background-color', 'rgb(0, 0, 0)');
    h.ignore(property);
    const trace = installResidentMotionTrace(h.win);
    style.setProperty('translate', '7px');
    style.setProperty('background-color', 'rgb(99, 99, 99)');
    expect(() => {
      expect(Number.parseFloat(style.getPropertyValue('translate'))).toBeGreaterThan(0);
      expect(Number.parseFloat(style.getPropertyValue('translate'))).toBeLessThan(14);
      expect(style.getPropertyValue('background-color')).not.toBe('rgb(0, 0, 0)');
    }).toThrow();
    expect(trace.finish().entries.filter((x) => x.kind === 'style-input')).toHaveLength(2);
  }
);
it('preserves even a synchronous delegate without phantom pending state', () => {
  const h = harness();
  h.win.requestAnimationFrame = (cb) => {
    cb(123);
    return 7;
  };
  const trace = installResidentMotionTrace(h.win),
    cb = vi.fn();
  expect(h.win.requestAnimationFrame(cb)).toBe(7);
  expect(cb.mock.calls).toEqual([[123]]);
  expect(trace.finish().pending).toEqual([]);
});
it('separate serialization probe cleans its element after a source exception', () => {
  const count = document.body.children.length,
    spy = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
      throw new Error('control read');
    });
  try {
    expect(() => probeResidentLegacyColorSerialization(window)).toThrow('control read');
  } finally {
    spy.mockRestore();
  }
  expect(document.body.children).toHaveLength(count);
});
it('keeps native cancellation errors and uncertain work untouched', () => {
  const h = harness();
  h.win.cancelAnimationFrame = () => {
    throw h.failure;
  };
  const trace = installResidentMotionTrace(h.win),
    id = h.win.requestAnimationFrame(() => {});
  expect(() => h.win.cancelAnimationFrame(id)).toThrow(h.failure);
  expect(trace.finish().pending.map((x) => x.ticket)).toEqual([id]);
});
it('preserves a native request failure even when its callback argument is valid', () => {
  const h = harness();
  h.request.mockImplementationOnce(() => {
    throw h.failure;
  });
  const trace = installResidentMotionTrace(h.win);
  expect(() => h.win.requestAnimationFrame(() => {})).toThrow(h.failure);
  expect(trace.finish().entries).toEqual([]);
});
it('a failing observation getter cannot replace the successful native setter return', () => {
  const h = harness();
  h.Style.prototype.getPropertyValue = () => {
    throw new Error('observer getter');
  };
  const trace = installResidentMotionTrace(h.win);
  expect(new h.Style().setProperty('background-color', 'red')).toBe(h.result);
  expect(trace.finish().observationErrors).toBe(1);
});
it('labels retired surface observations and rebinds only at the caller existing checkpoint', () => {
  const h = harness(),
    trace = installResidentMotionTrace(h.win);
  const old = { style: new h.Style(), isConnected: true },
    fresh = { style: new h.Style(), isConnected: true };
  trace.bindSurface(old as unknown as HTMLElement);
  old.isConnected = false;
  trace.diagnostic([]);
  const before = trace.checkpoint();
  expect(before.boundSurfaceConnected).toBe(false);
  const after = trace.checkpoint(fresh as unknown as HTMLElement);
  expect(after.boundSurfaceConnected).toBe(true);
  expect(after.boundStyle).not.toBe(before.boundStyle);
  const log = trace.finish();
  expect(log.entries.find((x) => x.kind === 'projector-diagnostic')).toMatchObject({
    boundSurfaceConnected: false,
    boundStyle: before.boundStyle,
  });
  expect(log.entries.filter((x) => x.kind === 'surface-bound')).toHaveLength(2);
  expect(h.win.getComputedStyle).not.toHaveBeenCalled();
});
it.each([1.9, 2 ** 32 + 1, -4294967295])(
  'does not claim complete pending knowledge after native unsigned-long conversion of %s',
  (value) => {
    const h = harness();
    h.cancel.mockImplementation((id) => {
      h.callbacks.delete(Number(id) >>> 0);
      return h.result;
    });
    const trace = installResidentMotionTrace(h.win),
      id = h.win.requestAnimationFrame(() => {});
    h.win.cancelAnimationFrame(value);
    expect(h.callbacks.has(id)).toBe(false);
    const log = trace.finish();
    expect(log.pendingComplete).toBe(false);
    expect(log.ambiguousCancels).toBe(1);
  }
);
