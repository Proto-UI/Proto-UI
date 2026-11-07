import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { checkboxRoot } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import { radioGroupRoot, radioGroupItem } from '../../../prototypes/base/src/radio-group';
import labelRoot from '../../../prototypes/base/src/label';
import { createMountedVue2Adapter, flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';
import { createVue2Adapter } from '../src/adapt';
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
describe('vue2 explicit instance-associated Label', () => {
  it.each([checkboxRoot, switchRoot])(
    'names and activates $name across independent sibling roots',
    async (proto) => {
      const instanceAssociations = { controlLabel: createControlLabelRef() };
      const changes: unknown[] = [];
      const target = createMountedVue2Adapter(proto, {
        instanceAssociations,
        onCheckedChange: (e: unknown) => changes.push(e),
      });
      const label = createMountedVue2Adapter(labelRoot, {
        instanceAssociations,
      });
      try {
        await flushVue2();
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
        await flushVue2();
      }
    }
  );
  it('disabled target remains named without a value proposal', async () => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const changes: unknown[] = [];
    const target = createMountedVue2Adapter(checkboxRoot, {
      instanceAssociations,
      disabled: true,
      onCheckedChange: (e: unknown) => changes.push(e),
    });
    const label = createMountedVue2Adapter(labelRoot, {
      instanceAssociations,
      naming: true,
      activation: true,
    });
    try {
      await flushVue2();
      pointerClick(label.root as HTMLElement);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(changes).toEqual([]);
      expect((target.root as HTMLElement).getAttribute('aria-labelledby')).toBe(
        (label.root as HTMLElement).id
      );
    } finally {
      label.unmount();
      target.unmount();
      await flushVue2();
    }
  });
});

it.each(['open', 'closed'] as const)(
  'renews naming after retained views move into a previously unknown %s ShadowRoot',
  async (mode) => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const target = createMountedVue2Adapter(checkboxRoot, { instanceAssociations });
    const label = createMountedVue2Adapter(labelRoot, {
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
      await flushVue2();
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
      await flushVue2();
    }
  }
);

it('default Radio Label forwards one valueChange/select callback and preserves controlled ownership', async () => {
  const changes: unknown[] = [];
  const selections: unknown[] = [];
  const instanceAssociations = { controlLabel: createControlLabelRef() };
  const host = document.createElement('div');
  document.body.append(host);
  const state = Vue2Any.observable({ controlledValue: null as string | null, passive: false });
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  const Root = adapt(radioGroupRoot);
  const Item = adapt(radioGroupItem);
  const Label = adapt(labelRoot);
  const App = Vue2Any.extend({
    render(h: any) {
      return h('div', [
        h(
          Root,
          {
            ref: 'group',
            attrs: {
              defaultValue: 'a',
              ...(state.controlledValue === null ? {} : { value: state.controlledValue }),
              onValueChange: (event: unknown) => changes.push(event),
            },
          },
          [
            h(Item, { ref: 'first', attrs: { value: 'a' } }),
            h(Item, {
              ref: 'target',
              attrs: {
                value: 'b',
                instanceAssociations,
                onSelect: (event: unknown) => selections.push(event),
              },
            }),
          ]
        ),
        h(
          Label,
          {
            ref: 'label',
            attrs: {
              instanceAssociations,
              ...(state.passive ? { activation: false } : {}),
            },
          },
          ['Option B']
        ),
      ]);
    },
  });
  const app = new App().$mount();
  host.append(app.$el);
  const refs = app.$refs;
  const settle = async () => {
    await flushVue2();
    await flushVue2();
  };
  const dispose = () => app.$destroy();
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
