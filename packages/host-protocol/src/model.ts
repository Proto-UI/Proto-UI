import {
  HOST_PROTOCOL_VERSION,
  WireBoundaryError,
  assertWireValue,
  type CommitId,
  type DefaultActionRequest,
  type EventRegistration,
  type EventScope,
  type FocusTargetRef,
  type HostDiagnostic,
  type InputSample,
  type InstanceId,
  type LeaseId,
  type ProjectionAck,
  type ProjectionTransaction,
  type SampleId,
  type SemanticObjectId,
  type SessionId,
  type SlotRef,
  type ViewEpoch,
} from './wire';

/**
 * Deterministic model of the host side of the protocol. It exists to make
 * identity, stale rejection, retained logical state, pruning, idempotent
 * lease release, sample identity, default-action windows and terminal
 * disposal observable without a Rust process, a transport, or GPUI.
 */

export type SessionPhase = 'open' | 'disposed';

export type LeaseRecord = {
  readonly leaseId: LeaseId;
  readonly scope: EventScope;
  readonly type: string;
  readonly viewEpoch: ViewEpoch;
  readonly commitId: CommitId;
  readonly active: boolean;
  readonly released: boolean;
};

export type RetainedLogicalState = {
  readonly instanceId: InstanceId | null;
  readonly focusTargets: readonly FocusTargetRef[];
  readonly semanticObjectId: SemanticObjectId | null;
  readonly slots: readonly SlotRef[];
};

export type HostSessionSnapshot = {
  readonly sessionId: SessionId;
  readonly phase: SessionPhase;
  readonly currentEpoch: ViewEpoch | null;
  readonly currentCommit: CommitId | null;
  readonly activeEpoch: ViewEpoch | null;
  readonly leases: readonly LeaseRecord[];
  readonly retained: RetainedLogicalState;
  readonly diagnostics: readonly HostDiagnostic[];
};

export type ActivationResult = {
  readonly status: 'activated' | 'already-active' | 'stale' | 'not-installed' | 'disposed';
};

export type ReleaseResult = {
  readonly released: readonly LeaseId[];
  readonly alreadyReleased: readonly LeaseId[];
  readonly unknown: readonly LeaseId[];
};

export type DeliveryResult =
  | { readonly status: 'delivered'; readonly leaseIds: readonly LeaseId[] }
  | {
      readonly status: 'rejected';
      readonly reason:
        | 'stale-epoch'
        | 'inactive-epoch'
        | 'no-active-lease'
        | 'duplicate-sample'
        | 'disposed';
    };

export type DefaultActionResult = {
  readonly status: 'applied' | 'late-prevention' | 'duplicate' | 'unknown-sample' | 'disposed';
};

export type DetachResult = {
  readonly status: 'detached' | 'stale' | 'not-installed' | 'disposed';
  readonly releasedLeaseIds: readonly LeaseId[];
};

export type DisposeResult = {
  readonly status: 'disposed' | 'already-disposed';
  readonly releasedLeaseIds: readonly LeaseId[];
};

export type InstallOptions = {
  /** Deterministic allocation-failure injection for transactional evidence. */
  readonly failAllocation?: (registration: EventRegistration) => boolean;
};

export type HostSessionModel = {
  readonly sessionId: SessionId;
  installProjection(transaction: ProjectionTransaction, options?: InstallOptions): ProjectionAck;
  /**
   * Activation is commit-qualified. A projection is installed inactive and
   * only the exact commit that was acknowledged may be activated, so a
   * delayed activation cannot make a newer projection live.
   */
  activate(viewEpoch: ViewEpoch, commitId: CommitId): ActivationResult;
  releaseLeases(leaseIds: readonly LeaseId[]): ReleaseResult;
  deliver(sample: InputSample): DeliveryResult;
  requestDefaultActionPrevention(
    request: DefaultActionRequest,
    options: { readonly withinWindow: boolean }
  ): DefaultActionResult;
  /**
   * Retires the installed view when the instance detaches it: its leases are
   * released and nothing more is delivered to it. The session stays open, so
   * the instance keeps its logical state (C-LIFECYCLE-0008-E), and only a
   * greater epoch can install a view again.
   */
  detachView(viewEpoch: ViewEpoch): DetachResult;
  dispose(): DisposeResult;
  snapshot(): HostSessionSnapshot;
};

