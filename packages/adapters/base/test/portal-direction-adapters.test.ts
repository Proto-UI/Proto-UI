import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { createReactOverlayGlobalMount } from '../../react/src/runtime/modules';
import * as reactTree from '../../react/src/platform/instance-tree';
import { createVueOverlayGlobalMount } from '../../vue/src/runtime/modules';
import * as vueTree from '../../vue/src/platform/instance-tree';
import { createVue2OverlayGlobalMount } from '../../vue2/src/runtime/modules';
import * as vue2Tree from '../../vue2/src/platform/instance-tree';
import { AdaptToWebComponent } from '../../web-component/src';

// happy-dom omits the browser's HTML dir presentation rule. Supply that
// isolated UA-equivalent fixture; native direction evidence remains in the
// actual browser journey, not in these simulated-DOM ownership controls.
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '[dir="rtl"] { direction: rtl; } [dir="ltr"] { direction: ltr; }';
  document.head.append(style);
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('dir');
});

for (const [runtime, createMount, tree] of [
  ['react', createReactOverlayGlobalMount, reactTree],
  ['vue', createVueOverlayGlobalMount, vueTree],
  ['vue2', createVue2OverlayGlobalMount, vue2Tree],
] as const) {
  describe(`${runtime} Portal direction ownership`, () => {
    it('projects from author source through reparent, replacement, explicit override and detach', async () => {
      const proto = definePrototype({
        name: `${runtime}-portal-direction-probe`,
        setup: () => (r) => r.slot(),
      });
      const ownerToken = tree.createLogicalInstance(proto);
      const token = tree.createLogicalInstance(proto);
      tree.bindLogicalParent(token, ownerToken);
      const owner = document.createElement('div');
      owner.dir = 'rtl';
      const local = document.createElement('section');
      local.dir = 'ltr';
      owner.append(local);
      const origin = document.createElement('span');
      local.append(origin);
      const target = document.createElement('div');
      local.append(target);
      const replacement = document.createElement('div');
      replacement.dir = 'rtl';
      document.body.dir = 'rtl';
      document.body.append(owner, replacement);
      tree.markProtoInstance(owner, proto, ownerToken);
      tree.markProtoInstance(target, proto, token);
      // React/Vue fixtures exercise the actual portal cap without moving their
      // renderer-owned target. Vue2 additionally performs the real DOM move.
      const mount = createMount(token, () => origin);
      mount.mount(target);
      mount.mount(target);
      expect(target.dir).toBe('ltr');
      if (runtime === 'vue2') expect(target.parentNode).toBe(document.body);
      else expect(target.parentNode).toBe(local);
      local.dir = 'rtl';
      await settle();
      expect(target.dir).toBe('rtl');
      replacement.append(origin);
      replacement.dir = 'ltr';
      await settle();
      expect(target.dir).toBe('ltr');
      target.dir = 'auto';
      await settle();
      replacement.dir = 'rtl';
      await settle();
      expect(target.dir).toBe('auto');
      target.removeAttribute('dir');
      await settle();
      expect(target.dir).toBe('rtl');
      mount.unmount(target);
      expect(target.hasAttribute('dir')).toBe(false);
      replacement.dir = 'ltr';
      await settle();
      expect(target.hasAttribute('dir')).toBe(false);
      const nextMount = createMount(token, () => origin);
      nextMount.mount(target);
      expect(target.dir).toBe('ltr');
      nextMount.unmount(target);
      expect(target.hasAttribute('dir')).toBe(false);
    });
  });
}

it('Web Component portal tracks its original physical wrapper and releases on close/remove/reparent', async () => {
  const proto = definePrototype({
    name: 'wc-portal-direction-probe',
    setup(def) {
      const overlay = asOverlay();
      overlay.configure({ portal: true, entry: 'manual', restore: 'none' });
      def.expose('actions', { open: () => overlay.openOverlay(), close: () => overlay.close() });
      return () => 'Direction content';
    },
  });
  const Content = AdaptToWebComponent(proto);
  const first = document.createElement('div');
  first.dir = 'rtl';
  const local = document.createElement('div');
  local.dir = 'ltr';
  first.append(local);
  const second = document.createElement('div');
  second.dir = 'rtl';
  const content: any = new Content();
  local.append(content);
  document.body.append(first, second);
  await settle();
  content.getExposes().actions.open();
  await settle();
  expect(Array.from(document.body.children)).toContain(content);
  expect(content.dir).toBe('ltr');
  local.dir = 'rtl';
  await settle();
  expect(content.dir).toBe('rtl');
  content.getExposes().actions.close();
  // WC's compositor conceal barrier retires its portal lease after two frames.
  await settle();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  await settle();
  expect(content.getAttribute('dir')).toBe(null);
  second.append(content);
  await settle();
  content.getExposes().actions.open();
  await settle();
  expect(content.dir).toBe('rtl');
  content.remove();
  await settle();
  expect(content.isConnected).toBe(false);
  expect(content.getAttribute('dir')).toBe(null);
  second.dir = 'ltr';
  await settle();
  expect(content.getAttribute('dir')).toBe(null);
});
