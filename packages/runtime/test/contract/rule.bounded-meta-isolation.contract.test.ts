import { describe, expect, it, vi } from 'vitest';
import { tw, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import {
  RULE_META_GET_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  RULE_META_STYLE_SUPPORT_SOURCE_CAP,
  type RuleMetaFacade,
} from '@proto.ui/module-rule-meta';
import { createRuntimeSession } from '../../src';

describe('bounded Meta capability isolation', () => {
  it('rereads the second capability after a reentrant getter/source replacement in the first', async () => {
    const styles: StyleHandle[] = [];
    const getter = (key: string) =>
      key === 'preference.reducedTransparency' ? 'no-preference' : true;
    const replacementGetter = (key: string) => getter(key);
    const currentPrefOff = vi.fn(),
      currentSupportOff = vi.fn(),
      oldPrefOff = vi.fn();
    const currentPref = { getter: replacementGetter, subscribe: vi.fn(() => currentPrefOff) };
    const currentSupport = { getter: replacementGetter, subscribe: vi.fn(() => currentSupportOff) };
    const oldSupport = { getter, subscribe: vi.fn(() => vi.fn()) };
    let replace = () => {};
    const oldPref = {
      getter,
      subscribe: vi.fn(() => {
        replace();
        return oldPrefOff;
      }),
    };
    const session = createRuntimeSession(
      {
        name: 'bounded-meta-isolation',
        setup(def) {
          def.feedback.style.use(tw('bg-background'));
          def.rule({
            when: (w) =>
              w.all(
                w.meta('preference.reducedTransparency').eq('no-preference'),
                w.meta('styleSupport.alphaFill').eq(true)
              ),
            intent: (i) => i.feedback.style.use(tw('bg-primary')),
          });
          return (r) => r.el('span', 'retained');
        },
      },
      {
        prototypeName: 'bounded-meta-isolation',
        getRawProps: () => ({}),
        schedule: (fn) => fn(),
        commit: (_children, signal) => signal?.done(),
        onRuntimeReady(wiring) {
          wiring.attach('rule-meta', [
            [RULE_META_GET_CAP, getter],
            [RULE_META_PREFERENCE_SOURCE_CAP, oldPref],
            [RULE_META_STYLE_SUPPORT_SOURCE_CAP, oldSupport],
          ]);
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
            ],
          ]);
          replace = () =>
            wiring.attach('rule-meta', [
              [RULE_META_GET_CAP, replacementGetter],
              [RULE_META_PREFERENCE_SOURCE_CAP, currentPref],
              [RULE_META_STYLE_SUPPORT_SOURCE_CAP, currentSupport],
            ]);
        },
      }
    );
    await session.mount();
    const meta = session.caps.getFacades()['rule-meta'] as RuleMetaFacade;
    expect(meta.get('preference.reducedTransparency')).toBe('no-preference');
    expect(meta.get('styleSupport.alphaFill')).toBe(true);
    expect(styles.at(-1)?.tokens).toEqual(['bg-primary']);
    expect(oldPrefOff).toHaveBeenCalledTimes(1);
    expect(oldSupport.subscribe).not.toHaveBeenCalled();
    expect(currentPref.subscribe).toHaveBeenCalledTimes(1);
    expect(currentSupport.subscribe).toHaveBeenCalledTimes(1);
    expect(currentPrefOff).not.toHaveBeenCalled();
    expect(currentSupportOff).not.toHaveBeenCalled();
    await session.dispose();
    expect(currentPrefOff).toHaveBeenCalledTimes(1);
    expect(currentSupportOff).toHaveBeenCalledTimes(1);
  });
});
