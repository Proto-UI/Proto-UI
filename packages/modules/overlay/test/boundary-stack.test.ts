import { describe, expect, it } from 'vitest';
import { type AnchoredPositionHandle, type MountPhase } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import {
  BOUNDARY_HOST_BRIDGE_CAP,
  type BoundaryHostBridge,
  type BoundaryPort,
} from '@proto.ui/module-boundary';
import type { EventPort } from '@proto.ui/module-event';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import { BoundaryModuleImpl } from '../../boundary/src/impl';
import { OverlayModuleImpl } from '../src/impl';

function layer(name: string) {
  const caps = new CapsVault();
  caps.attachBase([
    [SYS_CAP, { ensureSetup() {} } as any],
    [BOUNDARY_HOST_BRIDGE_CAP, { classify: () => 'outside' } as BoundaryHostBridge],
  ]);
  const event = {} as EventPort;
  const boundary = new BoundaryModuleImpl(caps, name, event);
  const overlay = new OverlayModuleImpl(
    caps,
    name,
    boundary.handle,
    {} as BoundaryPort,
    event,
    {} as AnatomyPort,
    { disconnect() {} } as AnchoredPositionHandle
  );
  return {
    boundary,
    overlay,
    mount(phase: MountPhase, epoch: number) {
      boundary.onMountPhase(phase, epoch);
      overlay.onMountPhase(phase, epoch);
    },
    outside() {
      return boundary.notify({ nativeEvent: {} });
    },
    dispose() {
      overlay.onProtoPhase('unmounted');
      boundary.onProtoPhase('unmounted');
    },
  };
}

describe('Overlay boundary stack participation', () => {
  it('retains a new logical activation when a controlled owner synchronously reopens', () => {
    const earlier = layer('earlier');
    const later = layer('later');
    try {
      earlier.overlay.open();
      later.overlay.open();
      const unwatch = earlier.overlay.handle.open.watch((_run, event) => {
        if (event.type === 'next' && !event.next) earlier.overlay.open();
      });
      earlier.overlay.close();
      unwatch();
      expect(earlier.overlay.isOpen()).toBe(true);
      expect(earlier.outside()).toBe('outside');
      expect(later.outside()).toBe('unknown');
    } finally {
      later.dispose();
      earlier.dispose();
    }
  });

  it('keeps ordinary topmost semantics while an opted-out presentation stays transparent', () => {
    const parent = layer('parent');
    const passive = layer('passive');
    const child = layer('child');
    try {
      parent.overlay.open();
      passive.overlay.configure({ boundaryStack: false, defaultOpen: true });
      expect(parent.outside()).toBe('outside');
      expect(passive.overlay.isOpen()).toBe(true);
      expect(parent.overlay.getConfig().boundaryStack).toBe(true);

      child.overlay.open();
      expect(parent.outside()).toBe('unknown');
      expect(child.outside()).toBe('outside');
      passive.overlay.close();
      passive.overlay.open();
      passive.mount('detached', 1);
      passive.mount('mounted', 2);
      expect(parent.outside()).toBe('unknown');
      expect(child.outside()).toBe('outside');
      child.overlay.close();
      expect(parent.outside()).toBe('outside');
    } finally {
      child.dispose();
      passive.dispose();
      parent.dispose();
    }
  });

  it('reconciles setup configuration on an already-open overlay without promoting repeats', () => {
    const parent = layer('parent');
    const configurable = layer('configurable');
    const later = layer('later');
    try {
      parent.overlay.open();
      configurable.overlay.configure({ defaultOpen: true });
      expect(parent.outside()).toBe('unknown');
      configurable.overlay.configure({ boundaryStack: false });
      expect(parent.outside()).toBe('outside');
      configurable.overlay.configure({ boundaryStack: true });
      expect(parent.outside()).toBe('unknown');

      later.overlay.open();
      configurable.overlay.configure({ boundaryStack: true, restore: 'none' });
      configurable.overlay.open();
      expect(configurable.outside()).toBe('unknown');
      expect(later.outside()).toBe('outside');
      later.overlay.close();
      expect(configurable.outside()).toBe('outside');

      configurable.overlay.close();
      configurable.overlay.configure({ defaultOpen: false, boundaryStack: false });
      configurable.overlay.configure({ boundaryStack: true });
      expect(configurable.overlay.isOpen()).toBe(false);
      expect(parent.outside()).toBe('outside');

      configurable.overlay.open();
      expect(parent.outside()).toBe('unknown');
      configurable.overlay.configure({ boundaryStack: false });
      expect(configurable.overlay.isOpen()).toBe(true);
      expect(parent.outside()).toBe('outside');
    } finally {
      later.dispose();
      configurable.dispose();
      parent.dispose();
    }
  });
});
