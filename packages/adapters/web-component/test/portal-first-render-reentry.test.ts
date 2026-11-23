import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAsHook, type Prototype } from '@proto.ui/core';
import { getActiveAsHookContext } from '@proto.ui/core/internal';
import type { PresenceFacade, PresenceHandle } from '@proto.ui/module-presence';
import { AdaptToWebComponent } from '../src';
import * as sessions from '../src/runtime/session';
import { createWebComponentPortalMount } from '../src/portal-mount';

type Session = ReturnType<typeof sessions.createWebComponentHostSession>;

describe('WC portal first rendering across mounted diagnostic reentry', () => {
  let captured: Session | undefined;
  let portal: ReturnType<typeof createWebComponentPortalMount>;
  let host: HTMLElement | undefined;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let runtimeScheduleDepth: number;

  beforeEach(() => {
    captured = undefined;
    host = undefined;
    frames = new Map();
    frameId = 0;
    runtimeScheduleDepth = 0;
    portal = createWebComponentPortalMount();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    // Observe the real WC host session; no phase, epoch, Runtime callback or
    // Presence completion is fabricated by this fixture.
    const original = sessions.createWebComponentHostSession;
    vi.spyOn(sessions, 'createWebComponentHostSession').mockImplementation((args) => {
      const session = original({
        ...args,
        schedule(task) {
          runtimeScheduleDepth++;
          try {
            args.schedule(task);
          } finally {
            runtimeScheduleDepth--;
          }
        },
      });
      captured = session;
      return session;
    });
  });

  afterEach(async () => {
    if (host) portal.unmount(host);
    await captured?.dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each(['presence', 'scheduled'] as const)(
    'a stale mount cannot retire the replacement while it is %s',
    async (replacementGate) => {
      let presence: PresenceHandle | undefined;
      let mounted = 0;
      let replacement: Promise<void> | undefined;
      const scheduled: Array<() => void> = [];
      const actualMountedEpochs: number[] = [];
      const phases: Array<{ phase: string; epoch: number }> = [];
      const capturePresence = defineAsHook({
        name: `portal-reentry-presence-${replacementGate}`,
        setup() {
          const { facades } = getActiveAsHookContext('portal reentry presence fixture');
          const facade = facades.presence as PresenceFacade | undefined;
          if (!facade) throw new Error('Original Presence facade is required.');
          presence = facade.createHandle({ mode: 'immediate' });
          presence.setIntent('enter');
        },
      });
      const proto: Prototype = {
        name: `portal-mounted-reentry-${replacementGate}`,
        setup(def) {
          capturePresence();
          def.lifecycle.onMounted(() => {
            mounted++;
            if (!host) throw new Error('The connected fixture host is required.');
            portal.mount(host);
          });
          return (renderer) => renderer.slot();
        },
      };
      const Owner = AdaptToWebComponent(proto, {
        shadow: false,
        schedule: (task) => {
          // Retain the original default microtask policy for focus readiness;
          // only actual Runtime mounted completions use this controlled queue.
          if (runtimeScheduleDepth) scheduled.push(task);
          else queueMicrotask(task);
        },
        diagnostics: {
          onLifecycleEvent(event) {
            if (event.type === 'mount.mounted') actualMountedEpochs.push(event.epoch);
            if (event.type !== 'mount.phase') return;
            phases.push({ phase: event.phase, epoch: event.epoch });
            if (event.phase !== 'mounted' || event.epoch !== 1) return;
            if (!captured || !presence) throw new Error('The real session must already exist.');
            presence.setIntent('leave');
            void captured.unmount();
            if (replacementGate === 'scheduled') presence.setIntent('enter');
            replacement = captured.mount();
          },
        },
      });
      host = new Owner();
      const origin = document.createElement('section');
      origin.append(host);
      document.body.append(origin);

      expect(phases).toContainEqual({ phase: 'mounting', epoch: 2 });
      expect(mounted).toBe(0);
      if (replacementGate === 'presence') {
        expect(scheduled).toHaveLength(1);
        scheduled.shift()!(); // Invalidated epoch 1; epoch 2 is still awaiting Presence.
        presence!.setIntent('enter');
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        expect(scheduled).toHaveLength(1);
      } else {
        expect(scheduled).toHaveLength(2);
        // The configured host owns task order. Epoch 2 was queued recursively
        // before epoch 1 returned to schedule; execute the stale task first.
        scheduled.pop()!();
        expect(scheduled).toHaveLength(1);
      }
      expect(actualMountedEpochs).toEqual([]);
      scheduled.shift()!();
      await replacement;
      expect(actualMountedEpochs).toEqual([2]);
      expect(mounted).toBe(1);
      expect(host.parentElement).toBe(document.body);
      expect(host.getAttribute('data-pui-view-revealing')).toBe('portal');
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(true);

      for (let frame = 0; frame < 2; frame++) {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
      }
      expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);
      // A later relocation of this already presented view is still covered by
      // the theme guard, without hiding the retained layout again.
      portal.unmount(host);
      portal.mount(host);
      expect(host.getAttribute('data-pui-view-revealing')).toBe('portal');
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);
    }
  );
});
