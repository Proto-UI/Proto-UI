import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { AdaptToWebComponent, setElementProps } from '../src';
import { bindLogicalParent, getLogicalParent } from '../src/platform/instance-tree';
import { asDrawerContent, drawerRoot, DRAWER_CONTEXT } from '../../../prototypes/base/src/drawer';
import * as drawerShared from '../../../prototypes/base/src/drawer/shared';

// Deterministic WC integration: reduced presentation completes synchronously.
// Reentry is injected at the real synchronous afterLeave notification, before the later
// Drawer Overlay watcher delivers its semantic request. This is not paint QA.
const owned: HTMLElement[] = [];
let sequence = 0;
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const element of owned.splice(0).reverse()) element.remove();
  await flush();
});

function fixture(controlled = false, withContent = true) {
  const id = ++sequence;
  const options = {
    schedule: (task: () => void) => task(),
    getMeta: (key: string) => (key === 'reducedMotion' ? 'reduce' : undefined),
  };
  const Root = AdaptToWebComponent(drawerRoot, {
    ...options,
    registerAs: `lifetime-drawer-root-${id}`,
  });
  const root = new Root() as any;
  setElementProps(root, controlled ? { open: true } : { defaultOpen: true });
  const requests: any[] = [];
  root.addEventListener('openChange', (event: CustomEvent) => {
    if (event.target === root) requests.push(event.detail);
  });
  let onAfterLeave: (() => void) | undefined;
  let beforeDispose = 0;
  let detaches = 0;
  let mounts = 0;
  let run!: RunHandle<any>;
  const contentProto = definePrototype({
    name: `lifetime-drawer-content-${id}`,
    setup(def) {
      const behavior = asDrawerContent();
      behavior.asTransition.configure({
        enterDuration: 500,
        leaveDuration: 500,
        completion: { kind: 'presentation', timeoutMs: 1000 },
      });
      const overlay = asOverlay();
      def.expose.method('testEscape', () => overlay.close('escape'));
      def.expose.method('readOwner', () => run.context.read(DRAWER_CONTEXT).rootId);
      def.expose.method('readAdmission', () => run.context.read(DRAWER_CONTEXT).contentAdmitted);
      def.expose.method('readOverlayOpen', () => overlay.isOpen());
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.lifecycle.onMounted(() => {
        mounts++;
      });
      def.lifecycle.onUnmounted(() => {
        detaches++;
      });
      def.lifecycle.onBeforeDispose(() => {
        beforeDispose++;
      });
    },
  });
  const Content = AdaptToWebComponent(contentProto, options);
  const content = new Content() as any;
  content.addEventListener('afterLeave', () => onAfterLeave?.());
  if (withContent) root.append(content);
  owned.push(root, content);
  return {
    root,
    content,
    requests,
    setAfterLeave: (action: () => void) => {
      onAfterLeave = action;
    },
    detaches: () => detaches,
    mounts: () => mounts,
    disposed: () => beforeDispose,
  };
}
const expose = (element: any) => element.getExposes();

