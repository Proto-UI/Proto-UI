// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';

const types = ['pointer.down', 'pointer.move', 'pointer.up', 'pointer.cancel', 'pointer.enter', 'pointer.leave'] as const;
const cleanup: (() => void)[] = [];
afterEach(() => { for (const release of cleanup.splice(0).reverse()) release(); });

function setup(globalEl: EventTarget = new EventTarget()) {
  const rootEl = document.createElement('div');
  document.body.append(rootEl);
  let enabled = true;
  const router = createWebProtoEventRouter({ rootEl, globalEl, isEnabled: () => enabled });
  cleanup.push(() => { router.dispose(); rootEl.remove(); });
  return { rootEl, globalEl, router, enable(value: boolean) { enabled = value; } };
}
function sample(type: string, kind: unknown, buttons: unknown, bubbles = true) {
  const event = new Event(type.replace('.', ''), { bubbles, composed: true, cancelable: true });
  Object.defineProperties(event, { pointerType: { value: kind }, buttons: { value: buttons } });
  return event;
}
function facts(event: Event) {
  const value: unknown = (event as CustomEvent<unknown>).detail;
  if (!value || typeof value !== 'object') throw new Error('Expected private translated sample');
  return value as Record<string, unknown>;
}

describe('router: independent pointer sample mapping and scope', () => {
  for (const type of types) {
    for (const [kind, buttons, expectedKind, expectedButtons] of [
      ['mouse', 0, 'mouse', 'none'], ['mouse', 2, 'mouse', 'active'],
      ['mouse', 31, 'mouse', 'active'], ['touch', 1, 'touch', 'active'],
      ['touch', 0, 'touch', 'none'], ['pen', 0, 'pen', 'none'],
      ['pen', 1, 'pen', 'active'], ['', undefined, 'unknown', 'unknown'],
      ['trackpad', -1, 'unknown', 'unknown'], [null, NaN, 'unknown', 'unknown'],
      ['Mouse', 0.5, 'unknown', 'unknown'], ['mouse', Infinity, 'mouse', 'unknown'],
    ] as const) {
      it(`${type}: ${String(kind)}/${String(buttons)} maps conservatively in root and global scopes`, () => {
        const x = setup();
        const root: Record<string, unknown>[] = []; const global: Record<string, unknown>[] = [];
        x.router.rootTarget.addEventListener(type, (e) => root.push(facts(e)));
        x.router.globalTarget.addEventListener(type, (e) => global.push(facts(e)));
        const native = sample(type, kind, buttons);
        const before = Reflect.ownKeys(native);
        x.rootEl.dispatchEvent(native);
        x.globalEl.dispatchEvent(sample(type, kind, buttons));
        expect(root).toHaveLength(1); expect(global).toHaveLength(1);
        for (const delivered of [root[0], global[0]]) expect(delivered).toMatchObject({ type, pointerType: expectedKind, pointerButtons: expectedButtons });
        expect(Reflect.ownKeys(native)).toEqual(before);
        expect(native.defaultPrevented).toBe(false);
      });
    }
  }
  it('does not infer current buttons from the changed button', () => {
    const x = setup(); const received: Record<string, unknown>[] = [];
    x.router.rootTarget.addEventListener('pointer.move', (e) => received.push(facts(e)));
    const e = sample('pointer.move', 'mouse', undefined);
    Object.defineProperty(e, 'button', { value: 0 }); x.rootEl.dispatchEvent(e);
    expect(received[0].pointerButtons).toBe('unknown');
  });
  it('omits pointer facts from nonpointer semantic samples even on forged input', () => {
    const x = setup(); const received: Record<string, unknown>[] = [];
    x.router.globalTarget.addEventListener('key.down', (e) => received.push(facts(e)));
    const event = new KeyboardEvent('keydown', { key: 'x' });
    Object.defineProperties(event, { pointerType: { value: 'mouse' }, buttons: { value: 0 } });
    x.globalEl.dispatchEvent(event);
    expect(received).toHaveLength(1);
    expect(Object.hasOwn(received[0], 'pointerType')).toBe(false);
    expect(Object.hasOwn(received[0], 'pointerButtons')).toBe(false);
    expect(received[0].key).toBe('x');
  });
  it('demand-binds one additional native global listener and releases the final registration', () => {
    const global = new EventTarget(); const add = vi.spyOn(global, 'addEventListener'); const remove = vi.spyOn(global, 'removeEventListener');
    const x = setup(global); const initial = add.mock.calls.filter(([type]) => type === 'pointermove').length;
    const a = vi.fn(); const b = vi.fn();
    x.router.globalTarget.addEventListener('pointer.move', a);
    x.router.globalTarget.addEventListener('pointer.move', b);
    expect(add.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(initial + 1);
    x.router.globalTarget.removeEventListener('pointer.move', a);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(a).not.toHaveBeenCalled(); expect(b).toHaveBeenCalledTimes(1);
    const removed = remove.mock.calls.filter(([type]) => type === 'pointermove').length;
    x.router.globalTarget.removeEventListener('pointer.move', b);
    expect(remove.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(removed + 1);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(b).toHaveBeenCalledTimes(1);
  });
  it('retires a partially attached global lease before retry without duplicate delivery', () => {
    class ThrowingTarget extends EventTarget {
      fail = false;
      override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
        super.addEventListener(type, callback, options);
        if (this.fail && type === 'pointermove') throw new Error('attach after native side effect');
      }
    }
    const global = new ThrowingTarget(); const x = setup(global); const callback = vi.fn(); global.fail = true;
    expect(() => x.router.globalTarget.addEventListener('pointer.move', callback)).toThrow('attach after native side effect');
    global.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(callback).not.toHaveBeenCalled();
    global.fail = false; x.router.globalTarget.addEventListener('pointer.move', callback);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(callback).toHaveBeenCalledTimes(1);
  });
  it('makes a failed physical removal inert before binding a newer global lease', () => {
    class ThrowingTarget extends EventTarget {
      fail = false;
      override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
        if (this.fail && type === 'pointermove') throw new Error('remove failed before native side effect');
        super.removeEventListener(type, callback, options);
      }
    }
    const global = new ThrowingTarget(); const x = setup(global); const first = vi.fn(); const next = vi.fn();
    x.router.globalTarget.addEventListener('pointer.move', first); global.fail = true;
    expect(() => x.router.globalTarget.removeEventListener('pointer.move', first)).toThrow('remove failed before native side effect');
    global.fail = false; x.router.globalTarget.addEventListener('pointer.move', next);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(first).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledTimes(1);
  });
  it('observes native non-bubbling enter and leave in global capture without inventing samples', () => {
    const x = setup(window); const received: string[] = [];
    for (const type of ['pointer.enter', 'pointer.leave']) x.router.globalTarget.addEventListener(type, () => received.push(type));
    x.rootEl.dispatchEvent(sample('pointer.enter', 'mouse', 0, false));
    x.rootEl.dispatchEvent(sample('pointer.leave', 'mouse', 0, false));
    expect(received).toEqual(['pointer.enter', 'pointer.leave']);
  });
  for (const scope of ['root', 'global'] as const) {
    for (const change of ['disable', 'dispose', 'replace'] as const) {
      it(`${scope}: ${change} in the first callback rejects the rest of that same dispatch`, () => {
        const x = setup(); const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget; const ingress = scope === 'root' ? x.rootEl : x.globalEl;
        const later = vi.fn();
        target.addEventListener('pointer.move', () => {
          if (change === 'disable') x.enable(false);
          else if (change === 'dispose') x.router.dispose();
          else { const replacement = createWebProtoEventRouter({ rootEl: x.rootEl, globalEl: x.globalEl, isEnabled: () => true }); cleanup.push(() => replacement.dispose()); }
        });
        target.addEventListener('pointer.move', later);
        ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
        expect(later).not.toHaveBeenCalled();
      });
    }
    it(`${scope}: a gate-rejected once callback remains available until one accepted dispatch`, () => {
      const x = setup(); const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget; const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      const first = () => x.enable(false); const once = vi.fn();
      target.addEventListener('pointer.move', first);
      target.addEventListener('pointer.move', once, { once: true });
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(once).not.toHaveBeenCalled();
      target.removeEventListener('pointer.move', first); x.enable(true);
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0)); ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
      expect(once).toHaveBeenCalledTimes(1);
    });
    it(`${scope}: aborted registrations never deliver or retain demand`, () => {
      const x = setup(); const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget; const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      const abort = new AbortController(); const fn = vi.fn();
      target.addEventListener('pointer.move', fn, { signal: abort.signal }); abort.abort();
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0)); expect(fn).not.toHaveBeenCalled();
    });
  }
});
