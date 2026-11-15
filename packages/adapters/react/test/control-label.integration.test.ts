import { describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import { checkboxRoot } from '../../../prototypes/base/src/checkbox';
import { switchRoot } from '../../../prototypes/base/src/switch';
import button from '../../../prototypes/base/src/button';
import toggle from '../../../prototypes/base/src/toggle';
import { toggleGroupRoot, toggleGroupItem } from '../../../prototypes/base/src/toggle-group';
import { radioGroupRoot, radioGroupItem } from '../../../prototypes/base/src/radio-group';
import labelRoot from '../../../prototypes/base/src/label';
import { createMountedReactAdapter, createMountedReactAdapterInto } from './utils/fake-react';
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
  it.each([button, toggle])(
    'retires $name label activation when focus detaches the Label',
    async (proto) => {
      const instanceAssociations = { controlLabel: createControlLabelRef() };
      const signals: unknown[] = [];
      const target = createMountedReactAdapter(proto, {
        instanceAssociations,
        onClick: () => signals.push('click'),
        onActiveChange: (value: unknown) => signals.push(value),
      });
      const label = createMountedReactAdapter(labelRoot, { instanceAssociations });
      try {
        for (let i = 0; i < 8; i++) await Promise.resolve();
        target.root!.addEventListener('focus', () => label.root!.remove());
        pointerClick(label.root!);
        expect(signals).toEqual([]);
        if (proto === toggle) expect(target.ref.current.getExposes().active.get()).toBe(false);
      } finally {
        label.unmount();
        target.unmount();
      }
    }
  );

  it('retains accepted Toggle state but retires outward notification after Label removal', async () => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const changes: unknown[] = [];
    const target = createMountedReactAdapter(toggle, {
      instanceAssociations,
      onActiveChange: (event: unknown) => changes.push(event),
    });
    const label = createMountedReactAdapter(labelRoot, { instanceAssociations });
    try {
      for (let i = 0; i < 8; i++) await Promise.resolve();
      const active = target.ref.current.getExposes().active;
      const off = active.subscribe(() => label.root!.remove());
      try {
        pointerClick(label.root!);
        expect(active.get()).toBe(true);
        expect(changes).toEqual([]);
      } finally {
        off();
      }
    } finally {
      label.unmount();
      target.unmount();
    }
  });

  it.each([button, toggle])(
    'names icon-only $name and reuses its activation owner',
    async (proto) => {
      const instanceAssociations = { controlLabel: createControlLabelRef() };
      const clicks: unknown[] = [],
        changes: unknown[] = [];
      const props = {
        instanceAssociations,
        onClick: () => clicks.push('click'),
        onActiveChange: (e: unknown) => changes.push(e),
      };
      const target = createMountedReactAdapter(proto, props);
      const label = createMountedReactAdapter(labelRoot, { instanceAssociations });
      try {
        label.root!.textContent = 'Save document';
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(target.root!.getAttribute('aria-labelledby')).toBe(label.root!.id);
        expect(label.root!.id).not.toBe('');
        expect(target.root!.getAttribute('role')).toBe('button');
        pointerClick(label.root!);
        expect(document.activeElement).toBe(target.root);
        if (proto === button) expect(clicks).toEqual(['click']);
        else {
          expect(changes).toEqual([{ active: true }]);
          expect(target.root!.getAttribute('aria-pressed')).toBe('true');
          target.update({ ...props, active: false });
          pointerClick(label.root!);
          expect(changes).toEqual([{ active: true }, { active: true }]);
          expect(target.root!.getAttribute('aria-pressed')).toBe('false');
        }
        target.update({ ...props, disabled: true });
        pointerClick(label.root!);
        expect(clicks).toHaveLength(proto === button ? 1 : 0);
        expect(changes).toHaveLength(proto === toggle ? 2 : 0);
        expect(target.root!.getAttribute('aria-labelledby')).toBe(label.root!.id);
        label.unmount();
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(target.root!.hasAttribute('aria-labelledby')).toBe(false);
      } finally {
        label.unmount();
        target.unmount();
      }
    }
  );

  it('names an icon-only Toggle Group item without replacing group selection ownership', async () => {
    const instanceAssociations = { controlLabel: createControlLabelRef() };
    const changes: unknown[] = [];
    const onValueChange = (event: unknown) => changes.push(event);
    const group = createMountedReactAdapter(toggleGroupRoot, { multiple: true, onValueChange });
    const host = document.createElement('span');
    group.root!.append(host);
    const item = createMountedReactAdapterInto(toggleGroupItem, host, {
      value: 'bold',
      instanceAssociations,
    });
    const label = createMountedReactAdapter(labelRoot, { instanceAssociations });
    try {
      label.root!.textContent = 'Bold';
      for (let i = 0; i < 8; i++) await Promise.resolve();
      expect(item.root!.getAttribute('aria-labelledby')).toBe(label.root!.id);
      expect(label.root!.id).not.toBe('');
      pointerClick(label.root!);
      expect(changes).toEqual([{ value: ['bold'] }]);
      expect(item.root!.getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement).toBe(item.root);
      group.update({ multiple: true, value: [], onValueChange });
      pointerClick(label.root!);
      expect(changes).toEqual([{ value: ['bold'] }, { value: ['bold'] }]);
      expect(item.root!.getAttribute('aria-pressed')).toBe('false');
      group.update({ multiple: true, value: [], disabled: true, onValueChange });
      pointerClick(label.root!);
      expect(changes).toHaveLength(2);
      expect(item.root!.getAttribute('aria-labelledby')).toBe(label.root!.id);
    } finally {
      label.unmount();
      item.unmount();
      group.unmount();
    }
  });

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

