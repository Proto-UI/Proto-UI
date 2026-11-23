import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import { datePickerRoot, datePickerDay, asDatePickerRoot } from '../src/date-picker';
import { asCalendarRoot, CALENDAR_CONTEXT } from '../src/calendar';
import { asPopoverRoot } from '../src/popover';
import { POPOVER_CONTEXT } from '../src/popover/shared';
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
                name === 'rangeChange' ||
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
      setProps(next: Record<string, unknown>) {
        props = next;
        session.controller.applyRawProps(next);
      },
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

it('Calendar captures valid requests before effects and owns registration for its lifetime', async () => {
  const { make, actions } = runtimeHarness();
  const order: string[] = [];
  const captures: Array<{ id: number; viewEpoch: number; value: string }> = [];
  let register: ReturnType<typeof asCalendarRoot>['registerSelectionCapture'];
  const proto = definePrototype({
    name: 'calendar-request-capture',
    setup(def) {
      const calendar = asCalendarRoot();
      register = calendar.registerSelectionCapture;
      const capture: Parameters<typeof register>[0] = ({ id, viewEpoch, context }) => {
        order.push('capture');
        captures.push({ id, viewEpoch, value: context.read(CALENDAR_CONTEXT).value });
      };
      expect(register(capture)).toBe(true);
      expect(register(capture)).toBe(true);
      def.context.subscribe(CALENDAR_CONTEXT, () => order.push('context'));
    },
  });
  const root = make(proto, null, { defaultValue: '2026-10-10', defaultMonth: '2026-10' });
  await root.session.mount();
  order.length = 0;
  const retiredRequest = root.exposes.requestValue;
  const off = root.exposes.value.subscribe((event: any) => {
    if (event.type === 'next') order.push('state');
  });
  try {
    root.session.invokeInCallbackScope(() => {
      expect(root.exposes.requestValue('bad')).toBe(false);
      expect(root.exposes.requestValue('2026-10-10')).toBe(false);
      expect(captures).toEqual([]);
      expect(root.exposes.requestValue('2026-10-15')).toBe(true);
      expect(() => register(() => {})).toThrow();
    });
    expect(order[0]).toBe('capture');
    expect(order).toContain('state');
    expect(order).toContain('context');
    expect(captures).toEqual([{ id: 1, viewEpoch: 0, value: '2026-10-10' }]);
    expect(actions).toEqual(['valueChange']);
    await root.session.unmount();
    expect(root.exposes.requestValue('2026-10-16')).toBe(false);
    await root.session.mount();
    root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-16'));
    expect(captures[1]).toEqual({ id: 2, viewEpoch: 1, value: '2026-10-15' });
  } finally {
    off();
    await root.session.dispose();
  }
  expect(retiredRequest('2026-10-17')).toBe(false);
  expect(captures).toHaveLength(2);
});

it('Calendar abandons a failed capture without retiring a later valid request', async () => {
  const { make, actions } = runtimeHarness();
  let fail = true;
  const proto = definePrototype({
    name: 'calendar-failed-capture',
    setup() {
      asCalendarRoot().registerSelectionCapture(() => {
        if (fail) throw new Error('capture failed');
      });
    },
  });
  const root = make(proto, null, { defaultValue: '2026-10-10', defaultMonth: '2026-10' });
  await root.session.mount();
  try {
    root.session.invokeInCallbackScope(() => {
      expect(() => root.exposes.requestValue('2026-10-15')).toThrow('capture failed');
      expect(root.exposes.value.get()).toBe('2026-10-10');
      expect(actions).toEqual([]);
      fail = false;
      expect(root.exposes.requestValue('2026-10-16')).toBe(true);
    });
    expect(root.exposes.value.get()).toBe('2026-10-16');
    expect(actions).toEqual(['valueChange']);
  } finally {
    await root.session.dispose();
  }
});

