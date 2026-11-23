import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
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
import {
  fieldRoot,
  fieldControl,
  fieldTextarea,
  fieldCheckbox,
  fieldSwitch,
  fieldRadioGroup,
  FIELD_CONTEXT,
} from '../src/field';
import { radioGroupRoot, radioGroupItem, RADIO_GROUP_FAMILY } from '../src/radio-group';
import { checkboxRoot } from '../src/checkbox';
import { formRoot, formField } from '../src/form';
import { toggleGroupRoot, toggleGroupItem } from '../src/toggle-group';
import { TOGGLE_GROUP_CONTEXT } from '../src/toggle-group/shared';
import {
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-text-control';
import { numberFieldRoot } from '../src/number-field';
import { dataTableRoot, DATA_TABLE_CONTEXT } from '../src/data-table';
import { calendarRoot, CALENDAR_CONTEXT } from '../src/calendar';
import { toastRoot } from '../src/toast';
import { TOAST_CONTEXT } from '../src/toast/shared';
import { checkboxGroupRoot } from '../src/checkbox-group';
import { CHECKBOX_GROUP_FAMILY } from '../src/checkbox-group/shared';
import { carouselRoot, CAROUSEL_FAMILY } from '../src/carousel';
import { accordionRoot } from '../src/accordion';
import { ACCORDION_FAMILY } from '../src/accordion/shared';
import { contextMenuRoot } from '../src/context-menu';
import { treeRoot, TREE_FAMILY } from '../src/tree';
import { inputOtpRoot } from '../src/input-otp';
import { menubarRoot, menubarTrigger, MENUBAR_FAMILY } from '../src/menubar';
function runtimeHarness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  let actionCallback = (_name: string, _payload?: any) => {};
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
    let exposes: any,
      connection: any,
      textValue = '';
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_c, s) => s?.done(),
      // This fixture has no separate renderer withdrawal; Runtime still binds
      // the returned operation to its actual mount epoch and present intent.
      viewOperations: { capture: () => ({ isCurrent: () => true }) },
      onRuntimeReady(w) {
        if (proto === fieldControl || proto === fieldTextarea)
          w.attach('text-control', [
            [
              TEXT_CONTROL_HOST_CAP,
              {
                attach(c: any) {
                  connection = c;
                  textValue = c.patch.value ?? c.patch.defaultValue ?? '';
                  return {
                    update(patch: any) {
                      if (typeof patch.value === 'string') textValue = patch.value;
                    },
                    snapshot: () => ({ value: textValue, composing: false }),
                    dispose() {},
                  };
                },
              },
            ],
            [
              TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
              (fn: () => void) => session.invokeInCallbackScope(fn),
            ],
          ]);
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
            (name: string, payload: any) => {
              actions.push(name);
              actionCallback(name, payload);
            },
          ],
        ]);
      },
    });
    return {
      session,
      target,
      input(value: string, composing = true) {
        textValue = value;
        connection.onEvent({
          type: 'input',
          value,
          composing,
          data: 'x',
          inputType: 'insertText',
        });
      },
      composition(type: 'compositionstart' | 'compositionend', value: string) {
        textValue = value;
        connection.onEvent({
          type,
          value,
          composing: type === 'compositionstart',
          data: value,
          inputType: null,
        });
      },
      get exposes() {
        return exposes;
      },
    };
  }

  return {
    make,
    actions,
    setActionCallback(fn: (name: string, payload?: any) => void) {
      actionCallback = fn;
    },
  };
}

it.each(['normal', 'owner', 'owner-round-trip', 'nested-reset', 'dispose'] as const)(
  'FieldSwitch reset preserves the entry lease during preview teardown: %s',
  async (boundary) => {
    const h = runtimeHarness();
    const control = h.make(fieldSwitch, null, { checked: false });
    let off = () => {},
      fired = false,
      disposed: Promise<void> | undefined;
    const proposals: boolean[] = [];
    try {
      await control.session.mount();
      h.setActionCallback((name, detail) => {
        if (name !== 'checkedChange') return;
        proposals.push(detail.checked);
        control.session.controller.applyRawProps({ checked: detail.checked });
      });
      control.session.invokeInCallbackScope(() =>
        control.target.dispatchEvent(new Event('pointer.down'))
      );
      expect(control.exposes.pressed.get()).toBe(true);
      off = control.exposes.pressed.subscribe((event: { next: boolean }) => {
        if (event.next !== false || fired) return;
        fired = true;
        if (boundary === 'owner' || boundary === 'owner-round-trip') {
          control.session.controller.applyRawProps({ checked: true });
          if (boundary === 'owner-round-trip')
            control.session.controller.applyRawProps({ checked: false });
        } else if (boundary === 'nested-reset') control.exposes.resetValue();
        else if (boundary === 'dispose') disposed = control.session.dispose();
      });
      expect(() =>
        control.session.invokeInCallbackScope(() => control.exposes.resetValue())
      ).not.toThrow();
      expect(fired).toBe(true);
      expect(proposals).toEqual(
        boundary === 'normal' || boundary === 'nested-reset' ? [false] : []
      );
      if (boundary !== 'dispose') expect(control.exposes.checked.get()).toBe(boundary === 'owner');
      await disposed;
    } finally {
      off();
      await control.session.dispose();
    }
  }
);

it.each(['unmount', 'dispose', 'remount', 'owner', 'owner-round-trip'] as const)(
  'Radio no-op focus notification retires after focused subscriber %s',
  async (boundary) => {
    const h = runtimeHarness();
    const root = h.make(radioGroupRoot, null, { value: 'a' });
    // An independently authored legal owned item exposes its portable focus fact;
    // this exercises Root callback ordering without claiming native host focus.
    const item = h.make(
      definePrototype({
        name: 'test-owned-radio-focus-fact',
        setup(def) {
          def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'item' });
          const focused = def.state.bool('focused', false);
          def.expose.state('focused', focused);
          def.expose.method('markFocused', () => focused.set(true));
          def.expose.method('__collectionItem', () => ({
            instanceId: 'owned-focus-item',
            value: 'a',
            disabled: false,
          }));
        },
      }),
      root.target
    );
    let off = () => {},
      fired = false;
    const pending: Promise<void>[] = [];
    try {
      await root.session.mount();
      await item.session.mount();
      item.session.invokeInCallbackScope(() => item.exposes.markFocused());
      off = root.exposes.focused.subscribe((event: { next: boolean }) => {
        if (!event.next || fired) return;
        fired = true;
        if (boundary === 'owner' || boundary === 'owner-round-trip') {
          root.session.controller.applyRawProps({ value: 'b' });
          if (boundary === 'owner-round-trip')
            root.session.controller.applyRawProps({ value: 'a' });
        } else {
          pending.push(root.session[boundary === 'dispose' ? 'dispose' : 'unmount']());
          if (boundary === 'remount') pending.push(root.session.mount());
        }
      });
      expect(() =>
        root.session.invokeInCallbackScope(() => root.exposes.requestValue('a'))
      ).not.toThrow();
      expect(fired).toBe(true);
      expect(h.actions).not.toContain('valueChange');
      await Promise.all(pending);
      if (boundary === 'owner') expect(root.exposes.value.get()).toBe('b');
      if (boundary === 'owner-round-trip') expect(root.exposes.value.get()).toBe('a');
    } finally {
      off();
      await item.session.dispose();
      await root.session.dispose();
    }
  }
);

