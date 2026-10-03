import { describe, expect, it, vi } from 'vitest';
import { tw, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import type { RulePort } from '@proto.ui/module-rule';
import {
  RULE_META_STYLE_SUPPORT_SOURCE_CAP,
  RULE_META_GET_CAP,
  type StyleSupportInvalidationSource,
  type StyleSupportKey,
  type RuleMetaFacade,
} from '@proto.ui/module-rule-meta';
import { createRuntimeSession } from '../../src';

const KEY = 'styleSupport.alphaFill';
function source(initial: unknown = true) {
  let value = initial;
  const active = new Set<() => void>();
  const callbacks: Array<() => void> = [];
  const keys: StyleSupportKey[][] = [];
  const result: StyleSupportInvalidationSource = {
    getter: (key) => (key === KEY ? value : key === 'reducedMotion' ? 'reduce' : undefined),
    subscribe(requested, invalidate) {
      keys.push([...requested]);
      callbacks.push(invalidate);
      active.add(invalidate);
      return () => {
        active.delete(invalidate);
      };
    },
  };
  return {
    source: result,
    active,
    callbacks,
    keys,
    set(next: unknown) {
      value = next;
      for (const fn of active) fn();
    },
  };
}
function fixture(options: { key?: string | null; paired?: boolean; mismatch?: boolean } = {}) {
  const provider = source();
  const styles: StyleHandle[] = [];
  const render = vi.fn();
  const session = createRuntimeSession(
    {
      name: 'style-support-lifetime',
      setup(def) {
        def.feedback.style.use(tw('bg-white'));
        if (options.key !== null)
          def.rule({
            when: (w) => w.meta(options.key ?? KEY).eq(true),
            intent: (i) => i.feedback.style.use(tw('bg-blue-500')),
          });
        return (r) => {
          render();
          return r.el('span', 'preference');
        };
      },
    },
    {
      prototypeName: 'style-support-lifetime',
      getRawProps: () => ({}),
      schedule: (fn) => fn(),
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('rule-meta', [
          [
            RULE_META_GET_CAP,
            options.mismatch ? (k: string) => provider.source.getter(k) : provider.source.getter,
          ],
        ]);
        if (options.paired !== false)
          wiring.attach('rule-meta', [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, provider.source]]);
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            { queueStyle: (style: StyleHandle) => styles.push(style), requestFlush() {} },
          ],
        ]);
      },
    }
  );
  return {
    session,
    provider,
    styles,
    render,
    wiring: session.caps.getWiring(),
    meta: session.caps.getFacades()['rule-meta'] as RuleMetaFacade,
    rule: session.caps.getPort<RulePort<any>>('rule')!,
  };
}
describe('bounded style support lifetime', () => {
  it.each([{ paired: false }, { mismatch: true }])(
    'fails closed with an unpaired source: %j',
    async (options) => {
      const f = fixture(options);
      await f.session.mount();
      expect(f.meta.get(KEY)).toBe('unknown');
      expect(f.styles.at(-1)?.tokens).toEqual(['bg-white']);
      expect(f.provider.active.size).toBe(0);
      await f.session.dispose();
    }
  );
  it.each([null, 'reducedMotion', 'locale'])(
    'does not subscribe for legacy/non-consuming key %s',
    async (key) => {
      const f = fixture({ key });
      await f.session.mount();
      expect(f.provider.active.size).toBe(0);
      expect(f.meta.get('reducedMotion')).toBe('reduce');
      expect(f.meta.get('locale')).toBeUndefined();
      await f.session.dispose();
    }
  );
  it('subscribes once to exact authored keys and changes style without rendering', async () => {
    const f = fixture();
    expect(f.meta.get(KEY)).toBe('unknown');
    await f.session.mount();
    await f.session.mount();
    expect(f.provider.keys).toEqual([[KEY]]);
    expect(f.meta.get(KEY)).toBe(true);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-blue-500']);
    const renders = f.render.mock.calls.length;
    f.provider.set(false);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-white']);
    f.provider.set(true);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-blue-500']);
    expect(f.render).toHaveBeenCalledTimes(renders);
    await f.session.dispose();
  });
  it('invalidates source loss, getter mismatch and stale callback before rebind', async () => {
    const f = fixture();
    await f.session.mount();
    const old = f.provider.callbacks[0];
    f.wiring.reset('rule-meta');
    expect(f.provider.active.size).toBe(0);
    expect(f.meta.get(KEY)).toBe('unknown');
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-white']);
    const before = f.styles.length;
    old();
    expect(f.styles).toHaveLength(before);
    f.wiring.attach('rule-meta', [
      [RULE_META_GET_CAP, f.provider.source.getter],
      [RULE_META_STYLE_SUPPORT_SOURCE_CAP, f.provider.source],
    ]);
    expect(f.provider.active.size).toBe(1);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-blue-500']);
    f.wiring.attach('rule-meta', [[RULE_META_GET_CAP, (k: string) => f.provider.source.getter(k)]]);
    expect(f.provider.active.size).toBe(0);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-white']);
    await f.session.dispose();
  });
  it('detaches, remounts unchanged values, and rejects disposed and old-generation callbacks', async () => {
    const f = fixture();
    await f.session.mount();
    const old = f.provider.callbacks[0];
    await f.session.unmount();
    expect(f.meta.get(KEY)).toBe('unknown');
    expect(f.provider.active.size).toBe(0);
    const detached = f.styles.length;
    old();
    expect(f.styles).toHaveLength(detached);
    await f.session.mount();
    expect(f.provider.active.size).toBe(1);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-blue-500']);
    const remounted = f.styles.length;
    old();
    expect(f.styles).toHaveLength(remounted);
    const last = f.provider.callbacks.at(-1)!;
    await f.session.dispose();
    expect(f.provider.active.size).toBe(0);
    const disposed = f.styles.length;
    last();
    expect(f.styles).toHaveLength(disposed);
  });
  it('keeps explicit evaluator overrides and normalizes invalid provider values', async () => {
    const f = fixture();
    await f.session.mount();
    f.provider.set('invalid');
    expect(f.meta.get(KEY)).toBe('unknown');
    expect(f.rule.evaluate({ props: {}, readMeta: () => true })).toMatchObject({
      plan: { tokens: ['bg-blue-500'] },
    });
    await f.session.dispose();
  });
  it('withdraws enhancement on source loss even while its sampled getter survives', async () => {
    const f = fixture();
    await f.session.mount();
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-blue-500']);
    const old = f.provider.callbacks[0];
    f.wiring.attach('rule-meta', [[RULE_META_STYLE_SUPPORT_SOURCE_CAP, undefined as any]]);
    expect(f.meta.get(KEY)).toBe('unknown');
    expect(f.provider.active.size).toBe(0);
    expect(f.styles.at(-1)?.tokens).toEqual(['bg-white']);
    const before = f.styles.length;
    old();
    expect(f.styles).toHaveLength(before);
    await f.session.dispose();
  });
});
