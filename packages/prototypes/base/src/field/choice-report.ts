import { delay, type DelayTask } from '@proto.ui/core';

/** Choice controls notify accepted canonical changes, unlike candidate text edits.
 * One host-turn batch retains its starting value and samples the final owner.
 * Callers retire this lease on policy/reset/view changes. */
export function createChoiceFieldReport<T extends boolean | string>(
  available: () => boolean,
  value: () => T,
  report: (reason: 'change' | 'sync') => void
) {
  let task: DelayTask | null = null;
  let before: T | undefined;
  let generation = 0;
  const cancel = () => {
    generation++;
    task?.cancel();
    task = null;
    before = undefined;
  };
  return {
    cancel,
    schedule(initial: T) {
      if (!available()) return;
      before ??= initial;
      task?.cancel();
      const epoch = ++generation;
      task = delay(0, () => {
        if (epoch !== generation) return;
        task = null;
        const initial = before;
        before = undefined;
        if (available()) report(value() !== initial ? 'change' : 'sync');
      });
    },
  };
}