for (const proto of [checkboxRoot, fieldCheckbox])
  it.each(['confirm-mixed', 'new-checked', 'owner-round-trip'] as const)(
    `${proto.name} mixed callback respects newer checked ownership: %s`,
    async (mode) => {
      const h = runtimeHarness();
      const control = h.make(proto, null, { checked: false, indeterminate: true });
      const proposals: boolean[] = [];
      try {
        await control.session.mount();
        h.setActionCallback((name, detail) => {
          if (name === 'indeterminateChange') {
            control.session.controller.applyRawProps({
              checked: mode !== 'confirm-mixed',
              indeterminate: false,
            });
            if (mode === 'owner-round-trip')
              control.session.controller.applyRawProps({ checked: false, indeterminate: false });
          }
          if (name === 'checkedChange') {
            proposals.push(detail.checked);
            control.session.controller.applyRawProps({
              checked: detail.checked,
              indeterminate: false,
            });
          }
        });
        control.session.invokeInCallbackScope(() =>
          control.target.dispatchEvent(new Event('press.commit'))
        );
        expect(control.exposes.checked.get()).toBe(mode !== 'owner-round-trip');
        expect(control.exposes.indeterminate.get()).toBe(false);
        expect(proposals).toEqual(mode === 'confirm-mixed' ? [true] : []);
      } finally {
        await control.session.dispose();
      }
    }
  );

it.each(['reset', 'unmount', 'dispose', 'remount'] as const)(
  'FieldSwitch reset retires continuation after controlled callback %s',
  async (boundary) => {
    const h = runtimeHarness();
    const field = h.make(fieldRoot, null, { validationMode: 'onChange', externalValidation: true });
    const control = h.make(fieldSwitch, field.target, { checked: false });
    const pending: Promise<void>[] = [];
    let retired = false;
    try {
      await field.session.mount();
      await control.session.mount();
      control.session.controller.applyRawProps({ checked: true });
      h.setActionCallback((name) => {
        if (name !== 'checkedChange' || retired) return;
        retired = true;
        if (boundary === 'reset') control.exposes.resetValue();
        else {
          pending.push(control.session[boundary === 'dispose' ? 'dispose' : 'unmount']());
          if (boundary === 'remount') pending.push(control.session.mount());
        }
      });
      expect(() =>
        control.session.invokeInCallbackScope(() => control.exposes.resetValue())
      ).not.toThrow();
      expect(retired).toBe(true);
      await Promise.all(pending);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(h.actions.filter((name) => name === 'checkedChange')).toHaveLength(
        boundary === 'reset' ? 2 : 1
      );
      expect(h.actions).not.toContain('validationRequest');
      if (boundary === 'remount' || boundary === 'reset') {
        expect(control.exposes.checked.get()).toBe(true);
        expect(control.exposes.__fieldSnapshot()).toMatchObject({ active: true, value: true });
      }
    } finally {
      h.setActionCallback(() => {});
      await control.session.dispose();
      await field.session.dispose();
    }
  }
);

it.each([radioGroupRoot, fieldRadioGroup])(
  '$name reconciles current controlled props on reconnect without replacing its reset baseline',
  async (proto) => {
    const h = runtimeHarness();
    const control = h.make(proto, null, { value: 'a' });
    const proposals: unknown[] = [];
    try {
      await control.session.mount();
      await control.session.unmount();
      control.session.controller.applyRawProps({ value: 'b' });
      await control.session.mount();
      expect(control.exposes.value.get()).toBe('b');
      h.setActionCallback((name, payload) => {
        if (name === 'valueChange') proposals.push(payload.value);
      });
      control.session.invokeInCallbackScope(() => control.exposes.resetValue());
      expect(proposals).toEqual(['a']);
      expect(control.exposes.value.get()).toBe('b');
      await control.session.unmount();
      control.session.controller.applyRawProps({ defaultValue: 'c' });
      await control.session.mount();
      expect(control.exposes.value.get()).toBe('b');
      control.session.invokeInCallbackScope(() => control.exposes.resetValue());
      expect(control.exposes.value.get()).toBe('a');
    } finally {
      await control.session.dispose();
    }
  }
);

for (const kind of ['checkbox', 'radio'] as const)
  it.each(['reset', 'unmount', 'dispose', 'remount'] as const)(
    `Field ${kind} retires an old choice proposal after callback %s`,
    async (boundary) => {
      const h = runtimeHarness();
      const root = h.make(fieldRoot, null, {
        validationMode: 'onChange',
        externalValidation: true,
      });
      const control = h.make(
        kind === 'checkbox' ? fieldCheckbox : fieldRadioGroup,
        root.target,
        kind === 'checkbox' ? { checked: false } : { value: 'a' }
      );
      const items =
        kind === 'radio'
          ? ['a', 'b'].map((value) => h.make(radioGroupItem, control.target, { value }))
          : [];
      const all = [root, control, ...items];
      let retired = false;
      const pending: Promise<void>[] = [];
      const event = kind === 'checkbox' ? 'checkedChange' : 'valueChange';
      try {
        for (const item of all) await item.session.mount();
        h.setActionCallback((name) => {
          if (name !== event || retired) return;
          retired = true;
          if (boundary === 'reset') control.exposes.resetValue();
          else {
            pending.push(control.session[boundary === 'dispose' ? 'dispose' : 'unmount']());
            if (boundary === 'remount') pending.push(control.session.mount());
          }
        });
        const request = () =>
          kind === 'checkbox'
            ? control.target.dispatchEvent(new Event('press.commit'))
            : control.exposes.requestValue('b');
        expect(() => control.session.invokeInCallbackScope(request)).not.toThrow();
        expect(retired).toBe(true);
        await Promise.all(pending);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(h.actions.filter((name) => name === event)).toHaveLength(
          boundary === 'reset' ? 2 : 1
        );
        expect(h.actions).not.toContain('validationRequest');
        if (boundary === 'remount') {
          expect(control.exposes.__fieldSnapshot()).toMatchObject({
            active: true,
            value: kind === 'checkbox' ? false : 'a',
          });
          h.setActionCallback(() => {});
          expect(() => control.session.invokeInCallbackScope(request)).not.toThrow();
          expect(h.actions.filter((name) => name === event)).toHaveLength(2);
        }
      } finally {
        h.setActionCallback(() => {});
        for (const item of all.reverse()) await item.session.dispose();
      }
    }
  );

