import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
import { formRoot } from '../src/form';
import { FORM_FAMILY } from '../src/form/shared';
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

import { menubarRoot, MENUBAR_FAMILY } from '../src/menubar';
import { navigationMenuRoot, NAVIGATION_MENU_FAMILY } from '../src/navigation-menu';
import { setupDrawerSnap } from '../src/drawer/snap';
import { DRAWER_CONTEXT, DRAWER_FAMILY } from '../src/drawer/shared';
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

for (const [slug, mod] of Object.entries({ autocomplete, combobox }))
  for (const method of ['openPopup', 'close'])
    it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
      `${slug} Root ${method} stops retired popup publication: %s`,
      async (operation) => {
        const { make, actions } = runtimeHarness();
        const root = make((mod as any)[slug + 'Root'], null, { defaultOpen: method === 'close' });
        await root.session.mount();
        let observed = 0;
        root.exposes.open.subscribe((e: any) => {
          if (e.type !== 'next' || observed) return;
          observed++;
          if (operation === 'normal') return;
          void root.session[operation === 'dispose' ? 'dispose' : 'unmount']();
          if (operation === 'remount') void root.session.mount();
        });
        actions.length = 0;
        try {
          expect(() =>
            root.session.invokeInCallbackScope(() => root.exposes[method]())
          ).not.toThrow();
          expect(observed).toBe(1);
          expect(actions).toEqual(operation === 'normal' ? ['openChange'] : []);
        } finally {
          await root.session.dispose();
        }
      }
    );
it.each(['openPopup', 'close'])('Command inline Root keeps %s as a no-op', async (method) => {
  const { make, actions } = runtimeHarness();
  const root = make(command.commandRoot);
  await root.session.mount();
  let observed = 0;
  root.exposes.open.subscribe((e: any) => {
    if (e.type === 'next') observed++;
  });
  try {
    root.session.invokeInCallbackScope(() => root.exposes[method]());
    expect(root.exposes.open.get()).toBe(true);
    expect(observed).toBe(0);
    expect(actions).toEqual([]);
  } finally {
    await root.session.dispose();
  }
});
for (const [slug, proto, family] of [
  ['menubar', menubarRoot, MENUBAR_FAMILY],
  ['navigation-menu', navigationMenuRoot, NAVIGATION_MENU_FAMILY],
] as const)
  it.each(['normal', 'unmount', 'dispose', 'remount', 'created-dispose'] as const)(
    `${slug} Root stops retired value publication: %s`,
    async (operation) => {
      const { make, actions } = runtimeHarness();
      const root = make(proto);
      const trigger = make(
        definePrototype({
          name: slug + '-value-trigger',
          setup(def) {
            def.anatomy.claim(family, { role: 'trigger' });
            def.expose.method('__collectionItem', () => ({
              id: 'file',
              value: 'file',
              disabled: false,
            }));
          },
        }),
        root.target
      );
      if (operation !== 'created-dispose') {
        await root.session.mount();
        await trigger.session.mount();
      }
      let observed = 0;
      root.exposes.value.subscribe((e: any) => {
        if (e.type !== 'next' || observed) return;
        observed++;
        if (operation === 'normal') return;
        void root.session[
          operation === 'dispose' || operation === 'created-dispose' ? 'dispose' : 'unmount'
        ]();
        if (operation === 'remount') void root.session.mount();
      });
      actions.length = 0;
      try {
        let accepted: unknown;
        expect(() =>
          root.session.invokeInCallbackScope(() => {
            accepted = root.exposes.requestValue('file');
          })
        ).not.toThrow();
        expect(accepted).toBe(true);
        expect(observed).toBe(1);
        expect(actions).toEqual(operation === 'normal' ? ['valueChange'] : []);
      } finally {
        await trigger.session.dispose();
        await root.session.dispose();
      }
    }
  );
