import { expect, it } from 'vitest';
import { definePrototype, type FocusRequestOptions } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusScope, asFocusRoving } from '@proto.ui/hooks';
import { createRuntimeSession, type RuntimeHost } from '../../src';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_TARGET_READY_CAP,
  type FocusRequestKind,
} from '@proto.ui/module-focus';

type Observation = {
  target: HTMLElement;
  options: FocusRequestOptions | undefined;
  kind: FocusRequestKind;
};
function hostFor(name: string, token: object, parent: object | null = null) {
  const calls: Observation[] = [];
  let target: HTMLElement | null = document.createElement('button');
  let notify: (() => void) | undefined;
  let accepts = false;
  const host: RuntimeHost<any> = {
    prototypeName: name,
    getRawProps: () => ({}),
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => target],
        [EVENT_GLOBAL_TARGET_CAP, () => target],
      ]);
      wiring.attach('focus', [
        [FOCUS_INSTANCE_TOKEN_CAP, token],
        [FOCUS_PARENT_CAP, (instance: unknown) => (instance === token ? parent : null)],
        [FOCUS_ROOT_TARGET_CAP, () => target],
        [
          FOCUS_TARGET_READY_CAP,
          (listener: () => void) => {
            notify = listener;
            return () => {
              if (notify === listener) notify = undefined;
            };
          },
        ],
        [
          FOCUS_REQUEST_FOCUS_CAP,
          (
            current: HTMLElement,
            options: FocusRequestOptions | undefined,
            kind: FocusRequestKind
          ) => {
            calls.push({ target: current, options, kind });
            return accepts;
          },
        ],
      ]);
    },
  };
  return {
    host,
    calls,
    accept: (value: boolean) => {
      accepts = value;
    },
    ready: () => notify?.(),
    unavailable: () => {
      target = null;
    },
    replace: () => {
      target = document.createElement('button');
      return target;
    },
  };
}

for (const field of ['reason', 'preventScroll', 'defer'] as const) {
  it(`public empty roving ${field} getter keeps the newer accepted target focus`, async () => {
    let roving!: ReturnType<typeof asFocusRoving>;
    let newer!: ReturnType<typeof asFocusable>;
    const parentToken = {};
    const parent = definePrototype({
      name: `roving-options-parent-${field}`,
      setup() {
        roving = asFocusRoving();
      },
    });
    const target = definePrototype({
      name: `roving-options-newer-${field}`,
      setup() {
        newer = asFocusable();
      },
    });
    const child = definePrototype({
      name: `roving-options-child-${field}`,
      setup() {
        asFocusable();
      },
    });
    const providerHost = hostFor(parent.name, parentToken);
    const newerHost = hostFor(target.name, {});
    const childHost = hostFor(child.name, {}, parentToken);
    newerHost.accept(true);
    childHost.accept(true);
    const parentSession = createRuntimeSession(parent, providerHost.host);
    const newerSession = createRuntimeSession(target, newerHost.host);
    let childSession: ReturnType<typeof createRuntimeSession> | undefined;
    try {
      await parentSession.mount();
      await newerSession.mount();
      const options = { defer: true, reason: 'keyboard' as const, preventScroll: false };
      let reads = 0;
      Object.defineProperty(options, field, {
        get() {
          reads++;
          newerSession.invokeInCallbackScope(() =>
            newer.focus({ reason: 'pointer', preventScroll: true })
          );
          return field === 'reason' ? 'keyboard' : true;
        },
      });
      parentSession.invokeInCallbackScope(() => roving.focusFirst(options));
      expect(newerHost.calls).toHaveLength(1);
      expect(newerHost.calls[0].options).toEqual({ reason: 'pointer', preventScroll: true });
      childSession = createRuntimeSession(child, childHost.host);
      await childSession.mount();
      expect(reads).toBe(1);
      expect(childHost.calls).toHaveLength(0);
    } finally {
      await childSession?.dispose();
      await newerSession.dispose();
      await parentSession.dispose();
    }
  });
}
