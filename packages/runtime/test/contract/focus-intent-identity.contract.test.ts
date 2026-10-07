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

for (const kind of ['programmatic', 'native', 'entry'] as const) {
  it.each(['omitted', 'reused'] as const)(
    `${kind} snapshots each explicit %s request but keeps the same object through Center replay and target replacement`,
    async (mode) => {
      const options = mode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
      let request!: () => void;
      const proto = definePrototype({
        name: `intent-identity-${kind}-${mode}`,
        setup() {
          const target = asFocusable();
          const entry = asFocusEntry();
          entry.configure({ strategy: 'self', fallback: 'self' });
          request = () => {
            if (kind === 'entry') entry.focus(options);
            else if (kind === 'native') target.focusSelf(options);
            else target.focus(options);
          };
        },
      });
      const fixture = hostFor(proto.name, {});
      const session = createRuntimeSession(proto, fixture.host);
      try {
        await session.mount();
        session.invokeInCallbackScope(request);
        const first = fixture.calls[0].options;
        expect(first).toEqual(options ?? {});
        expect(first).not.toBe(options);
        fixture.ready();
        expect(fixture.calls[1].options).toBe(first);
        const replacement = fixture.replace();
        fixture.ready();
        expect(fixture.calls[2]).toMatchObject({ target: replacement, kind });
        expect(fixture.calls[2].options).toBe(first);
        session.invokeInCallbackScope(request);
        const second = fixture.calls[3].options;
        expect(second).not.toBe(first);
        fixture.ready();
        expect(fixture.calls[4].options).toBe(second);
        fixture.unavailable();
        session.invokeInCallbackScope(request);
        fixture.ready();
        expect(fixture.calls).toHaveLength(5);
        const finalTarget = fixture.replace();
        fixture.ready();
        const latest = fixture.calls[5].options;
        expect(latest).not.toBe(second);
        expect(fixture.calls[5].target).toBe(finalTarget);
        fixture.ready();
        expect(fixture.calls[6].options).toBe(latest);
      } finally {
        await session.dispose();
      }
    }
  );
}

it.each(['scope', 'roving', 'deferred-roving'] as const)(
  'preserves Center-originated %s identity through pending replay and distinguishes an explicit repeat',
  async (origin) => {
    let request!: () => void;
    const reused = Object.freeze({ reason: 'keyboard' as const, preventScroll: true, defer: true });
    const parentToken = {};
    const parent = definePrototype({
      name: `intent-origin-${origin}`,
      setup() {
        if (origin === 'scope') {
          const scope = asFocusScope();
          request = () => scope.activate(reused);
        } else {
          const roving = asFocusRoving();
          request = () => roving.focusFirst(origin === 'deferred-roving' ? reused : undefined);
        }
      },
    });
    const child = definePrototype({
      name: `intent-child-${origin}`,
      setup() {
        asFocusable();
      },
    });
    const parentFixture = hostFor(parent.name, parentToken);
    const childFixture = hostFor(child.name, {}, parentToken);
    const parentSession = createRuntimeSession(parent, parentFixture.host);
    const childSession = createRuntimeSession(child, childFixture.host);
    try {
      await parentSession.mount();
      await childSession.mount();
      parentSession.invokeInCallbackScope(request);
      const first = childFixture.calls[0].options;
      expect(first).toBeDefined();
      expect(first).not.toBe(reused);
      childFixture.ready();
      childFixture.ready();
      expect(childFixture.calls).toHaveLength(3);
      expect(childFixture.calls.every((call) => call.options === first)).toBe(true);
      const split = childFixture.calls.length;
      parentSession.invokeInCallbackScope(request);
      const second = childFixture.calls[split].options;
      expect(second).not.toBe(first);
      childFixture.ready();
      expect(childFixture.calls.slice(split).every((call) => call.options === second)).toBe(true);
    } finally {
      await childSession.dispose();
      await parentSession.dispose();
    }
  }
);

it('keeps a pending scope-restore snapshot stable and renews the next explicit activation/deactivation cycle', async () => {
  const reused = Object.freeze({ reason: 'keyboard' as const, preventScroll: true });
  let outsideFocus!: () => void;
  let activate!: () => void;
  let deactivate!: () => void;
  const scopeToken = {};
  const outside = definePrototype({
    name: 'intent-scope-restore-outside',
    setup() {
      const target = asFocusable();
      outsideFocus = () => target.focus(reused);
    },
  });
  const scope = definePrototype({
    name: 'intent-scope-restore-provider',
    setup() {
      const handle = asFocusScope();
      activate = () => handle.activate(reused);
      deactivate = () => handle.deactivate(reused);
    },
  });
  const child = definePrototype({
    name: 'intent-scope-restore-child',
    setup() {
      asFocusable();
    },
  });
  const outsideFixture = hostFor(outside.name, {});
  const scopeFixture = hostFor(scope.name, scopeToken);
  const childFixture = hostFor(child.name, {}, scopeToken);
  const outsideSession = createRuntimeSession(outside, outsideFixture.host);
  const scopeSession = createRuntimeSession(scope, scopeFixture.host);
  const childSession = createRuntimeSession(child, childFixture.host);
  try {
    await outsideSession.mount();
    await scopeSession.mount();
    await childSession.mount();
    outsideFixture.accept(true);
    outsideSession.invokeInCallbackScope(outsideFocus);
    outsideFixture.accept(false);
    scopeSession.invokeInCallbackScope(activate);
    scopeSession.invokeInCallbackScope(deactivate);
    const restore = outsideFixture.calls[1].options;
    expect(restore).not.toBe(reused);
    outsideFixture.ready();
    outsideFixture.ready();
    expect(outsideFixture.calls.slice(1)).toHaveLength(3);
    expect(outsideFixture.calls.slice(1).every((call) => call.options === restore)).toBe(true);
    const split = outsideFixture.calls.length;
    scopeSession.invokeInCallbackScope(activate);
    scopeSession.invokeInCallbackScope(deactivate);
    const next = outsideFixture.calls[split].options;
    expect(next).not.toBe(restore);
    outsideFixture.ready();
    expect(outsideFixture.calls.slice(split).every((call) => call.options === next)).toBe(true);
  } finally {
    await childSession.dispose();
    await scopeSession.dispose();
    await outsideSession.dispose();
  }
});
