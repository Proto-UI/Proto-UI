import * as baseCheckbox from '@proto.ui/prototypes-base/checkbox';
import * as baseRadio from '@proto.ui/prototypes-base/radio-group';
import * as baseSwitch from '@proto.ui/prototypes-base/switch';
import * as baseLabel from '@proto.ui/prototypes-base/label';
import * as shadcnCheckbox from '@proto.ui/prototypes-shadcn/checkbox';
import * as shadcnRadio from '@proto.ui/prototypes-shadcn/radio-group';
import * as shadcnSwitch from '@proto.ui/prototypes-shadcn/switch';
import * as shadcnLabel from '@proto.ui/prototypes-shadcn/label';
import * as brutalistCheckbox from '@proto.ui/prototypes-brutalist/checkbox';
import * as brutalistRadio from '@proto.ui/prototypes-brutalist/radio-group';
import * as brutalistSwitch from '@proto.ui/prototypes-brutalist/switch';
import * as brutalistLabel from '@proto.ui/prototypes-brutalist/label';
import * as baseForm from '@proto.ui/prototypes-base/form';
import * as shadcnForm from '@proto.ui/prototypes-shadcn/form';
import * as brutalistForm from '@proto.ui/prototypes-brutalist/form';
import * as baseField from '@proto.ui/prototypes-base/field';
import * as shadcnField from '@proto.ui/prototypes-shadcn/field';
import * as brutalistField from '@proto.ui/prototypes-brutalist/field';
import * as baseFieldset from '@proto.ui/prototypes-base/fieldset';
import * as shadcnFieldset from '@proto.ui/prototypes-shadcn/fieldset';
import * as brutalistFieldset from '@proto.ui/prototypes-brutalist/fieldset';
import * as baseCheckboxGroup from '@proto.ui/prototypes-base/checkbox-group';
import * as shadcnCheckboxGroup from '@proto.ui/prototypes-shadcn/checkbox-group';
import * as brutalistCheckboxGroup from '@proto.ui/prototypes-brutalist/checkbox-group';
import * as baseButton from '@proto.ui/prototypes-base/button';
import * as shadcnButton from '@proto.ui/prototypes-shadcn/button';
import * as brutalistButton from '@proto.ui/prototypes-brutalist/button';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';
import { afterEach, beforeAll, afterAll, expect, it, vi } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../../../packages/cli/src/services/proto-style-css';
const sheet = document.createElement('style');
beforeAll(() => {
  // The real Rhea Switch requires its authored positioned inline-flex box.
  // This source environment parses ordinary rules, not CSS cascade layers.
  sheet.textContent = renderProtoStyleTokenCss(['relative', 'inline-flex'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(sheet);
});
afterAll(() => sheet.remove());
import baseDemo from '../../content/docs/demo-base-field-choices.demo';
import shadcnDemo from '../../content/docs/demo-shadcn-field-choices.demo';
import brutalistDemo from '../../content/docs/demo-brutalist-field-choices.demo';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRuntimeApi } from './demo-types';

// Only substitute CDN acquisition. These are the public recipe and real
// framework/Adapter instances, including their actual update and teardown paths.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});
for (const library of [
  baseForm,
  shadcnForm,
  brutalistForm,
  baseField,
  shadcnField,
  brutalistField,
  baseFieldset,
  shadcnFieldset,
  brutalistFieldset,
  baseCheckboxGroup,
  shadcnCheckboxGroup,
  brutalistCheckboxGroup,
  baseButton,
  shadcnButton,
  brutalistButton,
  baseCheckbox,
  baseRadio,
  baseSwitch,
  baseLabel,
  shadcnCheckbox,
  shadcnRadio,
  shadcnSwitch,
  shadcnLabel,
  brutalistCheckbox,
  brutalistRadio,
  brutalistSwitch,
  brutalistLabel,
  { styleScope },
])
  for (const value of Object.values(library))
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const prototype = value as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }
const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
for (const [family, demo] of Object.entries({
  base: baseDemo,
  shadcn: shadcnDemo,
  brutalist: brutalistDemo,
}))
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${family}/${runtime} public choice Fields retain canonical ownership, readonly focus, reset and replacement`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let api!: DemoRuntimeApi;
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          ...demo,
          setup(context) {
            api = context.api;
            return demo.setup?.(context);
          },
        },
      });
      cleanups.push(() => view.destroy());
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
      const x = (name: string) => api.getExposes(name) as any;
      const values = () => x('choiceForm').getValues();
      const click = async (name: string) => {
        await flush();
        const node = ref(name);
        for (const type of ['pointerdown', 'pointerup'])
          node.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              composed: true,
              pointerId: 1,
              pointerType: 'mouse',
              button: 0,
            })
          );
        node.dispatchEvent(
          new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
        );
        await flush();
      };
      const key = async (name: string, key: string) => {
        await flush();
        ref(name).dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, composed: true })
        );
        ref(name).dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, composed: true }));
        await flush();
      };
      await vi.waitFor(() =>
        expect(values()).toEqual({ agreement: false, plan: '', alerts: false })
      );
      expect(ref('agreement').getAttribute('aria-checked')).toBe('mixed');
      expect(ref('agreement').getAttribute('aria-labelledby')).toBe(ref('agreeLabel').id);
      expect(ref('plan').getAttribute('aria-labelledby')).toBe(ref('planLabel').id);
      await click('choiceSubmit');
      expect(ref('choiceSubmission').textContent).toBe('required values missing');
      expect(x('agreeField').getValidity().invalid).toBe(true);
      expect(x('planField').getValidity().invalid).toBe(true);
      expect(ref('agreement').getAttribute('aria-errormessage')).toBe(ref('agreeError').id);
      expect(ref('plan').getAttribute('aria-errormessage')).toBe(ref('planError').id);
      await click('choiceToggleOwner');
      await click('agreement');
      await click('plan-basic');
      expect(values()).toEqual({ agreement: false, plan: '', alerts: false });
      expect(x('agreeField').dirty.get()).toBe(false);
      expect(x('planField').dirty.get()).toBe(false);
      await click('choiceToggleOwner');
      await click('agreement');
      await click('plan-pro');
      await click('alerts');
      expect(values()).toEqual({ agreement: true, plan: 'pro', alerts: true });
      expect(ref('agreement').getAttribute('aria-checked')).toBe('true');
      expect(x('agreeField').getValidity().invalid).toBe(false);
      expect(x('planField').getValidity().invalid).toBe(false);
      await click('choiceReadOnly');
      const proposals = ref('choiceStatus').textContent?.match(/proposals=(\d+)/)?.[1];
      await click('agreeLabel');
      expect(document.activeElement).toBe(ref('agreement'));
      await key('agreement', ' ');
      await click('planLabel');
      expect(document.activeElement).toBe(ref('plan-pro'));
      const touched = x('planField').touched.get();
      await key('plan-pro', 'ArrowLeft');
      expect(document.activeElement).toBe(ref('plan-basic'));
      expect(x('planField').touched.get()).toBe(touched);
      await click('alertsLabel');
      expect(document.activeElement).toBe(ref('alerts'));
      await key('alerts', ' ');
      expect(ref('choiceStatus').textContent?.match(/proposals=(\d+)/)?.[1]).toBe(proposals);
      expect(values()).toEqual({ agreement: true, plan: 'pro', alerts: true });
      await click('choiceDisabled');
      expect(values()).toEqual({});
      expect(ref('agreement').getAttribute('aria-disabled')).toBe('true');
      expect(ref('plan-basic').getAttribute('aria-disabled')).toBe('true');
      await click('choiceDisabled');
      expect(values()).toEqual({ agreement: true, plan: 'pro', alerts: true });
      await click('choiceToggleOwner');
      await click('choiceReset');
      expect(values()).toEqual({ agreement: true, plan: 'pro', alerts: false });
      expect(x('agreeField').dirty.get()).toBe(true);
      expect(x('planField').dirty.get()).toBe(true);
      await click('choiceToggleOwner');
      await click('choiceReset');
      expect(values()).toEqual({ agreement: false, plan: '', alerts: false });
      expect(x('agreeField').dirty.get()).toBe(false);
      expect(x('planField').dirty.get()).toBe(false);
      expect(x('agreement').readOnly.get()).toBe(true);
      await click('choiceReadOnly');
      await click('choiceHold');
      await click('agreement');
      expect(values().agreement).toBe(false);
      expect(ref('choiceHeld').textContent).toBe('held revision=1');
      const oldControl = x('agreement');
      const oldNode = ref('agreement');
      await click('choiceReplace');
      await vi.waitFor(() => expect(ref('choiceStatus').textContent).toContain('revision=2'));
      await click('choiceDeliver');
      expect(ref('choiceHeld').textContent).toBe('stale revision=1 current=2');
      expect(values()).toEqual({ agreement: false, plan: '', alerts: false });
      expect(oldNode.isConnected).toBe(false);
      expect(() => oldControl.checked.get()).toThrow('terminal disposal');
      const callbackOwner = x('agreement');
      await click('choiceReplaceOnRequest');
      await click('agreement');
      await vi.waitFor(() => expect(ref('choiceStatus').textContent).toContain('revision=3'));
      expect(values()).toEqual({ agreement: false, plan: '', alerts: false });
      expect(() => callbackOwner.checked.get()).toThrow('terminal disposal');
      await click('agreement');
      await click('plan-basic');
      await click('choiceSubmit');
      expect(ref('choiceSubmission').textContent).toContain('submitted=1');
      expect(ref('choiceSubmission').textContent).toContain('"agreement":true');
      expect(ref('choiceSubmission').textContent).toContain('"plan":"basic"');
      await view.destroy();
      expect(host.childElementCount).toBe(0);
    }, 30_000);
