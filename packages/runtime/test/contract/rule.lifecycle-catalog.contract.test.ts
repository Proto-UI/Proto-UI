import { describe, expect, it } from 'vitest';
import { tw, type OwnedStateHandle, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { RAW_PROPS_SOURCE_CAP } from '@proto.ui/module-props';
import type { RulePort } from '@proto.ui/module-rule';
import { createRuntimeSession } from '../../src';

describe('Rule Runtime catalog', () => {
  it('delivers changed resolved Props to Rule styles after author watches without a template commit', async () => {
    let raw: Record<string, unknown> = { accent: false };
    const subscribers = new Set<() => void>();
    const styles: StyleHandle[] = [];
    const events: string[] = [];
    let renders = 0;
    let commits = 0;
    const session = createRuntimeSession<{ accent: boolean }>(
      {
        name: 'rule-catalog-props-delivery',
        setup(def) {
          def.props.define({ accent: { type: 'boolean', default: false } });
          def.props.watchAll((run, _next, prev) => {
            events.push(`all:${prev.accent}->${run.props.get().accent}`);
          });
          def.props.watch(['accent'], (run, next) => {
            events.push(`key:${next.accent}:${run.props.get().accent}`);
          });
          def.feedback.style.use(tw('bg-green-500 w-56'));
          def.rule({
            when: (w) => w.prop('accent').eq(true),
            intent: (i) => i.feedback.style.use(tw('bg-red-500 w-64')),
          });
          return (r) => {
            renders++;
            return r.el('span', 'stable');
          };
        },
      },
      {
        prototypeName: 'rule-catalog-props-delivery',
        getRawProps: () => raw as { accent: boolean },
        schedule: (task) => task(),
        commit: (_children, signal) => {
          commits++;
          signal?.done();
        },
        onRuntimeReady: (wiring) => {
          wiring.attach('props', [
            [
              RAW_PROPS_SOURCE_CAP,
              {
                get: () => raw,
                subscribe: (cb: () => void) => {
                  subscribers.add(cb);
                  return () => subscribers.delete(cb);
                },
              },
            ],
          ]);
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              {
                queueStyle: (style: StyleHandle) => {
                  styles.push(style);
                  events.push('style');
                },
                requestFlush: () => {},
              },
            ],
          ]);
        },
      }
    );
    const deliver = (next: Record<string, unknown>) => {
      raw = next;
      for (const notify of subscribers) notify();
      session.invokeInCallbackScope(() => {
        events.push(`callback:${session.kernel.run.props.get().accent}`);
      });
    };

    await session.mount();
    expect(styles.at(-1)?.tokens).toEqual(['bg-green-500', 'w-56']);
    const before = { renders, commits };
    styles.length = 0;
    events.length = 0;
    deliver({ accent: true });
    expect(events).toEqual(['all:false->true', 'key:true:true', 'style', 'callback:true']);
    expect(styles.at(-1)?.tokens).toEqual(['bg-red-500', 'w-64']);
    expect({ renders, commits }).toEqual(before);

    styles.length = 0;
    events.length = 0;
    deliver({ accent: true });
    deliver({ accent: 'invalid' }); // Raw changes, but resolution retains the accepted true.
    expect(session.kernel.run.props.getRaw().accent).toBe('invalid');
    expect(events).toEqual(['callback:true', 'callback:true']);
    expect(styles).toEqual([]);
    expect({ renders, commits }).toEqual(before);

    events.length = 0;
    session.controller.applyRawProps({ accent: false });
    expect(events).toEqual(['all:true->false', 'key:false:false', 'style']);
    expect(styles.at(-1)?.tokens).toEqual(['bg-green-500', 'w-56']);
    expect({ renders, commits }).toEqual(before);

    await session.unmount();
    styles.length = 0;
    events.length = 0;
    deliver({ accent: true });
    expect(events).toEqual(['all:false->true', 'key:true:true', 'callback:true']);
    expect(styles).toEqual([]);
    expect({ renders, commits }).toEqual(before);
    await session.mount();
    expect(styles.at(-1)?.tokens).toEqual(['bg-red-500', 'w-64']);
    await session.dispose();
  });

  it('T-RULE-0002-CASE-LIFETIME: deduplicates state subscriptions, rebinds per epoch and ends at terminal disposal', async () => {
    let state!: OwnedStateHandle<boolean>;
    let renders = 0,
      commits = 0,
      setups = 0;
    const styles: StyleHandle[] = [];
    const session = createRuntimeSession(
      {
        name: 'rule-catalog-lifetime',
        setup(def) {
          setups++;
          state = def.state.bool('active', false);
          def.feedback.style.use(tw('text-white'));
          def.rule({
            when: (w) => w.state(state).eq(true),
            intent: (i) => i.feedback.style.use(tw('opacity-50')),
          });
          def.rule({
            when: (w) => w.state(state).eq(true),
            intent: (i) => i.feedback.style.use(tw('bg-blue-500')),
          });
          return (r) => {
            renders++;
            return r.el('span', 'stable');
          };
        },
      },
      {
        prototypeName: 'rule-catalog-lifetime',
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_children, signal) => {
          commits++;
          signal?.done();
        },
        onRuntimeReady: (wiring) =>
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              { queueStyle: (s: StyleHandle) => styles.push(s), requestFlush: () => {} },
            ],
          ]),
      }
    );
    await session.mount();
    for (let epoch = 0; epoch < 2; epoch++) {
      styles.length = 0;
      const before = { renders, commits };
      session.invokeInCallbackScope(() => state.set(true));
      expect(styles).toHaveLength(1); // One watcher for the same state in two Rules.
      expect(styles[0].tokens).toEqual(['text-white', 'opacity-50', 'bg-blue-500']);
      expect({ renders, commits }).toEqual(before);
      await session.unmount();
      styles.length = 0;
      session.invokeInCallbackScope(() => state.set(false));
      expect(styles).toEqual([]);
      await session.mount();
      expect(styles.at(-1)?.tokens).toEqual(['text-white']);
    }
    expect(setups).toBe(1);
    const rule = session.caps.getPort<RulePort<Record<string, unknown>>>('rule')!;
    await session.dispose();
    expect(rule.exportIR()).toEqual([]);
    expect(() => rule.evaluate({ props: {} })).toThrow(/disposed/i);
  });
});
