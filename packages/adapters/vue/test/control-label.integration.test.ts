import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { checkboxRoot } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import { radioGroupRoot, radioGroupItem } from '../../../prototypes/base/src/radio-group';
import labelRoot from '../../../prototypes/base/src/label';
import { createMountedVueAdapter, flushVue, VueAny } from './utils/vue';
import { createVueAdapter } from '../src/adapt';
function pointerClick(el: HTMLElement) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
  );
  el.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 10,
    })
  );
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
describe('vue explicit instance-associated Label', () => {
  it.each([checkboxRoot, switchRoot])(
    'names and activates $name across independent sibling roots',
    async (proto) => {
      const instanceAssociations = { controlLabel: createControlLabelRef() };
      const changes: unknown[] = [];
      const target = createMountedVueAdapter(proto, {
        instanceAssociations,
        onCheckedChange: (e: unknown) => changes.push(e),
      });
      const label = createMountedVueAdapter(labelRoot, {
        instanceAssociations,
      });
      try {
        await flushVue();
        const targetEl = target.root as HTMLElement;
        const labelEl = label.root as HTMLElement;
        labelEl.textContent = 'Visible control label';
        expect(labelEl.id).not.toBe('');
        expect(targetEl.getAttribute('aria-labelledby')).toBe(labelEl.id);
        expect(labelEl.hasAttribute('tabindex')).toBe(false);
        expect(targetEl.hasAttribute('instanceAssociations')).toBe(false);
        const exposes = target.vm.getExposes();
        pointerClick(labelEl);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(exposes.checked.get()).toBe(true);
        expect(changes).toHaveLength(1);
      } finally {
        label.unmount();
        target.unmount();
        await flushVue();
      }
    }
  );
  it('disabled target remains named without a value proposal', async () => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const changes: unknown[] = [];
    const target = createMountedVueAdapter(checkboxRoot, {
      instanceAssociations,
      disabled: true,
      onCheckedChange: (e: unknown) => changes.push(e),
    });
    const label = createMountedVueAdapter(labelRoot, {
      instanceAssociations,
      naming: true,
      activation: true,
    });
    try {
      await flushVue();
      pointerClick(label.root as HTMLElement);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(changes).toEqual([]);
      expect((target.root as HTMLElement).getAttribute('aria-labelledby')).toBe(
        (label.root as HTMLElement).id
      );
    } finally {
      label.unmount();
      target.unmount();
      await flushVue();
    }
  });
});

it.each(['open', 'closed'] as const)(
  'renews naming after retained views move into a previously unknown %s ShadowRoot',
  async (mode) => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const target = createMountedVueAdapter(checkboxRoot, { instanceAssociations });
    const label = createMountedVueAdapter(labelRoot, {
      instanceAssociations,
      naming: true,
      activation: true,
    });
    const outer = document.createElement('div');
    document.body.append(outer);
    const destination = outer.attachShadow({ mode });
    const targetNode = target.root as HTMLElement;
    const labelNode = label.root as HTMLElement;
    const mutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      await flushVue();
      expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
      labelNode.remove();
      await mutations();
      expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
      destination.append(labelNode);
      await frame();
      await mutations();
      expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
      targetNode.remove();
      await mutations();
      destination.append(targetNode);
      await frame();
      await mutations();
      expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
      expect(labelNode.id).not.toBe('');
      pointerClick(labelNode);
      expect(target.vm.getExposes().checked.get()).toBe(true);
    } finally {
      label.unmount();
      target.unmount();
      outer.remove();
      await flushVue();
    }
  }
);

it('default Radio Label forwards one valueChange/select callback and preserves controlled ownership', async () => {
  const changes: unknown[] = [];
  const selections: unknown[] = [];
  const instanceAssociations = { controlLabel: createControlLabelRef() };
  const host = document.createElement('div');
  document.body.append(host);
  const state = VueAny.reactive({ controlledValue: null as string | null, passive: false });
  const adapt = createVueAdapter(VueAny);
  const Root = adapt(radioGroupRoot);
  const Item = adapt(radioGroupItem);
  const Label = adapt(labelRoot);
  const refs: Record<string, any> = {};
  const app = VueAny.createApp({
    setup() {
      return () =>
        VueAny.h('div', {}, [
          VueAny.h(
            Root,
            {
              defaultValue: 'a',
              ...(state.controlledValue === null ? {} : { value: state.controlledValue }),
              onValueChange: (event: unknown) => changes.push(event),
              ref: (vm: any) => {
                refs.group = vm;
              },
            },
            () => [
              VueAny.h(Item, {
                value: 'a',
                ref: (vm: any) => {
                  refs.first = vm;
                },
              }),
              VueAny.h(Item, {
                value: 'b',
                instanceAssociations,
                onSelect: (event: unknown) => selections.push(event),
                ref: (vm: any) => {
                  refs.target = vm;
                },
              }),
            ]
          ),
          VueAny.h(
            Label,
            {
              instanceAssociations,
              ...(state.passive ? { activation: false } : {}),
              ref: (vm: any) => {
                refs.label = vm;
              },
            },
            () => 'Option B'
          ),
        ]);
    },
  });
  app.mount(host);
  const settle = async () => {
    await flushVue();
    await flushVue();
  };
  const dispose = () => app.unmount();
  try {
    await settle();
    expect(refs.target.$el.getAttribute('aria-labelledby')).toBe(refs.label.$el.id);
    pointerClick(refs.label.$el);
    await settle();
    expect(refs.group.getExposes().value.get()).toBe('b');
    expect(document.activeElement).toBe(refs.target.$el);
    expect(changes).toEqual([{ value: 'b' }]);
    expect(selections).toEqual([{ value: 'b' }]);
    pointerClick(refs.label.$el);
    await settle();
    expect(changes).toHaveLength(1);
    expect(selections).toHaveLength(1);
    state.controlledValue = 'a';
    state.passive = true;
    await settle();
    refs.first.$el.focus();
    pointerClick(refs.label.$el);
    await settle();
    expect(refs.group.getExposes().value.get()).toBe('a');
    expect(document.activeElement).toBe(refs.first.$el);
    expect(changes).toHaveLength(1);
    expect(selections).toHaveLength(1);
    state.passive = false;
    await settle();
    pointerClick(refs.label.$el);
    await settle();
    expect(refs.group.getExposes().value.get()).toBe('a');
    expect(document.activeElement).toBe(refs.target.$el);
    expect(changes).toEqual([{ value: 'b' }, { value: 'b' }]);
    expect(selections).toEqual([{ value: 'b' }, { value: 'b' }]);
    state.controlledValue = 'b';
    await settle();
    expect(refs.group.getExposes().value.get()).toBe('b');
  } finally {
    dispose();
    host.remove();
    await settle();
  }
});
