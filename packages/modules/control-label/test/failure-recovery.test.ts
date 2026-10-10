import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createControlLabelRef,
  definePrototype,
  type A11ySemanticObjectSnapshot,
} from '@proto.ui/core';
import { asControlLabel } from '@proto.ui/hooks';
import { A11Y_PROJECT_CAP, type A11yPort } from '@proto.ui/module-a11y';
import { createRuntimeSession } from '@proto.ui/runtime';
import type { ControlLabelPort } from '../src/create';
import { CONTROL_LABEL_HOST_CAP, type ControlLabelHost } from '../src/caps';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});
function expectOriginalFailure(action: () => void, error: Error) {
  let caught: unknown;
  try {
    action();
  } catch (failure) {
    caught = failure;
  }
  expect(caught).toBe(error);
}

function participant(kind: 'label' | 'target', scope: object) {
  let attaching: (() => void) | undefined;
  let projecting: ((snapshot: A11ySemanticObjectSnapshot) => void) | undefined;
  let disposing: (() => void) | undefined;
  const leases: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  const snapshots: A11ySemanticObjectSnapshot[] = [];
  const host: ControlLabelHost = {
    attach: vi.fn(() => {
      attaching?.();
      let live = true;
      const identity = {};
      const dispose = vi.fn(() => {
        live = false;
        disposing?.();
      });
      leases.push({ dispose });
      return { view: () => (live ? { identity, scope } : null), setActivation() {}, dispose };
    }),
  };
  const prototype = definePrototype({
    name: `label-recovery-${kind}`,
    setup() {
      const label = asControlLabel();
      if (kind === 'label') label.label().sync({ naming: true, activation: false });
      else label.target(() => {});
    },
  });
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit: (_children, signal) => signal?.done(),
    schedule: (task) => task(),
    onRuntimeReady(wiring) {
      wiring.attach('a11y', [
        [
          A11Y_PROJECT_CAP,
          Object.assign(
            (snapshot: A11ySemanticObjectSnapshot) => {
              snapshots.push(snapshot);
              projecting?.(snapshot);
            },
            { hasAuthoredName: () => false }
          ),
        ],
      ]);
      wiring.attach('control-label', [[CONTROL_LABEL_HOST_CAP, host]]);
    },
  });
  cleanups.push(() => {
    attaching = undefined;
    projecting = undefined;
    disposing = undefined;
    return session.dispose();
  });
  return {
    session,
    host,
    leases,
    snapshots,
    a11y: session.caps.getPort<A11yPort>('a11y')!,
    attachWith(callback?: () => void) {
      attaching = callback;
    },
    projectWith(callback?: typeof projecting) {
      projecting = callback;
    },
    disposeWith(callback?: () => void) {
      disposing = callback;
    },
    associate(ref: ReturnType<typeof createControlLabelRef> | null) {
      session.controller.applyInstanceAssociations({ controlLabel: ref });
    },
  };
}

describe('Control Label failed association acquisition', () => {
  it('retries the same reference after host attach throws', async () => {
    const f = participant('label', {});
    await f.session.mount();
    const ref = createControlLabelRef();
    const error = new Error('attach failure');
    f.attachWith(() => {
      throw error;
    });
    expectOriginalFailure(() => f.associate(ref), error);
    f.attachWith();
    f.associate(ref);
    expect(f.host.attach).toHaveBeenCalledTimes(2);
    expect(f.leases).toHaveLength(1);
  });

  it('withdraws a failed name contribution and partial host, then retries the same pair', async () => {
    const scope = {};
    const label = participant('label', scope);
    const target = participant('target', scope);
    await label.session.mount();
    await target.session.mount();
    const ref = createControlLabelRef();
    label.associate(ref);
    const error = new Error('name projection failure');
    target.projectWith((snapshot) => {
      if (snapshot.relations.labelledBy?.length) throw error;
    });
    expectOriginalFailure(() => target.associate(ref), error);
    expect(target.a11y.getSnapshot().relations.labelledBy).toBeUndefined();
    expect(target.leases[0]!.dispose).toHaveBeenCalledOnce();
    target.projectWith();
    target.associate(ref);
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(label.a11y.getObjectRef());
    expect(target.leases).toHaveLength(2);
    target.associate(null);
    expect(target.a11y.getSnapshot().relations.labelledBy).toBeUndefined();
    expect(target.leases[1]!.dispose).toHaveBeenCalledOnce();
  });

  it('keeps a newer association installed by failed-lease cleanup and preserves the first error', async () => {
    const scope = {};
    const first = participant('label', scope);
    const next = participant('label', scope);
    const target = participant('target', scope);
    await first.session.mount();
    await next.session.mount();
    await target.session.mount();
    const firstRef = createControlLabelRef();
    const nextRef = createControlLabelRef();
    first.associate(firstRef);
    next.associate(nextRef);
    const error = new Error('first projection failure');
    target.projectWith((snapshot) => {
      if (snapshot.relations.labelledBy?.[0] === first.a11y.getObjectRef()) throw error;
    });
    target.disposeWith(() => {
      target.disposeWith();
      target.associate(nextRef);
      throw new Error('secondary cleanup failure');
    });
    expectOriginalFailure(() => target.associate(firstRef), error);
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(next.a11y.getObjectRef());
    expect(target.leases[0]!.dispose).toHaveBeenCalledOnce();
    expect(target.leases[1]!.dispose).not.toHaveBeenCalled();
    target.associate(nextRef);
    expect(target.leases).toHaveLength(2);
  });

  it('does not clear a newer reference installed inside a failing attach callback', async () => {
    const f = participant('label', {});
    await f.session.mount();
    const nextRef = createControlLabelRef();
    const error = new Error('obsolete attach failure');
    f.attachWith(() => {
      f.attachWith();
      f.associate(nextRef);
      throw error;
    });
    expectOriginalFailure(() => f.associate(createControlLabelRef()), error);
    expect(f.leases).toHaveLength(1);
    expect(f.leases[0]!.dispose).not.toHaveBeenCalled();
    f.associate(nextRef);
    expect(f.host.attach).toHaveBeenCalledTimes(2);
  });
  it('keeps the original error when clearing the failed naming projection also throws', async () => {
    const scope = {};
    const label = participant('label', scope);
    const target = participant('target', scope);
    await label.session.mount();
    await target.session.mount();
    const ref = createControlLabelRef();
    label.associate(ref);
    const error = new Error('original naming failure');
    target.projectWith((snapshot) => {
      throw snapshot.relations.labelledBy?.length
        ? error
        : new Error('rollback projection failure');
    });
    expectOriginalFailure(() => target.associate(ref), error);
    expect(target.a11y.getSnapshot().relations.labelledBy).toBeUndefined();
    expect(target.leases[0]!.dispose).toHaveBeenCalledOnce();
    target.projectWith();
    target.associate(ref);
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(label.a11y.getObjectRef());
  });
});

