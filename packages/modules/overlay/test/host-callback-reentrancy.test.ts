// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { OverlayModuleImpl } from '../src/impl';
import {
  OVERLAY_TARGET_HOST_CAP,
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
} from '../src/caps';

function fixture() {
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
  const target = {};
  const available = { connect: vi.fn(), disconnect: vi.fn(), requestUpdate: vi.fn() };
  const positioning = { connect: vi.fn(), disconnect: vi.fn() };
  const module = new OverlayModuleImpl(
    caps,
    'overlay-host-callback-reentry',
    {
      subscribeOutside: () => () => {},
      setStackActive() {},
      registerRegion: () => () => {},
    } as any,
    {} as any,
    {} as any,
    {} as any,
    positioning as any,
    available
  );
  const provider = () => {
    const active = { portal: 0, layer: 0, modal: 0 };
    const detach = vi.fn(() => {
      active.layer--;
    });
    return {
      active,
      mount: vi.fn(() => {
        active.portal++;
      }),
      unmount: vi.fn(() => {
        active.portal--;
      }),
      attach: vi.fn(() => {
        active.layer++;
        return detach;
      }),
      detach,
      lock: vi.fn(() => {
        active.modal++;
      }),
      unlock: vi.fn(() => {
        active.modal--;
      }),
    };
  };
  const a = provider(),
    b = provider();
  const install = (p = a) =>
    caps.attach([
      [
        OVERLAY_TARGET_HOST_CAP,
        {
          root: () => target,
          resolve: (candidate: unknown) => (candidate === target ? target : null),
        },
      ],
      [OVERLAY_GLOBAL_MOUNT_CAP, p],
      [OVERLAY_LAYER_SCHEDULER_CAP, p],
      [OVERLAY_MODAL_CAP, p],
    ]);
  install();
  const activate = () => {
    module.configure({ defaultOpen: true, portal: true, modal: true, availableSpace: true });
    module.setViewActive(true);
    module.onMountPhase('mounted', 1);
  };
  return { caps, target, module, a, b, install, activate, available, positioning };
}

for (const stage of ['mount', 'attach', 'lock'] as const) {
  for (const action of ['deactivate', 'detach', 'replace', 'remount'] as const) {
    it(`${stage} reentry ${action}: rejects stale continuation and cleans acquisition through its owner`, () => {
      const f = fixture();
      const original = f.a[stage].getMockImplementation()!;
      f.a[stage].mockImplementationOnce((() => {
        // Invoke the lifecycle transition before the host finishes allocating.
        // This exposes cleanup that ran too early or retained a stale receipt.
        if (action === 'deactivate') f.module.setViewActive(false);
        if (action === 'detach') f.module.onMountPhase('detached', 1);
        if (action === 'replace') f.install(f.b);
        if (action === 'remount') {
          f.module.onMountPhase('detached', 1);
          f.module.onMountPhase('mounted', 2);
        }
        return original();
      }) as any);
      f.activate();
      if (action === 'deactivate' || action === 'detach') {
        expect(f.a.active.modal).toBe(0);
        if (stage === 'mount') {
          expect(f.a.attach).not.toHaveBeenCalled();
          expect(f.available.connect).not.toHaveBeenCalled();
        }
        if (stage !== 'lock') expect(f.a.lock).not.toHaveBeenCalled();
      } else if (action === 'replace') {
        expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
        expect(f.b.active).toEqual({ portal: 1, layer: 1, modal: 1 });
      } else {
        expect(f.a.active).toEqual({ portal: 1, layer: 1, modal: 1 });
      }
      f.module.onMountPhase('detached', 2);
      expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
      expect(f.b.active).toEqual({ portal: 0, layer: 0, modal: 0 });
      f.module.onProtoPhase('unmounted');
      expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    });
  }
}

describe('post-positioning continuation', () => {
  it('does not lock modal after available-space host callback deactivation', () => {
    const f = fixture();
    f.available.connect.mockImplementationOnce(() => f.module.setViewActive(false));
    f.activate();
    expect(f.a.lock).not.toHaveBeenCalled();
    f.module.onMountPhase('detached', 1);
    expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
  });
});

