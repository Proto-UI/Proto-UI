import { expect, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import { createAnatomyFamily, definePrototype } from '@proto.ui/core';

it('retains an owner-scoped Anatomy method after owner disposal without invoking a live-state write', async () => {
  const family = createAnatomyFamily('drawer-admission-capability', {
    roles: {
      root: { cardinality: { min: 1, max: 1 } },
      content: { cardinality: { min: 0, max: 1 } },
    },
    relations: [{ kind: 'contains', parent: 'root', child: 'content' }],
  });
  let release: (() => void) | undefined;
  let dead = false;
  let liveCalls = 0;
  const root = definePrototype({
    name: 'test-drawer-admission-root',
    setup(def) {
      def.anatomy.claim(family, { role: 'root' });
      def.expose.method('release', () => {
        if (!dead) liveCalls++;
      });
      def.lifecycle.onBeforeDispose(() => {
        dead = true;
      });
    },
  });
  const content = definePrototype({
    name: 'test-drawer-admission-content',
    setup(def) {
      def.anatomy.claim(family, { role: 'content' });
      def.lifecycle.onCreated((run) => {
        release = run.anatomy.partsOf(family, 'root')[0].getExpose('release') as () => void;
      });
    },
  });
  AdaptToWebComponent(root);
  AdaptToWebComponent(content);
  const element = document.createElement(root.name);
  element.append(document.createElement(content.name));
  document.body.append(element);
  await new Promise((resolve) => setTimeout(resolve, 20));
  release!();
  expect(liveCalls).toBe(1);
  element.remove();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(dead).toBe(true);
  expect(() => release!()).not.toThrow();
  expect(liveCalls).toBe(1);
});
