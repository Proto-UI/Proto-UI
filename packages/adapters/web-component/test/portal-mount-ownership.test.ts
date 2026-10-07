import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebComponentPortalMount, isWebComponentPortaled } from '../src/portal-mount';
const settle = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('WC portal physical ownership across main reconciliation', () => {
  it.each(['remove', 'foreign-parent', 'foreign-document'] as const)(
    'does not reclaim an externally changed projection: %s',
    async (mode) => {
      const origin = document.createElement('section'),
        el = document.createElement('div');
      origin.append(el);
      document.body.append(origin);
      const mount = createWebComponentPortalMount();
      mount.mount(el);
      const foreign =
        mode === 'foreign-document'
          ? document.implementation.createHTMLDocument().body
          : document.createElement('aside');
      if (mode === 'remove') el.remove();
      else foreign.append(el);
      mount.unmount(el);
      await settle();
      expect(el.parentNode).toBe(mode === 'remove' ? null : foreign);
      expect(origin.childNodes.length).toBe(0);
      expect(isWebComponentPortaled(el)).toBe(false);
    }
  );
  it('restores a still-owned projection to its detached origin in authored order', () => {
    const origin = document.createElement('section'),
      el = document.createElement('div'),
      next = document.createElement('span');
    origin.append(el, next);
    document.body.append(origin);
    const mount = createWebComponentPortalMount();
    mount.mount(el);
    origin.remove();
    mount.unmount(el);
    expect([...origin.children]).toEqual([el, next]);
    expect(el.isConnected).toBe(false);
  });
  it('ignores a queued origin observation after this projection lease retired', () => {
    const callbacks: MutationCallback[] = [];
    const observe = vi.fn();
    vi.spyOn(window, 'MutationObserver').mockImplementation(function (callback: MutationCallback) {
      callbacks.push(callback);
      return { observe, disconnect() {}, takeRecords: () => [] } as unknown as MutationObserver;
    } as any);
    const origin = document.createElement('section'),
      el = document.createElement('div');
    origin.append(el);
    document.body.append(origin);
    const mount = createWebComponentPortalMount();
    mount.mount(el);
    mount.unmount(el);
    observe.mockClear();
    const rootRead = vi.spyOn(origin, 'getRootNode');
    for (const callback of callbacks) callback([], {} as MutationObserver);
    expect(observe).not.toHaveBeenCalled();
    expect(rootRead).not.toHaveBeenCalled();
    expect(el.parentNode).toBe(origin);
    expect(isWebComponentPortaled(el)).toBe(false);
  });
  it('follows a connected origin adoption but never steals an externally reparented projection back', async () => {
    const origin = document.createElement('section'),
      el = document.createElement('div');
    origin.append(el);
    document.body.append(origin);
    const mount = createWebComponentPortalMount();
    mount.mount(el);
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const other = iframe.contentDocument!;
    other.adoptNode(origin);
    other.body.append(origin);
    await new Promise((r) => setTimeout(r, 25));
    expect(el.ownerDocument).toBe(other);
    expect(el.parentNode).toBe(other.body);
    const external = other.createElement('article');
    other.body.append(external);
    external.append(el);
    await settle();
    mount.unmount(el);
    expect(el.parentNode).toBe(external);
    expect(origin.childNodes.length).toBe(0);
  });
});
