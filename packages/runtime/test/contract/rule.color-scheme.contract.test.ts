import { describe, expect, it, vi } from 'vitest';
import { tw, type OwnedStateHandle, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { RAW_PROPS_SOURCE_CAP } from '@proto.ui/module-props';
import {
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_GET_CAP,
  type ColorSchemeInvalidationSource,
} from '@proto.ui/module-rule-meta';
import { createRuntimeSession } from '../../src';

describe('Rule colorScheme invalidation', () => {
  it('updates the complete style contribution without pulling Props or requesting structure', async () => {
    let scheme = 'light';
    const listeners = new Set<() => void>();
    const source: ColorSchemeInvalidationSource = {
      getter: (key) => (key === 'colorScheme' ? scheme : undefined),
      subscribe: (invalidate) => {
        listeners.add(invalidate);
        return () => listeners.delete(invalidate);
      },
    };
    let rawProps = { enabled: true };
    const readProps = vi.fn(() => rawProps);
    let invalidateProps = () => {};
    const watch = vi.fn();
    const render = vi.fn();
    const commit = vi.fn();
    const updated = vi.fn();
    const styles: StyleHandle[] = [];
    let gate!: OwnedStateHandle<boolean>;
    const session = createRuntimeSession(
      {
        name: 'rule-color-scheme-style',
        setup(def) {
          def.props.define({ enabled: { type: 'boolean', empty: 'fallback' } });
          def.props.setDefaults({ enabled: true });
          def.props.watch(['enabled'], watch);
          def.lifecycle.onUpdated(updated);
          def.feedback.style.use(tw('text-white'));
          def.lifecycle.onMounted((run) => {
            run.feedback.style.patch(tw('opacity-100'));
            run.feedback.style.suppress(tw('border-red-500'));
          });
          gate = def.state.bool('gate', true);
          def.rule({
            when: (w) =>
              w.all(
                w.meta('colorScheme').eq('dark'),
                w.prop('enabled').eq(true),
                w.state(gate).eq(true)
              ),
            intent: (i) => i.feedback.style.use(tw('bg-red-500 opacity-50 border-red-500')),
          });
          def.rule({
            when: (w) =>
              w.all(
                w.meta('colorScheme').eq('dark'),
                w.prop('enabled').eq(true),
                w.state(gate).eq(true)
              ),
            intent: (i) => i.feedback.style.use(tw('bg-black')),
          });
          return (r) => {
            render();
            return r.el('span', 'retained');
          };
        },
      },
      {
        prototypeName: 'rule-color-scheme-style',
        getRawProps: readProps,
        schedule: (task) => task(),
        commit: (_children, signal) => {
          commit();
          signal?.done();
        },
        onRuntimeReady(wiring) {
          wiring.attach('props', [
            [
              RAW_PROPS_SOURCE_CAP,
              {
                get: readProps,
                subscribe(invalidate: () => void) {
                  invalidateProps = invalidate;
                  return () => {
                    invalidateProps = () => {};
                  };
                },
              },
            ],
          ]);
          wiring.attach('rule-meta', [
            [RULE_META_GET_CAP, source.getter],
            [RULE_META_COLOR_SCHEME_SOURCE_CAP, source],
          ]);
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
            ],
          ]);
        },
      }
    );
    try {
      expect(listeners.size).toBe(0);
      await session.mount();
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'opacity-100']);
      const before = [
        readProps.mock.calls.length,
        watch.mock.calls.length,
        render.mock.calls.length,
        commit.mock.calls.length,
        updated.mock.calls.length,
      ];
      rawProps = { enabled: false }; // Not yet accepted by the normal Props synchronization path.
      invalidateProps();
      scheme = 'dark';
      for (const invalidate of listeners) invalidate();
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black', 'opacity-100']);
      expect([
        readProps.mock.calls.length,
        watch.mock.calls.length,
        render.mock.calls.length,
        commit.mock.calls.length,
        updated.mock.calls.length,
      ]).toEqual(before);
      expect(listeners.size).toBe(1);

      session.controller.update();
      expect(watch.mock.calls.length).toBe(before[1] + 1);
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'opacity-100']);
      rawProps = { enabled: true };
      invalidateProps();
      session.controller.update();
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black', 'opacity-100']);
      const rendered = render.mock.calls.length;
      session.invokeInCallbackScope(() => gate.set(false));
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'opacity-100']);
      session.invokeInCallbackScope(() => gate.set(true));
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black', 'opacity-100']);
      expect(render.mock.calls.length).toBe(rendered);

      scheme = 'light';
      for (const invalidate of listeners) invalidate();
      expect(styles.at(-1)?.tokens).toEqual(['text-white', 'opacity-100']);
    } finally {
      await session.dispose();
    }
    expect(listeners.size).toBe(0);
  });
});
