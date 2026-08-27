import type {
  OverlayHandle,
  OverlayModuleHandle,
  OverlayPresenceBinding,
  RunHandle,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { definePrivilegedAsHook } from './privileged';

type OverlayFacade = {
  getOverlay<P extends PropsBaseType = PropsBaseType>(): OverlayModuleHandle<P>;
};

type OverlayPort = {
  setViewActive(active: boolean): void;
  markPresenceBound(): void;
  reconcileViewResourcesAfterCallback(): void;
};

const installOverlay = definePrivilegedAsHook<PropsBaseType, OverlayHandle<PropsBaseType>>({
  name: 'asOverlay',
  setup: ({ def, rt, facades, ports }) => {
    const facade = facades.overlay as OverlayFacade | undefined;
    const port = ports.overlay as OverlayPort | undefined;
    if (!facade || typeof facade.getOverlay !== 'function' || !port) {
      throw new Error(`[AsHook] overlay capability unavailable for asOverlay.`);
    }

    const raw = facade.getOverlay();
    let currentRun: RunHandle<PropsBaseType> | null = null;
    let presenceBinding: OverlayPresenceBinding<PropsBaseType> | null = null;
    let retainedView = false;
    let offPresence: (() => void) | null = null;
    let disposed = false;
    const scheduleBoundViewActive = (active: boolean) => {
      port.setViewActive(active);
      if (!active) return;
      port.reconcileViewResourcesAfterCallback();
    };

    const driveLogicalPresence = (open: boolean) => {
      if (!currentRun || disposed) return;
      if (presenceBinding) {
        if (open) presenceBinding.enter();
        else presenceBinding.leave();
        return;
      }

      port.setViewActive(open);
      if (retainedView) return;
      currentRun.lifecycle.setPresent(open);
    };

    const offOpen = raw.open.watch((_run, event) => {
      if (event.type !== 'next') return;
      driveLogicalPresence(event.next);
    });

    def.lifecycle.onCreated((run) => {
      currentRun = run;
      if (presenceBinding) return;
      const open = raw.isOpen();
      port.setViewActive(open);
      run.lifecycle.setPresent(retainedView ? true : open);
    });

    def.lifecycle.onMounted((run) => {
      currentRun = run;
      const target = run.host?.get?.();
      if (target) raw.registerContent(target);
    });

    def.lifecycle.onUnmounted((run) => {
      currentRun = run;
    });

    def.lifecycle.onBeforeDispose(() => {
      disposed = true;
      offPresence?.();
      offPresence = null;
      offOpen();
      currentRun = null;
    });

    const handle: OverlayHandle<PropsBaseType> = {
      open: raw.open,
      isOpen: () => raw.isOpen(),
      openOverlay: (reason) => raw.openOverlay(reason),
      close: (reason) => raw.close(reason),
      toggle: (reason) => raw.toggle(reason),
      configure: (patch) => raw.configure(patch),
      updatePosition: (patch) => raw.updatePosition(patch),
      registerTrigger: (target) => raw.registerTrigger(target),
      registerAnchor: (target) => raw.registerAnchor(target),
      registerAnchorPart: (part) => raw.registerAnchorPart(part),
      registerContent: (target) => raw.registerContent(target),
      getPositionSnapshot: () => raw.getPositionSnapshot(),
      keepMounted() {
        rt.ensureSetup('overlay.keepMounted');
        if (presenceBinding) {
          throw new Error('[asOverlay] cannot keep mounted after Presence binding.');
        }
        retainedView = true;
      },
      bindPresence(binding) {
        rt.ensureSetup('overlay.bindPresence');
        if (presenceBinding === binding) return;
        if (presenceBinding) {
          throw new Error('[asOverlay] presence is already bound for this prototype instance.');
        }
        if (retainedView) {
          throw new Error('[asOverlay] cannot bind Presence after keepMounted().');
        }

        presenceBinding = binding;
        port.markPresenceBound();
        port.setViewActive(binding.present.get());
        offPresence = binding.present.watch((_run, event) => {
          if (event.type !== 'next') return;
          // Activating portal/layer resources synchronously from a transition's
          // mounted callback can relocate a WC host in the middle of the same
          // lifecycle callback chain. Reconcile after that chain completes.
          scheduleBoundViewActive(event.next);
        });

        // This callback is registered at bind time, after the transition's own
        // created callback, so runtime controls are available before first sync.
        def.lifecycle.onCreated((run) => {
          currentRun = run;
          port.setViewActive(binding.present.get());
          if (raw.isOpen()) binding.enter();
          else binding.leave();
        });
      },
    };

    return Object.freeze(handle);
  },
});

/**
 * Installs one privileged overlay capability. Configuration and optional
 * transition presence binding are expressed through the returned handle.
 */
export function asOverlay<P extends PropsBaseType = PropsBaseType>(): OverlayHandle<P> {
  return installOverlay() as OverlayHandle<P>;
}
