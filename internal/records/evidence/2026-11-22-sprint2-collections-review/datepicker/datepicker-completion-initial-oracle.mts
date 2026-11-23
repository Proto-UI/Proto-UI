import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { definePrototype } from '@proto.ui/core';
import {
  datePickerRoot,
  datePickerDay,
} from '/workspace/scratch/44c416809288/Proto-UI/packages/prototypes/base/src/date-picker/index.ts';
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

const results: unknown[] = [];
for (const mode of ['single', 'range'] as const) {
  const initial = mode === 'single' ? { value: '2026-10-10' } : { range: { from: '2026-10-10' } };
  const accepted =
    mode === 'single'
      ? { value: '2026-10-15' }
      : { range: { from: '2026-10-10', to: '2026-10-15' } };
  const later =
    mode === 'single'
      ? { value: '2026-10-16' }
      : { range: { from: '2026-10-10', to: '2026-10-16' } };
  const proposal = mode === 'single' ? 'valueChange' : 'rangeChange';
  for (const scenario of ['noop-nested', 'callback-throw'] as const) {
    const { make, actions, setActionCallback } = runtimeHarness();
    const props = { ...initial, mode, defaultMonth: '2026-10', defaultOpen: true };
    const root = make(datePickerRoot, null, props);
    await root.session.mount();
    let nestedResult: unknown;
    setActionCallback((name) => {
      if (name !== proposal) return;
      root.setProps({ ...props, ...accepted });
      if (scenario === 'callback-throw') throw new Error('reviewer intended callback failure');
      nestedResult =
        mode === 'single'
          ? root.exposes.requestValue('2026-10-15')
          : root.exposes.requestRange({ from: '2026-10-10', to: '2026-10-15' });
    });
    const choose = () =>
      root.session.invokeInCallbackScope(() => root.exposes.requestValue('2026-10-15'));
    try {
      if (scenario === 'noop-nested') {
        assert.equal(choose(), true);
        assert.equal(nestedResult, false);
        assert.deepEqual(actions, [proposal, 'openChange']);
        assert.equal(root.exposes.open.get(), false);
      } else {
        assert.throws(choose, /reviewer intended callback failure/);
        assert.deepEqual(actions, [proposal]);
        assert.equal(root.exposes.open.get(), true);
        setActionCallback(() => {});
        root.setProps({ ...props, ...accepted });
        assert.equal(root.exposes.open.get(), true);
        assert.deepEqual(actions, [proposal]);
        root.session.invokeInCallbackScope(() =>
          mode === 'single'
            ? root.exposes.requestValue('2026-10-16')
            : root.exposes.requestRange({ from: '2026-10-10', to: '2026-10-16' })
        );
        assert.deepEqual(actions, [proposal, proposal]);
        root.setProps({ ...props, ...later });
        assert.deepEqual(actions, [proposal, proposal, 'openChange']);
        assert.equal(root.exposes.open.get(), false);
      }
      results.push({ mode, scenario, passed: true, actions: [...actions] });
    } finally {
      await root.session.dispose();
    }
  }
}
const result = {
  ok: true,
  cases: results,
  boundary:
    'Independent real Runtime/Calendar source probe; synthetic portable host events, no native browser.',
};
writeFileSync(
  '/workspace/scratch/44c416809288/evidence/datepicker-completion-independent-probe.json',
  JSON.stringify(result, null, 2) + '\n'
);
console.log(JSON.stringify(result));
