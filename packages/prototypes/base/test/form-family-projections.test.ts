import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import * as f0fieldset from '../../shadcn/src/fieldset';
import * as f0form from '../../shadcn/src/form';
import * as f0checkboxgroup from '../../shadcn/src/checkbox-group';
import * as f1fieldset from '../../brutalist/src/fieldset';
import * as f1form from '../../brutalist/src/form';
import * as f1checkboxgroup from '../../brutalist/src/checkbox-group';
import * as f2fieldset from '../../bootstrap-2-3-2/src/fieldset';
import * as f2form from '../../bootstrap-2-3-2/src/form';
import * as f2checkboxgroup from '../../bootstrap-2-3-2/src/checkbox-group';
import * as f3fieldset from '../../liquid-glass/src/fieldset';
import * as f3form from '../../liquid-glass/src/form';
import * as f3checkboxgroup from '../../liquid-glass/src/checkbox-group';
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
});
for (const proto of Object.values(f0fieldset))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('shadcn fieldset inherits real atoms', async () => {
  const root = document.createElement('shadcn-fieldset-root') as any;
  root.append(document.createElement('shadcn-fieldset-legend'));
  root.append(document.createElement('shadcn-fieldset-description'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f0form))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('shadcn form inherits real atoms', async () => {
  const root = document.createElement('shadcn-form-root') as any;
  root.append(document.createElement('shadcn-form-field'));
  root.append(document.createElement('shadcn-form-submit'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f0checkboxgroup))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('shadcn checkbox-group inherits real atoms', async () => {
  const root = document.createElement('shadcn-checkbox-group-root') as any;
  root.append(document.createElement('shadcn-checkbox-group-item'));
  root.append(document.createElement('shadcn-checkbox-group-all'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f1fieldset))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('brutalist fieldset inherits real atoms', async () => {
  const root = document.createElement('brutalist-fieldset-root') as any;
  root.append(document.createElement('brutalist-fieldset-legend'));
  root.append(document.createElement('brutalist-fieldset-description'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f1form))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('brutalist form inherits real atoms', async () => {
  const root = document.createElement('brutalist-form-root') as any;
  root.append(document.createElement('brutalist-form-field'));
  root.append(document.createElement('brutalist-form-submit'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f1checkboxgroup))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('brutalist checkbox-group inherits real atoms', async () => {
  const root = document.createElement('brutalist-checkbox-group-root') as any;
  root.append(document.createElement('brutalist-checkbox-group-item'));
  root.append(document.createElement('brutalist-checkbox-group-all'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f2fieldset))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('bootstrap-2-3-2 fieldset inherits real atoms', async () => {
  const root = document.createElement('bootstrap-2-3-2-fieldset-root') as any;
  root.append(document.createElement('bootstrap-2-3-2-fieldset-legend'));
  root.append(document.createElement('bootstrap-2-3-2-fieldset-description'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f2form))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('bootstrap-2-3-2 form inherits real atoms', async () => {
  const root = document.createElement('bootstrap-2-3-2-form-root') as any;
  root.append(document.createElement('bootstrap-2-3-2-form-field'));
  root.append(document.createElement('bootstrap-2-3-2-form-submit'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f2checkboxgroup))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('bootstrap-2-3-2 checkbox-group inherits real atoms', async () => {
  const root = document.createElement('bootstrap-2-3-2-checkbox-group-root') as any;
  root.append(document.createElement('bootstrap-2-3-2-checkbox-group-item'));
  root.append(document.createElement('bootstrap-2-3-2-checkbox-group-all'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f3fieldset))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('liquid-glass fieldset inherits real atoms', async () => {
  const root = document.createElement('liquid-glass-fieldset-root') as any;
  root.append(document.createElement('liquid-glass-fieldset-legend'));
  root.append(document.createElement('liquid-glass-fieldset-description'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f3form))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('liquid-glass form inherits real atoms', async () => {
  const root = document.createElement('liquid-glass-form-root') as any;
  root.append(document.createElement('liquid-glass-form-field'));
  root.append(document.createElement('liquid-glass-form-submit'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
for (const proto of Object.values(f3checkboxgroup))
  if (typeof proto === 'object' && proto !== null && 'setup' in proto) AdaptToWebComponent(proto);
it('liquid-glass checkbox-group inherits real atoms', async () => {
  const root = document.createElement('liquid-glass-checkbox-group-root') as any;
  root.append(document.createElement('liquid-glass-checkbox-group-item'));
  root.append(document.createElement('liquid-glass-checkbox-group-all'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  expect(root.children.length).toBe(2);
});
