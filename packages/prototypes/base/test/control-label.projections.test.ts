import { afterEach, describe, expect, it } from 'vitest';
import { createControlLabelRef } from '@proto.ui/core';
import {
  AdaptToWebComponent,
  setElementProps,
  setElementAssociations,
} from '@proto.ui/adapter-web-component';
import { checkboxRoot } from '../src/checkbox';
import base from '../src/label';
import shadcn from '../../shadcn/src/label';
import brutalist from '../../brutalist/src/label';
import bootstrap from '../../bootstrap-2-3-2/src/label';
import liquid from '../../liquid-glass/src/label';
const families = [base, shadcn, brutalist, bootstrap, liquid];
AdaptToWebComponent(checkboxRoot);
for (const proto of families) AdaptToWebComponent(proto);
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
function click(el: HTMLElement) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  el.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
describe('Base Label and four real family projections', () => {
  it.each(families)(
    '$name defaults to activation and can opt out, re-enable and restore the default',
    async (proto) => {
      const ref = createControlLabelRef();
      const label = document.createElement(proto.name);
      const target = document.createElement(checkboxRoot.name) as HTMLElement & {
        getExposes(): any;
      };
      label.textContent = 'Visible independent label';
      setElementAssociations(label, { controlLabel: ref });
      setElementAssociations(target, { controlLabel: ref });
      document.body.append(target, label);
      await flush();
      expect(target.getAttribute('aria-labelledby')).toBe(label.id);
      expect(label.id).not.toBe('');
      expect(label.textContent).toBe('Visible independent label');
      expect(label.hasAttribute('role')).toBe(false);
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(label.getAttribute('data-pui-style')).toContain('select-none');
      click(label);
      await Promise.resolve();
      expect(target.getExposes().checked.get()).toBe(true);
      setElementProps(label, { naming: true, activation: false });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      expect(label.getAttribute('data-pui-style') ?? '').not.toContain('select-none');
      click(label);
      await Promise.resolve();
      expect(target.getExposes().checked.get()).toBe(true);
      expect(target.getAttribute('aria-labelledby')).toBe(label.id);
      setElementProps(label, { activation: true });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      click(label);
      expect(target.getExposes().checked.get()).toBe(false);
      setElementProps(label, { activation: false });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      setElementProps(label, {});
      (label as HTMLElement & { update(): void }).update();
      await flush();
      click(label);
      expect(target.getExposes().checked.get()).toBe(true);
    }
  );

  it.each(families)(
    '$name applies the derived policy only to actionable labels by default',
    async (proto) => {
      const label = document.createElement(proto.name);
      label.textContent = 'Default actionable label';
      document.body.append(label);
      await flush();
      const style = () => label.getAttribute('data-pui-style') ?? '';
      expect(style()).toContain('select-none');
      expect(style()).not.toContain('select-text');
      expect(style()).not.toContain('select-auto');
      setElementProps(label, { activation: true });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      expect(style()).toContain('select-none');
      setElementProps(label, { activation: false });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      expect(style()).not.toContain('select-none');
    }
  );

  it('honors explicit selection overrides while keeping activation ownership unchanged', async () => {
    const label = document.createElement(base.name);
    label.textContent = 'Policy-declared label';
    document.body.append(label);
    await flush();
    const style = () => label.getAttribute('data-pui-style') ?? '';
    // An explicitly actionable label can still declare selectable text.
    setElementProps(label, { activation: true, selection: 'text' });
    (label as HTMLElement & { update(): void }).update();
    await flush();
    expect(style()).toContain('select-text');
    expect(style()).not.toContain('select-none');
    // Host-default restoration wins over the derived suppression.
    setElementProps(label, { activation: true, selection: 'auto' });
    (label as HTMLElement & { update(): void }).update();
    await flush();
    expect(style()).toContain('select-auto');
    expect(style()).not.toContain('select-none');
    // A passive label can explicitly suppress accidental selection.
    setElementProps(label, { activation: false, selection: 'none' });
    (label as HTMLElement & { update(): void }).update();
    await flush();
    expect(style()).toContain('select-none');
    // Removing the declaration restores the derived policy and host default.
    setElementProps(label, { activation: false });
    (label as HTMLElement & { update(): void }).update();
    await flush();
    expect(style()).not.toContain('select-none');
    expect(style()).not.toContain('select-auto');
    expect(style()).not.toContain('select-text');
  });
});
