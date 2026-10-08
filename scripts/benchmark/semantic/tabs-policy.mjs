// This candidate is separate from the historical public-calibration oracle.
// Freeze/admission must include independent review and retained platform bytes.
export const TABS_POLICY = Object.freeze({
  id: 'independent-development-manual-tabs-v2-trust-repair',
  status: 'candidate-unreviewed',
  revision: '2026-10-05-role-resolution-cleanup',
  cleanupPolicy:
    'Already-focused After accepted; otherwise Tab from explicitly focused surviving Remove. No automatic restoration mandate.',
  split: 'development',
  semanticSource: 'dc8bf26cd903223f2dd4c8fc5fd37b8eb5227125',
  calibrationSemanticSource: 'f5bae261491368b586959f1d8b353cf372775221',
  names: ['Overview', 'Unavailable', 'Details', 'History'],
  listName: 'Reference sections',
  removeName: 'Remove reference fixture',
  afterName: 'After fixture',
  references: {
    aria: {
      url: 'https://www.w3.org/TR/wai-aria-1.2/',
      sections: ['tab', 'tablist', 'tabpanel'],
      kind: 'normative-role-semantics',
      sourceSha256: 'c0fea16fc747779569ab754d2d25bca3e2b7e8a673b8ef5362aeb9ebc73a4849',
      capturedDate: '2026-10-05',
    },
    apg: {
      url: 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/',
      sections: ['keyboardinteraction', 'wai-ariaroles,states,andproperties'],
      kind: 'non-normative-authoring-guidance',
      sourceSha256: 'b2599e40142d5061ad2dff62f5c6d3ec01c8d1588ce1358f5d48bc37a92852e1',
      capturedDate: '2026-10-05',
    },
    task: {
      path: 'benchmarks/interaction/cases/tabs-manual-activation.json',
      kind: 'public-black-box-task',
    },
    proto: {
      path: 'spec/prototypes/P-BASE-TABS.yaml',
      lifecycle: 'draft',
      kind: 'draft-proto-direction',
    },
  },
  untested: [
    'internal-context',
    'controlled-state',
    'instance-retention',
    'screen-reader',
    'cross-adapter',
    'held-out-generalization',
  ],
});
