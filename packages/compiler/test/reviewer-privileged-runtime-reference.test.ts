import { expect, it } from 'vitest';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { executeWithHost, type RuntimeHost } from '../../runtime/src';

it('records each once reuse with the original privileged raw result, handle, and global order', async () => {
  let focus: any;
  let captured: any;
  const after = defineAsHook({ name: 'after', setup() {} });
  const outer = defineAsHook({
    name: 'outer',
    setup() {
      asFocusable();
      after();
      asFocusable();
    },
  });
  const prototype = definePrototype({
    name: 'runtime-privileged-reference',
    setup() {
      focus = asFocusable();
      captured = outer();
      return (r) => r.el('div', []);
    },
  });
  const host: RuntimeHost<{}> = {
    prototypeName: prototype.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule() {},
    onRuntimeReady(wiring) {
      const target = new EventTarget();
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => target],
        [EVENT_GLOBAL_TARGET_CAP, () => target],
      ]);
    },
    onUnmountBegin() {},
  };
  const runtime = executeWithHost(prototype, host);
  try {
    expect(
      captured.asHooks.map((entry: any) => [entry.name, entry.order, entry.privileged, entry.mode])
    ).toEqual([
      ['asFocusable', 0, true, 'once'],
      ['after', 2, false, 'once'],
      ['asFocusable', 0, true, 'once'],
    ]);
    const first = captured.getAsHook('asFocusable');
    const repeated = captured.asHooks[2];
    expect(first.result).toBe(focus);
    expect(first.handle).toBe(focus);
    expect(captured.getAsHookHandle('asFocusable')).toBe(focus);
    expect(repeated.result).toBe(focus);
    expect(repeated.handle).toBe(focus);
    expect(typeof first.result.focused.watch).toBe('function');
  } finally {
    await runtime.session.dispose();
  }
});
