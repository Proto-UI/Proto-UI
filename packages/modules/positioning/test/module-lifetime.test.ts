import { expect, it, vi } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { PositioningModuleImpl } from '../src/impl';
import { ANCHORED_POSITION_HOST_CAP } from '../src/caps';

it('T-ANCHORED-POSITIONING-0001-CASE-MODULE: retains declarations without a host, replaces leases, and keeps categorical snapshots', () => {
  const caps = new CapsVault();
  const module = new PositioningModuleImpl(caps);
  const handle = module.handle;
  const connection: AnchoredPositionConnection = {
    anchor: {},
    floating: {},
    config: {
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      strategy: 'fixed',
      avoidCollisions: false,
      collisionBoundary: 'clippingAncestors',
      collisionPadding: 0,
    },
  };
  const update = vi.fn(),
    dispose = vi.fn(),
    requestUpdate = vi.fn();
  const attach = vi.fn((next: AnchoredPositionConnection) => {
    next.onResolved?.({ side: 'top', align: 'end', strategy: 'fixed' });
    return { update, dispose, requestUpdate };
  });
  handle.connect(connection);
  expect(handle.getSnapshot()).toBeNull();
  handle.requestUpdate();
  caps.attach([[ANCHORED_POSITION_HOST_CAP, { attach }]]);
  expect(attach).toHaveBeenCalledTimes(1);
  expect(handle.getSnapshot()).toEqual({ side: 'top', align: 'end', strategy: 'fixed' });
  expect(Object.isFrozen(handle.getSnapshot())).toBe(true);
  handle.connect(connection);
  handle.update({ ...connection.config, sideOffset: 8 });
  expect(update).toHaveBeenCalledTimes(2);
  handle.requestUpdate();
  expect(requestUpdate).toHaveBeenCalledTimes(1);
  handle.connect({ ...connection, floating: {} });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(attach).toHaveBeenCalledTimes(2);
  caps.resetAttached();
  expect(dispose).toHaveBeenCalledTimes(2);
  caps.attach([[ANCHORED_POSITION_HOST_CAP, { attach }]]);
  expect(attach).toHaveBeenCalledTimes(3);
  module.onProtoPhase('unmounted');
  expect(dispose).toHaveBeenCalledTimes(3);
  expect(handle.getSnapshot()).toBeNull();
  handle.disconnect();
  expect(dispose).toHaveBeenCalledTimes(3);
});
