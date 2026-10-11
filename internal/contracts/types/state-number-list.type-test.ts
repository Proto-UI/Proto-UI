import type { DefHandle, BorrowedStateHandle, ExposedStateHandle } from '@proto.ui/core';
import type { NumberListStateSpec, StateValueOfSpec } from '@proto.ui/types';

declare const def: DefHandle<{}>;
const owned = def.state.numberList('coordinates', [1, 9]);
const inferred: StateValueOfSpec<NumberListStateSpec> = owned.get();
const readonlyInput = [2, 8] as const;
owned.set(readonlyInput);
owned.setDefault([]);
// @ts-expect-error snapshots are readonly
inferred[0] = 2;
// @ts-expect-error snapshots have no mutable push
owned.get().push(2);
// @ts-expect-error finite-number sequences exclude strings
owned.set(['x']);
// @ts-expect-error owned handles have no watch capability
owned.watch(() => {});
declare const borrowed: BorrowedStateHandle<readonly number[], {}>;
borrowed.watch((_run, event) => {
  if (event.type === 'next') {
    // @ts-expect-error event history is readonly
    event.prev[0] = 1;
  }
});
declare const external: ExposedStateHandle<readonly number[]>;
const exposed: readonly number[] = external.get();
// @ts-expect-error external state has no mutation capability
external.set([1]);
def.rule({
  when: (w) => {
    // @ts-expect-error scalar Rule equality does not admit number.list
    w.state(owned).eq(1);
    // @ts-expect-error Rule equality is not array structural equality
    w.state(owned).eq([1, 9]);
    return w.t();
  },
  intent: (i) => {
    i.state(owned).be([2, 8]);
  },
});
void exposed;
