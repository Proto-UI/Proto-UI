import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype, type RunHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  asTooltipRoot,
  asTooltipGroup,
  TOOLTIP_CONTEXT,
  TOOLTIP_GROUP_CONTEXT,
} from '../src/tooltip';
import { updateTooltipInteraction } from '../src/tooltip/shared';

const rootProto = definePrototype({
  name: 'test-tooltip-lifetime-root',
  setup(def) {
    asTooltipRoot();
    let run: RunHandle<any>;
    let observer: ((value: any) => void) | undefined;
    def.context.subscribe(TOOLTIP_CONTEXT, (_run, value) => observer?.(value));
    def.expose.method('observe', (fn: (value: any) => void) => {
      observer = fn;
    });
    def.lifecycle.onCreated((r) => {
      run = r;
    });
    def.expose.method('snapshot', () => run.context.read(TOOLTIP_CONTEXT));
    def.expose.method('hover', (hovered: boolean) =>
      updateTooltipInteraction(
        run,
        { triggerHovered: hovered },
        hovered ? 'trigger.pointerenter' : 'trigger.pointerleave'
      )
    );
  },
});
const groupProto = definePrototype({
  name: 'test-tooltip-lifetime-group',
  setup(def) {
    asTooltipGroup();
    let run: RunHandle<any>;
    let observer: ((value: any) => void) | undefined;
    def.lifecycle.onCreated((r) => {
      run = r;
    });
    def.context.subscribe(TOOLTIP_GROUP_CONTEXT, (_run, value) => observer?.(value));
    def.expose.method('snapshot', () => run.context.read(TOOLTIP_GROUP_CONTEXT));
    def.expose.method('observe', (fn: (value: any) => void) => {
      observer = fn;
    });
  },
});

function harness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  const instances: Array<ReturnType<typeof createRuntimeSession>> = [];
  function make(proto: any, parent: any = null, props: Record<string, unknown> = {}) {
    const token = {};
    parents.set(token, parent);
    protos.set(token, proto);
    let exposes: any;
    const events: Array<{ name: string; payload: any }> = [];
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: any) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: any) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (t: any) => parents.get(t) ?? null],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (value: any) => {
              exposes = value;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: any) => {
              events.push({ name, payload });
            },
          ],
        ]);
      },
    });
    instances.push(session);
    return {
      session,
      token,
      events,
      get exposes() {
        return new Proxy(exposes, {
          get(target, key) {
            const value = target[key];
            return typeof value === 'function'
              ? (...args: any[]) => session.invokeInCallbackScope(() => value(...args))
              : value;
          },
        });
      },
    };
  }
  return {
    make,
    reparent(token: any, parent: any) {
      parents.set(token, parent);
    },
    async dispose() {
      for (const instance of instances.reverse()) await instance.dispose();
    },
  };
}

async function fixture() {
  vi.useFakeTimers();
  const h = harness();
  const group = h.make(groupProto, null, { openDelay: 100, closeDelay: 0, skipDelay: 50 });
  await group.session.mount();
  const first = h.make(rootProto, group.token);
  const second = h.make(rootProto, group.token);
  await first.session.mount();
  await second.session.mount();
  return { ...h, group, first, second };
}

afterEach(() => vi.useRealTimers());