it('Form reset stops the retired Field continuation after its controlled Checkbox callback disposes it', async () => {
  const h = runtimeHarness();
  const form = h.make(formRoot),
    field = h.make(formField, form.target, { name: 'choice' });
  const control = h.make(fieldCheckbox, field.target, { checked: false });
  let retired: Promise<void> | undefined;
  try {
    for (const item of [form, field, control]) await item.session.mount();
    h.setActionCallback((name) => {
      if (name === 'checkedChange') retired = field.session.dispose();
    });
    expect(() =>
      form.session.invokeInCallbackScope(() => form.exposes.requestReset())
    ).not.toThrow();
    expect(retired).toBeDefined();
    await retired;
    expect(form.exposes.getValues()).toEqual({});
  } finally {
    h.setActionCallback(() => {});
    for (const item of [control, field, form]) await item.session.dispose();
  }
});

it.each([fieldControl, fieldTextarea])(
  '$name reset stops after its controlled callback synchronously disposes the actual Runtime',
  async (proto) => {
    const h = runtimeHarness();
    const root = h.make(fieldRoot);
    const control = h.make(proto, root.target, { value: 'owner' });
    let disposed: Promise<void> | undefined;
    try {
      await root.session.mount();
      await control.session.mount();
      h.setActionCallback((name) => {
        if (name === 'valueChange') disposed = control.session.dispose();
      });
      expect(() =>
        control.session.invokeInCallbackScope(() => control.exposes.resetValue())
      ).not.toThrow();
      expect(disposed).toBeDefined();
      await disposed;
      expect(h.actions).toEqual(['valueChange']);
    } finally {
      await control.session.dispose();
      await root.session.dispose();
    }
  }
);

for (const proto of [fieldControl, fieldTextarea])
  it.each(['reset-proposal', 'composition-state'] as const)(
    `${proto.name} reset preserves a newer composition started from %s`,
    async (boundary) => {
      const h = runtimeHarness();
      const root = h.make(fieldRoot, null, {
        externalValidation: true,
        validationMode: 'onChange',
      });
      const control = h.make(proto, root.target, { value: 'owner' });
      let started = false;
      let stop: (() => void) | undefined;
      const beginNewComposition = () => {
        if (started) return;
        started = true;
        control.composition('compositionstart', 'new candidate');
      };
      try {
        await root.session.mount();
        await control.session.mount();
        control.composition('compositionstart', 'old candidate');
        if (boundary === 'reset-proposal')
          h.setActionCallback((name) => {
            if (name === 'valueChange') beginNewComposition();
          });
        else
          stop = control.exposes.composing.subscribe((event: any) => {
            if (event.type === 'next' && !event.next) beginNewComposition();
          });
        h.actions.length = 0;
        control.session.invokeInCallbackScope(() =>
          expect(control.exposes.resetValue()).toBe(false)
        );
        expect(started).toBe(true);
        expect(control.exposes.composing.get()).toBe(true);
        expect(control.exposes.__fieldSnapshot()).toMatchObject({
          value: 'owner',
          composing: true,
          active: true,
        });
        root.session.invokeInCallbackScope(() => expect(root.exposes.validate()).toBeNull());
        expect(h.actions).not.toContain('validationRequest');
        expect(h.actions).not.toContain('compositionEnd');
      } finally {
        stop?.();
        h.setActionCallback(() => {});
        await control.session.dispose();
        await root.session.dispose();
      }
    }
  );

it.each([fieldControl, fieldTextarea])(
  '$name retires the Field composition snapshot and allows validation after rejoining',
  async (proto) => {
    const { make, actions } = runtimeHarness();
    const root = make(fieldRoot, null, { externalValidation: true, validationMode: 'manual' });
    const control = make(proto, root.target, { defaultValue: 'seed' });
    try {
      await root.session.mount();
      await control.session.mount();
      control.input('candidate', true);
      expect(control.exposes.composing.get()).toBe(true);
      root.session.invokeInCallbackScope(() => {
        expect(root.exposes.validate()).toBeNull();
      });
      actions.length = 0;

      await control.session.unmount();
      expect(control.exposes.__fieldSnapshot()).toMatchObject({
        value: 'candidate',
        composing: false,
        active: false,
      });
      expect(control.exposes.composing.get()).toBe(false);
      await control.session.mount();
      expect(control.exposes.__fieldSnapshot()).toMatchObject({
        value: 'candidate',
        composing: false,
        active: true,
      });
      expect(actions).not.toContain('compositionEnd');

      root.session.invokeInCallbackScope(() => {
        const request = root.exposes.validate();
        expect(typeof request).toBe('string');
        expect(root.exposes.resolveValidation(request, { invalid: false })).toBe(true);
      });
      expect(actions.filter((name) => name === 'validationRequest')).toHaveLength(1);
    } finally {
      await control.session.dispose();
      await root.session.dispose();
    }
  }
);

for (const proto of [fieldControl, fieldTextarea])
  it.each(['compositionstart', 'compositionend'] as const)(
    `${proto.name} does not publish an old %s after a composing observer replaces the view`,
    async (type) => {
      const { make, actions } = runtimeHarness();
      const root = make(fieldRoot);
      const control = make(proto, root.target, { defaultValue: 'seed' });
      const transitions: Promise<void>[] = [];
      let stop: (() => void) | undefined;
      let armed = false;
      try {
        await root.session.mount();
        await control.session.mount();
        if (type === 'compositionend') control.input('candidate', true);
        actions.length = 0;
        stop = control.exposes.composing.subscribe((event: any) => {
          if (!armed || event.type !== 'next') return;
          armed = false;
          transitions.push(control.session.unmount());
          transitions.push(control.session.mount());
          control.input('replacement', false);
        });
        armed = true;
        control.composition(type, 'old candidate');
        await Promise.all(transitions);
        expect(transitions).toHaveLength(2);
        expect(control.exposes.composing.get()).toBe(false);
        expect(control.exposes.value.get()).toBe('replacement');
        expect(control.exposes.__fieldSnapshot()).toMatchObject({
          value: 'replacement',
          composing: false,
          active: true,
        });
        expect(
          actions.filter((name) => name === 'compositionStart' || name === 'compositionEnd')
        ).toEqual([]);
      } finally {
        armed = false;
        stop?.();
        await Promise.all(transitions);
        await control.session.dispose();
        await root.session.dispose();
      }
    }
  );

