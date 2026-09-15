import { describe, expect, it, vi } from 'vitest';
import { tw, type OwnedStateHandle, type WhenBuilder, type WhenExpr } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createRuleModule, RuleModuleDef } from '../src/create';
import { evaluateRulesToPlan } from '../src/eval';
import type { RuleExtension } from '../src/types';

type Props = Record<string, unknown>;
function fixture() {
  let setup = true;
  const caps = new CapsVault();
  caps.attachBase([
    [
      SYS_CAP,
      {
        ensureSetup() {
          if (!setup) throw new Error('setup only');
        },
      },
    ],
  ]);
  const module = createRuleModule<Props>({
    init: { prototypeName: 'rule-boundary', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw new Error('unexpected');
      },
      requirePort() {
        throw new Error('unexpected');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  return {
    module,
    runtime: () => {
      setup = false;
    },
  };
}

describe('Rule catalog core boundary', () => {
  it('T-RULE-0002-CASE-IR: records prop/state identities and keeps live getters outside the supported style IR', () => {
    const { module } = fixture();
    const get = vi.fn(() => true);
    const state = { id: 'slot-a', get } as unknown as OwnedStateHandle<boolean>;
    const when = vi.fn((w: WhenBuilder<Props>) =>
      w.all(w.prop('active').eq(true), w.state(state).eq(true), w.state(state).eq(true))
    );
    module.facade.rule({
      when,
      intent: (i) => {
        i.feedback.style.use(tw('opacity-25'));
        i.feedback.style.use(tw('opacity-50 text-white'));
      },
    });
    expect(when).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    const ir = module.port.exportIR();
    expect(ir[0].deps).toEqual([
      { kind: 'prop', key: 'active' },
      { kind: 'state', id: 'slot-a' },
    ]);
    expect(module.port.resolveStateHandle('slot-a')).toBe(state);
    expect(JSON.parse(JSON.stringify(ir))).toEqual(
      ir.map((r) => ({ ...r, label: undefined, note: undefined }))
    );
    // Round-trip the supported IR with an explicit external state reader.
    const roundTrip = JSON.parse(JSON.stringify(ir));
    expect(
      evaluateRulesToPlan(roundTrip, { props: { active: true }, readState: () => true }).tokens
    ).toEqual(['opacity-50', 'text-white']);
    expect(module.port.evaluate({ props: { active: false } })).toMatchObject({
      plan: { tokens: [] },
    });
    expect(module.port.evaluate({ props: { active: true } })).toMatchObject({
      plan: { tokens: ['opacity-50', 'text-white'] },
    });
    expect(when).toHaveBeenCalledTimes(1);
  });

  it('T-RULE-0002-CASE-WHEN: evaluates strict equality and logical identities without mutating inputs', () => {
    const { module } = fixture();
    const cases: Array<[string, (w: WhenBuilder<Props>) => WhenExpr<Props>]> = [
      ['truth', (w) => w.t()],
      ['falsehood', (w) => w.f()],
      ['empty-all', (w) => w.all()],
      ['empty-any', (w) => w.any()],
      ['strict', (w) => w.prop('value').eq(1)],
      ['not', (w) => w.not(w.prop('value').eq(1))],
      ['any', (w) => w.any(w.f(), w.prop('value').eq(1))],
    ];
    for (const [token, when] of cases)
      module.facade.rule({ when, intent: (i) => i.feedback.style.use(tw(token)) });
    const props = Object.freeze({ value: '1' });
    expect(module.port.evaluate({ props })).toMatchObject({
      plan: { tokens: ['truth', 'empty-all', 'not'] },
    });
    expect(module.port.evaluate({ props: { value: 1 } })).toMatchObject({
      plan: { tokens: ['truth', 'empty-all', 'strict', 'any'] },
    });
    expect(props.value).toBe('1');
  });

  it('T-RULE-0002-CASE-STYLE: validates even inactive author style intents while compiling the declaration', () => {
    const { module } = fixture();
    for (const handle of [
      tw('hover:opacity-50'),
      { kind: 'tw', tokens: ['.selector'] },
      { kind: 'css', tokens: [] },
      { kind: 'tw', tokens: null },
    ]) {
      expect(() =>
        module.facade.rule({
          when: (w) => w.f(),
          intent: (i) => i.feedback.style.use(handle as any),
        })
      ).toThrow();
      expect(module.port.exportIR()).toEqual([]);
    }
  });

  it('T-RULE-0002-CASE-EXTENSION: transforms then plans in registration order and short-circuits without implicit effects', () => {
    const { module } = fixture();
    module.facade.rule({
      when: (w) => w.t(),
      intent: (i) => i.feedback.style.use(tw('base-token')),
    });
    const order: string[] = [];
    const extension = (name: string): RuleExtension<Props> => ({
      transformRules: (rules) => {
        order.push(name + '-transform');
        return rules;
      },
      beforePlan: () => {
        order.push(name + '-before');
        return { kind: 'continue' };
      },
      afterPlan: (plan) => {
        order.push(name + '-after');
        return { ...plan, tokens: [...plan.tokens, name] };
      },
    });
    module.port.registerExtension(extension('a'));
    module.port.registerExtension(extension('b'));
    expect(module.port.evaluate({ props: {} })).toMatchObject({
      plan: { tokens: ['base-token', 'a', 'b'] },
    });
    expect(order).toEqual([
      'a-transform',
      'b-transform',
      'a-before',
      'b-before',
      'a-after',
      'b-after',
    ]);
    const execute = vi.fn();
    module.port.registerExtension({ beforePlan: () => ({ kind: 'short-circuit', execute }) });
    order.length = 0;
    expect(module.port.evaluate({ props: {} })).toEqual({ kind: 'short-circuit', executed: true });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['a-transform', 'b-transform', 'a-before', 'b-before']);
  });

  it('T-RULE-0002-CASE-LIFETIME: terminal disposal clears IR, handle tables and extension closures', () => {
    const { module, runtime } = fixture();
    const get = vi.fn(() => true);
    module.facade.rule({
      when: (w) => w.state({ id: 'slot', get } as any).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    const execute = vi.fn();
    module.port.registerExtension({ beforePlan: () => ({ kind: 'short-circuit', execute }) });
    runtime();
    module.hooks.dispose?.();
    expect(module.port.exportIR()).toEqual([]);
    expect(module.port.resolveStateHandle('slot')).toBeUndefined();
    expect(() => module.port.evaluate({ props: {} })).toThrow(/disposed/i);
    expect(() => module.port.registerExtension({})).toThrow(/disposed/i);
    module.hooks.onProtoPhase?.('mounted');
    expect(get).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(RuleModuleDef.resourceOwnership).toBe('mixed');
    expect(RuleModuleDef.deps).toEqual([]);
  });
});
