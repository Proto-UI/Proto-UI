// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { OverlayModuleImpl } from '../src/impl';
import {
  OVERLAY_TARGET_HOST_CAP,
  OVERLAY_GLOBAL_MOUNT_CAP,
  OVERLAY_LAYER_SCHEDULER_CAP,
  OVERLAY_MODAL_CAP,
  type OverlayTargetHost,
} from '../src/caps';

function fixture(provider?: OverlayTargetHost) {
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
  const root = Object.freeze({ nativeRoot: true });
  const available = { connect: vi.fn(), requestUpdate: vi.fn(), disconnect: vi.fn() };
  const host = {
    mount: vi.fn(),
    unmount: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    detach: vi.fn(),
  };
  const target = provider ?? {
    root: () => root,
    resolve: (candidate: unknown) => (candidate === root ? root : null),
  };
  const module = new OverlayModuleImpl(
    caps,
    'native-overlay-target',
    {
      subscribeOutside: () => () => {},
      setStackActive() {},
      registerRegion: () => () => {},
    } as any,
    {} as any,
    {} as any,
    {} as any,
    { disconnect() {} } as any,
    available
  );
  caps.attach([
    [OVERLAY_TARGET_HOST_CAP, target],
    [OVERLAY_GLOBAL_MOUNT_CAP, host],
    [OVERLAY_LAYER_SCHEDULER_CAP, { attach: vi.fn(() => host.detach) }],
    [OVERLAY_MODAL_CAP, host],
  ]);
  const activate = () => {
    module.configure({ defaultOpen: true, portal: true, modal: true, availableSpace: true });
    module.setViewActive(true);
    module.onMountPhase('mounted', 1);
  };
  return { caps, root, available, host, module, activate };
}

describe('host-neutral Overlay physical target boundary', () => {
  it('uses a verified native object without any DOM global and connects the same target', () => {
    expect(typeof globalThis.HTMLElement).toBe('undefined');
    const f = fixture();
    f.activate();
    expect(f.host.mount).toHaveBeenCalledWith(f.root);
    expect(f.available.connect).toHaveBeenLastCalledWith({
      target: f.root,
      boundary: 'root-content',
    });
    expect(f.module.getWarnings().filter((warning) => warning.includes('host target'))).toEqual([]);
    f.module.onMountPhase('detached', 1);
    expect(f.host.unmount).toHaveBeenCalledWith(f.root);
    expect(f.host.detach).toHaveBeenCalledTimes(1);
    expect(f.available.disconnect).toHaveBeenCalled();
  });
  it('rejects a foreign registration, retires previous physical ownership and can recover', () => {
    const f = fixture();
    f.activate();
    f.module.registerContent(Object.freeze({ foreign: true }));
    expect(f.host.unmount).toHaveBeenCalledWith(f.root);
    expect(f.host.unlock).toHaveBeenCalled();
    expect(f.host.detach).toHaveBeenCalledTimes(1);
    expect(f.module.getWarnings()).toContain('[Overlay] host target unavailable or foreign');
    const connects = f.available.connect.mock.calls.length;
    f.module.reconcileViewResourcesAfterCallback();
    expect(f.available.connect).toHaveBeenCalledTimes(connects);
    f.module.registerContent(f.root);
    expect(f.host.mount).toHaveBeenCalledTimes(2);
    expect(f.module.getWarnings().filter((warning) => warning.includes('host target'))).toEqual([]);
  });
  it('reports missing native target capability rather than throwing or accepting arbitrary tokens', () => {
    const f = fixture();
    f.caps.resetAttached();
    expect(() => f.activate()).not.toThrow();
    expect(f.module.getWarnings()).toContain('[Overlay] host target capability unavailable');
    expect(f.available.connect).not.toHaveBeenCalled();
    expect(f.host.mount).not.toHaveBeenCalled();
  });
  it('does not accept a provider returning a primitive identity', () => {
    const f = fixture({ root: () => ({ id: 1 }), resolve: () => 'native-id' as any });
    f.activate();
    expect(f.host.mount).not.toHaveBeenCalled();
    expect(f.available.connect).not.toHaveBeenCalled();
  });
  it('does not accept primitive candidates even from a permissive resolver', () => {
    const resolved = {};
    const f = fixture({ root: () => resolved, resolve: () => resolved });
    f.module.registerContent('forged-native-id');
    f.activate();
    expect(f.host.mount).not.toHaveBeenCalled();
    expect(f.available.connect).not.toHaveBeenCalled();
  });
  it('keeps only the replacement provider target after reentrant resolution', () => {
    const oldRoot = {},
      nextRoot = {};
    let f: ReturnType<typeof fixture>;
    f = fixture({
      root: () => oldRoot,
      resolve() {
        f.caps.attach([
          [
            OVERLAY_TARGET_HOST_CAP,
            {
              root: () => nextRoot,
              resolve: (candidate: unknown) => (candidate === nextRoot ? nextRoot : null),
            },
          ],
        ]);
        return oldRoot;
      },
    });
    f.activate();
    expect(f.host.mount).toHaveBeenCalledTimes(1);
    expect(f.host.mount).toHaveBeenCalledWith(nextRoot);
    expect(f.available.connect).toHaveBeenLastCalledWith({
      target: nextRoot,
      boundary: 'root-content',
    });
  });
  it('does not lock an already mounted view when its target becomes active but remains unknown', () => {
    const f = fixture({ root: () => null, resolve: () => null });
    f.module.configure({ defaultOpen: true, modal: true, availableSpace: true });
    f.module.onMountPhase('mounted', 1);
    f.module.setViewActive(true);
    expect(f.host.lock).not.toHaveBeenCalled();
    expect(f.available.connect).not.toHaveBeenCalled();
  });
  it('cannot acquire after target resolution reentrantly deactivates the view', () => {
    let f: ReturnType<typeof fixture>;
    const root = {};
    f = fixture({
      root: () => root,
      resolve(candidate) {
        f.module.setViewActive(false);
        return candidate as object;
      },
    });
    f.activate();
    expect(f.host.mount).not.toHaveBeenCalled();
    expect(f.available.connect).not.toHaveBeenCalled();
    expect(f.host.lock).not.toHaveBeenCalled();
  });
});