const cases = [
  {
    name: 'Number Field value request',
    proto: numberFieldRoot,
    state: 'value',
    request: (x: any) => x.requestValue(2),
    event: 'valueChange',
  },
  {
    name: 'Number Field commit',
    proto: numberFieldRoot,
    state: null,
    // A commit cannot interrupt composition. A controlled, unaccepted draft
    // leaves the request pending until commit without claiming an active IME.
    props: { value: 0 },
    prepare: (x: any) => x.requestInput('2', false),
    request: (x: any) => x.commitValue(),
    event: 'valueCommit',
    callback: 'valueChange',
  },
  {
    name: 'Data Table sort',
    proto: dataTableRoot,
    context: DATA_TABLE_CONTEXT,
    request: (x: any) => x.requestSort('name'),
    event: 'sortChange',
  },
  {
    name: 'Calendar month',
    proto: calendarRoot,
    props: { defaultMonth: '2026-10' },
    state: 'month',
    request: (x: any) => x.requestMonth('2026-11'),
    event: 'monthChange',
  },
  {
    name: 'Calendar value',
    proto: calendarRoot,
    props: { defaultMonth: '2026-01', defaultValue: '2026-01-10' },
    state: 'value',
    request: (x: any) => x.requestValue('2026-02-10'),
    event: 'valueChange',
  },
  {
    name: 'Calendar value Context',
    proto: calendarRoot,
    props: { defaultMonth: '2026-01', defaultValue: '2026-01-10' },
    context: CALENDAR_CONTEXT,
    request: (x: any) => x.requestValue('2026-02-10'),
    event: 'valueChange',
  },
  {
    name: 'Calendar value month completion',
    proto: calendarRoot,
    props: { defaultMonth: '2026-01', defaultValue: '2026-01-10' },
    request: (x: any) => x.requestValue('2026-02-10'),
    event: 'valueChange',
    callback: 'monthChange',
  },
  {
    name: 'Toast open',
    proto: toastRoot,
    props: { defaultOpen: true, duration: 0 },
    state: 'open',
    request: (x: any) => x.close(),
    event: 'openChange',
  },
  {
    name: 'Checkbox Group aggregate',
    proto: checkboxGroupRoot,
    state: 'checked',
    request: (x: any) => x.requestToggle('one'),
    event: 'valueChange',
    family: CHECKBOX_GROUP_FAMILY,
    role: 'item',
    part: (def: any) => def.expose.method('__groupItem', () => ({ value: 'one', disabled: false })),
  },
  {
    name: 'Carousel index',
    proto: carouselRoot,
    state: 'index',
    request: (x: any) => x.requestIndex(1),
    event: 'indexChange',
    family: CAROUSEL_FAMILY,
    role: 'slide',
    count: 2,
  },
  {
    name: 'Accordion open count',
    proto: accordionRoot,
    state: 'openCount',
    request: (x: any) => x.requestOpen('one', true),
    event: 'openChange',
    family: ACCORDION_FAMILY,
    role: 'item',
    part: (def: any) => {
      def.expose.state('value', def.state.string('value', 'one'));
      def.expose.state('disabled', def.state.bool('disabled', false));
    },
  },
  {
    name: 'Context Menu open',
    proto: contextMenuRoot,
    state: 'open',
    request: (x: any) =>
      x.requestOpen({ open: true, reason: 'programmatic', focusReason: 'programmatic' }),
    event: 'openChange',
  },
  {
    name: 'Tree selection',
    proto: treeRoot,
    state: 'value',
    request: (x: any) => x.requestValue('one'),
    event: 'valueChange',
    family: TREE_FAMILY,
    role: 'item',
    part: (def: any) => def.expose.method('getNode', () => ({ key: 'one' })),
  },
  {
    name: 'OTP value',
    proto: inputOtpRoot,
    state: 'value',
    request: (x: any) => x.requestValue('123456'),
    event: 'valueChange',
  },
];
for (const test of cases)
  it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
    `${test.name} ends its old notification after %s`,
    async (operation) => {
      const { make, actions, setActionCallback } = runtimeHarness();
      const root = make(test.proto, null, test.props ?? {});
      const parts: any[] = [root];
      let armed = false,
        observed = 0;
      const retire = () => {
        if (!armed) return;
        observed++;
        armed = false;
        if (operation === 'normal') return;
        void root.session[operation === 'dispose' ? 'dispose' : 'unmount']();
        if (operation === 'remount') void root.session.mount();
      };
      if (test.family) {
        const part = definePrototype({
          name: 'notification-' + test.name,
          setup(def) {
            def.anatomy.claim(test.family, { role: test.role! });
            test.part?.(def);
          },
        });
        for (let i = 0; i < (test.count ?? 1); i++) parts.push(make(part, root.target));
      }
      if (test.context)
        parts.push(
          make(
            definePrototype({
              name: 'notification-observer',
              setup(def) {
                def.context.subscribe(test.context, retire);
              },
            }),
            root.target
          )
        );
      for (const part of parts) await part.session.mount();
      if (test.state)
        root.exposes[test.state].subscribe((e: any) => {
          if (e.type === 'next') retire();
        });
      if (test.callback)
        setActionCallback((name) => {
          if (name === test.callback) retire();
        });
      if (test.prepare) root.session.invokeInCallbackScope(() => test.prepare!(root.exposes));
      actions.length = 0;
      armed = true;
      try {
        expect(() =>
          root.session.invokeInCallbackScope(() => test.request(root.exposes))
        ).not.toThrow();
        expect(observed).toBe(1);
        expect(actions.filter((name) => name === test.event)).toHaveLength(
          operation === 'normal' ? 1 : 0
        );
      } finally {
        for (const part of [...parts].reverse()) await part.session.dispose();
      }
    }
  );

it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
  'Menubar Trigger stops old Content entry after %s',
  async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    let focused = 0,
      retired = false;
    const contentProto = definePrototype({
      name: 'notification-menu-content',
      setup(def) {
        def.anatomy.claim(MENUBAR_FAMILY, { role: 'content' });
        def.expose.state('open', def.state.bool('open', true));
        let entryEpoch = 0;
        def.expose.method('__prepareEntry', (value: string) =>
          value === 'file' ? ++entryEpoch : null
        );
        def.expose.method(
          '__requestEntry',
          (_last: boolean, current: () => boolean, epoch: number) => {
            if (epoch === entryEpoch && current()) focused++;
          }
        );
      },
    });
    const root = make(menubarRoot),
      trigger = make(menubarTrigger, root.target, { value: 'file' }),
      content = make(contentProto, root.target);
    for (const part of [root, trigger, content]) await part.session.mount();
    setActionCallback((name) => {
      if (name !== 'valueChange' || operation === 'normal' || retired) return;
      retired = true;
      void trigger.session[operation === 'dispose' ? 'dispose' : 'unmount']();
      if (operation === 'remount') void trigger.session.mount();
    });
    try {
      expect(() => trigger.target.dispatchEvent(new Event('press.commit'))).not.toThrow();
      expect(actions).toEqual(['valueChange']);
      expect(retired).toBe(operation !== 'normal');
      expect(focused).toBe(operation === 'normal' ? 1 : 0);
    } finally {
      for (const part of [content, trigger, root]) await part.session.dispose();
    }
  }
);

