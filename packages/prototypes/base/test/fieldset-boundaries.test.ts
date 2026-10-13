import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { fieldsetRoot, fieldsetLegend, fieldsetDescription } from '../src/fieldset';
import { fieldRoot, fieldControl } from '../src/field';
for (const p of [fieldsetRoot, fieldsetLegend, fieldsetDescription, fieldRoot, fieldControl])
  AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
const part = (name: string, props: Record<string, unknown> = {}) => {
  const e = document.createElement('base-' + name) as any;
  setElementProps(e, props);
  return e;
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('nested groups use own names and descriptions', async () => {
  const outer = part('fieldset-root'),
    inner = part('fieldset-root'),
    ol = part('fieldset-legend'),
    il = part('fieldset-legend'),
    od = part('fieldset-description'),
    id = part('fieldset-description');
  ol.textContent = 'outer';
  il.textContent = 'inner';
  od.textContent = 'outer desc';
  id.textContent = 'inner desc';
  inner.append(il, id);
  outer.append(ol, od, inner);
  document.body.append(outer);
  await flush();
  expect(outer.getAttribute('aria-labelledby')).toBe(ol.id);
  expect(inner.getAttribute('aria-labelledby')).toBe(il.id);
  expect(outer.getAttribute('aria-describedby')).toBe(od.id);
  expect(inner.getAttribute('aria-describedby')).toBe(id.id);
});
it('removed relation targets leave no dangling IDs and replacements bind', async () => {
  const r = part('fieldset-root', { ariaLabel: 'Fallback' }),
    l = part('fieldset-legend'),
    d = part('fieldset-description');
  l.textContent = 'Name';
  d.textContent = 'Desc';
  r.append(l, d);
  document.body.append(r);
  await flush();
  l.remove();
  d.remove();
  await flush();
  expect(r.getAttribute('aria-labelledby')).toBeNull();
  expect(r.getAttribute('aria-describedby')).toBeNull();
  const l2 = part('fieldset-legend'),
    d2 = part('fieldset-description');
  l2.textContent = 'Replacement';
  d2.textContent = 'Replacement desc';
  r.append(l2, d2);
  await flush();
  expect(r.getAttribute('aria-labelledby')).toBe(l2.id);
  expect(r.getAttribute('aria-describedby')).toBe(d2.id);
});
it('portable first legend does not exempt a governed Field descendant', async () => {
  const r = part('fieldset-root', { disabled: true }),
    l = part('fieldset-legend'),
    f = part('field-root'),
    c = part('field-control');
  f.append(c);
  l.append(f);
  r.append(l);
  document.body.append(r);
  await flush();
  expect(l.getExposes().disabled.get()).toBe(true);
  expect(f.getExposes().disabled.get()).toBe(true);
  expect((c.shadowRoot?.querySelector('input') ?? c.querySelector('input')).disabled).toBe(true);
});
it('passive parts expose no validation or submission authority', async () => {
  const r = part('fieldset-root'),
    l = part('fieldset-legend'),
    d = part('fieldset-description');
  r.append(l, d);
  document.body.append(r);
  await flush();
  for (const x of [r, l, d])
    for (const k of ['validate', 'requestSubmit', 'getValues', 'requestReset', 'resolveValidation'])
      expect(x.getExposes()[k]).toBeUndefined();
  expect(r.getAttribute('role')).toBe('group');
  expect(r.getAttribute('tabindex')).toBeNull();
});
it('ancestor toggle updates passive parts and preserves nested local policy', async () => {
  const outer = part('fieldset-root'),
    inner = part('fieldset-root'),
    l = part('fieldset-legend'),
    d = part('fieldset-description');
  inner.append(l, d);
  outer.append(inner);
  document.body.append(outer);
  await flush();
  setElementProps(outer, { disabled: true });
  await flush();
  for (const e of [inner, l, d]) expect(e.getExposes().disabled.get()).toBe(true);
  setElementProps(inner, { disabled: true });
  setElementProps(outer, { disabled: false });
  await flush();
  for (const e of [inner, l, d]) expect(e.getExposes().disabled.get()).toBe(true);
  setElementProps(inner, { disabled: false });
  await flush();
  for (const e of [inner, l, d]) expect(e.getExposes().disabled.get()).toBe(false);
});
it('missing own legend does not adopt nested legend', async () => {
  const outer = part('fieldset-root', { ariaLabel: 'Outer' }),
    inner = part('fieldset-root'),
    l = part('fieldset-legend');
  l.textContent = 'Inner';
  inner.append(l);
  outer.append(inner);
  document.body.append(outer);
  await flush();
  expect(outer.getAttribute('aria-labelledby')).toBeNull();
  expect(outer.getAttribute('aria-label')).toBe('Outer');
  expect(inner.getAttribute('aria-labelledby')).toBe(l.id);
});
it('root reparent picks new disabled ancestor rather than stale one', async () => {
  const a = part('fieldset-root', { disabled: true }),
    b = part('fieldset-root'),
    inner = part('fieldset-root'),
    l = part('fieldset-legend');
  inner.append(l);
  a.append(inner);
  document.body.append(a, b);
  await flush();
  expect(inner.getExposes().disabled.get()).toBe(true);
  b.append(inner);
  await flush();
  expect(inner.getExposes().disabled.get()).toBe(false);
  expect(l.getExposes().disabled.get()).toBe(false);
  setElementProps(a, { disabled: false });
  setElementProps(b, { disabled: true });
  await flush();
  expect(inner.getExposes().disabled.get()).toBe(true);
});
it('duplicate legend and description targets fail closed, then recover', async () => {
  const r = part('fieldset-root'),
    l = part('fieldset-legend'),
    l2 = part('fieldset-legend'),
    d = part('fieldset-description'),
    d2 = part('fieldset-description');
  l.textContent = 'A';
  l2.textContent = 'B';
  d.textContent = 'A';
  d2.textContent = 'B';
  r.append(l, l2, d, d2);
  document.body.append(r);
  await flush();
  expect(r.getAttribute('aria-labelledby')).toBeNull();
  expect(r.getAttribute('aria-describedby')).toBeNull();
  l2.remove();
  d2.remove();
  await flush();
  expect(r.getAttribute('aria-labelledby')).toBe(l.id);
  expect(r.getAttribute('aria-describedby')).toBe(d.id);
});
