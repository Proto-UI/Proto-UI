import { describe, expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import * as base from '../../../../prototypes/base/src/field';
import * as shadcn from '../../../../prototypes/shadcn/src/field';
import * as brutalist from '../../../../prototypes/brutalist/src/field';
import * as bootstrap from '../../../../prototypes/bootstrap-2-3-2/src/field';
import * as liquid from '../../../../prototypes/liquid-glass/src/field';
import type { FieldValidationRequest } from '../../../../prototypes/base/src/field';
export type FieldTree = {
  key: string;
  proto: Prototype<any>;
  props: Record<string, unknown>;
  children?: FieldTree[];
  onValidationRequest?: (request: FieldValidationRequest) => void;
};
export type FieldMount = {
  host: HTMLElement;
  exposes(key: string): Record<string, any>;
  flush(action?: () => void): Promise<void>;
  click(target: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
};
const families = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
let sequence = 0;
function recipe(
  family: Pick<
    typeof base,
    | 'fieldRoot'
    | 'fieldLabel'
    | 'fieldControl'
    | 'fieldDescription'
    | 'fieldError'
    | 'fieldValidity'
  >,
  props: Record<string, unknown> = {},
  controlProps: Record<string, unknown> = {}
) {
  const prefix = `field-test-${++sequence}`;
  const requests: FieldValidationRequest[] = [];
  const make = (
    role: string,
    props: Record<string, unknown> = {},
    children: FieldTree[] = []
  ): FieldTree => {
    const key = `${prefix}-${role}`,
      proto = (family as any)[`field${role[0].toUpperCase()}${role.slice(1)}`] as Prototype<any>;
    return {
      key,
      props,
      children,
      proto: definePrototype({
        name: key,
        modules: proto.modules,
        setup(def) {
          const render = proto.setup(def);
          return role === 'control'
            ? render
            : (r) => {
                const children = render ? render(r) : r.slot();
                return [r.el('span', key), ...(Array.isArray(children) ? children : [children])];
              };
        },
      }),
    };
  };
  const label = make('label'),
    control = make('control', controlProps),
    description = make('description'),
    error = make('error', { keepMounted: true }),
    validity = make('validity');
  const root = make('root', props, [label, control, description, error, validity]);
  root.onValidationRequest = (request) => requests.push(request);
  return { root, label, control, description, error, validity, requests };
}
function element(view: FieldMount, node: FieldTree): HTMLElement | null {
  const marker = [...view.host.querySelectorAll('span')].find((n) => n.textContent === node.key);
  return marker?.closest<HTMLElement>('[data-pui-root]') ?? null;
}
function editor(view: FieldMount): HTMLInputElement {
  return view.host.querySelector('input')!;
}
async function until(view: FieldMount, predicate: () => boolean) {
  for (let i = 0; i < 30; i++) {
    await view.flush();
    if (predicate()) return;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  throw Error('Field adapter did not settle.');
}
export function fieldAdapterConformance(
  name: string,
  mount: (tree: FieldTree[]) => Promise<FieldMount>
) {
  for (const [familyName, family] of Object.entries(families))
    describe(`Field ${name} ${familyName} contract`, () => {
      it('projects the same semantic name, help, invalidity and current error to one physical editor', async () => {
        const f = recipe(family, { required: true }),
          view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          expect(view.host.querySelectorAll('input')).toHaveLength(1);
          expect(editor(view).getAttribute('aria-labelledby')).toBe(element(view, f.label)!.id);
          expect(editor(view).getAttribute('aria-describedby')).toBe(
            element(view, f.description)!.id
          );
          expect(editor(view).required).toBe(true);
          await view.flush(() => view.exposes(f.root.key).validate());
          expect(editor(view).getAttribute('aria-invalid')).toBe('true');
          expect(editor(view).getAttribute('aria-errormessage')).toBe(element(view, f.error)!.id);
          await view.flush(() => {
            editor(view).value = 'valid';
            editor(view).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            view.exposes(f.root.key).validate();
          });
          expect(editor(view).getAttribute('aria-invalid')).toBe('false');
          expect(editor(view).hasAttribute('aria-errormessage')).toBe(false);
          expect(element(view, f.error)!.getAttribute('aria-hidden')).toBe('true');
        } finally {
          await view.unmount();
        }
      });
      it('controlled owner rejection and readonly/disabled changes retain canonical values', async () => {
        const f = recipe(
            family,
            { externalValidation: true, validationMode: 'manual' },
            { value: 'owned' }
          ),
          view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          await view.flush(() => {
            editor(view).value = 'attempt';
            editor(view).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
          });
          expect(editor(view).value).toBe('owned');
          expect(view.exposes(f.root.key).dirty.get()).toBe(false);
          await view.flush(() => view.exposes(f.root.key).validate());
          expect(f.requests.at(-1)?.value).toBe('owned');
          const id = f.requests.at(-1)!.requestId;
          await view.flush(() => {
            f.root.props = { externalValidation: true, readOnly: true };
          });
          expect(editor(view).readOnly).toBe(true);
          expect(editor(view).disabled).toBe(false);
          expect(view.exposes(f.root.key).resolveValidation(id, { invalid: true })).toBe(false);
          await view.flush(() => {
            f.root.props = { disabled: true };
          });
          expect(editor(view).disabled).toBe(true);
          expect(view.exposes(f.root.key).validate()).toBeNull();
          await view.flush(() => {
            f.root.props = {};
          });
          expect(editor(view).disabled).toBe(false);
        } finally {
          await view.unmount();
        }
      });
      it('exposes a consumer-owned async lease with stale, canceled and repeated-result negative controls', async () => {
        const f = recipe(family, { externalValidation: true }, { defaultValue: 'first' }),
          view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          let first: string | null = null,
            second: string | null = null;
          await view.flush(() => {
            first = view.exposes(f.root.key).validate();
            second = view.exposes(f.root.key).validate();
          });
          expect(f.requests).toHaveLength(2);
          await view.flush(() => {
            expect(view.exposes(f.root.key).resolveValidation(first, { invalid: true })).toBe(
              false
            );
            expect(
              view
                .exposes(f.root.key)
                .resolveValidation(second, { invalid: true, errors: ['Taken'] })
            ).toBe(true);
          });
          expect(editor(view).getAttribute('aria-invalid')).toBe('true');
          expect(view.exposes(f.validity.key).getValidity().errors).toEqual(['Taken']);
          expect(view.exposes(f.root.key).resolveValidation(second, { invalid: false })).toBe(
            false
          );
          await view.flush(() => {
            const canceled = view.exposes(f.root.key).validate();
            view.exposes(f.root.key).cancelValidation();
            expect(view.exposes(f.root.key).resolveValidation(canceled, { invalid: false })).toBe(
              false
            );
          });
          expect(view.exposes(f.root.key).pending.get()).toBe(false);
        } finally {
          await view.unmount();
        }
      });
      it('invalidates control-local readonly on both edges and rejects sparse results before spending the lease', async () => {
        const f = recipe(family, { externalValidation: true }, { defaultValue: 'same' });
        const view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          const root = view.exposes(f.root.key),
            control = view.exposes(f.control.key);
          let editableRequest: string | null = null,
            readonlyRequest: string | null = null;
          await view.flush(() => {
            editableRequest = root.validate();
          });
          await view.flush(() => {
            f.control.props = { defaultValue: 'same', readOnly: true };
          });
          expect(root.resolveValidation(editableRequest, { invalid: true })).toBe(false);
          await view.flush(() => {
            readonlyRequest = root.validate();
          });
          expect(readonlyRequest).not.toBeNull();
          await view.flush(() => {
            f.control.props = { defaultValue: 'same', readOnly: false };
          });
          expect(editor(view).readOnly).toBe(false);
          expect(root.resolveValidation(readonlyRequest, { invalid: true })).toBe(false);
          let current: string | null = null;
          await view.flush(() => {
            current = root.validate();
          });
          const before = root.getValidity();
          expect(control.reportField({ value: Array(1) })).toBe(false);
          expect(root.resolveValidation(current, { invalid: true, errors: Array(1) })).toBe(false);
          expect(root.getValidity()).toEqual(before);
          await view.flush(() => {
            expect(root.resolveValidation(current, { invalid: true, errors: ['Current'] })).toBe(
              true
            );
          });
          expect(root.getValidity().errors).toEqual(['Current']);
        } finally {
          await view.unmount();
        }
      });
      it('reports change-only canonical commits and revokes old validation', async () => {
        const f = recipe(
          family,
          { externalValidation: true, validationMode: 'manual' },
          { defaultValue: 'initial' }
        );
        const view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          const root = view.exposes(f.root.key);
          let old: string | null = null;
          await view.flush(() => {
            old = root.validate();
          });
          await view.flush(() => {
            editor(view).value = 'change-only';
            editor(view).dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          });
          expect(view.exposes(f.control.key).value.get()).toBe('change-only');
          expect(root.dirty.get()).toBe(true);
          expect(root.resolveValidation(old, { invalid: true })).toBe(false);
          await view.flush(() => root.validate());
          expect(f.requests.at(-1)?.value).toBe('change-only');
        } finally {
          await view.unmount();
        }
      });
      it('rejects inherited validation result properties without consuming the pending lease', async () => {
        const f = recipe(family, { externalValidation: true }, { defaultValue: 'accepted' });
        const view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          const root = view.exposes(f.root.key);
          let request: string | null = null;
          await view.flush(() => {
            request = root.validate();
          });
          expect(root.resolveValidation(request, Object.create({ invalid: true }))).toBe(false);
          expect(root.pending.get()).toBe(true);
          await view.flush(() =>
            expect(root.resolveValidation(request, { invalid: false })).toBe(true)
          );
        } finally {
          await view.unmount();
        }
      });
      it('label activation and Tab focus stay on the editor; Root and Label add no focus stop', async () => {
        const f = recipe(family, { required: true }),
          view = await mount([f.root]);
        try {
          await until(view, () => !!editor(view));
          expect(element(view, f.root)!.hasAttribute('tabindex')).toBe(false);
          expect(element(view, f.label)!.hasAttribute('tabindex')).toBe(false);
          await view.click(element(view, f.label)!);
          await view.flush();
          expect(view.exposes(f.control.key).focused.get()).toBe(true);
          await view.flush(() => editor(view).blur());
          expect(view.exposes(f.root.key).touched.get()).toBe(true);
          expect(view.exposes(f.root.key).invalid.get()).toBe(true);
        } finally {
          await view.unmount();
        }
      });
    });
}
