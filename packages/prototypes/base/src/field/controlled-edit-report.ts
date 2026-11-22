import { delay, type DelayTask } from '@proto.ui/core';

type EditReason = 'input' | 'change' | 'compositionend';

/** A controlled editor may receive its owner's write in the framework commit
 * after the outward callback. One revocable notification reads that canonical
 * snapshot; the candidate text is never retained here. */
export function createControlledEditReport(report: (reason: EditReason) => void) {
  let epoch = 0;
  let task: DelayTask | null = null;
  const cancel = () => {
    epoch++;
    task?.cancel();
    task = null;
  };
  return {
    cancel,
    revision: () => epoch,
    schedule(reason: EditReason) {
      cancel();
      const current = epoch;
      task = delay(0, () => {
        if (current !== epoch) return;
        task = null;
        report(reason);
      });
    },
  };
}