describe('Tooltip Group runtime lifetime ownership', () => {
  it.each(['unmount', 'dispose'] as const)(
    'releases the active owner on %s and restores cold opening',
    async (operation) => {
      const f = await fixture();
      try {
        f.first.exposes.openTooltip();
        expect(f.group.exposes.snapshot().activeTooltipId).toBe(f.first.exposes.snapshot().rootId);
        await f.first.session[operation]();
        expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
        await vi.advanceTimersByTimeAsync(50);
        expect(f.group.exposes.snapshot().warm).toBe(false);
        f.second.exposes.hover(true);
        await vi.advanceTimersByTimeAsync(99);
        expect(f.second.exposes.open.get()).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(f.second.exposes.open.get()).toBe(true);
      } finally {
        await f.dispose();
      }
    }
  );

  it('retains the Root open fact and reacquires Group ownership on remount', async () => {
    const f = await fixture();
    try {
      f.first.exposes.openTooltip();
      const id = f.first.exposes.snapshot().rootId;
      await f.first.session.unmount();
      expect(f.first.exposes.open.get()).toBe(true);
      await vi.advanceTimersByTimeAsync(50);
      expect(f.group.exposes.snapshot().warm).toBe(false);
      await f.first.session.mount();
      expect(f.first.exposes.snapshot().rootId).toBe(id);
      expect(f.group.exposes.snapshot().activeTooltipId).toBe(id);
      expect(f.group.exposes.snapshot().warm).toBe(true);
      f.second.exposes.hover(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(f.second.exposes.open.get()).toBe(true);
      expect(f.first.exposes.open.get()).toBe(false);
    } finally {
      await f.dispose();
    }
  });

  it('does not release the newer active sibling when the old Root retires', async () => {
    const f = await fixture();
    try {
      f.first.exposes.openTooltip();
      f.second.exposes.openTooltip();
      const id = f.second.exposes.snapshot().rootId;
      await f.first.session.unmount();
      await f.first.session.dispose();
      await vi.advanceTimersByTimeAsync(100);
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: id, warm: true });
      expect(f.second.exposes.open.get()).toBe(true);
      f.second.exposes.close();
      await vi.advanceTimersByTimeAsync(50);
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
    } finally {
      await f.dispose();
    }
  });

  it('preserves a new active owner opened synchronously during release publication', async () => {
    const f = await fixture();
    try {
      f.first.exposes.openTooltip();
      let handled = false;
      f.group.exposes.observe((value: any) => {
        if (!handled && value.activeTooltipId === null) {
          handled = true;
          f.second.exposes.openTooltip();
        }
      });
      await f.first.session.unmount();
      expect(handled).toBe(true);
      const id = f.second.exposes.snapshot().rootId;
      await f.first.session.dispose();
      await vi.advanceTimersByTimeAsync(100);
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: id, warm: true });
      expect(f.second.exposes.open.get()).toBe(true);
    } finally {
      await f.dispose();
    }
  });

  it('cancels pending pointer intent at the end of the mount epoch', async () => {
    const f = await fixture();
    try {
      f.first.exposes.hover(true);
      await vi.advanceTimersByTimeAsync(25);
      await f.first.session.unmount();
      await vi.advanceTimersByTimeAsync(100);
      expect(f.first.exposes.open.get()).toBe(false);
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
      expect(f.first.events).toEqual([]);
      await f.first.session.mount();
      await vi.advanceTimersByTimeAsync(100);
      expect(f.first.exposes.open.get()).toBe(false);
      f.first.exposes.hover(true);
      await vi.advanceTimersByTimeAsync(99);
      expect(f.first.exposes.open.get()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.first.exposes.open.get()).toBe(true);
    } finally {
      await f.dispose();
    }
  });

  it('keeps controlled open facts distinct from the single active owner', async () => {
    const f = await fixture();
    const controlled = f.make(rootProto, f.group.token, { open: true });
    try {
      await controlled.session.mount();
      f.first.exposes.openTooltip();
      expect(controlled.exposes.open.get()).toBe(true);
      await f.first.session.unmount();
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
      expect(controlled.exposes.open.get()).toBe(true);
      expect(
        controlled.events.some((event) => event.name === 'openChange' && !event.payload.open)
      ).toBe(true);
      f.second.exposes.hover(true);
      await vi.advanceTimersByTimeAsync(99);
      expect(f.second.exposes.open.get()).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.second.exposes.open.get()).toBe(true);
    } finally {
      await f.dispose();
    }
  });

  it('registers a retained open Root with its new nearest Group only', async () => {
    const f = await fixture();
    const otherGroup = f.make(groupProto, null, { openDelay: 200, closeDelay: 0, skipDelay: 50 });
    try {
      await otherGroup.session.mount();
      f.first.exposes.openTooltip();
      const id = f.first.exposes.snapshot().rootId;
      await f.first.session.unmount();
      f.reparent(f.first.token, otherGroup.token);
      await f.first.session.mount();
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
      expect(otherGroup.exposes.snapshot()).toMatchObject({ activeTooltipId: id, warm: true });
      expect(f.first.exposes.snapshot().openDelay).toBe(200);
      await f.first.session.unmount();
      expect(otherGroup.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
    } finally {
      await f.dispose();
    }
  });

  it.each(['unmount', 'dispose'] as const)(
    'does not reannounce after synchronous %s inside open publication',
    async (operation) => {
      const f = await fixture();
      try {
        let handled = false;
        let eventsAtRetirement = 0;
        f.first.exposes.observe((value: any) => {
          if (handled || !value.open) return;
          handled = true;
          eventsAtRetirement = f.first.events.length;
          void f.first.session[operation]();
        });
        expect(() => f.first.exposes.openTooltip()).not.toThrow();
        expect(handled).toBe(true);
        expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
        await vi.advanceTimersByTimeAsync(100);
        expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
        expect(eventsAtRetirement).toBe(1);
        expect(f.first.events).toHaveLength(eventsAtRetirement);
      } finally {
        await f.dispose();
      }
    }
  );

  it.each(['unmount', 'dispose'] as const)(
    'suppresses stale completion after synchronous state-observer %s',
    async (operation) => {
      const f = await fixture();
      try {
        let handled = false;
        f.first.exposes.open.subscribe((event: any) => {
          if (handled || event.type !== 'next' || !event.next) return;
          handled = true;
          void f.first.session[operation]();
        });
        expect(() => f.first.exposes.openTooltip()).not.toThrow();
        expect(handled).toBe(true);
        expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
        expect(f.first.events).toEqual([]);
      } finally {
        await f.dispose();
      }
    }
  );

  it('preserves the ordinary-close warm window when its closed Root retires', async () => {
    const f = await fixture();
    try {
      f.first.exposes.openTooltip();
      f.first.exposes.close();
      const cooling = f.group.exposes.snapshot();
      expect(cooling).toMatchObject({ activeTooltipId: null, warm: true });
      await f.first.session.unmount();
      expect(f.group.exposes.snapshot()).toEqual(cooling);
      await vi.advanceTimersByTimeAsync(49);
      expect(f.group.exposes.snapshot().warm).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(f.group.exposes.snapshot().warm).toBe(false);
    } finally {
      await f.dispose();
    }
  });

  it.each([{ defaultOpen: true }, { open: true }])(
    'registers initial open and releases without a close request: %j',
    async (props) => {
      const f = await fixture();
      const initial = f.make(rootProto, f.group.token, props);
      try {
        await initial.session.mount();
        expect(f.group.exposes.snapshot()).toMatchObject({
          activeTooltipId: initial.exposes.snapshot().rootId,
          warm: true,
        });
        await initial.session.unmount();
        expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: null, warm: false });
        expect(initial.exposes.open.get()).toBe(true);
        expect(initial.events).toEqual([]);
      } finally {
        await f.dispose();
      }
    }
  );

  it('does not let an old opening callback overwrite a retained remount', async () => {
    const f = await fixture();
    try {
      let handled = false;
      let remount: Promise<void> | undefined;
      f.first.exposes.open.subscribe((event: any) => {
        if (handled || event.type !== 'next' || !event.next) return;
        handled = true;
        remount = f.first.session.unmount().then(() => f.first.session.mount());
      });
      f.first.exposes.openTooltip();
      await remount;
      const id = f.first.exposes.snapshot().rootId;
      expect(f.group.exposes.snapshot()).toMatchObject({ activeTooltipId: id, warm: true });
      expect(f.first.exposes.open.get()).toBe(true);
      expect(f.first.events).toEqual([]);
    } finally {
      await f.dispose();
    }
  });
});