describe('withdrawn diagnostic negative controls', () => {
  it('preserves a successor association installed reentrantly during withdrawal', async () => {
    const scope = {},
      label = participant('label', scope),
      target = participant('target', scope);
    await label.session.mount();
    await target.session.mount();
    const ref = createControlLabelRef();
    label.associate(ref);
    target.associate(ref);
    const port = label.session.caps.getPort<ControlLabelPort>('control-label')!;
    label.disposeWith(() => {
      label.disposeWith();
      port.prepareViewPresence(true);
    });
    port.prepareViewPresence(false);
    expect(port.getDiagnostic()).toBeNull();
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(label.a11y.getObjectRef());
    expect(label.leases).toHaveLength(2);
    expect(label.leases[1]!.dispose).not.toHaveBeenCalled();
  });

  it('diagnoses a previously healthy participant withdrawn by view presence', async () => {
    const scope = {},
      label = participant('label', scope),
      target = participant('target', scope);
    await label.session.mount();
    await target.session.mount();
    const ref = createControlLabelRef();
    label.associate(ref);
    target.associate(ref);
    const port = label.session.caps.getPort<ControlLabelPort>('control-label')!;
    expect(port.getDiagnostic()).toBeNull();
    port.prepareViewPresence(false);
    expect(target.a11y.getSnapshot().relations.labelledBy).toBeUndefined();
    expect(port.getDiagnostic()).toBe('missing-binding');
    port.prepareViewPresence(true);
    expect(port.getDiagnostic()).toBeNull();
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(label.a11y.getObjectRef());
  });
  it('clears a stale foreign scope error when association intent is removed', async () => {
    const label = participant('label', {}),
      target = participant('target', {});
    await label.session.mount();
    await target.session.mount();
    const ref = createControlLabelRef();
    label.associate(ref);
    target.associate(ref);
    const port = label.session.caps.getPort<ControlLabelPort>('control-label')!;
    expect(port.getDiagnostic()).toBe('foreign-tree-scope');
    label.associate(null);
    expect(port.getDiagnostic()).toBeNull();
  });
});

describe('stale registry diagnostic callback', () => {
  it('a successor installed by naming cleanup keeps its own diagnostic', async () => {
    const scope = {},
      label = participant('label', scope),
      target = participant('target', scope),
      next = participant('label', scope);
    for (const f of [label, target, next]) await f.session.mount();
    const ref = createControlLabelRef(),
      nextRef = createControlLabelRef();
    label.associate(ref);
    target.associate(ref);
    next.associate(nextRef);
    target.projectWith((snapshot) => {
      if (!snapshot.relations.labelledBy?.length) {
        target.projectWith();
        target.associate(nextRef);
      }
    });
    label.session.caps.getPort<ControlLabelPort>('control-label')!.prepareViewPresence(false);
    expect(target.a11y.getSnapshot().relations.labelledBy?.[0]).toBe(next.a11y.getObjectRef());
    expect(
      target.session.caps.getPort<ControlLabelPort>('control-label')!.getDiagnostic()
    ).toBeNull();
  });
});