for (const stage of ['unmount', 'detach', 'unlock'] as const) {
  it(`${stage} cleanup reentry leaves only the current provider's newly mounted resources`, () => {
    const f = fixture();
    f.activate();
    const original = f.a[stage].getMockImplementation()!;
    f.a[stage].mockImplementationOnce(() => {
      f.install(f.b);
      f.module.onMountPhase('mounted', 2);
      original();
    });
    f.module.onMountPhase('detached', 1);
    expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    expect(f.b.active).toEqual({ portal: 1, layer: 1, modal: 1 });
    f.module.onMountPhase('detached', 2);
    expect(f.b.active).toEqual({ portal: 0, layer: 0, modal: 0 });
  });
}

it('review: a failed layer acquisition must not suppress a later successful retry', () => {
  const f = fixture();
  f.a.attach.mockImplementationOnce(() => {
    throw new Error('transient layer provider failure');
  });
  expect(() => f.activate()).toThrow('transient layer provider failure');
  expect(f.a.active).toEqual({ portal: 1, layer: 0, modal: 0 });
  f.module.reconcileViewResourcesAfterCallback();
  expect(f.a.attach).toHaveBeenCalledTimes(2);
  expect(f.a.active).toEqual({ portal: 1, layer: 1, modal: 1 });
  f.module.onMountPhase('detached', 1);
  expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
});

for (const stage of ['mount', 'attach', 'lock'] as const) {
  it(`review: ${stage} reentrant deactivate/reactivate retires the old receipt before reacquiring`, () => {
    const f = fixture();
    const original = f.a[stage].getMockImplementation()!;
    f.a[stage].mockImplementationOnce((() => {
      f.module.setViewActive(false);
      f.module.setViewActive(true);
      return original();
    }) as any);
    f.activate();
    expect(f.a.active).toEqual({ portal: 1, layer: 1, modal: 1 });
    f.module.onMountPhase('detached', 1);
    expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
  });
}

for (const replacement of ['new-provider', 'new-epoch', 'provider-and-epoch'] as const) {
  it(`review retry delta: failed attach with ${replacement} retains the replacement generation for retry`, () => {
    const f = fixture();
    const failure = new Error(`failed retired attach: ${replacement}`);
    f.a.attach.mockImplementationOnce(() => {
      if (replacement !== 'new-epoch') f.install(f.b);
      if (replacement !== 'new-provider') {
        f.module.onMountPhase('detached', 1);
        f.module.onMountPhase('mounted', 2);
      }
      throw failure;
    });
    let thrown: unknown;
    try {
      f.activate();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    const currentProvider = replacement === 'new-epoch' ? f.a : f.b;
    // Reentry is serialized. No replacement layer may race the retired
    // acquisition's finally block, and its failure must remain visible.
    expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    expect(f.b.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    f.module.reconcileViewResourcesAfterCallback();
    expect(currentProvider.active).toEqual({ portal: 1, layer: 1, modal: 1 });
    const acquisitions = currentProvider.attach.mock.calls.length;
    f.module.reconcileViewResourcesAfterCallback();
    expect(currentProvider.attach).toHaveBeenCalledTimes(acquisitions);
    expect(currentProvider.active).toEqual({ portal: 1, layer: 1, modal: 1 });
    if (currentProvider === f.b) {
      expect(f.a.attach).toHaveBeenCalledTimes(1);
      expect(f.a.detach).not.toHaveBeenCalled();
    }
    f.module.onMountPhase('detached', 2);
    expect(f.a.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    expect(f.b.active).toEqual({ portal: 0, layer: 0, modal: 0 });
    expect(currentProvider.detach).toHaveBeenCalledTimes(1);
    f.module.onProtoPhase('unmounted');
    expect(currentProvider.detach).toHaveBeenCalledTimes(1);
  });
}
