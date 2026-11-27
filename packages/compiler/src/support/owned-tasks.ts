import type { ActionDispatch, ActionResult } from './react/transaction.ts';

export type TaskPolicy = 'latest' | 'parallel' | 'serial';
export type PostCommit = (effect: () => void) => void;
export type TaskOutcome<Result> =
  | { readonly status: 'completed'; readonly value: Result }
  | { readonly status: 'cancelled' }
  | { readonly status: 'superseded' }
  | { readonly status: 'owner-ended' }
  | Extract<ActionResult, { status: 'failed' | 'effect-failed' }>;

export interface TaskInvocation<Result> {
  readonly id: symbol;
  readonly completion: Promise<TaskOutcome<Result>>;
}

/** The caller opens its working view inside the dispatched action and publishes it on success. */
export type CommitTaskSegment<View> = (body: (view: View) => void) => ActionResult;
export type DispatchTaskSegment<View> = (
  enter: (commit: CommitTaskSegment<View>) => ActionResult | void
) => ActionDispatch;

const issue = Symbol('issue committed task exit');
export interface TaskExit<View, Result> {
  readonly [issue]: (sink: ExitSink<View, Result>) => void;
}

export type TaskSegment<View, Result> = (
  view: View,
  task: TaskControl<View, Result>
) => TaskExit<View, Result>;
type Command<Value> = (signal: AbortSignal) => Value | PromiseLike<Value>;
type Resume<View, Result, Value> = (
  view: View,
  task: TaskControl<View, Result>,
  value: Value
) => TaskExit<View, Result>;

interface ExitSink<View, Result> {
  complete(value: Result): void;
  wait<Value>(command: Command<Value>, resume: Resume<View, Result, Value>): void;
}

/** A generated segment returns one exit. Its continuation captures only checked locals. */
export interface TaskControl<View, Result> {
  complete(value: Result): TaskExit<View, Result>;
  await<Value>(
    command: Command<Value>,
    resume: Resume<View, Result, Value>
  ): TaskExit<View, Result>;
}

// These constructors carry neither the current invocation nor its writable view.
const control = Object.freeze({
  complete<View, Result>(value: Result): TaskExit<View, Result> {
    return { [issue]: (sink) => sink.complete(value) };
  },
  await<View, Result, Value>(
    command: Command<Value>,
    resume: Resume<View, Result, Value>
  ): TaskExit<View, Result> {
    return { [issue]: (sink) => sink.wait(command, resume) };
  },
});

const cancelled = Object.freeze({ status: 'cancelled' } as const);
const superseded = Object.freeze({ status: 'superseded' } as const);
const ownerEnded = Object.freeze({ status: 'owner-ended' } as const);

type Terminal<Result> = TaskOutcome<Result> | { status: 'defect'; error: unknown };

interface Invocation<View, Result> extends ExitSink<View, Result> {
  readonly id: symbol;
  readonly resolve: (outcome: TaskOutcome<Result>) => void;
  readonly reject: (error: unknown) => void;
  first: TaskSegment<View, Result> | undefined;
  waiting?: { controller: AbortController; detach: () => void } | undefined;
  settled: boolean;
}

interface Delivery<Value> {
  accept?: ((value: Value) => void) | undefined;
  reject?: ((error: unknown) => void) | undefined;
}

// An uncancellable promise may outlive its owner indefinitely. Its reactions retain
// only this detachable pair, so retiring it also releases the continuation and owner.
function observeCommand<Value>(
  result: Value | PromiseLike<Value>,
  delivery: Delivery<Value>
): void {
  void Promise.resolve(result).then(
    (value) => delivery.accept?.(value),
    (error) => delivery.reject?.(error)
  );
}

export class OwnedTaskGroup<View, Result> {
  readonly #policy: TaskPolicy;
  readonly #dispatch: DispatchTaskSegment<View>;
  readonly #invocations = new Map<symbol, Invocation<View, Result>>();
  #serial: symbol | undefined;
  #advancing = false;
  #disposed = false;

  constructor(policy: TaskPolicy, dispatch: DispatchTaskSegment<View>) {
    this.#policy = policy;
    this.#dispatch = dispatch;
  }

