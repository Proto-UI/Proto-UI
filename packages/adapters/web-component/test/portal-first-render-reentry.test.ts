import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAsHook, type Prototype } from '@proto.ui/core';
import { getActiveAsHookContext } from '@proto.ui/core/internal';
import type { PresenceFacade, PresenceHandle } from '@proto.ui/module-presence';
import { AdaptToWebComponent } from '../src';
import * as sessions from '../src/runtime/session';
import { createWebComponentPortalMount } from '../src/portal-mount';

type Session = ReturnType<typeof sessions.createWebComponentHostSession>;

describe('WC portal first rendering across mounted ownership reentry', () => {
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

  it.each([
    ['diagnostic', 'presence'],
    ['diagnostic', 'scheduled'],
    ['schedule', 'presence'],
    ['schedule', 'scheduled'],
  ] as const)(
    'a mount invalidated during %s cannot retire the replacement while it is %s',
    async (reentryPoint, replacementGate) => {
      let presence: PresenceHandle | undefined;
      let mounted = 0;
      let replacement: Promise<void> | undefined;
      const scheduled: Array<() => void> = [];
      const actualMountedEpochs: number[] = [];
      const phases: Array<{ phase: string; epoch: number }> = [];
      let reentered = false;
      const replaceMount = () => {
        if (reentered) return;
        reentered = true;
        if (!captured || !presence) throw new Error('The real session must already exist.');
        presence.setIntent('leave');
        void captured.unmount();
        if (replacementGate === 'scheduled') presence.setIntent('enter');
        replacement = captured.mount();
      };
      const capturePresence = defineAsHook({
        name: `portal-reentry-presence-${reentryPoint}-${replacementGate}`,
        setup() {
          const { facades } = getActiveAsHookContext('portal reentry presence fixture');
          const facade = facades.presence as PresenceFacade | undefined;
          if (!facade) throw new Error('Original Presence facade is required.');
          presence = facade.createHandle({ mode: 'immediate' });
          presence.setIntent('enter');
        },
      });
      const proto: Prototype = {
        name: `portal-mounted-reentry-${reentryPoint}-${replacementGate}`,
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
          if (runtimeScheduleDepth) {
            scheduled.push(task);
            // Retain an actual epoch-1 task before reentry. The separate
            // diagnostic case verifies that an already stale epoch is never
            // queued; this case still executes a genuinely queued stale task.
            if (reentryPoint === 'schedule') replaceMount();
          } else queueMicrotask(task);
        },
        diagnostics: {
          onLifecycleEvent(event) {
            if (event.type === 'mount.mounted') actualMountedEpochs.push(event.epoch);
            if (event.type !== 'mount.phase') return;
            phases.push({ phase: event.phase, epoch: event.epoch });
            if (event.phase !== 'mounted' || event.epoch !== 1) return;
            if (reentryPoint === 'diagnostic') replaceMount();
          },
        },
      });
      host = new Owner();
      const origin = document.createElement('section');
      origin.append(host);
      document.body.append(origin);

      expect(phases).toContainEqual({ phase: 'mounting', epoch: 2 });
      expect(mounted).toBe(0);
      const staleTaskCount = reentryPoint === 'schedule' ? 1 : 0;
      if (replacementGate === 'presence') {
        expect(scheduled).toHaveLength(staleTaskCount);
        if (staleTaskCount) scheduled.shift()!();
        expect(actualMountedEpochs).toEqual([]);
        expect(mounted).toBe(0);
        expect(host.parentElement).toBe(origin);
        presence!.setIntent('enter');
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        expect(scheduled).toHaveLength(1);
      } else {
        expect(scheduled).toHaveLength(staleTaskCount + 1);
        // Reentry inside schedule happens after it retained epoch 1, so its
        // real stale task precedes the recursively queued epoch-2 task.
        if (staleTaskCount) scheduled.shift()!();
        expect(scheduled).toHaveLength(1);
      }
      expect(actualMountedEpochs).toEqual([]);
      scheduled.shift()!();
      await replacement;
      expect(actualMountedEpochs).toEqual([2]);
      expect(mounted).toBe(1);
      expect(host.parentElement).toBe(document.body);
      // A newly acquired surface is published with its projection. Every host
      // that reads the surface's geometry after the projection (the anchored
      // position solve, the presence projector) must observe a rendered,
      // correctly sized box, so the display guard never survives the turn that
      // projected it. The transition guard is withdrawn before the display
      // suppression, so the browser still applies authored @starting-style to
      // that first render.
      expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);
      expect(frames.size).toBe(0);
      // A later relocation of this already presented view is still covered by
      // the theme guard, without hiding the retained layout again. The reveal
      // barrier settles that guard for two layouts.
      portal.unmount(host);
      portal.mount(host);
      expect(host.getAttribute('data-pui-view-revealing')).toBe('portal');
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);

      for (let frame = 0; frame < 2; frame++) {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
      }
      expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);
    }
  );
});
