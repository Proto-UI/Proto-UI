import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import type { ProtoEventPayload, SemanticEventType } from '@proto.ui/types';

/** Author callback oracle, deliberately independent of the router's private detail object. */
export type PointerFactsMount = {
  root: HTMLElement;
  dispatch(target: EventTarget, event: Event): Promise<void>;
  flush(): Promise<void>;
  unmount(): Promise<void>;
};
const pointerTypes = [
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
] as const;
let serial = 0;
function nativeSample(type: string, pointerType: unknown, buttons: unknown) {
  const sample = new Event(type.replace('.', ''), {
    bubbles: type !== 'pointer.enter' && type !== 'pointer.leave',
    composed: true,
    cancelable: true,
  });
  Object.defineProperties(sample, {
    pointerType: { value: pointerType },
    buttons: { value: buttons },
    nativeSecret: { value: {} },
  });
  return sample;
}
function assertPortable(
  payload: ProtoEventPayload,
  type: SemanticEventType,
  kind: string,
  buttons: string
) {
  expect(payload).toMatchObject({ type, pointerType: kind, pointerButtons: buttons });
  expect(Object.isFrozen(payload)).toBe(true);
  expect(Object.isFrozen(payload.control)).toBe(true);
  expect(Object.keys(payload).sort()).toEqual(['control', 'pointerButtons', 'pointerType', 'type']);
  for (const field of [
    'nativeEvent',
    'target',
    'currentTarget',
    'pointerId',
    'buttons',
    'button',
    'clientX',
    'clientY',
    'pressure',
    'nativeSecret',
  ])
    expect(Object.hasOwn(payload, field)).toBe(false);
}
export function pointerFactsConformance(
  name: string,
  mount: (prototype: Prototype) => Promise<PointerFactsMount>
) {
  const make = (
    type: SemanticEventType,
    scope: 'root' | 'global',
    callback: (payload: ProtoEventPayload) => void
  ) =>
    definePrototype({
      name: `pointer-facts-${name}-${++serial}`,
      setup(def) {
        const handler = (_run: unknown, event: ProtoEventPayload) => callback(event);
        if (scope === 'root') {
          def.event.on(type, handler);
          def.event.on(type, handler);
        } else {
          def.event.onGlobal(type, handler);
          def.event.onGlobal(type, handler);
        }
        return (r) => r.el('span', 'pointer facts');
      },
    });
  describe(`${name}: public author pointer sample contract`, () => {
    for (const scope of ['root', 'global'] as const) {
      for (const unavailable of ['pointerType', 'buttons', 'both'] as const)
        it(`${scope}: throwing ${unavailable} getter preserves independent unknown author facts`, async () => {
          for (const type of pointerTypes) {
            const received: ProtoEventPayload[] = [];
            const mounted = await mount(make(type, scope, (event) => received.push(event)));
            try {
              await mounted.flush();
              const event = new Event(type.replace('.', ''), {
                bubbles: type !== 'pointer.enter' && type !== 'pointer.leave',
                composed: true,
                cancelable: true,
              });
              Object.defineProperties(event, {
                pointerType: {
                  get() {
                    if (unavailable !== 'buttons') throw new Error('unavailable pointerType');
                    return 'mouse';
                  },
                },
                buttons: {
                  get() {
                    if (unavailable !== 'pointerType') throw new Error('unavailable buttons');
                    return 0;
                  },
                },
              });
              const keys = Reflect.ownKeys(event);
              await mounted.dispatch(scope === 'root' ? mounted.root : window, event);
              await mounted.flush();
              expect(received).toHaveLength(2);
              expect(received[0]).not.toBe(received[1]);
              for (const payload of received)
                assertPortable(
                  payload,
                  type,
                  unavailable === 'buttons' ? 'mouse' : 'unknown',
                  unavailable === 'pointerType' ? 'none' : 'unknown'
                );
              expect(Reflect.ownKeys(event)).toEqual(keys);
              expect(event.defaultPrevented).toBe(false);
            } finally {
              await mounted.unmount();
            }
          }
        });
      it(`${scope}: key callbacks never read unavailable pointer fields`, async () => {
        const received: ProtoEventPayload[] = [];
        const mounted = await mount(make('key.down', scope, (event) => received.push(event)));
        try {
          await mounted.flush();
          const read = vi.fn(() => {
            throw new Error('must not read pointer facts');
          });
          const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true });
          Object.defineProperties(event, { pointerType: { get: read }, buttons: { get: read } });
          await mounted.dispatch(scope === 'root' ? mounted.root : window, event);
          expect(received).toHaveLength(2);
          for (const payload of received) {
            expect(payload.type).toBe('key.down');
            expect(Object.hasOwn(payload, 'pointerType')).toBe(false);
            expect(Object.hasOwn(payload, 'pointerButtons')).toBe(false);
          }
          expect(read).not.toHaveBeenCalled();
        } finally {
          await mounted.unmount();
        }
      });
    }
    for (const type of pointerTypes)
      for (const scope of ['root', 'global'] as const) {
        for (const [kind, rawButtons, expectedKind, expectedButtons] of [
          ['mouse', 0, 'mouse', 'none'],
          ['touch', 1, 'touch', 'active'],
          ['pen', 0, 'pen', 'none'],
          [undefined, undefined, 'unknown', 'unknown'],
        ] as const) {
          it(`${scope} ${type} ${String(kind)}/${String(rawButtons)} delivers immutable independent author views`, async () => {
            const received: ProtoEventPayload[] = [];
            const mounted = await mount(make(type, scope, (event) => received.push(event)));
            try {
              await mounted.flush();
              const sample = nativeSample(type, kind, rawButtons);
              const keys = Reflect.ownKeys(sample);
              await mounted.dispatch(scope === 'root' ? mounted.root : window, sample);
              await mounted.flush();
              expect(received).toHaveLength(2);
              expect(received[0]).not.toBe(received[1]);
              for (const payload of received)
                assertPortable(payload, type, expectedKind, expectedButtons);
              expect(Reflect.ownKeys(sample)).toEqual(keys);
              expect(sample.defaultPrevented).toBe(false);
            } finally {
              await mounted.unmount();
            }
          });
        }
      }
    for (const scope of ['root', 'global'] as const) {
      it(`${scope}: retained facts do not retain a live default-action capability`, async () => {
        const received: ProtoEventPayload[] = [];
        const mounted = await mount(
          make('pointer.move', scope, (event) => {
            received.push(event);
            event.control.requestDefaultActionPrevention();
          })
        );
        try {
          await mounted.flush();
          const sample = nativeSample('pointer.move', 'mouse', 0);
          const prevent = vi.spyOn(sample, 'preventDefault');
          await mounted.dispatch(scope === 'root' ? mounted.root : window, sample);
          expect(received).toHaveLength(2);
          expect(sample.defaultPrevented).toBe(true);
          expect(prevent).toHaveBeenCalledTimes(1);
          expect(() => received[0].control.requestDefaultActionPrevention()).toThrow();
          expect(prevent).toHaveBeenCalledTimes(1);
        } finally {
          await mounted.unmount();
        }
      });
      it(`${scope}: missing current facts never borrow a previous touch sample`, async () => {
        const received: ProtoEventPayload[] = [];
        const mounted = await mount(make('pointer.move', scope, (event) => received.push(event)));
        try {
          await mounted.flush();
          const target = scope === 'root' ? mounted.root : window;
          await mounted.dispatch(target, nativeSample('pointer.move', 'touch', 1));
          await mounted.dispatch(target, nativeSample('pointer.move', undefined, undefined));
          expect(received).toHaveLength(4);
          assertPortable(received[0], 'pointer.move', 'touch', 'active');
          assertPortable(received[2], 'pointer.move', 'unknown', 'unknown');
        } finally {
          await mounted.unmount();
        }
      });
      it(`${scope}: key samples cannot smuggle pointer fields into the author view`, async () => {
        const received: ProtoEventPayload[] = [];
        const mounted = await mount(make('key.down', scope, (event) => received.push(event)));
        try {
          await mounted.flush();
          const sample = new KeyboardEvent('keydown', { key: 'x', bubbles: true, ctrlKey: true });
          Object.defineProperties(sample, {
            pointerType: { value: 'mouse' },
            buttons: { value: 0 },
          });
          await mounted.dispatch(scope === 'root' ? mounted.root : window, sample);
          expect(received).toHaveLength(2);
          for (const event of received) {
            expect(event).toMatchObject({ type: 'key.down', key: 'x', ctrlKey: true });
            expect(Object.hasOwn(event, 'pointerType')).toBe(false);
            expect(Object.hasOwn(event, 'pointerButtons')).toBe(false);
          }
        } finally {
          await mounted.unmount();
        }
      });
      it(`${scope}: unmount retires callbacks even when the physical root is retained`, async () => {
        const received: ProtoEventPayload[] = [];
        const mounted = await mount(make('pointer.move', scope, (event) => received.push(event)));
        let retired = false;
        try {
          await mounted.flush();
          const root = mounted.root;
          await mounted.dispatch(
            scope === 'root' ? root : window,
            nativeSample('pointer.move', 'mouse', 0)
          );
          expect(received).toHaveLength(2);
          await mounted.unmount();
          retired = true;
          root.dispatchEvent(nativeSample('pointer.move', 'mouse', 0));
          window.dispatchEvent(nativeSample('pointer.move', 'mouse', 0));
          expect(received).toHaveLength(2);
        } finally {
          if (!retired) await mounted.unmount();
        }
      });
    }
  });
}
