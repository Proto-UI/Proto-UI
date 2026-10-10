import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { checkboxRoot } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import labelRoot from '../../../prototypes/base/src/label';
import { createMountedReactAdapter } from './utils/fake-react';
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
describe('react explicit instance-associated Label', () => {
  it.each([checkboxRoot, switchRoot])(
    'names and activates $name across independent sibling roots',
    async (proto) => {
      const instanceAssociations = { controlLabel: createControlLabelRef() };
      const changes: unknown[] = [];
      const target = createMountedReactAdapter(proto, {
        instanceAssociations,
        onCheckedChange: (e: unknown) => changes.push(e),
      });
      const label = createMountedReactAdapter(labelRoot, {
        instanceAssociations,
        naming: true,
        activation: true,
      });
      try {
        for (let i = 0; i < 5; i++) await Promise.resolve();
        const targetEl = target.root as HTMLElement;
        const labelEl = label.root as HTMLElement;
        labelEl.textContent = 'Visible control label';
        expect(labelEl.id).not.toBe('');
        expect(targetEl.getAttribute('aria-labelledby')).toBe(labelEl.id);
        expect(labelEl.hasAttribute('tabindex')).toBe(false);
        expect(targetEl.hasAttribute('instanceAssociations')).toBe(false);
        const exposes = target.ref.current.getExposes();
        pointerClick(labelEl);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(exposes.checked.get()).toBe(true);
        expect(changes).toHaveLength(1);
      } finally {
        label.unmount();
        target.unmount();
        for (let i = 0; i < 5; i++) await Promise.resolve();
      }
    }
  );
  it('disabled target remains named without a value proposal', async () => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const changes: unknown[] = [];
    const target = createMountedReactAdapter(checkboxRoot, {
      instanceAssociations,
      disabled: true,
      onCheckedChange: (e: unknown) => changes.push(e),
    });
    const label = createMountedReactAdapter(labelRoot, {
      instanceAssociations,
      naming: true,
      activation: true,
    });
    try {
      for (let i = 0; i < 5; i++) await Promise.resolve();
      pointerClick(label.root as HTMLElement);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(changes).toEqual([]);
      expect((target.root as HTMLElement).getAttribute('aria-labelledby')).toBe(
        (label.root as HTMLElement).id
      );
    } finally {
      label.unmount();
      target.unmount();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }
  });
});

it('withdraws and restores an actual Adapter naming lease inside a ShadowRoot', async () => {
  const { createMountedReactAdapterInto } = await import('./utils/fake-react');
  const outer = document.createElement('div');
  document.body.append(outer);
  const scope = outer.attachShadow({ mode: 'open' });
  const targetHost = document.createElement('div');
  const labelHost = document.createElement('div');
  scope.append(targetHost, labelHost);
  const instanceAssociations = { controlLabel: createControlLabelRef() };
  const target = createMountedReactAdapterInto(checkboxRoot, targetHost, { instanceAssociations });
  const label = createMountedReactAdapterInto(labelRoot, labelHost, {
    instanceAssociations,
    naming: true,
    activation: true,
  });
  const targetNode = target.root as HTMLElement;
  const labelNode = label.root as HTMLElement;
  labelNode.textContent = 'Shadow label';
  const mutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  try {
    await mutations();
    expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
    expect(labelNode.id).not.toBe('');
    labelNode.remove();
    await mutations();
    expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
    labelHost.append(labelNode);
    await mutations();
    expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
    const otherHost = document.createElement('div');
    document.body.append(otherHost);
    const otherScope = otherHost.attachShadow({ mode: 'open' });
    otherScope.append(labelHost);
    await mutations();
    expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
    scope.append(labelHost);
    await mutations();
    expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
    otherHost.remove();
  } finally {
    label.unmount();
    target.unmount();
    outer.remove();
    await mutations();
  }
});

it.each(['open', 'closed'] as const)(
  'renews retained Adapter naming after delayed movement into another %s ShadowRoot',
  async (mode) => {
    const { createMountedReactAdapterInto } = await import('./utils/fake-react');
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const oldScope = first.attachShadow({ mode });
    const newScope = second.attachShadow({ mode });
    const labelHost = document.createElement('div');
    const targetHost = document.createElement('div');
    oldScope.append(labelHost, targetHost);
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const label = createMountedReactAdapterInto(labelRoot, labelHost, {
      instanceAssociations,
      naming: true,
      activation: true,
    });
    const target = createMountedReactAdapterInto(checkboxRoot, targetHost, {
      instanceAssociations,
    });
    const labelNode = label.root as HTMLElement;
    const targetNode = target.root as HTMLElement;
    const mutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      await mutations();
      expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
      labelHost.remove();
      await mutations();
      // Removal already withdraws the old name; the regression is renewal.
      expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
      newScope.append(labelHost);
      await frame();
      await mutations();
      expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
      targetHost.remove();
      await mutations();
      newScope.append(targetHost);
      await frame();
      await mutations();
      expect(targetNode.getAttribute('aria-labelledby')).toBe(labelNode.id);
      expect(labelNode.id).not.toBe('');
      pointerClick(labelNode);
      expect(target.ref.current.getExposes().checked.get()).toBe(true);
      label.unmount();
      await mutations();
      expect(targetNode.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      label.unmount();
      target.unmount();
      first.remove();
      second.remove();
      await mutations();
    }
  }
);
