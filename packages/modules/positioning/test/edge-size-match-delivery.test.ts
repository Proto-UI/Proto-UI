import { expect, it, vi } from 'vitest';
import type { AnchoredPositionConnection } from '@proto.ui/core';
import { CapsVault } from '@proto.ui/module-base';
import { PositioningModuleImpl } from '../src/impl';
import { ANCHORED_POSITION_HOST_CAP } from '../src/caps';

function setup() {
  const caps = new CapsVault();
  const impl = new PositioningModuleImpl(caps);
  const dispose = vi.fn();
  const attach = vi.fn(() => ({ update: vi.fn(), requestUpdate: vi.fn(), dispose }));
  caps.attach([[ANCHORED_POSITION_HOST_CAP, { attach }]]);
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
      collisionBoundary: 'viewport',
      collisionPadding: 0,
    },
  };
  return { impl, attach, connection, dispose };
}

it('ordinary edge placement remains admitted without requesting size capability', () => {
  const f = setup();
  try {
    f.impl.handle.connect(f.connection);
    expect(f.attach).toHaveBeenCalledTimes(1);
  } finally {
    f.impl.dispose();
  }
  expect(f.dispose).toHaveBeenCalledTimes(1);
});

it('edge-only Host cannot silently accept explicit size matching as ordinary placement', () => {
  const f = setup();
  const onSizeMatch = vi.fn();
  const request = {
    ...f.connection,
    sizeMatch: { reference: f.connection.anchor, targets: [{}] },
    onSizeMatch,
  };
  try {
    f.impl.handle.connect(request);
    expect(f.attach).not.toHaveBeenCalled();
    expect(onSizeMatch).toHaveBeenCalledTimes(1);
    expect(onSizeMatch).toHaveBeenCalledWith({ status: 'unavailable', reason: 'unsupported-host' });
    expect(f.impl.handle.getSnapshot()).toBeNull();
  } finally {
    f.impl.dispose();
  }
});

it('adding size matching to an existing ordinary lease rechecks Host capability and retires it', () => {
  const f = setup();
  const onSizeMatch = vi.fn();
  try {
    f.impl.handle.connect(f.connection);
    expect(f.attach).toHaveBeenCalledTimes(1);
    f.impl.handle.connect({
      ...f.connection,
      sizeMatch: { reference: f.connection.anchor, targets: [{}] },
      onSizeMatch,
    });
    expect(f.dispose).toHaveBeenCalledTimes(1);
    expect(f.attach).toHaveBeenCalledTimes(1);
    expect(onSizeMatch).toHaveBeenCalledTimes(1);
    expect(onSizeMatch).toHaveBeenCalledWith({ status: 'unavailable', reason: 'unsupported-host' });
    expect(f.impl.handle.getSnapshot()).toBeNull();
  } finally {
    f.impl.dispose();
  }
  expect(f.dispose).toHaveBeenCalledTimes(1);
});

it('size status bridges freeze current values and drop superseded or disconnected deliveries', () => {
  const caps = new CapsVault();
  const impl = new PositioningModuleImpl(caps);
  const bridges: AnchoredPositionConnection[] = [];
  const dispose = vi.fn();
  caps.attach([
    [
      ANCHORED_POSITION_HOST_CAP,
      {
        supportsSizeMatch: true,
        attach(connection: AnchoredPositionConnection) {
          bridges.push(connection);
          return {
            update(next: AnchoredPositionConnection) {
              bridges.push(next);
            },
            requestUpdate() {},
            dispose,
          };
        },
      },
    ],
  ]);
  const anchor = {};
  const floating = {};
  const target = {};
  const first = vi.fn();
  const second = vi.fn();
  const connection: AnchoredPositionConnection = {
    anchor,
    floating,
    config: {
      side: 'bottom',
      align: 'start',
      sideOffset: 4,
      alignOffset: 0,
      strategy: 'fixed',
      avoidCollisions: false,
      collisionBoundary: 'viewport',
      collisionPadding: 0,
    },
    sizeMatch: { reference: anchor, targets: [target] },
    onSizeMatch: first,
  };
  try {
    impl.handle.connect(connection);
    bridges[0].onSizeMatch?.({ status: 'applied' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(first.mock.calls[0][0])).toBe(true);
    impl.handle.connect({ ...connection, onSizeMatch: second });
    bridges[0].onSizeMatch?.({ status: 'unavailable', reason: 'size-conflict' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    bridges[1].onSizeMatch?.({ status: 'applied' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith({ status: 'applied' });
    impl.handle.disconnect();
    bridges[1].onSizeMatch?.({ status: 'applied' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  } finally {
    impl.dispose();
  }
});
