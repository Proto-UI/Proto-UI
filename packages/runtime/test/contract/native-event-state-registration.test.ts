import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { executeWithHost, type RuntimeHost } from '../../src';

describe('native Def Event registration retains State until runtime dispatch', () => {
  it.each(['on', 'onGlobal'] as const)('%s stores the callback before dispatching it', (method) => {
    const trace: string[] = [];
    const root = new EventTarget();
    const global = new EventTarget();
    let readSelected: () => boolean = () => false;
    const prototype = definePrototype({
      name: `native-event-private-state-${method}`,
      setup(def) {
        const selected = def.state.bool('privateHover', false);
        readSelected = () => selected.get();
        trace.push('before registration');
        def.event[method]('pointer.enter', () => {
          trace.push('callback');
          selected.set(true, 'event');
        });
        trace.push('after registration');
        expect(selected.get()).toBe(false);
        return (r) => r.el('div', selected.get() ? 'hovered' : 'idle');
      },
    });
    const scheduled: Array<() => void> = [];
    const host: RuntimeHost<any> = {
      prototypeName: prototype.name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        scheduled.push(task);
      },
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => root],
          [EVENT_GLOBAL_TARGET_CAP, () => global],
        ]);
      },
    };
    executeWithHost(prototype, host);
    expect(trace).toEqual(['before registration', 'after registration']);
    expect(readSelected()).toBe(false);
    while (scheduled.length) scheduled.shift()!();
    expect(trace).toEqual(['before registration', 'after registration']);
    const target = method === 'on' ? root : global;
    const other = method === 'on' ? global : root;
    other.dispatchEvent(new Event('pointer.enter'));
    expect(readSelected()).toBe(false);
    target.dispatchEvent(new Event('pointer.enter'));
    expect(trace).toEqual(['before registration', 'after registration', 'callback']);
    expect(readSelected()).toBe(true);
  });
});
