import { useEffect, useInsertionEffect, useLayoutEffect, useState, version } from 'react';

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

export class PublishedInputs<Inputs> implements InputLease<Inputs> {
  #snapshot: { inputs: Inputs } | undefined;

  active(): boolean {
    return this.#snapshot !== undefined;
  }

  read(): Inputs {
    if (!this.#snapshot) throw new DisposedInstanceError();
    return this.#snapshot.inputs;
  }

  publish(inputs: Inputs): void {
    if (this.#snapshot) this.#snapshot.inputs = inputs;
    else this.#snapshot = { inputs };
  }

  release(): void {
    this.#snapshot = undefined;
  }
}

function useCommittedInputs<Inputs, Owner extends PublishedInputs<Inputs>>(
  inputs: Inputs,
  create: () => Owner
): Owner {
  const [owner] = useState(create);
  // The mutation phase commits inputs even in a retained hidden subtree. These
  // hooks neither update React state nor read the DOM or uncommitted render data.
  useInsertionEffect(() => owner.publish(inputs), [owner, inputs]);
  useInsertionEffect(() => () => owner.release(), [owner]);
  return owner;
}

export function useEarlierReactInputs<Inputs, Owner extends PublishedInputs<Inputs>>(
  inputs: Inputs,
  create: () => Owner
): Owner {
  const owner = useCommittedInputs(inputs, create);
  // Earlier React DOM releases skip insertion cleanup when deleting an already
  // hidden Suspense tree (react/react#30954). Its passive cleanup still runs.
  // StrictMode replays that cleanup and then reconnects the same logical owner.
  useEffect(() => () => owner.release(), [owner]);
  useLayoutEffect(() => {
    if (!owner.active()) owner.publish(inputs);
  }, [owner, inputs]);
  return owner;
}

const useInputs = /^(?:18\.|19\.[01]\.)/.test(version) ? useEarlierReactInputs : useCommittedInputs;

function createInputs<Inputs>() {
  return new PublishedInputs<Inputs>();
}

export function usePublishedInputs<Inputs>(inputs: Inputs): InputLease<Inputs> {
  return useInputs(inputs, createInputs<Inputs>);
}