it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
  'Field Control stops old input after %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    const root = make(fieldRoot),
      control = make(fieldControl, root.target);
    await root.session.mount();
    await control.session.mount();
    let observed = 0;
    control.exposes.value.subscribe((e: any) => {
      if (e.type !== 'next' || observed) return;
      observed++;
      if (operation === 'normal') return;
      void control.session[operation === 'dispose' ? 'dispose' : 'unmount']();
      if (operation === 'remount') void control.session.mount();
    });
    actions.length = 0;
    try {
      expect(() => control.input('next')).not.toThrow();
      expect(observed).toBe(1);
      expect(actions).toEqual(operation === 'normal' ? ['valueChange'] : []);
      if (operation !== 'dispose')
        expect(control.exposes.composing.get()).toBe(operation === 'normal');
    } finally {
      await control.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['normal', 'unmount', 'remount'] as const)(
  'Toast reconciles its retained open state before the next view: %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    const root = make(toastRoot, null, { defaultOpen: true, duration: 0 });
    const reader = make(
      definePrototype({
        name: 'retained-toast-context',
        setup(def) {
          let current: any;
          def.context.subscribe(TOAST_CONTEXT);
          def.lifecycle.onCreated((run) => {
            current = run;
          });
          def.expose.method('read', () => current.context.read(TOAST_CONTEXT));
        },
      }),
      root.target
    );
    await root.session.mount();
    await reader.session.mount();
    let retired = false;
    root.exposes.open.subscribe((e: any) => {
      if (e.type !== 'next' || e.next !== false || retired || operation === 'normal') return;
      retired = true;
      void root.session.unmount();
      if (operation === 'remount') void root.session.mount();
    });
    actions.length = 0;
    try {
      root.session.invokeInCallbackScope(() => root.exposes.close());
      if (operation === 'unmount') await root.session.mount();
      expect(root.session.mountPhase).toBe('mounted');
      expect(root.exposes.open.get()).toBe(false);
      let context: any;
      reader.session.invokeInCallbackScope(() => {
        context = reader.exposes.read();
      });
      expect(context.open).toBe(false);
      expect(actions).not.toContain('beforeEnter');
    } finally {
      await reader.session.dispose();
      await root.session.dispose();
    }
  }
);

for (const test of cases.filter((test) =>
  ['Number Field value request', 'Data Table sort', 'Calendar month', 'OTP value'].includes(
    test.name
  )
))
  it.each(['normal', 'dispose'] as const)(
    `${test.name} preserves created-instance retirement: %s`,
    async (operation) => {
      const { make, actions } = runtimeHarness();
      const root = make(test.proto, null, test.props ?? {});
      let armed = false,
        observed = 0;
      const retire = () => {
        if (!armed) return;
        armed = false;
        observed++;
        if (operation === 'dispose') void root.session.dispose();
      };
      const observer = test.context
        ? make(
            definePrototype({
              name: 'created-request-observer',
              setup(def) {
                def.context.subscribe(test.context, retire);
              },
            }),
            root.target
          )
        : null;
      if (test.state)
        root.exposes[test.state].subscribe((e: any) => {
          if (e.type === 'next') retire();
        });
      armed = true;
      actions.length = 0;
      try {
        let accepted: unknown;
        expect(() => {
          accepted = root.session.invokeInCallbackScope(() => test.request(root.exposes));
        }).not.toThrow();
        expect(accepted).toBe(true);
        expect(observed).toBe(1);
        expect(actions.filter((name) => name === test.event)).toHaveLength(
          operation === 'normal' ? 1 : 0
        );
      } finally {
        if (observer) await observer.session.dispose();
        await root.session.dispose();
      }
    }
  );

for (const boundary of ['State', 'Context'] as const)
  it.each(['normal', 'dispose'] as const)(
    `Field Root stops pending publication through ${boundary} after %s`,
    async (operation) => {
      const { make, actions } = runtimeHarness();
      const root = make(fieldRoot, null, {
          externalValidation: true,
          validationMode: 'manual',
        }),
        control = make(fieldControl, root.target, { defaultValue: 'same' });
      const parts = [root, control];
      let armed = false,
        observed = 0,
        retirement: Promise<void> | undefined,
        stop: (() => void) | undefined;
      const retire = () => {
        if (!armed || observed) return;
        observed++;
        if (operation === 'dispose') retirement = root.session.dispose();
      };
      if (boundary === 'Context')
        parts.push(
          make(
            definePrototype({
              name: 'field-pending-context-observer',
              setup(def) {
                def.context.subscribe(FIELD_CONTEXT, (_run, next) => {
                  if (next.pending) retire();
                });
              },
            }),
            root.target
          )
        );
      try {
        for (const part of parts) await part.session.mount();
        if (boundary === 'State')
          stop = root.exposes.pending.subscribe((event: any) => {
            if (event.type === 'next' && event.next === true) retire();
          });
        actions.length = 0;
        armed = true;
        let request: string | null = null;
        expect(() =>
          root.session.invokeInCallbackScope(() => {
            request = root.exposes.validate();
          })
        ).not.toThrow();
        await retirement;
        expect(observed).toBe(1);
        expect(typeof request).toBe('string');
        expect(actions.filter((name) => name === 'validationRequest')).toHaveLength(
          operation === 'normal' ? 1 : 0
        );
        if (operation === 'normal') {
          expect(root.exposes.pending.get()).toBe(true);
          let accepted = false;
          root.session.invokeInCallbackScope(() => {
            accepted = root.exposes.resolveValidation(request, { invalid: false });
          });
          expect(accepted).toBe(true);
        } else {
          expect(root.session.instancePhase).toBe('disposed');
          expect(root.session.mountPhase).toBe('detached');
        }
      } finally {
        stop?.();
        await retirement;
        for (const part of [...parts].reverse()) await part.session.dispose();
      }
    }
  );

