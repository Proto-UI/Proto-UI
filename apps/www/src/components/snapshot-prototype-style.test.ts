import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import { createContextKey, definePrototype, tw } from '@proto.ui/core';
import { createStyleSnapshotter, renderSnapshotTokenCss } from './snapshot-prototype-style';

// Source/CSSOM membership evidence. The native first-frame CI owns the actual
// cascade and pixel result; this reconstructs the offending stylesheet order.
function matchingDeclarations(css: string, element: HTMLElement) {
  const output: Record<string, string> = {};
  for (const rule of css.matchAll(/(:where\([^{}]+\))\s*\{([^{}]*)\}/g)) {
    if (!element.matches(rule[1]!)) continue;
    for (const declaration of rule[2]!.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      output[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim();
    }
  }
  return output;
}

describe('snapshot CSS stays with its exact startup owner', () => {
  it('cannot let a later Button snapshot override another Text explicit leading', () => {
    const text = document.createElement('span');
    text.setAttribute('data-pui-style', 'text-sm leading-normal');
    const canonical = renderProtoStyleTokenCss(['leading-normal', 'text-sm']);
    const unscoped = canonical + renderSnapshotTokenCss(['text-sm']);
    expect(matchingDeclarations(unscoped, text)['line-height']).toBe('1.25rem');
    const scoped = canonical + renderSnapshotTokenCss(['text-sm'], '[data-startup-menu]');
    expect(matchingDeclarations(scoped, text)['line-height']).toBe('1.5');
    text.setAttribute('data-startup-menu', '');
    expect(matchingDeclarations(scoped, text)['line-height']).toBe('1.25rem');
  });

  it('retains token membership, variants, zero specificity and reset-free output', () => {
    const css = renderSnapshotTokenCss(['text-sm', 'disabled:opacity-50'], '[data-snapshot="one"]');
    expect(css).toContain(':where([data-snapshot="one"][data-pui-style~="text-sm"])');
    expect(css).toContain(':where([data-snapshot="one"][data-pui-style~="disabled:opacity-50"])');
    expect(css).toContain(':disabled');
    expect(css).not.toContain('box-sizing: border-box');
    const other = document.createElement('span');
    other.dataset.snapshot = 'two';
    other.setAttribute('data-pui-style', 'text-sm');
    expect(matchingDeclarations(css, other)).toEqual({});
  });
});

describe('finite snapshot isolated Context root', () => {
  it('supports own provider and update without leaking across overlapping snapshots', async () => {
    const key = createContextKey<{ enabled: boolean }>('snapshot-isolation');
    let disposed = 0;
    const provider = definePrototype<{ enabled?: boolean }>({
      name: 'snapshot-provider',
      setup(def) {
        def.props.define({ enabled: { type: 'boolean' } });
        const enabled = def.state.bool('enabled', false);
        def.rule({
          when: (w) => w.state(enabled).eq(true),
          intent: (i) => i.feedback.style.use(tw('block')),
        });
        def.rule({
          when: (w) => w.state(enabled).eq(false),
          intent: (i) => i.feedback.style.use(tw('hidden')),
        });
        def.context.provide(key, { enabled: false });
        def.context.subscribe(key);
        def.context.trySubscribeAncestor(key);
        def.lifecycle.onMounted((run) => {
          expect(run.context.tryReadAncestor(key)).toBeNull();
          run.context.update(key, { enabled: !!run.props.get().enabled });
          enabled.set(run.context.read(key).enabled);
        });
        def.lifecycle.onBeforeDispose(() => {
          disposed++;
        });
        return () => null;
      },
    });
    const reader = definePrototype({
      name: 'snapshot-unrelated-reader',
      setup(def) {
        def.context.trySubscribe(key);
        def.feedback.style.use(tw('inline-block'));
        def.lifecycle.onMounted((run) => {
          expect(run.context.tryRead(key)).toBeNull();
        });
        return () => null;
      },
    });
    const snapshot = createStyleSnapshotter({ provider, reader });
    const results = await Promise.all([
      snapshot('provider', { enabled: true }),
      snapshot('provider', { enabled: false }),
      snapshot('reader', {}),
    ]);
    expect(results).toEqual([['block'], ['hidden'], ['inline-block']]);
    expect(disposed).toBe(2);
    expect(await snapshot('reader', {})).toEqual(['inline-block']);
    expect(() => snapshot('unknown' as 'provider', {})).toThrow('Unreviewed');
  });
});

it('disposes a provided context when mounted snapshot evaluation fails', async () => {
  const key = createContextKey<{ value: number }>('snapshot-failure-cleanup');
  let disposed = 0;
  const failing = definePrototype({
    name: 'snapshot-failing-provider',
    setup(def) {
      def.context.provide(key, { value: 1 });
      def.lifecycle.onBeforeDispose(() => {
        disposed++;
      });
      def.lifecycle.onMounted(() => {
        throw new Error('snapshot intentional failure');
      });
      return () => null;
    },
  });
  const reader = definePrototype({
    name: 'snapshot-reader-after-failure',
    setup(def) {
      def.context.trySubscribe(key);
      def.feedback.style.use(tw('block'));
      def.lifecycle.onMounted((run) => {
        expect(run.context.tryRead(key)).toBeNull();
      });
      return () => null;
    },
  });
  const snapshot = createStyleSnapshotter({ failing, reader });
  await expect(snapshot('failing', {})).rejects.toThrow('snapshot intentional failure');
  expect(disposed).toBe(1);
  expect(await snapshot('reader', {})).toEqual(['block']);
});
