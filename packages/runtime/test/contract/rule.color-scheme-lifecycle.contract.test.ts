import { describe, expect, it } from 'vitest';
import { tw, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import type { RulePort } from '@proto.ui/module-rule';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '@proto.ui/module-rule-expose-state-web';
import {
  RULE_META_COLOR_SCHEME_SOURCE_CAP,
  RULE_META_GET_CAP,
  type ColorSchemeInvalidationSource,
  type RuleMetaFacade,
} from '@proto.ui/module-rule-meta';
import { createRuntimeSession, type CommitSignal } from '../../src';

function createSource(initial = 'light') {
  let value = initial;
  const active = new Set<() => void>();
  const callbacks: Array<() => void> = [];
  const source: ColorSchemeInvalidationSource = {
    getter: (key) => (key === 'colorScheme' ? value : undefined),
    subscribe(invalidate) {
      callbacks.push(invalidate);
      active.add(invalidate);
      return () => {
        active.delete(invalidate);
      };
    },
  };
  return {
    source,
    active,
    callbacks,
    set(next: string) {
      value = next;
      for (const invalidate of [...active]) invalidate();
    },
  };
}

function createFixture(
  options: {
    initial?: string;
    ruleKey?: string | null;
    attachSource?: boolean;
    mismatch?: boolean;
    deferCommit?: boolean;
  } = {}
) {
  const source = createSource(options.initial);
  const styles: StyleHandle[] = [];
  const signals: CommitSignal[] = [];
  let setups = 0;
  const session = createRuntimeSession(
    {
      name: 'rule-color-scheme-lifetime',
      setup(def) {
        setups++;
        def.feedback.style.use(tw('text-white'));
        if (options.ruleKey !== null)
          def.rule({
            when: (w) => w.meta(options.ruleKey ?? 'colorScheme').eq('dark'),
            intent: (i) => i.feedback.style.use(tw('bg-black')),
          });
        return (r) => r.el('span', 'retained');
      },
    },
    {
      prototypeName: 'rule-color-scheme-lifetime',
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        if (!signal) return;
        if (options.deferCommit) signals.push(signal);
        else signal.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('rule-meta', [
          [
            RULE_META_GET_CAP,
            options.mismatch ? (key: string) => source.source.getter(key) : source.source.getter,
          ],
        ]);
        if (options.attachSource !== false)
          wiring.attach('rule-meta', [[RULE_META_COLOR_SCHEME_SOURCE_CAP, source.source]]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            {
              queueStyle: (style: StyleHandle) => styles.push(style),
              requestFlush() {},
            },
          ],
        ]);
      },
    }
  );
  return {
    session,
    source,
    styles,
    signals,
    setups: () => setups,
    rule: session.caps.getPort<RulePort<Record<string, unknown>>>('rule')!,
    wiring: session.caps.getWiring(),
  };
}

