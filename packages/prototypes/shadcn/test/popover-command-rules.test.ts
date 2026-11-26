import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DefHandle } from '@proto.ui/core';
import { compileRule } from '../../../modules/rule/src/compile';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { setupPopoverCommandPaint } from '../src/popover/command-paint';
import type { PopoverTriggerProps } from '../src/popover/types';

// Compile the actual private installer with the production Rule compiler.
// This captures setup declarations; public host/input behavior remains covered
// by popover-command-density and popover-navigation, not this setup-only harness.
function capture(command: 'trigger' | 'close') {
  type Rule = ReturnType<typeof compileRule<PopoverTriggerProps>>;
  type Declaration = Parameters<DefHandle<PopoverTriggerProps>['props']['define']>[0];
  type Defaults = Parameters<DefHandle<PopoverTriggerProps>['props']['setDefaults']>[0];
  const rules: Rule[] = [];
  const declarations: Declaration[] = [];
  const defaults: Defaults[] = [];
  const handle = <T>(name: string, initial: T) => {
    let value = initial;
    return {
      __stateId: name,
      get: () => value,
      setDefault: (next: T) => {
        value = next;
      },
      set: (next: T) => {
        value = next;
      },
    };
  };
  const stop = () => {};
  // Only these setup APIs are reachable in the real style-selection helper.
  // The assertion is confined to the harness; both real callers are type-checked.
  const def = {
    props: {
      define: (declaration: Declaration) => {
        declarations.push(declaration);
      },
      setDefaults: (value: Defaults) => {
        defaults.push(value);
      },
      watchRaw: () => stop,
    },
    state: { enum: handle },
    context: { trySubscribe: () => stop },
    lifecycle: { onCreated: stop, onMounted: stop, onUpdated: stop },
    rule: (spec: Parameters<DefHandle<PopoverTriggerProps>['rule']>[0]) => {
      rules.push(compileRule(spec));
      return { id: rules.length, dispose: stop };
    },
  } as unknown as DefHandle<PopoverTriggerProps>;
  setupPopoverCommandPaint(
    def,
    {
      hovered: handle('hovered', false),
      focusVisible: handle('focusVisible', false),
      disabled: handle('disabled', false),
      pressed: handle('pressed', false),
    },
    command
  );
  return { rules, declarations, defaults };
}

const rawTokens = (rules: ReturnType<typeof capture>['rules']) =>
  [
    ...new Set(
      rules.flatMap((rule) =>
        rule.intent.ops.flatMap((op) =>
          op.kind === 'feedback.style.use' ? op.handles.flatMap((handle) => handle.tokens) : []
        )
      )
    ),
  ].sort();

describe('Popover command Rules keep their concrete presentation ownership', () => {
  it('keeps all 45 Close rules independent of presentation, including the separate press rule', () => {
    const { rules, declarations, defaults } = capture('close');
    expect(rules).toHaveLength(45);
    expect(rules.flatMap((rule) => rule.deps).filter((dep) => dep.kind === 'prop')).toEqual([]);
    expect(declarations).toHaveLength(1);
    expect(Object.keys(declarations[0])).toEqual(['styleProfile']);
    expect(defaults).toEqual([{ styleProfile: 'inherit' }]);
    const press = rules.filter((rule) => rawTokens([rule]).includes('translate-y-px'));
    expect(press).toHaveLength(1);
    expect(press[0].when).toEqual({
      type: 'all',
      exprs: [
        {
          type: 'not',
          expr: {
            type: 'eq',
            left: { type: 'state', id: 'shadcnStyleSelection' },
            right: 'new-york-v4',
          },
        },
        { type: 'eq', left: { type: 'state', id: 'pressed' }, right: true },
        { type: 'eq', left: { type: 'state', id: 'disabled' }, right: false },
      ],
    });
  });

  it('keeps all 44 default and 28 navigation Trigger rules under their own presentation', () => {
    const { rules, declarations, defaults } = capture('trigger');
    expect(rules).toHaveLength(72);
    const presentations: unknown[] = [];
    for (const rule of rules) {
      expect(rule.deps[0]).toEqual({ kind: 'prop', key: 'presentation' });
      expect(rule.when.type).toBe('all');
      if (rule.when.type !== 'all') throw new Error('Trigger Rule lost its presentation guard');
      expect(rule.when.exprs).toHaveLength(2);
      const presentation = rule.when.exprs[0];
      expect(presentation.type).toBe('eq');
      if (presentation.type !== 'eq') throw new Error('Trigger presentation is not an equality');
      expect(presentation.left).toEqual({ type: 'prop', key: 'presentation' });
      presentations.push(presentation.right);
    }
    expect(presentations.filter((value) => value === 'default')).toHaveLength(44);
    expect(presentations.filter((value) => value === 'navigation')).toHaveLength(28);
    expect(rawTokens(rules)).not.toContain('translate-y-px');
    expect(
      rules.flatMap((rule) => rule.deps).some((dep) => dep.kind === 'state' && dep.id === 'pressed')
    ).toBe(false);
    expect(declarations).toHaveLength(1);
    expect(Object.keys(declarations[0])).toEqual(['styleProfile']);
    expect(defaults).toEqual([{ styleProfile: 'inherit' }]);
  });

  it.each(['trigger', 'close'] as const)(
    'collects executable CSS for every actual %s Rule intent',
    async (command) => {
      const required = rawTokens(capture(command).rules);
      expect(required.length).toBeGreaterThan(0);
      const root = path.resolve('packages/prototypes/shadcn/src/popover');
      const collected = await collectProtoStyleTokensFromFiles([
        path.join(root, `${command}.proto.ts`),
        path.join(root, 'command-paint.ts'),
      ]);
      expect(required.filter((token) => !collected.includes(token))).toEqual([]);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        expect(render(required)).not.toContain('Unsupported Proto UI style tokens');
      }
    }
  );
});
