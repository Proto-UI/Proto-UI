import { describe, expect, it, vi } from 'vitest';
import { createControlLabelRef, definePrototype } from '@proto.ui/core';
import { asControlLabel } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { CONTROL_LABEL_HOST_CAP, type ControlLabelHost } from '../src/caps';
import labelRoot from '../../../prototypes/base/src/label';

function fixture(prototype = labelRoot, initial: Record<string, unknown> = {}) {
  let onDispose: (() => void) | undefined;
  const ref = createControlLabelRef();
  const leases: Array<{
    initial: boolean;
    setActivation: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  const scope = {};
  const host: ControlLabelHost = {
    attach(options) {
      let live = true;
      const lease = {
        initial: options.activation,
        setActivation: vi.fn(),
        dispose: vi.fn(() => {
          live = false;
          onDispose?.();
        }),
      };
      leases.push(lease);
      const identity = {};
      return { ...lease, view: () => (live ? { identity, scope } : null) };
    },
  };
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => initial,
    getInstanceAssociations: () => ({ controlLabel: ref }),
    commit: (_children, signal) => signal?.done(),
    schedule: (task) => task(),
    onRuntimeReady: (wiring) => wiring.attach('control-label', [[CONTROL_LABEL_HOST_CAP, host]]),
  });
  return {
    session,
    leases,
    onDispose(callback: () => void) {
      onDispose = callback;
    },
  };
}

describe('Control Label Module owns host action projection', () => {
  it.each([false, true])(
    'mounts with declared activation %s, toggles, and retires the old view lease',
    async (initial) => {
      const f = fixture(labelRoot, { activation: initial });
      await f.session.mount();
      const current = f.leases.at(-1)!;
      expect(current.initial).toBe(initial);
      f.session.controller.applyRawProps({ activation: !initial });
      expect(current.setActivation).toHaveBeenLastCalledWith(!initial);
      f.session.controller.applyRawProps({ naming: false, activation: initial });
      expect(current.setActivation).toHaveBeenLastCalledWith(initial);
      await f.session.unmount();
      expect(current.dispose).toHaveBeenCalledOnce();
      const oldCalls = current.setActivation.mock.calls.length;
      f.session.controller.applyRawProps({ activation: !initial });
      expect(current.setActivation).toHaveBeenCalledTimes(oldCalls);
      await f.session.mount();
      const next = f.leases.at(-1)!;
      expect(next).not.toBe(current);
      expect(next.initial).toBe(!initial);
      await f.session.dispose();
      expect(next.dispose).toHaveBeenCalledOnce();
    }
  );
  it('old host-lease cleanup cannot revoke a reentrantly installed association', async () => {
    const f = fixture(labelRoot, { activation: true });
    await f.session.mount();
    const old = f.leases.at(-1)!;
    const nextRef = createControlLabelRef();
    let once = true;
    f.onDispose(() => {
      if (once) {
        once = false;
        f.session.controller.applyInstanceAssociations({ controlLabel: nextRef });
      }
    });
    f.session.controller.applyInstanceAssociations({ controlLabel: null });
    const next = f.leases.at(-1)!;
    expect(next).not.toBe(old);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(next.dispose).not.toHaveBeenCalled();
    await f.session.dispose();
    expect(next.dispose).toHaveBeenCalledOnce();
  });
  it('a target participant never acquires a Label action even if its options change', async () => {
    const target = definePrototype({
      name: 'label-action-target',
      setup(def) {
        const handle = asControlLabel().target(() => {});
        def.lifecycle.onCreated(() => handle.sync({ naming: false, activation: true }));
      },
    });
    const f = fixture(target);
    await f.session.mount();
    expect(f.leases.at(-1)!.initial).toBe(false);
    expect(
      f.leases
        .flatMap((lease) => lease.setActivation.mock.calls)
        .every(([enabled]) => enabled === false)
    ).toBe(true);
    await f.session.dispose();
  });
});
