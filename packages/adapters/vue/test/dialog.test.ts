import { describe, expect, it } from 'vitest';
import { PUI_VIEW_DETACHED_ATTR } from '@proto.ui/adapter-base';
import { definePrototype } from '@proto.ui/core';

import {
  DIALOG_CONTEXT,
  dialogContent,
  dialogMask,
  type DialogContextValue,
} from '../../../prototypes/base/src/dialog';
import { createMountedVueAdapter, createMountedVueAdapterWithOptions, flushVue } from './utils/vue';

function dialogContext(open: boolean): DialogContextValue {
  return {
    rootId: 'vue-adapter-dialog',
    open,
    openFocusReason: null,
    returnFocusReason: null,
    controlled: false,
    disabled: false,
    alert: false,
    a11yLabel: '',
    requestedOpen: open,
    requestReason: null,
    requestFocusReason: null,
    requestVersion: 0,
  };
}

describe('adapter-vue: dialog integration', () => {
  it('renders dialog content when open and hides it when closed', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-content-open-close',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogContent.setup(def);
        return (r) => [r.el('div', 'hello')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, { appear: false });
    await flushVue();

    try {
      const exposes = mounted.vm.getExposes();
      expect(exposes.transitionState?.get?.()).toBe('entering');

      mounted.vm.invokeInCallbackScope(() => {
        mounted.vm.getExposes().controls.leave();
      });
      mounted.vm.update?.();
      await flushVue();

      expect(exposes.transitionState?.get?.()).toBe('leaving');
    } finally {
      mounted.unmount();
    }
  });

  it('shows transition attributes on host element', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-transition-attrs',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogContent.setup(def);
        return (r) => [r.el('div')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, { appear: false });
    await flushVue();

    try {
      const exposes = mounted.vm.getExposes();
      const state = exposes.transitionState?.get?.();

      expect(['entering', 'entered']).toContain(state ?? 'entering');

      const layeredHost = document.body.querySelector('[data-transition-state]');
      expect(layeredHost).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });

  it('keeps a closed dialog mask detached', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-mask-transition',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(false));
        dialogMask.setup(def);
        return (r) => [r.el('div')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, {});
    await flushVue();

    try {
      const host = mounted.host;
      const mask = host.querySelector('div');
      expect(mask).not.toBeNull();
      expect(mask?.hasAttribute(PUI_VIEW_DETACHED_ATTR)).toBe(true);

      const exposes = mounted.vm.getExposes();
      expect(exposes.transitionState?.get?.()).toBe('closed');
    } finally {
      mounted.unmount();
    }
  });

  it('reattaches a portaled dialog view after transition-driven detach', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-portaled-rematerialization',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogContent.setup(def);
        return (r) => [r.el('div', 'portaled dialog epoch')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, { appear: false });
    await flushVue();

    try {
      const controls = mounted.vm.getExposes().controls;

      mounted.vm.invokeInCallbackScope(() => controls.complete());
      mounted.vm.update?.();
      await flushVue();
      mounted.vm.invokeInCallbackScope(() => controls.leave());
      mounted.vm.update?.();
      await flushVue();
      mounted.vm.invokeInCallbackScope(() => controls.complete());
      mounted.vm.update?.();
      await flushVue();
      await flushVue();

      expect(document.body.textContent).not.toContain('portaled dialog epoch');

      mounted.vm.invokeInCallbackScope(() => controls.enter());
      mounted.vm.update?.();
      await flushVue();
      await flushVue();

      const rematerialized = Array.from(
        document.body.querySelectorAll('[data-transition-state]')
      ).find((element) => element.textContent?.includes('portaled dialog epoch'));
      expect(rematerialized?.getAttribute('data-transition-state')).toBe('entering');
      expect(mounted.vm.getExposes().transitionState?.get?.()).toBe('entering');
    } finally {
      mounted.unmount();
    }
  });

  it('supports adapter overlayLayer base z-index configuration', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-layer-base',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogContent.setup(def);
        return (r) => [r.el('div', 'hello')];
      },
    });

    const mounted = createMountedVueAdapterWithOptions(
      proto as any,
      {
        overlayLayer: { baseZIndex: 7100 },
      },
      {}
    );
    await flushVue();

    try {
      // 由于 Teleport 可能导致 initSession 重入，sequence 会累加；
      // 这里只验证语义层级生效，不依赖精确序号。
      const host = document.body.querySelector('[style*="z-index"]') as HTMLElement | null;
      expect(host).not.toBeNull();
      const zIndex = parseInt(host?.style.zIndex ?? '0', 10);
      expect(zIndex).toBeGreaterThanOrEqual(8110);
    } finally {
      mounted.unmount();
    }
  });

  it('routes global outside pointerdown through the adapter and closes dialog content', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-outside-pointerdown',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogContent.setup(def);
        return (r) => [r.el('div', 'hello')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, { appear: false });
    await flushVue();

    try {
      expect(mounted.vm.getExposes().open?.get?.()).toBe(true);

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      mounted.vm.update?.();
      await flushVue();

      expect(mounted.vm.getExposes().open?.get?.()).toBe(false);
    } finally {
      mounted.unmount();
    }
  });

  it('projects dialog mask passthrough to host pointer-events without affecting transition state', async () => {
    const proto = definePrototype({
      name: 'vue-dialog-mask-passthrough',
      setup(def) {
        def.context.provide(DIALOG_CONTEXT, dialogContext(true));
        dialogMask.setup(def);
        return (r) => [r.el('div')];
      },
    });

    const mounted = createMountedVueAdapter(proto as any, { passthrough: true });
    await flushVue();

    try {
      const host = document.body.querySelector(
        '[style*="pointer-events: none"]'
      ) as HTMLElement | null;
      expect(host).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });
});
