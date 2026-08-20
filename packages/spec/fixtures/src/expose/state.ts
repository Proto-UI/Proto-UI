export type ExposeStateExpectation =
  | 'external-state-handle-shape'
  | 'same-source-state-updates'
  | 'read-only-external-state'
  | 'state-surface-lifecycle';

export type ExposeStateCase = {
  id: string;
  title: string;
  specCase: string;
  covers: readonly string[];
  expectation: ExposeStateExpectation;
};

export const EXPOSE_STATE_CASES = [
  {
    id: 'external-state-handle-shape',
    title: 'expose-state projects internal state as an App Maker external handle',
    specCase: 'T-EXPOSE-STATE-0001-CASE-EXTERNAL-HANDLE',
    covers: [
      'C-EXPOSE-STATE-0001-A',
      'C-EXPOSE-STATE-0001-B',
      'C-EXPOSE-STATE-0001-C',
      'C-EXPOSE-STATE-0001-D',
      'C-EXPOSE-STATE-0001-E',
      'C-STATE-0003-D',
    ],
    expectation: 'external-state-handle-shape',
  },
  {
    id: 'same-source-state-updates',
    title: 'external get and subscribe observe the same internal state source',
    specCase: 'T-EXPOSE-STATE-0001-CASE-SAME-SOURCE',
    covers: ['C-EXPOSE-STATE-0001-G', 'C-EXPOSE-STATE-0001-H', 'C-STATE-0011-A'],
    expectation: 'same-source-state-updates',
  },
  {
    id: 'read-only-external-state',
    title: 'external state handles do not expose App Maker write capability',
    specCase: 'T-EXPOSE-STATE-0001-CASE-READ-ONLY',
    covers: ['C-EXPOSE-STATE-0001-F'],
    expectation: 'read-only-external-state',
  },
  {
    id: 'state-surface-lifecycle',
    title: 'expose-state external handles inherit expose instance lifecycle safety',
    specCase: 'T-EXPOSE-STATE-0001-CASE-LIFECYCLE',
    covers: ['C-EXPOSE-0008-B', 'C-EXPOSE-0008-E', 'C-EXPOSE-STATE-0001-I'],
    expectation: 'state-surface-lifecycle',
  },
] as const satisfies readonly ExposeStateCase[];

export const EXPOSE_STATE_SPEC_CASES = [
  ...new Set(EXPOSE_STATE_CASES.map((testCase) => testCase.specCase)),
] as const;
