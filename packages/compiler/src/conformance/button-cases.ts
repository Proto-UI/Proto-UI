import { assessCase, runOracleSuite, type CaseResult, type ContractOracle } from './result';
import type { IdentityNormalization, SemanticCheckpoint, TraceValue } from './trace';

export type ButtonAction =
  | {
      kind:
        | 'hover'
        | 'leave'
        | 'down'
        | 'up'
        | 'click'
        | 'tab'
        | 'focus'
        | 'blur'
        | 'native-child-click'
        | 'rerender'
        | 'dispose'
        | 'stale-click'
        | 'outside-click';
    }
  | { kind: 'key-down' | 'key-up'; key: string }
  | { kind: 'props'; disabled: boolean | null }
  | { kind: 'label' | 'context'; value: string }
  | { kind: 'style'; background: string | null };
export interface JourneyStep {
  id: string;
  action: ButtonAction;
  expected: Readonly<Record<string, TraceValue>>;
  criteria: readonly string[];
}
export interface ButtonCase {
  id: string;
  feature: string;
  styleFamily: 'base-unstyled' | 'base-unstyled-with-consumer-css';
  profile: 'react-runtime-v1';
  steps: readonly JourneyStep[];
  requiredCriteria: readonly string[];
}
const P = 'P-BASE-BUTTON-';
const definitions: { id: string; feature: string; steps: JourneyStep[] }[] = [
  {
    id: 'button.pointer-props',
    feature: 'pointer, disabled props and semantic click',
    steps: [
      {
        id: 'hover',
        action: { kind: 'hover' },
        expected: {
          hovered: true,
          disabled: false,
          clicks: 0,
          background: 'rgb(207, 232, 207)',
          hit: true,
        },
        criteria: [P + 'POINTER-HOVER', P + 'PROP-DISABLED', P + 'DISABLED-EXPOSE'],
      },
      {
        id: 'down',
        action: { kind: 'down' },
        expected: { pressed: true, clicks: 0 },
        criteria: [P + 'PRESS-LIFECYCLE'],
      },
      {
        id: 'up',
        action: { kind: 'up' },
        expected: { pressed: false, clicks: 1 },
        criteria: [P + 'CLICK-SIGNAL', P + 'ROLE-COMMAND'],
      },
      {
        id: 'disable',
        action: { kind: 'props', disabled: true },
        expected: {
          disabled: true,
          hovered: false,
          pressed: false,
          clicks: 1,
          ariaDisabled: 'true',
          opacity: '0.4',
        },
        criteria: [
          P + 'PROP-DISABLED-CONTROLLED',
          P + 'DISABLED-CLEAR-TRANSIENT',
          P + 'DISABLED-EXPOSE',
        ],
      },
      {
        id: 'disabled-click',
        action: { kind: 'click' },
        expected: { clicks: 1, pressed: false, hovered: false },
        criteria: [P + 'DISABLED-SUPPRESS-ACTIVATION'],
      },
      {
        id: 'omit-disabled',
        action: { kind: 'props', disabled: null },
        expected: { disabled: false, clicks: 1, opacity: '1' },
        criteria: [P + 'PROP-DISABLED-CONTROLLED'],
      },
      {
        id: 'enabled-click',
        action: { kind: 'click' },
        expected: { clicks: 2 },
        criteria: [P + 'CLICK-SIGNAL', P + 'CLICK-PROTOCOL-NAME'],
      },
      {
        id: 'leave',
        action: { kind: 'leave' },
        expected: { hovered: false, pressed: false },
        criteria: [P + 'POINTER-HOVER', P + 'PRESS-LIFECYCLE'],
      },
    ],
  },
  {
    id: 'button.state-events',
    feature: 'simulated-pointer state transitions, disabled gating and outward click',
    steps: [
      {
        id: 'hover',
        action: { kind: 'hover' },
        expected: { hovered: true, disabled: false, clicks: 0 },
        criteria: [P + 'POINTER-HOVER', P + 'PROP-DISABLED', P + 'DISABLED-EXPOSE'],
      },
      {
        id: 'down',
        action: { kind: 'down' },
        expected: { pressed: true, clicks: 0 },
        criteria: [P + 'PRESS-LIFECYCLE'],
      },
      {
        id: 'up',
        action: { kind: 'up' },
        expected: { pressed: false, clicks: 1 },
        criteria: [P + 'ROLE-COMMAND'],
      },
      {
        id: 'disable',
        action: { kind: 'props', disabled: true },
        expected: {
          disabled: true,
          hasDisabledProp: true,
          hovered: false,
          pressed: false,
          clicks: 1,
        },
        criteria: [
          P + 'PROP-DISABLED-CONTROLLED',
          P + 'DISABLED-CLEAR-TRANSIENT',
          P + 'DISABLED-EXPOSE',
        ],
      },
      {
        id: 'disabled-click',
        action: { kind: 'click' },
        expected: { clicks: 1, pressed: false, hovered: false },
        criteria: [P + 'DISABLED-SUPPRESS-ACTIVATION'],
      },
      {
        id: 'omit-disabled',
        action: { kind: 'props', disabled: null },
        expected: { disabled: false, hasDisabledProp: false, clicks: 1 },
        criteria: [P + 'PROP-DISABLED-CONTROLLED'],
      },
      {
        id: 'focus',
        action: { kind: 'focus' },
        expected: { disabled: false, clicks: 1, focused: true },
        criteria: [P + 'FOCUSABLE'],
      },
      {
        id: 'enabled-click',
        action: { kind: 'click' },
        expected: { clicks: 2, focused: true },
        criteria: [P + 'CLICK-PROTOCOL-NAME'],
      },
      {
        id: 'leave',
        action: { kind: 'leave' },
        expected: { hovered: false, pressed: false, focused: true },
        criteria: [P + 'POINTER-HOVER', P + 'PRESS-LIFECYCLE'],
      },
    ],
  },
  {
    id: 'button.keyboard-focus',
    feature: 'native keyboard focus and default action',
    steps: [
      {
        id: 'tab',
        action: { kind: 'tab' },
        expected: {
          focused: true,
          focusVisible: true,
          active: true,
          role: 'button',
          label: 'Activate',
          axRole: 'button',
          axName: 'Activate',
          clicks: 0,
        },
        criteria: [P + 'FOCUSABLE', P + 'ACCESSIBLE-ROLE', P + 'ACCESSIBLE-NAME'],
      },
      {
        id: 'enter-down',
        action: { kind: 'key-down', key: 'Enter' },
        expected: { clicks: 1 },
        criteria: [P + 'KEYBOARD-ACTIVATION', P + 'CLICK-SIGNAL'],
      },
      {
        id: 'enter-up',
        action: { kind: 'key-up', key: 'Enter' },
        expected: { clicks: 1 },
        criteria: [P + 'CLICK-SIGNAL'],
      },
      {
        id: 'space-down',
        action: { kind: 'key-down', key: ' ' },
        expected: { spacePrevented: true },
        criteria: [P + 'KEYBOARD-SPACE-PREVENT-DEFAULT'],
      },
      {
        id: 'space-up',
        action: { kind: 'key-up', key: ' ' },
        expected: { clicks: 2 },
        criteria: [P + 'KEYBOARD-ACTIVATION'],
      },
      {
        id: 'blur-before-disabled',
        action: { kind: 'blur' },
        expected: { focused: false, active: false, clicks: 2 },
        criteria: [P + 'FOCUSABLE'],
      },
      {
        id: 'disable-focus',
        action: { kind: 'props', disabled: true },
        expected: { disabled: true, focused: false, axDisabled: true },
        criteria: [P + 'DISABLED-REJECT-FOCUS'],
      },
      {
        id: 'reject-focus-request',
        action: { kind: 'focus' },
        expected: { focused: false, clicks: 2 },
        criteria: [P + 'DISABLED-REJECT-FOCUS'],
      },
      {
        id: 'enable-focus',
        action: { kind: 'props', disabled: false },
        expected: { disabled: false },
        criteria: [P + 'PROP-DISABLED-CONTROLLED'],
      },
      {
        id: 'focus-request',
        action: { kind: 'focus' },
        expected: { focused: true, active: true },
        criteria: [P + 'REQUEST-FOCUS'],
      },
    ],
  },
  {
    id: 'button.native-presentation',
    feature: 'native children, props/expose and presentation restoration',
    steps: [
      {
        id: 'hover',
        action: { kind: 'hover' },
        expected: {
          width: 160,
          height: 40,
          background: 'rgb(207, 232, 207)',
          nativeContext: 'host-value',
          hit: true,
        },
        criteria: [P + 'POINTER-HOVER', P + 'ICON-CONTENT'],
      },
      {
        id: 'style-priority',
        action: { kind: 'style', background: 'rgb(20, 40, 200)' },
        expected: { background: 'rgb(20, 40, 200)', sameHandles: true },
        criteria: [P + 'NO-VISUAL-VARIANT-CORE'],
      },
      {
        id: 'style-restore',
        action: { kind: 'style', background: null },
        expected: { background: 'rgb(207, 232, 207)', sameHandles: true },
        criteria: [P + 'PROP-VISUAL-DEFERRED'],
      },
      {
        id: 'native-label',
        action: { kind: 'label', value: 'Updated' },
        expected: { label: 'Updated', nativeContext: 'host-value', sameHandles: true },
        criteria: [P + 'CONTENT-LABEL-SOURCE', P + 'PROP-LABEL-DEFERRED'],
      },
      {
        id: 'outside-native-click',
        action: { kind: 'outside-click' },
        expected: { clicks: 0, outsideClicks: 1 },
        criteria: [P + 'CLICK-SIGNAL'],
      },
      {
        id: 'rerender',
        action: { kind: 'rerender' },
        expected: { sameHandles: true, disabled: false, label: 'Updated' },
        criteria: ['C-EXPOSE-STATE-0001-I'],
      },
    ],
  },
  {
    id: 'button.native-mixing',
    feature:
      'native React children/context, accessible content and event isolation; no paint/layout claim',
    steps: [
      {
        id: 'native-content',
        action: { kind: 'rerender' },
        expected: {
          nativeContext: 'host-value',
          nativeIcon: true,
          label: 'Activate',
          axName: 'Activate',
          sameHandles: true,
          clicks: 0,
        },
        criteria: [P + 'ICON-CONTENT', P + 'CONTENT-LABEL-SOURCE', 'C-EXPOSE-STATE-0001-I'],
      },
      {
        id: 'native-label',
        action: { kind: 'label', value: 'Updated' },
        expected: { label: 'Updated', axName: 'Updated', sameHandles: true },
        criteria: [P + 'CONTENT-LABEL-SOURCE', P + 'ACCESSIBLE-NAME'],
      },
      {
        id: 'native-context',
        action: { kind: 'context', value: 'changed-host' },
        expected: { nativeContext: 'changed-host', nativeIcon: true, sameHandles: true },
        criteria: [P + 'ICON-CONTENT'],
      },
      {
        id: 'native-child-click',
        action: { kind: 'native-child-click' },
        expected: { clicks: 1, nativeChildClicks: 1, outsideClicks: 0 },
        criteria: [P + 'CLICK-SIGNAL', P + 'CLICK-PROTOCOL-NAME'],
      },
      {
        id: 'outside-native-click',
        action: { kind: 'outside-click' },
        expected: { clicks: 1, nativeChildClicks: 1, outsideClicks: 1 },
        criteria: [P + 'CLICK-SIGNAL'],
      },
      {
        id: 'rerender',
        action: { kind: 'rerender' },
        expected: {
          sameHandles: true,
          disabled: false,
          label: 'Updated',
          nativeContext: 'changed-host',
          clicks: 1,
          outsideClicks: 1,
        },
        criteria: ['C-EXPOSE-STATE-0001-I'],
      },
    ],
  },
  {
    id: 'button.terminal-cleanup',
    feature: 'terminal cleanup and stale target rejection',
    steps: [
      {
        id: 'hover',
        action: { kind: 'hover' },
        expected: { hovered: true, present: true },
        criteria: [P + 'POINTER-HOVER'],
      },
      {
        id: 'down',
        action: { kind: 'down' },
        expected: { pressed: true },
        criteria: [P + 'PRESS-LIFECYCLE'],
      },
      {
        id: 'dispose',
        action: { kind: 'dispose' },
        expected: {
          refCleared: true,
          staleHandleInvalid: true,
          clicks: 0,
          present: false,
          staleTargetConnected: false,
        },
        criteria: ['C-EXPOSE-STATE-0001-I', 'C-LIFECYCLE-0002-G'],
      },
      {
        id: 'stale-click',
        action: { kind: 'stale-click' },
        expected: {
          refCleared: true,
          staleHandleInvalid: true,
          clicks: 0,
          present: false,
          staleTargetConnected: false,
        },
        criteria: ['C-LIFECYCLE-0002-G'],
      },
    ],
  },
];

