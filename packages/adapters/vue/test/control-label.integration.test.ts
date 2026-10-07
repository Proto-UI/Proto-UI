import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { checkboxRoot } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import labelRoot from '../../../prototypes/base/src/label';
import { createMountedVueAdapter, flushVue } from './utils/vue';
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
        naming: true,
        activation: true,
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
