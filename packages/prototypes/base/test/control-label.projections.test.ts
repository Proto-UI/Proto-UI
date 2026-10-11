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
    '$name inherits independent naming and activation rather than a style-only alias',
    async (proto) => {
      const ref = createControlLabelRef();
      const label = document.createElement(proto.name);
      const target = document.createElement(checkboxRoot.name) as HTMLElement & {
        getExposes(): any;
      };
      label.textContent = 'Visible independent label';
      setElementAssociations(label, { controlLabel: ref });
      setElementAssociations(target, { controlLabel: ref });
      setElementProps(label, { naming: true, activation: true });
      document.body.append(target, label);
      await flush();
      expect(target.getAttribute('aria-labelledby')).toBe(label.id);
      expect(label.id).not.toBe('');
      expect(label.textContent).toBe('Visible independent label');
      expect(label.hasAttribute('role')).toBe(false);
      expect(label.hasAttribute('tabindex')).toBe(false);
      expect(label.getAttribute('data-pui-style')).toContain('select-none');
      click(label); await Promise.resolve();
      expect(target.getExposes().checked.get()).toBe(true);
      setElementProps(label, { naming: true, activation: false });
      (label as HTMLElement & { update(): void }).update();
      await flush();
      expect(label.getAttribute('data-pui-style') ?? '').not.toContain('select-none');
      click(label); await Promise.resolve();
      expect(target.getExposes().checked.get()).toBe(true);
      expect(target.getAttribute('aria-labelledby')).toBe(label.id);
    }
  );
});