it.each(['normal', 'cancel', 'reset', 'dispose', 'newer'] as const)(
  'Field Root retires queued pending publication entered from dirty after %s',
  async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const root = make(fieldRoot, null, {
      externalValidation: true,
      validationMode: 'manual',
    });
    const control = make(fieldControl, root.target, { defaultValue: 'same' });
    let request: string | null = null,
      newer: string | null = null,
      observed = 0,
      retirement: Promise<void> | undefined;
    const stops: (() => void)[] = [];
    const emitted: string[] = [];
    setActionCallback((name, payload) => {
      if (name === 'validationRequest') emitted.push(payload.requestId);
    });
    try {
      await root.session.mount();
      await control.session.mount();
      stops.push(
        root.exposes.dirty.subscribe((event: any) => {
          if (event.type === 'next' && event.next === true && request === null)
            root.session.invokeInCallbackScope(() => {
              request = root.exposes.validate();
            });
        })
      );
      stops.push(
        root.exposes.pending.subscribe((event: any) => {
          if (event.type !== 'next' || event.next !== true || observed) return;
          observed++;
          root.session.invokeInCallbackScope(() => {
            if (operation === 'cancel') root.exposes.cancelValidation();
            else if (operation === 'reset') root.exposes.resetValidation();
            else if (operation === 'dispose') retirement = root.session.dispose();
            else if (operation === 'newer') newer = root.exposes.validate();
          });
        })
      );
      actions.length = 0;
      expect(() => control.input('changed', false)).not.toThrow();
      await retirement;
      expect(observed).toBe(1);
      expect(typeof request).toBe('string');
      expect(actions.filter((name) => name === 'validationRequest')).toHaveLength(
        operation === 'normal' || operation === 'newer' ? 1 : 0
      );
      expect(emitted).toEqual(
        operation === 'normal' ? [request] : operation === 'newer' ? [newer] : []
      );
      if (operation === 'normal' || operation === 'newer') {
        let accepted = false;
        root.session.invokeInCallbackScope(() => {
          accepted = root.exposes.resolveValidation(operation === 'newer' ? newer : request, {
            invalid: false,
          });
        });
        expect(accepted).toBe(true);
      }
    } finally {
      for (const stop of stops) stop();
      await retirement;
      await control.session.dispose();
      await root.session.dispose();
    }
  }
);

it.each(['normal', 'unmount', 'dispose', 'nested', 'remount'] as const)(
  'Toggle Group stops old Context publication after %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    const root = make(toggleGroupRoot);
    const items = ['a', 'b'].map((value) => make(toggleGroupItem, root.target, { value }));
    let armed = false,
      observed = 0,
      nested: boolean | undefined;
    const transitions: Promise<void>[] = [];
    const phases: Array<{ mount: string; epoch: number }> = [];
    const request = (value: string) => {
      let accepted: boolean | undefined;
      root.session.invokeInCallbackScope(() => {
        accepted = root.exposes.requestToggle(value);
      });
      return accepted;
    };
    const observer = make(
      definePrototype({
        name: 'toggle-group-retirement-observer',
        setup(def) {
          def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
            if (!armed || observed || next.value.length !== 1 || next.value[0] !== 'a') return;
            observed++;
            if (operation === 'nested') nested = request('b');
            else if (operation === 'unmount' || operation === 'dispose')
              transitions.push(root.session[operation]());
            else if (operation === 'remount') {
              phases.push({ mount: root.session.mountPhase, epoch: root.session.mountEpoch });
              transitions.push(root.session.unmount());
              phases.push({ mount: root.session.mountPhase, epoch: root.session.mountEpoch });
              transitions.push(root.session.mount());
              phases.push({ mount: root.session.mountPhase, epoch: root.session.mountEpoch });
            }
          });
        },
      }),
      root.target
    );
    const parts = [root, ...items, observer];
    try {
      for (const part of parts) await part.session.mount();
      expect(root.exposes.getValue()).toEqual([]);
      expect(root.exposes.count.get()).toBe(2);
      const initialEpoch = root.session.mountEpoch;
      actions.length = 0;
      armed = true;
      let accepted: boolean | undefined;
      expect(() => {
        accepted = request('a');
      }).not.toThrow();
      await Promise.all(transitions);
      expect(observed).toBe(1);
      expect(accepted).toBe(true);
      const oldNotifications = actions.filter((name) => name === 'valueChange');
      if (operation === 'remount') {
        expect(phases).toEqual([
          { mount: 'mounted', epoch: initialEpoch },
          { mount: 'detached', epoch: initialEpoch },
          { mount: 'mounted', epoch: initialEpoch + 1 },
        ]);
        const beforeFresh = actions.length;
        expect(request('b')).toBe(true);
        expect(root.exposes.getValue()).toEqual(['b']);
        expect(actions.slice(beforeFresh).filter((name) => name === 'valueChange')).toHaveLength(1);
      }
      expect(oldNotifications).toHaveLength(
        operation === 'normal' ? 1 : operation === 'nested' ? 2 : 0
      );
      if (operation === 'nested') {
        expect(nested).toBe(true);
        expect(root.exposes.getValue()).toEqual(['b']);
      } else if (operation === 'normal') expect(root.exposes.getValue()).toEqual(['a']);
      else if (operation !== 'remount') {
        expect(root.session.mountPhase).toBe('detached');
        expect(root.session.instancePhase).toBe(operation === 'dispose' ? 'disposed' : 'alive');
      }
    } finally {
      await Promise.all(transitions);
      for (const part of [...parts].reverse()) await part.session.dispose();
    }
  }
);

it('Field Root retains newer validation entered during Context and pending publication', async () => {
  const { make, setActionCallback } = runtimeHarness();
  const root = make(fieldRoot, null, {
    externalValidation: true,
    validationMode: 'manual',
  });
  const control = make(fieldControl, root.target, { defaultValue: 'same' });
  let armed = false,
    contextCalls = 0,
    pendingCalls = 0,
    older: string | null = null,
    newer: string | null = null,
    stop: (() => void) | undefined;
  const emitted: string[] = [];
  setActionCallback((name, payload) => {
    if (name === 'validationRequest') emitted.push(payload.requestId);
  });
  const observer = make(
    definePrototype({
      name: 'field-context-nested-pending-observer',
      setup(def) {
        def.context.subscribe(FIELD_CONTEXT, (_run, next) => {
          if (!armed || contextCalls || !next.dirty) return;
          contextCalls++;
          root.session.invokeInCallbackScope(() => {
            older = root.exposes.validate();
          });
        });
      },
    }),
    root.target
  );
  const parts = [root, control, observer];
  try {
    for (const part of parts) await part.session.mount();
    stop = root.exposes.pending.subscribe((event: any) => {
      if (event.type !== 'next' || event.next !== true || pendingCalls) return;
      pendingCalls++;
      root.session.invokeInCallbackScope(() => {
        newer = root.exposes.validate();
      });
    });
    armed = true;
    expect(() => control.input('changed', false)).not.toThrow();
    const emittedAtReturn = [...emitted];
    const pendingBeforeResolve = root.exposes.pending.get();
    let oldAccepted = false,
      currentAccepted = false;
    root.session.invokeInCallbackScope(() => {
      oldAccepted = root.exposes.resolveValidation(older, { invalid: false });
      currentAccepted = root.exposes.resolveValidation(newer, { invalid: false });
    });
    expect(contextCalls).toBe(1);
    expect(pendingCalls).toBe(1);
    expect(typeof older).toBe('string');
    expect(typeof newer).toBe('string');
    expect(older).not.toBe(newer);
    expect(pendingBeforeResolve).toBe(true);
    expect(oldAccepted).toBe(false);
    expect(currentAccepted).toBe(true);
    expect(emittedAtReturn).toEqual([newer]);
  } finally {
    stop?.();
    for (const part of [...parts].reverse()) await part.session.dispose();
  }
});