it.each(['normal', 'throw', 'nested-throw', 'dispose-throw', 'remount-throw'] as const)(
  'Form validation failure ends only its own submission: %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    const form = make(formRoot);
    const error = new Error('field validation failed');
    let first = true,
      nested: unknown;
    const calls: number[] = [];
    const fields = [0, 1].map((index) =>
      make(
        definePrototype({
          name: 'throwing-validation-field-' + index,
          setup(def) {
            def.anatomy.claim(FORM_FAMILY, { role: 'field' });
            def.expose.method('__formField', () => ({
              name: 'field-' + index,
              value: 'valid',
              disabled: false,
              available: true,
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
            def.expose.method('validate', () => {
              calls.push(index);
              if (index || !first || operation === 'normal') return;
              first = false;
              if (operation === 'nested-throw') nested = form.exposes.requestSubmit();
              if (operation === 'dispose-throw') void form.session.dispose();
              if (operation === 'remount-throw') {
                void form.session.unmount();
                void form.session.mount();
              }
              throw error;
            });
          },
        }),
        form.target
      )
    );
    for (const part of [form, ...fields]) await part.session.mount();
    actions.length = 0;
    try {
      const submit = () => form.session.invokeInCallbackScope(() => form.exposes.requestSubmit());
      if (operation === 'normal') expect(submit).not.toThrow();
      else expect(submit).toThrow(error);
      if (operation === 'dispose-throw') {
        expect(form.session.instancePhase).toBe('disposed');
        return;
      }
      expect(form.exposes.pending.get()).toBe(false);
      if (operation === 'nested-throw') {
        expect(nested).toBe(true);
        expect(actions).toEqual(['submit']);
        expect(form.exposes.submitted.get()).toBe(true);
      } else if (operation !== 'normal') {
        expect(actions).toEqual([]);
        form.session.invokeInCallbackScope(() => form.exposes.__fieldChanged());
        expect(actions).toEqual([]);
        expect(form.exposes.submitted.get()).toBe(false);
      } else expect(actions).toEqual(['submit']);
    } finally {
      for (const part of [...fields.reverse(), form]) await part.session.dispose();
    }
  }
);
for (const method of ['requestSnapPoint', '__onAxisInput'])
  it.each(['normal', 'unmount', 'dispose', 'remount'] as const)(
    `Drawer snap ${method} stops retired Content completion: %s`,
    async (operation) => {
      const { make, actions } = runtimeHarness();
      const root = make(
        definePrototype({
          name: 'snap-lifetime-owner',
          setup(def) {
            def.anatomy.claim(DRAWER_FAMILY, { role: 'root' });
            def.context.provide(DRAWER_CONTEXT, {
              rootId: 'snap-lifetime',
              open: true,
              contentAdmitted: true,
              openFocusReason: null,
              returnFocusReason: null,
              controlled: false,
              disabled: false,
              alert: false,
              a11yLabel: '',
              requestedOpen: true,
              requestReason: null,
              requestFocusReason: null,
              requestVersion: 0,
            });
            def.expose.method('__admitContent', () => 1);
            def.expose.method('__releaseContent', () => {});
          },
        })
      );
      const content = make(
        definePrototype({
          name: 'snap-lifetime-content',
          setup(def) {
            def.anatomy.claim(DRAWER_FAMILY, { role: 'content' });
            def.props.define({
              side: { type: 'string', empty: 'fallback' },
            });
            setupDrawerSnap(def, def.state.string('side', 'right'), () => {});
          },
        }),
        root.target,
        { side: 'right', snapPoints: [0.5, 1], defaultSnapPoint: 1 }
      );
      await root.session.mount();
      await content.session.mount();
      let observed = 0;
      content.exposes.snapPoint.subscribe((e: any) => {
        if (e.type !== 'next' || observed) return;
        observed++;
        if (operation === 'normal') return;
        void content.session[operation === 'dispose' ? 'dispose' : 'unmount']();
        if (operation === 'remount') void content.session.mount();
      });
      const sample = (phase: string, totalDelta: number) => ({ phase, totalDelta });
      actions.length = 0;
      try {
        expect(() =>
          content.session.invokeInCallbackScope(() => {
            if (method === 'requestSnapPoint') content.exposes.requestSnapPoint(0.5);
            else {
              content.exposes.__onAxisInput(sample('start', 0));
              content.exposes.__onAxisInput(sample('end', -0.4));
            }
          })
        ).not.toThrow();
        expect(observed).toBe(1);
        expect(actions).toEqual(operation === 'normal' ? ['snapPointChange'] : []);
      } finally {
        await content.session.dispose();
        await root.session.dispose();
      }
    }
  );
