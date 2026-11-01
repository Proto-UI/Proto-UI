// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { EventTypeV0, ProtoEventPayload } from '@proto.ui/types';
import { EventModuleImpl } from '../../src/impl';
import { createSysCaps, makeCaps } from '../utils/fake-caps';

const types = [
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
] as const;
function fixture(type: EventTypeV0, scope: 'root' | 'global' = 'root') {
  const target = new EventTarget();
  const sys = createSysCaps();
  const requests: unknown[] = [];
  const impl = new EventModuleImpl(
    makeCaps({
      sys,
      getRootTarget: () => target,
      getGlobalTarget: () => target,
      cancelDefaultAction: (r) => {
        requests.push(r);
      },
    }),
    'pointer-facts-contract'
  );
  if (scope === 'root') {
    impl.on(type);
    impl.on(type);
  } else {
    impl.onGlobal(type);
    impl.onGlobal(type);
  }
  sys.__setExecPhase('render');
  const received: ProtoEventPayload[] = [];
  impl.bind((_id, value) => received.push(value as ProtoEventPayload));
  return {
    received,
    requests,
    impl,
    dispatch(raw: Record<string, unknown>) {
      target.dispatchEvent(new CustomEvent(type, { detail: raw }));
    },
  };
}

describe('EventModule: independent finite pointer view projection', () => {
  for (const type of types)
    for (const scope of ['root', 'global'] as const) {
      for (const [kind, buttons, expectedKind, expectedButtons] of [
        ['mouse', 'none', 'mouse', 'none'],
        ['touch', 'active', 'touch', 'active'],
        ['pen', 'none', 'pen', 'none'],
        ['unknown', 'unknown', 'unknown', 'unknown'],
        [undefined, undefined, 'unknown', 'unknown'],
        [() => 'mouse', { active: true }, 'unknown', 'unknown'],
      ] as const) {
        it(`${scope} ${type} normalizes ${String(kind)}/${String(buttons)} without raw aliases`, () => {
          const x = fixture(type, scope);
          const target = {};
          const raw = {
            pointerType: kind,
            pointerButtons: buttons,
            target,
            nativeEvent: target,
            buttons: 0,
            pointerId: 3,
            clientX: 4,
            pressure: 0.9,
          };
          const before = Reflect.ownKeys(raw);
          x.dispatch(raw);
          expect(x.received).toHaveLength(2);
          expect(x.received[0]).not.toBe(x.received[1]);
          for (const payload of x.received) {
            expect(Object.isFrozen(payload)).toBe(true);
            expect(payload).not.toBe(raw);
            expect(payload).toMatchObject({
              type,
              pointerType: expectedKind,
              pointerButtons: expectedButtons,
            });
            expect(Object.keys(payload).sort()).toEqual([
              'control',
              'pointerButtons',
              'pointerType',
              'type',
            ]);
            expect(Object.isFrozen(payload.control)).toBe(true);
          }
          expect(Reflect.ownKeys(raw)).toEqual(before);
          expect(raw.target).toBe(target);
          expect(x.requests).toEqual([]);
          x.impl.unbind();
        });
      }
    }
  for (const type of [
    'key.down',
    'key.up',
    'press.commit',
    'context.menu',
    'input',
    'change',
  ] as const) {
    it(`${type} does not acquire pointer facts through a forged raw payload`, () => {
      const x = fixture(type);
      x.dispatch({ pointerType: 'mouse', pointerButtons: 'none', key: 'x', ctrlKey: true });
      expect(x.received).toHaveLength(2);
      for (const payload of x.received) {
        expect(Object.hasOwn(payload, 'pointerType')).toBe(false);
        expect(Object.hasOwn(payload, 'pointerButtons')).toBe(false);
        expect(payload).toMatchObject({ key: 'x', ctrlKey: true });
      }
      x.impl.unbind();
    });
  }
  it('does not keep a default-action capability alive with retained pointer data', () => {
    const x = fixture('pointer.move');
    x.dispatch({ pointerType: 'mouse', pointerButtons: 'none' });
    expect(() => x.received[0].control.requestDefaultActionPrevention()).toThrow(
      /outside.*callback/i
    );
    expect(x.requests).toEqual([]);
    x.impl.unbind();
  });
  it('does not retain a prior valid sample when a later sample is missing facts', () => {
    const x = fixture('pointer.move');
    x.dispatch({ pointerType: 'mouse', pointerButtons: 'none' });
    x.dispatch({});
    expect(x.received[0]).toMatchObject({ pointerType: 'mouse', pointerButtons: 'none' });
    expect(x.received[2]).toMatchObject({ pointerType: 'unknown', pointerButtons: 'unknown' });
    x.impl.unbind();
  });
});