it.each(['normal', 'nested', 'unmount', 'dispose', 'remount'] as const)(
  'Toggle Group waits for queued Context retirement after %s',
  async (operation) => {
    const { make, setActionCallback } = runtimeHarness();
    const root = make(toggleGroupRoot);
    const items = ['a', 'b', 'c'].map((value) => make(toggleGroupItem, root.target, { value }));
    let armed = false;
    const seen = new Set<string>();
    const nested: boolean[] = [];
    const emitted: string[][] = [];
    const transitions: Promise<void>[] = [];
    const request = (value: string) => {
      let accepted: boolean | undefined;
      root.session.invokeInCallbackScope(() => {
        accepted = root.exposes.requestToggle(value);
      });
      return accepted;
    };
    setActionCallback((name, payload) => {
      if (name === 'valueChange') emitted.push([...payload.value]);
    });
    const observer = make(
      definePrototype({
        name: 'toggle-group-queued-retirement-observer',
        setup(def) {
          def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
            if (!armed || next.value.length !== 1 || seen.has(next.value[0])) return;
            const value = next.value[0];
            seen.add(value);
            if (value === 'a' && operation !== 'normal') nested.push(request('b')!);
            else if (value === 'b') {
              if (operation === 'nested') nested.push(request('c')!);
              else if (operation === 'unmount' || operation === 'dispose')
                transitions.push(root.session[operation]());
              else if (operation === 'remount') {
                transitions.push(root.session.unmount());
                transitions.push(root.session.mount());
              }
            }
          });
        },
      }),
      root.target
    );
    const parts = [root, ...items, observer];
    try {
      for (const part of parts) await part.session.mount();
      const initialEpoch = root.session.mountEpoch;
      emitted.length = 0;
      armed = true;
      const accepted = request('a');
      const emittedAtReturn = emitted.map((value) => [...value]);
      await Promise.all(transitions);
      let fresh:
        | { accepted: boolean | undefined; emitted: string[][]; value: string[] }
        | undefined;
      if (operation === 'remount') {
        emitted.length = 0;
        fresh = {
          accepted: request('c'),
          emitted: emitted.map((value) => [...value]),
          value: root.exposes.getValue(),
        };
      }
      expect(accepted).toBe(true);
      expect([...seen]).toContain('a');
      expect(nested).toEqual(
        operation === 'normal' ? [] : operation === 'nested' ? [true, true] : [true]
      );
      expect(emittedAtReturn).toEqual(
        operation === 'normal' ? [['a']] : operation === 'nested' ? [['b'], ['c'], ['a']] : []
      );
      if (operation === 'normal') expect(root.exposes.getValue()).toEqual(['a']);
      if (operation === 'nested') expect(root.exposes.getValue()).toEqual(['c']);
      if (operation === 'unmount') expect(root.session.mountPhase).toBe('detached');
      if (operation === 'dispose') expect(root.session.instancePhase).toBe('disposed');
      if (operation === 'remount') {
        expect(root.session.mountEpoch).toBe(initialEpoch + 1);
        expect(fresh).toEqual({ accepted: true, emitted: [['c']], value: ['c'] });
      }
    } finally {
      armed = false;
      await Promise.all(transitions);
      for (const part of [...parts].reverse()) await part.session.dispose();
    }
  }
);

it('Toggle Group retains queued notification order when a valueChange callback reenters', async () => {
  const { make, setActionCallback } = runtimeHarness();
  const root = make(toggleGroupRoot);
  const items = ['a', 'b', 'c', 'd'].map((value) => make(toggleGroupItem, root.target, { value }));
  let armed = false;
  const seen = new Set<string>();
  const emitted: string[][] = [];
  const nested: boolean[] = [];
  const request = (value: string) => {
    let accepted: boolean | undefined;
    root.session.invokeInCallbackScope(() => {
      accepted = root.exposes.requestToggle(value);
    });
    return accepted;
  };
  setActionCallback((name, payload) => {
    if (name !== 'valueChange') return;
    emitted.push([...payload.value]);
    if (payload.value[0] === 'b') nested.push(request('d')!);
  });
  const observer = make(
    definePrototype({
      name: 'toggle-group-notification-reentry-observer',
      setup(def) {
        def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
          if (!armed || next.value.length !== 1 || seen.has(next.value[0])) return;
          const value = next.value[0];
          seen.add(value);
          if (value === 'a') nested.push(request('b')!);
          else if (value === 'b') nested.push(request('c')!);
        });
      },
    }),
    root.target
  );
  const parts = [root, ...items, observer];
  try {
    for (const part of parts) await part.session.mount();
    armed = true;
    expect(request('a')).toBe(true);
    expect(nested).toEqual([true, true, true]);
    expect(emitted).toEqual([['b'], ['c'], ['d'], ['a']]);
    expect(root.exposes.getValue()).toEqual(['d']);
  } finally {
    armed = false;
    for (const part of [...parts].reverse()) await part.session.dispose();
  }
});

it.each(['normal', 'dispose'] as const)(
  'Toggle Group retires a detached owner during Context %s',
  async (operation) => {
    const { make, setActionCallback } = runtimeHarness();
    const root = make(toggleGroupRoot);
    const item = make(toggleGroupItem, root.target, { value: 'a' });
    let armed = false;
    const transitions: Promise<void>[] = [];
    const emitted: string[][] = [];
    setActionCallback((name, payload) => {
      if (name === 'valueChange') emitted.push([...payload.value]);
    });
    const observer = make(
      definePrototype({
        name: 'toggle-group-detached-disposal-observer',
        setup(def) {
          def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
            if (armed && next.value[0] === 'a' && operation === 'dispose')
              transitions.push(root.session.dispose());
          });
        },
      }),
      root.target
    );
    const parts = [root, item, observer];
    try {
      await item.session.mount();
      await observer.session.mount();
      expect(root.session.mountPhase).toBe('detached');
      expect(root.session.instancePhase).toBe('alive');
      expect(root.exposes.getCollectionCount()).toBe(1);
      armed = true;
      let accepted: boolean | undefined;
      expect(() => {
        root.session.invokeInCallbackScope(() => {
          accepted = root.exposes.requestToggle('a');
        });
      }).not.toThrow();
      await Promise.all(transitions);
      expect(accepted).toBe(true);
      expect(emitted).toEqual(operation === 'normal' ? [['a']] : []);
      expect(root.session.instancePhase).toBe(operation === 'normal' ? 'alive' : 'disposed');
    } finally {
      armed = false;
      await Promise.all(transitions);
      for (const part of [...parts].reverse()) await part.session.dispose();
    }
  }
);

