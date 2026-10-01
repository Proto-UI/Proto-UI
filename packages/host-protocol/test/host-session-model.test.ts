import { describe, expect, it } from 'vitest';

import {
  HOST_PROTOCOL_VERSION,
  createHostSessionModel,
  type EventRegistration,
  type InputSample,
  type ProjectionTransaction,
} from '../src';

const SESSION = 'session-1';
const INSTANCE = 'instance-button';

function registration(leaseId: string, type = 'press.commit'): EventRegistration {
  return { leaseId, scope: 'root', type };
}

function transaction(overrides: Partial<ProjectionTransaction> = {}): ProjectionTransaction {
  return {
    protocolVersion: HOST_PROTOCOL_VERSION,
    sessionId: SESSION,
    instanceId: INSTANCE,
    viewEpoch: 1,
    commitId: 1,
    template: { type: 'proto-surface', children: [{ kind: 'slot' }] },
    slots: { slots: ['slot-default'] },
    events: { registrations: [registration('lease-a'), registration('lease-b', 'pointer.down')] },
    focus: { targets: [{ ref: 'focus-root', sequential: true, programmatic: true }] },
    a11y: {
      semanticObjectId: 'object-1',
      role: 'button',
      name: { kind: 'content' },
      states: { disabled: false },
      actions: { activate: { event: 'click' } },
      relations: {},
    },
    ...overrides,
  };
}

function sample(overrides: Partial<InputSample> = {}): InputSample {
  return {
    sampleId: 'sample-1',
    viewEpoch: 1,
    type: 'press.commit',
    leaseIds: ['lease-a'],
    ...overrides,
  };
}

describe('host session model: identity', () => {
  it('rejects another session or protocol version without installing anything', () => {
    const model = createHostSessionModel(SESSION);

    const wrongSession = model.installProjection(transaction({ sessionId: 'session-2' }));
    expect(wrongSession.status).toBe('failed');
    expect(wrongSession.diagnostics.map((entry) => entry.code)).toEqual(['session-mismatch']);

    const wrongVersion = model.installProjection(transaction({ protocolVersion: 99 }));
    expect(wrongVersion.status).toBe('unsupported');
    expect(wrongVersion.diagnostics.map((entry) => entry.code)).toEqual(['protocol-version']);

    const snapshot = model.snapshot();
    expect(snapshot.currentEpoch).toBeNull();
    expect(snapshot.leases).toEqual([]);
  });

  it('binds one logical instance per session', () => {
    const model = createHostSessionModel(SESSION);
    expect(model.installProjection(transaction()).status).toBe('applied');

    const other = model.installProjection(
      transaction({ instanceId: 'instance-other', viewEpoch: 2, commitId: 1 })
    );
    expect(other.status).toBe('failed');
    expect(other.diagnostics[0]?.code).toBe('instance-mismatch');
    expect(model.snapshot().retained.instanceId).toBe(INSTANCE);
  });

  it('rejects a transaction that carries a forbidden wire value', () => {
    const model = createHostSessionModel(SESSION);
    const poisoned = transaction({
      template: { type: 'proto-surface', onClick: (() => undefined) as never },
    });

    const result = model.installProjection(poisoned);
    expect(result.status).toBe('failed');
    expect(result.diagnostics[0]?.code).toBe('wire-boundary');
    expect(result.diagnostics[0]?.data).toEqual({ path: 'template.onClick' });
    expect(model.snapshot().leases).toEqual([]);
  });
});