describe('Drawer semantic request lifetime through synchronous reduced close', () => {
  it('delivers exactly one accepted Escape through synchronous reduced close and closes its owning Root', async () => {
    const f = fixture();
    document.body.append(f.root);
    await flush();
    expect(expose(f.content).isPresent.get()).toBe(true);
    const before = f.detaches();
    expose(f.content).testEscape();
    expect(expose(f.content).transitionState.get()).toBe('closed');
    await flush();
    await expect.poll(() => f.detaches()).toBe(before + 1);
    expect(f.requests).toEqual([{ open: false, reason: 'escape', focusReason: 'keyboard' }]);
    expect(expose(f.root).open.get()).toBe(false);
    expect(expose(f.content).isPresent.get()).toBe(false);
  });

  it('revokes the pending semantic request before terminal disposal completes', async () => {
    const f = fixture();
    document.body.append(f.root);
    await flush();
    f.setAfterLeave(() => {
      f.setAfterLeave(() => {});
      // Actual Runtime owner disposal; DOM removal alone is deferred by WC.
      void f.content.retireOwner();
      expect(f.disposed()).toBe(1);
    });
    expose(f.content).testEscape();
    expect(f.disposed()).toBe(1);
    expect(f.requests).toEqual([]);
    expect(expose(f.root).open.get()).toBe(true);
  });

  it('rejects the old request after actual logical Context rebinding during synchronous close', async () => {
    const old = fixture();
    const next = fixture(false, false);
    document.body.append(old.root, next.root);
    await flush();
    const token = old.content._instanceToken;
    const oldOwner = expose(old.content).readOwner();
    let reboundOwner: string | undefined;
    old.setAfterLeave(() => {
      old.setAfterLeave(() => {});
      // Explicit Adapter owner rebind, not a physical portal/DOM move.
      bindLogicalParent(token, next.root._instanceToken, { authority: 'owner' });
      old.content._controller.update();
      reboundOwner = expose(old.content).readOwner();
      expect(getLogicalParent(token)).toBe(next.root._instanceToken);
      expect(reboundOwner).not.toBe(oldOwner);
    });
    expose(old.content).testEscape();
    expect(reboundOwner).toBeDefined();
    expect(old.requests).toEqual([]);
    expect(next.requests).toEqual([]);
    expect(expose(old.root).open.get()).toBe(true);
    expect(expose(next.root).open.get()).toBe(true);
  });

  it('does not restore controlled presence after request delivery disposes the Content owner', async () => {
    const f = fixture(true);
    document.body.append(f.root);
    await flush();
    let terminal = false;
    f.root.addEventListener('openChange', () => {
      void f.content.retireOwner();
      terminal = f.disposed() === 1;
    });
    const mountedBefore = f.mounts();
    const retained = expose(f.content);
    retained.testEscape();
    expect(terminal).toBe(true);
    expect(f.requests).toEqual([{ open: false, reason: 'escape', focusReason: 'keyboard' }]);
    expect(expose(f.root).open.get()).toBe(true);
    expect(() => retained.isPresent.get()).toThrow('after terminal disposal');
    await flush();
    expect(f.disposed()).toBe(1);
    expect(f.requests).toHaveLength(1);
    expect(f.mounts()).toBe(mountedBefore);
  });

  it('does not restore controlled Overlay after its Root admission lease is withdrawn during request delivery', async () => {
    // Observe the real Content ID allocation without replacing its value or
    // bypassing Root admission. Re-admitting the same ID returns its live lease.
    const allocate = vi.spyOn(drawerShared, 'createDrawerContentInstanceId');
    const f = fixture(true);
    let instanceId: string;
    try {
      document.body.append(f.root);
      await flush();
      expect(allocate).toHaveBeenCalledTimes(1);
      instanceId = allocate.mock.results[0].value as string;
    } finally {
      allocate.mockRestore();
    }
    const root = expose(f.root);
    const content = expose(f.content);
    const generation = root.__admitContent(instanceId);
    expect(generation).toBeGreaterThan(0);
    expect(content.readAdmission()).toBe(true);
    let withdrew = false;
    f.root.addEventListener('openChange', () => {
      root.__releaseContent(instanceId, generation);
      withdrew = !content.readAdmission();
      expect(content.readOverlayOpen()).toBe(false);
    });
    content.testEscape();
    expect(withdrew).toBe(true);
    expect(f.requests).toEqual([{ open: false, reason: 'escape', focusReason: 'keyboard' }]);
    expect(root.open.get()).toBe(true);
    expect(content.readAdmission()).toBe(false);
    expect(content.open.get()).toBe(false);
    // The owner stays logically open, but an unadmitted Content must not be
    // resurrected by the controlled-refusal branch after the callback returns.
    expect(content.readOverlayOpen()).toBe(false);
    expect(content.isPresent.get()).toBe(false);
    await flush();
    expect(content.readAdmission()).toBe(false);
    expect(content.isPresent.get()).toBe(false);
  });

  it('accepts an inner uncontrolled Escape without closing the outer Root', async () => {
    const outer = fixture();
    document.body.append(outer.root);
    await flush();
    const inner = fixture();
    outer.content.append(inner.root);
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(inner.requests).toEqual([{ open: false, reason: 'escape', focusReason: 'keyboard' }]);
    expect(outer.requests).toEqual([]);
    expect(expose(inner.root).open.get()).toBe(false);
    expect(expose(outer.root).open.get()).toBe(true);
    expect(expose(inner.content).isPresent.get()).toBe(false);
    expect(expose(outer.content).isPresent.get()).toBe(true);
  });

  it('restores controlled refusal and emits one request per Escape for the inner Root only', async () => {
    const outer = fixture(true);
    document.body.append(outer.root);
    await flush();
    const inner = fixture(true);
    outer.content.append(inner.root);
    await flush();
    for (let i = 1; i <= 2; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      expect(inner.requests).toEqual(
        Array.from({ length: i }, () => ({
          open: false,
          reason: 'escape',
          focusReason: 'keyboard',
        }))
      );
      expect(outer.requests).toEqual([]);
      expect(expose(inner.root).open.get()).toBe(true);
      expect(expose(outer.root).open.get()).toBe(true);
      expect(expose(inner.content).isPresent.get()).toBe(true);
    }
  });
});
