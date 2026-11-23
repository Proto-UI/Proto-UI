import { describe, expect, it } from 'vitest';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-text-control';
import input from '../src/input';

async function fixture(props: { value?: string; defaultValue?: string }) {
  let target = document.createElement('input');
  const boundary = document.createElement('div');
  let exposes!: {
    value: { get(): string; subscribe(callback: () => void): () => void };
    composing: { get(): boolean; subscribe(callback: () => void): () => void };
    resetValue(value?: string): boolean;
  };
  const events: Array<{ name: string; payload: unknown }> = [];
  const session = createRuntimeSession(input, {
    prototypeName: input.name,
    getRawProps: () => props,
    schedule: (work) => work(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => boundary],
        [EVENT_GLOBAL_TARGET_CAP, () => window],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, boundary],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('text-control', [
        [TEXT_CONTROL_HOST_CAP, createWebTextControlHost(() => target)],
        [
          TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
          (work: () => void) => session.invokeInCallbackScope(work),
        ],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSES_RECORD_SINK_CAP,
          (record: typeof exposes) => {
            exposes = record;
          },
        ],
      ]);
      wiring.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (name: string, payload: unknown) => {
            events.push({ name, payload });
          },
        ],
      ]);
    },
  });
  await session.mount();
  return {
    session,
    events,
    get x() {
      return exposes;
    },
    get target() {
      return target;
    },
    replaceTarget() {
      const old = target;
      target = document.createElement('input');
      return old;
    },
    reset(value?: string) {
      return session.invokeInCallbackScope(() => exposes.resetValue(value));
    },
    compose(value: string) {
      target.dispatchEvent(new CompositionEvent('compositionstart', { data: value }));
      target.value = value;
      target.dispatchEvent(
        new InputEvent('input', {
          data: value,
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
    },
  };
}

describe('Base Input explicit editing reset', () => {
  it('resets uncontrolled value and exposed composition without synthesizing editing events', async () => {
    const f = await fixture({ defaultValue: 'seed' });
    try {
      f.compose('候选');
      expect(f.x.composing.get()).toBe(true);
      const count = f.events.length;
      expect(f.reset('fresh\r\nline')).toBe(true);
      expect(f.x.value.get()).toBe('freshline');
      expect(f.x.composing.get()).toBe(false);
      expect(f.target.value).toBe('freshline');
      expect(f.events).toHaveLength(count);
      expect(f.reset()).toBe(true);
      expect(f.x.value.get()).toBe('seed');
      expect(f.events).toHaveLength(count);
    } finally {
      await f.session.dispose();
    }
  });
  it('retires controlled composition while refusing to replace owner value', async () => {
    const f = await fixture({ value: 'owner' });
    try {
      f.compose('candidate');
      const count = f.events.length;
      expect(f.reset('request')).toBe(false);
      expect(f.x.value.get()).toBe('owner');
      expect(f.x.composing.get()).toBe(false);
      expect(f.target.value).toBe('owner');
      expect(f.events).toHaveLength(count);
    } finally {
      await f.session.dispose();
    }
  });
  it('retires a previous editor lease and refuses detached calls', async () => {
    const f = await fixture({ defaultValue: 'seed' });
    try {
      f.compose('候');
      const old = f.replaceTarget();
      expect(f.reset('new')).toBe(true);
      const count = f.events.length;
      old.dispatchEvent(new CompositionEvent('compositionend', { data: 'stale' }));
      expect(f.events).toHaveLength(count);
      expect(f.x.value.get()).toBe('new');
      await f.session.unmount();
      expect(f.reset('detached')).toBe(false);
      expect(f.x.value.get()).toBe('new');
    } finally {
      await f.session.dispose();
    }
  });
  it('does not resume an older reset after synchronous composing-state reentry', async () => {
    const f = await fixture({ defaultValue: 'seed' });
    try {
      f.compose('候');
      let armed = true;
      const stop = f.x.composing.subscribe(() => {
        if (!armed || f.x.composing.get()) return;
        armed = false;
        expect(f.reset('newer')).toBe(true);
      });
      expect(f.reset('older')).toBe(false);
      expect(f.x.value.get()).toBe('newer');
      expect(f.target.value).toBe('newer');
      stop();
    } finally {
      await f.session.dispose();
    }
  });
});
