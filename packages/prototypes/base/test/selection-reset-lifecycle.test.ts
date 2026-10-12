import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import { datePickerRoot, datePickerDay } from '../src/date-picker';
import { formRoot } from '../src/form';
import { FORM_FAMILY, FORM_CONTEXT } from '../src/form/shared';
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
  let actionCallback = (_name: string) => {};
  const actions: string[] = [];
  function make(proto: any, parent: any = null, props: any = {}) {
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
      getRawProps: () => props,
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
              if (
                name === 'valueChange' ||
                name === 'execute' ||
                name === 'openChange' ||
                name === 'validationRequest'
              )
                actionCallback(name);
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
    setActionCallback(fn: (name: string) => void) {
      actionCallback = fn;
    },
  };
}

it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
  'Date Picker host selection stops retired Day listeners after %s',
  async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const root = make(datePickerRoot, null, { defaultMonth: '2026-10', defaultOpen: true });
    const day = make(datePickerDay, root.target, { date: '2026-10-15' });
    await root.session.mount();
    await day.session.mount();
    setActionCallback((name) => {
      if (name !== 'valueChange' || operation === 'normal') return;
      void day.session[operation === 'dispose' ? 'dispose' : 'unmount']();
      void root.session[operation === 'dispose' ? 'dispose' : 'unmount']();
      if (operation === 'remount') {
        void root.session.mount();
        void day.session.mount();
      }
    });
    try {
      expect(() => day.target.dispatchEvent(new Event('press.commit'))).not.toThrow();
      expect(actions).toEqual(
        operation === 'normal' ? ['valueChange', 'openChange'] : ['valueChange']
      );
    } finally {
      await day.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
  'Form reset ends its cached Field traversal after %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    let retire = () => {},
      secondResets = 0;
    const firstProto = definePrototype({
      name: 'reset-first-field',
      setup(def) {
        def.anatomy.claim(FORM_FAMILY, { role: 'field' });
        const value = def.state.string('value', 'changed');
        def.expose.state('value', value);
        def.expose.method('__formReset', () => {
          value.set('initial', 'reset control');
          return true;
        });
      },
    });
    const secondProto = definePrototype({
      name: 'reset-second-field',
      setup(def) {
        def.anatomy.claim(FORM_FAMILY, { role: 'field' });
        def.expose.method('__formReset', () => {
          secondResets++;
          return true;
        });
      },
    });
    const form = make(formRoot),
      first = make(firstProto, form.target),
      second = make(secondProto, form.target);
    for (const part of [form, first, second]) await part.session.mount();
    first.exposes.value.subscribe((event: any) => {
      if (event.type === 'next') retire();
    });
    let retired = false;
    retire = () => {
      if (operation === 'normal') return;
      retired = true;
      void form.session[operation === 'dispose' ? 'dispose' : 'unmount']();
      if (operation === 'remount') void form.session.mount();
    };
    try {
      const result = form.session.invokeInCallbackScope(() => form.exposes.requestReset());
      expect(retired).toBe(operation !== 'normal');
      expect(result).toBe(operation === 'normal');
      expect(secondResets).toBe(operation === 'normal' ? 1 : 0);
      expect(actions).toEqual(operation === 'normal' ? ['reset'] : []);
    } finally {
      for (const part of [second, first, form]) await part.session.dispose();
    }
  }
);

