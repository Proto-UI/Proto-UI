import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import * as autocomplete from '../src/autocomplete';
import * as combobox from '../src/combobox';
import * as command from '../src/command';
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
              if (name === 'valueChange' || name === 'execute' || name === 'openChange')
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

for (const [slug, module] of Object.entries({ autocomplete, combobox, command })) {
  it.each(
    slug === 'command'
      ? (['normal', 'unmount', 'dispose', 'remount'] as const)
      : (['normal', 'unmount', 'dispose', 'remount', 'close-dispose', 'close-remount'] as const)
  )(`${slug} yields obsolete continuation after %s`, async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const family = (module as any)[slug.toUpperCase() + '_FAMILY'];
    let focused = 0;
    const inputProto = definePrototype({
      name: 'probe-input-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'input' });
        def.expose.method('focusSelf', () => {
          focused++;
        });
      },
    });
    const contentProto = definePrototype({
      name: 'probe-content-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'content' });
      },
    });
    const itemProto = definePrototype({
      name: 'probe-item-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'item' });
        def.expose.method('__collectionItem', () => ({
          id: 'pear',
          value: 'pear',
          text: 'Pear',
          keywords: '',
          disabled: false,
        }));
      },
    });
    const root = make((module as any)[slug + 'Root'], null, { defaultOpen: true });
    const input = make(inputProto, root.target),
      content = make(contentProto, root.target),
      item = make(itemProto, content.target);
    for (const part of [root, input, content, item]) await part.session.mount();
    setActionCallback((name) => {
      const expected = operation.startsWith('close-')
        ? 'openChange'
        : slug === 'command'
          ? 'execute'
          : 'valueChange';
      if (name !== expected || operation === 'normal') return;
      void root.session[operation.endsWith('dispose') ? 'dispose' : 'unmount']();
      if (operation.endsWith('remount')) void root.session.mount();
    });
    try {
      let caught: any;
      try {
        root.session.invokeInCallbackScope(() => expect(root.exposes.select('pear')).toBe(true));
      } catch (error) {
        caught = error;
        console.log(
          'RETIREMENT_ERROR',
          slug,
          operation,
          (error as any).code,
          (error as any).message,
          (error as any).stack
        );
      }
      expect(caught).toBeUndefined();
      expect(actions).toEqual(
        slug === 'command'
          ? ['execute']
          : operation === 'normal' || operation.startsWith('close-')
            ? ['valueChange', 'openChange']
            : ['valueChange']
      );
      expect(focused).toBe(operation === 'normal' && slug !== 'command' ? 1 : 0);
      if (operation === 'unmount' || operation === 'remount') {
        await root.session.mount();
        setActionCallback(() => {});
        root.session.invokeInCallbackScope(() => root.exposes.openPopup());
        root.session.invokeInCallbackScope(() => root.exposes.select('pear'));
        expect(focused).toBe(slug === 'command' ? 0 : 1);
      }
    } finally {
      for (const part of [item, content, input, root]) await part.session.dispose();
    }
  });
}

import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
for (const module of [autocomplete, combobox])
  for (const p of Object.values(module))
    if (p && typeof p === 'object' && 'setup' in p && 'name' in p) AdaptToWebComponent(p as any);
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
for (const slug of ['autocomplete', 'combobox'])
  it.each(['remove', 'reinsert'])(
    `${slug} WC ordinary %s is not synchronous Runtime disposal`,
    async (operation) => {
      const make = (part: string, props = {}) => {
        const el = document.createElement(`base-${slug}-${part}`) as any;
        setElementProps(el, props);
        return el;
      };
      const root = make('root', { defaultOpen: true }),
        input = make('input'),
        content = make('content'),
        item = make('item', { value: 'pear', textValue: 'Pear' });
      content.append(item);
      root.append(input, content);
      document.body.append(root);
      await flush();
      let callbacks = 0;
      root.addEventListener('valueChange', () => {
        callbacks++;
        root.remove();
        if (operation === 'reinsert') document.body.append(root);
      });
      try {
        expect(() => root.getExposes().select('pear')).not.toThrow();
        expect(callbacks).toBe(1);
        await flush();
      } finally {
        root.remove();
        await flush();
      }
    }
  );

for (const [slug, module] of Object.entries({ autocomplete, combobox, command })) {
  it.each(
    slug === 'command'
      ? ['nested', 'nested-invalid', 'remount-select', 'controlled']
      : ['nested', 'nested-invalid', 'remount-select', 'throws', 'controlled']
  )(`${slug} preserves legitimate %s callback`, async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const family = (module as any)[slug.toUpperCase() + '_FAMILY'];
    let focused = 0;
    const inputProto = definePrototype({
      name: 'probe-input-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'input' });
        def.expose.method('focusSelf', () => {
          if (operation === 'throws') throw sentinel;
          focused++;
        });
      },
    });
    const contentProto = definePrototype({
      name: 'probe-content-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'content' });
      },
    });
    const itemProto = definePrototype({
      name: 'probe-item-' + slug,
      setup(def: any) {
        def.anatomy.claim(family, { role: 'item' });
        def.expose.method('__collectionItem', () => ({
          id: 'pear',
          value: 'pear',
          text: 'Pear',
          keywords: '',
          disabled: false,
        }));
      },
    });
    const root = make(
      (module as any)[slug + 'Root'],
      null,
      operation === 'controlled'
        ? { defaultOpen: true, value: 'owner', inputValue: '', open: true }
        : { defaultOpen: true }
    );
    const input = make(inputProto, root.target),
      content = make(contentProto, root.target),
      item = make(itemProto, content.target);
    for (const part of [root, input, content, item]) await part.session.mount();

    let once = false,
      nestedResult: unknown;
    const sentinel = new Error('application callback');
    setActionCallback((name) => {
      if (name !== (slug === 'command' ? 'execute' : 'valueChange') || once) return;
      once = true;
      if (operation === 'remount-select') {
        void root.session.unmount();
        void root.session.mount();
      }
      if (
        operation === 'nested' ||
        operation === 'remount-select' ||
        operation === 'nested-invalid'
      )
        nestedResult = root.exposes.select(operation === 'nested-invalid' ? 'missing' : 'pear');
    });
    try {
      if (operation === 'throws' && slug !== 'command')
        expect(() => root.session.invokeInCallbackScope(() => root.exposes.select('pear'))).toThrow(
          sentinel
        );
      else {
        expect(root.session.invokeInCallbackScope(() => root.exposes.select('pear'))).toBe(true);
        if (operation === 'nested-invalid') expect(nestedResult).toBe(false);
        if (operation === 'nested' || operation === 'remount-select')
          expect(nestedResult).toBe(true);
        const event = slug === 'command' ? 'execute' : 'valueChange';
        expect(actions).toEqual([
          event,
          ...(operation === 'nested' || operation === 'remount-select' ? [event] : []),
          ...(slug === 'command' ? [] : ['openChange']),
        ]);
        expect(focused).toBe(slug === 'command' ? 0 : 1);
        if (operation === 'controlled') {
          expect(root.exposes.value.get()).toBe('owner');
          expect(root.exposes.inputValue.get()).toBe('');
          expect(root.exposes.open.get()).toBe(true);
        }
      }
    } finally {
      for (const part of [item, content, input, root]) await part.session.dispose();
    }
  });
}
