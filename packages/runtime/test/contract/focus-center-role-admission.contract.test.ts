import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusScope, asFocusRoving } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { FOCUS_CENTER } from '../../../modules/focus/src/center';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_TARGET_READY_CAP,
} from '@proto.ui/module-focus';

it.each(['none', 'target', 'entry', 'scope', 'roving'] as const)(
  'does not register undeclared construction readiness before role %s',
  async (role) => {
    const token = {};
    const root = document.createElement('div');
    const listeners = new Set<() => void>();
    const ready = () => {
      expect(listeners.size).toBe(1);
      for (const listener of [...listeners]) listener();
    };
    const entries = (FOCUS_CENTER as any).entries;
    const proto = definePrototype({
      name: `focus-center-role-admission-${role}`,
      setup() {
        ready();
        expect(entries.has(token)).toBe(false);
        if (role === 'target') asFocusable();
        else if (role === 'entry') asFocusEntry();
        else if (role === 'scope') asFocusScope();
        else if (role === 'roving') asFocusRoving();
        ready();
        expect(entries.has(token)).toBe(role !== 'none');
        return () => null;
      },
    });
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (fn) => fn(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => root],
          [EVENT_GLOBAL_TARGET_CAP, () => window],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, token],
          [FOCUS_ROOT_TARGET_CAP, () => root],
          [
            FOCUS_TARGET_READY_CAP,
            (listener: () => void) => {
              listeners.add(listener);
              return () => {
                listeners.delete(listener);
              };
            },
          ],
        ]);
      },
    });
    try {
      await session.mount();
      expect(entries.has(token)).toBe(role !== 'none');
    } finally {
      await session.dispose();
      expect(entries.has(token)).toBe(false);
      expect(listeners.size).toBe(0);
    }
  }
);
