import { describe, expect, it, vi } from 'vitest';
import { appendDemoPublicInstanceHook, createDemoPublicInstances } from './demo-public-instances';
import type { DemoPublicInstance, DemoPublicInstancesSnapshot } from './demo-types';
const instance = (): DemoPublicInstance => ({ getExposes: () => ({}) });

describe('committed public instance identity subscriptions', () => {
  it('preserves existing vnode hook this and args, scheduling even when the hook throws', () => {
    const receiver = { calls: 0 };
    const vnode = { key: 'node' };
    const schedule = vi.fn();
    const hook = appendDemoPublicInstanceHook(function (this: typeof receiver, value) {
      this.calls += 1;
      expect(value).toBe(vnode);
    }, schedule);
    hook.call(receiver, vnode);
    expect(receiver.calls).toBe(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    const error = new Error('original hook');
    const failing = appendDemoPublicInstanceHook(function (this: typeof receiver) {
      this.calls += 1;
      throw error;
    }, schedule);
    expect(() => failing.call(receiver)).toThrow(error);
    expect(receiver.calls).toBe(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });
  it('batches pairs, deduplicates unchanged identities, and retires without reentry resurrection', async () => {
    let current = true;
    const values = { target: instance(), control: instance() };
    const events: Array<[DemoPublicInstancesSnapshot, number]> = [];
    const hub = createDemoPublicInstances({
      read: (ref) => values[ref as keyof typeof values],
      current: () => current,
      fail: (error) => {
        throw error;
      },
    });
    const off = hub.subscribe(['target', 'control'], (snapshot, revision) =>
      events.push([snapshot, revision])
    );
    expect(events).toHaveLength(1);
    expect(Object.isFrozen(events[0][0])).toBe(true);
    hub.schedule();
    hub.schedule();
    await Promise.resolve();
    expect(events).toHaveLength(1);
    values.target = instance();
    hub.schedule();
    values.control = instance();
    hub.schedule();
    await Promise.resolve();
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual([values, 1]);
    const reentered = vi.fn();
    hub.subscribe(['control'], (snapshot) => {
      if (!snapshot.control) hub.subscribe(['control'], reentered);
    });
    current = false;
    hub.retire();
    expect(events.at(-1)).toEqual([{ target: undefined, control: undefined }, 2]);
    expect(reentered).not.toHaveBeenCalled();
    off();
    hub.schedule();
    await Promise.resolve();
    expect(events).toHaveLength(3);
  });

  it('honors unsubscribe during another listener and continues all retirement deliveries after errors', async () => {
    let value = instance();
    const hub = createDemoPublicInstances({
      read: () => value,
      current: () => true,
      fail: (error) => {
        throw error;
      },
    });
    let offSecond = () => {};
    hub.subscribe(['control'], (_, revision) => {
      if (revision) offSecond();
    });
    const second = vi.fn();
    offSecond = hub.subscribe(['control'], second);
    value = instance();
    hub.schedule();
    await Promise.resolve();
    expect(second).toHaveBeenCalledTimes(1);
    const error = new Error('retire');
    hub.subscribe(['control'], (snapshot) => {
      if (!snapshot.control) throw error;
    });
    const terminal = vi.fn();
    hub.subscribe(['control'], terminal);
    expect(() => hub.retire()).toThrow(error);
    expect(terminal.mock.calls.at(-1)?.[0]).toEqual({ control: undefined });
  });

  it('routes synchronous and scheduled callback failures through owner revocation', () => {
    const pending: Array<() => void> = [];
    const queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => {
      pending.push(fn);
    });
    try {
      let value = instance();
      let current = true;
      const error = new Error('consumer');
      let hub: ReturnType<typeof createDemoPublicInstances>;
      const fail = vi.fn((failure: unknown): never => {
        current = false;
        hub.retire();
        throw failure;
      });
      hub = createDemoPublicInstances({ read: () => value, current: () => current, fail });
      hub.subscribe(['control'], (snapshot, revision) => {
        if (snapshot.control && revision) throw error;
      });
      value = instance();
      hub.schedule();
      expect(() => pending.shift()!()).toThrow(error);
      expect(current).toBe(false);
      expect(fail).toHaveBeenCalledWith(error);
      const later = vi.fn();
      hub.subscribe(['control'], later);
      expect(later).not.toHaveBeenCalled();
      current = true;
      hub = createDemoPublicInstances({ read: () => value, current: () => current, fail });
      expect(() =>
        hub.subscribe(['control'], () => {
          throw error;
        })
      ).toThrow(error);
      expect(current).toBe(false);
    } finally {
      queue.mockRestore();
    }
  });
});
