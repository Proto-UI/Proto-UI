// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';

const types = [
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
] as const;
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release();
});

function setup(globalEl: EventTarget = new EventTarget()) {
  const rootEl = document.createElement('div');
  document.body.append(rootEl);
  let enabled = true;
  const router = createWebProtoEventRouter({ rootEl, globalEl, isEnabled: () => enabled });
  cleanup.push(() => {
    router.dispose();
    rootEl.remove();
  });
  return {
    rootEl,
    globalEl,
    router,
    enable(value: boolean) {
      enabled = value;
    },
  };
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
  for (const type of types)
    for (const scope of ['root', 'global'] as const)
      for (const unavailable of ['pointerType', 'buttons', 'both'] as const) {
        it(`${scope} ${type}: throwing ${unavailable} getter only withdraws that fact`, () => {
          const x = setup();
          const received: Record<string, unknown>[] = [];
          const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
          const ingress = scope === 'root' ? x.rootEl : x.globalEl;
          target.addEventListener(type, (event) => received.push(facts(event)));
          const event = new Event(type.replace('.', ''), { bubbles: true, cancelable: true });
          const readKind = vi.fn(() => {
            if (unavailable !== 'buttons') throw new Error('unavailable pointerType');
            return 'mouse';
          });
          const readButtons = vi.fn(() => {
            if (unavailable !== 'pointerType') throw new Error('unavailable buttons');
            return 0;
          });
          Object.defineProperties(event, {
            pointerType: { get: readKind },
            buttons: { get: readButtons },
          });
          const keys = Reflect.ownKeys(event);
          expect(() => ingress.dispatchEvent(event)).not.toThrow();
          expect(received).toHaveLength(1);
          expect(received[0]).toMatchObject({
            type,
            pointerType: unavailable === 'buttons' ? 'mouse' : 'unknown',
            pointerButtons: unavailable === 'pointerType' ? 'none' : 'unknown',
          });
          // This ingress also runs directional arbitration; each extraction is independent.
          expect(readKind).toHaveBeenCalled();
          expect(readButtons).toHaveBeenCalledTimes(1);
          expect(Reflect.ownKeys(event)).toEqual(keys);
          expect(event.defaultPrevented).toBe(false);
        });
      }
  for (const scope of ['root', 'global'] as const) {
    it(`${scope}: nonpointer routing does not evaluate throwing pointer getters`, () => {
      const x = setup(scope === 'root' ? window : new EventTarget());
      if (scope === 'root') {
        x.rootEl.tabIndex = 0;
        x.rootEl.focus();
        expect(document.activeElement).toBe(x.rootEl);
      }
      const received: Record<string, unknown>[] = [];
      const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
      const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      target.addEventListener('key.down', (event) => received.push(facts(event)));
      const read = vi.fn(() => {
        throw new Error('must not read pointer facts');
      });
      const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true });
      Object.defineProperties(event, { pointerType: { get: read }, buttons: { get: read } });
      ingress.dispatchEvent(event);
      expect(received).toHaveLength(1);
      expect(received[0].key).toBe('x');
      expect(Object.hasOwn(received[0], 'pointerType')).toBe(false);
      expect(Object.hasOwn(received[0], 'pointerButtons')).toBe(false);
      expect(read).not.toHaveBeenCalled();
    });
    it(`${scope}: pointer field recovery preserves the host callback-error reporting channel`, () => {
      const x = setup();
      const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
      const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      // Native DOM may report listener exceptions through window.error instead of
      // throwing from dispatchEvent. Compare the current host's actual channel.
      const observe = (failure: Error, dispatch: () => void) => {
        let reported = 0;
        let thrown: unknown;
        const onError = (event: ErrorEvent) => {
          if (event.error !== failure) return;
          reported++;
          event.preventDefault(); // only this expected negative-control report
        };
        window.addEventListener('error', onError);
        try {
          dispatch();
        } catch (error) {
          thrown = error;
        } finally {
          window.removeEventListener('error', onError);
        }
        if (thrown !== undefined) expect(thrown).toBe(failure);
        return { reported, thrown: thrown === failure };
      };
      const directFailure = new Error('direct host callback failure');
      const directCallback = () => {
        throw directFailure;
      };
      ingress.addEventListener('test-control-failure', directCallback);
      const direct = (() => {
        try {
          return observe(directFailure, () =>
            ingress.dispatchEvent(new Event('test-control-failure'))
          );
        } finally {
          ingress.removeEventListener('test-control-failure', directCallback);
        }
      })();
      expect(direct.reported + Number(direct.thrown)).toBeGreaterThan(0);
      const failure = new Error('semantic callback failure');
      target.addEventListener('pointer.move', () => {
        throw failure;
      });
      const semantic = observe(failure, () =>
        ingress.dispatchEvent(sample('pointer.move', 'mouse', 0))
      );
      expect(semantic).toEqual(direct);
    });
  }
  for (const type of types) {
    for (const [kind, buttons, expectedKind, expectedButtons] of [
      ['mouse', 0, 'mouse', 'none'],
      ['mouse', 2, 'mouse', 'active'],
      ['mouse', 31, 'mouse', 'active'],
      ['touch', 1, 'touch', 'active'],
      ['touch', 0, 'touch', 'none'],
      ['pen', 0, 'pen', 'none'],
      ['pen', 1, 'pen', 'active'],
      ['', undefined, 'unknown', 'unknown'],
      ['trackpad', -1, 'unknown', 'unknown'],
      [null, NaN, 'unknown', 'unknown'],
      ['Mouse', 0.5, 'unknown', 'unknown'],
      ['mouse', Infinity, 'mouse', 'unknown'],
    ] as const) {
      it(`${type}: ${String(kind)}/${String(buttons)} maps conservatively in root and global scopes`, () => {
        const x = setup();
        const root: Record<string, unknown>[] = [];
        const global: Record<string, unknown>[] = [];
        x.router.rootTarget.addEventListener(type, (e) => root.push(facts(e)));
        x.router.globalTarget.addEventListener(type, (e) => global.push(facts(e)));
        const native = sample(type, kind, buttons);
        const before = Reflect.ownKeys(native);
        x.rootEl.dispatchEvent(native);
        x.globalEl.dispatchEvent(sample(type, kind, buttons));
        expect(root).toHaveLength(1);
        expect(global).toHaveLength(1);
        for (const delivered of [root[0], global[0]])
          expect(delivered).toMatchObject({
            type,
            pointerType: expectedKind,
            pointerButtons: expectedButtons,
          });
        expect(Reflect.ownKeys(native)).toEqual(before);
        expect(native.defaultPrevented).toBe(false);
      });
    }
  }
  it('does not infer current buttons from the changed button', () => {
    const x = setup();
    const received: Record<string, unknown>[] = [];
    x.router.rootTarget.addEventListener('pointer.move', (e) => received.push(facts(e)));
    const e = sample('pointer.move', 'mouse', undefined);
    Object.defineProperty(e, 'button', { value: 0 });
    x.rootEl.dispatchEvent(e);
    expect(received[0].pointerButtons).toBe('unknown');
  });
  it('omits pointer facts from nonpointer semantic samples even on forged input', () => {
    const x = setup();
    const received: Record<string, unknown>[] = [];
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
    const global = new EventTarget();
    const add = vi.spyOn(global, 'addEventListener');
    const remove = vi.spyOn(global, 'removeEventListener');
    const x = setup(global);
    const initial = add.mock.calls.filter(([type]) => type === 'pointermove').length;
    const a = vi.fn();
    const b = vi.fn();
    x.router.globalTarget.addEventListener('pointer.move', a);
    x.router.globalTarget.addEventListener('pointer.move', b);
    expect(add.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(initial + 1);
    x.router.globalTarget.removeEventListener('pointer.move', a);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    const removed = remove.mock.calls.filter(([type]) => type === 'pointermove').length;
    x.router.globalTarget.removeEventListener('pointer.move', b);
    expect(remove.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(removed + 1);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0));
    expect(b).toHaveBeenCalledTimes(1);
  });
  it('retires a partially attached global lease before retry without duplicate delivery', () => {
    class ThrowingTarget extends EventTarget {
      fail = false;
      override addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: AddEventListenerOptions | boolean
      ) {
        super.addEventListener(type, callback, options);
        if (this.fail && type === 'pointermove') throw new Error('attach after native side effect');
      }
    }
    const global = new ThrowingTarget();
    const x = setup(global);
    const callback = vi.fn();
    global.fail = true;
    expect(() => x.router.globalTarget.addEventListener('pointer.move', callback)).toThrow(
      'attach after native side effect'
    );
    global.dispatchEvent(sample('pointer.move', 'mouse', 0));
    expect(callback).not.toHaveBeenCalled();
    global.fail = false;
    x.router.globalTarget.addEventListener('pointer.move', callback);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0));
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it('makes a failed physical removal inert before binding a newer global lease', () => {
    class ThrowingTarget extends EventTarget {
      fail = false;
      override removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean
      ) {
        if (this.fail && type === 'pointermove')
          throw new Error('remove failed before native side effect');
        super.removeEventListener(type, callback, options);
      }
    }
    const global = new ThrowingTarget();
    const x = setup(global);
    const first = vi.fn();
    const next = vi.fn();
    x.router.globalTarget.addEventListener('pointer.move', first);
    global.fail = true;
    expect(() => x.router.globalTarget.removeEventListener('pointer.move', first)).toThrow(
      'remove failed before native side effect'
    );
    global.fail = false;
    x.router.globalTarget.addEventListener('pointer.move', next);
    global.dispatchEvent(sample('pointer.move', 'mouse', 0));
    expect(first).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
  it('observes native non-bubbling enter and leave in global capture without inventing samples', () => {
    const x = setup(window);
    const received: string[] = [];
    for (const type of ['pointer.enter', 'pointer.leave'])
      x.router.globalTarget.addEventListener(type, () => received.push(type));
    x.rootEl.dispatchEvent(sample('pointer.enter', 'mouse', 0, false));
    x.rootEl.dispatchEvent(sample('pointer.leave', 'mouse', 0, false));
    expect(received).toEqual(['pointer.enter', 'pointer.leave']);
  });
  for (const scope of ['root', 'global'] as const) {
    for (const change of ['disable', 'dispose', 'replace'] as const) {
      it(`${scope}: ${change} in the first callback rejects the rest of that same dispatch`, () => {
        const x = setup();
        const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
        const ingress = scope === 'root' ? x.rootEl : x.globalEl;
        const later = vi.fn();
        target.addEventListener('pointer.move', () => {
          if (change === 'disable') x.enable(false);
          else if (change === 'dispose') x.router.dispose();
          else {
            const replacement = createWebProtoEventRouter({
              rootEl: x.rootEl,
              globalEl: x.globalEl,
              isEnabled: () => true,
            });
            cleanup.push(() => replacement.dispose());
          }
        });
        target.addEventListener('pointer.move', later);
        ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
        expect(later).not.toHaveBeenCalled();
      });
    }
    it(`${scope}: a gate-rejected once callback remains available until one accepted dispatch`, () => {
      const x = setup();
      const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
      const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      const first = () => x.enable(false);
      const once = vi.fn();
      target.addEventListener('pointer.move', first);
      target.addEventListener('pointer.move', once, { once: true });
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
      expect(once).not.toHaveBeenCalled();
      target.removeEventListener('pointer.move', first);
      x.enable(true);
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
      expect(once).toHaveBeenCalledTimes(1);
    });
    it(`${scope}: aborted registrations never deliver or retain demand`, () => {
      const x = setup();
      const target = scope === 'root' ? x.router.rootTarget : x.router.globalTarget;
      const ingress = scope === 'root' ? x.rootEl : x.globalEl;
      const abort = new AbortController();
      const fn = vi.fn();
      target.addEventListener('pointer.move', fn, { signal: abort.signal });
      abort.abort();
      ingress.dispatchEvent(sample('pointer.move', 'mouse', 0));
      expect(fn).not.toHaveBeenCalled();
    });
  }
});
