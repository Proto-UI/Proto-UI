import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { formRoot, formField } from '../src/form';
import { fieldControl } from '../src/field';
import { toastRoot, toastAction } from '../src/toast';
for (const p of [formRoot, formField, fieldControl, toastRoot, toastAction])
  AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const part = (name: string, props = {}): any => {
  const el = document.createElement('base-' + name);
  setElementProps(el, props);
  return el;
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it.each(['pending', 'submitted'])(
  'Form emits only the validated value when %s observers change the control',
  async (state) => {
    const root = part('form-root');
    const field = part('form-field', { name: 'name', required: true });
    const control = part('field-control', { defaultValue: 'validated' });
    field.append(control);
    root.append(field);
    const results: any[] = [];
    root.addEventListener('submit', (e: any) => results.push(e.detail));
    document.body.append(root);
    await flush();
    let changed = false;
    const off = root.getExposes()[state].subscribe((e: any) => {
      if (e.type !== 'next' || changed || e.next !== (state === 'submitted')) return;
      changed = true;
      const editor = control.shadowRoot?.querySelector('input') ?? control.querySelector('input');
      editor.value = 'unvalidated';
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          composed: true,
          inputType: 'insertText',
          data: 'unvalidated',
        })
      );
    });
    root.getExposes().requestSubmit();
    await flush();
    off();
    expect(changed).toBe(true);
    expect(root.getExposes().getValues()).toEqual({ name: 'unvalidated' });
    expect(results).toHaveLength(1);
    expect(results[0].values).toEqual({ name: 'validated' });
  }
);
it.each(['action', 'root'])(
  'Toast action callback may detach %s without an invalid anatomy query',
  async (target) => {
    const root = part('toast-root', { duration: 0 });
    const action = part('toast-action');
    root.append(action);
    document.body.append(root);
    await flush();
    let called = 0;
    action.addEventListener('action', () => {
      called++;
      (target === 'action' ? action : root).remove();
    });
    expect(() => action.click()).not.toThrow();
    await flush();
    expect(called).toBe(1);
  }
);

import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';

function runtimeHarness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  let actionCallback = () => {};
  const actions: string[] = [];
  function make(proto: any, parent: any = null) {
    const listeners = new Map<string, Set<any>>();
    const target = {
      addEventListener(type: string, fn: any) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: any) {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: Event) {
        for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
        return true;
      },
    } as unknown as EventTarget;
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({ duration: 0 }),
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: any) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: any) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: any) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: any) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (x: any) => {
              exposes = x;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string) => {
              actions.push(name);
              if (name === 'action') actionCallback();
            },
          ],
        ]);
      },
    });
    return {
      session,
      target,
      get exposes() {
        return exposes;
      },
    };
  }

  return {
    make,
    actions,
    setActionCallback(fn: () => void) {
      actionCallback = fn;
    },
  };
}

it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
  'Runtime Toast action tolerates synchronous %s from its application callback',
  async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const root = make(toastRoot),
      action = make(toastAction, root.target);
    await root.session.mount();
    await action.session.mount();
    setActionCallback(() => {
      if (operation === 'normal') return;
      void action.session[operation === 'remount' ? 'unmount' : operation]();
      if (operation === 'remount') void action.session.mount();
    });
    try {
      expect(() => action.target.dispatchEvent(new Event('press.commit'))).not.toThrow();
      expect(actions.filter((x) => x === 'action')).toHaveLength(1);
      expect(actions).toEqual(
        operation === 'normal' ? ['action', 'beforeLeave', 'openChange'] : ['action']
      );
      if (operation === 'unmount' || operation === 'remount') {
        await action.session.mount();
        setActionCallback(() => {});
        action.target.dispatchEvent(new Event('press.commit'));
        expect(actions).toEqual(['action', 'action', 'beforeLeave', 'openChange']);
      }
    } finally {
      await action.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['cancelSubmit', 'requestReset', 'requestSubmit', 'disable'] as const)(
  'Form completion yields to a synchronous %s from pending=false',
  async (operation) => {
    const root = part('form-root'),
      field = part('form-field', { name: 'name' }),
      control = part('field-control', { defaultValue: 'valid' });
    field.append(control);
    root.append(field);
    document.body.append(root);
    await flush();
    const results: any[] = [];
    root.addEventListener('submit', (e: any) => results.push(e.detail));
    let once = false;
    const off = root.getExposes().pending.subscribe((e: any) => {
      if (e.type !== 'next' || e.next !== false || once) return;
      once = true;
      if (operation === 'disable') setElementProps(root, { disabled: true });
      else root.getExposes()[operation]();
    });
    root.getExposes().requestSubmit();
    await flush();
    off();
    expect(once).toBe(true);
    if (operation === 'requestSubmit') {
      expect(results).toEqual([{ values: { name: 'valid' }, submissionId: 2 }]);
      expect(root.getExposes().submitted.get()).toBe(true);
    } else {
      expect(results).toEqual([]);
      expect(root.getExposes().submitted.get()).toBe(false);
    }
  }
);

it('Form terminal disposal from pending=false retires completion', async () => {
  const { make, actions } = runtimeHarness();
  const form = make(formRoot);
  await form.session.mount();
  let retired = false;
  form.exposes.pending.subscribe((e: any) => {
    if (e.type === 'next' && !e.next && !retired) {
      retired = true;
      void form.session.dispose();
    }
  });
  expect(() =>
    form.session.invokeInCallbackScope(() => form.exposes.requestSubmit())
  ).not.toThrow();
  expect(retired).toBe(true);
  expect(actions).not.toContain('submit');
  await form.session.dispose();
});
