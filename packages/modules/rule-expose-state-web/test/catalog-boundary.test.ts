import { expect, it } from 'vitest';
import { CapsVault } from '@proto.ui/module-base';
import type { RuleExtension, RuleIR } from '@proto.ui/module-rule';
import type { ExposeStateWebBinding } from '@proto.ui/module-expose-state-web';
import { createRuleExposeStateWebModule } from '../src/create';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '../src/caps';

function fixture() {
  const caps = new CapsVault();
  const map = new Map<string, ExposeStateWebBinding>([
    ['x', { stateId: 'x', key: 'x', kind: 'bool', attr: 'data-open' }],
  ]);
  const rules: RuleIR<any>[] = [
    {
      id: 1,
      deps: [{ kind: 'state', id: 'x' }],
      when: { type: 'eq', left: { type: 'state', id: 'x' }, right: true },
      intent: {
        kind: 'ops',
        ops: [{ kind: 'feedback.style.use', handles: [{ kind: 'tw', tokens: ['opacity-50'] }] }],
      },
    },
  ];
  let extension!: RuleExtension<any>;
  const contributions = new Set<string>();
  const module = createRuleExposeStateWebModule({
    init: { prototypeName: 'rule-web', declarations: [] },
    caps,
    deps: {
      requirePort: (name: string) =>
        ({
          rule: {
            exportIR: () => rules,
            registerExtension: (e: RuleExtension<any>) => {
              extension = e;
            },
          },
          'expose-state-web': { getExposedStateMap: () => map, isActive: () => true },
          feedback: {
            useStyleUnsafe: (h: { tokens: string[] }) => {
              const token = h.tokens.join(' ');
              contributions.add(token);
              return () => contributions.delete(token);
            },
          },
        })[name],
    } as any,
  });
  const remaining = () => extension.transformRules!(rules, { props: {} }).map((r) => r.id);
  const apply = () => {
    module.hooks?.afterRenderCommit?.();
  };
  const phase = (p: 'mounted' | 'detached' | 'mounting' | 'unmounting', epoch: number) =>
    module.hooks?.onMountPhase?.(p, epoch);
  return { module, caps, map, rules, contributions, remaining, apply, phase };
}

it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-LIFETIME: revokes optimized contributions and filtering between view epochs', () => {
  const f = fixture();
  f.phase('mounted', 1);
  f.apply();
  f.apply();
  expect([...f.contributions]).toEqual(['data-[open]:opacity-50']);
  expect(f.remaining()).toEqual([]);
  f.phase('unmounting', 1);
  expect([...f.contributions]).toEqual([]);
  expect(f.remaining()).toEqual([1]);
  f.phase('detached', 1);
  f.apply();
  expect([...f.contributions]).toEqual([]);
  f.map.set('x', { stateId: 'x', key: 'x', kind: 'bool', attr: 'data-next' });
  f.phase('mounting', 2);
  f.apply();
  expect([...f.contributions]).toEqual(['data-[next]:opacity-50']);
  f.module.hooks?.dispose?.();
  expect([...f.contributions]).toEqual([]);
  f.apply();
  expect([...f.contributions]).toEqual([]);
});

it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-FALLBACK: retains unsupported inputs, range and standalone negative rules', () => {
  const f = fixture();
  const base = f.rules[0];
  f.rules.push({
    ...base,
    id: 2,
    deps: [{ kind: 'prop', key: 'enabled' }],
    when: { type: 'eq', left: { type: 'prop', key: 'enabled' }, right: true },
  });
  f.rules.push({
    ...base,
    id: 3,
    when: { type: 'eq', left: { type: 'state', id: 'x' }, right: false },
  });
  f.rules.push({
    ...base,
    id: 4,
    deps: [{ kind: 'state', id: 'range' }],
    when: { type: 'eq', left: { type: 'state', id: 'range' }, right: 0.5 },
  });
  f.map.set('range', { stateId: 'range', key: 'range', kind: 'number.range', attr: 'data-range' });
  f.phase('mounted', 1);
  f.apply();
  expect(f.remaining()).toEqual([2, 3, 4]);
  expect([...f.contributions]).toEqual(['data-[open]:opacity-50']);
  f.module.hooks?.dispose?.();
});

it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-POLICY: denied native variant falls back to data and pure dark works without State bindings', () => {
  const f = fixture();
  f.map.set('x', {
    stateId: 'x',
    key: 'x',
    semantic: '@interaction/hovered',
    kind: 'bool',
    attr: 'data-hovered',
  });
  f.caps.attach([[RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, () => false]]);
  f.phase('mounted', 1);
  f.apply();
  expect([...f.contributions]).toEqual(['data-[hovered]:opacity-50']);
  f.module.hooks?.dispose?.();
  const dark = fixture();
  dark.map.clear();
  dark.rules[0].deps = [{ kind: 'meta', key: 'colorScheme' }];
  dark.rules[0].when = { type: 'eq', left: { type: 'meta', key: 'colorScheme' }, right: 'dark' };
  dark.phase('mounted', 1);
  dark.apply();
  expect(dark.remaining()).toEqual([1]);
  dark.caps.attach([[RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, () => false]]);
  expect([...dark.contributions]).toEqual(['dark:opacity-50']);
  expect(dark.remaining()).toEqual([]);
  dark.module.hooks?.dispose?.();
});

it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-REPRESENTATION: does not replace strict equality with a lossy or malformed selector', () => {
  const f = fixture(),
    base = f.rules[0];
  f.rules.length = 0;
  for (const [id, kind, literal, attr] of [
    [1, 'string', 1, 'data-value'],
    [2, 'number.discrete', '1', 'data-value'],
    [3, 'string', 'two words', 'data-value'],
    [4, 'bool', true, 'aria-expanded'],
  ] as const) {
    const key = String(id);
    f.map.set(key, { stateId: key, key, kind, attr });
    f.rules.push({
      ...base,
      id,
      deps: [{ kind: 'state', id: key }],
      when: { type: 'eq', left: { type: 'state', id: key }, right: literal },
    });
  }
  f.phase('mounted', 1);
  f.apply();
  expect(f.remaining()).toEqual([1, 2, 3, 4]);
  expect([...f.contributions]).toEqual([]);
  f.module.hooks?.dispose?.();
});
