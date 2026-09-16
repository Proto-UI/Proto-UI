import { describe, expect, it } from 'vitest';
import { tw, type OwnedStateHandle, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import type { RulePort } from '@proto.ui/module-rule';
import { createRuntimeSession } from '../../src';

describe('Rule Runtime catalog', () => {
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
