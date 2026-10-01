/**
 * One or more example of every protocol message, checked against the message
 * types by the compiler.
 *
 * The two records below are keyed by message `kind`, so the type checker
 * rejects this file if a kind is added to `messages.ts` without an example, or
 * if an example names a kind that no longer exists. That makes these examples
 * a faithful sample of the wire, and `scripts/gpui/generate-message-fixture.mts`
 * records them for the Rust envelopes to round-trip.
 *
 * Optional fields appear in some examples and not in others on purpose. The
 * Rust side must neither drop a field that is present nor add one that is not,
 * and each has to be exercised to be caught.
 */
import type { HostToPeerMessage, PeerToHostMessage } from '../src/messages';

type ExamplesByKind<M extends { kind: string }> = {
  readonly [K in M['kind']]: readonly [Extract<M, { kind: K }>, ...Extract<M, { kind: K }>[]];
};

const diagnostic = { code: 'ready-surface-missing', message: 'surface not rendered yet' } as const;

export const HOST_TO_PEER_EXAMPLES: ExamplesByKind<HostToPeerMessage> = {
  'host.hello': [
    {
      kind: 'host.hello',
      protocolVersion: 0,
      host: {
        name: 'proto-ui-gpui',
        topology: 'T0',
        gpuiRevision: '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8',
        platform: 'macos',
        backend: 'metal',
      },
      features: ['focus', 'a11y'],
    },
  ],
  'meta.set': [{ kind: 'meta.set', meta: { reducedMotion: 'reduce' } }],
  'session.open': [
    {
      kind: 'session.open',
      sessionId: 's-1',
      instanceId: 'button-1',
      prototypeKey: 'base-button',
      props: { disabled: false, label: 'Save', size: { width: 3 } },
    },
    {
      kind: 'session.open',
      sessionId: 's-3',
      instanceId: 'switch-thumb-1',
      prototypeKey: 'base-switch-thumb',
      props: {},
      parentSessionId: 's-2',
    },
  ],
  'props.set': [{ kind: 'props.set', sessionId: 's-1', props: { disabled: true } }],
  'projection.ack': [
    {
      kind: 'projection.ack',
      ack: {
        sessionId: 's-1',
        viewEpoch: 1,
        commitId: 2,
        status: 'applied',
        readySurfaces: ['proto-surface'],
        diagnostics: [],
      },
    },
    {
      kind: 'projection.ack',
      ack: {
        sessionId: 's-1',
        viewEpoch: 1,
        commitId: 3,
        status: 'failed',
        readySurfaces: [],
        // `data` absent here and present in the diagnostic message below.
        diagnostics: [diagnostic],
      },
    },
  ],
  'input.sample': [
    {
      kind: 'input.sample',
      sessionId: 's-1',
      sample: {
        sampleId: 'sample-1',
        viewEpoch: 1,
        type: 'key.down',
        leaseIds: ['l-global', 'l-root'],
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
        repeat: false,
      },
    },
    {
      // A host event carries none of the portable fields.
      kind: 'input.sample',
      sessionId: 's-1',
      sample: { sampleId: 'sample-2', viewEpoch: 1, type: 'host:focus', leaseIds: ['l-focus'] },
    },
  ],
  'focus.result': [
    { kind: 'focus.result', sessionId: 's-1', requestId: 's-1:focus:1', status: 'applied' },
    { kind: 'focus.result', sessionId: 's-1', requestId: 's-1:focus:2', status: 'not-ready' },
  ],
  'expose.call': [
    { kind: 'expose.call', sessionId: 's-1', callId: 'c-1', name: 'focus', args: [1, 'two', null] },
  ],
  'session.dispose': [{ kind: 'session.dispose', sessionId: 's-1' }],
};

