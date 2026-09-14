import { expect, it, vi } from 'vitest';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { HOST_ELEMENT_CAP } from '@proto.ui/core';
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