it.each([false, true])(
  'Popover sessions count accepted openings with controlled=%s',
  async (controlled) => {
    const { make } = runtimeHarness();
    let current: { open: boolean; openSessionId: number };
    const proto = definePrototype({
      name: `popover-session-${controlled}`,
      setup(def) {
        asPopoverRoot();
        def.context.subscribe(POPOVER_CONTEXT, (run) => {
          current = run.context.read(POPOVER_CONTEXT);
        });
        def.lifecycle.onMounted((run) => {
          current = run.context.read(POPOVER_CONTEXT);
        });
      },
    });
    const root = make(proto, null, controlled ? { open: false } : { defaultOpen: false });
    await root.session.mount();
    try {
      expect(current!).toMatchObject({ open: false, openSessionId: 0 });
      root.session.invokeInCallbackScope(() => root.exposes.openPopover());
      if (controlled) {
        expect(current!).toMatchObject({ open: false, openSessionId: 0 });
        root.setProps({ open: true });
      }
      expect(current!).toMatchObject({ open: true, openSessionId: 1 });
      root.session.invokeInCallbackScope(() => root.exposes.openPopover());
      expect(current!).toMatchObject({ open: true, openSessionId: 1 });
      root.session.invokeInCallbackScope(() => root.exposes.close());
      if (controlled) {
        expect(current!).toMatchObject({ open: true, openSessionId: 1 });
        root.setProps({ open: false });
      }
      expect(current!).toMatchObject({ open: false, openSessionId: 1 });
      if (controlled) root.setProps({ open: true });
      else root.session.invokeInCallbackScope(() => root.exposes.openPopover());
      expect(current!).toMatchObject({ open: true, openSessionId: 2 });
      await root.session.unmount();
      await root.session.mount();
      expect(current!).toMatchObject({ open: true, openSessionId: 2 });
    } finally {
      await root.session.dispose();
    }
  }
);

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

for (const mode of ['single', 'range'] as const) {
  it(`Date Picker ${mode} completes a new request inside an earlier opening notification`, async () => {
    const { make, actions } = runtimeHarness();
    let root: ReturnType<typeof make>;
    let opened = false;
    let nested = false;
    let nestedOpen: unknown;
    let nestedRequest: unknown;
    const proto = definePrototype({
      name: `nested-opening-picker-${mode}`,
      setup(def) {
        asCalendarRoot();
        asPopoverRoot();
        def.context.subscribe(CALENDAR_CONTEXT, (_run, next) => {
          if (!next.selectionRequestId || opened) return;
          opened = true;
          root.exposes.openPopover('context-subscriber');
        });
        def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
          if (!next.open || nested) return;
          nested = true;
          nestedOpen = run.context.read(POPOVER_CONTEXT).open;
          nestedRequest =
            mode === 'single'
              ? root.exposes.requestValue('2026-10-16')
              : root.exposes.requestRange({ from: '2026-10-10', to: '2026-10-16' });
        });
        asDatePickerRoot();
      },
    });
    root = make(proto, null, {
      ...(mode === 'single'
        ? { defaultValue: '2026-10-10' }
        : { defaultRange: { from: '2026-10-10' } }),
      mode,
      defaultMonth: '2026-10',
      defaultOpen: false,
    });
    await root.session.mount();
    try {
      root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-15'));
      expect(nestedOpen).toBe(true);
      expect(nestedRequest).toBe(true);
      expect(mode === 'single' ? root.exposes.value.get() : root.exposes.getRange()).toEqual(
        mode === 'single' ? '2026-10-16' : { from: '2026-10-10', to: '2026-10-16' }
      );
      expect(root.exposes.open.get()).toBe(false);
      expect(actions).toEqual([
        'openChange',
        mode === 'single' ? 'valueChange' : 'rangeChange',
        'openChange',
      ]);
    } finally {
      await root.session.dispose();
    }
  });

  it(`Date Picker ${mode} keeps a new controlled request through an older close notification`, async () => {
    const { make, actions } = runtimeHarness();
    let root: ReturnType<typeof make>;
    let armed = false;
    let observed = false;
    let nestedOpen: unknown;
    let nestedRequest: unknown;
    const proto = definePrototype({
      name: `old-close-picker-${mode}`,
      setup(def) {
        asCalendarRoot();
        asPopoverRoot();
        def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
          if (!armed || next.open || observed) return;
          observed = true;
          root.exposes.openPopover('context-reopen');
          nestedOpen = run.context.read(POPOVER_CONTEXT).open;
          nestedRequest =
            mode === 'single'
              ? root.exposes.requestValue('2026-10-16')
              : root.exposes.requestRange({ from: '2026-10-10', to: '2026-10-16' });
        });
        asDatePickerRoot();
      },
    });
    const controlled =
      mode === 'single' ? { value: '2026-10-10' } : { range: { from: '2026-10-10' } };
    const props = { ...controlled, mode, defaultMonth: '2026-10', defaultOpen: true };
    root = make(proto, null, props);
    await root.session.mount();
    armed = true;
    try {
      root.session.invokeInCallbackScope(() => root.exposes.close('context-oldclose'));
      expect(nestedOpen).toBe(true);
      expect(nestedRequest).toBe(true);
      expect(root.exposes.open.get()).toBe(true);
      expect(mode === 'single' ? root.exposes.value.get() : root.exposes.getRange()).toEqual(
        mode === 'single' ? controlled.value : controlled.range
      );
      root.setProps({
        ...props,
        ...(mode === 'single'
          ? { value: '2026-10-16' }
          : { range: { from: '2026-10-10', to: '2026-10-16' } }),
      });
      expect(root.exposes.open.get()).toBe(false);
      expect(actions.filter((name) => name === 'openChange')).toHaveLength(3);
      expect(actions.at(-1)).toBe('openChange');
    } finally {
      await root.session.dispose();
    }
  });

  it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
    `Date Picker ${mode} synchronous owner acceptance waits for the proposal callback after %s`,
    async (operation) => {
      const { make, actions, setActionCallback } = runtimeHarness();
      const initial =
        mode === 'single' ? { value: '2026-10-10' } : { range: { from: '2026-10-10' } };
      const accepted =
        mode === 'single'
          ? { value: '2026-10-15' }
          : { range: { from: '2026-10-10', to: '2026-10-15' } };
      const props = { ...initial, mode, defaultMonth: '2026-10', defaultOpen: true };
      const root = make(datePickerRoot, null, props);
      const day = make(datePickerDay, root.target, { date: '2026-10-15' });
      const proposal = mode === 'single' ? 'valueChange' : 'rangeChange';
      const openDuringCallback: boolean[] = [];
      let canonicalDuringCallback: unknown;
      await root.session.mount();
      await day.session.mount();
      setActionCallback((name) => {
        if (name !== proposal) return;
        openDuringCallback.push(root.exposes.open.get());
        root.setProps({ ...props, ...accepted });
        openDuringCallback.push(root.exposes.open.get());
        canonicalDuringCallback =
          mode === 'single' ? root.exposes.value.get() : root.exposes.getRange();
        if (operation === 'normal') return;
        void day.session[operation === 'dispose' ? 'dispose' : 'unmount']();
        void root.session[operation === 'dispose' ? 'dispose' : 'unmount']();
        if (operation === 'remount') {
          void root.session.mount();
          void day.session.mount();
        }
      });
      try {
        day.target.dispatchEvent(new Event('press.commit'));
        expect(openDuringCallback).toEqual([true, true]);
        expect(canonicalDuringCallback).toEqual(
          mode === 'single' ? accepted.value : accepted.range
        );
        expect(actions).toEqual(operation === 'normal' ? [proposal, 'openChange'] : [proposal]);
      } finally {
        await day.session.dispose();
        await root.session.dispose();
      }
    }
  );
}

