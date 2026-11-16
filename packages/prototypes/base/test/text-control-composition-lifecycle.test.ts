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
import textarea from '../src/textarea';
import shadcnInput from '../../shadcn/src/input';
import shadcnTextarea from '../../shadcn/src/textarea';
import brutalistInput from '../../brutalist/src/input';
import brutalistTextarea from '../../brutalist/src/textarea';

// C-TEXT-CONTROL-0001-F and M-TEXT-CONTROL-0001-B: a logical instance
// retains its value across a view lease, not the retired IME session.
const cases = [
  { proto: input, tag: 'input' },
  { proto: shadcnInput, tag: 'input' },
  { proto: brutalistInput, tag: 'input' },
  { proto: textarea, tag: 'textarea' },
  { proto: shadcnTextarea, tag: 'textarea' },
  { proto: brutalistTextarea, tag: 'textarea' },
] as const;

for (const { proto, tag } of cases) {
  describe(`${proto.name} composition view lifetime`, () => {
    it.each(['controlled', 'uncontrolled'] as const)(
      'retires composition without losing %s value ownership',
      async (mode) => {
        let target = document.createElement(tag);
        const boundary = document.createElement('div');
        let exposes: {
          value: { get(): string };
          composing: { get(): boolean };
        };
        const events: Array<{ name: string; payload: unknown }> = [];
        const props = mode === 'controlled' ? { value: 'owner' } : { defaultValue: 'seed' };
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
              [TEXT_CONTROL_HOST_CAP, createWebTextControlHost(() => target)],
              [
                TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
                (fn: () => void) => session.invokeInCallbackScope(fn),
              ],
            ]);
            wiring.attach('expose-state', [
              [
                EXPOSES_RECORD_SINK_CAP,
                (record: any) => {
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

        try {
          await session.mount();
          target.dispatchEvent(new CompositionEvent('compositionstart', { data: '候' }));
          target.value = '候选';
          target.dispatchEvent(
            new InputEvent('input', {
              data: '候选',
              inputType: 'insertCompositionText',
              isComposing: true,
            })
          );
          expect(exposes!.composing.get()).toBe(true);
          const eventCount = events.length;
          const oldTarget = target;

          await session.unmount();
          expect(exposes!.composing.get()).toBe(false);
          oldTarget.dispatchEvent(new CompositionEvent('compositionend', { data: '旧' }));
          expect(events).toHaveLength(eventCount);

          target = document.createElement(tag);
          await session.mount();
          expect(exposes!.composing.get()).toBe(false);
          expect(target.value).toBe(mode === 'controlled' ? 'owner' : '候选');
          expect(exposes!.value.get()).toBe(mode === 'controlled' ? 'owner' : '候选');
          expect(events).toHaveLength(eventCount);

          target.value = 'fresh';
          target.dispatchEvent(new InputEvent('input', { data: 'h', inputType: 'insertText' }));
          expect(exposes!.composing.get()).toBe(false);
          expect(events.at(-1)).toMatchObject({
            name: 'valueChange',
            payload: { value: 'fresh', composing: false },
          });
          expect(events.filter((event) => event.name === 'compositionEnd')).toEqual([]);
        } finally {
          await session.dispose();
        }
      }
    );
    it.each(['value-state', 'composition-state', 'value-event', 'composition-event'] as const)(
      'does not resume a retired event after synchronous %s withdrawal',
      async (source) => {
        let target = document.createElement(tag);
        const boundary = document.createElement('div');
        let exposes: {
          value: { get(): string; subscribe(fn: (event: any) => void): () => void };
          composing: { get(): boolean; subscribe(fn: (event: any) => void): () => void };
        };
        const events: Array<{ name: string; payload: unknown }> = [];
        const transitions: Promise<void>[] = [];
        let armed = false;
        const withdraw = () => {
          if (!armed) return;
          armed = false;
          transitions.push(session.unmount());
          target = document.createElement(tag);
          transitions.push(session.mount());
        };
        const session = createRuntimeSession(proto, {
          prototypeName: proto.name,
          getRawProps: () => ({ defaultValue: 'seed' }),
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
              [TEXT_CONTROL_HOST_CAP, createWebTextControlHost(() => target)],
              [
                TEXT_CONTROL_RUN_IN_CALLBACK_CAP,
                (fn: () => void) => session.invokeInCallbackScope(fn),
              ],
            ]);
            wiring.attach('expose-state', [
              [
                EXPOSES_RECORD_SINK_CAP,
                (record: any) => {
                  exposes = record;
                },
              ],
            ]);
            wiring.attach('expose-event', [
              [
                EXPOSE_EVENT_SINK_CAP,
                (name: string, payload: unknown) => {
                  events.push({ name, payload });
                  if (
                    (source === 'value-event' && name === 'valueChange') ||
                    (source === 'composition-event' && name === 'compositionStart')
                  )
                    withdraw();
                },
              ],
            ]);
          },
        });
        let stop: (() => void) | undefined;
        try {
          await session.mount();
          if (source === 'value-state' || source === 'composition-state') {
            const state = source === 'value-state' ? exposes!.value : exposes!.composing;
            stop = state.subscribe((event) => {
              if (event.type === 'next') withdraw();
            });
          }
          armed = true;
          target.value = 'candidate';
          target.dispatchEvent(
            source === 'value-state' || source === 'value-event'
              ? new InputEvent('input', {
                  data: '候',
                  inputType: 'insertCompositionText',
                  isComposing: true,
                })
              : new CompositionEvent('compositionstart', { data: '候' })
          );
          await Promise.all(transitions);
          expect(transitions).toHaveLength(2);
          expect(exposes!.composing.get()).toBe(false);
          const deliveredBeforeWithdrawal = source.endsWith('-event') ? 1 : 0;
          expect(events).toHaveLength(deliveredBeforeWithdrawal);
          target.value = 'current';
          target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 't' }));
          expect(events).toHaveLength(deliveredBeforeWithdrawal + 1);
          expect(events.at(-1)).toEqual({
            name: 'valueChange',
            payload: { value: 'current', composing: false, inputType: 'insertText', data: 't' },
          });
        } finally {
          armed = false;
          stop?.();
          await Promise.all(transitions);
          await session.dispose();
        }
      }
    );
  });
}