for (const [slug, module] of Object.entries({ autocomplete, combobox, command }))
  it.each([
    'normal',
    'unmount',
    'dispose',
    'remount',
    'item-unmount',
    'item-dispose',
    'item-remount',
    'root-unmount',
    'root-dispose',
    'root-remount',
    'nested',
  ] as const)(`${slug} Item honors its selection callback lifetime: %s`, async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const family = (module as any)[slug.toUpperCase() + '_FAMILY'];
    let focused = 0;
    const inputProto = definePrototype({
      name: 'retirement-input-' + slug,
      setup(def) {
        def.anatomy.claim(family, { role: 'input' });
        def.expose.method('focusSelf', () => {
          focused++;
        });
      },
    });
    const contentProto = definePrototype({
      name: 'retirement-content-' + slug,
      setup(def) {
        def.anatomy.claim(family, { role: 'content' });
      },
    });
    const root = make((module as any)[slug + 'Root'], null, { defaultOpen: true });
    const input = make(inputProto, root.target),
      content = make(contentProto, root.target);
    const item = make((module as any)[slug + 'Item'], content.target, {
      value: 'pear',
      textValue: 'Pear',
    });
    for (const part of [root, input, content, item]) await part.session.mount();
    let once = false,
      nestedResult: unknown;
    setActionCallback((name) => {
      if (
        name !== (slug === 'command' ? 'execute' : 'valueChange') ||
        operation === 'normal' ||
        once
      )
        return;
      once = true;
      if (operation === 'nested') {
        nestedResult = root.exposes.select('pear');
        return;
      }
      if (!operation.startsWith('root-'))
        void item.session[operation.endsWith('dispose') ? 'dispose' : 'unmount']();
      if (!operation.startsWith('item-'))
        void root.session[operation.endsWith('dispose') ? 'dispose' : 'unmount']();
      if (operation.endsWith('remount')) {
        if (!operation.startsWith('item-')) void root.session.mount();
        if (!operation.startsWith('root-')) void item.session.mount();
      }
    });
    try {
      expect(() => item.target.dispatchEvent(new Event('press.commit'))).not.toThrow();
      if (operation === 'nested') expect(nestedResult).toBe(true);
      expect(actions).toEqual([
        slug === 'command' ? 'execute' : 'valueChange',
        ...(operation === 'nested' ? [slug === 'command' ? 'execute' : 'valueChange'] : []),
        ...(slug !== 'command' &&
        (operation === 'normal' || operation === 'nested' || operation.startsWith('item-'))
          ? ['openChange']
          : []),
        ...(operation === 'normal' || operation === 'nested' || operation.startsWith('root-')
          ? ['select']
          : []),
      ]);
      expect(focused).toBe(
        slug !== 'command' &&
          (operation === 'normal' || operation === 'nested' || operation.startsWith('item-'))
          ? 1
          : 0
      );
    } finally {
      for (const part of [item, content, input, root]) await part.session.dispose();
    }
  });

it.each([false, true])(
  'Form reset remains valid before first mount, retired=%s',
  async (retire) => {
    const { make, actions } = runtimeHarness();
    let reset = () => {};
    const fieldProto = definePrototype({
      name: 'detached-reset-field',
      setup(def) {
        def.anatomy.claim(FORM_FAMILY, { role: 'field' });
        def.expose.method('__formReset', () => {
          reset();
          return true;
        });
      },
    });
    const form = make(formRoot),
      field = make(fieldProto, form.target),
      second = make(fieldProto, form.target);
    let calls = 0;
    reset = () => {
      calls++;
      if (retire) void form.session.dispose();
    };
    try {
      expect(form.session.invokeInCallbackScope(() => form.exposes.requestReset())).toBe(!retire);
      expect(calls).toBe(retire ? 1 : 2);
      expect(actions).toEqual(retire ? [] : ['reset']);
    } finally {
      await second.session.dispose();
      await field.session.dispose();
      await form.session.dispose();
    }
  }
);

for (const method of ['requestSubmit', 'resetValidation'] as const)
  it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
    `Form ${method} stops the old Field traversal after %s`,
    async (operation) => {
      const { make, actions, setActionCallback } = runtimeHarness();
      const calls: number[] = [];
      const fields = [0, 1].map((index) =>
        definePrototype({
          name: 'form-callback-field-' + index,
          setup(def) {
            def.anatomy.claim(FORM_FAMILY, { role: 'field' });
            const dirty = def.state.bool('dirty', true);
            def.expose.state('dirty', dirty);
            def.expose.method('__formField', () => ({
              name: 'field-' + index,
              value: 'valid',
              disabled: false,
              available: true,
              implicitSubmit: false,
              validity: {
                status: 'valid',
                invalid: false,
                pending: false,
                dirty: false,
                touched: false,
                filled: true,
                focused: false,
                flags: [],
                errors: [],
              },
            }));
            def.expose.event('validationRequest', { payload: 'json' });
            let current: any;
            def.lifecycle.onCreated((run) => {
              current = run;
            });
            def.expose.method('validate', () => {
              calls.push(index);
              current.expose.emit('validationRequest', { value: 'valid', reason: 'manual' });
            });
            def.expose.method('resetValidation', () => {
              calls.push(index);
              dirty.set(false, 'validation reset');
            });
          },
        })
      );
      const form = make(formRoot),
        first = make(fields[0], form.target),
        second = make(fields[1], form.target);
      for (const part of [form, first, second]) await part.session.mount();
      let retired = false;
      const retire = () => {
        if (operation === 'normal' || retired) return;
        retired = true;
        void form.session[operation === 'dispose' ? 'dispose' : 'unmount']();
        if (operation === 'remount') void form.session.mount();
      };
      if (method === 'requestSubmit')
        setActionCallback((name) => {
          if (name === 'validationRequest') retire();
        });
      else
        first.exposes.dirty.subscribe((event: any) => {
          if (event.type === 'next') retire();
        });
      try {
        const result = form.session.invokeInCallbackScope(() => form.exposes[method]());
        if (method === 'requestSubmit') expect(result).toBe(true);
        expect(retired).toBe(operation !== 'normal');
        expect(calls).toEqual(operation === 'normal' ? [0, 1] : [0]);
        expect(actions.filter((name) => name === 'submit')).toHaveLength(
          method === 'requestSubmit' && operation === 'normal' ? 1 : 0
        );
      } finally {
        for (const part of [second, first, form]) await part.session.dispose();
      }
    }
  );

