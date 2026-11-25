import { DisposedInstanceError, type InputLease } from './lifetime.ts';

export interface ActionSource {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

export class ActionFailure extends Error {
  readonly reason: string;
  readonly source: ActionSource;

  constructor(reason: string, source: ActionSource) {
    super(`${source.file}:${source.start}-${source.end}: ${reason}`);
    this.name = 'ActionFailure';
    this.reason = reason;
    this.source = source;
  }
}

export type ActionResult =
  | { readonly status: 'committed' }
  | { readonly status: 'failed'; readonly reason: string; readonly source: ActionSource }
  | { readonly status: 'disposed' }
  | { readonly status: 'effect-failed'; readonly errors: readonly unknown[] };

export type ActionDispatch =
  | ActionResult
  | {
      readonly status: 'queued';
      readonly completion: Promise<ActionResult>;
    };

const committed = Object.freeze({ status: 'committed' } as const);
const disposed = Object.freeze({ status: 'disposed' } as const);

/** Field values are immutable, including token sequences. Copy on the first write. */
export class FieldDraft<Fields extends object> {
  readonly #base: Fields;
  current: Fields;

  constructor(fields: Fields) {
    this.#base = fields;
    this.current = fields;
  }

  edit(): Fields {
    if (this.current === this.#base) this.current = { ...this.#base };
    return this.current;
  }
}

export class FieldStore<Fields extends object> {
  #fields: Fields;
  readonly #listeners = new Set<() => void>();

  constructor(fields: Fields) {
    this.#fields = fields;
  }

  readonly snapshot = (): Fields => this.#fields;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  publish(next: Fields, same: (before: Fields, after: Fields) => boolean): unknown[] | undefined {
    if (this.#fields === next || same(this.#fields, next)) return undefined;
    this.#fields = next;
    let errors: unknown[] | undefined;
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch (error) {
        (errors ??= []).push(error);
      }
    }
    return errors;
  }
}

export class SignalQueue<Inputs> {
  #effects?: Array<(inputs: Inputs) => void>;

  send<T>(listener: (inputs: Inputs) => ((value: T) => void) | undefined, value: T): void {
    // The instruction captures its payload. Each published event resolves the
    // active host listener, including changes committed by a preceding listener.
    (this.#effects ??= []).push((inputs) => listener(inputs)?.(value));
  }

  deliver(lease: InputLease<Inputs>, errors: unknown[] | undefined): unknown[] | undefined {
    if (!this.#effects) return errors;
    for (const effect of this.#effects) {
      if (!lease.active()) {
        (errors ??= []).push(new DisposedInstanceError());
        break;
      }
      try {
        effect(lease.read());
      } catch (error) {
        (errors ??= []).push(error);
      }
    }
    return errors;
  }
}

/** Publication precedes every signal. A callback failure cannot roll back publication. */
export function finishAction<Inputs>(
  lease: InputLease<Inputs>,
  signals: SignalQueue<Inputs>
): ActionResult;
export function finishAction<Inputs, Fields extends object>(
  lease: InputLease<Inputs>,
  signals: SignalQueue<Inputs> | undefined,
  store: FieldStore<Fields>,
  next: Fields,
  same: (before: Fields, after: Fields) => boolean
): ActionResult;
export function finishAction<Inputs, Fields extends object>(
  lease: InputLease<Inputs>,
  signals?: SignalQueue<Inputs>,
  store?: FieldStore<Fields>,
  next?: Fields,
  same?: (before: Fields, after: Fields) => boolean
): ActionResult {
  if (!lease.active()) return disposed;
  let errors = store?.publish(next!, same!);
  if (signals) errors = signals.deliver(lease, errors);
  return errors ? { status: 'effect-failed', errors } : committed;
}

// A host callback can dispatch into another instance in this JS execution domain.
interface PendingAction {
  readonly execute: () => ActionResult;
  readonly resolve: (result: ActionResult) => void;
  readonly reject: (reason: unknown) => void;
  next?: PendingAction;
}

let running = false;
let first: PendingAction | undefined;
let last: PendingAction | undefined;

export function dispatchAction<Inputs>(
  lease: InputLease<Inputs>,
  action: (inputs: Inputs) => ActionResult | void
): ActionDispatch {
  if (!lease.active()) return disposed;
  function execute(): ActionResult {
    if (!lease.active()) return disposed;
    try {
      return action(lease.read()) ?? committed;
    } catch (error) {
      if (!(error instanceof ActionFailure)) throw error;
      return { status: 'failed', reason: error.reason, source: error.source };
    }
  }
  if (running) {
    // The public support module also type-checks in ES2022 React consumers.
    const completion = new Promise<ActionResult>((resolve, reject) => {
      const job: PendingAction = { execute, resolve, reject };
      if (last) last.next = job;
      else first = job;
      last = job;
    });
    return { status: 'queued', completion };
  }
  running = true;
  try {
    return execute();
  } finally {
    try {
      // Detach each completed job so a chain of reentries retains only pending work.
      while (first) {
        const job: PendingAction = first;
        first = job.next;
        if (!first) last = undefined;
        try {
          job.resolve(job.execute());
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      running = false;
    }
  }
}

/** Native clicks have no return channel. Surface failures through the host error path. */
export function observeNativeAction(outcome: ActionDispatch): void {
  switch (outcome.status) {
    case 'committed':
      return;
    case 'disposed':
      throw new DisposedInstanceError();
    case 'failed':
      throw new ActionFailure(outcome.reason, outcome.source);
    case 'effect-failed':
      throw new AggregateError(outcome.errors, 'Post-commit delivery failed.');
    case 'queued':
      void outcome.completion.then(observeNativeAction).catch((error: unknown) => {
        queueMicrotask(() => {
          throw error;
        });
      });
  }
}
