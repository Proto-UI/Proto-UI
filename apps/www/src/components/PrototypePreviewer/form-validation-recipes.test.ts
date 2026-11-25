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
import { afterEach, expect, it, vi } from 'vitest';
import baseDemo from '../../content/docs/demo-base-form-validation.demo';
import shadcnDemo from '../../content/docs/demo-shadcn-form-validation.demo';
import brutalistDemo from '../../content/docs/demo-brutalist-form-validation.demo';
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
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
for (const [family, demo] of Object.entries({
  base: baseDemo,
  shadcn: shadcnDemo,
  brutalist: brutalistDemo,
}))
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${family}/${runtime} public Form retains canonical ownership, versioned validation and nested policy`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let api!: DemoRuntimeApi;
      const resolved: Array<{ requestId: unknown; accepted: unknown }> = [];
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          ...demo,
          setup(context) {
            api = context.api;
            return demo.setup?.({
              ...context,
              api: {
                ...context.api,
                call(ref, path, ...args) {
                  const accepted = context.api.call(ref, path, ...args);
                  if (ref === 'accountField' && path === 'resolveValidation')
                    resolved.push({ requestId: args[0], accepted });
                  return accepted;
                },
              },
            });
          },
        },
      });
      cleanups.push(() => view.destroy());
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
      const exposes = (name: string) => api.getExposes(name) as any;
      const values = () => exposes('form').getValues();
      const validity = () => exposes('accountField').getValidity();
      const resultReceipt = () => JSON.parse(ref('validationResults').textContent ?? 'null');
      const assertOldResults = (minimum: number) => {
        const receipt = resultReceipt();
        expect(receipt.kind).toBe('old-results');
        expect(receipt.results.length).toBeGreaterThanOrEqual(minimum);
        expect(receipt.before).toEqual(receipt.after);
        for (const result of receipt.results) {
          expect(typeof result.requestId).toBe('string');
          expect(result.accepted).toBe(false);
          expect(result.value).not.toBe('rejected');
          if (receipt.before.validity.pending)
            expect(result.requestId).not.toBe(receipt.before.latestRequest.requestId);
        }
        if (receipt.results.length)
          expect(
            receipt.results.map(
              ({ requestId, accepted }: { requestId: string; accepted: boolean }) => ({
                requestId,
                accepted,
              })
            )
          ).toEqual(resolved.slice(-receipt.results.length));
        return receipt;
      };
      const editor = () => {
        const root = ref('accountControl');
        return (
          root.matches('input')
            ? root
            : (root.querySelector('input') ?? root.shadowRoot?.querySelector('input'))
        ) as HTMLInputElement;
      };
      const click = async (name: string) => {
        ref(name).click();
        await flush();
      };
      const edit = async (value: string) => {
        await flush();
        editor().value = value;
        editor().dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            composed: true,
            data: value,
            inputType: 'insertText',
          })
        );
        await flush();
      };
      await vi.waitFor(() =>
        expect(values()).toEqual({
          account: 'ada',
          channels: ['email'],
          notes: 'Send a summary email after release.',
        })
      );
      expect(editor().getAttribute('aria-labelledby')).toBe(ref('accountLabel').id);
      expect(editor().getAttribute('aria-describedby')?.split(' ')).toContain(
        ref('accountHelp').id
      );
      expect(ref('outerGroup').getAttribute('aria-labelledby')).toBe(ref('outerLegend').id);
      expect(ref('innerGroup').getAttribute('aria-labelledby')).toBe(ref('innerLegend').id);
      expect(ref('allChannels').getAttribute('aria-checked')).toBe('mixed');

      await edit('grace');
      expect(values().account).toBe('grace');
      expect(editor().value).toBe('grace');
      expect(validity().pending).toBe(true);
      await click('toggleOwner');
      await edit('rejected');
      expect(editor().value).toBe('grace');
      expect(values().account).toBe('grace');
      // Generic Field's existing candidate-edit contract is unchanged. The
      // held validator sees the canonical owner value, never rejected text.
      expect(ref('validatorStatus').textContent).toContain('Pending check for "grace"');
      await click('toggleOwner');
      await edit('lin');
      // A real editor can deliver its change commit as focus moves to the
      // result button. The controlled report is queued; the click may finish
      // before that new validator request. Do not confuse the two receipts.
      editor().dispatchEvent(new Event('change', { bubbles: true }));
      await click('staleResult');
      const oldResults = assertOldResults(1);
      expect(oldResults.summary).toMatch(/^Stale responses: discarded(?:, discarded)*$/);
      expect(oldResults.before.validity.pending).toBe(true);
      // The queued, legitimate commit really ran after delivery; neither its
      // pending request nor the earlier actual false returns were suppressed.
      expect(ref('validatorStatus').textContent).toBe('Pending check for "lin" (2 queued)');
      expect(validity().pending).toBe(true);
      await click('rejectResult');
      expect(resultReceipt().results).toEqual([{ ...resolved.at(-1), value: 'lin' }]);
      expect(resultReceipt().results[0].accepted).toBe(true);
      expect(validity()).toMatchObject({ invalid: true, pending: false });
      expect(editor().getAttribute('aria-errormessage')).toBe(ref('accountError').id);
      expect(ref('accountError').textContent).toContain('This username is already taken.');
      // Deliver the request superseded by the queued change as well. This
      // leaves the next submission scenario with exactly its own two attempts.
      await click('staleResult');
      const afterCommit = assertOldResults(1);
      expect(afterCommit.summary).toBe('Stale responses: discarded');
      expect(validity()).toMatchObject({ invalid: true, pending: false });

      await click('submit');
      expect(exposes('form').pending.get()).toBe(true);
      const pendingText = ref('validatorStatus').textContent;
      // A new accepted attempt supersedes the old one; requestSubmit reports
      // acceptance, not completion (form-completion.v0.md).
      expect(api.call('form', 'requestSubmit')).toBe(true);
      await flush();
      expect(ref('validatorStatus').textContent).not.toBe(pendingText);
      await click('staleResult');
      expect(assertOldResults(1).summary).toBe('Stale responses: discarded');
      expect(exposes('form').pending.get()).toBe(true);
      await click('acceptResult');
      expect(ref('submissionStatus').textContent).toContain('Submitted (#1)');
      expect(ref('submissionStatus').textContent).toContain('"account":"lin"');
      expect(validity()).toMatchObject({ invalid: false, pending: false });
      expect(editor().getAttribute('aria-errormessage')).toBeNull();

      await click('submit');
      expect(exposes('form').pending.get()).toBe(true);
      await click('cancelSubmit');
      await click('acceptResult');
      expect(exposes('form').pending.get()).toBe(false);
      expect(ref('submissionStatus').textContent).toBe('Submission canceled.');
      await click('toggleReadOnly');
      expect(editor().readOnly).toBe(true);
      expect(values().account).toBe('lin');
      const notes = () => {
        const root = ref('notes');
        return (
          root.matches('textarea')
            ? root
            : (root.querySelector('textarea') ?? root.shadowRoot?.querySelector('textarea'))
        ) as HTMLTextAreaElement;
      };
      expect(notes().readOnly).toBe(true);
      await click('toggleReadOnly');
      notes().value = 'Edited\nmultiline';
      notes().dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: 'Edited\nmultiline' })
      );
      await flush();
      expect(values().notes).toBe('Edited\nmultiline');
      await click('toggleReadOnly');
      await click('toggleDisabled');
      expect(exposes('channelsField').disabled.get()).toBe(true);
      expect(exposes('notesField').disabled.get()).toBe(true);
      expect(values()).toEqual({ account: 'lin' });
      await click('sms');
      expect(exposes('channels').getValue()).toEqual(['email']);
      await click('toggleDisabled');
      await click('sms');
      expect(exposes('channels').getValue()).toEqual(['email', 'sms']);
      expect(ref('allChannels').getAttribute('aria-checked')).toBe('true');
      await click('reset');
      expect(values()).toEqual({
        account: 'ada',
        channels: ['email'],
        notes: 'Send a summary email after release.',
      });
      expect(editor().readOnly).toBe(true);
      expect(notes().value).toBe('Send a summary email after release.');
      expect(validity()).toMatchObject({ pending: false, status: 'unvalidated' });
      expect(ref('submissionStatus').textContent).toBe('Form reset.');

      await click('toggleReadOnly');
      await edit('retire');
      expect(validity().pending).toBe(true);
      const oldField = exposes('accountField');
      const oldButton = ref('acceptResult');
      const oldEditor = editor();
      await view.destroy();
      oldButton.click();
      oldEditor.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: 'late' })
      );
      expect(() => oldField.resolveValidation('retired-request', { invalid: false })).toThrow(
        'terminal disposal'
      );
      expect(host.childElementCount).toBe(0);
    }, 30_000);
