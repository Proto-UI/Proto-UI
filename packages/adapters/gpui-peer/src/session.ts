import { isExposeEventDeclaration } from '@proto.ui/module-expose';
import {
  createAdapterHost,
  createScopedExposesReader,
  type AdapterHostSession,
} from '@proto.ui/adapter-base';
import {
  isA11ySemanticObjectRef,
  mergeTwTokensV0,
  type A11ySemanticObjectSnapshot,
  type EffectsPort,
  type InstanceAssociations,
  type FocusRequestOptions,
  type Prototype,
  type StyleHandle,
  type TemplateChildren,
} from '@proto.ui/core';
import type { ModuleWiring, RuntimeLifecycleEvent } from '@proto.ui/runtime';
import { A11Y_PROJECT_CAP, type A11yProjector } from '@proto.ui/module-a11y';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_MERGE_GROUP_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  EVENT_GLOBAL_INPUT_SCOPE_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import {
  EXPOSES_RECORD_SINK_CAP,
  isExposeStateExternalHandle,
} from '@proto.ui/module-expose-state';
import {
  FOCUS_BLUR_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_IS_NATIVELY_FOCUSABLE_CAP,
  FOCUS_ORDER_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_SET_ENTRY_FOCUSABLE_CAP,
  FOCUS_SET_FOCUSABLE_CAP,
  FOCUS_TARGET_READY_CAP,
} from '@proto.ui/module-focus';
import {
  CONTROL_LABEL_HOST_CAP,
  CONTROL_LABEL_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-control-label';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import { AVAILABLE_SPACE_HOST_CAP } from '@proto.ui/module-positioning';
import { OVERLAY_TARGET_HOST_CAP } from '@proto.ui/module-overlay';
import {
  HOST_PROTOCOL_VERSION,
  WireBoundaryError,
  assertWireValue,
  type A11ySnapshotWire,
  type EventRegistration,
  type FocusPlan,
  type HostDiagnostic,
  type HostToPeerMessage,
  type InputSample,
  type PeerToHostMessage,
  type ProjectionAck,
  type ProjectionTransaction,
  type WireRecord,
  type WireValue,
} from '@proto.ui/host-protocol';

import { createPeerEventBus, type PeerBusEvent, type PeerBusRegistration } from './bus';
import { serializeTemplate } from './template';
import { createPeerControlLabelHost, type NativeScopeLookup } from './control-label';
import { createPeerAvailableSpaceHost } from './available-space';

export type PeerSessionArgs = {
  readonly sessionId: string;
  readonly instanceId: string;
  readonly prototype: Prototype<any>;
  readonly props: WireRecord;
  /**
   * The session whose instance this one belongs to, such as a Switch for its
   * thumb. It must already be mounted: the instance resolves its context,
   * anatomy domain and trigger group through it during setup.
   */
  readonly parent?: PeerSession;
  readonly send: (message: PeerToHostMessage) => void;
  readonly schedule?: (task: () => void) => void;
  /** Reads the environment the host reported, for rules to read as meta. */
  readonly getMeta?: (key: string) => unknown;
  /** Actual native tree identities, shared only by sessions on this connection. */
  readonly nativeScope?: NativeScopeLookup;
  readonly nativeA11yId?: (ref: object) => string;
  /** The order the host last reported it shows the sessions' views in. */
  readonly getOrder?: () => readonly string[];
};

export type PeerLeaseView = {
  readonly leaseId: string;
  readonly scope: 'root' | 'global';
  readonly type: string;
};

export type PeerSessionSnapshot = {
  readonly sessionId: string;
  readonly viewEpoch: number;
  readonly commitId: number;
  readonly activated: boolean;
  readonly targetReady: boolean;
  readonly leases: readonly PeerLeaseView[];
  readonly diagnostics: readonly HostDiagnostic[];
};

export type PeerSession = {
  readonly sessionId: string;
  /** The instance's opaque identity, shared by every module that asks for one. */
  readonly token: object;
  mount(): Promise<void>;
  setProps(props: WireRecord): void;
  setAssociations(associations: InstanceAssociations): void;
  handle(message: HostToPeerMessage): void;
  /** Ends the session, after every session opened inside it, the latest first. */
  dispose(): Promise<void>;
  snapshot(): PeerSessionSnapshot;
};

const FOCUS_ROOT_REF = 'focus-root';

type FocusTargetObject = { readonly ref: string; tabIndex?: number };

function toWireValue(
  value: unknown
): { ok: true; value: WireValue } | { ok: false; reason: string } {
  if (value === undefined) return { ok: true, value: null };
  try {
    assertWireValue(value);
    return { ok: true, value: value as WireValue };
  } catch (error) {
    if (error instanceof WireBoundaryError) return { ok: false, reason: error.message };
    throw error;
  }
}

/** What the peer knows about an instance, by its token. */
type InstanceRecord = {
  readonly sessionId: string;
  readonly prototype: Prototype<any>;
  readonly parent: object | null;
  readonly acceptingChildren: () => boolean;
  readonly a11yIdOf: (ref: object) => string;
};

/**
 * Every instance the peer runs in this realm. Sessions share a realm, as the
 * Context module's providers do, so a lookup that walks up from one instance
 * reaches the instances the host composed it into.
 */
const instances = new WeakMap<object, InstanceRecord>();

/** The sessions opened inside each instance, by its token, in opening order. */
const openedInside = new WeakMap<object, Set<PeerSession>>();

/** The session each focus target is the root of. */
const sessionOfTarget = new WeakMap<object, string>();

function recordOf(instance: unknown): InstanceRecord | undefined {
  return instance !== null && typeof instance === 'object' ? instances.get(instance) : undefined;
}

const parentOf = (instance: unknown): object | null => recordOf(instance)?.parent ?? null;
const prototypeOf = (instance: unknown): Prototype<any> | null =>
  recordOf(instance)?.prototype ?? null;

export function createPeerSession(args: PeerSessionArgs): PeerSession {
  const { sessionId, instanceId, prototype, send } = args;
  // Seal the whole ownership chain before setup: an older child can still be
  // alive while a newer sibling delays their common owner's terminal teardown.
  for (let token = args.parent?.token ?? null; token !== null; ) {
    const owner = recordOf(token);
    if (!owner) {
      throw new Error(`session ${args.parent!.sessionId} has ended; nothing opens inside it`);
    }
    if (!owner.acceptingChildren()) {
      throw new Error(`session ${owner.sessionId} is closing or failed; nothing opens inside it`);
    }
    token = owner.parent;
  }
  const schedule = args.schedule ?? ((task: () => void) => queueMicrotask(task));

  let raw: Record<string, unknown> = { ...args.props };
  let associations: InstanceAssociations = {};
  let viewEpoch = 0;
  let commitId = 0;
  let activated = false;
  let targetReady = false;
  let viewInstalled = false;
  // `disposed` is terminal: no outbound traffic after the final notice.
  // `acceptingInbound` flips first so teardown can still flush lease
  // releases, which is the whole point of the unbind that teardown performs.
  let disposed = false;
  let acceptingInbound = true;
  let disposal: Promise<void> | null = null;
  let pendingAck: { viewEpoch: number; commitId: number } | null = null;
  const diagnostics: HostDiagnostic[] = [];

  const diagnose = (code: string, message: string, data?: WireValue) => {
    const diagnostic: HostDiagnostic =
      data === undefined ? { code, message } : { code, message, data };
    diagnostics.push(diagnostic);
    send({ kind: 'diagnostic', sessionId, diagnostic });
  };

  // ---------------------------------------------------------------------
  // Event leases: one lease per bus registration, never reused.
  // ---------------------------------------------------------------------
  let leaseCounter = 0;
  const leaseByRegistration = new Map<PeerBusRegistration, string>();
  const registrationByLease = new Map<
    string,
    { scope: 'root' | 'global'; registration: PeerBusRegistration }
  >();
  let flushingCommit = false;
  const pendingReleases: string[] = [];

  const observeBus = (scope: 'root' | 'global') => ({
    onAdd(registration: PeerBusRegistration) {
      const leaseId = `${sessionId}:lease:${++leaseCounter}`;
      leaseByRegistration.set(registration, leaseId);
      registrationByLease.set(leaseId, { scope, registration });
    },
    onRemove(registration: PeerBusRegistration) {
      const leaseId = leaseByRegistration.get(registration);
      if (!leaseId) return;
      leaseByRegistration.delete(registration);
      registrationByLease.delete(leaseId);
      pendingReleases.push(leaseId);
      if (!flushingCommit) flushReleases();
    },
  });

  const flushReleases = () => {
    if (pendingReleases.length === 0 || disposed) return;
    const leaseIds = pendingReleases.splice(0, pendingReleases.length);
    send({ kind: 'lease.release', sessionId, leaseIds });
  };

  const rootBus = createPeerEventBus(observeBus('root'));
  const globalBus = createPeerEventBus(observeBus('global'));
  const globalInputScope = Object.freeze({ scope: `${sessionId}:window` });

  const currentRegistrations = (): EventRegistration[] => {
    const registrations: EventRegistration[] = [];
    for (const [leaseId, entry] of registrationByLease) {
      registrations.push({ leaseId, scope: entry.scope, type: entry.registration.type });
    }
    return registrations;
  };

  // ---------------------------------------------------------------------
  // Focus: one opaque target for the ProtoSurface.
  // ---------------------------------------------------------------------
  const focusTarget: FocusTargetObject = { ref: FOCUS_ROOT_REF };
  sessionOfTarget.set(focusTarget, sessionId);
  let focusSequential = false;
  let focusProgrammatic = false;
  const focusPlan = (): FocusPlan => ({
    targets: [
      { ref: FOCUS_ROOT_REF, sequential: focusSequential, programmatic: focusProgrammatic },
    ],
  });
  let focusRequestCounter = 0;
  const readyListeners = new Set<() => void>();

  const notifyTargetReady = () => {
    for (const listener of [...readyListeners]) listener();
  };

  // ---------------------------------------------------------------------
  // A11y: every session in a composition tree shares one opaque-ref identity
  // mapping. A relation must name the same object as its target's snapshot,
  // never a second source-session-local spelling of that object.
  // ---------------------------------------------------------------------
  let a11yCounter = 0;
  const a11yIds = new WeakMap<object, string>();
  let latestA11y: A11ySnapshotWire | null = null;
  let a11yDirtyDuringCommit = false;
  const inheritedA11yIdOf = args.parent ? recordOf(args.parent.token)!.a11yIdOf : undefined;

  const a11yIdOf = (ref: object): string => {
    if (args.nativeA11yId) return args.nativeA11yId(ref);
    if (inheritedA11yIdOf) return inheritedA11yIdOf(ref);
    let id = a11yIds.get(ref);
    if (!id) {
      id = `${sessionId}:a11y:${++a11yCounter}`;
      a11yIds.set(ref, id);
    }
    return id;
  };

  const toA11yWire = (snapshot: A11ySemanticObjectSnapshot): A11ySnapshotWire => {
    const relations: Record<string, string | null | string[]> = {};
    for (const [key, target] of Object.entries(snapshot.relations)) {
      if (target === null || target === undefined) relations[key] = null;
      else if (typeof target === 'string') relations[key] = target;
      else if (Array.isArray(target)) {
        relations[key] = target.map((entry) =>
          isA11ySemanticObjectRef(entry) ? a11yIdOf(entry) : String(entry)
        );
      } else {
        diagnose('a11y-relation-unsupported', 'relation target shape is not supported by wire v0', {
          key,
        });
        relations[key] = null;
      }
    }
    const states: Record<string, WireValue> = {};
    for (const [key, value] of Object.entries(snapshot.states)) {
      const wire = toWireValue(value);
      states[key] = wire.ok ? wire.value : null;
      if (!wire.ok) diagnose('a11y-state-unsupported', wire.reason, { key });
    }
    const name = snapshot.name
      ? snapshot.name.kind === 'text'
        ? ({
            kind: 'text',
            value: typeof snapshot.name.value === 'string' ? snapshot.name.value : '',
          } as const)
        : ({ kind: 'content' } as const)
      : undefined;
    return {
      semanticObjectId: a11yIdOf(snapshot.objectRef),
      // Relations name their targets by this id; an empty one names nothing.
      ...(snapshot.id ? { id: snapshot.id } : {}),
      ...(snapshot.role ? { role: snapshot.role } : {}),
      ...(name ? { name } : {}),
      states,
      actions: Object.fromEntries(
        Object.entries(snapshot.actions).map(([key, spec]) => [
          key,
          spec.event ? { event: spec.event } : {},
        ])
      ),
      relations,
      ...(snapshot.level !== undefined ? { level: snapshot.level } : {}),
    };
  };

  // ---------------------------------------------------------------------
  // Feedback: the instance root's merged token list, whole each time.
  // ---------------------------------------------------------------------
  // Inside a commit, and before the first one, the latest list rides on the
  // projection, so a view shows its style from its first frame. After that a
  // change is sent as it is flushed; one that changes nothing is not sent.
  let latestStyle: readonly string[] = [];
  let queuedStyle: StyleHandle | null = null;

  const flushStyle = () => {
    const handle = queuedStyle;
    if (!handle) return;
    queuedStyle = null;
    // The same merge the Web effects port applies before it writes.
    const tokens = handle.kind === 'tw' ? mergeTwTokensV0([...handle.tokens]).tokens : [];
    if (tokens.length === latestStyle.length && tokens.every((t, i) => t === latestStyle[i])) {
      return;
    }
    latestStyle = tokens;
    if (flushingCommit || !viewInstalled || disposed) return;
    send({ kind: 'style.apply', sessionId, viewEpoch, tokens: [...latestStyle] });
  };

  const effects: EffectsPort = {
    queueStyle(handle) {
      // A newer result replaces a pending one (HC-FEEDBACK-STYLE-SINK-0001-A).
      queuedStyle = handle;
    },
    requestFlush: flushStyle,
    flushNow: flushStyle,
  };

  const projector: A11yProjector = Object.assign(
    (snapshot: A11ySemanticObjectSnapshot) => {
      latestA11y = toA11yWire(snapshot);
      if (!viewInstalled) return;
      if (flushingCommit) {
        a11yDirtyDuringCommit = true;
        return;
      }
      send({ kind: 'a11y.snapshot', sessionId, viewEpoch, snapshot: latestA11y });
    },
    {
      detach() {
        latestA11y = null;
        if (!flushingCommit && !disposed) {
          send({ kind: 'a11y.snapshot', sessionId, viewEpoch, snapshot: null });
        }
      },
      reactivate() {},
      dispose() {
        latestA11y = null;
      },
      clearHeadingLevel() {},
      hasAuthoredName: () => controlLabelHost?.hasAuthoredName() ?? true,
    }
  );

  // ---------------------------------------------------------------------
  // Expose: descriptors, subscriptions, and scoped calls.
  // ---------------------------------------------------------------------
  let exposeRevision = 0;
  let exposeUnsubscribes: Array<() => void> = [];
  let methods = new Map<string, (...callArgs: unknown[]) => unknown>();
  let hostSession: AdapterHostSession<any> | null = null;
  const exposesReader = createScopedExposesReader(() => hostSession?.invokeInCallbackScope);

  const publishExposes = (record: Record<string, unknown>) => {
    for (const off of exposeUnsubscribes) off();
    exposeUnsubscribes = [];
    methods = new Map();
    const states: Record<string, WireValue> = {};
    const signals: string[] = [];
    const unsupported: string[] = [];
    const wrapped = exposesReader.read(record);
    const revision = ++exposeRevision;

    for (const [key, value] of Object.entries(record)) {
      if (isExposeStateExternalHandle(value)) {
        const current = toWireValue(value.get());
        if (!current.ok) {
          unsupported.push(key);
          continue;
        }
        states[key] = current.value;
        const off = value.subscribe(() => {
          if (disposed) return;
          const next = toWireValue(value.get());
          if (!next.ok) {
            diagnose('expose-state-unsupported', next.reason, { name: key });
            return;
          }
          send({
            kind: 'expose.state',
            sessionId,
            revision: exposeRevision,
            name: key,
            value: next.value,
          });
        });
        exposeUnsubscribes.push(() => value.unsubscribe(off));
        continue;
      }
      const projected = wrapped[key];
      if (typeof projected === 'function') {
        methods.set(key, projected as (...callArgs: unknown[]) => unknown);
        continue;
      }
      // An exposed event is a declaration object, recognised by the Expose
      // module's own predicate; it has no `kind` field to test.
      if (isExposeEventDeclaration(value)) {
        signals.push(key);
        continue;
      }
      const constant = toWireValue(value);
      if (constant.ok) states[key] = constant.value;
      else unsupported.push(key);
    }

    send({
      kind: 'expose.descriptor',
      sessionId,
      revision,
      states,
      methods: [...methods.keys()],
      signals,
      unsupported,
    });
  };

  // ---------------------------------------------------------------------
  // Capability wiring, attached once the Runtime is ready (CP1).
  // ---------------------------------------------------------------------
  const instanceToken = Object.freeze({ instanceId });
  instances.set(instanceToken, {
    sessionId,
    prototype,
    parent: args.parent?.token ?? null,
    // acceptingInbound flips synchronously on disposal and stays false on
    // failure; retaining identity for cleanup never permits new descendants.
    acceptingChildren: () => acceptingInbound,
    a11yIdOf,
  });
  // The session of the trigger group's anchor, when this instance is a trigger.
  let triggerAnchor: string | null = null;

  const controlLabelHost = args.nativeScope
    ? createPeerControlLabelHost({
        sessionId,
        epoch: () => viewEpoch,
        live: () => viewInstalled && activated && acceptingInbound,
        scope: args.nativeScope,
        publish(plan) {
          if (flushingCommit || !viewInstalled || disposed) return;
          send({ kind: 'control-label.plan', sessionId, viewEpoch, plan });
        },
      })
    : null;

  const rootEntity = Object.freeze({});
  let lastCommit: { children: TemplateChildren } | null = null;
  let waitingForAvailableLease = false;
  let retriedAvailableLease: string | null = null;
  const retryAvailableSpace = () => {
    const plan = availableSpaceHost.plan();
    if (
      !waitingForAvailableLease ||
      !plan ||
      pendingAck ||
      !lastCommit ||
      retriedAvailableLease === plan.leaseId
    )
      return;
    retriedAvailableLease = plan.leaseId;
    const expectedEpoch = viewEpoch;
    schedule(() => {
      if (
        !acceptingInbound ||
        !viewInstalled ||
        viewEpoch !== expectedEpoch ||
        pendingAck ||
        availableSpaceHost.plan()?.leaseId !== plan.leaseId ||
        !lastCommit
      )
        return;
      waitingForAvailableLease = false;
      commit(lastCommit.children);
    });
  };
  const availableSpaceHost = createPeerAvailableSpaceHost({
    sessionId,
    root: rootEntity,
    epoch: () => viewEpoch,
    live: () => viewInstalled && acceptingInbound,
    publish(message) {
      if (flushingCommit || disposed) return;
      send(message);
      if (message.active) retryAvailableSpace();
    },
  });

  const attachCaps = (wiring: ModuleWiring) => {
    wiring.attach('event', [
      [EVENT_ROOT_TARGET_CAP, () => rootBus as unknown as EventTarget],
      [EVENT_GLOBAL_TARGET_CAP, () => globalBus as unknown as EventTarget],
      [EVENT_GLOBAL_INPUT_SCOPE_CAP, () => globalInputScope],
      [
        EVENT_CANCEL_DEFAULT_ACTION_CAP,
        (request: { event?: unknown; reason?: string; source?: string }) => {
          const sampleId = (request.event as PeerBusEvent | undefined)?.sampleId;
          if (!sampleId) {
            diagnose('default-action-no-sample', 'prevention requested outside a host sample');
            return;
          }
          send({
            kind: 'default-action.prevent',
            request: {
              sessionId,
              sampleId,
              ...(request.reason ? { reason: request.reason } : {}),
              ...(request.source ? { source: request.source } : {}),
            },
          });
        },
      ],
    ]);
    wiring.attach('expose-event', [
      [
        EXPOSE_EVENT_SINK_CAP,
        (key: string, payload?: unknown) => {
          const wire = toWireValue(payload);
          if (!wire.ok) {
            diagnose('expose-signal-unsupported', wire.reason, { name: key });
            return;
          }
          send({ kind: 'expose.signal', sessionId, name: key, payload: wire.value });
        },
      ],
    ]);
    wiring.attach('expose-state', [[EXPOSES_RECORD_SINK_CAP, publishExposes]]);
    wiring.attach('a11y', [[A11Y_PROJECT_CAP, projector]]);
    wiring.attach('positioning', [[AVAILABLE_SPACE_HOST_CAP, availableSpaceHost.host]]);
    wiring.attach('overlay', [
      [
        OVERLAY_TARGET_HOST_CAP,
        {
          root: () => (viewInstalled && acceptingInbound ? rootEntity : null),
          resolve: (target: unknown) =>
            target === rootEntity && viewInstalled && acceptingInbound ? rootEntity : null,
        },
      ],
    ]);
    if (controlLabelHost)
      wiring.attach('control-label', [
        [CONTROL_LABEL_HOST_CAP, controlLabelHost.host],
        [
          CONTROL_LABEL_RUN_IN_CALLBACK_CAP,
          (fn: () => void) => hostSession?.invokeInCallbackScope(fn),
        ],
      ]);
    wiring.attach('feedback', [[EFFECTS_CAP, effects]]);
    if (args.getMeta) wiring.attach('rule-meta', [[RULE_META_GET_CAP, args.getMeta]]);
    wiring.attach('as-trigger', [
      [AS_TRIGGER_INSTANCE_CAP, instanceToken],
      [AS_TRIGGER_PARENT_CAP, parentOf],
      [AS_TRIGGER_GET_PROTO_CAP, prototypeOf],
      [
        AS_TRIGGER_MERGE_GROUP_CAP,
        (member: unknown, anchor: unknown) => {
          // Ancestors in the chain recorded their own anchor when they set up.
          if (member === instanceToken) triggerAnchor = recordOf(anchor)?.sessionId ?? null;
        },
      ],
      [AS_TRIGGER_GET_GROUP_EVENT_TARGET_CAP, () => rootBus as unknown as EventTarget],
    ]);
    wiring.attach('context', [
      [CONTEXT_INSTANCE_TOKEN_CAP, instanceToken],
      [CONTEXT_PARENT_CAP, parentOf],
    ]);
    // No root target and no order observer: parts keep the order they
    // claimed in, which the Anatomy module falls back to (HC-ANATOMY-ORDER-0001).
    wiring.attach('anatomy', [
      [ANATOMY_INSTANCE_TOKEN_CAP, instanceToken],
      [ANATOMY_PARENT_CAP, parentOf],
      [ANATOMY_GET_PROTO_CAP, prototypeOf],
    ]);
    wiring.attach('focus', [
      [FOCUS_INSTANCE_TOKEN_CAP, instanceToken],
      [FOCUS_PARENT_CAP, parentOf],
      [
        FOCUS_ROOT_TARGET_CAP,
        () => (viewInstalled ? (focusTarget as unknown as HTMLElement) : null),
      ],
      [
        FOCUS_TARGET_READY_CAP,
        (listener: () => void) => {
          readyListeners.add(listener);
          return () => readyListeners.delete(listener);
        },
      ],
      [FOCUS_IS_NATIVELY_FOCUSABLE_CAP, () => false],
      [
        FOCUS_SET_FOCUSABLE_CAP,
        (_target: unknown, enabled: boolean, options?: { programmatic?: boolean }) => {
          const programmatic = enabled || options?.programmatic === true;
          if (enabled === focusSequential && programmatic === focusProgrammatic) return;
          focusSequential = enabled;
          focusProgrammatic = programmatic;
          // As with feedback style: a commit carries the plan, and a change
          // outside one, as a roving group moving its tab stop, is sent alone.
          if (flushingCommit || !viewInstalled || disposed) return;
          send({ kind: 'focus.plan', sessionId, viewEpoch, focus: focusPlan() });
        },
      ],
      [FOCUS_RESOLVE_ENTRY_TARGET_CAP, (container: unknown) => container],
      [FOCUS_SET_ENTRY_FOCUSABLE_CAP, () => {}],
      [
        FOCUS_REQUEST_FOCUS_CAP,
        (_target: unknown, options?: FocusRequestOptions) => {
          // Not ready: report false so the Focus module retains the request and
          // retries on readiness (HC-FOCUS-TARGET-0001-C).
          if (!targetReady || disposed) return false;
          send({
            kind: 'focus.request',
            sessionId,
            requestId: `${sessionId}:focus:${++focusRequestCounter}`,
            target: FOCUS_ROOT_REF,
            action: 'focus',
            options:
              options?.preventScroll === undefined ? {} : { preventScroll: options.preventScroll },
          });
          // T0 cannot observe application synchronously; native focus facts
          // arrive as host:focus / host:blur samples and correct this later.
          return undefined;
        },
      ],
      [
        FOCUS_BLUR_CAP,
        () => {
          if (!targetReady || disposed) return;
          send({
            kind: 'focus.request',
            sessionId,
            requestId: `${sessionId}:focus:${++focusRequestCounter}`,
            target: FOCUS_ROOT_REF,
            action: 'blur',
            options: {},
          });
        },
      ],
      [FOCUS_RUN_IN_CALLBACK_CAP, (fn: () => void) => hostSession?.invokeInCallbackScope(fn)],
      ...(args.getOrder ? [[FOCUS_ORDER_CAP, orderTargets] as const] : []),
    ]);
  };

  // A navigation's members go in the order the host shows their views in. A
  // member the host does not show leaves the whole navigation in
  // registration order (HC-FOCUS-ORDER-0001-C).
  const orderTargets = (targets: readonly object[]): readonly object[] | null => {
    const order = args.getOrder?.() ?? [];
    const position = (target: object) => {
      const session = sessionOfTarget.get(target);
      return session === undefined ? -1 : order.indexOf(session);
    };
    if (targets.some((target) => position(target) < 0)) return null;
    return [...targets].sort((left, right) => position(left) - position(right));
  };

  // ---------------------------------------------------------------------
  // Commit: one epoch transaction per Runtime commit.
  // ---------------------------------------------------------------------
  const commit = (children: TemplateChildren, signal?: { done(): void }) => {
    lastCommit = { children };
    waitingForAvailableLease = false;
    const serialized = serializeTemplate(children);
    commitId += 1;
    viewInstalled = true;
    flushingCommit = true;
    a11yDirtyDuringCommit = false;
    try {
      // Synchronously runs bindEvents() and afterRenderCommit(), so every
      // projection the host needs for this epoch is available right after.
      signal?.done();
    } finally {
      flushingCommit = false;
    }
    const transaction: ProjectionTransaction = {
      protocolVersion: HOST_PROTOCOL_VERSION,
      sessionId,
      instanceId,
      viewEpoch,
      commitId,
      template: serialized.template,
      slots: { slots: serialized.slots },
      events: {
        registrations: currentRegistrations(),
        ...(triggerAnchor === null ? {} : { trigger: { anchor: triggerAnchor } }),
      },
      focus: focusPlan(),
      style: [...latestStyle],
      a11y: latestA11y,
    };
    a11yDirtyDuringCommit = false;
    pendingAck = { viewEpoch, commitId };
    flushReleases();
    // The host needs this exact lease before lowering root-relative style.
    // Reattachment renews its opaque ID without changing semantic ownership.
    availableSpaceHost.resume();
    send({ kind: 'projection.install', transaction });
    if (controlLabelHost?.plan())
      send({ kind: 'control-label.plan', sessionId, viewEpoch, plan: controlLabelHost.plan() });
  };

  const onLifecycleEvent = (event: RuntimeLifecycleEvent) => {
    if (event.type === 'mount.render') {
      controlLabelHost?.revoke();
      availableSpaceHost.revoke();
      waitingForAvailableLease = false;
      retriedAvailableLease = null;
      viewEpoch = event.epoch;
      commitId = 0;
      activated = false;
      targetReady = false;
    }
    if (event.type === 'unmount.begin') {
      controlLabelHost?.revoke();
      availableSpaceHost.revoke();
      waitingForAvailableLease = false;
      viewInstalled = false;
      activated = false;
      targetReady = false;
    }
    if (!disposed) send({ kind: 'lifecycle', sessionId, event: event as unknown as WireRecord });
  };

  hostSession = createAdapterHost(
    prototype,
    {
      getRawProps: () => raw as any,
      getInstanceAssociations: () => associations,
      commit,
      schedule,
      onLifecycleEvent,
    },
    {
      onRuntimeReady: attachCaps,
      afterUnmount: () => {
        flushReleases();
      },
    },
    { initialMount: 'manual' }
  );

  // Whether a view exists follows the instance's view intent (C-LIFECYCLE-0008).
  // Once the host asks for the instance, each change of intent is reconciled
  // in turn against the latest intent, so an intent a newer one superseded
  // does nothing (-D). Detaching unmounts the view and keeps the instance
  // (-E); the host hears which epoch went.
  let started = false;
  let viewMounted = false;
  let reconciling: Promise<void> = Promise.resolve();
  const reconcileView = (): Promise<void> => {
    reconciling = reconciling.then(async () => {
      if (!started || !acceptingInbound || !hostSession) return;
      const { present } = hostSession.viewIntent.getSnapshot();
      if (present === viewMounted) return;
      try {
        if (present) {
          await hostSession.mount();
        } else {
          const detached = viewEpoch;
          await hostSession.unmount();
          // The host hears what the intent is now. Wanted again meanwhile, the
          // view is attached anew by the reconciliation that change queued,
          // and that replaces this one (-D); still unwanted, however it moved
          // in between, the view goes.
          if (acceptingInbound && !hostSession.viewIntent.getSnapshot().present) {
            send({ kind: 'projection.detach', sessionId, viewEpoch: detached });
          }
        }
        viewMounted = present;
      } catch (error) {
        // A failed attach or detach leaves the queue usable for the next
        // intent and for disposal.
        diagnose('view-reconcile-failed', String(error));
      }
    });
    return reconciling;
  };
  const offViewIntent = hostSession.viewIntent.subscribe(() => void reconcileView());

  const handleAck = (ack: ProjectionAck) => {
    if (
      !pendingAck ||
      ack.viewEpoch !== pendingAck.viewEpoch ||
      ack.commitId !== pendingAck.commitId
    ) {
      diagnose('stale-ack', 'acknowledgement does not match the pending transaction', {
        viewEpoch: ack.viewEpoch,
        commitId: ack.commitId,
      });
      return;
    }
    pendingAck = null;
    if (ack.status !== 'applied') {
      waitingForAvailableLease = ack.diagnostics.some(
        (entry) => entry.code === 'available-space-required'
      );
      diagnose('projection-rejected', `host answered ${ack.status}`, {
        viewEpoch: ack.viewEpoch,
        commitId: ack.commitId,
      });
      retryAvailableSpace();
      return;
    }
    // A view whose intent went while it attached is detached next; it does
    // not become live meanwhile (-D).
    if (!hostSession?.viewIntent.getSnapshot().present) return;
    send({
      kind: 'projection.activate',
      sessionId,
      viewEpoch: ack.viewEpoch,
      commitId: ack.commitId,
    });
    activated = true;
    // Re-publish after activation so the host supplies the current view lease.
    if (controlLabelHost?.plan())
      send({ kind: 'control-label.plan', sessionId, viewEpoch, plan: controlLabelHost.plan() });
    // Readiness is a fact of the current projection, not a latch. A later
    // commit whose acknowledgement omits the surface withdraws it, and Focus
    // must go back to retaining requests rather than reporting them applied
    // (HC-FOCUS-TARGET-0001-C).
    const readyNow = ack.readySurfaces.includes('proto-surface');
    if (readyNow !== targetReady) {
      targetReady = readyNow;
      // Only gaining readiness can let a retained request succeed; losing it
      // just closes the gate, so subscribers are notified on that edge alone.
      if (readyNow) hostSession?.invokeInCallbackScope(notifyTargetReady);
    }
  };

  const deliver = (sample: InputSample) => {
    if (sample.viewEpoch !== viewEpoch) {
      diagnose('stale-sample', 'sample carries a retired view epoch', {
        sampleId: sample.sampleId,
        viewEpoch: sample.viewEpoch,
      });
      return;
    }
    if (!activated) {
      diagnose('inactive-sample', 'sample arrived before activation', {
        sampleId: sample.sampleId,
      });
      return;
    }
    const scopes = new Set<'root' | 'global'>();
    for (const leaseId of sample.leaseIds) {
      const entry = registrationByLease.get(leaseId);
      if (!entry) {
        diagnose('unknown-lease', 'sample names a lease this peer does not hold', { leaseId });
        continue;
      }
      if (entry.registration.type === sample.type) scopes.add(entry.scope);
    }
    if (scopes.size === 0) return;
    const detail: Record<string, unknown> = {};
    for (const field of ['key', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat'] as const) {
      if (sample[field] !== undefined) detail[field] = sample[field];
    }
    const event: PeerBusEvent = { type: sample.type, detail, sampleId: sample.sampleId };
    if (scopes.has('global')) globalBus.dispatchEvent(event);
    if (scopes.has('root')) rootBus.dispatchEvent(event);
  };

  const peerSession: PeerSession = {
    sessionId,
    token: instanceToken,
    mount() {
      // Intent written while the instance was created applies before the
      // first view does (-H).
      started = true;
      return reconcileView();
    },
    setAssociations(next) {
      if (!acceptingInbound) return;
      hostSession?.controller.applyInstanceAssociations(next);
      associations = next;
    },
    setProps(props) {
      raw = { ...props };
      hostSession?.controller.applyRawProps(raw as any);
      // The host has no other way to ask for a re-render, so a props push is
      // also the request to reflect them. This produces a new commit in the
      // current epoch rather than a new epoch.
      hostSession?.controller.update();
    },
    handle(message) {
      if (!acceptingInbound) return;
      switch (message.kind) {
        case 'available-space.frame':
          availableSpaceHost.frame(message);
          return;
        case 'control-label.view':
          controlLabelHost?.view(message);
          return;
        case 'control-label.activate':
          controlLabelHost?.activate(message);
          return;
        case 'projection.ack':
          handleAck(message.ack);
          return;
        case 'input.sample':
          deliver(message.sample);
          return;
        case 'focus.result':
          if (message.status !== 'applied') {
            diagnose('focus-not-applied', `host reported ${message.status}`, {
              requestId: message.requestId,
            });
          }
          return;
        case 'expose.call': {
          const method = methods.get(message.name);
          if (!method) {
            send({
              kind: 'expose.result',
              sessionId,
              callId: message.callId,
              status: 'unsupported',
              value: null,
              diagnostics: [
                { code: 'unknown-method', message: `no exposed method ${message.name}` },
              ],
            });
            return;
          }
          try {
            const result = toWireValue(method(...message.args));
            send({
              kind: 'expose.result',
              sessionId,
              callId: message.callId,
              status: result.ok ? 'ok' : 'unsupported',
              value: result.ok ? result.value : null,
              diagnostics: result.ok
                ? []
                : [{ code: 'result-unsupported', message: result.reason }],
            });
          } catch (error) {
            send({
              kind: 'expose.result',
              sessionId,
              callId: message.callId,
              status: 'failed',
              value: null,
              diagnostics: [{ code: 'call-failed', message: String(error) }],
            });
          }
          return;
        }
        default:
          return;
      }
    },
    dispose() {
      // One disposal per session: asking again gets the same one, so a
      // disposal still running, or one that failed, is never taken for one
      // that finished.
      disposal ??= (async () => {
        acceptingInbound = false;
        controlLabelHost?.revoke();
        availableSpaceHost.dispose();
        offViewIntent();
        await reconciling;
        // A step that fails does not stop the rest of the teardown, and the
        // session is declared ended only when every step succeeded.
        const failures: string[] = [];
        const attempt = async (step: () => Promise<void> | undefined) => {
          try {
            await step();
          } catch (error) {
            failures.push(String(error));
          }
        };
        // No instance outlives the one it belongs to.
        for (const inside of [...(openedInside.get(instanceToken) ?? [])].reverse()) {
          await attempt(() => inside.dispose());
        }
        for (const off of exposeUnsubscribes) off();
        exposeUnsubscribes = [];
        exposesReader.invalidate();
        // Unbinding releases every host listener; those releases must reach
        // the host before the session is declared terminal.
        await attempt(() => hostSession?.dispose());
        flushReleases();
        if (failures.length > 0) {
          diagnose('dispose-failed', failures.join('; '));
          throw new Error(`session ${sessionId} did not end: ${failures.join('; ')}`);
        }
        disposed = true;
        // An ended instance is no one's parent, prototype or trigger anchor.
        instances.delete(instanceToken);
        if (args.parent) openedInside.get(args.parent.token)?.delete(peerSession);
        send({ kind: 'session.disposed', sessionId });
      })();
      return disposal;
    },
    snapshot() {
      return {
        sessionId,
        viewEpoch,
        commitId,
        activated,
        targetReady,
        leases: currentRegistrations().map((entry) => ({
          leaseId: entry.leaseId,
          scope: entry.scope,
          type: entry.type,
        })),
        diagnostics: [...diagnostics],
      };
    },
  };
  if (args.parent) {
    const inside = openedInside.get(args.parent.token) ?? new Set<PeerSession>();
    inside.add(peerSession);
    openedInside.set(args.parent.token, inside);
  }
  return peerSession;
}
