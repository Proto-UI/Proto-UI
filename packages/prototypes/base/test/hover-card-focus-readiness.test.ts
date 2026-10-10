import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { hoverCardRoot, hoverCardTrigger } from '../src/hover-card';
import { HOVER_CARD_CONTEXT } from '../src/hover-card/shared';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
} from '@proto.ui/module-focus';

// Real source Runtime/Focus modules with deterministic host queues and delay
// scheduling. EventTargets stand in for host views; this is not browser input.
let fixtureId = 0;
async function fixture(rootProps: Record<string, unknown> = {}) {
  const probeProto = definePrototype({
    name: `hovercard-readiness-probe-${++fixtureId}`,
    setup(def) {
      let run: any;
      def.context.subscribe(HOVER_CARD_CONTEXT);
      def.lifecycle.onCreated((current) => {
        run = current;
      });
      def.expose.method('snapshot', () => run.context.read(HOVER_CARD_CONTEXT));
    },
  });
  const rootToken = new EventTarget(),
    triggerToken = new EventTarget(),
    probeToken = new EventTarget();
  const parents = new Map([
    [rootToken, null],
    [triggerToken, rootToken],
    [probeToken, rootToken],
  ]);
  const protos = new Map<any, any>([
    [rootToken, hoverCardRoot],
    [triggerToken, hoverCardTrigger],
    [probeToken, probeProto],
  ]);
  const targets = new Map([
    [rootToken, new EventTarget()],
    [triggerToken, new EventTarget()],
    [probeToken, new EventTarget()],
  ]);
  const globalTarget = new EventTarget();
  const timers: { due: number; task(): void; active: boolean }[] = [];
  const applications: unknown[] = [];
  let now = 0,
    targetReady = true;
  function make(token: EventTarget, raw: Record<string, unknown>) {
    let record: any, session: ReturnType<typeof createRuntimeSession>;
    const requests: [string, any][] = [],
      queue: (() => void)[] = [];
    const host: RuntimeHost<any> = {
      prototypeName: protos.get(token).name,
      getRawProps: () => raw,
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        queue.push(task);
      },
      scheduleDelay(duration, task) {
        const timer = { due: now + duration, task, active: true };
        timers.push(timer);
        return {
          cancel() {
            timer.active = false;
          },
        };
      },
      onRuntimeReady(wiring) {
        wiring.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (next: any) => {
              record = next;
            },
          ],
        ]);
        wiring.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (key: string, payload: any) => requests.push([key, payload])],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => targets.get(token)],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (item: EventTarget) => parents.get(item) ?? null],
          [ANATOMY_GET_PROTO_CAP, (item: EventTarget) => protos.get(item) ?? null],
          [ANATOMY_ROOT_TARGET_CAP, (item: EventTarget) => targets.get(item)],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (item: EventTarget) => parents.get(item) ?? null],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, token],
          [FOCUS_PARENT_CAP, (item: EventTarget) => parents.get(item) ?? null],
          [FOCUS_ROOT_TARGET_CAP, () => (targetReady ? targets.get(token) : null)],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (target: EventTarget, options: unknown, kind: unknown) => {
              applications.push({ options, kind });
              target.dispatchEvent(new Event('host:focus'));
              return true;
            },
          ],
          [
            FOCUS_RUN_IN_CALLBACK_CAP,
            (fn: () => void) => (session ? session.invokeInCallbackScope(fn) : fn()),
          ],
        ]);
      },
    };
    session = createRuntimeSession(protos.get(token), host);
    return {
      session,
      queue,
      requests,
      get record() {
        return record;
      },
    };
  }
  const root = make(rootToken, { openDelay: 0, closeDelay: 20, ...rootProps });
  const trigger = make(triggerToken, {});
  const probe = make(probeToken, {});
  function flush() {
    while ([root, trigger, probe].some((item) => item.queue.length))
      for (const item of [root, trigger, probe]) while (item.queue.length) item.queue.shift()!();
  }
  function tick(ms: number) {
    now += ms;
    for (const timer of timers)
      if (timer.active && timer.due <= now) {
        timer.active = false;
        timer.task();
      }
    flush();
  }
  async function mount(item = trigger) {
    const pending = item.session.mount();
    flush();
    await pending;
    flush();
  }
  for (const item of [root, trigger, probe]) await mount(item);
  function snapshot() {
    let context: any;
    probe.session.invokeInCallbackScope(() => {
      context = probe.record.snapshot();
    });
    return { context, open: root.record.open.get(), focused: trigger.record.focused.get() };
  }
  function requestFocus() {
    trigger.session.invokeInCallbackScope(() => trigger.record.focusSelf({ reason: 'keyboard' }));
  }
  return {
    root,
    trigger,
    applications,
    flush,
    tick,
    mount,
    snapshot,
    requestFocus,
    getTarget() {
      return targets.get(triggerToken)!;
    },
    fire(type: 'host:focus' | 'host:blur') {
      targets.get(triggerToken)!.dispatchEvent(new Event(type));
    },
    setTargetReady(next: boolean) {
      targetReady = next;
    },
    replaceTarget() {
      targets.set(triggerToken, new EventTarget());
    },
    async preparePending() {
      await trigger.session.unmount();
      targetReady = false;
      requestFocus();
      targets.set(triggerToken, new EventTarget());
      targetReady = true;
    },
    async cleanup() {
      for (const item of [trigger, probe, root]) await item.session.dispose();
    },
  };
}

