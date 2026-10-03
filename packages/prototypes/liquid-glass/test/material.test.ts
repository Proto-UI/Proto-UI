import { describe, expect, it } from 'vitest';
import { type StyleHandle } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import {
  RULE_META_GET_CAP,
  RULE_META_PREFERENCE_SOURCE_CAP,
  RULE_META_STYLE_SUPPORT_SOURCE_CAP,
} from '@proto.ui/module-rule-meta';
import button from '../src/button';

const safe: Record<string, unknown> = {
  'preference.reducedMotion': 'no-preference',
  'preference.reducedTransparency': 'no-preference',
  'preference.contrast': 'no-preference',
  'preference.forcedColors': 'none',
  'styleSupport.alphaFill': true,
  'styleSupport.backdropBlur4px': true,
};
function fixture(props: Record<string, unknown> = {}) {
  const values = { ...safe };
  const callbacks = new Set<() => void>();
  const getter = (key: string) => values[key];
  const source = {
    getter,
    subscribe(_keys: readonly string[], invalidate: () => void) {
      callbacks.add(invalidate);
      return () => {
        callbacks.delete(invalidate);
      };
    },
  };
  const styles: StyleHandle[] = [];
  const root = new EventTarget();
  let commits = 0;
  const session = createRuntimeSession(button, {
    prototypeName: button.name,
    getRawProps: () => props,
    schedule: (fn) => fn(),
    commit(_children, signal) {
      commits++;
      signal?.done();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => new EventTarget()],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, root],
        [AS_TRIGGER_PARENT_CAP, () => null],
        [AS_TRIGGER_GET_PROTO_CAP, () => null],
      ]);
      wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, getter],
        [RULE_META_PREFERENCE_SOURCE_CAP, source],
        [RULE_META_STYLE_SUPPORT_SOURCE_CAP, source],
      ]);
      wiring.attach('feedback', [
        [
          EFFECTS_CAP,
          {
            queueStyle(style: StyleHandle) {
              styles.push(style);
            },
            requestFlush() {},
          },
        ],
      ]);
    },
  });
  return {
    session,
    source,
    callbacks,
    styles,
    get commits() {
      return commits;
    },
    change(key: string, value: unknown) {
      values[key] = value;
      for (const invalidate of callbacks) invalidate();
    },
    tokens() {
      return styles.at(-1)?.tokens ?? [];
    },
  };
}
function expectEnhanced(f: ReturnType<typeof fixture>) {
  expect(f.tokens()).toContain('bg-secondary/80');
  expect(f.tokens()).toContain('backdrop-blur-xs');
}
function expectOpaque(f: ReturnType<typeof fixture>) {
  expect(f.tokens()).not.toContain('bg-secondary/80');
  expect(f.tokens()).not.toContain('backdrop-blur-xs');
  expect(f.tokens()).toContain('bg-secondary');
}
describe('Liquid Glass live bounded material policy', () => {
  it.each([
    ['preference.reducedTransparency', 'reduce'],
    ['preference.reducedMotion', 'reduce'],
    ['preference.contrast', 'more'],
    ['preference.contrast', 'less'],
    ['preference.contrast', 'custom'],
    ['preference.forcedColors', 'active'],
    ['styleSupport.alphaFill', false],
    ['styleSupport.backdropBlur4px', false],
    ['preference.reducedTransparency', 'unknown'],
    ['styleSupport.alphaFill', 'unknown'],
  ])(
    'withdraws material immediately for %s=%s and restores without structural render',
    async (key, value) => {
      const f = fixture();
      await f.session.mount();
      expectEnhanced(f);
      const commits = f.commits;
      f.change(key, value);
      expectOpaque(f);
      expect(f.commits).toBe(commits);
      f.change(key, safe[key]);
      expectEnhanced(f);
      expect(f.commits).toBe(commits);
      await f.session.dispose();
      expect(f.callbacks.size).toBe(0);
    }
  );
  it('honors opaque opt-out, prominent readability and restored default props', async () => {
    const f = fixture({ material: 'opaque' });
    await f.session.mount();
    expectOpaque(f);
    f.session.controller.applyRawProps({});
    // This minimal host does not run an Adapter's prop-to-surface sync.
    // Check normalized Rule intent here; real-browser tests own paint.
    expect(f.session.controller.getRuleStyleTokens()).toContain('bg-secondary/80');
    f.session.controller.applyRawProps({ variant: 'prominent' });
    expect(f.session.controller.getRuleStyleTokens()).toContain('bg-primary');
    expect(f.session.controller.getRuleStyleTokens()).not.toContain('backdrop-blur-xs');
    await f.session.dispose();
  });
  it('withdraws on source loss, ignores retired invalidation and re-enables after paired recovery', async () => {
    const f = fixture();
    await f.session.mount();
    expectEnhanced(f);
    const old = [...f.callbacks];
    const wiring = f.session.caps.getWiring();
    wiring.attach('rule-meta', [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, undefined as any]]);
    expectOpaque(f);
    old.forEach((fn) => fn());
    expectOpaque(f);
    wiring.attach('rule-meta', [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, f.source]]);
    expectEnhanced(f);
    await f.session.unmount();
    expect(f.callbacks.size).toBe(0);
    await f.session.mount();
    expectEnhanced(f);
    await f.session.dispose();
    expect(f.callbacks.size).toBe(0);
  });
});