describe('host session model: install inactive, then activate', () => {
  it('installs leases inactive and delivers only after activation', () => {
    const model = createHostSessionModel(SESSION);

    const applied = model.installProjection(transaction());
    expect(applied.status).toBe('applied');
    expect(applied.readySurfaces).toEqual(['proto-surface', 'slot-default']);
    expect(model.snapshot().leases.map((lease) => [lease.leaseId, lease.active])).toEqual([
      ['lease-a', false],
      ['lease-b', false],
    ]);

    expect(model.deliver(sample())).toEqual({ status: 'rejected', reason: 'inactive-epoch' });

    expect(model.activate(1, 1)).toEqual({ status: 'activated' });
    expect(model.deliver(sample())).toEqual({ status: 'delivered', leaseIds: ['lease-a'] });
    expect(model.activate(1, 1)).toEqual({ status: 'already-active' });
    expect(model.activate(2, 1)).toEqual({ status: 'not-installed' });
  });

  it('delivers only to active leases whose registered type matches the sample', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);

    expect(model.deliver(sample({ leaseIds: ['lease-b'] }))).toEqual({
      status: 'rejected',
      reason: 'no-active-lease',
    });
    expect(
      model.deliver(
        sample({ sampleId: 'sample-2', type: 'pointer.down', leaseIds: ['lease-a', 'lease-b'] })
      )
    ).toEqual({ status: 'delivered', leaseIds: ['lease-b'] });
  });
});

describe('host session model: stale rejection, pruning, retained state', () => {
  it('rejects older epochs and commits without touching installed state', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);
    expect(
      model.installProjection(
        transaction({
          viewEpoch: 2,
          commitId: 1,
          events: { registrations: [registration('lease-c')] },
        })
      ).status
    ).toBe('applied');

    const before = model.snapshot();
    const olderEpoch = model.installProjection(
      transaction({
        viewEpoch: 1,
        commitId: 5,
        events: { registrations: [registration('lease-x')] },
      })
    );
    expect(olderEpoch.status).toBe('superseded');
    const sameCommit = model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        events: { registrations: [registration('lease-y')] },
      })
    );
    expect(sameCommit.status).toBe('superseded');
    expect(model.snapshot().leases).toEqual(before.leases);
    expect(model.snapshot().currentEpoch).toBe(2);
  });

  it('a newer commit in the same epoch carries live leases, prunes dropped ones, and installs new ones inactive', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);

    const next = model.installProjection(
      transaction({
        commitId: 2,
        events: { registrations: [registration('lease-a'), registration('lease-c')] },
      })
    );
    expect(next.status).toBe('applied');

    const leases = Object.fromEntries(
      model
        .snapshot()
        .leases.map((lease) => [
          lease.leaseId,
          { active: lease.active, released: lease.released, commitId: lease.commitId },
        ])
    );
    expect(leases).toEqual({
      'lease-a': { active: true, released: false, commitId: 2 },
      'lease-b': { active: false, released: true, commitId: 1 },
      'lease-c': { active: false, released: false, commitId: 2 },
    });

    // Carried leases keep delivering; the new lease waits for activation.
    expect(model.deliver(sample({ leaseIds: ['lease-a'] }))).toEqual({
      status: 'delivered',
      leaseIds: ['lease-a'],
    });
    expect(model.deliver(sample({ sampleId: 'sample-2', leaseIds: ['lease-c'] }))).toEqual({
      status: 'rejected',
      reason: 'no-active-lease',
    });
    expect(model.activate(1, 2)).toEqual({ status: 'activated' });
    expect(
      model.deliver(sample({ sampleId: 'sample-3', leaseIds: ['lease-b', 'lease-c'] }))
    ).toEqual({
      status: 'delivered',
      leaseIds: ['lease-c'],
    });
    expect(model.activate(1, 2)).toEqual({ status: 'already-active' });
  });

  it('a new epoch prunes the old epoch and rejects its late samples', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);
    model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        events: { registrations: [registration('lease-c')] },
      })
    );
    model.activate(2, 1);

    expect(model.snapshot().leases.find((lease) => lease.leaseId === 'lease-a')?.released).toBe(
      true
    );
    expect(model.deliver(sample({ viewEpoch: 1 }))).toEqual({
      status: 'rejected',
      reason: 'stale-epoch',
    });
    expect(model.snapshot().diagnostics.at(-1)?.code).toBe('stale-sample');
    expect(model.deliver(sample({ viewEpoch: 2, leaseIds: ['lease-c'] }))).toEqual({
      status: 'delivered',
      leaseIds: ['lease-c'],
    });
  });

  it('retains logical instance state across view epochs', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    expect(model.snapshot().retained).toEqual({
      instanceId: INSTANCE,
      focusTargets: ['focus-root'],
      semanticObjectId: 'object-1',
      slots: ['slot-default'],
    });

    model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        a11y: null,
        slots: { slots: [] },
        events: { registrations: [] },
      })
    );
    expect(model.snapshot().retained).toEqual({
      instanceId: INSTANCE,
      focusTargets: ['focus-root'],
      semanticObjectId: 'object-1',
      slots: [],
    });
  });
});

