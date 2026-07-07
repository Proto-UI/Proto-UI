import { describe, expect, it } from 'vitest';
import type { DefHandle, EffectsPort, Prototype, StyleHandle } from '@proto.ui/core';
import { tw } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { executeWithHost, type RuntimeHost } from '../../src';

describe('runtime: feedback.style runtime patch v0', () => {
  it('exposes patch/suppress/clearPatch on the runtime feedback style handle', () => {
    const styles: StyleHandle[] = [];
    const proto: Prototype = {
      name: 'feedback-style-runtime-patch-surface',
      setup(def: DefHandle<any>) {
        def.feedback.style.use(tw('opacity-50 bg-blue-500'));
        def.lifecycle.onMounted((run: any) => {
          expect(typeof run.feedback.style.patch).toBe('function');
          expect(typeof run.feedback.style.suppress).toBe('function');
          expect(typeof run.feedback.style.clearPatch).toBe('function');

          run.feedback.style.patch(tw('opacity-100'));
          run.feedback.style.suppress(tw('bg-blue-500'));
          run.feedback.style.clearPatch();
        });
        return (r: any) => [r.el('div', 'ok')];
      },
    } as any;

    executeWithHost(proto, makeHost(proto.name, styles));

    expect(lastTokens(styles)).toEqual(['opacity-50', 'bg-blue-500']);
  });

  it('applies patch and suppress over setup style without structural render', () => {
    const styles: StyleHandle[] = [];
    let renderCount = 0;
    let commitCount = 0;

    const proto: Prototype = {
      name: 'feedback-style-runtime-patch-no-render',
      setup(def: DefHandle<any>) {
        def.feedback.style.use(tw('opacity-50 bg-blue-500 text-white'));
        def.lifecycle.onMounted((run: any) => {
          run.feedback.style.patch(tw('opacity-100'));
          run.feedback.style.suppress(tw('bg-blue-500'));
        });
        return (r: any) => {
          renderCount += 1;
          return [r.el('div', 'ok')];
        };
      },
    } as any;

    executeWithHost(
      proto,
      makeHost(proto.name, styles, {
        onCommit: () => {
          commitCount += 1;
        },
      })
    );

    expect(lastTokens(styles)).toEqual(['text-white', 'opacity-100']);
    expect(renderCount).toBe(1);
    expect(commitCount).toBe(1);
  });

  it('applies the patch layer after rule-produced style intents and before style translation', () => {
    const styles: StyleHandle[] = [];

    const proto: Prototype<{ active?: boolean }> = {
      name: 'feedback-style-runtime-patch-after-rule',
      setup(def: DefHandle<{ active?: boolean }>) {
        def.props.define({ active: { type: 'boolean', default: true } } as any);
        def.rule({
          when: (w) => w.prop('active').eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50 bg-blue-500')),
        });
        def.lifecycle.onMounted((run: any) => {
          run.feedback.style.patch(tw('opacity-100'));
          run.feedback.style.suppress(tw('bg-blue-500'));
        });
        return (r: any) => [r.el('div', 'ok')];
      },
    } as any;

    executeWithHost(
      proto,
      makeHost(proto.name, styles, {
        rawProps: { active: true },
      })
    );

    expect(lastTokens(styles)).toEqual(['opacity-100']);
  });

  it('replaces rule-produced runtime style with one effects flush', () => {
    const styles: StyleHandle[] = [];
    let flushCount = 0;
    let mode: { set(v: string, reason?: unknown): void } | undefined;

    const proto: Prototype = {
      name: 'feedback-style-runtime-rule-replace',
      setup(def: DefHandle<any>) {
        mode = def.state.string('mode', 'a');
        def.rule({
          when: (w) => w.state(mode as any).eq('a'),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        def.rule({
          when: (w) => w.state(mode as any).eq('b'),
          intent: (i) => i.feedback.style.use(tw('bg-muted')),
        });
        return (r: any) => [r.el('div', 'ok')];
      },
    } as any;

    const result = executeWithHost(
      proto,
      makeHost(proto.name, styles, {
        onFlush: () => {
          flushCount += 1;
        },
      })
    );

    styles.length = 0;
    flushCount = 0;

    result.invokeInCallbackScope(() => {
      mode?.set('b', 'test: switch rule style');
    });

    expect(flushCount).toBe(1);
    expect(styles).toHaveLength(1);
    expect(lastTokens(styles)).toEqual(['bg-muted']);
  });

  it('rejects runtime patch inputs that are not author-side style tokens', () => {
    const proto: Prototype = {
      name: 'feedback-style-runtime-patch-token-purity',
      setup(def: any) {
        def.lifecycle.onMounted((run: any) => {
          run.feedback.style.patch(tw('hover:opacity-100'));
        });
        return (r: any) => [r.el('div', 'ok')];
      },
    } as any;

    expect(() => executeWithHost(proto, makeHost(proto.name, []))).toThrow();
  });
});

function makeHost(
  prototypeName: string,
  styles: StyleHandle[],
  options: {
    rawProps?: Record<string, any>;
    onCommit?: () => void;
    onFlush?: () => void;
  } = {}
): RuntimeHost<any> {
  const effects: EffectsPort = {
    queueStyle(handle) {
      styles.push({ kind: handle.kind, tokens: [...handle.tokens] });
    },
    requestFlush() {
      options.onFlush?.();
    },
  };

  return {
    prototypeName,
    getRawProps: () => options.rawProps ?? {},
    commit(_children, signal) {
      options.onCommit?.();
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('feedback', [[EFFECTS_CAP, effects]]);
    },
  };
}

function lastTokens(styles: StyleHandle[]): string[] {
  return styles[styles.length - 1]?.tokens ?? [];
}
