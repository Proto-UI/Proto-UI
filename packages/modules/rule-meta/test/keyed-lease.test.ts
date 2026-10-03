import { describe, expect, it, vi } from 'vitest';
import { createKeyedMetaLease } from '../src/keyed-lease';
import type { PreferenceKey, StyleSupportKey } from '../src/caps';

function source<Key extends string>(getter: (key: string) => unknown) {
  const active = new Set<() => void>();
  const callbacks: Array<() => void> = [];
  const release = vi.fn();
  return {
    active,
    callbacks,
    release,
    source: {
      getter,
      subscribe: vi.fn((_keys: readonly Key[], callback: () => void) => {
        active.add(callback);
        callbacks.push(callback);
        return () => {
          release();
          active.delete(callback);
        };
      }),
    },
  };
}

describe('independent private keyed lease mechanics', () => {
  it('keeps preference and support source-loss, recovery and late callbacks independent', () => {
    const prefKey = 'preference.reducedTransparency';
    const supportKey = 'styleSupport.alphaFill';
    const values = new Map<string, unknown>([
      [prefKey, 'no-preference'],
      [supportKey, true],
    ]);
    const getter = (key: string) => values.get(key);
    const request = vi.fn();
    const pref = createKeyedMetaLease<PreferenceKey>(() => true, request);
    const support = createKeyedMetaLease<StyleSupportKey>(() => true, request);
    const p = source<PreferenceKey>(getter),
      s = source<StyleSupportKey>(getter);
    pref.reconcile([prefKey], getter, p.source);
    support.reconcile([supportKey], getter, s.source);
    expect(p.source.subscribe).toHaveBeenCalledWith([prefKey], expect.any(Function));
    expect(s.source.subscribe).toHaveBeenCalledWith([supportKey], expect.any(Function));
    expect(pref.read(prefKey, getter)).toBe('no-preference');
    expect(support.read(supportKey, getter)).toBe(true);
    const oldPreference = p.callbacks[0];
    pref.reconcile([prefKey], getter, null);
    expect(p.active.size).toBe(0);
    expect(s.active.size).toBe(1);
    expect(pref.read(prefKey, getter)).toBe('unknown');
    expect(support.read(supportKey, getter)).toBe(true);
    request.mockClear();
    oldPreference();
    expect(request).not.toHaveBeenCalled();
    values.set(supportKey, false);
    s.callbacks[0]();
    expect(request).toHaveBeenCalledTimes(1);
    expect(support.read(supportKey, getter)).toBe(false);
    pref.reconcile([prefKey], getter, p.source);
    expect(p.active.size).toBe(1);
    expect(s.source.subscribe).toHaveBeenCalledTimes(1);
    const oldSupport = s.callbacks[0];
    support.reconcile([supportKey], (key) => getter(key), s.source);
    expect(s.active.size).toBe(0);
    expect(p.active.size).toBe(1);
    request.mockClear();
    oldSupport();
    expect(request).not.toHaveBeenCalled();
    p.callbacks.at(-1)!();
    expect(request).toHaveBeenCalledTimes(1);
    pref.release();
    support.release();
    expect(p.release).toHaveBeenCalledTimes(2);
    expect(s.release).toHaveBeenCalledTimes(1);
  });

  it('retires reentrant release during subscription without changing a peer lease', () => {
    const getter = () => true;
    const request = vi.fn();
    const peer = createKeyedMetaLease<StyleSupportKey>(() => true, request);
    const owner = createKeyedMetaLease<StyleSupportKey>(() => true, request);
    const p = source<StyleSupportKey>(getter);
    peer.reconcile(['styleSupport.alphaFill'], getter, p.source);
    request.mockClear();
    const release = vi.fn();
    let late = () => {};
    owner.reconcile(['styleSupport.backdropBlur4px'], getter, {
      getter,
      subscribe(_keys, callback) {
        late = callback;
        owner.release();
        callback();
        return release;
      },
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(owner.read('styleSupport.backdropBlur4px', getter)).toBe('unknown');
    expect(peer.read('styleSupport.alphaFill', getter)).toBe(true);
    late();
    expect(request).not.toHaveBeenCalled();
    p.callbacks[0]();
    expect(request).toHaveBeenCalledTimes(1);
    peer.release();
  });
});
