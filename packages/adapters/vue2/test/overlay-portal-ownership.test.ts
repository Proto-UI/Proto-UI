import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createVue2OverlayGlobalMount } from '../src/runtime/modules';
import {
  bindLogicalParent,
  createLogicalInstance,
  getProtoParent,
  markProtoInstance,
} from '../src/platform/instance-tree';

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
    const childRoot = document.createElement('div');
    vueContainer.appendChild(childRoot);
    document.body.append(parentRoot, vueContainer);
    markProtoInstance(parentRoot, parentProto as any, parentToken);
    markProtoInstance(childRoot, childProto as any, childToken);

    const globalMount = createVue2OverlayGlobalMount(childToken);

    try {
      globalMount.mount(childRoot);

      expect(childRoot.parentNode).toBe(document.body);
      expect(getProtoParent(childRoot)).toBe(parentRoot);
      expect(vueContainer.childNodes).toHaveLength(1);

      globalMount.unmount(childRoot);

      expect(vueContainer.childNodes).toHaveLength(0);
    } finally {
      childRoot.remove();
      parentRoot.remove();
      vueContainer.remove();
    }
  });
});
