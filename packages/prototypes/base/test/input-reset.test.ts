import { describe, expect, it } from 'vitest';
import { createRuntimeSession } from '@proto.ui/runtime';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  createWebTextControlHost,
  TEXT_CONTROL_HOST_CAP,
  TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
  type TextControlHostConnection,
} from '@proto.ui/module-text-control';
import input, { type InputRootProps } from '../src/input';
import shadcnInput from '../../shadcn/src/input';
import brutalistInput from '../../brutalist/src/input';

// Complete public roots, including the independent Label target protocol.
// The styled families must inherit the same API without a second text editor.
const prototypes = [input, shadcnInput, brutalistInput] as const;
type InputPrototype = (typeof prototypes)[number];
type InputExposes = ProtoAdapterExposes<typeof input>;

function fixture(proto: InputPrototype, initial: InputRootProps = { defaultValue: 'seed' }) {
  let target = document.createElement('input');
  const boundary = document.createElement('div');
  let props = initial;
  let exposes!: InputExposes;
  const events: Array<{ name: string; payload: unknown }> = [];
  const connections: TextControlHostConnection[] = [];
  const web = createWebTextControlHost(() => target);
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => props,
    schedule: (fn) => fn(),
    commit: (_children, status) => status?.done(),
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
        [
          TEXT_CONTROL_HOST_CAP,
          {
            attach(connection: TextControlHostConnection) {
              connections.push(connection);
              return web.attach(connection);
            },
          },
        ],
        [TEXT_CONTROL_RUN_IN_CALLBACK_CAP, (fn: () => void) => session.invokeInCallbackScope(fn)],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSES_RECORD_SINK_CAP,
          (record: Record<string, unknown>) => {
            exposes = record as InputExposes;
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
  return {
    session,
    events,
    connections,
    get target() {
      return target;
    },
    get x() {
      return exposes;
    },
    setProps(next: InputRootProps) {
      props = { ...props, ...next };
      session.controller.applyRawProps(props);
    },
    replaceTarget() {
      target = document.createElement('input');
    },
    reset(next?: string) {
      let accepted = false;
      session.invokeInCallbackScope(() => {
        accepted = exposes.resetValue(next);
      });
      return accepted;
    },
    compose() {
      target.dispatchEvent(new CompositionEvent('compositionstart', { data: '候' }));
      target.value = '候选';
      target.dispatchEvent(
        new InputEvent('input', {
          data: '候选',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
      expect(exposes.composing.get()).toBe(true);
    },
  };
}

for (const proto of prototypes) {
  describe(`${proto.name} explicit editing reset`, () => {
    it('resets the current uncontrolled editor and retires old input without emitting proposals', async () => {
      const f = fixture(proto);
      await f.session.mount();
      try {
        f.compose();
        f.setProps({ defaultValue: 'new\r\ndefault' });
        expect(f.target.value).toBe('候选');
        const target = f.target;
        const old = f.connections.at(-1)!;
        const count = f.events.length;
        expect(f.reset()).toBe(true);
        expect(f.target).toBe(target);
        expect(f.target.value).toBe('newdefault');
        expect(f.x.value.get()).toBe('newdefault');
        expect(f.x.composing.get()).toBe(false);
        expect(f.events).toHaveLength(count);
        old.onEvent({
          type: 'input',
          value: 'stale',
          composing: false,
          data: 'stale',
          inputType: 'insertText',
        });
        expect(f.x.value.get()).toBe('newdefault');
        expect(f.events).toHaveLength(count);
        expect(f.reset('explicit\r\nvalue\r')).toBe(true);
        expect(f.target.value).toBe('explicitvalue');
        f.target.value = 'fresh';
        f.target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'h' }));
        expect(f.x.value.get()).toBe('fresh');
        expect(f.events.at(-1)).toEqual({
          name: 'valueChange',
          payload: {
            value: 'fresh',
            composing: false,
            data: 'h',
            inputType: 'insertText',
          },
        });
      } finally {
        await f.session.dispose();
      }
    });

    it('retires controlled composition while preserving the owner value and current owner updates', async () => {
      const f = fixture(proto, { value: 'owner' });
      await f.session.mount();
      let stop: (() => void) | undefined;
      try {
        f.compose();
        const old = f.connections.at(-1)!;
        const count = f.events.length;
        expect(f.reset('attempt')).toBe(false);
        expect(f.target.value).toBe('owner');
        expect(f.x.value.get()).toBe('owner');
        expect(f.x.composing.get()).toBe(false);
        old.onEvent({
          type: 'compositionend',
          value: 'stale',
          composing: false,
          data: 'stale',
          inputType: null,
        });
        expect(f.events).toHaveLength(count);
        f.compose();
        stop = f.x.composing.subscribe((event) => {
          if (event.type === 'next' && !f.x.composing.get()) f.setProps({ value: 'new owner' });
        });
        expect(f.reset()).toBe(false);
        expect(f.target.value).toBe('new owner');
        expect(f.x.value.get()).toBe('new owner');
      } finally {
        stop?.();
        await f.session.dispose();
      }
    });

    it('leaves invalid and detached requests inert without losing the retained uncontrolled value', async () => {
      const f = fixture(proto);
      await f.session.mount();
      try {
        f.compose();
        const count = f.events.length;
        const leases = f.connections.length;
        expect(f.reset(42 as unknown as string)).toBe(false);
        expect(f.x.composing.get()).toBe(true);
        expect(f.x.value.get()).toBe('候选');
        expect(f.connections).toHaveLength(leases);
        expect(f.events).toHaveLength(count);
        await f.session.unmount();
        expect(f.reset('detached')).toBe(false);
        f.replaceTarget();
        await f.session.mount();
        expect(f.target.value).toBe('候选');
        expect(f.x.value.get()).toBe('候选');
        expect(f.x.composing.get()).toBe(false);
      } finally {
        await f.session.dispose();
      }
    });

    it('does not publish the outer reset after a composing observer performs a newer reset', async () => {
      const f = fixture(proto);
      await f.session.mount();
      let stop: (() => void) | undefined;
      try {
        f.compose();
        let inner: boolean | undefined;
        stop = f.x.composing.subscribe((event) => {
          if (event.type === 'next' && !f.x.composing.get()) inner = f.reset('newest');
        });
        const count = f.events.length;
        expect(f.reset('superseded')).toBe(false);
        expect(inner).toBe(true);
        expect(f.target.value).toBe('newest');
        expect(f.x.value.get()).toBe('newest');
        expect(f.events).toHaveLength(count);
      } finally {
        stop?.();
        await f.session.dispose();
      }
    });

    it('publishes current logical state on remount without resuming a retired reset callback', async () => {
      const f = fixture(proto);
      const transitions: Promise<void>[] = [];
      await f.session.mount();
      let stop: (() => void) | undefined;
      try {
        f.compose();
        let armed = true;
        stop = f.x.composing.subscribe((event) => {
          if (event.type !== 'next' || f.x.composing.get() || !armed) return;
          armed = false;
          transitions.push(f.session.unmount());
          f.replaceTarget();
          transitions.push(f.session.mount());
        });
        const count = f.events.length;
        expect(f.reset('retained reset')).toBe(false);
        await Promise.all(transitions);
        expect(transitions).toHaveLength(2);
        expect(f.target.value).toBe('retained reset');
        expect(f.x.value.get()).toBe('retained reset');
        expect(f.x.composing.get()).toBe(false);
        expect(f.events).toHaveLength(count);
        f.target.value = 'fresh';
        f.target.dispatchEvent(new InputEvent('input', { data: 'h', inputType: 'insertText' }));
        expect(f.x.value.get()).toBe('fresh');
      } finally {
        stop?.();
        await Promise.all(transitions);
        await f.session.dispose();
      }
    });

    it('does not emit a superseded input proposal after a value observer resets the editor', async () => {
      const f = fixture(proto);
      await f.session.mount();
      let stop: (() => void) | undefined;
      try {
        let armed = true;
        stop = f.x.value.subscribe((event) => {
          if (event.type !== 'next' || !armed) return;
          armed = false;
          expect(f.reset('accepted reset')).toBe(true);
        });
        f.target.value = 'superseded candidate';
        f.target.dispatchEvent(new InputEvent('input', { data: 'e', inputType: 'insertText' }));
        expect(f.target.value).toBe('accepted reset');
        expect(f.x.value.get()).toBe('accepted reset');
        expect(f.events).toEqual([]);
      } finally {
        stop?.();
        await f.session.dispose();
      }
    });
  });
}
