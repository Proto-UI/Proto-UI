import { createContext, useContext, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { HostValueError } from './values.ts';

export type InputPresence<T> =
  | { readonly kind: 'omitted' }
  | { readonly kind: 'present'; readonly value: T };
export const omittedInput = Object.freeze({ kind: 'omitted' } as const);
export function presentInput<T>(value: T) {
  return Object.freeze({ kind: 'present' as const, value });
}

/** React host diagnostics are scoped to a subtree, independently of authored props and events. */
export const InputRejectionContext = /* @__PURE__ */ createContext<(error: HostValueError) => void>(
  (error) => console.error(error)
);

/** Only a committed render establishes fixed input presence. A failed candidate
 * renders with the same complete input snapshot observed by its retained owner. */
export function useFixedInputs<Props extends object, Inputs extends object>(
  props: Props,
  read: (props: Props) => Inputs,
  check: (previous: Inputs, next: Inputs) => void
): Inputs {
  const previous = useRef<Inputs | undefined>(undefined);
  const reported = useRef<HostValueError | undefined>(undefined);
  const report = useContext(InputRejectionContext);
  let inputs: Inputs;
  let failure: HostValueError | undefined;
  try {
    inputs = read(props);
    if (previous.current !== undefined) check(previous.current, inputs);
  } catch (error) {
    if (!(error instanceof HostValueError) || previous.current === undefined) throw error;
    failure = error;
    inputs = previous.current;
  }
  useInsertionEffect(() => {
    previous.current = inputs;
  }, [inputs]);
  useLayoutEffect(() => {
    if (!failure) {
      reported.current = undefined;
      return;
    }
    // Reporting may update the Provider's React state and recreate the same
    // invalid props. Notify once until a legal commit or a different failure.
    const last = reported.current;
    if (last && last.origin === failure.origin && last.message === failure.message) return;
    reported.current = failure;
    report(failure);
  }, [failure, report]);
  return inputs;
}
