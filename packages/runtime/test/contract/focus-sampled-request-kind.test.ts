import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type FocusScopeHandle } from '@proto.ui/core';
import { asFocusScope } from '@proto.ui/hooks';
import { executeWithHost, type RuntimeHost } from '../../src';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_SAMPLE_SCOPE_TARGETS_CAP,
  type FocusPort,
} from '@proto.ui/module-focus';
import type { PropsBaseType } from '@proto.ui/types';

describe('sampled scope requests keep descendant acquisition semantics', () => {
  it.each([false, true])(
    'passes entry kind during sampled Shift=%s Tab without synthetic facts',
    (shiftKey) => {
      let scope!: FocusScopeHandle<PropsBaseType>;
      const proto = definePrototype({
        name: `sampled-focus-kind-${shiftKey}`,
        setup() {
          scope = asFocusScope();
          scope.configure({ trap: true, loop: true, entry: 'manual', restore: 'none' });
          return (r) => r.el('div', 'scope');
        },
      });
      const root = document.createElement('div');
      const first = document.createElement('button'),
        second = document.createElement('button');
      root.append(first, second);
      const globalTarget = new EventTarget();
      const request = vi.fn(() => true);
      const sample = vi.fn(() => ({ targets: [first, second], activeTarget: null }));
      const host: RuntimeHost<PropsBaseType> = {
        prototypeName: proto.name,
        getRawProps: () => ({}),
        commit(_children, signal) {
          signal?.done();
        },
        schedule(task) {
          task();
        },
        onRuntimeReady(wiring) {
          wiring.attach('event', [
            [EVENT_ROOT_TARGET_CAP, () => root],
            [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
          ]);
          wiring.attach('focus', [
            [FOCUS_INSTANCE_TOKEN_CAP, root],
            [FOCUS_PARENT_CAP, () => null],
            [FOCUS_ROOT_TARGET_CAP, () => root],
            [FOCUS_SAMPLE_SCOPE_TARGETS_CAP, sample],
            [FOCUS_REQUEST_FOCUS_CAP, request],
          ]);
        },
      };
      const exec = executeWithHost(proto, host);
      const focus = exec.caps.getPort<FocusPort>('focus')!;
      try {
        scope.activate();
        const before = focus.getFacts();
        globalTarget.dispatchEvent(
          new CustomEvent('key.down', { detail: { key: 'Tab', shiftKey } })
        );
        expect(sample).toHaveBeenCalledWith(root, shiftKey ? 'prev' : 'next');
        expect(request).toHaveBeenCalledWith(
          shiftKey ? second : first,
          { reason: 'keyboard' },
          'entry'
        );
        // Sampling asks the host; only host events may change the focus facts.
        expect(focus.getFacts()).toEqual(before);
        expect(focus.getFacts().focused).toBe(false);
      } finally {
        scope.deactivate();
      }
    }
  );
});
