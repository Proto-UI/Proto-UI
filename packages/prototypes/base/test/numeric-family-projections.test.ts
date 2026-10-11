import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as f0slider from '../../shadcn/src/slider';
import * as f0numberfield from '../../shadcn/src/number-field';
import * as f0inputotp from '../../shadcn/src/input-otp';
import * as f1slider from '../../brutalist/src/slider';
import * as f1numberfield from '../../brutalist/src/number-field';
import * as f1inputotp from '../../brutalist/src/input-otp';
import * as f2slider from '../../bootstrap-2-3-2/src/slider';
import * as f2numberfield from '../../bootstrap-2-3-2/src/number-field';
import * as f2inputotp from '../../bootstrap-2-3-2/src/input-otp';
import * as f3slider from '../../liquid-glass/src/slider';
import * as f3numberfield from '../../liquid-glass/src/number-field';
import * as f3inputotp from '../../liquid-glass/src/input-otp';
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
});
for (const proto of Object.values(f0slider))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('shadcn slider mounts real parts and inherited transitions', async () => {
  const root = document.createElement('shadcn-slider-root') as any;
  const track = document.createElement('shadcn-slider-track'),
    thumb = document.createElement('shadcn-slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f0numberfield))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('shadcn number-field mounts real parts and inherited transitions', async () => {
  const root = document.createElement('shadcn-number-field-root') as any;
  root.append(document.createElement('shadcn-number-field-input'));
  root.append(document.createElement('shadcn-number-field-increment'));
  root.append(document.createElement('shadcn-number-field-decrement'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f0inputotp))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('shadcn input-otp mounts real parts and inherited transitions', async () => {
  const root = document.createElement('shadcn-input-otp-root') as any;
  root.append(document.createElement('shadcn-input-otp-input'));
  root.append(document.createElement('shadcn-input-otp-slot'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue('123456');
  await flush();
  expect(root.getExposes().complete.get()).toBe(true);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f1slider))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('brutalist slider mounts real parts and inherited transitions', async () => {
  const root = document.createElement('brutalist-slider-root') as any;
  const track = document.createElement('brutalist-slider-track'),
    thumb = document.createElement('brutalist-slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f1numberfield))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('brutalist number-field mounts real parts and inherited transitions', async () => {
  const root = document.createElement('brutalist-number-field-root') as any;
  root.append(document.createElement('brutalist-number-field-input'));
  root.append(document.createElement('brutalist-number-field-increment'));
  root.append(document.createElement('brutalist-number-field-decrement'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f1inputotp))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('brutalist input-otp mounts real parts and inherited transitions', async () => {
  const root = document.createElement('brutalist-input-otp-root') as any;
  root.append(document.createElement('brutalist-input-otp-input'));
  root.append(document.createElement('brutalist-input-otp-slot'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue('123456');
  await flush();
  expect(root.getExposes().complete.get()).toBe(true);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f2slider))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('bootstrap-2-3-2 slider mounts real parts and inherited transitions', async () => {
  const root = document.createElement('bootstrap-2-3-2-slider-root') as any;
  const track = document.createElement('bootstrap-2-3-2-slider-track'),
    thumb = document.createElement('bootstrap-2-3-2-slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f2numberfield))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('bootstrap-2-3-2 number-field mounts real parts and inherited transitions', async () => {
  const root = document.createElement('bootstrap-2-3-2-number-field-root') as any;
  root.append(document.createElement('bootstrap-2-3-2-number-field-input'));
  root.append(document.createElement('bootstrap-2-3-2-number-field-increment'));
  root.append(document.createElement('bootstrap-2-3-2-number-field-decrement'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f2inputotp))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('bootstrap-2-3-2 input-otp mounts real parts and inherited transitions', async () => {
  const root = document.createElement('bootstrap-2-3-2-input-otp-root') as any;
  root.append(document.createElement('bootstrap-2-3-2-input-otp-input'));
  root.append(document.createElement('bootstrap-2-3-2-input-otp-slot'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue('123456');
  await flush();
  expect(root.getExposes().complete.get()).toBe(true);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f3slider))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('liquid-glass slider mounts real parts and inherited transitions', async () => {
  const root = document.createElement('liquid-glass-slider-root') as any;
  const track = document.createElement('liquid-glass-slider-track'),
    thumb = document.createElement('liquid-glass-slider-thumb');
  track.append(thumb);
  root.append(track);
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f3numberfield))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('liquid-glass number-field mounts real parts and inherited transitions', async () => {
  const root = document.createElement('liquid-glass-number-field-root') as any;
  root.append(document.createElement('liquid-glass-number-field-input'));
  root.append(document.createElement('liquid-glass-number-field-increment'));
  root.append(document.createElement('liquid-glass-number-field-decrement'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue(25);
  await flush();
  expect(root.getExposes().value.get()).toBe(25);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
for (const proto of Object.values(f3inputotp))
  if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
it('liquid-glass input-otp mounts real parts and inherited transitions', async () => {
  const root = document.createElement('liquid-glass-input-otp-root') as any;
  root.append(document.createElement('liquid-glass-input-otp-input'));
  root.append(document.createElement('liquid-glass-input-otp-slot'));
  document.body.append(root);
  await flush();
  expect(root.getExposes().disabled.get()).toBe(false);
  root.getExposes().requestValue('123456');
  await flush();
  expect(root.getExposes().complete.get()).toBe(true);
  setElementProps(root, { disabled: true });
  await flush();
  expect(root.getExposes().disabled.get()).toBe(true);
});
