import { describe, expect, it, vi } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { PositioningModuleImpl } from '../src/impl';
import { ANCHORED_POSITION_HOST_CAP } from '../src/caps';
function connection(): AnchoredPositionConnection {
  return {
    anchor: {},
    floating: {},
    config: {
      side: 'bottom',
      align: 'start',
      sideOffset: 0,
      alignOffset: 0,
      strategy: 'fixed',
      avoidCollisions: false,
      collisionBoundary: 'viewport',
      collisionPadding: 10,
    },
    targetAlignment: {
      surface: {},
      scrollport: {},
      blockReference: {},
      inlineReference: {},
      blockTarget: {},
      inlineTarget: {},
      atStart: false,
      atEnd: false,
      constraints: {
        boundary: 'layout-viewport',
        margin: 10,
        minimumTargetSpanCount: 5,
        inlineOverflow: 'preserve-start',
        expandOnScroll: true,
      },
    },
    onAlignment: vi.fn(),
    onResolved: vi.fn(),
  };
}
describe('target policy current callback delivery', () => {
  it('explicitly reports unsupported capability without invoking an edge-only host', () => {
    const caps = new CapsVault(),
      impl = new PositioningModuleImpl(caps),
      attach = vi.fn();
    caps.attach([[ANCHORED_POSITION_HOST_CAP, { attach }]]);
    const c = connection();
    impl.handle.connect(c);
    expect(attach).not.toHaveBeenCalled();
    expect(c.onAlignment).toHaveBeenCalledWith({
      status: 'unavailable',
      reason: 'unsupported-host',
    });
    expect(impl.handle.getSnapshot()).toBeNull();
    impl.dispose();
  });
  it('rechecks request after callback dispatch and rejects fabricated edge snapshots', () => {
    const caps = new CapsVault(),
      impl = new PositioningModuleImpl(caps);
    const requests: AnchoredPositionConnection[] = [],
      queue: (() => void)[] = [];
    caps.attach([
      [
        ANCHORED_POSITION_HOST_CAP,
        {
          supportsTargetAlignment: true,
          attach(c: AnchoredPositionConnection) {
            requests.push(c);
            return {
              update(c: AnchoredPositionConnection) {
                requests.push(c);
              },
              dispose() {},
              requestUpdate() {},
            };
          },
        },
      ],
    ]);
    impl.setCallbackDispatcher((callback) => queue.push(callback));
    const first = connection();
    impl.handle.connect(first);
    const old = requests[0];
    if (!old) throw new Error('Missing initial request');
    old.onAlignment?.({ status: 'applied' });
    const next = { ...first, onAlignment: vi.fn() };
    impl.handle.connect(next);
    const deliver = queue.shift();
    if (!deliver) throw new Error('Missing queued callback');
    deliver();
    expect(first.onAlignment).not.toHaveBeenCalled();
    const current = requests[1];
    if (!current) throw new Error('Missing replacement request');
    current.onResolved?.({ side: 'top', align: 'end', strategy: 'fixed' });
    expect(queue).toHaveLength(0);
    expect(impl.handle.getSnapshot()).toBeNull();
    current.onAlignment?.({ status: 'applied' });
    const valid = queue.shift();
    if (!valid) throw new Error('Missing current callback');
    valid();
    expect(next.onAlignment).toHaveBeenCalledOnce();
    impl.dispose();
  });
});
