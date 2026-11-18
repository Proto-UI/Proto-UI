import { expect, it, vi } from 'vitest';
import { createAnatomyFamily, definePrototype, type ContextMenuInputIntent } from '@proto.ui/core';
import { asContextMenuInput, asTrigger } from '@proto.ui/hooks';
import type { ScrollMount, ScrollTree } from './scroll-catalog-conformance';
import { resolveWebInputOriginAnchor } from '../../../../modules/positioning/src/web/input-origin-anchor';

/** Real source-runtime adapter/callback/scheduler wiring; synthetic DOM input is not native GUI evidence. */
export function contextMenuInputConformance(
  name: string,
  mount: (tree: ScrollTree[]) => Promise<ScrollMount>
) {
  it.each([false, true])(
    `${name}: binds native context-menu routing for declared root demand (%s)`,
    async (semantic) => {
      const calls: string[] = [];
      const rootListeners = vi.spyOn(HTMLElement.prototype, 'addEventListener');
      const globalListeners = vi.spyOn(window, 'addEventListener');
      const proto = definePrototype({
        name: `context-demand-${name}-${semantic}`,
        setup(def) {
          def.event.on('host:contextmenu', () => calls.push('host'));
          if (semantic) def.event.on('context.menu', () => calls.push('proto'));
        },
      });
      try {
        const mounted = await mount([{ proto }]);
        try {
          await mounted.flush();
          const root = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
          expect(root).toBeTruthy();
          const countRoot = rootListeners.mock.calls.filter(
            ([type], index) => type === 'contextmenu' && rootListeners.mock.contexts[index] === root
          ).length;
          const countGlobal = globalListeners.mock.calls.filter(
            ([type]) => type === 'contextmenu'
          ).length;
          expect(countRoot).toBe(semantic ? 2 : 1);
          expect(countGlobal).toBe(semantic ? 1 : 0);
          await mounted.dispatch(root, new MouseEvent('contextmenu', { bubbles: true }));
          await mounted.flush();
          expect(calls).toEqual(semantic ? ['proto', 'host'] : ['host']);
        } finally {
          await mounted.unmount();
        }
      } finally {
        globalListeners.mockRestore();
        rootListeners.mockRestore();
      }
    }
  );
  it(`${name}: retains redirected context-menu demand on the active Trigger surface`, async () => {
    let calls = 0;
    const owner = definePrototype({
      name: `context-demand-owner-${name}`,
      setup(def) {
        asTrigger();
        def.event.on('context.menu', () => calls++);
        return (r) => r.slot();
      },
    });
    const surface = definePrototype({
      name: `context-demand-surface-${name}`,
      setup() {
        asTrigger();
      },
    });
    const mounted = await mount([{ proto: owner, children: [{ proto: surface }] }]);
    try {
      await mounted.flush();
      const roots = mounted.host.querySelectorAll<HTMLElement>('[data-pui-root]');
      expect(roots).toHaveLength(2);
      await mounted.dispatch(roots[1]!, new MouseEvent('contextmenu', { bubbles: true }));
      await mounted.flush();
      expect(calls).toBe(1);
    } finally {
      await mounted.unmount();
    }
  });
  it(`${name}: context input keeps pointer point host-local, keyboard element-based, and cancels long-press`, async () => {
    const family = createAnatomyFamily(`context-input-${name}`, {
      roles: { root: { cardinality: { min: 0, max: 1 } } },
    });
    const intents: ContextMenuInputIntent[] = [];
    const proto = definePrototype({
      name: `context-input-${name}`,
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        const input = asContextMenuInput();
        input.configure({ anatomy: family, inputRole: 'root' });
        const origin = def.state.string('input-origin', '');
        input.on((_run, intent) => {
          origin.set(intent.origin);
          intents.push(intent);
          return true;
        });
        def.lifecycle.onMounted(() => input.sync({ disabled: false }));
        def.event.on('host:disable-context-input', () => input.sync({ disabled: true }));
      },
    });
    const m = await mount([{ proto }]);
    let unmounted = false;
    try {
      await m.flush();
      const input = m.host.querySelector<HTMLElement>('[data-pui-root]')!;
      expect(input).toBeTruthy();
      const context = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 200,
        clientY: 150,
      });
      await m.dispatch(input, context);
      expect(context.defaultPrevented).toBe(true);
      expect(intents[0].origin).toBe('pointer');
      expect(
        resolveWebInputOriginAnchor(intents[0].anchor)?.reference.getBoundingClientRect()
      ).toMatchObject({ left: 200, top: 150, width: 0, height: 0 });
      const keyboard = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ContextMenu',
      });
      await m.dispatch(input, keyboard);
      expect(keyboard.defaultPrevented).toBe(true);
      expect(intents[1].origin).toBe('keyboard');
      expect(resolveWebInputOriginAnchor(intents[1].anchor)?.reference).toBe(input);
      expect(resolveWebInputOriginAnchor(intents[0].anchor)).toBeNull();
      const down = () =>
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerType: 'touch',
          pointerId: 7,
          isPrimary: true,
          button: 0,
          clientX: 30,
          clientY: 40,
        });
      await m.dispatch(input, down());
      await new Promise((resolve) => setTimeout(resolve, 640));
      await m.flush();
      expect(intents.at(-1)?.origin).toBe('long-press');
      expect(intents).toHaveLength(3);
      await m.dispatch(input, new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      await m.dispatch(input, click);
      expect(click.defaultPrevented).toBe(true);
      await m.dispatch(input, down());
      await m.dispatch(input, new Event('disable-context-input', { bubbles: true }));
      expect(resolveWebInputOriginAnchor(intents[2].anchor)).toBeNull();
      await m.unmount();
      unmounted = true;
      await new Promise((resolve) => setTimeout(resolve, 640));
      expect(intents).toHaveLength(3);
    } finally {
      if (!unmounted) await m.unmount();
    }
  });
}