for (const mode of ['single', 'range'] as const) {
  it.each([false, true])(
    `Date Picker ${mode} retires a request when an earlier Context subscriber opens a new session (initial open: %s)`,
    async (initialOpen) => {
      const { make, actions } = runtimeHarness();
      let root: ReturnType<typeof make>;
      let observed = false;
      const proto = definePrototype({
        name: `context-first-picker-${mode}-${initialOpen}`,
        setup(def) {
          asCalendarRoot();
          def.context.subscribe(CALENDAR_CONTEXT, (_run, next) => {
            if (!next.selectionRequestId || observed) return;
            observed = true;
            if (initialOpen) root.exposes.close('context-subscriber');
            root.exposes.openPopover('context-subscriber');
          });
          asDatePickerRoot();
        },
      });
      const initial =
        mode === 'single'
          ? { defaultValue: '2026-10-10' }
          : { defaultRange: { from: '2026-10-10' } };
      root = make(proto, null, {
        ...initial,
        mode,
        defaultMonth: '2026-10',
        defaultOpen: initialOpen,
      });
      await root.session.mount();
      try {
        root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-15'));
        expect(observed).toBe(true);
        expect(root.exposes.open.get()).toBe(true);
        expect(actions).toEqual([
          ...(initialOpen ? ['openChange', 'openChange'] : ['openChange']),
          mode === 'single' ? 'valueChange' : 'rangeChange',
        ]);
        actions.length = 0;
        root.session.invokeInCallbackScope(() =>
          mode === 'single'
            ? root.exposes.requestValue('2026-10-16')
            : root.exposes.requestRange({ from: '2026-10-10', to: '2026-10-16' })
        );
        expect(root.exposes.open.get()).toBe(false);
        expect(actions).toEqual([mode === 'single' ? 'valueChange' : 'rangeChange', 'openChange']);
      } finally {
        await root.session.dispose();
      }
    }
  );
}

