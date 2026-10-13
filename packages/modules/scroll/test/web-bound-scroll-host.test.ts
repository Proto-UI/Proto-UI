import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScrollSurfaceSnapshot } from '@proto.ui/core';
import type { ScrollSurfaceHostAttachment, ScrollSurfaceHostLease } from '../src/caps';
import { createBoundWebScrollSurfaceHost } from '../src/web/create-bound-web-scroll-host';

// DOM/CSSOM harness only: injected metrics and callbacks do not prove native
// Shadow scrolling, browser input, layout, focus reveal, or painted clipping.
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      cleanup();
    } catch {}
  }
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function element(doc = document) {
  const target = doc.createElement('div');
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 100 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 400 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
  doc.body.append(target);
  return target;
}
function connection(
  onFacts: (facts: ScrollSurfaceSnapshot) => void = () => {}
): ScrollSurfaceHostAttachment {
  return {
    config: { axes: 'vertical', projection: 'system', endFollow: { mode: 'off' } },
    projection: 'system',
    onFacts,
  };
}
function fixture(split = true) {
  const boundary = element();
  let target: HTMLElement | null = split ? element() : boundary;
  let ready = true;
  const targetCallbacks: (() => void)[] = [];
  const documentCallbacks: ((document: Document, phase: 'retire' | 'ready') => void)[] = [];
  const offTarget = vi.fn();
  const offDocument = vi.fn();
  const host = createBoundWebScrollSurfaceHost({
    boundary,
    getTarget: () => target,
    isReady: () => ready,
    subscribeTarget(callback) {
      targetCallbacks.push(callback);
      return offTarget;
    },
    subscribeDocumentChange(callback) {
      documentCallbacks.push(callback);
      return offDocument;
    },
    moveGestureHost: {
      attach: () => {
        throw new Error('system profile must not acquire gestures');
      },
    },
  });
  const availability = host.availability!;
  const binding = () => {
    const value = availability.get();
    expect(value.kind).toBe('available');
    return value.kind === 'available' ? value.binding : {};
  };
  const attach = (value = connection(), expected = binding()) => {
    const lease = host.attach(value, expected);
    cleanups.push(() => lease.dispose());
    return lease;
  };
  const subscribe = (callback = () => {}) => {
    const off = availability.subscribe(callback);
    cleanups.push(off);
    return off;
  };
  return {
    host,
    boundary,
    availability,
    binding,
    attach,
    subscribe,
    target: () => target!,
    setTarget: (next: HTMLElement | null) => {
      target = next;
    },
    setReady: (next: boolean) => {
      ready = next;
    },
    targetCallbacks,
    documentCallbacks,
    offTarget,
    offDocument,
  };
}

