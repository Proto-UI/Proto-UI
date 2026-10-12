import { expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP, type SystemCaps } from '@proto.ui/module-base';
import type { StatePort } from '@proto.ui/module-state';
import type { AvailableLayoutBinding, State } from '@proto.ui/core';
import { PositioningModuleImpl } from '../src/impl';
import { AVAILABLE_SPACE_HOST_CAP } from '../src/caps';
const system: SystemCaps = {
  execPhase: () => 'setup',
  domain: () => 'setup',
  protoPhase: () => 'setup',
  isDisposed: () => false,
  ensureNotDisposed() {},
  ensureExecPhase() {},
  ensureSetup() {},
  ensureRuntime() {},
  ensureCallback() {},
  getCallbackCtx: () => undefined,
};
function fixture() {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, system]]);
  const callbacks = new Set<() => void>();
  const history: (() => void)[] = [];
  const port = {
    watch: (_state: unknown, cb: () => void) => {
      callbacks.add(cb);
      history.push(cb);
      return () => callbacks.delete(cb);
    },
  } as unknown as StatePort;
  const impl = new PositioningModuleImpl(caps, port);
  let value = 0;
  const displacement = { get: () => value } as State<number>;
  const binding: AvailableLayoutBinding = { edge: 'bottom', extent: 'intrinsic', displacement };
  const updates = vi.fn();
  const dispose = vi.fn();
  const attach = vi.fn((_request: unknown) => ({
    updateLayout: updates,
    requestUpdate() {},
    dispose,
  }));
  caps.attach([[AVAILABLE_SPACE_HOST_CAP, { supportsLayout: true, attach }]]);
  return {
    caps,
    impl,
    binding,
    callbacks,
    history,
    updates,
    dispose,
    attach,
    set(next: number) {
      value = next;
      [...callbacks].forEach((cb) => cb());
    },
  };
}
it('replays current scalar State and withdraws invalid runtime snapshots without clamping', () => {
  const f = fixture();
  f.impl.availableHandle.bindLayout!(f.binding);
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  expect(f.attach.mock.calls[0]?.[0]).toMatchObject({
    layout: { status: 'ready', value: { displacement: 0 } },
  });
  f.set(0.5);
  expect(f.updates).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: 'ready',
      value: expect.objectContaining({ displacement: 0.5 }),
    })
  );
  f.set(NaN);
  expect(f.updates).toHaveBeenLastCalledWith({ status: 'invalid' });
  f.set(0);
  expect(f.updates).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ready' }));
  f.impl.dispose();
  expect(f.callbacks.size).toBe(0);
});
it('guards queued old observations across connection replacement and final disposal', () => {
  const f = fixture();
  f.impl.availableHandle.bindLayout!(f.binding);
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  const stale = f.history[0]!;
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  expect(f.callbacks.size).toBe(1);
  stale();
  expect(f.updates).not.toHaveBeenCalled();
  f.impl.dispose();
  f.history.at(-1)!();
  expect(f.updates).not.toHaveBeenCalled();
  expect(f.callbacks.size).toBe(0);
});
it('rejects invalid initial binding and preserves a previously valid declaration', () => {
  const f = fixture();
  f.impl.availableHandle.bindLayout!(f.binding);
  expect(() => f.impl.availableHandle.bindLayout!({ ...f.binding, fraction: Infinity })).toThrow(
    /Invalid/
  );
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  expect(f.attach.mock.calls[0]?.[0]).toMatchObject({ layout: { status: 'ready' } });
  f.impl.dispose();
});
it('releases State watches when the host capability is lost', () => {
  const f = fixture();
  f.impl.availableHandle.bindLayout!(f.binding);
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  f.caps.resetAttached();
  expect(f.callbacks.size).toBe(0);
  f.caps.attach([[AVAILABLE_SPACE_HOST_CAP, { supportsLayout: true, attach: f.attach }]]);
  expect(f.callbacks.size).toBe(1);
  f.impl.dispose();
});
it('rolls back earlier subscriptions when a later State watch rejects', () => {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, system]]);
  const off = vi.fn();
  const disposed = vi.fn();
  let count = 0;
  const port = {
    watch: () => {
      if (++count === 2) throw Error('foreign State');
      return off;
    },
  } as unknown as StatePort;
  const impl = new PositioningModuleImpl(caps, port);
  caps.attach([
    [
      AVAILABLE_SPACE_HOST_CAP,
      {
        supportsLayout: true,
        attach: () => ({ updateLayout() {}, requestUpdate() {}, dispose: disposed }),
      },
    ],
  ]);
  impl.availableHandle.bindLayout!({
    edge: 'bottom',
    extent: 'intrinsic',
    fraction: { get: () => 1 } as State<number>,
    displacement: { get: () => 0 } as State<number>,
  });
  expect(() => impl.availableHandle.connect({ target: {}, boundary: 'root-content' })).toThrow(
    'foreign State'
  );
  expect(off).toHaveBeenCalledTimes(1);
  expect(disposed).toHaveBeenCalledTimes(1);
  impl.dispose();
  expect(off).toHaveBeenCalledTimes(1);
});
it('does not mask source reading errors with a disabled layout gate', () => {
  const f = fixture();
  expect(() =>
    f.impl.availableHandle.bindLayout!({
      ...f.binding,
      enabled: false,
      fraction: {
        get() {
          throw Error('source failure');
        },
        watch() {
          return () => {};
        },
      } as State<number>,
    })
  ).toThrow('source failure');
  f.impl.dispose();
});
it('runtime false disables projection even with another invalid value, but initial declaration rejects it', () => {
  const f = fixture();
  let enabled = true;
  const binding = { ...f.binding, enabled: { get: () => enabled } as State<boolean> };
  f.impl.availableHandle.bindLayout!(binding);
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  enabled = false;
  f.set(NaN);
  expect(f.updates).toHaveBeenLastCalledWith({ status: 'disabled' });
  expect(() => f.impl.availableHandle.bindLayout!(binding)).toThrow(/Invalid/);
  f.impl.dispose();
});
it('does not deliver an old snapshot after source reading reentrantly disconnects', () => {
  const f = fixture();
  let disconnect = false;
  const state = {
    get() {
      if (disconnect) f.impl.availableHandle.disconnect();
      return 0.5;
    },
  } as State<number>;
  f.impl.availableHandle.bindLayout!({ ...f.binding, displacement: state });
  f.impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  disconnect = true;
  f.history[0]!();
  expect(f.updates).not.toHaveBeenCalled();
  expect(f.callbacks.size).toBe(0);
  f.impl.dispose();
});
it('releases a watch returned after synchronous registration reentrantly disposes', () => {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, system]]);
  const off = vi.fn();
  let impl: PositioningModuleImpl;
  const port = {
    watch: () => {
      impl.dispose();
      return off;
    },
  } as unknown as StatePort;
  impl = new PositioningModuleImpl(caps, port);
  caps.attach([
    [
      AVAILABLE_SPACE_HOST_CAP,
      {
        supportsLayout: true,
        attach: () => ({ updateLayout() {}, requestUpdate() {}, dispose() {} }),
      },
    ],
  ]);
  impl.availableHandle.bindLayout!({
    edge: 'bottom',
    extent: 'intrinsic',
    displacement: { get: () => 0 } as State<number>,
  });
  impl.availableHandle.connect({ target: {}, boundary: 'root-content' });
  expect(off).toHaveBeenCalledTimes(1);
});