it.each(['accepted', 'refused', 'invalid'] as const)(
  'Date Picker keeps the current completion when a nested proposal is %s',
  async (nested) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const props = { value: '2026-10-10', defaultMonth: '2026-10', defaultOpen: true };
    const root = make(datePickerRoot, null, props);
    const day = make(datePickerDay, root.target, { date: '2026-10-15' });
    let proposals = 0;
    let nestedResult: unknown;
    await root.session.mount();
    await day.session.mount();
    setActionCallback((name) => {
      if (name !== 'valueChange') return;
      proposals++;
      if (proposals === 1) {
        root.setProps({ ...props, value: '2026-10-15' });
        nestedResult = root.exposes.requestValue(nested === 'invalid' ? 'bad' : '2026-10-16');
      } else if (nested === 'accepted') root.setProps({ ...props, value: '2026-10-16' });
    });
    try {
      day.target.dispatchEvent(new Event('press.commit'));
      expect(nestedResult).toBe(nested !== 'invalid');
      expect(root.exposes.value.get()).toBe(nested === 'accepted' ? '2026-10-16' : '2026-10-15');
      expect(actions).toEqual(
        nested === 'invalid'
          ? ['valueChange', 'openChange']
          : nested === 'accepted'
            ? ['valueChange', 'valueChange', 'openChange']
            : ['valueChange', 'valueChange']
      );
      if (nested === 'refused') {
        expect(root.exposes.open.get()).toBe(true);
        root.setProps({ ...props, value: '2026-10-16' });
        expect(actions).toEqual(['valueChange', 'valueChange', 'openChange']);
      }
      expect(root.exposes.open.get()).toBe(false);
    } finally {
      await day.session.dispose();
      await root.session.dispose();
    }
  }
);

it('Date Picker does not close a popup first opened inside the proposal callback', async () => {
  const { make, actions, setActionCallback } = runtimeHarness();
  const root = make(datePickerRoot, null, { defaultMonth: '2026-10', defaultOpen: false });
  await root.session.mount();
  setActionCallback((name) => {
    if (name === 'valueChange') root.exposes.openPopover('programmatic');
  });
  try {
    root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-15'));
    expect(actions).toEqual(['valueChange', 'openChange']);
    expect(root.exposes.open.get()).toBe(true);
  } finally {
    await root.session.dispose();
  }
});

for (const mode of ['single', 'range'] as const) {
  it.each([false, true])(
    `Date Picker ${mode} freezes the request session before public State observers (initial open: %s)`,
    async (initialOpen) => {
      const { make, actions } = runtimeHarness();
      const initial =
        mode === 'single'
          ? { defaultValue: '2026-10-10' }
          : { defaultRange: { from: '2026-10-10' } };
      const root = make(datePickerRoot, null, {
        ...initial,
        mode,
        defaultMonth: '2026-10',
        defaultOpen: initialOpen,
      });
      await root.session.mount();
      let observed = false;
      const state = mode === 'single' ? root.exposes.value : root.exposes.selectedCount;
      const off = state.subscribe((event: any) => {
        if (event.type !== 'next' || observed) return;
        observed = true;
        if (initialOpen) root.exposes.close('state-subscriber');
        root.exposes.openPopover('state-subscriber');
      });
      try {
        root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-15'));
        expect(observed).toBe(true);
        expect(root.exposes.open.get()).toBe(true);
        expect(mode === 'single' ? root.exposes.value.get() : root.exposes.getRange()).toEqual(
          mode === 'single' ? '2026-10-15' : { from: '2026-10-10', to: '2026-10-15' }
        );
        expect(actions).toEqual([
          ...(initialOpen ? ['openChange', 'openChange'] : ['openChange']),
          mode === 'single' ? 'valueChange' : 'rangeChange',
        ]);
      } finally {
        off();
        await root.session.dispose();
      }
    }
  );
}

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
