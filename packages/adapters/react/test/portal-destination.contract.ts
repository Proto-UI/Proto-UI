import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusable, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { expectStableReactPortalMount } from './portal-destination.assertions';
import {
  isWebPortalMaterialSuspended,
  registerWebPortalDestination,
  subscribeWebPortalDestinations,
  getWebPortalProjectionGeneration,
} from '@proto.ui/adapter-base';

export type DestinationMount = {
  stablePortalContainer?: boolean;
  authorAdoptionTransfersProjection?: boolean;
  run(work: () => void): Promise<void>;
  flush(): Promise<void>;
  refresh(): Promise<void>;
  destroy(): Promise<void>;
  actions(): { open(): void; close(): void; focus(): void; isOpen(): boolean };
  owner(): HTMLElement;
  logicalParent(target: HTMLElement): HTMLElement | null;
};
type Mount = (host: HTMLElement, owner: Prototype, content: Prototype) => Promise<DestinationMount>;

// Actual Adapter instances and the installed framework renderers, in happy-dom.
// Synthetic keyboard/focus dispatch establishes owner continuity, not native
// browser traversal, clipping, geometry, compositor paint or optical admission.
export function portalDestinationContract(name: string, mount: Mount) {
  let serial = 0;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  async function fixture(portal = true, register = true, dismiss = false) {
    const scene = document.createElement('section');
    const host = document.createElement('div');
    const destination = document.createElement('div');
    const replacement = document.createElement('div');
    const outside = document.createElement('button');
    scene.append(host, destination, replacement, outside);
    document.body.append(scene);
    const releases: Array<() => void> = [];
    const changes: boolean[] = [];
    const counts = { setup: 0, disposed: 0 };
    let registerTrigger: ((target: HTMLElement) => void) | undefined;
    if (register) releases.push(registerWebPortalDestination(scene, destination));
    const owner = definePrototype({
      name: `portal-destination-owner-${id}-${++serial}`,
      setup() {
        asFocusable();
        return (r) => r.slot();
      },
    });
    const content = definePrototype({
      name: `portal-destination-content-${id}-${serial}`,
      setup(def) {
        counts.setup++;
        const focus = asFocusable();
        const scope = dismiss ? asFocusScope() : null;
        scope?.configure({ entry: 'manual', restore: 'previous' });
        const overlay = asOverlay();
        overlay.configure({
          defaultOpen: true,
          portal,
          entry: 'manual',
          restore: dismiss ? 'trigger' : 'none',
          closeOnEscape: true,
          closeOnFocusOutside: dismiss,
          closeOnOutsidePress: dismiss,
        });
        if (dismiss) registerTrigger = (target) => overlay.registerTrigger(target);
        overlay.open.watch((_run, event) => {
          if (event.type !== 'next') return;
          changes.push(event.next);
          // The test's semantic owner composes the existing FocusScope; Overlay
          // alone does not own focus restoration. Outside-focus close stays out.
          if (!event.next && event.reason === 'escape') scope?.deactivate();
        });
        def.expose('actions', {
          open: () => overlay.openOverlay(),
          close: () => overlay.close(),
          isOpen: () => overlay.isOpen(),
          focus: () => {
            scope?.activate();
            focus.focusSelf();
          },
        });
        def.lifecycle.onBeforeDispose(() => counts.disposed++);
        return () => 'Destination lifetime content';
      },
    });
    let mounted: DestinationMount;
    try {
      mounted = await mount(host, owner, content);
      await mounted.flush();
      if (registerTrigger) await mounted.run(() => registerTrigger!(mounted.owner()));
    } catch (error) {
      for (const release of releases.reverse()) release();
      scene.remove();
      throw error;
    }
    let destroyed = false;
    const current = () => document.querySelector<HTMLElement>('.portal-lifetime-target')!;
    return {
      ...mounted,
      scene,
      host,
      destination,
      replacement,
      outside,
      changes,
      counts,
      current,
      initialRelease: releases[0],
      async bind(scope: Element, target: HTMLElement) {
        let release!: () => void;
        await mounted.run(() => {
          release = registerWebPortalDestination(scope, target);
          releases.push(release);
        });
        await mounted.flush();
        return release;
      },
      assertLive(parent: HTMLElement) {
        const target = current();
        expect(target).not.toBeNull();
        if (mounted.stablePortalContainer) expectStableReactPortalMount(target, parent);
        else expect(target.parentElement).toBe(parent);
        expect(mounted.logicalParent(target)).toBe(mounted.owner());
        expect(document.querySelectorAll('.portal-lifetime-target')).toHaveLength(1);
        expect(mounted.actions().isOpen()).toBe(true);
        expect(counts).toEqual({ setup: 1, disposed: 0 });
      },
      async destroy() {
        if (destroyed) return;
        destroyed = true;
        await mounted.destroy();
        await mounted.flush();
      },
      async cleanup() {
        if (!destroyed) {
          destroyed = true;
          await mounted.destroy();
          await mounted.flush();
        }
        for (const release of releases.reverse()) release();
        scene.remove();
      },
    };
  }

  async function reopen(f: Awaited<ReturnType<typeof fixture>>) {
    await f.run(() => f.actions().close());
    await f.flush();
    await f.run(() => f.actions().open());
    await f.flush();
  }

  describe(`${name}: fixed-view-epoch portal destination contract`, () => {
    it('suspends a default-body epoch when its connected author is adopted into another document', async () => {
      const f = await fixture(true, false);
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      const foreign = iframe.contentDocument!;
      const target = f.current();
      const parent = target.parentNode;
      const targetDocument = target.ownerDocument;
      const projectionGeneration = getWebPortalProjectionGeneration(target);
      const restoreInsertions: Array<() => void> = [];
      try {
        expect(isWebPortalMaterialSuspended(target)).toBe(false);
        // Happy DOM does not recursively adopt descendants. Explicitly adopt
        // every author node to model native deep adoption, leaving the portal
        // target outside that subtree. This is not native focus evidence.
        const adopt = (node: Node) => {
          const children = Array.from(node.childNodes);
          foreign.adoptNode(node);
          for (const child of children) {
            adopt(child);
            node.appendChild(child);
          }
        };
        // Native insertion also adopts nodes created by the renderer after
        // close/reopen. Happy DOM otherwise leaves their original Document.
        const appendChild = Node.prototype.appendChild;
        const insertBefore = Node.prototype.insertBefore;
        const append = vi.spyOn(Node.prototype, 'appendChild').mockImplementation(function <
          T extends Node,
        >(this: Node, node: T): T {
          if (this.ownerDocument === foreign && node.ownerDocument !== foreign) adopt(node);
          return appendChild.call(this, node) as T;
        });
        restoreInsertions.push(() => append.mockRestore());
        const insert = vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function <
          T extends Node,
        >(this: Node, node: T, reference: Node | null): T {
          if (this.ownerDocument === foreign && node.ownerDocument !== foreign) adopt(node);
          return insertBefore.call(this, node, reference) as T;
        });
        restoreInsertions.push(() => insert.mockRestore());
        await f.run(() => {
          adopt(f.host);
          foreign.body.append(f.host);
        });
        await f.flush();
        await f.refresh();
        expect(isWebPortalMaterialSuspended(target)).toBe(true);
        if (!f.authorAdoptionTransfersProjection) {
          expect(f.current()).toBe(target);
          expect(target.parentNode).toBe(parent);
          expect(target.ownerDocument).toBe(targetDocument);
          expect(target.isConnected).toBe(true);
          expect(getWebPortalProjectionGeneration(target)).toBe(projectionGeneration);
          expect(f.actions().isOpen()).toBe(true);
          expect(f.counts).toEqual({ setup: 1, disposed: 0 });
          expect(f.changes).toEqual([]);

          await f.run(() => f.actions().close());
          await f.flush();
          await f.run(() => f.actions().open());
          await f.flush();
          const reopened = foreign.querySelector<HTMLElement>('.portal-lifetime-target');
          expect(reopened).not.toBeNull();
          expect(reopened!.ownerDocument).toBe(foreign);
          if (f.stablePortalContainer) expectStableReactPortalMount(reopened!, foreign.body);
          else expect(reopened!.parentElement).toBe(foreign.body);
          expect(document.querySelectorAll('.portal-lifetime-target')).toHaveLength(0);
          expect(foreign.querySelectorAll('.portal-lifetime-target')).toHaveLength(1);
          expect(f.logicalParent(reopened!)).toBe(f.owner());
          expect(f.actions().isOpen()).toBe(true);
          expect(f.counts).toEqual({ setup: 1, disposed: 0 });
          expect(f.changes).toEqual([false, true]);
        }
        // WC explicitly retains its pre-existing adoption/detach lifecycle.
        // Its passing suspension assertion is not a same-parent continuity claim.
      } finally {
        for (const restore of restoreInsertions.reverse()) restore();
        await f.cleanup();
        iframe.remove();
      }
    });

    it('keeps the ordinary body default and leaves nonportal targets in their author tree', async () => {
      const fallback = await fixture(true, false);
      try {
        fallback.assertLive(document.body);
      } finally {
        await fallback.cleanup();
      }
      const nonportal = await fixture(false, true);
      try {
        expect(nonportal.host.contains(nonportal.current())).toBe(true);
        expect(nonportal.destination.querySelector('.portal-lifetime-target')).toBeNull();
        if (nonportal.stablePortalContainer)
          expect(document.querySelector('[data-pui-portal-mount]')).toBeNull();
        await nonportal.bind(nonportal.scene, nonportal.replacement);
        expect(nonportal.host.contains(nonportal.current())).toBe(true);
        expect(nonportal.changes).toEqual([]);
      } finally {
        await nonportal.cleanup();
      }
    });

    it('holds a replacement pending, ignores stale unregister and preserves focus and Escape ownership', async () => {
      const f = await fixture();
      try {
        f.assertLive(f.destination);
        const host = f.current();
        const parent = host.parentElement;
        const generation = getWebPortalProjectionGeneration(host);
        await f.bind(f.scene, f.replacement);
        f.assertLive(f.destination);
        expect(f.current()).toBe(host);
        expect(host.parentElement).toBe(parent);
        expect(getWebPortalProjectionGeneration(host)).toBe(generation);
        await f.run(f.initialRelease);
        await f.flush();
        f.assertLive(f.destination);
        expect(f.changes).toEqual([]);
        await f.run(() => f.actions().focus());
        expect(document.activeElement).toBe(host);
        await f.run(() =>
          host.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              bubbles: true,
              cancelable: true,
            })
          )
        );
        await f.flush();
        expect(f.actions().isOpen()).toBe(false);
        expect(f.changes).toEqual([false]);
        await f.run(() => f.actions().open());
        await f.flush();
        f.assertLive(f.replacement);
        expect(f.changes).toEqual([false, true]);
      } finally {
        await f.cleanup();
      }
    });

    it('does not move, blur or close an already-focused host when replacement or withdrawal becomes pending in happy-dom', async () => {
      const f = await fixture();
      try {
        await f.run(() => f.actions().focus());
        const host = f.current();
        const parent = host.parentElement;
        let blurs = 0;
        const blur = () => blurs++;
        host.addEventListener('blur', blur);
        expect(document.activeElement).toBe(host);
        const release = await f.bind(f.scene, f.replacement);
        await f.run(release);
        await f.flush();
        f.assertLive(f.destination);
        expect(f.current()).toBe(host);
        expect(host.parentElement).toBe(parent);
        expect(document.activeElement).toBe(host);
        expect(blurs).toBe(0);
        expect(f.changes).toEqual([]);
        host.removeEventListener('blur', blur);
      } finally {
        await f.cleanup();
      }
    });

    it('retains the existing FocusScope restoration owner while a destination replacement is pending', async () => {
      const f = await fixture(true, true, true);
      try {
        await f.bind(f.scene, f.replacement);
        f.assertLive(f.destination);
        await f.run(() => f.owner().focus());
        await f.run(() => f.actions().focus());
        expect(document.activeElement).toBe(f.current());
        await f.run(() =>
          f.current().dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              bubbles: true,
              cancelable: true,
            })
          )
        );
        await f.flush();
        expect(f.actions().isOpen()).toBe(false);
        expect(f.changes).toEqual([false]);
        expect(document.activeElement).toBe(f.owner());
      } finally {
        await f.cleanup();
      }
    });

    it('keeps outside dismissal with the existing owner and does not steal outside focus', async () => {
      const f = await fixture(true, true, true);
      try {
        await f.bind(f.scene, f.replacement);
        f.assertLive(f.destination);
        await f.run(() => f.owner().focus());
        await f.run(() => f.actions().focus());
        await f.run(() => f.outside.focus());
        await f.flush();
        expect(f.actions().isOpen()).toBe(false);
        expect(f.changes).toEqual([false]);
        expect(document.activeElement).toBe(f.outside);
      } finally {
        await f.cleanup();
      }
    });

    it('keeps inside and outside pointer hit paths attached to the same dismissal owner', async () => {
      const f = await fixture(true, true, true);
      try {
        await f.bind(f.scene, f.replacement);
        f.assertLive(f.destination);
        await f.run(() =>
          f.current().dispatchEvent(
            new MouseEvent('pointerdown', {
              bubbles: true,
              composed: true,
              cancelable: true,
            })
          )
        );
        expect(f.actions().isOpen()).toBe(true);
        expect(f.changes).toEqual([]);
        await f.run(() =>
          f.outside.dispatchEvent(
            new MouseEvent('pointerdown', {
              bubbles: true,
              composed: true,
              cancelable: true,
            })
          )
        );
        await f.flush();
        expect(f.actions().isOpen()).toBe(false);
        expect(f.changes).toEqual([false]);
      } finally {
        await f.cleanup();
      }
    });

    it('selects the newest reentrant registration only after the current view epoch retires', async () => {
      const f = await fixture();
      const newest = document.createElement('div');
      f.scene.append(newest);
      let nestedRelease: (() => void) | undefined;
      let replaced = false;
      const stop = subscribeWebPortalDestinations(() => {
        if (replaced) return;
        replaced = true;
        nestedRelease = registerWebPortalDestination(f.scene, newest);
      });
      try {
        const stale = await f.bind(f.scene, f.replacement);
        expect(replaced).toBe(true);
        f.assertLive(f.destination);
        await f.run(stale);
        await f.flush();
        f.assertLive(f.destination);
        expect(f.changes).toEqual([]);
        await reopen(f);
        f.assertLive(newest);
        expect(f.changes).toEqual([false, true]);
      } finally {
        stop();
        await f.cleanup();
        nestedRelease?.();
      }
    });

    it('holds a withdrawn destination until close then uses the ordinary body fallback', async () => {
      const f = await fixture();
      try {
        await f.run(f.initialRelease);
        await f.flush();
        f.assertLive(f.destination);
        expect(f.changes).toEqual([]);
        await reopen(f);
        f.assertLive(document.body);
        await f.bind(f.scene, f.replacement);
        f.assertLive(document.body);
        await reopen(f);
        f.assertLive(f.replacement);
        expect(f.changes).toEqual([false, true, false, true]);
      } finally {
        await f.cleanup();
      }
    });

    it('pins the active destination across author-container movement and re-resolves on reopen', async () => {
      const f = await fixture();
      const second = document.createElement('section');
      const secondDestination = document.createElement('div');
      second.append(secondDestination);
      document.body.append(second);
      try {
        await f.bind(second, secondDestination);
        const host = f.current();
        // The application owns its mount container; no renderer-owned child moves.
        second.append(f.host);
        await f.refresh();
        await f.flush();
        f.assertLive(f.destination);
        expect(f.current()).toBe(host);
        expect(f.changes).toEqual([]);
        await reopen(f);
        f.assertLive(secondDestination);
        expect(f.changes).toEqual([false, true]);
      } finally {
        await f.cleanup();
        second.remove();
      }
    });

    it('rejects a newly clipping destination at the next view epoch without moving the live view', async () => {
      const f = await fixture();
      try {
        f.destination.style.overflow = 'hidden';
        await f.refresh();
        await f.flush();
        f.assertLive(f.destination);
        expect(f.changes).toEqual([]);
        await reopen(f);
        f.assertLive(document.body);
        f.destination.style.overflow = 'visible';
        await f.refresh();
        f.assertLive(document.body);
        await reopen(f);
        f.assertLive(f.destination);
      } finally {
        await f.cleanup();
      }
    });

    it('rejects a connected same-document external destination when the next view is acquired', async () => {
      const f = await fixture();
      const external = document.createElement('div');
      document.body.append(external);
      try {
        await f.bind(f.scene, external);
        f.assertLive(f.destination);
        expect(f.changes).toEqual([]);
        await reopen(f);
        f.assertLive(document.body);
      } finally {
        await f.cleanup();
        external.remove();
      }
    });

    it('resolves nearest nested registrations at epoch boundaries without moving the current projection', async () => {
      const f = await fixture();
      const inner = document.createElement('section');
      const innerDestination = document.createElement('div');
      f.scene.prepend(inner);
      inner.append(f.host, innerDestination);
      try {
        const innerRelease = await f.bind(inner, innerDestination);
        f.assertLive(f.destination);
        await reopen(f);
        f.assertLive(innerDestination);
        await f.run(innerRelease);
        await f.flush();
        f.assertLive(innerDestination);
        await reopen(f);
        f.assertLive(f.destination);
        expect(f.changes).toEqual([false, true, false, true]);
      } finally {
        await f.cleanup();
      }
    });

    it('closes, changes policy while detached and reopens on one fresh physical view', async () => {
      const f = await fixture();
      try {
        f.assertLive(f.destination);
        await f.run(() => f.actions().close());
        await f.flush();
        expect(f.actions().isOpen()).toBe(false);
        expect(f.destination.querySelector('.portal-lifetime-target')).toBeNull();
        await f.bind(f.scene, f.replacement);
        expect(f.replacement.querySelector('.portal-lifetime-target')).toBeNull();
        await f.run(() => f.actions().open());
        await f.flush();
        f.assertLive(f.replacement);
        expect(f.changes).toEqual([false, true]);
      } finally {
        await f.cleanup();
      }
    });

    it('re-resolves author ancestry moved between scenes while its view is closed', async () => {
      const f = await fixture();
      const second = document.createElement('section');
      const nextDestination = document.createElement('div');
      second.append(nextDestination);
      document.body.append(second);
      try {
        await f.run(() => f.actions().close());
        await f.flush();
        await f.bind(second, nextDestination);
        second.append(f.host);
        await f.refresh();
        expect(nextDestination.querySelector('.portal-lifetime-target')).toBeNull();
        expect(f.actions().isOpen()).toBe(false);
        await f.run(() => f.actions().open());
        await f.flush();
        f.assertLive(nextDestination);
        expect(f.changes).toEqual([false, true]);
      } finally {
        await f.cleanup();
        second.remove();
      }
    });

    it('does not promise live-view continuity after external destination removal and releases it on teardown', async () => {
      const f = await fixture();
      try {
        const host = f.current();
        f.destination.remove();
        await f.flush();
        // The application must retain its destination for the active epoch.
        // External removal is a real DOM disconnect, not a portal policy update.
        expect(host.isConnected).toBe(false);
        expect(document.querySelector('.portal-lifetime-target')).toBeNull();
        await f.destroy();
        expect(f.counts.disposed).toBe(1);
        await f.bind(f.scene, f.replacement);
        expect(document.querySelector('.portal-lifetime-target')).toBeNull();
        if (f.stablePortalContainer)
          expect(document.querySelector('[data-pui-portal-mount]')).toBeNull();
      } finally {
        await f.cleanup();
      }
    });

    it('does not resurrect a disposed view on late registration or stale release', async () => {
      const f = await fixture();
      try {
        const previous = f.current();
        await f.destroy();
        expect(previous.isConnected).toBe(false);
        if (f.stablePortalContainer)
          expect(document.querySelector('[data-pui-portal-mount]')).toBeNull();
        expect(f.counts).toEqual({ setup: 1, disposed: 1 });
        await f.bind(f.scene, f.replacement);
        await f.run(f.initialRelease);
        await f.flush();
        expect(document.querySelector('.portal-lifetime-target')).toBeNull();
        expect(f.counts).toEqual({ setup: 1, disposed: 1 });
      } finally {
        await f.cleanup();
      }
    });
  });
}
