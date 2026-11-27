import type { TaskInvocation } from '../owned-tasks.ts';
import { ActionFailure } from './transaction.ts';

/** Immediate foreign values are checked at return. Thenables are assimilated
 * before their fulfillment is admitted to the next authored segment. */
export function checkTaskResult<T>(result: T | PromiseLike<T>, check: (value: unknown) => T): T | PromiseLike<T> {
  if ((typeof result === 'object' && result !== null) || typeof result === 'function') {
    const then: unknown = (result as PromiseLike<T>).then;
    if (typeof then === 'function') {
      const pending: PromiseLike<T> = { then: (resolve, reject) => Reflect.apply(then, result, [resolve, reject]) };
      return Promise.resolve(pending).then(check);
    }
  }
  return check(result);
}

/** An authored start has no host return channel for asynchronous defects. */
export function observeNativeTask(task: TaskInvocation<unknown>): void {
  const report = (error: unknown): void => { queueMicrotask(() => { throw error; }); };
  void task.completion.then((outcome) => {
    if (outcome.status === 'failed') report(new ActionFailure(outcome.reason, outcome.source));
    if (outcome.status === 'effect-failed') report(new AggregateError(outcome.errors, 'Post-commit task delivery failed.'));
  }, report);
}