describe('Rule colorScheme lease lifetime', () => {
  it.each([{ ruleKey: null }, { ruleKey: 'locale' }, { attachSource: false }, { mismatch: true }])(
    'keeps non-consuming and unpaired inputs sampled: %j',
    async (options) => {
      const f = createFixture(options);
      try {
        await f.session.mount();
        expect(f.source.active.size).toBe(0);
        expect(f.source.callbacks).toEqual([]);
        const before = f.styles.length;
        f.source.set('dark');
        expect(f.styles).toHaveLength(before);
        if (options.attachSource === false || options.mismatch) {
          expect(f.rule.evaluate({ props: {} })).toMatchObject({ plan: { tokens: ['bg-black'] } });
        }
      } finally {
        await f.session.dispose();
      }
    }
  );

  it('waits for the mounted driver, then samples the current value', async () => {
    const f = createFixture({ deferCommit: true });
    const mount = f.session.mount();
    expect(f.session.mountPhase).toBe('mounting');
    expect(f.source.active.size).toBe(0);
    f.source.set('dark');
    const before = f.styles.length;
    f.rule.requestStyleReevaluation();
    expect(f.styles).toHaveLength(before);
    f.signals.shift()!.done();
    await mount;
    expect(f.source.active.size).toBe(1);
    expect(f.styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black']);
    await f.session.dispose();
  });

  it('keeps authored Meta eligibility when the Web extension lowers every rule', async () => {
    const f = createFixture();
    f.wiring.attach('rule-expose-state-web', [
      [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, () => false],
    ]);
    try {
      await f.session.mount();
      expect(f.rule.exportIR()).toHaveLength(1);
      expect(f.rule.evaluate({ props: {} })).toMatchObject({ plan: { tokens: [] } });
      expect(f.styles.at(-1)?.tokens).toContain('dark:bg-black');
      expect(f.source.active.size).toBe(1);
      f.source.set('dark');
      expect(f.rule.evaluate({ props: {} })).toMatchObject({ plan: { tokens: [] } });
      expect(f.source.active.size).toBe(1);
    } finally {
      await f.session.dispose();
    }
  });

  it('releases at unmounting, ignores late callbacks and reacquires on unchanged-value remount', async () => {
    const f = createFixture({ initial: 'dark' });
    try {
      await f.session.mount();
      await f.session.mount();
      expect(f.source.callbacks).toHaveLength(1);
      const old = f.source.callbacks[0];
      const unmount = f.session.unmount();
      expect(f.source.active.size).toBe(0);
      const leavingCount = f.styles.length;
      old();
      f.rule.requestStyleReevaluation();
      expect(f.styles).toHaveLength(leavingCount);
      await unmount;
      f.source.set('light');
      f.source.set('dark');
      const detachedCount = f.styles.length;
      old();
      expect(f.styles).toHaveLength(detachedCount);
      await f.session.mount();
      expect(f.source.callbacks).toHaveLength(2);
      expect(f.source.active.size).toBe(1);
      expect(f.styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black']);
      const remountedCount = f.styles.length;
      old();
      expect(f.styles).toHaveLength(remountedCount);
      expect(f.setups()).toBe(1);
    } finally {
      await f.session.dispose();
    }
  });

  it('rebinds only matching getter/source pairs and invalidates old leases', async () => {
    const f = createFixture();
    const replacement = createSource('dark');
    try {
      await f.session.mount();
      const old = f.source.callbacks[0];
      f.wiring.reset('rule-meta');
      expect(f.source.active.size).toBe(0);
      f.wiring.attach('rule-meta', [[RULE_META_GET_CAP, replacement.source.getter]]);
      expect(replacement.active.size).toBe(0);
      f.wiring.attach('rule-meta', [[RULE_META_COLOR_SCHEME_SOURCE_CAP, replacement.source]]);
      expect(replacement.active.size).toBe(1);
      expect(f.styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black']);
      let before = f.styles.length;
      old();
      expect(f.styles).toHaveLength(before);
      f.wiring.attach('rule-meta', [[RULE_META_COLOR_SCHEME_SOURCE_CAP, replacement.source]]);
      expect(replacement.callbacks).toHaveLength(1);

      const replaced = replacement.callbacks[0];
      f.wiring.attach('rule-meta', [[RULE_META_GET_CAP, f.source.source.getter]]);
      expect(replacement.active.size).toBe(0);
      before = f.styles.length;
      replaced();
      expect(f.styles).toHaveLength(before);
      f.wiring.attach('rule-meta', [[RULE_META_COLOR_SCHEME_SOURCE_CAP, f.source.source]]);
      expect(f.source.active.size).toBe(1);
      expect(f.styles.at(-1)?.tokens).toEqual(['text-white']);

      f.wiring.reset('rule-meta');
      f.wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, f.source.source.getter],
        [RULE_META_COLOR_SCHEME_SOURCE_CAP, f.source.source],
      ]);
      expect(f.source.active.size).toBe(1);
      expect(f.source.callbacks).toHaveLength(3);
    } finally {
      await f.session.dispose();
    }
  });

  it('uses the current Effects target and stops before terminal disposal completes', async () => {
    const f = createFixture();
    await f.session.mount();
    const current: StyleHandle[] = [];
    f.wiring.attach('feedback', [
      [
        EFFECTS_CAP,
        {
          queueStyle: (style: StyleHandle) => current.push(style),
          requestFlush() {},
        },
      ],
    ]);
    const oldCount = f.styles.length;
    f.source.set('dark');
    expect(f.styles).toHaveLength(oldCount);
    expect(current.at(-1)?.tokens).toEqual(['text-white', 'bg-black']);
    const old = f.source.callbacks[0];
    const disposal = f.session.dispose();
    expect(f.source.active.size).toBe(0);
    const before = current.length;
    old();
    f.rule.requestStyleReevaluation();
    expect(current).toHaveLength(before);
    await disposal;
    expect(() => old()).not.toThrow();
    expect(() => f.rule.requestStyleReevaluation()).not.toThrow();
    expect(f.rule.exportIR()).toEqual([]);
    expect(() => f.rule.evaluate({ props: {} })).toThrow(/disposed/i);
  });

  it('preserves existing extension order and short-circuit behavior through the notification port', async () => {
    const f = createFixture();
    const calls: string[] = [];
    f.rule.registerExtension({
      transformRules(rules) {
        calls.push('transform');
        return rules;
      },
      beforePlan(ctx) {
        calls.push(`before:${ctx.readMeta?.('colorScheme')}`);
        return { kind: 'continue' };
      },
      afterPlan(plan) {
        calls.push('after');
        return { ...plan, tokens: [...plan.tokens, 'underline'] };
      },
    });
    try {
      await f.session.mount();
      calls.length = 0;
      f.source.set('dark');
      expect(calls).toEqual(['transform', 'before:dark', 'after']);
      expect(f.styles.at(-1)?.tokens).toEqual(['text-white', 'bg-black', 'underline']);
      f.rule.registerExtension({
        beforePlan: () => ({
          kind: 'short-circuit',
          execute: () => {
            calls.push('execute');
          },
        }),
      });
      calls.length = 0;
      f.source.set('light');
      expect(calls).toEqual(['transform', 'before:light', 'execute']);
      expect(f.styles.at(-1)?.tokens).toEqual(['text-white']);
    } finally {
      await f.session.dispose();
    }
  });

  it('preserves sampled readers, missing-capability values and explicit readMeta overrides', async () => {
    const f = createFixture({ attachSource: false });
    const meta = f.session.caps.getFacades()['rule-meta'] as RuleMetaFacade;
    try {
      await f.session.mount();
      expect(meta.get('colorScheme')).toBe('light');
      expect(meta.get('locale')).toBeUndefined();
      let locale = 'en';
      f.wiring.attach('rule-meta', [
        [
          RULE_META_GET_CAP,
          (key: string) => {
            if (key === 'colorScheme') return 'dark';
            if (key === 'locale') return locale;
            return undefined;
          },
        ],
      ]);
      expect(meta.get('locale')).toBe('en');
      locale = 'ja';
      expect(meta.get('locale')).toBe('ja');
      expect(f.rule.evaluate({ props: {} })).toMatchObject({ plan: { tokens: ['bg-black'] } });
      expect(f.rule.evaluate({ props: {}, readMeta: () => 'light' })).toMatchObject({
        plan: { tokens: [] },
      });
      expect(f.source.active.size).toBe(0);
      f.wiring.reset('rule-meta');
      expect(meta.get('colorScheme')).toBeUndefined();
      expect(meta.get('locale')).toBeUndefined();
      expect(f.rule.evaluate({ props: {}, readMeta: () => 'dark' })).toMatchObject({
        plan: { tokens: ['bg-black'] },
      });
    } finally {
      await f.session.dispose();
    }
  });
});