  /** A discarded action creates no invocation and never calls issued. */
  start(
    afterCommit: PostCommit,
    first: TaskSegment<View, Result>,
    issued?: (task: TaskInvocation<Result>) => void
  ): void {
    afterCommit(() => this.#admit(first, issued));
  }

  /** Omitting the identity cancels all invocations of this declaration at commit. */
  cancel(afterCommit: PostCommit, id?: symbol): void {
    afterCommit(() => {
      if (id === undefined) {
        this.#stopAll(cancelled);
      } else {
        const invocation = this.#invocations.get(id);
        if (invocation) this.#finish(invocation, cancelled);
      }
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#stopAll(ownerEnded);
  }

  #admit(first: TaskSegment<View, Result>, issued?: (task: TaskInvocation<Result>) => void): void {
    if (this.#disposed) {
      if (issued) issued({ id: Symbol(), completion: Promise.resolve(ownerEnded) });
      return;
    }
    const id = Symbol();
    let invocation!: Invocation<View, Result>;
    // The emitted React consumer targets ES2022, before Promise.withResolvers.
    const completion = new Promise<TaskOutcome<Result>>((resolve, reject) => {
      invocation = {
        id,
        first,
        resolve,
        reject,
        settled: false,
        complete: (value) => this.#finish(invocation, { status: 'completed', value }),
        wait: (command, resume) => this.#wait(invocation, command, resume),
      };
    });
    const previous =
      this.#policy === 'latest' ? this.#invocations.values().next().value : undefined;
    this.#invocations.set(id, invocation);
    // Install the replacement before an old extern's synchronous abort listeners run.
    if (previous) this.#finish(previous, superseded);
    try {
      issued?.({ id, completion });
    } finally {
      if (this.#policy === 'serial') this.#advance();
      else this.#begin(invocation);
    }
  }

  #begin(invocation: Invocation<View, Result>): void {
    const first = invocation.first;
    if (!first) return;
    invocation.first = undefined;
    this.#run(invocation, first);
  }

  #advance(): void {
    if (this.#policy !== 'serial' || this.#advancing || this.#serial !== undefined) return;
    this.#advancing = true;
    try {
      // A synchronous terminal result can free the slot before dispatch returns.
      while (this.#serial === undefined) {
        const next = this.#invocations.values().next().value;
        if (!next) break;
        this.#serial = next.id;
        this.#begin(next);
      }
    } finally {
      this.#advancing = false;
    }
  }

  #run(invocation: Invocation<View, Result>, segment: TaskSegment<View, Result>): void {
    const observe = (result: ActionResult): void => {
      if (result.status === 'disposed') {
        this.dispose();
        this.#finish(invocation, ownerEnded);
      } else if (result.status !== 'committed') {
        this.#finish(invocation, result);
      }
    };
    const defect = (error: unknown): void => this.#finish(invocation, { status: 'defect', error });
    try {
      const dispatch = this.#dispatch((commit) => {
        // A queued native action can lose eligibility before it actually enters.
        if (!this.#invocations.has(invocation.id)) return;
        let exit!: TaskExit<View, Result>;
        let result: ActionResult;
        try {
          result = commit((view) => {
            exit = segment(view, control);
          });
        } catch (error) {
          // The native dispatcher classifies this exception. Withdraw now so later
          // queued requests cannot supersede an already failed segment in the interim.
          this.#withdraw(invocation);
          this.#advance();
          throw error;
        }
        if (result.status === 'committed') {
          if (this.#invocations.has(invocation.id)) exit[issue](invocation);
        } else {
          observe(result);
        }
        return result;
      });
      if (dispatch.status === 'queued') void dispatch.completion.then(observe, defect);
      else observe(dispatch);
    } catch (error) {
      defect(error);
    }
  }

  #wait<Value>(
    invocation: Invocation<View, Result>,
    command: Command<Value>,
    resume: Resume<View, Result, Value>
  ): void {
    const controller = new AbortController();
    const delivery: Delivery<Value> = {};
    const detach = (): void => {
      delivery.accept = undefined;
      delivery.reject = undefined;
      invocation.waiting = undefined;
    };
    delivery.accept = (value) => {
      detach();
      this.#run(invocation, (view, task) => resume(view, task, value));
    };
    delivery.reject = (error) => {
      detach();
      this.#finish(invocation, { status: 'defect', error });
    };
    invocation.waiting = { controller, detach };
    // Install cancellation before calling the extern: it can synchronously retire its owner.
    try {
      observeCommand(command(controller.signal), delivery);
    } catch (error) {
      // The binding may have acquired cancellable work before throwing. Keep its
      // controller attached until retirement signals that work and detaches delivery.
      this.#finish(invocation, { status: 'defect', error });
    }
  }

  #withdraw(invocation: Invocation<View, Result>): AbortController | undefined {
    this.#invocations.delete(invocation.id);
    if (this.#serial === invocation.id) this.#serial = undefined;
    invocation.first = undefined;
    const waiting = invocation.waiting;
    waiting?.detach();
    return waiting?.controller;
  }

  #finish(invocation: Invocation<View, Result>, outcome: Terminal<Result>): void {
    if (invocation.settled) return;
    invocation.settled = true;
    const controller = this.#withdraw(invocation);
    if (outcome.status === 'defect') invocation.reject(outcome.error);
    else invocation.resolve(outcome);
    controller?.abort(outcome.status === 'defect' ? outcome.error : outcome);
    this.#advance();
  }

  #stopAll(outcome: typeof cancelled | typeof ownerEnded): void {
    let controllers: AbortController[] | undefined;
    for (const invocation of this.#invocations.values()) {
      invocation.settled = true;
      const controller = this.#withdraw(invocation);
      invocation.resolve(outcome);
      if (controller) (controllers ??= []).push(controller);
    }
    // Revoke every queued and running invocation before any abort listener can reenter.
    if (controllers) for (const controller of controllers) controller.abort(outcome);
  }
}