it('default Radio Label forwards one valueChange/select callback and preserves controlled ownership', async () => {
  const changes: unknown[] = [];
  const selections: unknown[] = [];
  const onValueChange = (event: unknown) => changes.push(event);
  const instanceAssociations = { controlLabel: createControlLabelRef() };
  const group = createMountedReactAdapter(radioGroupRoot, { defaultValue: 'a', onValueChange });
  const host = () => {
    const element = document.createElement('span');
    group.root!.append(element);
    return element;
  };
  const first = createMountedReactAdapterInto(radioGroupItem, host(), { value: 'a' });
  const target = createMountedReactAdapterInto(radioGroupItem, host(), {
    value: 'b',
    instanceAssociations,
    onSelect: (event: unknown) => selections.push(event),
  });
  const label = createMountedReactAdapter(labelRoot, { instanceAssociations });
  const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };
  try {
    label.root!.textContent = 'Option B';
    await settle();
    expect(target.root!.getAttribute('aria-labelledby')).toBe(label.root!.id);
    pointerClick(label.root!);
    await settle();
    expect(group.ref.current.getExposes().value.get()).toBe('b');
    expect(document.activeElement).toBe(target.root);
    expect(changes).toEqual([{ value: 'b' }]);
    expect(selections).toEqual([{ value: 'b' }]);
    pointerClick(label.root!);
    await settle();
    expect(changes).toHaveLength(1);
    expect(selections).toHaveLength(1);
    group.update({ value: 'a', onValueChange });
    label.update({ instanceAssociations, activation: false });
    await settle();
    first.root!.focus();
    pointerClick(label.root!);
    await settle();
    expect(group.ref.current.getExposes().value.get()).toBe('a');
    expect(document.activeElement).toBe(first.root);
    expect(changes).toHaveLength(1);
    expect(selections).toHaveLength(1);
    label.update({ instanceAssociations });
    await settle();
    pointerClick(label.root!);
    await settle();
    expect(group.ref.current.getExposes().value.get()).toBe('a');
    expect(document.activeElement).toBe(target.root);
    expect(changes).toEqual([{ value: 'b' }, { value: 'b' }]);
    expect(selections).toEqual([{ value: 'b' }, { value: 'b' }]);
    group.update({ value: 'b', onValueChange });
    await settle();
    expect(group.ref.current.getExposes().value.get()).toBe('b');
  } finally {
    label.unmount();
    target.unmount();
    first.unmount();
    group.unmount();
    await settle();
  }
});