describe('host session model: transactional plans and lease release', () => {
  it('installs nothing when any allocation fails and keeps the previous epoch current', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);

    const failed = model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        events: { registrations: [registration('lease-c'), registration('lease-d')] },
      }),
      { failAllocation: (entry) => entry.leaseId === 'lease-d' }
    );
    expect(failed.status).toBe('failed');
    expect(failed.diagnostics[0]).toMatchObject({
      code: 'allocation-failed',
      data: { leaseId: 'lease-d' },
    });

    const snapshot = model.snapshot();
    expect(snapshot.currentEpoch).toBe(1);
    expect(snapshot.leases.map((lease) => lease.leaseId)).toEqual(['lease-a', 'lease-b']);
    expect(model.deliver(sample())).toEqual({ status: 'delivered', leaseIds: ['lease-a'] });

    const retry = model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        events: { registrations: [registration('lease-c'), registration('lease-d')] },
      })
    );
    expect(retry.status).toBe('applied');
    expect(
      model
        .snapshot()
        .leases.filter((lease) => !lease.released)
        .map((lease) => lease.leaseId)
    ).toEqual(['lease-c', 'lease-d']);
  });

  it('rejects duplicate lease ids inside a plan and reuse across transactions', () => {
    const model = createHostSessionModel(SESSION);
    const duplicate = model.installProjection(
      transaction({ events: { registrations: [registration('lease-a'), registration('lease-a')] } })
    );
    expect(duplicate.status).toBe('failed');
    expect(duplicate.diagnostics[0]?.code).toBe('duplicate-lease');

    expect(model.installProjection(transaction()).status).toBe('applied');
    const crossEpoch = model.installProjection(
      transaction({
        viewEpoch: 2,
        commitId: 1,
        events: { registrations: [registration('lease-a')] },
      })
    );
    expect(crossEpoch.status).toBe('failed');
    expect(crossEpoch.diagnostics[0]?.code).toBe('lease-reuse');

    // A carried lease must keep its scope and type; a released id is retired.
    const retyped = model.installProjection(
      transaction({ commitId: 2, events: { registrations: [registration('lease-a', 'key.down')] } })
    );
    expect(retyped.status).toBe('failed');
    expect(retyped.diagnostics[0]?.code).toBe('lease-reuse');
    model.releaseLeases(['lease-a']);
    const retired = model.installProjection(
      transaction({ commitId: 2, events: { registrations: [registration('lease-a')] } })
    );
    expect(retired.status).toBe('failed');
    expect(retired.diagnostics[0]?.code).toBe('lease-reuse');
    expect(model.snapshot().currentCommit).toBe(1);
  });

  it('releases leases idempotently and gates delivery immediately', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);

    expect(model.releaseLeases(['lease-a', 'lease-missing'])).toEqual({
      released: ['lease-a'],
      alreadyReleased: [],
      unknown: ['lease-missing'],
    });
    expect(model.releaseLeases(['lease-a'])).toEqual({
      released: [],
      alreadyReleased: ['lease-a'],
      unknown: [],
    });
    expect(model.deliver(sample())).toEqual({ status: 'rejected', reason: 'no-active-lease' });
    expect(
      model.deliver(sample({ sampleId: 'sample-2', type: 'pointer.down', leaseIds: ['lease-b'] }))
    ).toEqual({
      status: 'delivered',
      leaseIds: ['lease-b'],
    });
  });
});

