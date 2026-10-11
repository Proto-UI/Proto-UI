export type LifecycleCallbackOrderExpectation =
  | 'lifecycle-registration-defers-callback-invocation'
  | 'setup-created-render-commit-mounted'
  | 'queued-mounted-callback-invalidated-after-unmount'
  | 'update-render-commit-updated'
  | 'repeatable-unmounted-preserves-instance-until-terminal-dispose'
  | 'setup-created-once-mounted-unmounted-per-epoch'
  | 'direct-and-hook-callbacks-run-in-registration-order';

export type LifecycleTracePoint =
  | 'setup'
  | 'created'
  | 'first-render'
  | 'commit'
  | 'mounted'
  | 'update'
  | 'update-render'
  | 'update-commit'
  | 'updated'
  | 'unmount-begin'
  | 'unmounted'
  | 'dispose';

export type LifecycleCallbackOrderCase = {
  id: string;
  title: string;
  specCase: string;
  covers: readonly string[];
  expectation: LifecycleCallbackOrderExpectation;
  expectedOrder?: readonly LifecycleTracePoint[];
  expectedCallbackOrder?: readonly string[];
  notes?: readonly string[];
};

export const LIFECYCLE_CALLBACK_ORDER_CASES = [
  {
    id: 'same-checkpoint-authored-registration-order',
    title: 'direct and once-hook callbacks share the successful setup registration sequence',
    specCase: 'T-LIFECYCLE-0001-CASE-SAME-CHECKPOINT-FIFO',
    covers: ['C-LIFECYCLE-0002-I'],
    expectation: 'direct-and-hook-callbacks-run-in-registration-order',
    expectedCallbackOrder: ['A', 'B', 'C', 'D'],
    notes: [
      'Setup registers outer A, once-hook B, outer C, the same hook again, then outer D. Normal RuntimeSession evidence is separate from this portable expectation.',
    ],
  },
  {
    id: 'setup-registration-setup-only',
    title: 'lifecycle callback registration defers invocation to runtime flow',
    specCase: 'T-LIFECYCLE-0001-CASE-SETUP-REGISTRATION',
    covers: ['C-LIFECYCLE-0002-A'],
    expectation: 'lifecycle-registration-defers-callback-invocation',
    notes: ['Registration records callbacks; runtime lifecycle flow invokes them later.'],
  },
  {
    id: 'initial-created-render-commit-mounted',
    title: 'initial lifecycle order reaches mounted only after first commit',
    specCase: 'T-LIFECYCLE-0001-CASE-INITIAL-ORDER',
    covers: ['C-LIFECYCLE-0002-B', 'C-LIFECYCLE-0002-C', 'C-LIFECYCLE-0002-D'],
    expectation: 'setup-created-render-commit-mounted',
    expectedOrder: ['setup', 'created', 'first-render', 'commit', 'mounted'],
  },
  {
    id: 'queued-mounted-cancelled-after-unmount',
    title: 'queued mounted callback is invalidated when unmount wins the race',
    specCase: 'T-LIFECYCLE-0001-CASE-MOUNTED-CANCELLED-AFTER-UNMOUNT',
    covers: ['C-LIFECYCLE-0002-D'],
    expectation: 'queued-mounted-callback-invalidated-after-unmount',
    expectedOrder: ['setup', 'created', 'first-render', 'commit', 'unmount-begin', 'unmounted'],
    notes: ['The absence of `mounted` after `unmounted` is the observable requirement.'],
  },
  {
    id: 'update-render-commit-updated',
    title: 'update lifecycle order runs updated after update commit completion',
    specCase: 'T-LIFECYCLE-0001-CASE-UPDATE-CYCLE-ORDER',
    covers: ['C-LIFECYCLE-0002-E'],
    expectation: 'update-render-commit-updated',
    expectedOrder: ['update', 'update-render', 'update-commit', 'updated'],
    notes: ['`update-commit` represents the commit completion boundary in this fixture.'],
  },
  {
    id: 'unmounted-before-dispose-availability',
    title: 'unmounted callback has an availability window before dispose',
    specCase: 'T-LIFECYCLE-0001-CASE-UNMOUNT-DISPOSAL-BOUNDARY',
    covers: ['C-LIFECYCLE-0002-F', 'C-LIFECYCLE-0002-G'],
    expectation: 'repeatable-unmounted-preserves-instance-until-terminal-dispose',
    expectedOrder: ['unmount-begin', 'unmounted', 'dispose'],
    notes: ['Runtime-managed handles remain usable during `unmounted` and fail after `dispose`.'],
  },
  {
    id: 'repeatable-mount-epochs',
    title: 'one instance repeats mount epochs without rerunning setup or created',
    specCase: 'T-LIFECYCLE-0001-CASE-REPEATED-MOUNT-EPOCHS',
    covers: ['C-LIFECYCLE-0002-H'],
    expectation: 'setup-created-once-mounted-unmounted-per-epoch',
    expectedOrder: [
      'setup',
      'created',
      'first-render',
      'commit',
      'mounted',
      'unmount-begin',
      'unmounted',
      'first-render',
      'commit',
      'mounted',
      'unmount-begin',
      'unmounted',
      'dispose',
    ],
  },
] as const satisfies readonly LifecycleCallbackOrderCase[];

export const LIFECYCLE_CALLBACK_ORDER_SPEC_CASES = [
  ...new Set(LIFECYCLE_CALLBACK_ORDER_CASES.map((testCase) => testCase.specCase)),
] as const;
