import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { toastRoot, toastAction, toastClose } from '../src/toast';
import { resizableRoot, RESIZABLE_CONTEXT } from '../src/resizable';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
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
  function make(proto: any, parent: any = null, props: any = { duration: 0 }) {
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
    let semantics: any;
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
        w.attach('a11y', [
          [
            A11Y_PROJECT_CAP,
            (snapshot: any) => {
              semantics = snapshot;
            },
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
      get semantics() {
        return semantics;
      },
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

it.each([
  ['close', toastClose],
  ['action', toastAction],
] as const)(
  'Toast %s exposes one portable activate route which performs exactly one command',
  async (kind, proto) => {
    const { make, actions } = runtimeHarness();
    const root = make(toastRoot),
      command = make(proto, root.target);
    await root.session.mount();
    await command.session.mount();
    try {
      expect(command.semantics.actions.activate).toBeDefined();
      const route = command.semantics.actions.activate.event;
      expect(typeof route).toBe('string');
      command.target.dispatchEvent(new Event(route));
      expect(actions).toEqual(
        kind === 'action' ? ['action', 'beforeLeave', 'openChange'] : ['beforeLeave', 'openChange']
      );
    } finally {
      await command.session.dispose();
      await root.session.dispose();
    }
  }
);
it.each(['value', 'orientation'] as const)(
  'Resizable yields when %s publication synchronously disposes its owner',
  async (boundary) => {
    const { make, actions } = runtimeHarness();
    let root: any,
      armed = false,
      retired = false;
    const retire = () => {
      if (armed && !retired) {
        retired = true;
        void root.session.dispose();
      }
    };
    const proto = definePrototype({
      ...resizableRoot,
      name: 'resizable-sync-retirement-' + boundary,
      setup(def: any) {
        const state = new Proxy(def.state, {
          get(target, key) {
            if (key !== 'string') return Reflect.get(target, key);
            return (...args: any[]) => {
              const handle = target.string(...args);
              if (args[0] === 'orientation') def.expose.state('__testOrientation', handle);
              return handle;
            };
          },
        });
        resizableRoot.setup(
          new Proxy(def, {
            get(target, key) {
              return key === 'state' ? state : Reflect.get(target, key);
            },
          })
        );
      },
    });
    const props: any = { defaultValue: 50 };
    root = make(proto, null, props);
    await root.session.mount();
    root.exposes.value.subscribe((e: any) => {
      if (e.type === 'next' && boundary === 'value') retire();
    });
    root.exposes.__testOrientation.subscribe((e: any) => {
      if (e.type === 'next' && boundary === 'orientation') retire();
    });
    armed = true;

    try {
      if (boundary === 'value' || boundary === 'orientation') {
        expect(() =>
          boundary === 'orientation'
            ? root.session.controller.applyRawProps({ orientation: 'vertical' })
            : root.session.invokeInCallbackScope(() => root.exposes.requestValue(60, true))
        ).not.toThrow();
        expect(retired).toBe(true);
        expect(actions).toEqual([]);
      }
    } finally {
      await root.session.dispose();
    }
  }
);

it.each(['unmount', 'dispose', 'remount'] as const)(
  'Toast accessible action preserves synchronous %s retirement',
  async (operation) => {
    const { make, actions, setActionCallback } = runtimeHarness();
    const root = make(toastRoot),
      command = make(toastAction, root.target);
    await root.session.mount();
    await command.session.mount();
    setActionCallback(() => {
      void command.session[operation === 'remount' ? 'unmount' : operation]();
      if (operation === 'remount') void command.session.mount();
    });
    try {
      const route = command.semantics.actions.activate.event;
      expect(() => command.target.dispatchEvent(new Event(route))).not.toThrow();
      expect(actions).toEqual(['action']);
      if (operation !== 'dispose') {
        await command.session.mount();
        setActionCallback(() => {});
        command.target.dispatchEvent(new Event(route));
        expect(actions).toEqual(['action', 'action', 'beforeLeave', 'openChange']);
      }
    } finally {
      await command.session.dispose();
      await root.session.dispose();
    }
  }
);
it.each([
  ['close', toastClose],
  ['action', toastAction],
] as const)(
  'Toast %s accessible activation honors disabled and repeated commands',
  async (kind, proto) => {
    const { make, actions } = runtimeHarness();
    const root = make(toastRoot),
      command = make(proto, root.target, { disabled: true });
    await root.session.mount();
    await command.session.mount();
    try {
      const route = command.semantics.actions.activate.event;
      command.target.dispatchEvent(new Event(route));
      expect(actions).toEqual([]);
      command.session.controller.applyRawProps({ disabled: false });
      command.target.dispatchEvent(new Event(route));
      command.target.dispatchEvent(new Event(route));
      expect(actions.filter((x) => x === 'action')).toHaveLength(kind === 'action' ? 2 : 0);
      expect(actions.filter((x) => x === 'openChange')).toHaveLength(1);
    } finally {
      await command.session.dispose();
      await root.session.dispose();
    }
  }
);
it.each(['dispose', 'unmount', 'remount'] as const)(
  'Resizable stops post-Context events after synchronous owner %s',
  async (operation) => {
    const { make, actions } = runtimeHarness();
    let armed = false,
      retired = false;
    const root = make(resizableRoot);
    const observer = make(
      definePrototype({
        name: 'resizable-context-retirement-' + operation,
        setup(def) {
          def.context.subscribe(RESIZABLE_CONTEXT, () => {
            if (armed && !retired) {
              retired = true;
              void root.session[operation === 'remount' ? 'unmount' : operation]();
              if (operation === 'remount') void root.session.mount();
            }
          });
        },
      }),
      root.target
    );
    await root.session.mount();
    await observer.session.mount();
    armed = true;
    try {
      expect(() =>
        root.session.invokeInCallbackScope(() => root.exposes.requestValue(60, true))
      ).not.toThrow();
      expect(retired).toBe(true);
      expect(actions).toEqual([]);
      if (operation === 'unmount') {
        armed = false;
        await root.session.mount();
        root.session.invokeInCallbackScope(() => root.exposes.requestValue(70, true));
        expect(actions).toEqual(['valueChange', 'valueCommit']);
      }
    } finally {
      await observer.session.dispose();
      await root.session.dispose();
    }
  }
);
