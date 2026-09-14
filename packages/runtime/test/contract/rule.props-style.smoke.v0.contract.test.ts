// packages/runtime/test/contract/rule.props-style.smoke.v0.contract.test.ts
import { describe, it, expect } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { tw } from '@proto.ui/core';
import { executeWithHost, type RuntimeHost } from '../../src';

/**
 * Smoke contract: when.props x intent.feedback.style (v0)
 */
describe('rule contract smoke: props -> style (v0)', () => {
  it('evaluates rule on props and produces style tokens', () => {
    const proto: Prototype<{ active?: boolean }> = {
      name: 'rule-props-style-smoke',
      setup(def) {
        def.props.define({ active: { type: 'boolean', default: false } } as any);
        def.rule({
          when: (w) => w.prop('active').eq(true),
          intent: (i) => i.feedback.style.use(tw('text-red-500')),
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    let rawProps: Record<string, any> = { active: false };
    const host: RuntimeHost<any> = {
      prototypeName: 'rule-props-style-smoke',
      getRawProps() {
        return rawProps;
      },
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    const { controller } = executeWithHost(proto as any, host as any);

    // inactive -> no tokens
    let tokens = controller.getRuleStyleTokens();
    expect(tokens).toEqual([]);

    // activate -> tokens
    rawProps = { active: true };
    controller.applyRawProps(rawProps);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toContain('text-red-500');

    // deactivate -> no tokens
    rawProps = { active: false };
    controller.applyRawProps(rawProps);
    tokens = controller.getRuleStyleTokens();
    expect(tokens).toEqual([]);
  });

  it('def.rule rejects runtime removal without changing its style contribution', () => {
    let handle: any;

    const proto: Prototype<{ active?: boolean }> = {
      name: 'rule-props-style-dispose',
      setup(def) {
        def.props.define({ active: { type: 'boolean', default: true } } as any);
        handle = def.rule({
          when: (w) => w.prop('active').eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const host: RuntimeHost<any> = {
      prototypeName: 'rule-props-style-dispose',
      getRawProps() {
        return { active: true };
      },
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
    };

    const { controller } = executeWithHost(proto as any, host as any);
    expect(controller.getRuleStyleTokens()).toContain('opacity-50');

    expect(() => handle.dispose()).toThrow();
    expect(controller.getRuleStyleTokens()).toContain('opacity-50');
  });
});
