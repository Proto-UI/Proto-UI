import { describe, expect, it, vi } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { PositioningModuleImpl } from '../src/impl';
import { ANCHORED_POSITION_HOST_CAP } from '../src/caps';

const connection = (
  onResolved: NonNullable<AnchoredPositionConnection['onResolved']> = vi.fn()
): AnchoredPositionConnection => ({
  anchor: {},
  floating: {},
  onResolved,
  config: {
    side: 'bottom',
    align: 'start',
    sideOffset: 0,
    alignOffset: 0,
    strategy: 'fixed',
    avoidCollisions: false,
    collisionBoundary: 'viewport',
    collisionPadding: 0,
  },
});
const snapshot = { side: 'top', align: 'end', strategy: 'fixed' } as const;
function fixture() {
  const caps = new CapsVault();
  const impl = new PositioningModuleImpl(caps);
  const requests: AnchoredPositionConnection[] = [];
  const disposed = vi.fn();
  const host = {
    attach(c: AnchoredPositionConnection) {
      requests.push(c);
      return {
        update: (c: AnchoredPositionConnection) => requests.push(c),
        dispose: disposed,
        requestUpdate() {},
      };
    },
  };
  caps.attach([[ANCHORED_POSITION_HOST_CAP, host]]);
  return { caps, impl, requests, disposed, host };
}

describe('Positioning current callback delivery', () => {
  it('cancels an already queued completion after same-target connection replacement', () => {
    const f = fixture();
    const queued: (() => void)[] = [];
    f.impl.setCallbackDispatcher((fn) => queued.push(fn));
    const first = connection();
    f.impl.handle.connect(first);
    f.requests[0]!.onResolved?.(snapshot);
    expect(f.impl.handle.getSnapshot()).toBeNull();
    const next = { ...first, onResolved: vi.fn() };
    f.impl.handle.connect(next);
    queued.shift()!();
    expect(first.onResolved).not.toHaveBeenCalled();
    expect(f.impl.handle.getSnapshot()).toBeNull();
    f.requests[1]!.onResolved?.(snapshot);
    queued.shift()!();
    expect(next.onResolved).toHaveBeenCalledOnce();
    expect(f.impl.handle.getSnapshot()).toEqual(snapshot);
    f.impl.dispose();
  });

  it('rejects stale provider callbacks before dispatch and queued callbacks after disconnect', () => {
    const f = fixture();
    const queued: (() => void)[] = [];
    f.impl.setCallbackDispatcher((fn) => queued.push(fn));
    const first = connection();
    f.impl.handle.connect(first);
    f.caps.resetAttached();
    f.caps.attach([[ANCHORED_POSITION_HOST_CAP, f.host]]);
    f.requests[0]!.onResolved?.(snapshot);
    expect(queued).toHaveLength(0);
    f.requests[1]!.onResolved?.(snapshot);
    f.impl.handle.disconnect();
    queued.shift()!();
    expect(first.onResolved).not.toHaveBeenCalled();
    expect(f.impl.handle.getSnapshot()).toBeNull();
    f.impl.dispose();
  });

  it('cannot install a lease returned after synchronous attach callback disconnects it', () => {
    const caps = new CapsVault();
    const impl = new PositioningModuleImpl(caps);
    const dispose = vi.fn();
    const update = vi.fn();
    caps.attach([
      [
        ANCHORED_POSITION_HOST_CAP,
        {
          attach(c: AnchoredPositionConnection) {
            c.onResolved?.(snapshot);
            return { dispose, update, requestUpdate() {} };
          },
        },
      ],
    ]);
    impl.handle.connect(connection(() => impl.handle.disconnect()));
    expect(dispose).toHaveBeenCalledOnce();
    expect(impl.handle.getSnapshot()).toBeNull();
    impl.handle.update(connection().config);
    expect(update).not.toHaveBeenCalled();
    impl.dispose();
  });

  it('keeps only the reconnected lease when same-target update completes synchronously', () => {
    const caps = new CapsVault();
    const impl = new PositioningModuleImpl(caps);
    const requests: AnchoredPositionConnection[] = [];
    const disposers: Array<() => void> = [];
    caps.attach([
      [
        ANCHORED_POSITION_HOST_CAP,
        {
          attach(c: AnchoredPositionConnection) {
            requests.push(c);
            const dispose = vi.fn();
            disposers.push(dispose);
            return {
              dispose,
              requestUpdate() {},
              update(next: AnchoredPositionConnection) {
                requests.push(next);
                next.onResolved?.(snapshot);
              },
            };
          },
        },
      ],
    ]);
    const initial = connection();
    const replacement = connection();
    impl.handle.connect(initial);
    impl.handle.connect({
      ...initial,
      onResolved() {
        impl.handle.disconnect();
        impl.handle.connect(replacement);
      },
    });
    expect(requests).toHaveLength(3);
    expect(disposers[0]).toHaveBeenCalledOnce();
    expect(disposers[1]).not.toHaveBeenCalled();
    requests[0]!.onResolved?.(snapshot);
    requests[1]!.onResolved?.(snapshot);
    expect(requests).toHaveLength(3);
    expect(initial.onResolved).not.toHaveBeenCalled();
    expect(impl.handle.getSnapshot()).toBeNull();
    requests[2]!.onResolved?.(snapshot);
    expect(replacement.onResolved).toHaveBeenCalledOnce();
    impl.dispose();
    expect(disposers[1]).toHaveBeenCalledOnce();
  });

  it('does not attach the superseded request when previous disposal reconnects', () => {
    const caps = new CapsVault();
    const impl = new PositioningModuleImpl(caps);
    const requests: AnchoredPositionConnection[] = [];
    const replacement = connection();
    let reentered = false;
    const disposers: Array<() => void> = [];
    caps.attach([
      [
        ANCHORED_POSITION_HOST_CAP,
        {
          attach(c: AnchoredPositionConnection) {
            requests.push(c);
            const dispose = vi.fn(() => {
              if (reentered) return;
              reentered = true;
              impl.handle.connect(replacement);
            });
            disposers.push(dispose);
            return { dispose, requestUpdate() {}, update() {} };
          },
        },
      ],
    ]);
    const first = connection();
    const superseded = connection();
    impl.handle.connect(first);
    impl.handle.connect(superseded);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.anchor).toBe(replacement.anchor);
    requests[0]!.onResolved?.(snapshot);
    expect(first.onResolved).not.toHaveBeenCalled();
    expect(superseded.onResolved).not.toHaveBeenCalled();
    requests[1]!.onResolved?.(snapshot);
    expect(replacement.onResolved).toHaveBeenCalledOnce();
    expect(disposers[0]).toHaveBeenCalledOnce();
    impl.dispose();
    expect(disposers[1]).toHaveBeenCalledOnce();
  });

  it('does not revive after direct disposal or terminal logical unmount', () => {
    for (const terminal of ['dispose', 'unmounted'] as const) {
      const f = fixture();
      const c = connection();
      f.impl.handle.connect(c);
      if (terminal === 'dispose') f.impl.dispose();
      else f.impl.onProtoPhase('unmounted');
      f.requests[0]!.onResolved?.(snapshot);
      f.impl.handle.connect(c);
      f.impl.handle.update(c.config);
      f.impl.handle.requestUpdate();
      expect(f.requests).toHaveLength(1);
      expect(f.disposed).toHaveBeenCalledOnce();
      expect(c.onResolved).not.toHaveBeenCalled();
      expect(f.impl.handle.getSnapshot()).toBeNull();
      f.impl.dispose();
    }
  });
});