it('Toggle Group drains an accepted nested notification before a Context callback error escapes', async () => {
  const { make, setActionCallback } = runtimeHarness();
  const root = make(toggleGroupRoot);
  const items = ['a', 'b'].map((value) => make(toggleGroupItem, root.target, { value }));
  const failure = new Error('later Context observer failed');
  let armed = false;
  let nested: boolean | undefined;
  const emitted: string[][] = [];
  const observed: string[] = [];
  const request = (value: string) => {
    let accepted: boolean | undefined;
    root.session.invokeInCallbackScope(() => {
      accepted = root.exposes.requestToggle(value);
    });
    return accepted;
  };
  setActionCallback((name, payload) => {
    if (name === 'valueChange') emitted.push([...payload.value]);
  });
  const observer = make(
    definePrototype({
      name: 'toggle-group-accepted-before-context-error-observer',
      setup(def) {
        def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
          if (!armed || next.value.length !== 1) return;
          observed.push(next.value[0]);
          if (next.value[0] === 'a') nested = request('b');
        });
        def.context.subscribe(TOGGLE_GROUP_CONTEXT, (_run, next) => {
          if (armed && next.value[0] === 'a') throw failure;
        });
      },
    }),
    root.target
  );
  const parts = [root, ...items, observer];
  try {
    for (const part of parts) await part.session.mount();
    armed = true;
    let caught: unknown;
    try {
      request('a');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(nested).toBe(true);
    expect(observed).toEqual(['a', 'b']);
    expect(root.exposes.getValue()).toEqual(['b']);
    expect(emitted).toEqual([['b']]);
  } finally {
    armed = false;
    for (const part of [...parts].reverse()) await part.session.dispose();
  }
});

it.each(['normal', 'error'] as const)(
  'Field Root retains current validation after later Context subscriber %s',
  async (mode) => {
    const { make, setActionCallback } = runtimeHarness();
    const root = make(fieldRoot, null, {
      externalValidation: true,
      validationMode: 'manual',
    });
    const control = make(fieldControl, root.target, { defaultValue: 'same' });
    const failure = new Error('later Field Context subscriber');
    let armed = false,
      requested = false,
      raised = false,
      requestId: string | null = null;
    const delivered: Array<{ observer: string; pending: boolean }> = [];
    const emitted: string[] = [];
    setActionCallback((name, payload) => {
      if (name === 'validationRequest') emitted.push(payload.requestId);
    });
    const early = make(
      definePrototype({
        name: 'field-context-early-validation',
        setup(def) {
          def.context.subscribe(FIELD_CONTEXT, (_run, next) => {
            if (!armed || !next.dirty) return;
            delivered.push({ observer: 'early', pending: next.pending });
            if (requested) return;
            requested = true;
            root.session.invokeInCallbackScope(() => {
              requestId = root.exposes.validate();
            });
          });
        },
      }),
      root.target
    );
    const late = make(
      definePrototype({
        name: 'field-context-late-error',
        setup(def) {
          def.context.subscribe(FIELD_CONTEXT, (_run, next) => {
            if (!armed || !next.dirty) return;
            delivered.push({ observer: 'late', pending: next.pending });
            if (!next.pending && !raised) {
              raised = true;
              if (mode !== 'normal') throw failure;
            }
          });
        },
      }),
      root.target
    );
    const parts = [root, control, early, late];
    try {
      for (const part of parts) await part.session.mount();
      armed = true;
      let threw = false,
        caught: unknown;
      try {
        control.input('changed', false);
      } catch (error) {
        threw = true;
        caught = error;
      }
      const emittedAtReturn = [...emitted];
      const pendingAtReturn = root.exposes.pending.get();
      const validityAtReturn = root.exposes.getValidity();
      const deliveredAtReturn = [...delivered];
      let accepted = false;
      root.session.invokeInCallbackScope(() => {
        accepted = root.exposes.resolveValidation(requestId, { invalid: false });
      });
      expect(threw).toBe(mode !== 'normal');
      if (mode !== 'normal') expect(caught).toBe(failure);
      expect(typeof requestId).toBe('string');
      expect(deliveredAtReturn).toEqual([
        { observer: 'early', pending: false },
        { observer: 'late', pending: false },
        { observer: 'early', pending: true },
        { observer: 'late', pending: true },
      ]);
      expect(pendingAtReturn).toBe(true);
      expect(validityAtReturn.pending).toBe(true);
      expect(accepted).toBe(true);
      expect(root.exposes.pending.get()).toBe(false);
      expect(emittedAtReturn).toEqual([requestId]);
    } finally {
      armed = false;
      for (const part of [...parts].reverse()) await part.session.dispose();
    }
  }
);

it.each(['normal', 'error'] as const)(
  'Field Root retains a top-level request after pending Context subscriber %s',
  async (mode) => {
    const { make, setActionCallback } = runtimeHarness();
    const root = make(fieldRoot, null, {
      externalValidation: true,
      validationMode: 'manual',
    });
    const control = make(fieldControl, root.target, { defaultValue: 'same' });
    const failure = new Error('Field pending Context subscriber');
    let armed = false,
      observed = 0,
      requestId: string | null = null;
    const emitted: Array<{ requestId: string; value: string; reason: string }> = [];
    setActionCallback((name, payload) => {
      if (name === 'validationRequest') emitted.push(payload);
    });
    const observer = make(
      definePrototype({
        name: 'field-top-level-pending-error',
        setup(def) {
          def.context.subscribe(FIELD_CONTEXT, (_run, next) => {
            if (!armed || !next.pending || observed) return;
            observed++;
            if (mode === 'error') throw failure;
          });
        },
      }),
      root.target
    );
    const parts = [root, control, observer];
    try {
      for (const part of parts) await part.session.mount();
      armed = true;
      let caught: unknown;
      try {
        root.session.invokeInCallbackScope(() => {
          requestId = root.exposes.validate();
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(mode === 'error' ? failure : undefined);
      expect(observed).toBe(1);
      expect(emitted).toHaveLength(1);
      const current = emitted[0].requestId;
      expect(typeof current).toBe('string');
      expect(emitted[0]).toEqual({ requestId: current, value: 'same', reason: 'manual' });
      expect(requestId).toBe(mode === 'error' ? null : current);
      expect(root.exposes.getValidity().pending).toBe(true);
      let accepted = false,
        duplicate = true;
      root.session.invokeInCallbackScope(() => {
        accepted = root.exposes.resolveValidation(current, { invalid: false });
        duplicate = root.exposes.resolveValidation(current, { invalid: false });
      });
      expect(accepted).toBe(true);
      expect(duplicate).toBe(false);
      expect(root.exposes.pending.get()).toBe(false);
      expect(root.exposes.getValidity().pending).toBe(false);
      expect(emitted).toHaveLength(1);
    } finally {
      armed = false;
      for (const part of [...parts].reverse()) await part.session.dispose();
    }
  }
);