describe('host session model: sample identity and default action', () => {
  it('deduplicates sample identity and bounds default-action decisions to one window', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);

    expect(model.deliver(sample())).toEqual({ status: 'delivered', leaseIds: ['lease-a'] });
    expect(model.deliver(sample())).toEqual({ status: 'rejected', reason: 'duplicate-sample' });

    const request = { sessionId: SESSION, sampleId: 'sample-1', source: 'base-button' };
    expect(model.requestDefaultActionPrevention(request, { withinWindow: true })).toEqual({
      status: 'applied',
    });
    expect(model.requestDefaultActionPrevention(request, { withinWindow: true })).toEqual({
      status: 'duplicate',
    });

    expect(model.deliver(sample({ sampleId: 'sample-2' })).status).toBe('delivered');
    expect(
      model.requestDefaultActionPrevention(
        { sessionId: SESSION, sampleId: 'sample-2' },
        { withinWindow: false }
      )
    ).toEqual({ status: 'late-prevention' });
    expect(model.snapshot().diagnostics.at(-1)).toMatchObject({
      code: 'late-prevention',
      data: { sampleId: 'sample-2' },
    });

    expect(
      model.requestDefaultActionPrevention(
        { sessionId: SESSION, sampleId: 'sample-unknown' },
        { withinWindow: true }
      )
    ).toEqual({ status: 'unknown-sample' });
    expect(
      model.requestDefaultActionPrevention(
        { sessionId: 'session-2', sampleId: 'sample-1' },
        { withinWindow: true }
      )
    ).toEqual({ status: 'unknown-sample' });
  });
});

describe('host session model: terminal disposal', () => {
  it('releases every lease exactly once and rejects every later message', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);
    model.deliver(sample());

    expect(model.dispose()).toEqual({
      status: 'disposed',
      releasedLeaseIds: ['lease-a', 'lease-b'],
    });
    expect(model.dispose()).toEqual({ status: 'already-disposed', releasedLeaseIds: [] });

    const snapshot = model.snapshot();
    expect(snapshot.phase).toBe('disposed');
    expect(snapshot.activeEpoch).toBeNull();
    expect(snapshot.leases.every((lease) => lease.released && !lease.active)).toBe(true);

    const late = model.installProjection(transaction({ viewEpoch: 2, commitId: 1 }));
    expect(late.status).toBe('failed');
    expect(late.diagnostics[0]?.code).toBe('session-disposed');
    expect(model.activate(1, 1)).toEqual({ status: 'disposed' });
    expect(model.deliver(sample({ sampleId: 'sample-3' }))).toEqual({
      status: 'rejected',
      reason: 'disposed',
    });
    expect(
      model.requestDefaultActionPrevention(
        { sessionId: SESSION, sampleId: 'sample-1' },
        { withinWindow: true }
      )
    ).toEqual({ status: 'disposed' });
    expect(model.releaseLeases(['lease-a'])).toEqual({
      released: [],
      alreadyReleased: ['lease-a'],
      unknown: [],
    });
  });
});

