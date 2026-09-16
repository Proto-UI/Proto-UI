import { describe, expect, it } from 'vitest';
import { definePrototype, type OverlayHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { EVENT_GLOBAL_TARGET_CAP, type EventPort } from '@proto.ui/module-event';
import { createRuntimeSession, type RuntimeHost } from '../../src';

async function create(
  name: string,
  target: EventTarget,
  options: { controlled?: boolean; escape?: boolean } = {}
) {
  let overlay!: OverlayHandle;
  let requests = 0;
  const proto = definePrototype({
    name,
    setup() {
      overlay = asOverlay();
      overlay.configure({ defaultOpen: true, closeOnEscape: options.escape ?? true });
      overlay.open.watch((_r, e) => {
        if (e.type !== 'next' || e.next || e.reason !== 'escape') return;
        requests++;
        if (options.controlled) overlay.openOverlay('controlled.sync');
      });
      return (r) => r.el('div');
    },
  });
  const host: RuntimeHost<any> = {
    prototypeName: name,
    getRawProps: () => ({}),
    commit(_c, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [[EVENT_GLOBAL_TARGET_CAP, () => target]]);
    },
  };
  const session = createRuntimeSession(proto, host);
  await session.mount();
  return { overlay, session, requests: () => requests };
}
function escape(target: EventTarget) {
  target.dispatchEvent(new CustomEvent('key.down', { detail: { key: 'Escape' } }));
}

describe('C-AS-OVERLAY-0001-P: scoped single-sample Escape', async () => {
  it('chooses the latest active candidate and skips opt-out while fixing ownership before close', async () => {
    const target = new EventTarget();
    const lower = await create('escape-lower', target);
    const upper = await create('escape-upper', target);
    const optOut = await create('escape-opt-out', target, { escape: false });
    try {
      escape(target);
      expect([lower.requests(), upper.requests(), optOut.requests()]).toEqual([0, 1, 0]);
      escape(target);
      expect([lower.requests(), upper.requests()]).toEqual([1, 1]);
    } finally {
      await optOut.session.dispose();
      await upper.session.dispose();
      await lower.session.dispose();
    }
  });
  it('controlled synchronous reopen consumes the sample once and cannot close the lower owner', async () => {
    const target = new EventTarget();
    const lower = await create('escape-controlled-lower', target);
    const upper = await create('escape-controlled-upper', target, { controlled: true });
    try {
      escape(target);
      escape(target);
      expect(upper.requests()).toBe(2);
      expect(lower.requests()).toBe(0);
      expect(upper.overlay.isOpen()).toBe(true);
    } finally {
      await upper.session.dispose();
      await lower.session.dispose();
    }
  });
  it('isolates input scopes and removes disposed candidates', async () => {
    const a = new EventTarget(),
      b = new EventTarget();
    const first = await create('escape-scope-a', a);
    const second = await create('escape-scope-b', b);
    try {
      escape(a);
      expect(first.requests()).toBe(1);
      expect(second.requests()).toBe(0);
      const third = await create('escape-scope-b-new', b);
      await third.session.dispose();
      escape(b);
      expect(second.requests()).toBe(1);
    } finally {
      await second.session.dispose();
      await first.session.dispose();
    }
  });
  it('keeps repeated-open order, removes detached views and re-enters retained owners', async () => {
    const target = new EventTarget();
    const lower = await create('escape-retained-lower', target, { controlled: true });
    const upper = await create('escape-retained-upper', target, { controlled: true });
    try {
      lower.session.invokeInCallbackScope(() => lower.overlay.openOverlay('programmatic'));
      escape(target);
      expect([lower.requests(), upper.requests()]).toEqual([0, 1]);
      await upper.session.unmount();
      escape(target);
      expect(lower.requests()).toBe(1);
      await upper.session.mount();
      escape(target);
      expect([lower.requests(), upper.requests()]).toEqual([1, 2]);
    } finally {
      await upper.session.dispose();
      await lower.session.dispose();
    }
  });

  it('M-EVENT-0001-K: input metadata is opaque, shared and callback-scoped without changing author payloads', async () => {
    const target = new EventTarget();
    const observations: Array<{ payload: any; context: any; port: EventPort }> = [];
    const sessions = [0, 1].map((index) => {
      let port: EventPort;
      const proto = definePrototype({
        name: `input-identity-${index}`,
        setup(def) {
          def.event.onGlobal('key.down', (_run, payload) => {
            observations.push({ payload, context: port.getInputContext!(payload), port });
            expect(Object.keys(payload).sort()).toEqual(['control', 'key', 'type']);
            expect(Object.isFrozen(payload)).toBe(true);
          });
          return (r) => r.el('div');
        },
      });
      const session = createRuntimeSession(proto, {
        prototypeName: proto.name,
        getRawProps: () => ({}),
        commit: (_c, signal) => signal?.done(),
        schedule: (task) => task(),
        onRuntimeReady(wiring) {
          wiring.attach('event', [[EVENT_GLOBAL_TARGET_CAP, () => target]]);
        },
      });
      port = session.caps.getPort<EventPort>('event')!;
      return session;
    });
    try {
      for (const session of sessions) await session.mount();
      escape(target);
      expect(observations).toHaveLength(2);
      expect(observations[0].payload).not.toBe(observations[1].payload);
      expect(observations[0].context.sample).toBe(observations[1].context.sample);
      expect(observations[0].context.scope).toBe(observations[1].context.scope);
      expect(observations[0].context.scope).not.toBe(target);
      expect(Object.keys(observations[0].context.sample)).toEqual([]);
      for (const observation of observations)
        expect(observation.port.getInputContext!(observation.payload)).toBeNull();
      escape(target);
      expect(observations[2].context.sample).not.toBe(observations[0].context.sample);
    } finally {
      for (const session of sessions) await session.dispose();
    }
  });
});

it('HC-EVENT-BINDING-0001-D: root-only delivery never reads the global input source', async () => {
  const root = new EventTarget();
  let deliveries = 0;
  let globalReads = 0;
  const proto = definePrototype({
    name: 'root-only-input-scope',
    setup(def) {
      def.event.on('key.down', () => {
        deliveries++;
      });
      return (r) => r.el('div');
    },
  });
  const { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_INPUT_SCOPE_CAP } =
    await import('@proto.ui/module-event');
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    commit(_c: unknown, signal: any) {
      signal?.done();
    },
    schedule(task: () => void) {
      task();
    },
    onRuntimeReady(wiring: any) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [
          EVENT_GLOBAL_INPUT_SCOPE_CAP,
          () => {
            globalReads++;
            return {};
          },
        ],
      ]);
    },
  });
  try {
    await session.mount();
    root.dispatchEvent(new CustomEvent('key.down', { detail: { key: 'Enter' } }));
    expect(deliveries).toBe(1);
    expect(globalReads).toBe(0);
  } finally {
    await session.dispose();
  }
});
