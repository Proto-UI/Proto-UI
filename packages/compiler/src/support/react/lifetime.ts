import { useLayoutEffect, useState } from 'react';

export class DisposedInstanceError extends Error {
  readonly code = 'disposed';

  constructor() {
    super('This React component handle has been released.');
    this.name = 'DisposedInstanceError';
  }
}

export interface InputLease<Inputs> {
  active(): boolean;
  read(): Inputs;
}

class PublishedInputs<Inputs> {
  #snapshot: { inputs: Inputs; lease?: InputLease<Inputs> } | undefined;

  attach(): () => void {
    if (!this.#snapshot) throw new Error('React input lease attached before the first input commit.');
    const lease: InputLease<Inputs> = {
      active: () => this.#snapshot?.lease === lease,
      read: () => {
        const snapshot = this.#snapshot;
        if (!snapshot || snapshot.lease !== lease) throw new DisposedInstanceError();
        return snapshot.inputs;
      },
    };
    this.#snapshot.lease = lease;
    return () => {
      if (this.#snapshot?.lease === lease) this.#snapshot = undefined;
    };
  }

  publish(inputs: Inputs): void {
    if (this.#snapshot) this.#snapshot.inputs = inputs;
    else this.#snapshot = { inputs };
  }

  lease(): InputLease<Inputs> {
    const lease = this.#snapshot?.lease;
    if (!lease) throw new DisposedInstanceError();
    return lease;
  }
}

/** A speculative or abandoned render must never publish props to an existing handle. */
export function usePublishedInputs<Inputs>(inputs: Inputs): PublishedInputs<Inputs> {
  const [owner] = useState(() => new PublishedInputs<Inputs>());
  // These effects also run in this order when React reconnects layout effects.
  useLayoutEffect(() => owner.publish(inputs), [owner, inputs]);
  useLayoutEffect(() => owner.attach(), [owner]);
  return owner;
}