describe('host session model: malformed plans stay bounded', () => {
  it('answers a sparse registration list with a failed acknowledgement', () => {
    const model = createHostSessionModel(SESSION);
    const sparse = new Array(1) as EventRegistration[];

    const result = model.installProjection(transaction({ events: { registrations: sparse } }));

    expect(result.status).toBe('failed');
    expect(result.diagnostics[0]?.code).toBe('wire-boundary');
    expect(result.diagnostics[0]?.data).toEqual({ path: 'events.registrations[0]' });
    expect(model.snapshot().currentEpoch).toBeNull();
    expect(model.snapshot().leases).toEqual([]);

    // The session stays usable: a well-formed plan still installs.
    expect(model.installProjection(transaction()).status).toBe('applied');
  });

  it('rejects an incomplete registration record without allocating anything', () => {
    const cases: readonly [string, unknown][] = [
      ['missing leaseId', { scope: 'root', type: 'press.commit' }],
      ['empty leaseId', { leaseId: '', scope: 'root', type: 'press.commit' }],
      ['unknown scope', { leaseId: 'lease-z', scope: 'window', type: 'press.commit' }],
      ['missing type', { leaseId: 'lease-z', scope: 'root' }],
      ['null entry', null],
    ];

    for (const [label, entry] of cases) {
      const model = createHostSessionModel(SESSION);
      const result = model.installProjection(
        transaction({ events: { registrations: [entry as EventRegistration] } })
      );
      expect(result.status, label).toBe('failed');
      expect(result.diagnostics[0]?.code, label).toBe('malformed-registration');
      expect(model.snapshot().leases, label).toEqual([]);
      expect(model.snapshot().currentEpoch, label).toBeNull();
    }
  });
});

describe('host session model: activation is commit-qualified', () => {
  it('a delayed activation for an earlier commit cannot activate the current one', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    // A second commit lands in the same epoch before the peer's activation for
    // the first one arrives. It carries lease-a and adds lease-c.
    expect(
      model.installProjection(
        transaction({
          commitId: 2,
          events: { registrations: [registration('lease-a'), registration('lease-c', 'key.down')] },
        })
      ).status
    ).toBe('applied');

    // The late activation names commit 1. It must not make commit 2 live.
    expect(model.activate(1, 1)).toEqual({ status: 'stale' });
    expect(model.snapshot().leases.filter((lease) => lease.active)).toEqual([]);
    expect(model.snapshot().activeEpoch).toBeNull();
    expect(model.deliver(sample())).toEqual({ status: 'rejected', reason: 'inactive-epoch' });

    // Activation for the exact installed commit still succeeds.
    expect(model.activate(1, 2)).toEqual({ status: 'activated' });
    expect(
      model
        .snapshot()
        .leases.filter((lease) => lease.active)
        .map((lease) => lease.leaseId)
    ).toEqual(['lease-a', 'lease-c']);
  });

  it('an activation for a commit that was never installed is not installed', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());

    expect(model.activate(1, 2)).toEqual({ status: 'not-installed' });
    expect(model.activate(2, 1)).toEqual({ status: 'not-installed' });
    expect(model.snapshot().activeEpoch).toBeNull();
    expect(model.activate(1, 1)).toEqual({ status: 'activated' });
  });

  it('keeps an epoch activated across a same-epoch commit only for the leases that commit installed', () => {
    const model = createHostSessionModel(SESSION);
    model.installProjection(transaction());
    model.activate(1, 1);
    expect(model.deliver(sample())).toEqual({ status: 'delivered', leaseIds: ['lease-a'] });

    model.installProjection(
      transaction({
        commitId: 2,
        events: { registrations: [registration('lease-a'), registration('lease-c', 'key.down')] },
      })
    );
    // The carried lease keeps delivering; the new one waits for the activation
    // of its own commit rather than inheriting the previous one.
    expect(model.deliver(sample({ sampleId: 'sample-2' }))).toEqual({
      status: 'delivered',
      leaseIds: ['lease-a'],
    });
    expect(
      model.deliver(sample({ sampleId: 'sample-3', type: 'key.down', leaseIds: ['lease-c'] }))
    ).toEqual({ status: 'rejected', reason: 'no-active-lease' });

    expect(model.activate(1, 1)).toEqual({ status: 'stale' });
    expect(model.activate(1, 2)).toEqual({ status: 'activated' });
    expect(
      model.deliver(sample({ sampleId: 'sample-4', type: 'key.down', leaseIds: ['lease-c'] }))
    ).toEqual({ status: 'delivered', leaseIds: ['lease-c'] });
  });
});
