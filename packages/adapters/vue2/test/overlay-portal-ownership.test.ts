import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import {
  dialogContent,
  dialogMask,
  dialogRoot,
  dialogTrigger,
} from '../../../prototypes/base/src/dialog';

import { createVue2Adapter } from '../src/adapt';
import { createVue2OverlayGlobalMount } from '../src/runtime/modules';
import {
  bindLogicalParent,
  createLogicalInstance,
  getProtoParent,
  markProtoInstance,
} from '../src/platform/instance-tree';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

/** The comment `createVue2OverlayGlobalMount` leaves where the host stood. */
const PORTAL_ANCHOR = 'pui-vue2-portal';

function portalAnchors(root: Node): Comment[] {
  const found: Comment[] = [];
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE && child.textContent === PORTAL_ANCHOR) {
        found.push(child as Comment);
      }
      walk(child);
    }
  };
  walk(root);
  return found;
}

describe('adapter-vue2: overlay portal ownership', () => {
  it('moves the Vue2 overlay host to body while retaining its logical parent projection', () => {
    const parentProto = definePrototype({
      name: 'vue2-overlay-owner-parent',
      setup: () => (r) => r.el('div'),
    });
    const childProto = definePrototype({
      name: 'vue2-overlay-owner-child',
      setup: () => (r) => r.el('div'),
    });
    const parentToken = createLogicalInstance(parentProto as any);
    const childToken = createLogicalInstance(childProto as any);
    bindLogicalParent(childToken, parentToken);

    const parentRoot = document.createElement('div');
    const vueContainer = document.createElement('div');
    const before = document.createElement('span');
    const childRoot = document.createElement('div');
    const after = document.createElement('span');
    vueContainer.append(before, childRoot, after);
    document.body.append(parentRoot, vueContainer);
    markProtoInstance(parentRoot, parentProto as any, parentToken);
    markProtoInstance(childRoot, childProto as any, childToken);

    const globalMount = createVue2OverlayGlobalMount(childToken);

    try {
      globalMount.mount(childRoot);

      expect(childRoot.parentNode).toBe(document.body);
      expect(getProtoParent(childRoot)).toBe(parentRoot);
      expect(portalAnchors(vueContainer)).toHaveLength(1);

      globalMount.unmount(childRoot);

      // Returned to the position Vue owns, so ordinary teardown removes it —
      // and returned between the same siblings, not appended at the end.
      expect(childRoot.parentNode).toBe(vueContainer);
      expect(Array.from(vueContainer.childNodes)).toEqual([before, childRoot, after]);
      expect(portalAnchors(vueContainer)).toHaveLength(0);
      expect(Array.from(document.body.childNodes)).not.toContain(childRoot);

      // Unmounting again owns nothing and must not move or remove anything.
      globalMount.unmount(childRoot);
      expect(Array.from(vueContainer.childNodes)).toEqual([before, childRoot, after]);
    } finally {
      childRoot.remove();
      parentRoot.remove();
      vueContainer.remove();
    }
  });

  it('detaches the portalled host when its anchor has no parent left', () => {
    const childProto = definePrototype({
      name: 'vue2-overlay-orphan-child',
      setup: () => (r) => r.el('div'),
    });
    const childToken = createLogicalInstance(childProto as any);

    const vueContainer = document.createElement('div');
    const childRoot = document.createElement('div');
    vueContainer.appendChild(childRoot);
    document.body.appendChild(vueContainer);
    markProtoInstance(childRoot, childProto as any, childToken);

    const globalMount = createVue2OverlayGlobalMount(childToken);

    try {
      globalMount.mount(childRoot);
      expect(childRoot.parentNode).toBe(document.body);

      // The position the host came from is gone, so there is nowhere to put it
      // back; leaving it in the body would be the leak this guards.
      vueContainer.remove();
      globalMount.unmount(childRoot);

      expect(childRoot.isConnected).toBe(false);
      expect(portalAnchors(document.body)).toHaveLength(0);
    } finally {
      childRoot.remove();
      vueContainer.remove();
    }
  });

  it('leaves no portalled node behind when the Vue2 app is destroyed', async () => {
    const adapt = createVue2Adapter(Vue2RuntimeAny);
    const Root = adapt(dialogRoot);
    const Trigger = adapt(dialogTrigger);
    const Mask = adapt(dialogMask);
    const Content = adapt(dialogContent, { rootTag: 'section' });
    const host = document.createElement('div');
    document.body.appendChild(host);

    const App = Vue2Any.extend({
      render(h: any) {
        return h(Root, { attrs: { defaultOpen: false }, ref: 'root' }, [
          h(Trigger, { ref: 'trigger' }, ['Open dialog']),
          h(Mask, { ref: 'mask' }),
          h(Content, { ref: 'content' }, [h('p', ['Dialog body'])]),
        ]);
      },
    });
    const vm = new App().$mount();
    host.appendChild(vm.$el);

    try {
      await flushVue2();
      await flushVue2();
      const refs = vm.$refs as Record<string, any>;
      refs.trigger?.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushVue2();
      await flushVue2();

      // The overlay is portalled out of the app's own subtree.
      // `:scope >` is not supported by the test DOM, so the children are
      // filtered rather than selected.
      const portalled = Array.from(document.body.children).filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.hasAttribute('data-pui-root')
      );
      expect(portalled.length).toBeGreaterThan(0);
      expect(portalled.every((element) => !host.contains(element))).toBe(true);

      vm.$destroy();
      host.remove();
      await flushVue2();

      // Destroying the app has to reclaim what the adapter portalled out of it.
      // A close-only assertion would not prove this: nothing here closes the
      // dialog first, and where a merely closed overlay parks is a separate
      // question this does not decide.
      for (const element of portalled) {
        expect(element.isConnected, element.tagName.toLowerCase()).toBe(false);
      }
      expect(portalAnchors(document.body)).toHaveLength(0);
    } finally {
      vm.$destroy();
      host.remove();
    }
  });
});