describe('binding-aware Web Scroll DOM host', () => {
  it('keeps a pending split target unavailable without boundary projection or invented facts', () => {
    const f = fixture();
    const initial = f.target();
    f.setReady(false);
    const facts = vi.fn();
    f.subscribe();
    expect(f.availability.get()).toEqual({ kind: 'unavailable', reason: 'target-pending' });
    expect(() => f.host.attach(connection(facts), {})).toThrow();
    expect(facts).not.toHaveBeenCalled();
    for (const target of [initial, f.boundary]) {
      expect(target.getAttribute('data-pui-scroll-projection')).toBeNull();
      expect(target.style.overflowY).toBe('');
    }
  });

  it('reports first actual facts synchronously after projecting only the selected surface', () => {
    const f = fixture();
    const facts: ScrollSurfaceSnapshot[] = [];
    f.attach(
      connection((snapshot) => {
        expect(f.target().style.overflowY).toBe('auto');
        expect(f.target().getAttribute('data-pui-scroll-projection')).toBe('system');
        expect(f.boundary.style.overflowY).toBe('');
        facts.push(snapshot);
      })
    );
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      projection: 'system',
      vertical: { visibleRatio: 0.25, position: 0 },
    });
  });

  it('rejects missing, forged and replaced expected bindings before physical writes', () => {
    const f = fixture();
    const oldTarget = f.target();
    const old = f.binding();
    for (const expected of [undefined, {}])
      expect(() => f.host.attach(connection(), expected)).toThrow();
    f.setTarget(element());
    expect(f.binding()).not.toBe(old);
    expect(() => f.host.attach(connection(), old)).toThrow();
    for (const target of [oldTarget, f.target(), f.boundary])
      expect(target.style.overflowY).toBe('');
  });

  it('rejects unsupported split profiles and preflights compound foreign ownership atomically', () => {
    const f = fixture();
    const facts = vi.fn();
    expect(() =>
      f.host.attach({ ...connection(facts), projection: 'composed' }, f.binding())
    ).toThrow('unsupported-profile');
    f.target().style.setProperty('scrollbar-width', 'thin', 'important');
    const before = f.target().getAttribute('style');
    expect(() => f.host.attach(connection(facts), f.binding())).toThrow();
    expect(f.target().getAttribute('style')).toBe(before);
    expect(f.target().style.overflowX).toBe('');
    expect(f.target().getAttribute('data-pui-scroll-projection')).toBeNull();
    expect(facts).not.toHaveBeenCalled();
  });

  it('retains a same-document binding and scroll position across a connected DOM move', () => {
    const f = fixture();
    const binding = f.binding();
    const lease = f.attach();
    lease.request({ kind: 'by', axis: 'vertical', delta: 40 });
    const parent = element();
    parent.append(f.target());
    expect(f.binding()).toBe(binding);
    expect(f.target().scrollTop).toBe(40);
  });

  it('invalidates old requests and facts on replacement and restores only old owned styles', () => {
    const f = fixture();
    const old = f.target();
    const facts = vi.fn();
    const lease = f.attach(connection(facts));
    const count = facts.mock.calls.length;
    const replacement = element();
    f.setTarget(replacement);
    lease.request({ kind: 'by', axis: 'vertical', delta: 90 });
    old.dispatchEvent(new Event('scroll'));
    expect(old.scrollTop).toBe(0);
    expect(replacement.scrollTop).toBe(0);
    expect(facts).toHaveBeenCalledTimes(count);
    lease.dispose();
    expect(old.style.overflowY).toBe('');
    expect(replacement.style.overflowY).toBe('');
    f.attach();
    expect(replacement.style.overflowY).toBe('auto');
  });

  it('publishes retirement before reentry and replaces identity on actual document adoption', () => {
    const f = fixture();
    const old = f.binding();
    const lease = f.attach();
    const states: unknown[] = [];
    f.subscribe(() => states.push(f.availability.get()));
    const nextDocument = document.implementation.createHTMLDocument('destination');
    f.documentCallbacks[0](nextDocument, 'retire');
    expect(states[0]).toEqual({ kind: 'unavailable', reason: 'target-retired' });
    lease.request({ kind: 'by', axis: 'vertical', delta: 100 });
    expect(f.target().scrollTop).toBe(0);
    lease.dispose();
    nextDocument.body.append(nextDocument.adoptNode(f.target()));
    expect(f.availability.get().kind).toBe('unavailable');
    f.documentCallbacks[0](nextDocument, 'ready');
    expect(f.target().ownerDocument).toBe(nextDocument);
    expect(f.binding()).not.toBe(old);
    f.attach();
    expect(f.target().style.overflowY).toBe('auto');
  });

  it('makes unsubscribed target and document callbacks inert across a new subscription epoch', () => {
    const f = fixture();
    const first = vi.fn();
    const off = f.subscribe(first);
    const oldTargetCallback = f.targetCallbacks[0],
      oldDocumentCallback = f.documentCallbacks[0];
    off();
    const next = vi.fn();
    f.subscribe(next);
    const binding = f.binding();
    oldTargetCallback();
    oldDocumentCallback(document, 'retire');
    expect(first).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(f.binding()).toBe(binding);
  });

  it('reserves a binding before synchronous first-fact reentry can acquire a second lease', () => {
    const f = fixture(false);
    let reentryRejected = false;
    let second: ScrollSurfaceHostLease | undefined;
    f.attach(
      connection(() => {
        try {
          second = f.host.attach(connection(), f.binding());
        } catch {
          reentryRejected = true;
        }
      })
    );
    if (second) cleanups.push(() => second!.dispose());
    expect(reentryRejected).toBe(true);
    expect(second).toBeUndefined();
  });

  it('rolls back acquisition if first facts synchronously replace the target', () => {
    const f = fixture();
    const old = f.target();
    const replacement = element();
    expect(() =>
      f.host.attach(
        connection(() => f.setTarget(replacement)),
        f.binding()
      )
    ).toThrow('target-retired');
    expect(old.style.overflowY).toBe('');
    expect(old.getAttribute('data-pui-scroll-projection')).toBeNull();
    expect(replacement.style.overflowY).toBe('');
    f.attach();
  });

  it('revokes foreign policy replacement and preserves foreign value and priority on cleanup', () => {
    const f = fixture();
    const lease = f.attach();
    const changes = vi.fn();
    f.subscribe(changes);
    f.target().style.setProperty('overflow-y', 'scroll', 'important');
    f.target().dispatchEvent(new Event('scroll'));
    expect(f.availability.get()).toEqual({ kind: 'unavailable', reason: 'ownership-conflict' });
    lease.dispose();
    expect(f.target().style.getPropertyValue('overflow-y')).toBe('scroll');
    expect(f.target().style.getPropertyPriority('overflow-y')).toBe('important');
    expect(f.target().style.overflowX).toBe('');
    expect(f.target().getAttribute('data-pui-scroll-projection')).toBeNull();
  });

  it('attempts both subscription cleanups once and preserves a falsy first thrown value', () => {
    const f = fixture();
    f.offTarget.mockImplementation(() => {
      throw 0;
    });
    f.offDocument.mockImplementation(() => {
      throw new Error('later cleanup');
    });
    const off = f.subscribe();
    let thrown = false,
      caught: unknown;
    try {
      off();
    } catch (error) {
      thrown = true;
      caught = error;
    }
    expect(thrown).toBe(true);
    expect(caught).toBe(0);
    expect(f.offTarget).toHaveBeenCalledTimes(1);
    expect(f.offDocument).toHaveBeenCalledTimes(1);
    off();
    expect(f.offTarget).toHaveBeenCalledTimes(1);
  });

  it('rolls back all physical writes after first-fact delivery throws a falsy value', () => {
    const f = fixture();
    const target = f.target();
    const remove = vi.spyOn(target, 'removeEventListener');
    let thrown = false,
      caught: unknown;
    try {
      f.host.attach(
        connection(() => {
          throw false;
        }),
        f.binding()
      );
    } catch (error) {
      thrown = true;
      caught = error;
    }
    expect(thrown).toBe(true);
    expect(caught).toBe(false);
    expect(target.style.overflowX).toBe('');
    expect(target.style.overflowY).toBe('');
    expect(target.style.getPropertyValue('scrollbar-width')).toBe('');
    expect(target.getAttribute('data-pui-scroll-projection')).toBeNull();
    expect(remove.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['scroll', 'load', 'wheel', 'keydown'])
    );
    f.attach();
    expect(target.style.overflowY).toBe('auto');
  });

  it('finishes physical cleanup after an early falsy removal failure and never retries the retired lease', () => {
    const f = fixture();
    const target = f.target();
    const lease = f.attach();
    const realRemove = target.removeEventListener.bind(target);
    const remove = vi
      .spyOn(target, 'removeEventListener')
      .mockImplementation((type, callback, options) => {
        realRemove(type, callback, options);
        if (type === 'scroll') throw null;
      });
    let thrown = false,
      caught: unknown;
    try {
      lease.dispose();
    } catch (error) {
      thrown = true;
      caught = error;
    }
    expect(thrown).toBe(true);
    expect(caught).toBeNull();
    expect(remove.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['scroll', 'load', 'wheel', 'keydown'])
    );
    expect(target.style.overflowX).toBe('');
    expect(target.style.overflowY).toBe('');
    expect(target.getAttribute('data-pui-scroll-projection')).toBeNull();
    const count = remove.mock.calls.length;
    lease.dispose();
    expect(remove).toHaveBeenCalledTimes(count);
    remove.mockRestore();
    f.attach();
  });

  it('preserves the first registration error while still attempting acquired subscription cleanup', () => {
    const target = element();
    const off = vi.fn(() => {
      throw new Error('cleanup after acquisition failure');
    });
    const host = createBoundWebScrollSurfaceHost({
      boundary: target,
      getTarget: () => target,
      isReady: () => true,
      subscribeTarget: () => off,
      subscribeDocumentChange: () => {
        throw 0;
      },
      moveGestureHost: {
        attach: () => {
          throw new Error('not used');
        },
      },
    });
    let thrown = false,
      caught: unknown;
    try {
      host.availability!.subscribe(() => {});
    } catch (error) {
      thrown = true;
      caught = error;
    }
    expect(thrown).toBe(true);
    expect(caught).toBe(0);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('does not preserve a failed availability listener for late callbacks after registration rollback', () => {
    const target = element();
    let oldCallback!: () => void;
    const listener = vi.fn();
    const off = vi.fn();
    const host = createBoundWebScrollSurfaceHost({
      boundary: target,
      getTarget: () => target,
      isReady: () => true,
      subscribeTarget: (callback) => {
        oldCallback = callback;
        return off;
      },
      subscribeDocumentChange: () => {
        throw new Error('registration rejected');
      },
      moveGestureHost: {
        attach: () => {
          throw new Error('not used');
        },
      },
    });
    expect(() => host.availability!.subscribe(listener)).toThrow('registration rejected');
    oldCallback();
    expect(listener).not.toHaveBeenCalled();
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('clears the old lease before cleanup reentry acquires a replacement target', () => {
    const f = fixture();
    const old = f.target();
    const oldFacts = vi.fn();
    const lease = f.attach(connection(oldFacts));
    const replacement = element();
    let nextLease: ScrollSurfaceHostLease | undefined;
    const realRemove = old.removeEventListener.bind(old);
    vi.spyOn(old, 'removeEventListener').mockImplementation((type, listener, options) => {
      realRemove(type, listener, options);
      if (type === 'scroll') {
        f.setTarget(replacement);
        nextLease = f.attach();
      }
    });
    lease.dispose();
    expect(nextLease).toBeDefined();
    expect(old.style.overflowY).toBe('');
    expect(replacement.style.overflowY).toBe('auto');
    const count = oldFacts.mock.calls.length;
    old.dispatchEvent(new Event('scroll'));
    expect(oldFacts).toHaveBeenCalledTimes(count);
    nextLease!.request({ kind: 'by', axis: 'vertical', delta: 30 });
    expect(replacement.scrollTop).toBe(30);
    expect(old.scrollTop).toBe(0);
    expect(() => f.host.attach(connection(), f.binding())).toThrow();
  });

  it('attempts every guarded style restoration after one property cleanup throws', () => {
    const f = fixture();
    const target = f.target();
    const lease = f.attach();
    const realRemove = target.style.removeProperty.bind(target.style);
    const remove = vi.spyOn(target.style, 'removeProperty').mockImplementation((name) => {
      if (name === 'overflow-x') throw false;
      return realRemove(name);
    });
    let thrown = false,
      caught: unknown;
    try {
      lease.dispose();
    } catch (error) {
      thrown = true;
      caught = error;
    }
    expect(thrown).toBe(true);
    expect(caught).toBe(false);
    expect(remove.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['overflow-x', 'overflow-y', 'scrollbar-width'])
    );
    expect(target.style.overflowY).toBe('');
    expect(target.style.getPropertyValue('scrollbar-width')).toBe('');
    expect(target.getAttribute('data-pui-scroll-projection')).toBeNull();
    remove.mockRestore();
  });

  it.each(['policy theft', 'target replacement', 'document adoption'] as const)(
    'rejects stale scheduled to-end before any physical write after %s without notification',
    (change) => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
      const f = fixture();
      const target = f.target();
      const facts = vi.fn();
      let scrollTop = 0;
      const writes: number[] = [];
      Object.defineProperty(target, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value) => {
          writes.push(value);
          scrollTop = value;
        },
      });
      const lease = f.attach(connection(facts));
      lease.request({ kind: 'to-end', axis: 'vertical' });
      expect(frames).toHaveLength(1);
      expect(writes).toEqual([]);
      const count = facts.mock.calls.length;
      if (change === 'policy theft') target.style.setProperty('overflow-y', 'scroll', 'important');
      else if (change === 'target replacement') f.setTarget(element());
      else {
        const nextDocument = document.implementation.createHTMLDocument('late destination');
        nextDocument.body.append(nextDocument.adoptNode(target));
        expect(target.ownerDocument).toBe(nextDocument);
      }
      // Deliberately do not deliver availability or MutationObserver callbacks.
      // Even a manually delivered old frame must validate before touching DOM.
      frames[0](16);
      expect(writes).toEqual([]);
      expect(target.scrollTop).toBe(0);
      expect(facts).toHaveBeenCalledTimes(count);
      if (change === 'policy theft') {
        expect(f.availability.get()).toEqual({ kind: 'unavailable', reason: 'ownership-conflict' });
        expect(target.style.getPropertyValue('overflow-y')).toBe('scroll');
        expect(target.style.getPropertyPriority('overflow-y')).toBe('important');
      }
    }
  );
});
