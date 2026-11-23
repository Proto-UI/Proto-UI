import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { definePrototype } from '@proto.ui/core';
import { checkboxRoot } from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/checkbox/index.ts';
import { radioGroupRoot } from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/radio-group/index.ts';
import {
  fieldCheckbox,
  fieldRadioGroup,
} from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/field/index.ts';
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
    setActionCallback(fn: (name: string, payload?: any) => void) {
      actionCallback = fn;
    },
  };
}

import { RADIO_GROUP_FAMILY } from '/workspace/scratch/44c416809288/s2-input/packages/prototypes/base/src/radio-group/shared.ts';

const results: any[] = [];
for (const operation of ['unmount', 'dispose', 'remount'] as const) {
  const { make } = runtimeHarness();
  const root = make(radioGroupRoot, null, { value: 'a' });
  const itemProto = definePrototype({
    name: 'review-owned-radio-part',
    setup(def) {
      def.anatomy.claim(RADIO_GROUP_FAMILY, { role: 'item' });
      const focus = def.state.bool('focused', false);
      def.expose.state('focused', focus);
      def.expose.method('setFocused', () => focus.set(true));
      def.expose.method('__collectionItem', () => ({
        instanceId: 'review-item',
        value: 'a',
        disabled: false,
      }));
    },
  });
  const item = make(itemProto, root.target);
  await root.session.mount();
  await item.session.mount();
  item.session.invokeInCallbackScope(() => item.exposes.setFocused());
  const transition: Promise<unknown>[] = [];
  const off = root.exposes.focused.subscribe((event: any) => {
    if (event.next !== true) return;
    transition.push(root.session[operation === 'dispose' ? 'dispose' : 'unmount']());
    if (operation === 'remount') transition.push(root.session.mount());
  });
  let thrown: any, result: any;
  try {
    try {
      result = root.session.invokeInCallbackScope(() => root.exposes.requestValue('a'));
    } catch (error) {
      thrown = { message: String(error), code: (error as any).code };
    }
    results.push({
      operation,
      expected: 'old no-op focus continuation ends without accessing retired owner',
      result,
      thrown,
      passed: !thrown,
    });
  } finally {
    off();
    await Promise.all(transition);
    await item.session.dispose();
    await root.session.dispose();
  }
}
const out = {
  ok: results.every((r) => r.passed),
  cases: results,
  boundary:
    'Independent actual Radio Root and Runtime, independently authored owned item fact, synthetic host not native focus.',
};
writeFileSync(
  '/workspace/scratch/44c416809288/evidence/field-choice-focus-retirement-probe.json',
  JSON.stringify(out, null, 2) + '\n'
);
console.log(JSON.stringify(out));
