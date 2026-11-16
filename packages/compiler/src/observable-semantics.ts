/** Observable policy is part of an artifact's contract, independent of its helper ABI. */
export type PropsUpdatePolicy = 'explicit' | 'host';

export interface ObservableSemantics {
  readonly version: 'proto-ui-observables-v1';
  readonly props: {
    readonly input: 'full-raw-snapshot';
    readonly update: PropsUpdatePolicy;
    readonly initialNotification: 'silent';
  };
  readonly state: {
    readonly write: 'synchronous';
    readonly notifications: 'fifo-recorded-snapshot-v1';
    readonly update: 'explicit';
  };
  readonly context: { readonly update: 'explicit'; readonly identity: 'nominal' };
  readonly lifecycle: {
    readonly update: 'coalescible-intent';
    readonly completion: 'host-commit-before-updated';
    readonly detach: 'preserve-owner';
    readonly disposal: 'invalidate-retained-handles';
  };
  readonly composition: {
    readonly nativeChildren: 'ordinary-host-slots';
    readonly sharedIdentity: 'explicit-artifact-link';
  };
  /** This identifies the comparison configuration; it does not claim conformance. */
  readonly adapterComparison?: {
    readonly profile: string;
    readonly autoUpdateOnPropsChange: boolean;
  };
}

export function observableSemantics(
  framework: string,
  mode: 'runtime-backed' | 'source',
  propsUpdatePolicy?: PropsUpdatePolicy
): ObservableSemantics {
  // Preserve the established v1 defaults, including Vue 2's existing host policy.
  const update =
    propsUpdatePolicy ?? (mode === 'runtime-backed' || framework === 'vue2' ? 'host' : 'explicit');
  const adapterProfile = (
    {
      react: 'A-REACT-18-19-0001',
      vue: 'A-VUE-3-0001',
      vue2: 'A-VUE-2-0001',
      'web-component': 'A-WEB-COMPONENT-0001',
    } as Readonly<Record<string, string>>
  )[framework];
  return Object.freeze({
    version: 'proto-ui-observables-v1',
    props: Object.freeze({ input: 'full-raw-snapshot', update, initialNotification: 'silent' }),
    state: Object.freeze({
      write: 'synchronous',
      notifications: 'fifo-recorded-snapshot-v1',
      update: 'explicit',
    }),
    context: Object.freeze({ update: 'explicit', identity: 'nominal' }),
    lifecycle: Object.freeze({
      update: 'coalescible-intent',
      completion: 'host-commit-before-updated',
      detach: 'preserve-owner',
      disposal: 'invalidate-retained-handles',
    }),
    composition: Object.freeze({
      nativeChildren: 'ordinary-host-slots',
      sharedIdentity: 'explicit-artifact-link',
    }),
    ...(adapterProfile
      ? {
          adapterComparison: Object.freeze({
            profile: adapterProfile,
            autoUpdateOnPropsChange: update === 'host',
          }),
        }
      : {}),
  });
}