describe('HoverCard consumes real Focus readiness transitions', () => {
  it('publishes newly fulfilled pending focus after its contribution owner mounts', async () => {
    // T-BASE-HOVER-CARD-TRIGGER-0001-CASE-FOCUS-READINESS
    const f = await fixture({ openDelay: 10 });
    try {
      await f.preparePending();
      expect(f.snapshot().focused).toBe(false);
      const pending = f.trigger.session.mount();
      // Focus onMountPhase has fulfilled the request; author onMounted is queued.
      expect(f.snapshot().focused).toBe(true);
      expect(f.applications).toHaveLength(1);
      expect(f.snapshot().context.triggerInteractionOwner).toBe(null);
      f.flush();
      await pending;
      f.tick(9);
      expect(f.snapshot().open).toBe(false);
      f.tick(1);
      expect(f.snapshot().context.triggerFocused).toBe(true);
      expect(f.snapshot().context.triggerInteractionOwner).not.toBe(null);
      expect(f.snapshot().open).toBe(true);
      expect(f.root.requests).toEqual([['openChange', { open: true, reason: 'trigger.focus' }]]);
    } finally {
      await f.cleanup();
    }
  });

  it('never samples an unchanged retained true fact to reopen', async () => {
    const f = await fixture();
    try {
      f.fire('host:focus');
      f.tick(0);
      expect(f.snapshot().open).toBe(true);
      await f.trigger.session.unmount();
      f.tick(20);
      expect(f.snapshot().focused).toBe(true);
      expect(f.snapshot().open).toBe(false);
      f.replaceTarget();
      await f.mount();
      f.fire('host:focus');
      f.tick(0);
      expect(f.snapshot().context.triggerFocused).toBe(false);
      expect(f.snapshot().open).toBe(false);
      expect(f.root.requests).toHaveLength(2);
    } finally {
      await f.cleanup();
    }
  });

  it('actual unmount cancels observations from an epoch whose author mounted callback is still queued', async () => {
    const f = await fixture();
    try {
      await f.preparePending();
      const cancelled = f.trigger.session.mount();
      expect(f.snapshot().focused).toBe(true);
      await f.trigger.session.unmount();
      f.flush();
      await cancelled;
      f.replaceTarget();
      await f.mount();
      f.tick(50);
      expect(f.snapshot().focused).toBe(true);
      expect(f.snapshot().context.triggerFocused).toBe(false);
      expect(f.snapshot().context.triggerInteractionOwner).toBe(null);
      expect(f.snapshot().open).toBe(false);
      expect(f.root.requests).toEqual([]);
    } finally {
      await f.cleanup();
    }
  });

  it.each([
    { label: 'true then false', events: ['host:blur'] as const, expected: false },
    {
      label: 'true then false then true',
      events: ['host:blur', 'host:focus'] as const,
      expected: true,
    },
  ])(
    'before owner readiness, $label publishes only the latest observation',
    async ({ events, expected }) => {
      const f = await fixture();
      try {
        await f.preparePending();
        const pending = f.trigger.session.mount();
        for (const type of events) f.fire(type);
        f.flush();
        await pending;
        f.tick(0);
        expect(f.snapshot().focused).toBe(expected);
        expect(f.snapshot().context.triggerFocused).toBe(expected);
        expect(f.snapshot().open).toBe(expected);
        expect(f.root.requests).toHaveLength(expected ? 1 : 0);
      } finally {
        await f.cleanup();
      }
    }
  );

  it('keeps controlled open false when the owner refuses newly fulfilled focus', async () => {
    const f = await fixture({ open: false });
    try {
      await f.preparePending();
      await f.mount();
      f.tick(0);
      expect(f.snapshot().focused).toBe(true);
      expect(f.snapshot().context.triggerFocused).toBe(true);
      expect(f.snapshot().open).toBe(false);
      expect(f.root.requests).toEqual([['openChange', { open: true, reason: 'trigger.focus' }]]);
    } finally {
      await f.cleanup();
    }
  });

  it.each(['trigger', 'root'] as const)(
    '%s disabled before author mount clears observations without replay on re-enable',
    async (owner) => {
      const f = await fixture();
      try {
        await f.preparePending();
        const pending = f.trigger.session.mount();
        f[owner].session.controller.applyRawProps({ disabled: true });
        f.flush();
        await pending;
        f.tick(0);
        expect(f.snapshot().open).toBe(false);
        f[owner].session.controller.applyRawProps({ disabled: false });
        f.tick(20);
        expect(f.snapshot().open).toBe(false);
        expect(f.root.requests).toEqual([]);
      } finally {
        await f.cleanup();
      }
    }
  );

  it('ignores actual events on a retired target while the replacement target still works', async () => {
    const f = await fixture();
    try {
      const retiredTarget = f.getTarget();
      await f.trigger.session.unmount();
      f.replaceTarget();
      await f.mount();
      retiredTarget.dispatchEvent(new Event('host:focus'));
      f.tick(0);
      expect(f.snapshot().focused).toBe(false);
      expect(f.snapshot().context.triggerFocused).toBe(false);
      expect(f.root.requests).toEqual([]);
      f.fire('host:focus');
      f.tick(0);
      expect(f.snapshot().focused).toBe(true);
      expect(f.snapshot().context.triggerFocused).toBe(true);
      expect(f.snapshot().open).toBe(true);
      expect(f.root.requests).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it('terminal Root and Trigger teardown cannot deliver an earlier observed focus', async () => {
    const f = await fixture();
    try {
      await f.preparePending();
      const pending = f.trigger.session.mount();
      expect(f.snapshot().focused).toBe(true);
      await f.root.session.dispose();
      await f.trigger.session.dispose();
      f.flush();
      await pending;
      f.tick(50);
      expect(f.root.requests).toEqual([]);
      expect(f.applications).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it('continues to publish a fresh focus request made after author mount', async () => {
    const f = await fixture();
    try {
      await f.trigger.session.unmount();
      f.replaceTarget();
      await f.mount();
      f.requestFocus();
      f.tick(0);
      expect(f.snapshot().open).toBe(true);
      expect(f.root.requests).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });
});