type MutableLease = {
  leaseId: LeaseId;
  scope: EventScope;
  type: string;
  viewEpoch: ViewEpoch;
  commitId: CommitId;
  active: boolean;
  released: boolean;
};

type DeliveredSample = {
  viewEpoch: ViewEpoch;
  decided: boolean;
};

const PROTO_SURFACE = 'proto-surface';

export function createHostSessionModel(sessionId: SessionId): HostSessionModel {
  let phase: SessionPhase = 'open';
  let currentEpoch: ViewEpoch | null = null;
  let currentCommit: CommitId | null = null;
  let activeEpoch: ViewEpoch | null = null;
  // The last view the instance detached. No projection, commit or activation
  // for it, or for anything older, can bring it back.
  let retiredEpoch: ViewEpoch | null = null;
  let instanceId: InstanceId | null = null;
  let focusTargets: readonly FocusTargetRef[] = [];
  let semanticObjectId: SemanticObjectId | null = null;
  let slots: readonly SlotRef[] = [];

  const leases = new Map<LeaseId, MutableLease>();
  const seenLeaseIds = new Set<LeaseId>();
  const samples = new Map<SampleId, DeliveredSample>();
  const diagnostics: HostDiagnostic[] = [];

  const diagnose = (code: string, message: string, data?: HostDiagnostic['data']) => {
    const diagnostic: HostDiagnostic =
      data === undefined ? { code, message } : { code, message, data };
    diagnostics.push(diagnostic);
    return diagnostic;
  };

  const ack = (
    transaction: ProjectionTransaction,
    status: ProjectionAck['status'],
    ackDiagnostics: readonly HostDiagnostic[],
    readySurfaces: readonly string[] = []
  ): ProjectionAck => ({
    sessionId,
    viewEpoch: transaction.viewEpoch,
    commitId: transaction.commitId,
    status,
    readySurfaces,
    diagnostics: ackDiagnostics,
  });

  const liveLeases = () => [...leases.values()].filter((lease) => !lease.released);

  const pruneBefore = (viewEpoch: ViewEpoch, commitId: CommitId, keep: ReadonlySet<LeaseId>) => {
    for (const lease of liveLeases()) {
      if (keep.has(lease.leaseId)) continue;
      const older =
        lease.viewEpoch < viewEpoch || (lease.viewEpoch === viewEpoch && lease.commitId < commitId);
      if (!older) continue;
      lease.active = false;
      lease.released = true;
    }
  };

  const isRetired = (viewEpoch: ViewEpoch) => retiredEpoch !== null && viewEpoch <= retiredEpoch;

  const isStale = (viewEpoch: ViewEpoch, commitId: CommitId) =>
    isRetired(viewEpoch) ||
    (currentEpoch !== null &&
      currentCommit !== null &&
      (viewEpoch < currentEpoch || (viewEpoch === currentEpoch && commitId <= currentCommit)));

  return {
    sessionId,

    installProjection(transaction, options = {}) {
      if (phase === 'disposed') {
        return ack(transaction, 'failed', [
          diagnose('session-disposed', 'projection arrived after terminal disposal'),
        ]);
      }
      try {
        assertWireValue(transaction);
      } catch (error) {
        if (!(error instanceof WireBoundaryError)) throw error;
        return ack(transaction, 'failed', [
          diagnose('wire-boundary', error.message, { path: error.path }),
        ]);
      }
      if (transaction.protocolVersion !== HOST_PROTOCOL_VERSION) {
        return ack(transaction, 'unsupported', [
          diagnose('protocol-version', 'unsupported protocol version', {
            requested: transaction.protocolVersion,
            supported: HOST_PROTOCOL_VERSION,
          }),
        ]);
      }
      if (transaction.sessionId !== sessionId) {
        return ack(transaction, 'failed', [
          diagnose('session-mismatch', 'projection belongs to another session', {
            requested: transaction.sessionId,
          }),
        ]);
      }
      if (instanceId !== null && transaction.instanceId !== instanceId) {
        return ack(transaction, 'failed', [
          diagnose('instance-mismatch', 'one session owns exactly one logical instance', {
            requested: transaction.instanceId,
            owned: instanceId,
          }),
        ]);
      }
      if (isStale(transaction.viewEpoch, transaction.commitId)) {
        return ack(transaction, 'superseded', [
          diagnose('stale-projection', 'projection is older than the current epoch or commit', {
            currentEpoch,
            currentCommit,
          }),
        ]);
      }

      // Validate the complete plan before touching any host resource. A lease
      // that is still live in the same epoch with the same scope and type is
      // carried over; every other reuse of a lease id is rejected.
      const planIds = new Set<LeaseId>();
      const carried = new Set<LeaseId>();
      for (const registration of transaction.events.registrations) {
        // Defence in depth: the wire guard already rejects holes and
        // non-records, so a malformed entry here means a caller bypassed it.
        // Answer with a bounded result instead of an implementation throw.
        if (
          !registration ||
          typeof registration !== 'object' ||
          typeof registration.leaseId !== 'string' ||
          registration.leaseId.length === 0 ||
          (registration.scope !== 'root' && registration.scope !== 'global') ||
          typeof registration.type !== 'string' ||
          registration.type.length === 0
        ) {
          return ack(transaction, 'failed', [
            diagnose('malformed-registration', 'an Event registration is not a complete record', {
              index: transaction.events.registrations.indexOf(registration),
            }),
          ]);
        }
        if (planIds.has(registration.leaseId)) {
          return ack(transaction, 'failed', [
            diagnose('duplicate-lease', 'a plan cannot register one lease id twice', {
              leaseId: registration.leaseId,
            }),
          ]);
        }
        planIds.add(registration.leaseId);
        const existing = leases.get(registration.leaseId);
        const continues =
          existing !== undefined &&
          !existing.released &&
          existing.viewEpoch === transaction.viewEpoch &&
          existing.scope === registration.scope &&
          existing.type === registration.type;
        if (continues) {
          carried.add(registration.leaseId);
          continue;
        }
        if (existing !== undefined || seenLeaseIds.has(registration.leaseId)) {
          return ack(transaction, 'failed', [
            diagnose('lease-reuse', 'a retired lease id is never reused within a session', {
              leaseId: registration.leaseId,
            }),
          ]);
        }
      }
      for (const registration of transaction.events.registrations) {
        if (carried.has(registration.leaseId)) continue;
        if (options.failAllocation?.(registration)) {
          return ack(transaction, 'failed', [
            diagnose(
              'allocation-failed',
              'host could not allocate a lease; nothing was installed',
              {
                leaseId: registration.leaseId,
              }
            ),
          ]);
        }
      }

      // Apply: prune superseded records, carry continuing leases into the new
      // commit, and install every new lease inactive. A new epoch always
      // starts inactive; a same-epoch commit keeps its carried leases live.
      const sameEpoch = currentEpoch === transaction.viewEpoch;
      pruneBefore(transaction.viewEpoch, transaction.commitId, carried);
      currentEpoch = transaction.viewEpoch;
      currentCommit = transaction.commitId;
      if (!sameEpoch) activeEpoch = null;
      instanceId = transaction.instanceId;
      focusTargets = transaction.focus.targets.map((target) => target.ref);
      slots = [...transaction.slots.slots];
      if (transaction.a11y) semanticObjectId = transaction.a11y.semanticObjectId;
      for (const registration of transaction.events.registrations) {
        const existing = leases.get(registration.leaseId);
        if (existing && carried.has(registration.leaseId)) {
          existing.commitId = transaction.commitId;
          continue;
        }
        seenLeaseIds.add(registration.leaseId);
        leases.set(registration.leaseId, {
          leaseId: registration.leaseId,
          scope: registration.scope,
          type: registration.type,
          viewEpoch: transaction.viewEpoch,
          commitId: transaction.commitId,
          active: false,
          released: false,
        });
      }
      return ack(transaction, 'applied', [], [PROTO_SURFACE, ...slots]);
    },

    activate(viewEpoch, commitId) {
      if (phase === 'disposed') return { status: 'disposed' };
      if (currentEpoch === null)
        return { status: isRetired(viewEpoch) ? 'stale' : 'not-installed' };
      if (viewEpoch > currentEpoch) return { status: 'not-installed' };
      if (viewEpoch < currentEpoch) return { status: 'stale' };
      // Same epoch: only the installed commit may be activated. Without this
      // a late activation for an earlier commit would activate the current
      // commit's leases, including ones the earlier commit never saw.
      if (currentCommit === null || commitId > currentCommit) return { status: 'not-installed' };
      if (commitId < currentCommit) return { status: 'stale' };
      const currentLeases = liveLeases().filter((lease) => lease.commitId === currentCommit);
      if (activeEpoch === viewEpoch && currentLeases.every((lease) => lease.active)) {
        return { status: 'already-active' };
      }
      for (const lease of currentLeases) lease.active = true;
      activeEpoch = viewEpoch;
      return { status: 'activated' };
    },

    releaseLeases(leaseIds) {
      const released: LeaseId[] = [];
      const alreadyReleased: LeaseId[] = [];
      const unknown: LeaseId[] = [];
      for (const leaseId of leaseIds) {
        const lease = leases.get(leaseId);
        if (!lease) {
          unknown.push(leaseId);
          continue;
        }
        if (lease.released) {
          alreadyReleased.push(leaseId);
          continue;
        }
        lease.active = false;
        lease.released = true;
        released.push(leaseId);
      }
      return { released, alreadyReleased, unknown };
    },

    deliver(sample) {
      if (phase === 'disposed') return { status: 'rejected', reason: 'disposed' };
      if (currentEpoch === null || sample.viewEpoch < currentEpoch) {
        diagnose('stale-sample', 'input sample carries a retired view epoch', {
          sampleId: sample.sampleId,
          viewEpoch: sample.viewEpoch,
        });
        return { status: 'rejected', reason: 'stale-epoch' };
      }
      if (sample.viewEpoch !== currentEpoch || activeEpoch !== currentEpoch) {
        return { status: 'rejected', reason: 'inactive-epoch' };
      }
      if (samples.has(sample.sampleId)) {
        return { status: 'rejected', reason: 'duplicate-sample' };
      }
      const targets = sample.leaseIds.filter((leaseId) => {
        const lease = leases.get(leaseId);
        return (
          lease !== undefined &&
          lease.active &&
          !lease.released &&
          lease.viewEpoch === sample.viewEpoch &&
          lease.type === sample.type
        );
      });
      if (targets.length === 0) return { status: 'rejected', reason: 'no-active-lease' };
      samples.set(sample.sampleId, { viewEpoch: sample.viewEpoch, decided: false });
      return { status: 'delivered', leaseIds: targets };
    },

    requestDefaultActionPrevention(request, options) {
      if (phase === 'disposed') return { status: 'disposed' };
      const sample = request.sessionId === sessionId ? samples.get(request.sampleId) : undefined;
      if (!sample) return { status: 'unknown-sample' };
      if (sample.decided) return { status: 'duplicate' };
      sample.decided = true;
      if (options.withinWindow) return { status: 'applied' };
      diagnose('late-prevention', 'default action already ran before the guest decision arrived', {
        sampleId: request.sampleId,
      });
      return { status: 'late-prevention' };
    },

    detachView(viewEpoch) {
      if (phase === 'disposed') return { status: 'disposed', releasedLeaseIds: [] };
      if (currentEpoch === null || viewEpoch !== currentEpoch) {
        const older = isRetired(viewEpoch) || (currentEpoch !== null && viewEpoch < currentEpoch);
        return { status: older ? 'stale' : 'not-installed', releasedLeaseIds: [] };
      }
      const releasedLeaseIds = liveLeases().map((lease) => lease.leaseId);
      for (const lease of liveLeases()) {
        lease.active = false;
        lease.released = true;
      }
      retiredEpoch = currentEpoch;
      currentEpoch = null;
      currentCommit = null;
      activeEpoch = null;
      return { status: 'detached', releasedLeaseIds };
    },

    dispose() {
      if (phase === 'disposed') return { status: 'already-disposed', releasedLeaseIds: [] };
      const releasedLeaseIds = liveLeases().map((lease) => lease.leaseId);
      for (const lease of liveLeases()) {
        lease.active = false;
        lease.released = true;
      }
      samples.clear();
      activeEpoch = null;
      phase = 'disposed';
      return { status: 'disposed', releasedLeaseIds };
    },

    snapshot() {
      return {
        sessionId,
        phase,
        currentEpoch,
        currentCommit,
        activeEpoch,
        leases: [...leases.values()].map((lease) => ({ ...lease })),
        retained: {
          instanceId,
          focusTargets: [...focusTargets],
          semanticObjectId,
          slots: [...slots],
        },
        diagnostics: [...diagnostics],
      };
    },
  };
}
