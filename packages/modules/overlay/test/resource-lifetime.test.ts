import { expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { HOST_ELEMENT_CAP } from '@proto.ui/core';
import type { AnchoredPositionHandle, MountPhase } from '@proto.ui/core';
import {
  BOUNDARY_HOST_BRIDGE_CAP,
  type BoundaryPort,
  type BoundaryHostBridge,
} from '@proto.ui/module-boundary';
import type { EventPort } from '@proto.ui/module-event';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { BoundaryModuleImpl } from '../../boundary/src/impl';
import { OverlayModuleImpl } from '../src/impl';
import {
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_MODAL_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
} from '../src/caps';

it('T-OVERLAY-CATALOG-0001-CASE-RESOURCES: replaces providers through their original owners and releases at detach', () => {
  const caps = new CapsVault();
  caps.attachBase([
    [
      SYS_CAP,
      {
        ensureSetup() {},
        deferAfterCallback(fn: () => void) {
          fn();
        },
      } as any,
    ],
  ]);
  const boundary = {
    subscribeOutside: () => () => {},
    setStackActive() {},
    registerRegion: () => () => {},
  };
  const position = { disconnect: vi.fn() };
  const module = new OverlayModuleImpl(
    caps,
    'overlay-resources',
    boundary as any,
    {} as any,
    {} as any,
    {} as any,
    position as any
  );
  const host = document.createElement('div');
  const provider = () => {
    const detach = vi.fn();
    return {
      mount: vi.fn(),
      unmount: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(),
      attach: vi.fn(() => detach),
      detach,
    };
  };
  const a = provider(),
    b = provider();
  const install = (p: ReturnType<typeof provider>) =>
    caps.attach([
      [HOST_ELEMENT_CAP, host],
      [OVERLAY_GLOBAL_MOUNT_CAP, p],
      [OVERLAY_MODAL_CAP, p],
      [OVERLAY_LAYER_SCHEDULER_CAP, p],
    ]);
  install(a);
  module.configure({ defaultOpen: true, portal: true, modal: true });
  module.setViewActive(true);
  module.onMountPhase('mounted', 1);
  expect(a.mount).toHaveBeenCalledTimes(1);
  expect(a.lock).toHaveBeenCalledTimes(1);
  install(b);
  expect(a.unmount).toHaveBeenCalledWith(host);
  expect(a.unlock).toHaveBeenCalledTimes(1);
  expect(a.detach).toHaveBeenCalledTimes(1);
  expect(b.mount).toHaveBeenCalledWith(host);
  expect(b.lock).toHaveBeenCalledTimes(1);
  install(b);
  expect(b.mount).toHaveBeenCalledTimes(1);
  module.onMountPhase('detached', 1);
  expect(b.unmount).toHaveBeenCalledTimes(1);
  expect(b.unlock).toHaveBeenCalledTimes(1);
  expect(b.detach).toHaveBeenCalledTimes(1);
  caps.resetAttached();
  module.onProtoPhase('unmounted');
  expect(b.unlock).toHaveBeenCalledTimes(1);
});

it('restores view eligibility without changing logical outside ownership', () => {
  const outsider = document.createElement('button');
  const createLayer = (name: string) => {
    const caps = new CapsVault();
    caps.attachBase([
      [
        BOUNDARY_HOST_BRIDGE_CAP,
        {
          classify: ({ sample }: Parameters<BoundaryHostBridge['classify']>[0]) =>
            sample?.target === outsider ? 'outside' : 'unknown',
        },
      ],
    ]);
    // Sampling and positioning are controlled here; no Event/geometry method is used.
    const event = {} as EventPort;
    const boundaryPort = {} as BoundaryPort;
    const anatomy = {} as AnatomyPort;
    const position = { disconnect() {} } as AnchoredPositionHandle;
    const boundary = new BoundaryModuleImpl(caps, name, event);
    const overlay = new OverlayModuleImpl(
      caps,
      name,
      boundary.handle,
      boundaryPort,
      event,
      anatomy,
      position
    );
    const mount = (phase: MountPhase, epoch: number) => {
      boundary.onMountPhase(phase, epoch);
      overlay.onMountPhase(phase, epoch);
    };
    const dispose = () => {
      overlay.onProtoPhase('unmounted');
      boundary.onProtoPhase('unmounted');
    };
    return { boundary, overlay, mount, dispose };
  };
  const parent = createLayer('parent');
  const child = createLayer('child');
  const sample = () => ({ target: outsider, nativeEvent: {} });
  let parentOutside = 0;
  let childOutside = 0;
  parent.boundary.subscribeOutside(() => {
    parentOutside++;
  });
  child.boundary.subscribeOutside(() => {
    childOutside++;
    child.overlay.close();
  });

  try {
    parent.mount('mounted', 1);
    child.mount('mounted', 1);
    parent.overlay.open();
    child.overlay.open();
    parent.mount('unmounting', 1);
    parent.mount('detached', 1);
    expect(parent.boundary.notify(sample())).toBe('unknown');
    parent.mount('mounted', 2);
    parent.overlay.open();
    expect(parent.boundary.notify(sample())).toBe('unknown');

    const closingSample = sample();
    expect(child.boundary.notify(closingSample)).toBe('outside');
    expect(parent.boundary.notify(closingSample)).toBe('unknown');
    expect([parentOutside, childOutside]).toEqual([0, 1]);
    expect(parent.boundary.notify(sample())).toBe('outside');

    // Explicit Boundary activation still promotes; redundant Overlay open does not.
    child.overlay.open();
    parent.boundary.setStackActive(true);
    expect(parent.boundary.notify(sample())).toBe('outside');
    parent.mount('detached', 2);
    parent.overlay.close();
    parent.mount('mounted', 3);
    expect(child.boundary.notify(sample())).toBe('outside');
    expect([parentOutside, childOutside]).toEqual([2, 2]);
  } finally {
    child.dispose();
    parent.dispose();
  }
});
