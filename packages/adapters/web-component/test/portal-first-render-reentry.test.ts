import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAsHook, type Prototype } from '@proto.ui/core';
import { getActiveAsHookContext } from '@proto.ui/core/internal';
import type { PresenceFacade, PresenceHandle } from '@proto.ui/module-presence';
import { AdaptToWebComponent } from '../src';
import {
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
} from '../src/platform/instance-tree';
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

  function presenceFixture(name: string, initiallyPresent: boolean) {
    let presence: PresenceHandle;
    const mounted = vi.fn();
    const capturePresence = defineAsHook({
      name: `portal-presence-${name}`,
      setup() {
        const { facades } = getActiveAsHookContext('portal handoff presence fixture');
        presence = (facades.presence as PresenceFacade).createHandle({ mode: 'immediate' });
        if (initiallyPresent) presence.setIntent('enter');
      },
    });
    const proto: Prototype = {
      name: `portal-handoff-${name}`,
      setup(def) {
        capturePresence();
        def.lifecycle.onMounted(mounted);
        return (renderer) => renderer.slot();
      },
    };
    return {
      proto,
      mounted,
      get presence() {
        return presence;
      },
    };
  }

  it('withdraws current readiness inside throwing unmount diagnostics while Presence holds teardown', async () => {
    const fixture = presenceFixture('withdraw', true);
    const observed: boolean[] = [];
    const Owner = AdaptToWebComponent(fixture.proto, {
      shadow: false,
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'mount.phase' && event.phase === 'unmounting') {
            observed.push(isFocusTargetOwnerReady(host!));
            throw false;
          }
        },
      },
    });
    host = new Owner();
    document.body.append(host);
    await captured!.mount();
    expect(fixture.mounted).toHaveBeenCalledOnce();
    expect(isFocusTargetOwnerReady(host)).toBe(true);
    const unmounted = captured!.unmount();
    expect(observed).toEqual([false]);
    expect(fixture.presence.getPhase()).toBe('present');
    expect(isFocusTargetOwnerReady(host)).toBe(false);
    fixture.presence.setIntent('leave');
    await expect(unmounted).rejects.toBe(false);
  });

  it.each(['diagnostic', 'readiness', 'scheduler', 'inline-scheduler'] as const)(
    'rejects the held mount and releases its first portal projection on %s failure',
    async (failure) => {
      const fixture = presenceFixture(failure, false);
      const submissions = vi.fn();
      const observer = vi.fn(() => {
        throw undefined;
      });
      const Owner = AdaptToWebComponent(fixture.proto, {
        shadow: false,
        diagnostics: {
          onLifecycleEvent(event) {
            if (failure === 'diagnostic' && event.type === 'mount.phase' && event.phase === 'mounted')
              observer();
          },
        },
        schedule(task) {
          if (runtimeScheduleDepth) {
            submissions();
            if (failure === 'scheduler') throw undefined;
            if (failure === 'inline-scheduler') {
              task();
              throw false;
            }
          }
          queueMicrotask(task);
        },
      });
      host = new Owner();
      const origin = document.createElement('section');
      origin.append(host);
      document.body.append(origin);
      const pending = captured!.mount();
      expect(fixture.presence.getPhase()).toBe('absent');
      expect(isFocusTargetOwnerReady(host)).toBe(false);
      expect(submissions).not.toHaveBeenCalled();
      const unsubscribe =
        failure === 'readiness' ? subscribeFocusTargetOwnerReady(host, observer) : undefined;
      try {
        fixture.presence.setIntent('enter');
        const inline = failure === 'inline-scheduler';
        const submitted = inline || failure === 'scheduler';
        await expect(pending).rejects.toBe(inline ? false : undefined);
        expect(observer).toHaveBeenCalledTimes(submitted ? 0 : 1);
        expect(submissions).toHaveBeenCalledTimes(submitted ? 1 : 0);
        expect(fixture.mounted).toHaveBeenCalledTimes(inline ? 1 : 0);
        if (!submitted) expect(isFocusTargetOwnerReady(host)).toBe(false);
        // No intervening unmount can mask a stranded first-projection acquisition.
        expect(host.parentElement).toBe(origin);
        portal.mount(host);
        expect(host.parentElement).toBe(document.body);
        for (let frame = 0; frame < 2; frame++) {
          expect(host.getAttribute('data-pui-view-revealing')).toBe('portal');
          expect(frames.size).toBeGreaterThan(0);
          const callbacks = [...frames.values()];
          frames.clear();
          callbacks.forEach((callback) => callback(0));
        }
        expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      } finally {
        unsubscribe?.();
      }
    }
  );

  it.each(['diagnostic', 'scheduler'] as const)(
    'keeps a nested replacement ready and rejects only the failing %s handoff',
    async (failure) => {
      const fixture = presenceFixture(`replace-${failure}`, false);
      fixture.mounted.mockImplementation(() => portal.mount(host!));
      let replacing = false;
      let replacement: Promise<void> | undefined;
      const scheduled: Array<() => void> = [];
      const replaceAndThrow = () => {
        replacing = true;
        fixture.presence.setIntent('leave');
        void captured!.unmount();
        fixture.presence.setIntent('enter');
        replacement = captured!.mount();
        throw null;
      };
      const Owner = AdaptToWebComponent(fixture.proto, {
        shadow: false,
        diagnostics: {
          onLifecycleEvent(event) {
            if (failure === 'diagnostic' && event.type === 'mount.phase' &&
                event.phase === 'mounted' && event.epoch === 1) replaceAndThrow();
          },
        },
        schedule(task) {
          if (!runtimeScheduleDepth) return queueMicrotask(task);
          if (failure === 'scheduler' && !replacing) replaceAndThrow();
          scheduled.push(task);
        },
      });
      host = new Owner();
      const origin = document.createElement('section');
      origin.append(host);
      document.body.append(origin);
      const first = captured!.mount();
      fixture.presence.setIntent('enter');
      await expect(first).rejects.toBeNull();
      expect(replacement).toBeDefined();
      expect(isFocusTargetOwnerReady(host)).toBe(true);
      expect(fixture.mounted).not.toHaveBeenCalled();
      expect(scheduled).toHaveLength(1);
      scheduled.shift()!();
      await replacement;
      expect(fixture.mounted).toHaveBeenCalledOnce();
      expect(host.parentElement).toBe(document.body);
      expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      expect(frames.size).toBe(0);
    }
  );

  it.each(['presence', 'scheduled', 'queued-before-replacement'] as const)(
    'only the replacement mounted callback runs and projects its first render (%s)',
    async (scenario) => {
      let presence: PresenceHandle | undefined;
      let mounted = 0;
      let replacement: Promise<void> | undefined;
      const scheduled: Array<() => void> = [];
      const actualMountedEpochs: number[] = [];
      const phases: Array<{ phase: string; epoch: number }> = [];
      const replaceMount = () => {
        if (!captured || !presence) throw new Error('The real session must already exist.');
        presence.setIntent('leave');
        void captured.unmount();
        if (scenario !== 'presence') presence.setIntent('enter');
        replacement = captured.mount();
      };
      const capturePresence = defineAsHook({
        name: `portal-reentry-presence-${scenario}`,
        setup() {
          const { facades } = getActiveAsHookContext('portal reentry presence fixture');
          const facade = facades.presence as PresenceFacade | undefined;
          if (!facade) throw new Error('Original Presence facade is required.');
          presence = facade.createHandle({ mode: 'immediate' });
          presence.setIntent('enter');
        },
      });
      const proto: Prototype = {
        name: `portal-mounted-reentry-${scenario}`,
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
            if (
              event.phase === 'mounted' &&
              event.epoch === 1 &&
              scenario !== 'queued-before-replacement'
            )
              replaceMount();
          },
        },
      });
      host = new Owner();
      const origin = document.createElement('section');
      origin.append(host);
      document.body.append(origin);

      if (scenario === 'queued-before-replacement') {
        expect(scheduled).toHaveLength(1);
        const staleTask = scheduled.shift()!;
        replaceMount();
        expect(phases).toContainEqual({ phase: 'mounted', epoch: 2 });
        expect(scheduled).toHaveLength(1);
        // Epoch 2 owns the first-render acquisition until its queued callback finishes.
        staleTask();
      }
      expect(phases).toContainEqual({ phase: 'mounting', epoch: 2 });
      expect(mounted).toBe(0);
      if (scenario === 'presence') {
        expect(scheduled).toHaveLength(0);
        expect(isFocusTargetOwnerReady(host)).toBe(false);
        presence!.setIntent('enter');
        await new Promise<void>((resolve) => queueMicrotask(resolve));
      }
      expect(scheduled).toHaveLength(1);
      expect(isFocusTargetOwnerReady(host)).toBe(true);
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
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);

      for (let frame = 0; frame < 2; frame++) {
        expect(host.getAttribute('data-pui-view-revealing')).toBe('portal');
        expect(frames.size).toBeGreaterThan(0);
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
      }
      expect(host.hasAttribute('data-pui-view-revealing')).toBe(false);
      expect(host.hasAttribute('data-pui-portal-preparing')).toBe(false);
    }
  );
});
