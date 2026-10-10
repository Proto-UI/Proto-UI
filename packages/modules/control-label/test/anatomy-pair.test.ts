import { afterEach, describe, expect, it } from 'vitest';
import { createAnatomyFamily, createControlLabelRef, definePrototype } from '@proto.ui/core';
import { asAccessible, asControlLabel, asFocusable } from '@proto.ui/hooks';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
const family = createAnatomyFamily('control-label-anatomy-fixture', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    label: { cardinality: { min: 0, max: '*' } },
    target: { cardinality: { min: 0, max: '*' } },
    other: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['label', 'target', 'other'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
const pair = { family, labelRole: 'label', targetRole: 'target' };
const rootProto = definePrototype({
  name: 'anatomy-label-test-root',
  setup(def) {
    def.anatomy.claim(family, { role: 'root' });
    return (r) => r.slot();
  },
});
const labelProto = definePrototype({
  name: 'anatomy-label-test-label',
  setup(def) {
    def.anatomy.claim(family, { role: 'label' });
    const label = asControlLabel().label(pair);
    def.lifecycle.onCreated(() => label.sync({ naming: false, activation: true }));
    return (r) => r.slot();
  },
});
const targetProto = definePrototype<{ disabled?: boolean }>({
  name: 'anatomy-label-test-target',
  setup(def) {
    def.anatomy.claim(family, { role: 'target' });
    def.props.define({ disabled: { type: 'boolean', empty: 'fallback' } });
    def.props.setDefaults({ disabled: false });
    const focused = asFocusable();
    focused.configure({ disabled: false });
    asAccessible().role('textbox');
    const count = def.state.numberDiscrete('count', 0);
    def.expose.state('count', count);
    def.expose.state('focused', focused.focused);
    def.expose.event('activated', { payload: 'void' });
    asControlLabel().target((run, request) => {
      if (run.props.get().disabled || !request.isCurrent()) return;
      count.set(count.get() + 1, 'reason: test activation');
      run.expose.emit('activated');
      if (request.isCurrent() && !run.props.get().disabled)
        focused.focusSelf({ reason: 'pointer' });
    }, pair);
  },
});
for (const proto of [rootProto, labelProto, targetProto]) AdaptToWebComponent(proto);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const make = (proto: typeof rootProto | typeof labelProto | typeof targetProto) =>
  document.createElement(proto.name) as any;
function fixture() {
  const root = make(rootProto),
    label = make(labelProto),
    target = make(targetProto);
  label.textContent = 'Selectable label';
  root.append(label, target);
  return { root, label, target };
}
function down(el: HTMLElement, options: PointerEventInit = {}) {
  el.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      cancelable: true,
      ...options,
    })
  );
}
function up(el: HTMLElement, options: PointerEventInit = {}) {
  el.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      composed: true,
      pointerId: 1,
      button: 0,
      cancelable: true,
      ...options,
    })
  );
}
function click(el: HTMLElement) {
  down(el);
  up(el);
  el.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
      button: 0,
      detail: 1,
      cancelable: true,
    })
  );
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
describe('ControlLabel module-only anatomy pair bridge', () => {
  it('reuses the actual host input guard and exact opaque nearest-root scope', async () => {
    const outer = fixture(),
      inner = fixture();
    outer.root.append(inner.root);
    document.body.append(outer.root);
    await flush();
    click(outer.label);
    await flush();
    expect(outer.target.getExposes().count.get()).toBe(1);
    expect(inner.target.getExposes().count.get()).toBe(0);
    click(inner.label);
    await flush();
    expect(inner.target.getExposes().count.get()).toBe(1);
    expect(outer.target.getExposes().count.get()).toBe(1);
    expect(outer.target.hasAttribute('aria-labelledby')).toBe(false);
    expect(outer.label.hasAttribute('tabindex')).toBe(false);
    expect(outer.label.hasAttribute('role')).toBe(false);
  });
  it('rejects synthetic click-only, drag, cancel, modified and nested interactive input', async () => {
    const f = fixture();
    document.body.append(f.root);
    await flush();
    f.label.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    down(f.label);
    f.label.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, composed: true, pointerId: 1, clientX: 40 })
    );
    up(f.label, { clientX: 40 });
    f.label.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    down(f.label);
    f.label.dispatchEvent(
      new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: 1 })
    );
    up(f.label);
    f.label.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    down(f.label, { ctrlKey: true });
    up(f.label, { ctrlKey: true });
    f.label.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true, detail: 1 }));
    const nested = document.createElement('button');
    nested.textContent = 'Own action';
    f.label.append(nested);
    click(nested);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(0);
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(1);
  });
  it('honors defaultPrevented before the host listener without clearing selection', async () => {
    const f = fixture();
    f.label.addEventListener('click', (e: Event) => e.preventDefault(), { capture: true });
    document.body.append(f.root);
    await flush();
    const range = document.createRange();
    range.selectNodeContents(f.label);
    document.getSelection()?.addRange(range);
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(0);
    expect(document.getSelection()?.toString()).toContain('Selectable label');
  });
  it('does not pick a winner among zero or two targets and resumes only the current singleton', async () => {
    const f = fixture();
    f.target.remove();
    document.body.append(f.root);
    await flush();
    click(f.label);
    f.root.append(f.target);
    await flush();
    const duplicate = make(targetProto);
    f.root.append(duplicate);
    await flush();
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(0);
    expect(duplicate.getExposes().count.get()).toBe(0);
    duplicate.remove();
    await flush();
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(1);
  });
  it('moves logical parent membership and rejects the old pointer turn', async () => {
    const a = fixture(),
      b = fixture();
    b.label.remove();
    document.body.append(a.root, b.root);
    await flush();
    down(a.label);
    b.root.prepend(a.label);
    await flush();
    up(a.label);
    a.label.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await flush();
    expect(a.target.getExposes().count.get()).toBe(0);
    expect(b.target.getExposes().count.get()).toBe(0);
    click(a.label);
    await flush();
    expect(b.target.getExposes().count.get()).toBe(1);
    expect(a.target.getExposes().count.get()).toBe(0);
  });
  it('reentrant disabling after the owned activation prevents later focus', async () => {
    const f = fixture();
    f.target.addEventListener('activated', () => setElementProps(f.target, { disabled: true }));
    document.body.append(f.root);
    await flush();
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(1);
    expect(f.target.getExposes().focused.get()).toBe(false);
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(1);
  });
  it('rejects explicit association input for anatomy-paired participants', async () => {
    const f = fixture();
    document.body.append(f.root);
    await flush();
    expect(() =>
      setElementAssociations(f.label, { controlLabel: createControlLabelRef() })
    ).toThrow(/mutually exclusive/);
    click(f.label);
    await flush();
    expect(f.target.getExposes().count.get()).toBe(1);
  });
});
