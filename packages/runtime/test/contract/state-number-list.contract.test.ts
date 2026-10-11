import { describe, expect, it } from 'vitest';
import {
  defineAsHook,
  type DefHandle,
  type OwnedStateHandle,
  type BorrowedStateHandle,
  type Prototype,
} from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';
import type { ExposeStateExternalHandle, ExposeStatePort } from '@proto.ui/module-expose-state';
import type { StateEvent } from '@proto.ui/types';
import { createRuntimeSession, type RuntimeHost } from '../../src';

describe('draft number.list public runtime capability', () => {
  it('preserves source, phase, current-run, re-entry, detach and terminal boundaries without implicit rendering', async () => {
    let owned!: OwnedStateHandle<readonly number[]>;
    let borrowed!: BorrowedStateHandle<readonly number[], {}>;
    let retainedDef!: DefHandle<{}>;
    const watched: StateEvent<readonly number[]>[] = [];
    const externalEvents: StateEvent<readonly number[]>[] = [];
    const asSequence = defineAsHook<
      {},
      {},
      { state: { sequence: OwnedStateHandle<readonly number[]> } }
    >({
      name: 'asNumberSequence',
      setup(def) {
        owned = def.state.numberList('sequence', [0, 10]);
        expect((owned as any).watch).toBeUndefined();
        expect(() => owned.set([1, 9])).toThrow();
        owned.setDefault([1, 9]);
      },
    });
    let commits = 0;
    const proto: Prototype<{}> = {
      name: 'state-number-list',
      setup(def) {
        retainedDef = def;
        borrowed = asSequence().getState!('sequence')!;
        borrowed.watch((run, event) => {
          if (event.type === 'next') expect(typeof run.update).toBe('function');
          expect(() => borrowed.setDefault([])).toThrow();
          watched.push(event);
          if (event.type === 'next' && event.next[0] === 2) borrowed.set([3, 7]);
        });
        def.expose.state('sequence', borrowed);
        expect(() =>
          def.rule({ when: (w) => (w.state(borrowed) as any).eq(1), intent: () => {} })
        ).toThrow(/number.list/);
        return (run) => run.el('div', borrowed.get().join(','));
      },
    };
    const host: RuntimeHost<{}> = {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        commits++;
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };
    const session = createRuntimeSession(proto, host);
    const port = session.caps.getPort<StatePort>('state')!;
    const external = session.caps.getPort<ExposeStatePort>('expose-state')!.getAll()
      .sequence as ExposeStateExternalHandle<readonly number[]>;
    expect(external.spec).toEqual({ kind: 'number.list' });
    expect(Object.isFrozen(external.spec)).toBe(true);
    expect((external as any).set).toBeUndefined();
    for (const key of ['__stateId', '__stateSemantic'])
      expect((external as any)[key]).toBe((owned as any)[key]);
    for (const key of ['__stateId', '__stateName', '__stateSemantic', '__stateKind', '__stateSpec'])
      expect((borrowed as any)[key]).toBe((owned as any)[key]);
    expect(external.get()).toBe(owned.get());
    external.subscribe((event) => externalEvents.push(event));
    await session.mount();
    expect(() => retainedDef.state.numberList('late', [])).toThrow();
    expect(() => borrowed.watch(() => {})).toThrow();
    expect(() => owned.set([])).toThrow();
    const before = commits;
    const input = [2, 8];
    port.set(owned, input, Symbol('allowed-unknown-reason'));
    input[0] = 99;
    expect(external.get()).toEqual([3, 7]);
    expect(watched).toHaveLength(2);
    expect(externalEvents).toHaveLength(2);
    expect(commits).toBe(before);
    const snapshot = external.get();
    expect(() => port.set(owned, [Infinity])).toThrow();
    expect(external.get()).toBe(snapshot);
    await session.unmount();
    expect(watched).toHaveLength(2);
    expect(external.get()).toBe(snapshot);
    session.invokeInCallbackScope(() => borrowed.set([4, 6]));
    await session.mount();
    expect(external.get()).toEqual([4, 6]);
    await session.dispose();
    expect(watched.at(-1)).toEqual({ type: 'disconnect', reason: 'unmount' });
    for (const read of [owned.get, borrowed.get, external.get]) expect(read).toThrow();
    expect(() => borrowed.watch(() => {})).toThrow();
    expect(() => borrowed.set([])).toThrow();
  });
});