const registry = new Map<string, ButtonCase>();
for (const definition of definitions) {
  for (const step of definition.steps) {
    Object.freeze(step.action);
    Object.freeze(step.expected);
    Object.freeze(step.criteria);
    Object.freeze(step);
  }
  registry.set(
    definition.id,
    Object.freeze({
      ...definition,
      profile: 'react-runtime-v1' as const,
      styleFamily:
        definition.id === 'button.pointer-props' || definition.id === 'button.native-presentation'
          ? ('base-unstyled-with-consumer-css' as const)
          : ('base-unstyled' as const),
      steps: Object.freeze(definition.steps),
      requiredCriteria: Object.freeze([
        ...new Set(definition.steps.flatMap((step) => step.criteria)),
      ]),
    })
  );
}

export function buttonCases(): readonly ButtonCase[] {
  return Object.freeze([...registry.values()]);
}

/** The registry, not a caller-supplied criterion subset, owns each tested claim. */
export function evaluateButtonCase(
  id: string,
  reference: readonly SemanticCheckpoint[],
  candidate: readonly SemanticCheckpoint[],
  identities?: { reference?: IdentityNormalization; candidate?: IdentityNormalization }
): CaseResult {
  const definition = registry.get(id);
  if (!definition) throw new Error(`Unknown registered Button case ${id}`);
  const oracles: ContractOracle[] = definition.requiredCriteria.map((criterion) => ({
    criterion,
    description: `Declared ${criterion} expectations for ${definition.id}`,
    test(trace) {
      return definition.steps
        .filter((step) => step.criteria.includes(criterion))
        .every((step) => {
          const snapshots = trace.filter(
            (entry) => entry.step === step.id && entry.kind === 'snapshot'
          );
          if (snapshots.length !== 1) return false;
          const data = snapshots[0].data;
          if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
          return Object.entries(step.expected).every(([key, value]) => Object.is(data[key], value));
        });
    },
  }));
  return assessCase({
    id,
    requiredCriteria: definition.requiredCriteria,
    reference: runOracleSuite(reference, oracles),
    candidate: runOracleSuite(candidate, oracles),
    identities,
  });
}