for (const [slug, module] of Object.entries({ autocomplete, combobox }))
  for (const initiallyOpen of [false, true])
    it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
      `${slug} Trigger focus stops retired open=${initiallyOpen} activation after %s`,
      async (operation) => {
        const { make, actions, setActionCallback } = runtimeHarness();
        const family = (module as any)[slug.toUpperCase() + '_FAMILY'];
        let focused = 0;
        const inputProto = definePrototype({
          name: 'trigger-focus-input-' + slug,
          setup(def) {
            def.anatomy.claim(family, { role: 'input' });
            def.expose.method('focusSelf', () => {
              focused++;
            });
          },
        });
        const root = make((module as any)[slug + 'Root'], null, { defaultOpen: initiallyOpen });
        const input = make(inputProto, root.target),
          trigger = make((module as any)[slug + 'Trigger'], root.target);
        for (const part of [root, input, trigger]) await part.session.mount();
        let retired = false;
        setActionCallback((name) => {
          if (name !== 'openChange' || operation === 'normal') return;
          retired = true;
          void trigger.session[operation === 'dispose' ? 'dispose' : 'unmount']();
          void root.session[operation === 'dispose' ? 'dispose' : 'unmount']();
          if (operation === 'remount') {
            void root.session.mount();
            void trigger.session.mount();
          }
        });
        try {
          expect(() => trigger.target.dispatchEvent(new Event('press.commit'))).not.toThrow();
          expect(retired).toBe(operation !== 'normal');
          expect(actions).toEqual(['openChange']);
          expect(focused).toBe(operation === 'normal' ? 1 : 0);
        } finally {
          for (const part of [trigger, input, root]) await part.session.dispose();
        }
      }
    );

it.each(['remount', 'nested'] as const)(
  'Form stops a superseded cancellation publication: %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    const form = make(formRoot);
    const fields = [0, 1].map((index) =>
      make(
        definePrototype({
          name: 'pending-cancel-field-' + index,
          setup(def) {
            def.anatomy.claim(FORM_FAMILY, { role: 'field' });
            const pending = def.state.bool('pending', true);
            def.expose.method('complete', () => pending.set(false, 'completed control'));
            def.expose.method('__formField', () => ({
              name: 'field-' + index,
              value: 'valid',
              disabled: false,
              available: true,
              implicitSubmit: false,
              validity: {
                status: 'valid',
                invalid: false,
                pending: pending.get(),
                dirty: false,
                touched: false,
                filled: true,
                focused: false,
                flags: [],
                errors: [],
              },
            }));
            def.expose.method('validate', () => {});
          },
        }),
        form.target
      )
    );
    let afterCallback = false,
      lateNotifications = 0,
      observed = false,
      nested: unknown;
    const observer = make(
      definePrototype({
        name: 'pending-cancel-observer',
        setup(def) {
          def.context.subscribe(FORM_CONTEXT, () => {
            if (afterCallback) lateNotifications++;
          });
        },
      }),
      form.target
    );
    for (const part of [form, ...fields, observer]) await part.session.mount();
    expect(form.session.invokeInCallbackScope(() => form.exposes.requestSubmit())).toBe(true);
    expect(form.exposes.pending.get()).toBe(true);
    form.exposes.pending.subscribe((e: any) => {
      if (e.type !== 'next' || e.next !== false || observed) return;
      observed = true;
      if (operation === 'remount') {
        void form.session.unmount();
        void form.session.mount();
      } else {
        for (const field of fields)
          field.session.invokeInCallbackScope(() => field.exposes.complete());
        nested = form.session.invokeInCallbackScope(() => form.exposes.requestSubmit());
      }
      afterCallback = true;
    });
    actions.length = 0;
    try {
      expect(form.session.invokeInCallbackScope(() => form.exposes.requestSubmit())).toBe(true);
      expect(observed).toBe(true);
      expect(lateNotifications).toBe(0);
      expect(actions).toEqual(operation === 'nested' ? ['submit'] : []);
      if (operation === 'nested') expect(nested).toBe(true);
    } finally {
      for (const part of [observer, ...fields.reverse(), form]) await part.session.dispose();
    }
  }
);