export const PEER_TO_HOST_EXAMPLES: ExamplesByKind<PeerToHostMessage> = {
  'peer.hello': [
    {
      kind: 'peer.hello',
      protocolVersion: 0,
      peer: { name: '@proto.ui/adapter-gpui-peer', runtimeVersion: '0.2.0' },
      bundle: { bundleId: 'base', digest: 'sha256:0f00', entries: ['base-button'] },
      features: [],
    },
  ],
  'session.opened': [{ kind: 'session.opened', sessionId: 's-1', status: 'ok', diagnostics: [] }],
  'projection.install': [
    {
      kind: 'projection.install',
      transaction: {
        protocolVersion: 0,
        sessionId: 's-1',
        instanceId: 'button-1',
        viewEpoch: 1,
        commitId: 1,
        template: { tag: 'proto-surface', children: [] },
        slots: { slots: ['default'] },
        events: {
          registrations: [
            { leaseId: 'l-root', scope: 'root', type: 'press.commit' },
            { leaseId: 'l-global', scope: 'global', type: 'key.down' },
          ],
          // A lone trigger anchors its own group.
          trigger: { anchor: 's-1' },
        },
        focus: { targets: [{ ref: 'focus-root', sequential: true, programmatic: true }] },
        // Optional snapshot fields absent here and present in `a11y.snapshot`.
        style: ['inline-flex', 'items-center', 'rounded-md'],
        a11y: { semanticObjectId: 'button-1', states: {}, actions: {}, relations: {} },
      },
    },
    {
      kind: 'projection.install',
      transaction: {
        protocolVersion: 0,
        sessionId: 's-2',
        instanceId: 'separator-1',
        viewEpoch: 1,
        commitId: 1,
        template: null,
        slots: { slots: [] },
        events: { registrations: [] },
        focus: { targets: [] },
        style: [],
        a11y: null,
      },
    },
  ],
  'projection.activate': [
    { kind: 'projection.activate', sessionId: 's-1', viewEpoch: 1, commitId: 1 },
  ],
  'projection.detach': [{ kind: 'projection.detach', sessionId: 's-1', viewEpoch: 1 }],
  'lease.release': [{ kind: 'lease.release', sessionId: 's-1', leaseIds: ['l-root'] }],
  'default-action.prevent': [
    {
      kind: 'default-action.prevent',
      // `source` absent, `reason` present.
      request: { sessionId: 's-1', sampleId: 'sample-1', reason: 'focus.scope.trap' },
    },
  ],
  'focus.request': [
    {
      kind: 'focus.request',
      sessionId: 's-1',
      requestId: 's-1:focus:1',
      target: 'focus-root',
      action: 'focus',
      options: { preventScroll: true },
    },
    {
      kind: 'focus.request',
      sessionId: 's-1',
      requestId: 's-1:focus:2',
      target: 'focus-root',
      action: 'blur',
      options: {},
    },
  ],
  'expose.descriptor': [
    {
      kind: 'expose.descriptor',
      sessionId: 's-1',
      revision: 1,
      states: { pressed: false },
      methods: ['focus'],
      signals: ['click'],
      unsupported: ['element'],
    },
  ],
  'expose.state': [
    { kind: 'expose.state', sessionId: 's-1', revision: 2, name: 'pressed', value: true },
  ],
  'expose.signal': [
    { kind: 'expose.signal', sessionId: 's-1', name: 'click', payload: { detail: 1 } },
  ],
  'expose.result': [
    {
      kind: 'expose.result',
      sessionId: 's-1',
      callId: 'c-1',
      status: 'ok',
      value: null,
      diagnostics: [],
    },
  ],
  'focus.plan': [
    {
      kind: 'focus.plan',
      sessionId: 's-1',
      viewEpoch: 1,
      focus: { targets: [{ ref: 'focus-root', sequential: false, programmatic: true }] },
    },
  ],
  'style.apply': [
    { kind: 'style.apply', sessionId: 's-1', viewEpoch: 1, tokens: ['inline-flex', 'opacity-50'] },
    // An empty list clears the feedback style.
    { kind: 'style.apply', sessionId: 's-1', viewEpoch: 1, tokens: [] },
  ],
  'a11y.snapshot': [
    {
      kind: 'a11y.snapshot',
      sessionId: 's-1',
      viewEpoch: 1,
      snapshot: {
        semanticObjectId: 'button-1',
        id: 'save-button',
        role: 'button',
        name: { kind: 'text', value: 'Save' },
        states: { disabled: false, pressed: 'mixed' },
        actions: { activate: { event: 'press.commit' }, focus: {} },
        relations: { controls: 'panel-1', describedby: ['hint-1', 'hint-2'], labelledby: null },
        level: 2,
      },
    },
    {
      kind: 'a11y.snapshot',
      sessionId: 's-1',
      viewEpoch: 1,
      snapshot: {
        semanticObjectId: 'button-1',
        name: { kind: 'content' },
        states: {},
        actions: {},
        relations: {},
      },
    },
    { kind: 'a11y.snapshot', sessionId: 's-1', viewEpoch: 2, snapshot: null },
  ],
  'session.disposed': [{ kind: 'session.disposed', sessionId: 's-1' }],
  lifecycle: [{ kind: 'lifecycle', sessionId: 's-1', event: { phase: 'mounted', commitId: 1 } }],
  diagnostic: [
    {
      kind: 'diagnostic',
      sessionId: 's-1',
      diagnostic: { code: 'stale-sample', message: 'retired epoch', data: { viewEpoch: 0 } },
    },
    // A diagnostic that belongs to no session carries `null`, not an absence.
    { kind: 'diagnostic', sessionId: null, diagnostic },
  ],
};
